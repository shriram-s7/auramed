import re
import uuid
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor_profile
from app.core.database import get_db
from app.models.appointment import Appointment
from app.models.doctor_profile import DoctorProfile
from app.models.enums import AppointmentStatus, ScanStatus, ScreeningModule
from app.models.patient_profile import PatientProfile
from app.models.referral import Referral
from app.models.report import Report
from app.models.scan import Scan
from app.models.user import User
from app.ml.trajectory import compute_risk_trajectory
from app.schemas.patient_detail import (
    AppointmentRow,
    FollowupPlanItem,
    ModuleStatus,
    NoteCreateRequest,
    NoteRow,
    OverallNotesUpdateRequest,
    PatientDetailInfo,
    PatientDetailResponse,
    PatientRiskTrendResponse,
    PatientUpdateRequest,
    QuickInfo,
    RecentScanItem,
    ReferralRow,
    ReportRow,
    RiskTrendPoint,
    ScanRow,
    TimelineEvent,
    UrgentFlagResponse,
)
from app.services.audit import log_action

router = APIRouter(prefix="/api/doctor/patients", tags=["patient-detail"])

RISK_SCORE_FALLBACK = {"critical": 0.9, "high": 0.7, "moderate": 0.4, "low": 0.1}


def _get_owned_patient(db: Session, doctor: DoctorProfile, patient_id: str) -> PatientProfile:
    patient = None
    try:
        pid = uuid.UUID(patient_id)
        patient = (
            db.query(PatientProfile)
            .filter(PatientProfile.id == pid, PatientProfile.created_by_doctor_id == doctor.id)
            .first()
        )
    except ValueError:
        pass

    if not patient:
        patient = (
            db.query(PatientProfile)
            .filter(PatientProfile.patient_code == patient_id, PatientProfile.created_by_doctor_id == doctor.id)
            .first()
        )

    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return patient


def _calculate_age(dob: date | None) -> int | None:
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _risk_score(scan: Scan) -> float:
    if scan.fusion_score is not None:
        return scan.fusion_score
    if scan.risk_level:
        return RISK_SCORE_FALLBACK.get(scan.risk_level.value, 0.0)
    return 0.0


def _validate_phone(phone: str) -> str:
    cleaned = re.sub(r"[\s\-\(\)]", "", phone)
    if not re.match(r"^\+?[0-9]{10,15}$", cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number format. Must contain 10-15 digits.",
        )
    return phone.strip()


