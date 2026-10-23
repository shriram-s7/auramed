import uuid
from datetime import datetime, date
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor_profile
from app.core.database import get_db
from app.models.referral import Referral
from app.models.patient_profile import PatientProfile
from app.models.doctor_profile import DoctorProfile
from app.models.scan import Scan
from app.models.report import Report
from app.models.enums import ReferralPriority
from app.services.audit import log_action

router = APIRouter(prefix="/api/doctor/referrals", tags=["referrals"])

SPECIALISTS_CATALOG = []  # No verified specialist directory is connected.


class ReferralAttachments(BaseModel):
    include_scans: bool = True
    include_ai_summary: bool = True
    include_clinical_report: bool = True
    report_id: Optional[str] = None


class CreateReferralRequest(BaseModel):
    patient_id: str
    specialty: str
    reason: str
    priority: str = "urgent"  # routine, urgent, emergency
    specialist_id: Optional[str] = None
    specialist_name: Optional[str] = None
    hospital: Optional[str] = None
    to_specialist: Optional[str] = None
    attachments: Optional[dict[str, Any]] = None
    clinical_notes: Optional[str] = None
    notes: Optional[str] = None


class PatchReferralRequest(BaseModel):
    status: Optional[str] = None
    response_notes: Optional[str] = None
    specialist_response_notes: Optional[str] = None
    notes: Optional[str] = None


def _format_referral(r: Referral) -> dict[str, Any]:
    p: PatientProfile = r.patient
    att = dict(r.attachments or {})
    s_id = att.get("specialist_id")
    s_name = att.get("specialist_name") or r.to_specialist
    hosp = att.get("hospital")

    # Match from catalog if specialist_id
    if s_id and not hosp:
        for c in SPECIALISTS_CATALOG:
            if c["id"] == s_id:
                hosp = c["hospital"]
                s_name = c["name"]
                break

    return {
        "id": str(r.id),
        "referral_id": str(r.id),
        "patient_id": str(r.patient_id),
        "patient_name": p.full_name if p else "Patient",
        "patient_code": p.patient_code if p else "â€”",
        "from_doctor_id": str(r.from_doctor_id),
        "to_specialist": s_name or "Specialist",
        "specialist_name": s_name,
        "specialist_id": s_id,
        "specialty": r.specialty,
        "hospital": hosp,
        "reason": r.reason,
        "priority": r.priority.value if hasattr(r.priority, "value") else str(r.priority),
        "attachments": r.attachments or {},
        "status": r.status,
        "clinical_notes": r.notes,
        "notes": r.notes,
        "specialist_response_notes": att.get("specialist_response_notes"),
        "created_at": r.created_at.isoformat() if hasattr(r, "created_at") and r.created_at else None,
    }


@router.get("/specialists")
def list_specialists():
    return SPECIALISTS_CATALOG


