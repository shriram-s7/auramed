import uuid
from datetime import date, datetime
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_patient
from app.models.appointment import Appointment
from app.models.enums import ReportStatus
from app.models.patient_profile import PatientProfile
from app.models.report import Report
from app.models.scan import Scan
from app.models.user import User
from app.services.audit import log_action

router = APIRouter(prefix="/api/patients/me", tags=["patients-me"])


class UpdatePatientProfileRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    pin_code: Optional[str] = None
    blood_group: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None


def _get_patient_profile(db: Session, user: User) -> PatientProfile:
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    return profile


def _format_profile(profile: PatientProfile, email: str) -> dict[str, Any]:
    return {
        "id": str(profile.id),
        "user_id": str(profile.user_id),
        "patient_code": profile.patient_code,
        "full_name": profile.full_name,
        "email": email,
        "date_of_birth": str(profile.date_of_birth) if profile.date_of_birth else None,
        "gender": profile.gender,
        "phone": profile.phone,
        "address": profile.address,
        "pin_code": profile.pin_code,
        "blood_group": profile.blood_group,
        "status": profile.status,
        "is_urgent": profile.is_urgent,
        "preferred_modules": profile.preferred_modules or [],
        "emergency_contact_name": profile.emergency_contact_name,
        "emergency_contact_phone": profile.emergency_contact_phone,
        "emergency_contact_relation": profile.emergency_contact_relation,
        "created_at": str(profile.created_at) if profile.created_at else None,
        "updated_at": str(profile.updated_at) if profile.updated_at else None,
    }


@router.get("")
def get_own_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patient),
):
    profile = _get_patient_profile(db, current_user)
    return _format_profile(profile, current_user.email)


@router.put("")
def update_own_profile(
    payload: UpdatePatientProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patient),
):
    profile = _get_patient_profile(db, current_user)
    if payload.full_name is not None:
        profile.full_name = payload.full_name.strip()
    if payload.phone is not None:
        profile.phone = payload.phone.strip()
    if payload.date_of_birth is not None:
        profile.date_of_birth = payload.date_of_birth
    if payload.gender is not None:
        profile.gender = payload.gender
    if payload.address is not None:
        profile.address = payload.address
    if payload.pin_code is not None:
        profile.pin_code = payload.pin_code
    if payload.blood_group is not None:
        profile.blood_group = payload.blood_group
    if payload.emergency_contact_name is not None:
        profile.emergency_contact_name = payload.emergency_contact_name
    if payload.emergency_contact_phone is not None:
        profile.emergency_contact_phone = payload.emergency_contact_phone
    if payload.emergency_contact_relation is not None:
        profile.emergency_contact_relation = payload.emergency_contact_relation

    db.commit()
    db.refresh(profile)

    log_action(
        db,
        user_id=current_user.id,
        user_type="patient",
        action="profile_updated",
        resource_type="patient_profile",
        resource_id=profile.id,
    )
    return _format_profile(profile, current_user.email)


@router.get("/appointments")
def get_own_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patient),
):
    profile = _get_patient_profile(db, current_user)
    appts = (
        db.query(Appointment)
        .filter(Appointment.patient_id == profile.id)
        .order_by(Appointment.scheduled_date.desc())
        .all()
    )
    result = []
    for a in appts:
        doc = a.doctor
        result.append(
            {
                "id": str(a.id),
                "scheduled_date": str(a.scheduled_date),
                "scheduled_time": str(a.scheduled_time) if a.scheduled_time else None,
                "type": a.appointment_type,
                "appointment_type": a.appointment_type,
                "status": a.status.value if hasattr(a.status, "value") else str(a.status),
                "notes": a.notes,
                "location": a.location or "AuraMed Clinical Facility",
                "doctor": {
                    "id": str(doc.id) if doc else None,
                    "full_name": doc.full_name if doc else "Specialist",
                    "specialty": doc.specialty if doc else "Clinical",
                },
            }
        )
    return result


@router.get("/scans")
def get_own_scans(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patient),
):
    profile = _get_patient_profile(db, current_user)
    scans = (
        db.query(Scan)
        .filter(Scan.patient_id == profile.id)
        .order_by(Scan.created_at.desc())
        .all()
    )
    result = []
    for s in scans:
        result.append(
            {
                "id": str(s.id),
                "module": s.module.value if hasattr(s.module, "value") else str(s.module),
                "scan_date": str(s.scan_date) if s.scan_date else str(s.created_at.date() if s.created_at else ""),
                "status": s.status.value if hasattr(s.status, "value") else str(s.status),
                "risk_level": s.risk_level.value if (s.risk_level and hasattr(s.risk_level, "value")) else (str(s.risk_level) if s.risk_level else "low"),
                "confidence_score": s.confidence_score,
                "image_url": f"/{s.image_path}" if s.image_path else None,
                "findings": s.reasoning,
                "ai_suggestions": s.ai_suggestions,
                "created_at": str(s.created_at) if s.created_at else None,
            }
        )
    return result


@router.get("/reports")
def get_own_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patient),
):
    profile = _get_patient_profile(db, current_user)
    # Return signed / approved reports or shared reports
    reports = (
        db.query(Report)
        .filter(
            Report.patient_id == profile.id,
            (Report.status.in_([ReportStatus.signed, ReportStatus.addendum])) | (Report.shared_with_patient == True),
        )
        .order_by(Report.created_at.desc())
        .all()
    )
    result = []
    for r in reports:
        doc = r.doctor
        result.append(
            {
                "id": str(r.id),
                "report_number": r.report_number,
                "status": r.status.value if hasattr(r.status, "value") else str(r.status),
                "signed_at": str(r.signed_at) if r.signed_at else None,
                "doctor_name": doc.full_name if doc else "Consulting Doctor",
                "doctor_specialty": doc.specialty if doc else None,
                "created_at": str(r.created_at) if r.created_at else None,
                "content": r.content,
            }
        )
    return result


@router.get("/reports/{report_id}")
def get_own_report_detail(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patient),
):
    try:
        rid = uuid.UUID(report_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    profile = _get_patient_profile(db, current_user)
    report = db.query(Report).filter(Report.id == rid).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    if report.patient_id != profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to view this report."
        )

    if not (report.shared_with_patient or report.status in [ReportStatus.shared_with_patient, ReportStatus.signed, ReportStatus.approved]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This report has not yet been approved or shared with you by your physician."
        )

    doc = report.doctor
    content = dict(report.content or {})
    # Strip raw AI scores to keep report patient-safe
    patient_safe_content = {
        "patient_info": content.get("patient_info"),
        "clinical_summary": content.get("clinical_summary", "Diagnostic screening verified by consulting physician."),
        "imaging_findings": content.get("imaging_findings", "Anatomical structures evaluated within clinical protocol."),
        "recommendations": content.get("recommendations", "Routine follow-up as scheduled."),
        "addendums": content.get("addendums", []),
    }

    return {
        "id": str(report.id),
        "report_number": report.report_number,
        "status": report.status.value if hasattr(report.status, "value") else str(report.status),
        "signed_at": str(report.signed_at) if report.signed_at else None,
        "doctor_name": doc.full_name if doc else "Consulting Doctor",
        "doctor_specialty": doc.specialty if doc else None,
        "content": patient_safe_content,
        "created_at": str(report.created_at) if report.created_at else None,
    }
