import uuid
import datetime as _dt
from datetime import datetime, timedelta, time
date = _dt.date
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor_profile
from app.core.database import get_db
from app.models.appointment import Appointment
from app.models.patient_profile import PatientProfile
from app.models.doctor_profile import DoctorProfile
from app.models.scan import Scan
from app.models.enums import AppointmentStatus
from app.services.audit import log_action

router = APIRouter(prefix="/api/doctor/appointments", tags=["appointments"])


from sqlalchemy import or_

class ScheduleAppointmentRequest(BaseModel):
    patient_id: str
    appointment_type: Optional[str] = None
    type: Optional[str] = None
    scheduled_date: Optional[_dt.date] = None
    date: Optional[_dt.date] = None
    scheduled_time: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = "AuraMed Clinic"
    notes: Optional[str] = None
    scan_id: Optional[str] = None
    ai_recommended: bool = False
    ai_recommended_days: Optional[int] = None


class PatchAppointmentRequest(BaseModel):
    scheduled_date: Optional[_dt.date] = None
    date: Optional[_dt.date] = None
    scheduled_time: Optional[str] = None
    time: Optional[str] = None
    appointment_type: Optional[str] = None
    type: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    cancellation_reason: Optional[str] = None


class CompleteAppointmentRequest(BaseModel):
    completion_notes: Optional[str] = None


def _parse_time(time_val: Any) -> Optional[time]:
    if not time_val:
        return None
    if isinstance(time_val, time):
        return time_val
    try:
        parts = str(time_val).strip().split(":")
        return time(int(parts[0]), int(parts[1]))
    except Exception:
        return time(10, 0)


def _format_appointment(a: Appointment, doctor: DoctorProfile) -> dict[str, Any]:
    patient: PatientProfile = a.patient
    scan: Scan | None = a.scan
    mod = scan.module.value if (scan and hasattr(scan.module, "value")) else "breast"
    r_level = scan.risk_level.value if (scan and scan.risk_level) else ("high" if (a.notes and "biopsy" in a.notes.lower()) else "low")
    
    time_str = a.scheduled_time.strftime("%H:%M") if a.scheduled_time else "10:00"
    date_str = str(a.scheduled_date)
    appt_type = a.appointment_type or "consultation"

    return {
        "id": str(a.id),
        "patient_id": str(a.patient_id),
        "doctor_id": str(a.doctor_id),
        "scan_id": str(a.scan_id) if a.scan_id else None,
        "patient_name": patient.full_name if patient else "Patient",
        "patient_code": patient.patient_code if patient else "—",
        "risk_level": r_level,
        "module": mod,
        "appointment_type": appt_type,
        "type": appt_type,
        "scheduled_date": date_str,
        "date": date_str,
        "scheduled_time": time_str,
        "time": time_str,
        "location": a.location or "Clinic Consultation Room A",
        "status": a.status.value if hasattr(a.status, "value") else str(a.status),
        "notes": a.notes or "",
        "ai_recommended": bool(a.ai_recommended),
        "doctor_name": doctor.full_name,
        "created_at": a.created_at.isoformat() if hasattr(a, "created_at") and a.created_at else None,
        "updated_at": a.updated_at.isoformat() if hasattr(a, "updated_at") and a.updated_at else None,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def schedule_appointment(
    payload: ScheduleAppointmentRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    try:
        pid = uuid.UUID(payload.patient_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid patient ID")

    # 1. Validate Patient
    patient = db.query(PatientProfile).filter(PatientProfile.id == pid).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    # Ensure patient belongs to this doctor or is newly unassigned
    if patient.created_by_doctor_id and patient.created_by_doctor_id != doctor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Patient is assigned to another doctor."
        )
    if not patient.created_by_doctor_id:
        patient.created_by_doctor_id = doctor.id
        db.commit()

    # 2. Date & Time parsing
    target_date = payload.date or payload.scheduled_date
    if not target_date:
        target_date = date.today()
    if target_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scheduled date must be today or in the future"
        )

    target_time = _parse_time(payload.time or payload.scheduled_time) or time(10, 0)
    target_type = payload.type or payload.appointment_type or "consultation"

    # 3. Validate No conflicting appointment for same patient same date
    conflict = db.query(Appointment).filter(
        Appointment.patient_id == pid,
        Appointment.scheduled_date == target_date,
        Appointment.status != AppointmentStatus.cancelled,
    ).first()
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An appointment is already scheduled for this patient on {target_date}"
        )

    # Parse scan_id if present
    parsed_scan_id = None
    if payload.scan_id:
        try:
            parsed_scan_id = uuid.UUID(payload.scan_id)
        except ValueError:
            parsed_scan_id = None

    appt = Appointment(
        patient_id=pid,
        doctor_id=doctor.id,
        scan_id=parsed_scan_id,
        appointment_type=target_type,
        scheduled_date=target_date,
        scheduled_time=target_time,
        location=payload.location or "Clinic Consultation Room A",
        status=AppointmentStatus.scheduled,
        notes=payload.notes,
        ai_recommended=payload.ai_recommended,
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)

    # Audit log
    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="APPOINTMENT_SCHEDULED",
        resource_type="appointment",
        resource_id=appt.id,
        details={
            "patient_id": str(pid),
            "patient_name": patient.full_name,
            "scheduled_date": str(target_date),
            "scheduled_time": str(target_time),
            "appointment_type": target_type,
            "ai_recommended": payload.ai_recommended,
            "notification_queued": True,
            "reminder_channel": "sms_and_portal",
        },
    )

    # Trigger notifications (in-app, email, sms)
    try:
        from app.services.notifications import notify_patient_appointment_reminder
        notify_patient_appointment_reminder(pid, appt.id, db=db)
    except Exception:
        pass

    return _format_appointment(appt, doctor)


