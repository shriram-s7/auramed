"""Appointment outbox: explicit previews, consent, idempotency and provider receipts.

SMTP acceptance is not proof of inbox delivery. Twilio status is refreshed separately.
Ambiguous network failures are never automatically resent.
"""
import base64
import hashlib
import html
import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from urllib import request, parse, error
from zoneinfo import ZoneInfo

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.models.appointment import Appointment
from app.models.notification import Notification
from app.models.patient_profile import PatientProfile
from app.services.email_service import EmailService

CHANNELS = ("email", "sms", "whatsapp")
ACTIVE = {"scheduled", "rescheduled"}


def clinic_today():
    return datetime.now(ZoneInfo(settings.clinic_timezone)).date()


def channel_readiness():
    twilio = bool(settings.twilio_account_sid and settings.twilio_auth_token)
    return {
        "mode": settings.messaging_mode,
        "timezone": settings.clinic_timezone,
        "email": EmailService().is_configured,
        "sms": bool(twilio and settings.twilio_sms_from),
        "whatsapp": bool(twilio and settings.twilio_whatsapp_from and settings.twilio_whatsapp_content_sid),
    }


def appointment_message(appt, event):
    date_label = appt.scheduled_date.strftime("%d %b %Y")
    time_label = appt.scheduled_time.strftime("%H:%M") if appt.scheduled_time else "time to be confirmed"
    place = appt.location or "location to be confirmed"
    action = {"scheduled": "confirmed", "rescheduled": "updated", "cancelled": "cancelled", "reminder": "coming up"}[event]
    # No diagnosis, scan result, risk score, or specialist field in lock-screen messages.
    return f"AuraMed: Your appointment is {action}: {date_label}, {time_label} ({settings.clinic_timezone}), {place}. Please contact your care team if you need assistance."


def queue_appointment_messages(db, appt, event="reminder"):
    if event != "cancelled" and appt.status.value not in ACTIVE:
        return []
    patient = appt.patient
    consent = patient.consent or {}
    body = appointment_message(appt, event)
    version = hashlib.sha256(f'{body}|{appt.updated_at}'.encode()).hexdigest()[:24]
    rows = []
    for channel in ("in_app", *CHANNELS):
        key = f"appointment:{appt.id}:{event}:{version}:{channel}"
        existing = db.query(Notification).filter(Notification.dedupe_key == key).first()
        if existing:
            rows.append(existing)
            continue
        opted_in = consent.get(f"{channel}_notifications") is True
        state = "sent" if channel == "in_app" else (
            "suppressed" if not opted_in else "preview" if settings.messaging_mode == "preview" else "pending"
        )
        row = Notification(
            recipient_user_id=patient.user_id, recipient_type="patient",
            notification_type=f"APPOINTMENT_{event.upper()}", title=f"Appointment {event}",
            message=body, delivery_method=channel, delivery_status=state,
            related_resource_type="appointment", related_resource_id=str(appt.id), dedupe_key=key,
            last_error="Patient has not opted in to this channel." if state == "suppressed" else None,
            sent_at=datetime.now(timezone.utc) if channel == "in_app" else None,
        )
        try:
            with db.begin_nested():
                db.add(row)
                db.flush()
            rows.append(row)
        except IntegrityError:
            rows.append(db.query(Notification).filter(Notification.dedupe_key == key).one())
    db.commit()
    return rows


def invalidate_appointment_messages(db, appointment_id):
    db.query(Notification).filter(
        Notification.related_resource_type == "appointment",
        Notification.related_resource_id == str(appointment_id),
        Notification.delivery_status.in_(["pending", "failed", "preview", "blocked"]),
    ).update({"delivery_status": "cancelled", "last_error": "Appointment changed; this message is superseded."}, synchronize_session=False)


def twilio_request(payload=None, provider_id=None):
    account = settings.twilio_account_sid or ""
    if not re.fullmatch(r"AC[0-9a-fA-F]{32}", account):
        raise ValueError("Configure a valid Twilio account SID")
    if provider_id and not re.fullmatch(r"SM[0-9a-fA-F]{32}", provider_id):
        raise ValueError("Invalid provider message ID")
    endpoint = f"https://api.twilio.com/2010-04-01/Accounts/{account}/Messages"
    url = f"{endpoint}/{provider_id}.json" if provider_id else f"{endpoint}.json"
    auth = base64.b64encode(f"{account}:{settings.twilio_auth_token}".encode()).decode()
    req = request.Request(url, data=parse.urlencode(payload).encode() if payload else None,
                          headers={"Authorization": f"Basic {auth}"})
    with request.urlopen(req, timeout=15) as response:
        return json.load(response)


