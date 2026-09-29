import math
import re
import secrets
import string
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor_profile
from app.core.database import get_db
from app.core.security import hash_password
from app.models.appointment import Appointment
from app.models.doctor_profile import DoctorProfile
from app.models.enums import AppointmentStatus, RiskLevel, ScanStatus, UserRole
from app.models.patient_profile import PatientProfile
from app.models.report import Report
from app.models.scan import Scan
from app.models.user import User
from app.schemas.patients import (
    FollowupsDueStat,
    HighRiskStat,
    PatientCreateRequest,
    PatientCreateResponse,
    PatientListItem,
    PatientListResponse,
    PatientStat,
    PatientStats,
    PatientStatusUpdateRequest,
)
from app.services.audit import log_action

router = APIRouter(prefix="/api/doctor/patients", tags=["patients"])

RISK_ORDER = {"critical": 0, "high": 1, "moderate": 2, "low": 3, None: 4}


def _calculate_age(dob: date | None) -> int | None:
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _month_bounds(reference: date) -> tuple[date, date, date, date]:
    this_month_start = reference.replace(day=1)
    last_month_end = this_month_start - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    return this_month_start, reference, last_month_start, last_month_end


def _pct_change(current: int, previous: int) -> float | None:
    if previous == 0:
        return None if current == 0 else 100.0
    return round((current - previous) / previous * 100, 1)


def _patient_to_item(db: Session, patient: PatientProfile) -> PatientListItem:
    scans = (
        db.query(Scan)
        .filter(Scan.patient_id == patient.id, Scan.status != ScanStatus.archived)
        .order_by(Scan.scan_date.desc(), Scan.created_at.desc())
        .all()
    )
    scan_modules = {s.module.value for s in scans}
    preferred = set(patient.preferred_modules or [])
    modules = sorted(scan_modules | preferred)

    latest_scan = scans[0] if scans else None

    next_followup = (
        db.query(Appointment)
        .filter(
            Appointment.patient_id == patient.id,
            Appointment.status == AppointmentStatus.scheduled,
            Appointment.scheduled_date >= date.today(),
        )
        .order_by(Appointment.scheduled_date.asc())
        .first()
    )

    latest_risk = latest_scan.risk_level.value if latest_scan and latest_scan.risk_level else None

    return PatientListItem(
        id=patient.id,
        patient_id=patient.patient_code,
        patient_code=patient.patient_code,
        full_name=patient.full_name,
        date_of_birth=patient.date_of_birth,
        age=_calculate_age(patient.date_of_birth),
        gender=patient.gender,
        phone=patient.phone,
        email=patient.user.email if patient.user else None,
        status=patient.status,
        modules_used=modules,
        modules=modules,
        last_scan_date=latest_scan.scan_date if latest_scan else None,
        last_scan_risk_level=latest_risk,
        risk_level=latest_risk,
        next_followup_date=next_followup.scheduled_date if next_followup else None,
        created_at=patient.created_at,
    )


@router.get("/stats", response_model=PatientStats)
def patient_stats(
    db: Session = Depends(get_db), doctor: DoctorProfile = Depends(get_current_doctor_profile)
):
    today = date.today()
    this_start, this_end, last_start, last_end = _month_bounds(today)

    total_patients = db.query(PatientProfile).filter(PatientProfile.created_by_doctor_id == doctor.id).count()
    patients_this_month = (
        db.query(PatientProfile)
        .filter(PatientProfile.created_by_doctor_id == doctor.id, PatientProfile.created_at >= this_start)
        .count()
    )
    patients_last_month = (
        db.query(PatientProfile)
        .filter(
            PatientProfile.created_by_doctor_id == doctor.id,
            PatientProfile.created_at >= last_start,
            PatientProfile.created_at < last_end + timedelta(days=1),
        )
        .count()
    )

    total_scans = (
        db.query(Scan)
        .filter(Scan.doctor_id == doctor.id, Scan.status != ScanStatus.archived)
        .count()
    )
    scans_this_month = (
        db.query(Scan)
        .filter(Scan.doctor_id == doctor.id, Scan.status != ScanStatus.archived, Scan.created_at >= this_start)
        .count()
    )
    scans_last_month = (
        db.query(Scan)
        .filter(
            Scan.doctor_id == doctor.id,
            Scan.status != ScanStatus.archived,
            Scan.created_at >= last_start,
            Scan.created_at < last_end + timedelta(days=1),
        )
        .count()
    )

    patient_ids = [p.id for p in db.query(PatientProfile.id).filter(PatientProfile.created_by_doctor_id == doctor.id)]
    high_risk_patients = 0
    if patient_ids:
        for pid in patient_ids:
            latest = (
                db.query(Scan)
                .filter(Scan.patient_id == pid, Scan.status != ScanStatus.archived)
                .order_by(Scan.scan_date.desc(), Scan.created_at.desc())
                .first()
            )
            if latest and latest.risk_level in (RiskLevel.high, RiskLevel.critical):
                high_risk_patients += 1

    pct_of_total = round((high_risk_patients / total_patients) * 100, 1) if total_patients else 0.0

    followups_due = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor.id,
            Appointment.status == AppointmentStatus.scheduled,
            Appointment.scheduled_date >= today,
            Appointment.scheduled_date <= today + timedelta(days=7),
        )
        .count()
    )

    return PatientStats(
        total_patients=PatientStat(
            value=total_patients, change_pct=_pct_change(patients_this_month, patients_last_month)
        ),
        total_scans=PatientStat(value=total_scans, change_pct=_pct_change(scans_this_month, scans_last_month)),
        high_risk=HighRiskStat(value=high_risk_patients, pct_of_total=pct_of_total),
        followups_due=FollowupsDueStat(value=followups_due),
    )


