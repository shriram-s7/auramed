import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor_profile
from app.core.database import get_db
from app.models.appointment import Appointment
from app.models.audit_log import AuditLog
from app.models.doctor_profile import DoctorProfile
from app.models.enums import AppointmentStatus
from app.models.scan import Scan
from app.schemas.scan_results import (
    AuditLogEntry,
    ClinicalContribution,
    DoctorReviewField,
    DoctorReviewUpdateRequest,
    FusionWeights,
    ImageFinding,
    ScanResultPatient,
    ScanResultsResponse,
    ScheduleFollowupRequest,
)
from app.services.audit import log_action

router = APIRouter(prefix="/api/doctor/scans", tags=["scan-results"])


def _calculate_age(dob) -> int | None:
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _get_owned_scan(db: Session, doctor: DoctorProfile, scan_id: str) -> Scan:
    try:
        sid = uuid.UUID(scan_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    scan = db.query(Scan).filter(Scan.id == sid).first()
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    if scan.doctor_id != doctor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to view this scan."
        )
    return scan


def _clinical_indication(module: str, inputs: dict) -> str:
    if module == "breast":
        parts = []
        if inputs.get("palpable_lump") == "yes":
            parts.append("palpable lump")
        if inputs.get("skin_changes") == "yes":
            parts.append("skin changes")
        if inputs.get("nipple_discharge") == "yes":
            parts.append("nipple discharge")
        fam = inputs.get("family_history")
        if fam and fam != "none":
            parts.append(f"family history ({fam.replace('_', ' ')})")
        return ", ".join(parts).capitalize() if parts else "Routine screening"
    if module == "cervical":
        reason = inputs.get("screening_reason")
        return reason.replace("_", " ").capitalize() if reason else "Routine screening"
    parts = []
    if inputs.get("menstrual_regularity") in ("irregular", "absent"):
        parts.append(f"{inputs.get('menstrual_regularity')} cycles")
    symptoms = [s for s in (inputs.get("clinical_symptoms") or []) if s != "none"]
    if symptoms:
        parts.append(", ".join(s.replace("_", " ") for s in symptoms))
    return "; ".join(parts).capitalize() if parts else "Routine screening"


def _doctor_review_fields(module: str, ai_suggestions: dict, doctor_modifications: dict) -> list[DoctorReviewField]:
    def field(key, label, ftype, options=None):
        ai_value = ai_suggestions.get(key)
        doctor_value = doctor_modifications.get(key, ai_value)
        return DoctorReviewField(key=key, label=label, type=ftype, options=options, ai_value=ai_value, doctor_value=doctor_value)

    if module == "breast":
        return [
            field("lump_size_cm", "Lump Size (cm)", "number"),
            field(
                "lump_location",
                "Lump Location",
                "select",
                ["upper_outer", "upper_inner", "lower_outer", "lower_inner", "central", "axillary_tail"],
            ),
            field(
                "birads_suggested",
                "BI-RADS Category",
                "select",
                ["BI-RADS 1", "BI-RADS 2", "BI-RADS 3", "BI-RADS 4", "BI-RADS 5"],
            ),
        ]
    if module == "cervical":
        return [
            field("classification_suggested", "Classification", "select", ["NILM", "ASC-US", "LSIL", "HSIL"]),
            field("cin_stage_suggested", "CIN Stage", "select", ["None", "CIN 1", "CIN 2", "CIN 3"]),
        ]
    return [
        field("rotterdam_oligo_anovulation", "Oligo/Anovulation", "checkbox"),
        field("rotterdam_hyperandrogenism", "Clinical/Biochemical Hyperandrogenism", "checkbox"),
        field("rotterdam_polycystic_ovaries", "Polycystic Ovaries", "checkbox"),
        field("pcos_classification_suggested", "PCOS Classification", "text"),
    ]