@router.get("/calendar")
def get_appointment_calendar(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    target_year = year or date.today().year
    target_month = month or date.today().month

    appts = (
        db.query(Appointment)
        .filter(Appointment.doctor_id == doctor.id)
        .order_by(Appointment.scheduled_date.asc(), Appointment.scheduled_time.asc())
        .all()
    )

    calendar_data: dict[str, list[dict[str, Any]]] = {}
    for a in appts:
        if a.scheduled_date.year == target_year and a.scheduled_date.month == target_month:
            d_str = str(a.scheduled_date)
            if d_str not in calendar_data:
                calendar_data[d_str] = []
            calendar_data[d_str].append(_format_appointment(a, doctor))

    return calendar_data


@router.get("")
def list_appointments(
    module: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: Optional[int] = None,
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    effective_limit = limit if limit is not None else page_size

    query = db.query(Appointment).filter(Appointment.doctor_id == doctor.id)
    all_appts = query.order_by(Appointment.scheduled_date.asc(), Appointment.scheduled_time.asc()).all()

    today = date.today()
    next_7_days = today + timedelta(days=7)

    # Compute high-level summary metrics
    upcoming_count = 0
    high_priority_count = 0
    overdue_count = 0
    completed_this_month_count = 0

    for a in all_appts:
        is_high = False
        if a.scan and a.scan.risk_level and a.scan.risk_level.value in ("high", "critical"):
            is_high = True
        elif a.notes and ("biopsy" in a.notes.lower() or "urgent" in a.notes.lower()):
            is_high = True

        if is_high:
            high_priority_count += 1

        if a.status == AppointmentStatus.scheduled:
            if a.scheduled_date >= today:
                upcoming_count += 1
            if a.scheduled_date < today:
                overdue_count += 1
        elif a.status == AppointmentStatus.completed:
            if a.scheduled_date.year == today.year and a.scheduled_date.month == today.month:
                completed_this_month_count += 1

    summary = {
        "upcoming_count": upcoming_count,
        "high_priority_count": high_priority_count,
        "overdue_count": overdue_count,
        "completed_this_month_count": completed_this_month_count,
        # backward compatibility keys
        "upcoming_7_days": sum(1 for a in all_appts if a.status == AppointmentStatus.scheduled and today <= a.scheduled_date <= next_7_days),
        "high_priority": high_priority_count,
        "overdue": overdue_count,
        "completed_this_month": completed_this_month_count,
    }

    # Apply filters
    filtered = []
    for a in all_appts:
        mod = a.scan.module.value if (a.scan and hasattr(a.scan.module, "value")) else "breast"
        status_str = a.status.value if hasattr(a.status, "value") else str(a.status)

        if module and module.lower() != "all" and mod.lower() != module.lower():
            continue
        if status and status.lower() != "all" and status_str.lower() != status.lower():
            continue
        if start_date and str(a.scheduled_date) < start_date:
            continue
        if end_date and str(a.scheduled_date) > end_date:
            continue

        filtered.append(_format_appointment(a, doctor))

    total = len(filtered)
    start_idx = (page - 1) * effective_limit
    paged_items = filtered[start_idx : start_idx + effective_limit]

    return {
        "items": paged_items,
        "total": total,
        "page": page,
        "limit": effective_limit,
        "page_size": effective_limit,
        "summary": summary,
        "stats": summary,
    }


@router.get("/{appointment_id}")
def get_appointment_by_id(
    appointment_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    try:
        aid = uuid.UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid appointment ID")

    appt = db.query(Appointment).filter(Appointment.id == aid).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if appt.doctor_id != doctor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to access this appointment."
        )

    return _format_appointment(appt, doctor)


@router.patch("/{appointment_id}")
def patch_appointment(
    appointment_id: str,
    payload: PatchAppointmentRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    try:
        aid = uuid.UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid appointment ID")

    appt = db.query(Appointment).filter(Appointment.id == aid).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if appt.doctor_id != doctor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to modify this appointment."
        )

    old_date = appt.scheduled_date
    is_rescheduling = False
    is_cancelling = False

    # Check cancellation
    if payload.status and payload.status.lower() == "cancelled":
        is_cancelling = True
        appt.status = AppointmentStatus.cancelled
        reason = payload.cancellation_reason or "Cancelled by physician"
        appt.notes = f"{appt.notes or ''}\n[Cancellation Reason]: {reason}".strip()

    elif payload.status:
        try:
            appt.status = AppointmentStatus(payload.status.lower())
        except Exception:
            pass

    # Check date rescheduling
    target_date = payload.date or payload.scheduled_date
    if target_date and target_date != old_date:
        is_rescheduling = True
        appt.scheduled_date = target_date
        if appt.status != AppointmentStatus.cancelled:
            appt.status = AppointmentStatus.rescheduled

    target_time_raw = payload.time or payload.scheduled_time
    if target_time_raw:
        parsed_time = _parse_time(target_time_raw)
        if parsed_time:
            appt.scheduled_time = parsed_time

    target_type = payload.type or payload.appointment_type
    if target_type:
        appt.appointment_type = target_type

    if payload.location:
        appt.location = payload.location

    if payload.notes and not is_cancelling:
        appt.notes = payload.notes

    db.commit()
    db.refresh(appt)

    if is_cancelling:
        log_action(
            db,
            user_id=doctor.user_id,
            user_type="doctor",
            action="APPOINTMENT_CANCELLED",
            resource_type="appointment",
            resource_id=appt.id,
            details={
                "patient_id": str(appt.patient_id),
                "scheduled_date": str(appt.scheduled_date),
                "cancellation_reason": payload.cancellation_reason,
            },
        )
    elif is_rescheduling:
        log_action(
            db,
            user_id=doctor.user_id,
            user_type="doctor",
            action="APPOINTMENT_UPDATED",
            resource_type="appointment",
            resource_id=appt.id,
            details={
                "patient_id": str(appt.patient_id),
                "original_date": str(old_date),
                "new_date": str(appt.scheduled_date),
                "rescheduled": True,
            },
        )
    else:
        log_action(
            db,
            user_id=doctor.user_id,
            user_type="doctor",
            action="APPOINTMENT_UPDATED",
            resource_type="appointment",
            resource_id=appt.id,
            details={"status": appt.status.value if hasattr(appt.status, "value") else str(appt.status)},
        )

    return _format_appointment(appt, doctor)


@router.patch("/{appointment_id}/status")
def patch_appointment_status_alias(
    appointment_id: str,
    payload: PatchAppointmentRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    return patch_appointment(appointment_id, payload, db, doctor)


@router.post("/{appointment_id}/complete")
def complete_appointment(
    appointment_id: str,
    payload: Optional[CompleteAppointmentRequest] = None,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    try:
        aid = uuid.UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid appointment ID")

    appt = db.query(Appointment).filter(Appointment.id == aid).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if appt.doctor_id != doctor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to modify this appointment."
        )

    appt.status = AppointmentStatus.completed
    if payload and payload.completion_notes:
        appt.notes = f"{appt.notes or ''}\n[Completion Notes]: {payload.completion_notes}".strip()

    db.commit()
    db.refresh(appt)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="APPOINTMENT_COMPLETED",
        resource_type="appointment",
        resource_id=appt.id,
        details={
            "patient_id": str(appt.patient_id),
            "completion_notes": payload.completion_notes if payload else None,
        },
    )

    return _format_appointment(appt, doctor)


@router.put("/{appointment_id}")
def update_appointment(
    appointment_id: str,
    payload: PatchAppointmentRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    return patch_appointment(appointment_id, payload, db, doctor)


@router.delete("/{appointment_id}")
def cancel_appointment_endpoint(
    appointment_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    try:
        aid = uuid.UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid appointment ID")

    appt = db.query(Appointment).filter(Appointment.id == aid).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if appt.doctor_id != doctor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to cancel this appointment."
        )

    appt.status = AppointmentStatus.cancelled
    db.commit()
    db.refresh(appt)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="APPOINTMENT_CANCELLED",
        resource_type="appointment",
        resource_id=appt.id,
        details={"status": "cancelled"},
    )
    return {"message": "Appointment cancelled successfully", "appointment": _format_appointment(appt, doctor)}