@router.get("/patient-context/{patient_id}")
def get_patient_referral_context(
    patient_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    try:
        pid = uuid.UUID(patient_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient = db.query(PatientProfile).filter(PatientProfile.id == pid, PatientProfile.created_by_doctor_id == doctor.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    scan = db.query(Scan).filter(Scan.patient_id == pid).order_by(Scan.created_at.desc()).first()
    report = db.query(Report).filter(Report.patient_id == pid).order_by(Report.created_at.desc()).first()

    today = date.today()
    dob = patient.date_of_birth
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day)) if dob else None

    risk = scan.risk_level.value if (scan and scan.risk_level) else "low"
    mod = scan.module.value if (scan and hasattr(scan.module, "value")) else "breast"
    default_reason = f"Multimodal analysis classified case as {risk.upper()} risk for {mod}. Recommended for specialist evaluation and biopsy / clinical correlation."

    return {
        "patient_id": str(patient.id),
        "name": patient.full_name,
        "patient_code": patient.patient_code,
        "age": age,
        "gender": patient.gender or "Female",
        "phone": patient.phone or "+91-9876543210",
        "module": mod,
        "risk_level": risk,
        "last_scan_date": str(scan.scan_date) if scan and scan.scan_date else str(today),
        "scan_id": str(scan.id) if scan else None,
        "report_id": str(report.id) if report else None,
        "report_number": report.report_number if report else None,
        "suggested_reason": default_reason,
        "referring_doctor": doctor.full_name,
        "registration_number": doctor.registration_number,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_referral(
    payload: CreateReferralRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    try:
        pid = uuid.UUID(payload.patient_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid patient ID")

    patient = db.query(PatientProfile).filter(PatientProfile.id == pid, PatientProfile.created_by_doctor_id == doctor.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    # Priority enum
    prio_map = {
        "routine": ReferralPriority.routine,
        "urgent": ReferralPriority.urgent,
        "emergency": ReferralPriority.emergency,
    }
    prio_enum = prio_map.get(payload.priority.lower(), ReferralPriority.urgent)

    # Prepare specialist info
    spec_target = payload.specialist_name or payload.to_specialist or "Specialist Consultation"
    if payload.specialist_id and not payload.specialist_name:
        for c in SPECIALISTS_CATALOG:
            if c["id"] == payload.specialist_id:
                spec_target = c["name"]
                break

    att = dict(payload.attachments or {})
    source_id = att.get("source_scan_id")
    if source_id:
        try:
            source_uuid = uuid.UUID(source_id)
        except (ValueError, TypeError):
            raise HTTPException(422, "Invalid source scan")
        source = db.query(Scan).filter(Scan.id == source_uuid, Scan.doctor_id == doctor.id,
                                     Scan.patient_id == pid).first()
        if not source:
            raise HTTPException(404, "Source scan not found for this patient")

    if payload.specialist_id:
        att["specialist_id"] = payload.specialist_id
    if payload.specialist_name:
        att["specialist_name"] = payload.specialist_name
    if payload.hospital:
        att["hospital"] = payload.hospital

    notes_text = payload.clinical_notes or payload.notes

    referral = Referral(
        patient_id=pid,
        from_doctor_id=doctor.id,
        to_specialist=spec_target,
        specialty=payload.specialty,
        reason=payload.reason,
        priority=prio_enum,
        attachments=att,
        status="referred",
        notes=notes_text,
    )
    db.add(referral)
    db.commit()
    db.refresh(referral)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="REFERRAL_CREATED",
        resource_type="referral",
        resource_id=referral.id,
        details={
            "patient_id": str(pid),
            "patient_name": patient.full_name,
            "to_specialist": spec_target,
            "specialty": payload.specialty,
            "priority": payload.priority,
            "internal_notification": bool(payload.specialist_id),
        },
    )

    return _format_referral(referral)


@router.get("")
def list_doctor_referrals(
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    items = (
        db.query(Referral)
        .filter(Referral.from_doctor_id == doctor.id)
        .order_by(Referral.created_at.desc())
        .all()
    )
    return [_format_referral(r) for r in items]


@router.patch("/{referral_id}")
def update_referral(
    referral_id: str,
    payload: PatchReferralRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    try:
        rid = uuid.UUID(referral_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid referral ID")

    referral = db.query(Referral).filter(Referral.id == rid, Referral.from_doctor_id == doctor.id).first()
    if not referral:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referral not found")

    if payload.status:
        from app.services.care_workflow import transition_referral
        mapped = {"sent": "referred", "accepted": "contacted", "completed": "seen"}.get(payload.status, payload.status)
        transition_referral(referral, mapped, payload.notes or payload.response_notes or payload.specialist_response_notes,
                            doctor.id)

    resp_note = payload.response_notes or payload.specialist_response_notes
    if resp_note:
        att = dict(referral.attachments or {})
        att["specialist_response_notes"] = resp_note
        referral.attachments = att
        referral.notes = f"{referral.notes or ''}\n[Specialist Response]: {resp_note}".strip()

    if payload.notes and not resp_note:
        referral.notes = payload.notes

    db.commit()
    db.refresh(referral)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="REFERRAL_UPDATED",
        resource_type="referral",
        resource_id=referral.id,
        details={
            "status": referral.status,
            "has_response_notes": bool(resp_note),
        },
    )

    return _format_referral(referral)