def _build_detail(db: Session, patient: PatientProfile) -> PatientDetailResponse:
    scans = (
        db.query(Scan)
        .filter(Scan.patient_id == patient.id, Scan.status != ScanStatus.archived)
        .order_by(Scan.scan_date.desc(), Scan.created_at.desc())
        .all()
    )
    reports = (
        db.query(Report)
        .filter(Report.patient_id == patient.id)
        .order_by(Report.created_at.desc())
        .all()
    )
    appointments = (
        db.query(Appointment)
        .filter(Appointment.patient_id == patient.id)
        .order_by(Appointment.scheduled_date.desc())
        .all()
    )
    referrals = (
        db.query(Referral)
        .filter(Referral.patient_id == patient.id)
        .order_by(Referral.created_at.desc())
        .all()
    )

    age = _calculate_age(patient.date_of_birth)

    family_summary_parts = []
    if patient.family_history:
        for key, value in patient.family_history.items():
            if key == "other_details" or not value:
                continue
            family_summary_parts.append(key.replace("_", " ").title())
        if patient.family_history.get("other_details"):
            family_summary_parts.append(patient.family_history["other_details"])
    relevant_history_summary = ", ".join(family_summary_parts) or None

    today = date.today()
    upcoming_appointments = [
        a for a in appointments if a.status.value == "scheduled" and a.scheduled_date >= today
    ]
    next_followup = min(upcoming_appointments, key=lambda a: a.scheduled_date, default=None)
    last_visit = max(
        (a.scheduled_date for a in appointments if a.status.value == "completed"),
        default=None,
    )

    next_followup_date = next_followup.scheduled_date if next_followup else None
    overdue = bool(next_followup_date and next_followup_date < today)
    soon = bool(
        next_followup_date and not overdue and (next_followup_date - today).days <= 3
    )

    quick_info = QuickInfo(
        blood_group=patient.blood_group,
        allergies_summary=patient.allergies,
        relevant_history_summary=relevant_history_summary,
        last_visit_date=last_visit,
        next_followup_date=next_followup_date,
        next_followup_overdue=overdue,
        next_followup_soon=soon,
    )

    modules = []
    scans_by_module = {}
    latest_risk_per_module = {}
    next_followup_dates = {}

    for mod in ScreeningModule:
        mod_scans = [s for s in scans if s.module == mod]
        mod_scans.sort(key=lambda s: (s.scan_date or date.min, s.created_at or datetime.min), reverse=True)
        latest = mod_scans[0] if mod_scans else None
        mod_appointments = [
            a
            for a in upcoming_appointments
            if a.scan_id and a.scan_id in {s.id for s in mod_scans}
        ]
        next_mod_followup = min(
            (a.scheduled_date for a in mod_appointments), default=None
        )

        scans_by_module[mod.value] = len(mod_scans)
        latest_risk_per_module[mod.value] = latest.risk_level.value if latest and latest.risk_level else None
        next_followup_dates[mod.value] = next_mod_followup

        modules.append(
            ModuleStatus(
                module=mod.value,
                has_scans=bool(mod_scans),
                last_scan_date=latest.scan_date if latest else None,
                last_scan_id=latest.id if latest else None,
                risk_level=latest.risk_level.value if latest and latest.risk_level else None,
                next_followup_date=next_mod_followup,
            )
        )

    timeline: list[TimelineEvent] = []
    reg_date = (
        datetime.combine(patient.created_at.date(), datetime.min.time())
        if isinstance(patient.created_at, datetime)
        else patient.created_at
    )
    timeline.append(
        TimelineEvent(
            id=f"registration-{patient.id}",
            date=reg_date,
            type="registration",
            event_type="registration",
            title="Patient registered",
            description=f"Patient {patient.full_name} registered into AuraMed under ID {patient.patient_code}",
            badge=None,
            risk_level=None,
            reference_id=patient.id,
            related_id=str(patient.id),
            module=None,
            icon_type="user",
        )
    )
    for s in scans:
        scan_dt = datetime.combine(s.scan_date, datetime.min.time()) if s.scan_date else s.created_at
        r_lvl = s.risk_level.value if s.risk_level else None
        timeline.append(
            TimelineEvent(
                id=f"scan-{s.id}",
                date=scan_dt,
                type="scan",
                event_type="scan",
                title=f"{s.module.value.title()} Scan ({s.status.value})",
                description=f"{s.module.value.title()} screening scan completed. Risk level: {r_lvl or 'N/A'}.",
                badge=r_lvl,
                risk_level=r_lvl,
                reference_id=s.id,
                related_id=str(s.id),
                module=s.module.value,
                icon_type="scan",
            )
        )
    for r in reports:
        rep_dt = r.signed_at or r.created_at
        timeline.append(
            TimelineEvent(
                id=f"report-{r.id}",
                date=rep_dt,
                type="report",
                event_type="report",
                title=f"Report {r.report_number} ({r.status})",
                description=f"Diagnostic report {r.report_number} status is {r.status}.",
                badge=r.status,
                risk_level=None,
                reference_id=r.id,
                related_id=str(r.id),
                module=None,
                icon_type="file-text",
            )
        )
    for a in appointments:
        appt_dt = datetime.combine(a.scheduled_date, datetime.min.time())
        timeline.append(
            TimelineEvent(
                id=f"appointment-{a.id}",
                date=appt_dt,
                type="appointment",
                event_type="appointment",
                title=a.appointment_type or "Appointment",
                description=f"Appointment scheduled on {a.scheduled_date} ({a.status.value}).",
                badge=a.status.value,
                risk_level=None,
                reference_id=a.id,
                related_id=str(a.id),
                module=None,
                icon_type="calendar",
            )
        )
    for ref in referrals:
        timeline.append(
            TimelineEvent(
                id=f"referral-{ref.id}",
                date=ref.created_at,
                type="referral",
                event_type="referral",
                title=f"Referral to {ref.to_specialist or ref.specialty or 'specialist'}",
                description=f"Specialist referral created with priority {ref.priority.value}.",
                badge=ref.status,
                risk_level=None,
                reference_id=ref.id,
                related_id=str(ref.id),
                module=None,
                icon_type="share-2",
            )
        )
    timeline.sort(key=lambda e: e.date, reverse=True)

    recent_scans = [
        RecentScanItem(
            scan_id=s.id,
            module=s.module.value,
            scan_date=s.scan_date,
            risk_level=s.risk_level.value if s.risk_level else None,
            status=s.status.value,
            rotterdam_positive=s.rotterdam_positive,
        )
        for s in scans[:3]
    ]

    risk_trend: dict[str, list[RiskTrendPoint]] = {}
    for mod in ScreeningModule:
        mod_scans = sorted(
            [s for s in scans if s.module == mod and s.scan_date],
            key=lambda s: s.scan_date,
        )
        risk_trend[mod.value] = [
            RiskTrendPoint(
                date=s.scan_date,
                scan_date=s.scan_date,
                score=round(_risk_score(s), 3),
                fusion_score=round(_risk_score(s), 3),
                risk_level=s.risk_level.value if s.risk_level else None,
            )
            for s in mod_scans
        ]
    scan_rows = [
        ScanRow(
            id=s.id,
            module=s.module.value,
            scan_date=s.scan_date,
            image_quality=s.image_quality,
            risk_level=s.risk_level.value if s.risk_level else None,
            confidence_score=s.confidence_score,
            status=s.status.value,
            doctor_name=s.doctor.full_name if s.doctor else None,
            clinical_inputs=s.clinical_inputs,
            reasoning=s.reasoning,
            criterion_oligo_anovulation=s.criterion_oligo_anovulation,
            criterion_hyperandrogenism=s.criterion_hyperandrogenism,
            criterion_polycystic_ovaries=s.criterion_polycystic_ovaries,
            rotterdam_criteria_met=s.rotterdam_criteria_met,
            rotterdam_positive=s.rotterdam_positive,
        )
        for s in scans
    ]

    report_rows = [
        ReportRow(
            id=r.id,
            scan_id=r.scan_id,
            report_number=r.report_number,
            status=r.status,
            signed_at=r.signed_at,
            shared_with_patient=r.shared_with_patient,
            pdf_path=r.pdf_path,
            created_at=r.created_at,
        )
        for r in reports
    ]

    appointment_rows = [
        AppointmentRow(
            id=a.id,
            appointment_type=a.appointment_type,
            scheduled_date=a.scheduled_date,
            scheduled_time=a.scheduled_time.isoformat() if a.scheduled_time else None,
            location=a.location,
            status=a.status.value,
            notes=a.notes,
            ai_recommended=a.ai_recommended,
            doctor_override=a.doctor_override,
        )
        for a in appointments
    ]

    follow_up_plan = []
    for mod_status in modules:
        mod_appt = next(
            (
                a
                for a in upcoming_appointments
                if a.scan_id and mod_status.last_scan_id and a.scan_id == mod_status.last_scan_id
            ),
            None,
        )
        follow_up_plan.append(
            FollowupPlanItem(
                module=mod_status.module,
                ai_recommended_date=None,
                doctor_set_date=mod_appt.scheduled_date if mod_appt else mod_status.next_followup_date,
                status="scheduled" if mod_appt else ("no scan yet" if not mod_status.has_scans else "not scheduled"),
            )
        )

    note_rows = [
        NoteRow(id=n["id"], text=n["text"], created_at=n["created_at"])
        for n in (patient.notes or [])
    ]
    note_rows.sort(key=lambda n: n.created_at, reverse=True)

    referral_rows = [
        ReferralRow(
            id=ref.id,
            to_specialist=ref.to_specialist,
            specialty=ref.specialty,
            reason=ref.reason,
            priority=ref.priority.value,
            status=ref.status,
            created_at=ref.created_at,
        )
        for ref in referrals
    ]

    patient_info = PatientDetailInfo(
        id=patient.id,
        patient_id=patient.patient_code,
        patient_code=patient.patient_code,
        full_name=patient.full_name,
        status=patient.status,
        is_urgent=patient.is_urgent,
        date_of_birth=patient.date_of_birth,
        age=age,
        gender=patient.gender,
        phone=patient.phone,
        email=patient.user.email if patient.user else None,
        address=patient.address,
        pin_code=patient.pin_code,
        blood_group=patient.blood_group,
        allergies=patient.allergies,
        current_medications=patient.current_medications,
        family_history=patient.family_history,
        personal_medical_history=patient.personal_medical_history,
        emergency_contact_name=patient.emergency_contact_name,
        emergency_contact_phone=patient.emergency_contact_phone,
        emergency_contact_relation=patient.emergency_contact_relation,
        overall_notes=patient.overall_notes,
        created_at=patient.created_at,
        updated_at=patient.updated_at,
    )

    return PatientDetailResponse(
        patient=patient_info,
        quick_info=quick_info,
        modules=modules,
        timeline=timeline,
        recent_scans=recent_scans,
        risk_trend=risk_trend,
        scans=scan_rows,
        reports=report_rows,
        appointments=appointment_rows,
        follow_up_plan=follow_up_plan,
        notes=note_rows,
        referrals=referral_rows,
        total_scans=len(scans),
        scans_by_module=scans_by_module,
        latest_risk_per_module=latest_risk_per_module,
        next_followup_dates=next_followup_dates,
    )