@router.get("/{scan_id}/results", response_model=ScanResultsResponse)
def get_scan_results(
    scan_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    scan = _get_owned_scan(db, doctor, scan_id)
    patient = scan.patient
    reasoning = scan.reasoning or {}
    ai_suggestions = scan.ai_suggestions or {}
    doctor_modifications = scan.doctor_modifications or {}

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="SCAN_RESULTS_VIEWED",
        resource_type="scan",
        resource_id=scan.id,
        details={"scan_id": str(scan.id), "module": scan.module.value},
    )

    # Resolve Rotterdam fields for PCOS
    c_oligo = scan.criterion_oligo_anovulation
    c_hyper = scan.criterion_hyperandrogenism
    c_poly = scan.criterion_polycystic_ovaries
    met_count = scan.rotterdam_criteria_met
    is_positive = scan.rotterdam_positive

    if scan.module.value == "pcos" and (c_oligo is None or c_hyper is None or c_poly is None):
        inputs = scan.clinical_inputs or {}
        # Oligo
        if "criterion_oligo_anovulation" in inputs:
            val = inputs["criterion_oligo_anovulation"]
            c_oligo = str(val).lower() in ("true", "1", "yes") if isinstance(val, (str, int, bool)) else bool(val)
        elif "oligo_anovulation_present" in inputs:
            val = inputs["oligo_anovulation_present"]
            c_oligo = str(val).lower() in ("true", "1", "yes") if isinstance(val, (str, int, bool)) else bool(val)
        else:
            reg = str(inputs.get("cycle_regularity") or inputs.get("menstrual_regularity") or inputs.get("menstrual_cycle_regularity") or "").lower()
            c_oligo = reg in ("irregular", "absent", "oligomenorrhea", "amenorrhea")

        # Hyper
        if "criterion_hyperandrogenism" in inputs:
            val = inputs["criterion_hyperandrogenism"]
            c_hyper = str(val).lower() in ("true", "1", "yes") if isinstance(val, (str, int, bool)) else bool(val)
        elif "hyperandrogenism_present" in inputs:
            val = inputs["hyperandrogenism_present"]
            c_hyper = str(val).lower() in ("true", "1", "yes") if isinstance(val, (str, int, bool)) else bool(val)
        else:
            syms = inputs.get("clinical_symptoms") or []
            if isinstance(syms, str):
                syms = [s.strip().lower() for s in syms.split(",")]
            c_hyper = any(s in ("hirsutism", "acne", "hair_thinning", "alopecia") for s in syms) or float(inputs.get("hirsutism_score") or 0) >= 8 or float(inputs.get("total_testosterone_ng_dl") or inputs.get("testosterone") or 0) > 50

        # Poly
        img_findings_str = str(reasoning.get("image_findings", "")).lower()
        c_poly = (scan.image_model_score is not None and scan.image_model_score > 0.55) or ("polycystic" in img_findings_str or "pcom" in img_findings_str)

        met_count = (1 if c_oligo else 0) + (1 if c_hyper else 0) + (1 if c_poly else 0)
        is_positive = met_count >= 2

    return ScanResultsResponse(
        scan_id=scan.id,
        module=scan.module.value,
        scan_type_label=reasoning.get("scan_type_label", scan.module.value.title()),
        status=scan.status.value,
        scan_date=scan.scan_date,
        image_path=scan.image_path,
        image_quality=scan.image_quality,
        clinical_indication=_clinical_indication(scan.module.value, scan.clinical_inputs or {}),
        referring_physician=f"Dr. {doctor.full_name}" if not doctor.full_name.startswith("Dr") else doctor.full_name,
        analysis_datetime=scan.created_at,
        patient=ScanResultPatient(
            id=patient.id,
            full_name=patient.full_name,
            patient_code=patient.patient_code,
            age=_calculate_age(patient.date_of_birth),
            gender=patient.gender,
        ),
        image_findings=[ImageFinding(**f) for f in reasoning.get("image_findings", [])],
        model_interpretation=reasoning.get("model_interpretation", ""),
        image_model_name=reasoning.get("image_model_name", "AuraMed Image Model"),
        image_model_score=scan.image_model_score,
        grad_cam_base64=reasoning.get("grad_cam_base64") or ai_suggestions.get("grad_cam_base64"),
        gradcam_heatmap_b64=reasoning.get("gradcam_heatmap_b64") or ai_suggestions.get("gradcam_heatmap_b64"),
        clinical_reasoning=reasoning.get("clinical_reasoning") or ai_suggestions.get("clinical_reasoning"),
        clinical_model_name=reasoning.get("clinical_model_name", "Clinical Formula"),
        clinical_contributions=[ClinicalContribution(**c) for c in reasoning.get("clinical_contributions", [])],
        formula_score=scan.formula_score,
        formula_result=reasoning.get("formula_result") or ai_suggestions.get("formula_result"),
        fusion_weights=FusionWeights(**reasoning.get("fusion_weights", {"image": 0.6, "clinical": 0.4})),
        fusion_score=scan.fusion_score,
        risk_level=scan.risk_level.value if scan.risk_level else None,
        confidence_score=scan.confidence_score,
        confidence_reasons=reasoning.get("confidence_reasons", []),
        limitations=reasoning.get("limitations", []),
        follow_up_interval=reasoning.get("follow_up_interval", "as clinically indicated"),
        ai_suggestions=ai_suggestions,
        doctor_modifications=doctor_modifications,
        doctor_review_fields=_doctor_review_fields(scan.module.value, ai_suggestions, doctor_modifications),
        doctor_review_notes=doctor_modifications.get("__notes"),
        clinical_inputs=scan.clinical_inputs or {},
        is_urgent=patient.is_urgent,
        criterion_oligo_anovulation=c_oligo,
        criterion_hyperandrogenism=c_hyper,
        criterion_polycystic_ovaries=c_poly,
        rotterdam_criteria_met=met_count,
        rotterdam_positive=is_positive,
    )


