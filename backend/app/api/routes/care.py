"""Doctor-scoped operational worklist, care metrics and communication outbox."""
import csv
import io
import uuid
from datetime import date, timedelta, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor_profile
from app.core.database import get_db
from app.models.appointment import Appointment
from app.models.doctor_profile import DoctorProfile
from app.models.notification import Notification
from app.models.patient_profile import PatientProfile
from app.models.referral import Referral
from app.models.scan import Scan
from app.services.audit import log_action
from app.services.triage import triage_scan
from app.services.care_messaging import (channel_readiness, clinic_today, queue_appointment_messages,
    process_outbox, refresh_receipt)
from app.services.care_workflow import STAGES, stage_of, transition_referral

router = APIRouter(prefix="/api/doctor/care", tags=["care-coordination"])


def uid(value):
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(404, "Record not found")


def owned_patient(db, doctor, patient_id):
    patient = db.query(PatientProfile).filter(PatientProfile.id == uid(patient_id),
        PatientProfile.created_by_doctor_id == doctor.id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    return patient


def message_json(item):
    return {"id": str(item.id), "channel": item.delivery_method, "status": item.delivery_status,
        "title": item.title, "message": item.message, "created_at": item.created_at,
        "sent_at": item.sent_at, "provider_id": item.provider_id, "error": item.last_error,
        "attempts": item.retry_count, "patient_id": str(item.recipient_user_id),
        "appointment_id": item.related_resource_id}


def scoped_messages(db, doctor):
    # Restrict by appointment ownership too: one doctor must not see another's messages.
    ids = [str(a.id) for a in db.query(Appointment.id).filter(Appointment.doctor_id == doctor.id).all()]
    return db.query(Notification).filter(Notification.related_resource_type == "appointment",
        Notification.related_resource_id.in_(ids), Notification.delivery_method != "in_app")


@router.get("")
def care_dashboard(db: Session = Depends(get_db), doctor: DoctorProfile = Depends(get_current_doctor_profile)):
    today = clinic_today()
    patients = db.query(PatientProfile).filter(PatientProfile.created_by_doctor_id == doctor.id).all()
    appts = db.query(Appointment).filter(Appointment.doctor_id == doctor.id).order_by(Appointment.scheduled_date).all()
    refs = db.query(Referral).filter(Referral.from_doctor_id == doctor.id).order_by(Referral.created_at.desc()).all()
    scans = db.query(Scan).filter(Scan.doctor_id == doctor.id, Scan.status != "archived").order_by(Scan.created_at.desc()).all()
    referrals = []
    for ref in refs:
        att = ref.attachments or {}
        due = att.get("care_due_date") or str(ref.created_at.date() + timedelta(days=7))
        stage = stage_of(ref)
        referrals.append({"id": str(ref.id), "patient_id": str(ref.patient_id),
            "patient_name": ref.patient.full_name, "specialty": ref.specialty,
            "specialist": ref.to_specialist, "priority": ref.priority.value,
            "stage": stage, "due_date": due,
            "overdue": due < str(today) and stage not in ("outcome_recorded", "cancelled"),
            "events": att.get("care_events", []), "outcome": att.get("care_outcome"),
            "created_at": ref.created_at, "scan_id": att.get("source_scan_id"), "appointment_id": att.get("care_appointment_id")})
    worklist = []
    for scan in scans:
        if scan.status.value == "draft":
            continue
        triage = triage_scan(scan)
        worklist.append({"id": str(scan.id), "patient_id": str(scan.patient_id), "patient_name": scan.patient.full_name,
            "module": scan.module.value, "risk": scan.risk_level.value if scan.risk_level else "unknown",
            **triage, "status": scan.status.value, "date": scan.scan_date,
            "synthetic": bool((scan.patient.consent or {}).get("synthetic_demo")),
            "has_image": bool(scan.image_path)})
    worklist = [s for s in worklist if s["status"] != "reported" and not ((db.get(Scan, uuid.UUID(s["id"])).doctor_modifications or {}).get("clinical_review") or {}).get("complete")]
    worklist.sort(key=lambda s: (*s["sort_key"], str(s["date"] or "")))
    for row in worklist:
        row.pop("sort_key", None)
    closed = sum(r["stage"] == "outcome_recorded" for r in referrals)
    eligible = sum(r["stage"] != "cancelled" for r in referrals)
    all_messages = scoped_messages(db, doctor).all()
    patient_by_user = {str(p.user_id): p for p in patients}
    message_rows = []
    for item in sorted(all_messages, key=lambda m: m.created_at, reverse=True)[:100]:
        row = message_json(item)
        patient = patient_by_user.get(str(item.recipient_user_id))
        row["patient_name"] = patient.full_name if patient else "Patient"
        row["patient_id"] = str(patient.id) if patient else None
        message_rows.append(row)
    completed = sum(a.status.value == "completed" for a in appts)
    return {
        "today": str(today), "facility": doctor.hospital or "Care coordination", "channels": channel_readiness(),
        "metrics": {"patients": len(patients), "review_queue": len(worklist),
            "overdue_appointments": sum(a.scheduled_date < today and a.status.value in ("scheduled", "rescheduled", "no_show") for a in appts),
            "open_referrals": sum(r["stage"] not in ("outcome_recorded", "cancelled") for r in referrals),
            "overdue_referrals": sum(r["overdue"] for r in referrals),
            "awaiting_specialist": sum(r["stage"] in ("referred", "contacted", "scheduled") for r in referrals),
            "closed_referrals": closed, "eligible_referrals": eligible,
            "referral_completion_pct": round(closed / eligible * 100, 1) if eligible else None,
            "completed_appointments": completed,
            "messages_accepted": sum(m.delivery_status == "accepted" for m in all_messages),
            "messages_delivered": sum(m.delivery_status == "delivered" for m in all_messages),
            "message_previews": sum(m.delivery_status == "preview" for m in all_messages)},
        "funnel": [{"stage": stage, "count": sum(r["stage"] == stage for r in referrals)} for stage in STAGES],
        "patients": [{"id": str(p.id), "name": p.full_name, "code": p.patient_code,
            "phone": p.phone or "", "email": p.user.email, "consent": p.consent or {}} for p in patients],
        "worklist": worklist, "referrals": referrals,
        "appointments": [{"id": str(a.id), "patient_id": str(a.patient_id), "patient_name": a.patient.full_name,
            "date": str(a.scheduled_date), "time": a.scheduled_time.strftime("%H:%M") if a.scheduled_time else "",
            "location": a.location, "status": a.status.value, "appointment_type": a.appointment_type,
            "overdue": a.scheduled_date < today and a.status.value in ("scheduled", "rescheduled", "no_show")} for a in appts],
        "messages": message_rows,
    }


class ContactPreferences(BaseModel):
    research_ai: bool = False
    phone: str = Field(default="", max_length=20, pattern=r"^(\+[1-9]\d{7,14})?$")
    email_notifications: bool = False
    sms_notifications: bool = False
    whatsapp_notifications: bool = False


@router.patch("/patients/{patient_id}/contact")
def update_contact(patient_id: str, payload: ContactPreferences, db: Session = Depends(get_db), doctor: DoctorProfile = Depends(get_current_doctor_profile)):
    patient = owned_patient(db, doctor, patient_id)
    patient.phone = payload.phone
    patient.consent = {**(patient.consent or {}), **payload.model_dump(exclude={"phone"})}
    db.commit()
    log_action(db, user_id=doctor.user_id, user_type="doctor", action="CONTACT_PREFERENCES_UPDATED",
        resource_type="patient", resource_id=patient.id, details=payload.model_dump(exclude={"phone"}))
    return {"saved": True}


class ReferralProgress(BaseModel):
    stage: Literal["referred", "contacted", "scheduled", "seen", "outcome_recorded", "cancelled"]
    note: str = Field(min_length=1, max_length=2000)
    due_date: date | None = None


@router.patch("/referrals/{referral_id}")
def progress_referral(referral_id: str, payload: ReferralProgress, db: Session = Depends(get_db), doctor: DoctorProfile = Depends(get_current_doctor_profile)):
    ref = db.query(Referral).filter(Referral.id == uid(referral_id), Referral.from_doctor_id == doctor.id).first()
    if not ref:
        raise HTTPException(404, "Referral not found")
    transition_referral(ref, payload.stage, payload.note, doctor.id, payload.due_date)
    db.commit()
    log_action(db, user_id=doctor.user_id, user_type="doctor", action="CARE_REFERRAL_PROGRESS",
        resource_type="referral", resource_id=ref.id, details={"stage": ref.status})
    return {"stage": ref.status}


@router.post("/appointments/{appointment_id}/remind")
def remind(appointment_id: str, db: Session = Depends(get_db), doctor: DoctorProfile = Depends(get_current_doctor_profile)):
    appt = db.query(Appointment).filter(Appointment.id == uid(appointment_id), Appointment.doctor_id == doctor.id).first()
    if not appt:
        raise HTTPException(404, "Appointment not found")
    if appt.status.value not in ("scheduled", "rescheduled"):
        raise HTTPException(422, "Only active appointments can receive reminders")
    if appt.scheduled_date < clinic_today():
        raise HTTPException(422, "Reschedule the overdue appointment before sending a reminder")
    rows = queue_appointment_messages(db, appt)
    process_outbox(db, [r.id for r in rows])
    db.expire_all()
    return {"messages": [message_json(db.get(Notification, r.id)) for r in rows]}


@router.post("/messages/{message_id}/refresh")
def refresh_message(message_id: str, db: Session = Depends(get_db), doctor: DoctorProfile = Depends(get_current_doctor_profile)):
    item = scoped_messages(db, doctor).filter(Notification.id == uid(message_id)).first()
    if not item:
        raise HTTPException(404, "Message not found")
    try:
        return message_json(refresh_receipt(db, item))
    except Exception:
        raise HTTPException(502, "Could not refresh the provider receipt. Try again later.")


@router.get("/export")
def export_metrics(db: Session = Depends(get_db), doctor: DoctorProfile = Depends(get_current_doctor_profile)):
    data = care_dashboard(db, doctor)
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["AuraMed operational snapshot", data["today"]])
    writer.writerow(["Scope", "Current doctor's records; all time; not clinical effectiveness evidence"])
    writer.writerow(["Metric", "Value"])
    for name, value in data["metrics"].items():
        writer.writerow([name, value if value is not None else "N/A"])
    writer.writerow(["Referral completion denominator", "All non-cancelled referrals; closed means outcome recorded"])
    return Response(out.getvalue(), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="auramed-care-metrics.csv"'})


class TriageDecision(BaseModel):
    queue: Literal["review", "priority", "routine"]
    note: str = Field(min_length=3, max_length=2000)


@router.patch("/scans/{scan_id}/triage")
def record_triage(scan_id: str, payload: TriageDecision, db: Session = Depends(get_db),
                  doctor: DoctorProfile = Depends(get_current_doctor_profile)):
    scan = db.query(Scan).filter(Scan.id == uid(scan_id), Scan.doctor_id == doctor.id).first()
    if not scan:
        raise HTTPException(404, "Scan not found")
    if scan.status.value in ("draft", "archived", "reported"):
        raise HTTPException(422, "Only active review cases can be reprioritised")
    if len(payload.note.strip()) < 3:
        raise HTTPException(422, "Provide a reason for this clinical priority decision")
    mods = dict(scan.doctor_modifications or {})
    event = {**payload.model_dump(), "note": payload.note.strip(), "actor": str(doctor.id),
             "at": datetime.now(timezone.utc).isoformat(), "version": triage_scan(scan)["version"]}
    mods["care_triage"] = event
    mods["care_triage_history"] = [*(mods.get("care_triage_history") or []), event]
    scan.doctor_modifications = mods
    db.commit()
    log_action(db, user_id=doctor.user_id, user_type="doctor", action="CARE_TRIAGE_REVIEW",
               resource_type="scan", resource_id=scan.id, details=event)
    return triage_scan(scan)