@router.get("", response_model=PatientListResponse)
def list_patients(
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
    search: str | None = None,
    module: str | None = None,
    risk_level: str | None = None,
    status: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status_filter"),
    sort_by: str | None = Query(None),
    sort: str | None = Query("last_scan_newest", alias="sort"),
    page: int = Query(1, ge=1),
    limit: int | None = Query(None),
    page_size: int = Query(10, ge=1, le=100),
):
    effective_status = status or status_filter
    effective_sort = sort_by or sort or "last_scan_newest"
    effective_limit = limit or page_size

    patients = (
        db.query(PatientProfile).filter(PatientProfile.created_by_doctor_id == doctor.id).all()
    )
    items = [_patient_to_item(db, p) for p in patients]

    if search:
        needle = search.strip().lower()
        items = [
            i
            for i in items
            if needle in i.full_name.lower()
            or needle in i.patient_code.lower()
            or needle in i.patient_id.lower()
            or (i.phone and needle in i.phone.lower())
            or (i.email and needle in i.email.lower())
        ]

    if module and module.lower() != "all":
        mod_needle = module.lower()
        # Returns patients who have at least one scan of that module type
        items = [i for i in items if mod_needle in [m.lower() for m in i.modules_used]]

    if risk_level and risk_level.lower() != "all":
        # Returns patients whose latest scan matches
        risk_needle = risk_level.lower()
        items = [i for i in items if i.last_scan_risk_level and i.last_scan_risk_level.lower() == risk_needle]

    if effective_status and effective_status.lower() != "all":
        items = [i for i in items if i.status.lower() == effective_status.lower()]

    if effective_sort == "last_scan_oldest":
        items.sort(key=lambda i: (i.last_scan_date is None, i.last_scan_date or date.min))
    elif effective_sort == "name_asc":
        items.sort(key=lambda i: i.full_name.lower())
    elif effective_sort == "name_desc":
        items.sort(key=lambda i: i.full_name.lower(), reverse=True)
    elif effective_sort == "risk_level":
        items.sort(key=lambda i: RISK_ORDER.get(i.risk_level, 4))
    elif effective_sort == "created_at_asc":
        items.sort(key=lambda i: i.created_at or date.min)
    else:  # last_scan_newest or default
        items.sort(key=lambda i: (i.last_scan_date is None, i.last_scan_date or date.min), reverse=True)

    total = len(items)
    start = (page - 1) * effective_limit
    end = start + effective_limit
    page_items = items[start:end]
    total_pages = max(1, math.ceil(total / effective_limit)) if effective_limit else 1

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="PATIENT_LIST_VIEWED",
        resource_type="patient_profile",
        details={
            "search": search,
            "module": module,
            "risk_level": risk_level,
            "page": page,
            "limit": effective_limit,
            "total_count": total,
        },
    )

    return PatientListResponse(
        items=page_items,
        total=total,
        page=page,
        limit=effective_limit,
        page_size=effective_limit,
        total_pages=total_pages,
    )


def _generate_patient_code(db: Session) -> str:
    year = date.today().year
    prefix = f"P-{year}-"
    existing_codes = (
        db.query(PatientProfile.patient_code)
        .filter(PatientProfile.patient_code.like(f"{prefix}%"))
        .all()
    )
    max_seq = 0
    for (code,) in existing_codes:
        try:
            seq = int(code.split("-")[-1])
            if seq > max_seq:
                max_seq = seq
        except (ValueError, IndexError):
            pass
    return f"{prefix}{max_seq + 1:04d}"