@router.get("/{patient_id}", response_model=PatientDetailResponse)
def get_patient_detail(
    patient_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    patient = _get_owned_patient(db, doctor, patient_id)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="PATIENT_RECORD_VIEWED",
        resource_type="patient_profile",
        resource_id=patient.id,
        details={"patient_name": patient.full_name, "patient_id": patient.patient_code},
    )

    return _build_detail(db, patient)


ALLOWED_UPDATE_FIELDS = {
    "full_name",
    "phone",
    "email",
    "address",
    "pin_code",
    "blood_group",
    "emergency_contact_name",
    "emergency_contact_phone",
    "emergency_contact_relation",
    "family_history",
    "personal_medical_history",
    "allergies",
    "current_medications",
    "overall_notes",
    "status",
}

READ_ONLY_FIELDS = {"date_of_birth", "gender", "patient_id", "patient_code"}


@router.patch("/{patient_id}", response_model=PatientDetailResponse)
async def update_patient(
    patient_id: str,
    request: Request,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    patient = _get_owned_patient(db, doctor, patient_id)

    try:
        raw_payload = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body.")

    # Read-only fields rejected with 400: date_of_birth, gender, patient_id
    for ro_field in READ_ONLY_FIELDS:
        if ro_field in raw_payload:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Field '{ro_field}' is read-only and cannot be updated.",
            )

    changes = {}

    # Validate phone if changed
    if "phone" in raw_payload and raw_payload["phone"] is not None:
        validated_phone = _validate_phone(str(raw_payload["phone"]))
        if validated_phone != patient.phone:
            duplicate_phone = (
                db.query(PatientProfile)
                .filter(
                    PatientProfile.phone == validated_phone,
                    PatientProfile.created_by_doctor_id == doctor.id,
                    PatientProfile.id != patient.id,
                )
                .first()
            )
            if duplicate_phone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Another patient with this phone number is already registered under your account.",
                )
            raw_payload["phone"] = validated_phone

    # Validate and update email if changed
    if "email" in raw_payload:
        new_email = raw_payload["email"]
        old_email = patient.user.email if patient.user else None
        if new_email and new_email != old_email:
            existing_user = db.query(User).filter(User.email == new_email, User.id != patient.user_id).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A user with this email address is already registered.",
                )
            if patient.user:
                patient.user.email = new_email
            changes["email"] = {"old": old_email, "new": new_email}

    # Apply allowed updates
    for field in ALLOWED_UPDATE_FIELDS:
        if field in raw_payload and field != "email":
            old_val = getattr(patient, field)
            new_val = raw_payload[field]
            if old_val != new_val:
                changes[field] = {"old": old_val, "new": new_val}
                setattr(patient, field, new_val)

    db.commit()
    db.refresh(patient)

    if changes:
        log_action(
            db,
            user_id=doctor.user_id,
            user_type="doctor",
            action="PATIENT_PROFILE_UPDATED",
            resource_type="patient_profile",
            resource_id=patient.id,
            details={"changes": changes},
        )

    return _build_detail(db, patient)


