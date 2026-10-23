import uuid
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import require_patient, get_db
from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.doctor_profile import DoctorProfile
from app.models.report import Report
from app.models.scan import Scan
from app.models.appointment import Appointment
from app.models.data_deletion_request import DataDeletionRequest
from app.models.enums import RiskLevel, AppointmentStatus, ReportStatus
from app.services.audit import log_action

router = APIRouter(prefix="/api/patient", tags=["patient-portal"])

def get_current_patient(
    db: Session = Depends(get_db),
    user: User = Depends(require_patient)
) -> PatientProfile:
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return profile

class RescheduleAppointmentPayload(BaseModel):
    preferred_date: str
    preferred_time: str
    reason: Optional[str] = None

class CancelAppointmentPayload(BaseModel):
    reason: Optional[str] = "Personal scheduling conflict"

import re
from pydantic import BaseModel, field_validator


class UpdateProfilePayload(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    email_notifications: Optional[bool] = None
    sms_notifications: Optional[bool] = None
    emergency_contact: Optional[str] = None
    address: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            cleaned = re.sub(r"[\s\-()]+", "", v)
            if not re.match(r"^(\+)?[0-9]{7,16}$", cleaned):
                raise ValueError("Invalid phone number format. Must contain 7 to 16 digits.")
        return v


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str
    confirm_new_password: Optional[str] = None

class DataDeletionRequestPayload(BaseModel):
    reason: str
    request_type: str = "Full Account Deletion"

# Helper for plain language risk conversion
# High Risk -> "Needs Follow-up" (red)
# Moderate -> "Monitor" (amber)
# Low/Normal -> "Normal" (green)
def translate_risk_level(risk_str):
    return {'label': 'Clinician report', 'color': 'slate', 'code': 'reviewed',
            'summary_box': {'headline': 'Read your clinician’s assessment', 'message': 'Your report contains the recorded findings and next steps.'}}

# --- 1. DASHBOARD ---
@router.get('/dashboard')
def get_patient_dashboard(db: Session = Depends(get_db), patient: PatientProfile = Depends(get_current_patient)):
    from app.models.appointment_request import AppointmentRequest
    from app.api.routes.workflow import request_json
    from app.services.clinical_record import text_sections
    reports = db.query(Report).filter(Report.patient_id == patient.id, Report.shared_with_patient == True).order_by(Report.created_at.desc()).all()
    reports = [r for r in reports if r.signed_at and (r.content or {}).get('workflow_version') == 1]
    appts = get_patient_appointments(db, patient)
    return {'patient': {'full_name': patient.full_name, 'first_name': patient.full_name.split()[0], 'patient_code': patient.patient_code},
            'next_step': text_sections(reports[0])['plan'] if reports else None,
            'reports': [{'id': str(r.id), 'report_number': r.report_number, 'date': r.signed_at, 'module': r.scan.module.value} for r in reports],
            'appointments': appts['items'], 'next_appointment': appts['upcoming'],
            'requests': [request_json(r, db) for r in db.query(AppointmentRequest).filter(AppointmentRequest.patient_id == patient.id).order_by(AppointmentRequest.created_at.desc()).all()]}

# --- 2. REPORTS LIST ---
@router.get('/reports')
def get_patient_reports(db: Session = Depends(get_db), patient: PatientProfile = Depends(get_current_patient)):
    return {'items': get_patient_dashboard(db, patient)['reports']}


# --- 3. REPORT DETAIL (Plain language translation) ---
@router.get('/reports/{report_id}')
def get_patient_report_detail(report_id: str, db: Session = Depends(get_db), patient: PatientProfile = Depends(get_current_patient)):
    from app.services.clinical_record import text_sections
    try: query = Report.id == uuid.UUID(report_id)
    except ValueError: query = Report.report_number == report_id
    report = db.query(Report).filter(query, Report.patient_id == patient.id, Report.shared_with_patient == True).first()
    if not report or not report.signed_at or (report.content or {}).get('workflow_version') != 1:
        raise HTTPException(404, 'Released report not found. Ask your clinician if review is still pending.')
    return {'id': str(report.id), 'report_number': report.report_number, 'patient_name': patient.full_name,
            'doctor_name': report.doctor.full_name, 'signed_at': report.signed_at, 'module': report.scan.module.value,
            **text_sections(report), 'addendums': (report.content or {}).get('addendums', [])}


@router.get('/reports/{report_id}/pdf')
def download_patient_report_pdf(report_id: str, db: Session = Depends(get_db), patient: PatientProfile = Depends(get_current_patient)):
    from app.services.clinical_record import clinical_pdf
    from fastapi.responses import StreamingResponse
    import io
    detail = get_patient_report_detail(report_id, db, patient)
    report = db.get(Report, uuid.UUID(detail['id']))
    pdf = clinical_pdf(report, report.scan, patient, report.doctor)
    return StreamingResponse(io.BytesIO(pdf), media_type='application/pdf', headers={
        'Content-Disposition': f'attachment; filename="{report.report_number}.pdf"',
        'Cache-Control': 'private, no-store'})


# --- 4. APPOINTMENTS ---
@router.get("/appointments")
def get_patient_appointments(
    db: Session = Depends(get_db),
    patient: PatientProfile = Depends(get_current_patient)
):
    today = date.today()
    all_appts = (
        db.query(Appointment)
        .filter(Appointment.patient_id == patient.id)
        .order_by(Appointment.scheduled_date.asc(), Appointment.scheduled_time.asc())
        .all()
    )

    upcoming_list = []
    past_list = []

    for a in all_appts:
        doc = a.doctor
        doc_name = doc.full_name if doc else "Consulting Doctor"
        specialty = doc.specialty if doc else "Clinical Specialist"
        hosp = doc.hospital if (doc and doc.hospital) else "Location not recorded"
        reg = doc.registration_number if doc else "Not recorded"
        time_str = a.scheduled_time.strftime("%I:%M %p") if a.scheduled_time else "Time to be confirmed"
        date_formatted = a.scheduled_date.strftime("%B %d, %Y") if a.scheduled_date else ""
        date_iso = str(a.scheduled_date) if a.scheduled_date else ""

        is_completed = a.status == AppointmentStatus.completed
        is_cancelled = a.status == AppointmentStatus.cancelled
        is_scheduled = a.status in (AppointmentStatus.scheduled, AppointmentStatus.rescheduled)

        item = {
            "id": str(a.id),
            "appointment_id": str(a.id),
            "type": a.appointment_type or "Clinical Consultation",
            "appointment_type": a.appointment_type or "Clinical Consultation",
            "doctor": doc_name,
            "doctor_name": doc_name,
            "specialty": specialty,
            "registration_number": reg,
            "date": date_formatted,
            "date_iso": date_iso,
            "scheduled_date": date_iso,
            "time": time_str,
            "time_slot": f"{time_str} - 30 mins",
            "scheduled_time": time_str,
            "time_24": a.scheduled_time.strftime("%H:%M") if a.scheduled_time else None,
            "timezone": __import__("app.core.config", fromlist=["settings"]).settings.clinic_timezone,
            "location": a.location or "Location to be confirmed",
            "hospital": hosp,
            "status": a.status.value if hasattr(a.status, "value") else str(a.status),
            "status_badge": ("Attendance not recorded" if a.scheduled_date < today else "Confirmed") if is_scheduled else ("Attended" if is_completed else a.status.value.replace("_", " ").capitalize()),
            "status_color": "green" if is_completed else ("teal" if is_scheduled else "rose"),
            "notes": a.notes or "",
        }

        if is_scheduled and a.scheduled_date >= today:
            upcoming_list.append(item)
        else:
            past_list.append(item)

    upcoming_featured = upcoming_list[0] if upcoming_list else None

    stats = {
        "upcoming_count": len(upcoming_list),
        "completed_count": sum(1 for a in all_appts if a.status == AppointmentStatus.completed),
        "rescheduled_count": sum(1 for a in all_appts if a.status == AppointmentStatus.rescheduled),
        "cancelled_count": sum(1 for a in all_appts if a.status == AppointmentStatus.cancelled),
    }

    calendar_dates = [u["date_iso"] for u in upcoming_list if u.get("date_iso")]

    return {
        "stats": stats,
        "upcoming": upcoming_featured,
        "upcoming_list": upcoming_list,
        "calendar_dates": calendar_dates,
        "past": past_list,
        "items": upcoming_list + past_list,
    }

@router.patch('/appointments/{id}/reschedule')
def reschedule_appointment(id: str, payload: RescheduleAppointmentPayload, db: Session = Depends(get_db), patient: PatientProfile = Depends(get_current_patient)):
    from app.models.appointment_request import AppointmentRequest
    from app.api.routes.appointments import _parse_time
    from app.services.care_messaging import clinic_today
    try:
        aid = uuid.UUID(id); requested_date = date.fromisoformat(payload.preferred_date)
    except ValueError: raise HTTPException(422, 'Choose a valid appointment and date')
    appt = db.query(Appointment).filter(Appointment.id == aid, Appointment.patient_id == patient.id).first()
    if not appt: raise HTTPException(404, 'Appointment not found')
    if appt.status not in (AppointmentStatus.scheduled, AppointmentStatus.rescheduled): raise HTTPException(409, 'Only active appointments can be changed')
    if requested_date < clinic_today(): raise HTTPException(422, 'Choose today or a future date')
    requested_time = _parse_time(payload.preferred_time)
    if not requested_time: raise HTTPException(422, 'Choose a time')
    row = db.query(AppointmentRequest).filter(AppointmentRequest.appointment_id == appt.id, AppointmentRequest.status == 'pending').first()
    if row: raise HTTPException(409, 'A request is already awaiting your doctor’s response')
    row = AppointmentRequest(appointment_id=appt.id, patient_id=patient.id, doctor_id=appt.doctor_id,
        preferred_date=requested_date, preferred_time=requested_time, reason=payload.reason or '', status='pending')
    db.add(row); db.commit()
    log_action(db, user_id=patient.user_id, user_type='patient', action='APPOINTMENT_CHANGE_REQUESTED', resource_type='appointment', resource_id=appt.id)
    return {'id': str(row.id), 'status': 'pending', 'message': 'Request submitted. Your original appointment remains confirmed until your doctor accepts the new time.'}

@router.patch('/appointments/{id}/cancel')
def cancel_appointment(id: str, payload: CancelAppointmentPayload, db: Session = Depends(get_db), patient: PatientProfile = Depends(get_current_patient)):
    from app.models.appointment_request import AppointmentRequest
    from app.api.routes.appointments import patch_appointment, PatchAppointmentRequest
    try: aid = uuid.UUID(id)
    except ValueError: raise HTTPException(404, 'Appointment not found')
    appt = db.query(Appointment).filter(Appointment.id == aid, Appointment.patient_id == patient.id).first()
    if not appt: raise HTTPException(404, 'Appointment not found')
    result = patch_appointment(id, PatchAppointmentRequest(status='cancelled', cancellation_reason=payload.reason), db, appt.doctor)
    for row in db.query(AppointmentRequest).filter(AppointmentRequest.appointment_id == appt.id, AppointmentRequest.status == 'pending').all():
        row.status = 'withdrawn'; row.response = 'Appointment cancelled by patient'
    db.commit()
    log_action(db, user_id=patient.user_id, user_type='patient', action='APPOINTMENT_CANCELLED_BY_PATIENT', resource_type='appointment', resource_id=appt.id)
    return result

# --- 5. TIMELINE ---
@router.get("/timeline")
def get_patient_timeline(db: Session = Depends(get_db), patient: PatientProfile = Depends(get_current_patient)):
    data = get_patient_dashboard(db, patient)
    return {'items': [{'id': r['id'], 'date': r['date'], 'title': 'Report released',
                       'description': r['report_number']} for r in data['reports']]}


# --- 6. PROFILE ---
@router.get("/profile")
def get_patient_profile(db: Session = Depends(get_db), patient: PatientProfile = Depends(get_current_patient)):
    consent = patient.consent or {}
    pending = db.query(DataDeletionRequest).filter(DataDeletionRequest.patient_id == patient.id).first()
    return {'id': str(patient.id), 'full_name': patient.full_name, 'patient_code': patient.patient_code,
        'date_of_birth': str(patient.date_of_birth) if patient.date_of_birth else '',
        'gender': patient.gender or '', 'blood_group': patient.blood_group or '',
        'email': patient.user.email if patient.user else '', 'phone': patient.phone or '',
        'emergency_contact': patient.emergency_contact_phone or '', 'address': patient.address or '',
        'email_notifications': bool(consent.get('email_notifications')),
        'sms_notifications': bool(consent.get('sms_notifications')),
        'data_deletion_pending': bool(pending and str(getattr(pending.status, 'value', pending.status)).lower() == 'pending')}


@router.patch("/profile")
def update_patient_profile(
    payload: UpdateProfilePayload,
    db: Session = Depends(get_db),
    patient: PatientProfile = Depends(get_current_patient)
):
    consent = dict(patient.consent or {})
    for key in ('email_notifications', 'sms_notifications'):
        value = getattr(payload, key)
        if value is not None: consent[key] = value
    patient.consent = consent
    if payload.emergency_contact is not None: patient.emergency_contact_phone = payload.emergency_contact
    if payload.email is not None and db.query(User).filter(User.email == payload.email, User.id != patient.user_id).first():
        raise HTTPException(409, 'This email is already in use')
    if payload.phone is not None:
        patient.phone = payload.phone
    if payload.address is not None:
        patient.address = payload.address
    if payload.email is not None and patient.user:
        patient.user.email = payload.email
    db.commit()

    log_action(
        db,
        user_id=patient.user_id,
        user_type="patient",
        action="PATIENT_PROFILE_UPDATED",
        resource_type="patient_profile",
        resource_id=patient.id,
        details={"updated_fields": [k for k, v in payload.dict().items() if v is not None]},
    )

    return {
        "message": "Contact details and preferences updated successfully.",
        "phone": patient.phone,
        "email": patient.user.email if patient.user else None,
        "address": getattr(patient, "address", None),
    }

@router.post("/change-password")
def change_patient_password(
    payload: ChangePasswordPayload,
    request: Request,
    db: Session = Depends(get_db),
    patient: PatientProfile = Depends(get_current_patient),
):
    from app.core.security import verify_password, hash_password, validate_password_policy
    u: User = patient.user
    if not u or not verify_password(payload.current_password, u.password_hash):
        raise HTTPException(status_code=400, detail="Current password does not match.")

    if payload.confirm_new_password is not None:
        if payload.new_password != payload.confirm_new_password:
            raise HTTPException(status_code=400, detail="New password and confirm password do not match.")

    try:
        validate_password_policy(payload.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    u.password_hash = hash_password(payload.new_password)
    db.commit()

    log_action(
        db,
        user_id=patient.user_id,
        user_type="patient",
        action="PASSWORD_CHANGED",
        resource_type="user",
        resource_id=patient.user_id,
        request=request,
    )
    return {"message": "Password updated successfully."}


@router.post("/export-data")
def export_patient_data(
    request: Request,
    db: Session = Depends(get_db),
    patient: PatientProfile = Depends(get_current_patient),
):
    """
    Generates export of patient's own data:
      Personal information
      All their reports (patient-friendly version)
      All their appointments
    Returns as JSON file download
    Audit log: DATA_EXPORTED
    """
    u: User = patient.user

    # 1. Personal Information
    personal_info = {
        "full_name": patient.full_name,
        "patient_code": patient.patient_code,
        "date_of_birth": str(patient.date_of_birth) if patient.date_of_birth else None,
        "gender": patient.gender,
        "blood_group": patient.blood_group,
        "phone": patient.phone,
        "email": u.email if u else None,
        "address": getattr(patient, "address", None),
        "emergency_contact": getattr(patient, "emergency_contact_phone", None),
        "created_at": patient.created_at.isoformat() if hasattr(patient, "created_at") and patient.created_at else None,
    }

    # 2. Patient Reports (patient-friendly format)
    db_reports = (
        db.query(Report)
        .filter(Report.patient_id == patient.id, Report.shared_with_patient == True)
        .order_by(Report.created_at.desc())
        .all()
    )
    from app.services.clinical_record import text_sections
    reports_export = [{'report_id': r.report_number, 'module': r.scan.module.value,
        'signed_at': r.signed_at.isoformat(), 'doctor_name': r.doctor.full_name,
        **text_sections(r), 'addendums': (r.content or {}).get('addendums', [])}
        for r in db_reports if r.signed_at and (r.content or {}).get('workflow_version') == 1]

    # 3. Appointments
    appts = (
        db.query(Appointment)
        .filter(Appointment.patient_id == patient.id)
        .order_by(Appointment.scheduled_date.desc())
        .all()
    )
    appointments_export = [
        {
            "id": str(a.id),
            "appointment_type": a.appointment_type,
            "scheduled_date": str(a.scheduled_date),
            "scheduled_time": a.scheduled_time.strftime("%H:%M") if a.scheduled_time else None,
            "location": a.location,
            "status": a.status.value if hasattr(a.status, "value") else str(a.status),
            "notes": a.notes,
        }
        for a in appts
    ]

    import json
    from datetime import timezone
    bundle = {
        "personal_information": personal_info,
        "reports": reports_export,
        "appointments": appointments_export,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "export_scope": "Profile, released clinician reports and appointments",
    }

    json_str = json.dumps(bundle, indent=2)
    filename = f"auramed_patient_data_{patient.patient_code}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    log_action(
        db,
        user_id=patient.user_id,
        user_type="patient",
        action="DATA_EXPORTED",
        resource_type="patient_profile",
        resource_id=patient.id,
        details={"record_counts": {"reports": len(reports_export), "appointments": len(appointments_export)}},
        request=request,
    )

    return Response(
        content=json_str,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/data-deletion-request")
def request_patient_data_deletion(
    payload: DataDeletionRequestPayload,
    db: Session = Depends(get_db),
    patient: PatientProfile = Depends(get_current_patient)
):
    req = DataDeletionRequest(
        patient_id=patient.id,
        reason=payload.reason,
        request_type=payload.request_type,
        status="pending",
    )
    db.add(req)
    db.commit()

    log_action(
        db,
        user_id=patient.user_id,
        user_type="patient",
        action="DELETION_REQUEST_SUBMITTED",
        resource_type="data_deletion_request",
        resource_id=req.id,
        details={"request_type": payload.request_type, "reason": payload.reason},
    )

    return {
        "message": "Your data erasure request has been submitted for administrative and compliance review.",
        "request_id": f"REQ-{str(req.id)[:8].upper()}",
        "status": "pending",
    }