@router.patch("/{scan_id}/doctor-review", response_model=ScanResultsResponse)
def update_doctor_review(
    scan_id: str,
    payload: DoctorReviewUpdateRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    scan = _get_owned_scan(db, doctor, scan_id)
    modifications = dict(scan.doctor_modifications or {})
    now_iso = date.today().isoformat()
    history = list(modifications.get("__history") or [])
    audit_changes = []

    if payload.modifications:
        for item in payload.modifications:
            modifications[item.parameter] = item.doctor_value
            history_item = {
                "parameter": item.parameter,
                "ai_suggested": item.ai_value,
                "doctor_set": item.doctor_value,
                "modified_at": now_iso,
                "modified_by": doctor.full_name,
            }
            history.append(history_item)
            audit_changes.append({
                "parameter": item.parameter,
                "old_value": item.ai_value,
                "new_value": item.doctor_value,
            })
    elif payload.values:
        for key, value in payload.values.items():
            old_val = modifications.get(key)
            if old_val != value:
                audit_changes.append({
                    "parameter": key,
                    "old_value": old_val,
                    "new_value": value,
                })
                history.append({
                    "parameter": key,
                    "ai_suggested": old_val,
                    "doctor_set": value,
                    "modified_at": now_iso,
                    "modified_by": doctor.full_name,
                })
            modifications[key] = value

    if payload.notes is not None:
        modifications["__notes"] = payload.notes

    modifications["__history"] = history
    scan.doctor_modifications = modifications
    db.commit()

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="MODIFIED_CLINICAL_VALUE",
        resource_type="scan",
        resource_id=scan.id,
        details={"changes": audit_changes, "notes": payload.notes},
    )

    return get_scan_results(scan_id, db, doctor)


@router.get("/{scan_id}/audit-log", response_model=list[AuditLogEntry])
def get_scan_audit_log(
    scan_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    scan = _get_owned_scan(db, doctor, scan_id)
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.resource_type == "scan", AuditLog.resource_id == scan.id)
        .order_by(AuditLog.created_at.desc())
        .all()
    )
    return [AuditLogEntry(id=log.id, action=log.action, details=log.details, created_at=log.created_at) for log in logs]


@router.post("/{scan_id}/schedule-followup")
def schedule_followup(
    scan_id: str,
    payload: ScheduleFollowupRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    scan = _get_owned_scan(db, doctor, scan_id)
    appointment = Appointment(
        patient_id=scan.patient_id,
        doctor_id=doctor.id,
        scan_id=scan.id,
        appointment_type=f"{scan.module.value.title()} Follow-up",
        scheduled_date=payload.scheduled_date,
        status=AppointmentStatus.scheduled,
        notes=payload.notes,
        ai_recommended=True,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="followup_scheduled",
        resource_type="scan",
        resource_id=scan.id,
        details={"scheduled_date": str(payload.scheduled_date)},
    )

    return {"appointment_id": str(appointment.id), "scheduled_date": str(appointment.scheduled_date)}