@router.get("/{patient_id}/timeline", response_model=list[TimelineEvent])
def get_patient_timeline(
    patient_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    patient = _get_owned_patient(db, doctor, patient_id)
    detail = _build_detail(db, patient)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="PATIENT_TIMELINE_VIEWED",
        resource_type="patient_profile",
        resource_id=patient.id,
        details={"patient_id": patient.patient_code, "events_count": len(detail.timeline)},
    )

    return detail.timeline


@router.get("/{patient_id}/risk-trend", response_model=PatientRiskTrendResponse)
def get_patient_risk_trend(
    patient_id: str,
    module: str | None = Query(None),
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    patient = _get_owned_patient(db, doctor, patient_id)
    query = db.query(Scan).filter(
        Scan.patient_id == patient.id,
        Scan.status != ScanStatus.archived,
    )
    selected_module = (module or "breast").lower()
    if selected_module != "all":
        try:
            mod_enum = ScreeningModule(selected_module)
            query = query.filter(Scan.module == mod_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid module '{module}'. Must be breast, cervical, or pcos.",
            )

    scans = query.order_by(Scan.scan_date.asc(), Scan.created_at.asc()).all()

    trajectory_result = compute_risk_trajectory(scans, module=selected_module)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="PATIENT_RISK_TREND_VIEWED",
        resource_type="patient_profile",
        resource_id=patient.id,
        details={
            "patient_id": patient.patient_code,
            "module": selected_module,
            "data_points": len(trajectory_result.data_points),
            "trend_direction": trajectory_result.trend_direction,
        },
    )

    return {
        "data_points": trajectory_result.data_points,
        "trajectory": trajectory_result.model_dump(),
        "module": selected_module,
    }


