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
def get_own_scans(db: Session = Depends(get_db), current_user: User = Depends(require_patient)):
    raise HTTPException(410, 'Research analysis is clinician-only. Use your released reports for findings and next steps.')


@router.get("/reports")
def get_own_reports(db: Session = Depends(get_db), current_user: User = Depends(require_patient)):
    from app.api.routes.patient_portal import get_patient_reports
    return get_patient_reports(db, _get_patient_profile(db, current_user))['items']


@router.get("/reports/{report_id}")
def get_own_report_detail(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_patient)):
    from app.api.routes.patient_portal import get_patient_report_detail
    return get_patient_report_detail(report_id, db, _get_patient_profile(db, current_user))