def process_outbox(db, notification_ids=None):
    now = datetime.now(timezone.utc)
    # A dead worker's claim is uncertain, never safe to resend automatically.
    db.query(Notification).filter(Notification.delivery_status == 'processing',
        Notification.next_attempt_at <= now - timedelta(minutes=30)).update(
            {'delivery_status': 'unknown', 'last_error': 'Worker interrupted; inspect provider logs before any resend.'},
            synchronize_session=False)
    db.commit()
    query = db.query(Notification).filter(
        Notification.delivery_method.in_(CHANNELS),
        Notification.delivery_status.in_(["pending", "failed"]),
        or_(Notification.next_attempt_at.is_(None), Notification.next_attempt_at <= now),
    )
    if notification_ids is not None:
        query = query.filter(Notification.id.in_(notification_ids))
    processed = []
    for item in query.order_by(Notification.created_at).limit(50).all():
        # Claim before network I/O: concurrent workers cannot send the same row.
        claimed = db.query(Notification).filter(Notification.id == item.id,
            Notification.delivery_status.in_(["pending", "failed"])).update(
                {"delivery_status": "processing", "next_attempt_at": now}, synchronize_session=False)
        db.commit()
        if not claimed:
            continue
        db.refresh(item)
        patient = db.query(PatientProfile).filter(PatientProfile.user_id == item.recipient_user_id).first()
        channel = item.delivery_method
        item.last_error = None
        try:
            appointment = None
            if item.related_resource_type == 'appointment':
                appointment = db.get(Appointment, uuid.UUID(item.related_resource_id))
            stale = item.related_resource_type == 'appointment' and (
                not appointment or (item.notification_type != 'APPOINTMENT_CANCELLED' and appointment.status.value not in ACTIVE)
                or (item.notification_type == 'APPOINTMENT_REMINDER' and appointment.scheduled_date < clinic_today()))
            if stale:
                item.delivery_status = 'cancelled'
                item.last_error = 'Appointment is no longer active or the reminder date has passed.'
            elif patient and (patient.consent or {}).get(f"{channel}_notifications") is not True:
                item.delivery_status = "suppressed"
                item.last_error = "Patient has not opted in to this channel."
            elif settings.messaging_mode == "preview":
                item.delivery_status = "preview"
            elif settings.messaging_mode != "live" or not channel_readiness()[channel]:
                item.delivery_status = "blocked"
                item.last_error = f"Configure {channel} provider and MESSAGING_MODE=live."
            elif channel == "email":
                email = item.recipient.email if item.recipient else None
                if not email or email.endswith(("@example.com", "@example.invalid", "@auramed.demo")):
                    raise ValueError("A real recipient email address is required")
                content = f'<html><body style="font-family:Arial;color:#102c3c;padding:32px"><h2>AuraMed · Care coordination</h2><p>{html.escape(item.message)}</p><p>Contact your care team for appointment changes.</p></body></html>'
                if not EmailService().send_email(email, item.title, content, item.message):
                    item.delivery_status = "unknown"
                    item.last_error = "SMTP did not confirm acceptance. Check provider logs before resending."
                else:
                    item.delivery_status = "accepted"
                    item.sent_at = now
            else:
                phone = (patient.phone or "").strip() if patient else ""
                if not re.fullmatch(r"\+[1-9]\d{7,14}", phone):
                    raise ValueError("Patient phone must use international format, such as +91…")
                payload = {"To": phone, "From": settings.twilio_sms_from, "Body": item.message}
                if channel == "whatsapp":
                    payload = {"To": f"whatsapp:{phone}",
                        "From": "whatsapp:" + (settings.twilio_whatsapp_from or "").removeprefix("whatsapp:"),
                        "ContentSid": settings.twilio_whatsapp_content_sid,
                        "ContentVariables": json.dumps({"1": item.message})}
                result = twilio_request(payload)
                item.provider_id = result.get("sid")
                item.delivery_status = "accepted" if item.provider_id else "unknown"
                item.sent_at = now if item.provider_id else None
                if not item.provider_id:
                    item.last_error = "No provider receipt returned; check provider logs before resending."
        except error.HTTPError as exc:
            item.retry_count = (item.retry_count or 0) + 1
            # Only explicit rate-limit rejection is safe to automatically retry.
            item.delivery_status = "failed" if exc.code == 429 and item.retry_count < 3 else "permanently_failed" if exc.code < 500 else "unknown"
            item.next_attempt_at = now + timedelta(minutes=2 ** item.retry_count)
            item.last_error = f"Messaging provider returned HTTP {exc.code}. Check sender, template and recipient setup."
        except ValueError as exc:
            item.delivery_status = "blocked"
            item.last_error = str(exc)
        except Exception:
            item.delivery_status = "unknown"
            item.last_error = "Delivery could not be confirmed. Check provider logs before resending."
        db.commit()
        processed.append(item)
    return processed


def refresh_receipt(db, item):
    if not item.provider_id or item.delivery_method not in ("sms", "whatsapp"):
        return item
    result = twilio_request(provider_id=item.provider_id)
    status = result.get("status")
    if status in ("delivered", "read"):
        item.delivery_status = "delivered"
    elif status in ("failed", "undelivered", "canceled"):
        item.delivery_status = "permanently_failed"
        item.last_error = f"Provider reported {status} (code {result.get('error_code') or 'unknown'})."
    db.commit()
    return item


def queue_due_reminders(db, reminder_days=1):
    target = clinic_today() + timedelta(days=reminder_days)
    appointments = db.query(Appointment).filter(Appointment.scheduled_date == target,
        Appointment.status.in_(list(ACTIVE))).all()
    rows = []
    for appt in appointments:
        rows.extend(queue_appointment_messages(db, appt, "reminder"))
    return rows


def queue_catchup_reminders(db, now=None):
    """Reconcile persisted appointments after downtime without sending past reminders."""
    now = now or datetime.now(ZoneInfo(settings.clinic_timezone))
    today = now.date()
    rows = []
    dates = [today, today + timedelta(days=1)] if now.hour >= 8 else [today]
    for appt in db.query(Appointment).filter(Appointment.scheduled_date.in_(dates),
                                            Appointment.status.in_(list(ACTIVE))).all():
        if appt.scheduled_date == today and (not appt.scheduled_time or appt.scheduled_time <= now.time().replace(tzinfo=None)):
            continue
        rows.extend(queue_appointment_messages(db, appt, 'reminder'))
    return rows