@router.patch("/{patient_id}/overall-notes", response_model=PatientDetailResponse)
def update_overall_notes(
    patient_id: str,
    payload: OverallNotesUpdateRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    patient = _get_owned_patient(db, doctor, patient_id)
    old_notes = patient.overall_notes
    patient.overall_notes = payload.overall_notes
    db.commit()

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="PATIENT_NOTES_UPDATED",
        resource_type="patient_profile",
        resource_id=patient.id,
        details={"old_notes": old_notes, "new_notes": payload.overall_notes},
    )

    return _build_detail(db, patient)


@router.post("/{patient_id}/notes", response_model=PatientDetailResponse, status_code=status.HTTP_201_CREATED)
def add_note(
    patient_id: str,
    payload: NoteCreateRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    patient = _get_owned_patient(db, doctor, patient_id)
    notes = list(patient.notes or [])
    notes.append(
        {
            "id": str(uuid.uuid4()),
            "text": payload.text,
            "created_at": datetime.utcnow().isoformat(),
        }
    )
    patient.notes = notes
    db.commit()

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="patient_note_added",
        resource_type="patient_profile",
        resource_id=patient.id,
        details={"text": payload.text},
    )

    return _build_detail(db, patient)


@router.post("/{patient_id}/flag-urgent", response_model=UrgentFlagResponse)
def toggle_urgent_flag(
    patient_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    patient = _get_owned_patient(db, doctor, patient_id)
    patient.is_urgent = not patient.is_urgent
    db.commit()

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="patient_flagged_urgent" if patient.is_urgent else "patient_unflagged_urgent",
        resource_type="patient_profile",
        resource_id=patient.id,
        details={"is_urgent": patient.is_urgent},
    )

    return UrgentFlagResponse(is_urgent=patient.is_urgent)