def _validate_phone(phone: str) -> str:
    cleaned = re.sub(r"[\s\-\(\)]", "", phone)
    if not re.match(r"^\+?[0-9]{10,15}$", cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number format. Must contain 10-15 digits.",
        )
    return phone.strip()


@router.post("", response_model=PatientCreateResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreateRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    if not payload.full_name or not payload.full_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name is required.",
        )

    # Validate phone format
    validated_phone = _validate_phone(payload.phone)

    # Validate date of birth is in the past
    if payload.date_of_birth >= date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date of birth must be in the past.",
        )

    # Validate patient is not already registered with same phone under this doctor
    duplicate_phone = (
        db.query(PatientProfile)
        .filter(
            PatientProfile.phone == validated_phone,
            PatientProfile.created_by_doctor_id == doctor.id,
        )
        .first()
    )
    if duplicate_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A patient with this phone number is already registered under your account.",
        )

    # Validate email uniqueness if provided
    email = payload.email
    if email:
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email address is already registered.",
            )

    # Validate consent if given as object
    consent_dict = {}
    if payload.consent:
        consent_dict = (
            payload.consent.model_dump()
            if hasattr(payload.consent, "model_dump")
            else dict(payload.consent)
        )
        if hasattr(payload.consent, "data_storage_and_ai_analysis") and not payload.consent.data_storage_and_ai_analysis:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Informed consent for data storage and AI analysis is required.",
            )

    patient_code = _generate_patient_code(db)

    if not email:
        email = f"{patient_code.lower()}@patients.auramed.local"

    # Auto-generate temporary password: 8 characters alphanumeric
    alphabet = string.ascii_letters + string.digits
    temporary_password = "".join(secrets.choice(alphabet) for _ in range(8))

    user = User(
        email=email,
        password_hash=hash_password(temporary_password),
        role=UserRole.patient,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    db.flush()

    patient = PatientProfile(
        user_id=user.id,
        patient_code=patient_code,
        full_name=payload.full_name.strip(),
        date_of_birth=payload.date_of_birth,
        gender=payload.gender,
        phone=validated_phone,
        address=payload.address,
        pin_code=payload.pin_code,
        blood_group=payload.blood_group,
        emergency_contact_name=payload.emergency_contact_name,
        emergency_contact_phone=payload.emergency_contact_phone,
        emergency_contact_relation=payload.emergency_contact_relation,
        family_history=payload.family_history,
        personal_medical_history={
            **(payload.personal_medical_history or {}),
            "additional_notes": payload.additional_notes,
        },
        allergies=payload.allergies,
        current_medications=payload.current_medications,
        overall_notes=payload.overall_notes or payload.additional_notes,
        consent=consent_dict,
        preferred_modules=payload.preferred_modules,
        created_by_doctor_id=doctor.id,
        status="active",
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="NEW_PATIENT_REGISTERED",
        resource_type="patient_profile",
        resource_id=patient.id,
        details={
            "full_name": patient.full_name,
            "patient_name": patient.full_name,
            "patient_id": patient_code,
            "generated_id": patient_code,
        },
    )

    return PatientCreateResponse(
        patient_id=patient.id,
        patient_code=patient_code,
        generated_patient_id=patient_code,
        full_name=patient.full_name,
        temporary_password=temporary_password,
        created_at=patient.created_at,
        email=payload.email,
        message="Patient registered successfully",
    )


@router.patch("/{patient_id}/status", response_model=PatientListItem)
def update_patient_status(
    patient_id: str,
    payload: PatientStatusUpdateRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    patient = (
        db.query(PatientProfile)
        .filter(PatientProfile.id == patient_id, PatientProfile.created_by_doctor_id == doctor.id)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    if payload.status not in ("active", "inactive"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")

    patient.status = payload.status
    db.commit()
    return _patient_to_item(db, patient)


@router.delete("/{patient_id}")
def delete_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    patient = (
        db.query(PatientProfile)
        .filter(PatientProfile.id == patient_id, PatientProfile.created_by_doctor_id == doctor.id)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    has_scans = db.query(Scan).filter(Scan.patient_id == patient.id).first() is not None
    has_reports = db.query(Report).filter(Report.patient_id == patient.id).first() is not None
    if has_scans or has_reports:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This patient has scan or report history and cannot be deleted. Mark them inactive instead.",
        )

    user = patient.user
    db.delete(patient)
    if user:
        db.delete(user)
    db.commit()
    return {"message": "Patient deleted"}
