"""
Notification Service for AuraMed.
Handles notification creation, multi-channel triggers (in-app, email, sms),
and background task delivery runner.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.doctor_profile import DoctorProfile
from app.models.notification import Notification
from app.models.patient_profile import PatientProfile
from app.models.user import User

logger = logging.getLogger("auramed.notifications")


def _resolve_session(db: Optional[Session] = None) -> tuple[Session, bool]:
    if db is not None:
        return db, False
    return SessionLocal(), True


def _resolve_patient_user_id_and_meta(
    patient_id: Any, session: Session
) -> tuple[Optional[uuid.UUID], dict, Optional[str]]:
    """Resolves (user_id, consent_dict, phone) for a given patient_id."""
    patient = None
    if isinstance(patient_id, uuid.UUID) or (
        isinstance(patient_id, str) and len(str(patient_id)) == 36 and "-" in str(patient_id)
    ):
        try:
            p_uuid = uuid.UUID(str(patient_id))
            patient = (
                session.query(PatientProfile)
                .filter((PatientProfile.id == p_uuid) | (PatientProfile.user_id == p_uuid))
                .first()
            )
        except Exception:
            patient = None

    if not patient:
        patient = (
            session.query(PatientProfile)
            .filter(PatientProfile.patient_code == str(patient_id))
            .first()
        )

    if patient:
        consent = patient.consent if isinstance(patient.consent, dict) else {}
        return patient.user_id, consent, patient.phone

    try:
        u_uuid = uuid.UUID(str(patient_id))
        user = session.query(User).filter(User.id == u_uuid).first()
        if user:
            return user.id, {}, None
    except Exception:
        pass

    return None, {}, None


def _resolve_doctor_user_id(doctor_id: Any, session: Session) -> Optional[uuid.UUID]:
    """Resolves user_id for a given doctor_id."""
    doctor = None
    if isinstance(doctor_id, uuid.UUID) or (
        isinstance(doctor_id, str) and len(str(doctor_id)) == 36 and "-" in str(doctor_id)
    ):
        try:
            d_uuid = uuid.UUID(str(doctor_id))
            doctor = (
                session.query(DoctorProfile)
                .filter((DoctorProfile.id == d_uuid) | (DoctorProfile.user_id == d_uuid))
                .first()
            )
        except Exception:
            doctor = None

    if not doctor:
        doctor = (
            session.query(DoctorProfile)
            .filter(DoctorProfile.registration_number == str(doctor_id))
            .first()
        )

    if doctor:
        return doctor.user_id

    try:
        u_uuid = uuid.UUID(str(doctor_id))
        user = session.query(User).filter(User.id == u_uuid).first()
        if user:
            return user.id
    except Exception:
        pass

    return None


def create_notification(
    recipient_user_id: Any,
    recipient_type: str,
    notification_type: str,
    title: str,
    message: str,
    delivery_method: str = "in_app",
    delivery_status: str = "sent",
    related_resource_type: Optional[str] = None,
    related_resource_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> Optional[Notification]:
    """Creates a Notification record in the database."""
    session, should_close = _resolve_session(db)
    try:
        user_uuid = None
        if isinstance(recipient_user_id, uuid.UUID):
            user_uuid = recipient_user_id
        elif recipient_user_id is not None:
            try:
                user_uuid = uuid.UUID(str(recipient_user_id))
            except Exception:
                user_uuid = None

        if user_uuid is None:
            logger.warning(f"Cannot create notification: invalid user_id {recipient_user_id}")
            return None

        notif = Notification(
            recipient_user_id=user_uuid,
            recipient_type=recipient_type,
            notification_type=notification_type,
            title=title,
            message=message,
            is_read=False,
            related_resource_type=related_resource_type,
            related_resource_id=str(related_resource_id) if related_resource_id is not None else None,
            delivery_method=delivery_method,
            delivery_status=delivery_status,
            sent_at=datetime.now(timezone.utc) if delivery_status == "sent" else None,
        )
        session.add(notif)
        session.commit()
        session.refresh(notif)
        return notif
    except Exception as e:
        logger.error(f"Failed to create notification: {e}", exc_info=True)
        try:
            session.rollback()
        except Exception:
            pass
        return None
    finally:
        if should_close:
            session.close()


def notify_patient_report_shared(
    patient_id: Any,
    report_id: Any,
    doctor_name: str,
    db: Optional[Session] = None,
) -> list[Notification]:
    """
    Creates in-app notification.
    Creates email notification record if patient has email notifications on.
    """
    session, should_close = _resolve_session(db)
    notifications = []
    try:
        user_id, consent, _ = _resolve_patient_user_id_and_meta(patient_id, session)
        if not user_id:
            logger.warning(f"notify_patient_report_shared: patient {patient_id} not found")
            return notifications

        # 1. In-App Notification
        in_app = create_notification(
            recipient_user_id=user_id,
            recipient_type="patient",
            notification_type="REPORT_SHARED",
            title="Medical Report Shared",
            message=f"Dr. {doctor_name} has shared your diagnostic report.",
            delivery_method="in_app",
            delivery_status="sent",
            related_resource_type="report",
            related_resource_id=str(report_id),
            db=session,
        )
        if in_app:
            notifications.append(in_app)

        # 2. Email Notification if enabled
        # Default is True unless explicitly turned off
        email_enabled = consent.get("email_notifications", False) if isinstance(consent, dict) else True
        if email_enabled is not False:
            email_notif = create_notification(
                recipient_user_id=user_id,
                recipient_type="patient",
                notification_type="REPORT_SHARED",
                title="Your AuraMed Diagnostic Report Is Ready",
                message=f"Dr. {doctor_name} has finalized and shared your diagnostic report on AuraMed. Please log in to review.",
                delivery_method="email",
                delivery_status="pending",
                related_resource_type="report",
                related_resource_id=str(report_id),
                db=session,
            )
            if email_notif:
                notifications.append(email_notif)

    finally:
        if should_close:
            session.close()
    return notifications


def notify_patient_appointment_reminder(patient_id, appointment_id, db=None):
    from app.models.appointment import Appointment
    from app.services.care_messaging import queue_appointment_messages
    session, should_close = _resolve_session(db)
    try:
        appt = session.get(Appointment, uuid.UUID(str(appointment_id)))
        return queue_appointment_messages(session, appt) if appt else []
    finally:
        if should_close:
            session.close()


def notify_doctor_verification_approved(
    doctor_id: Any,
    db: Optional[Session] = None,
) -> list[Notification]:
    """Creates email notification (and in-app) to doctor upon verification approval."""
    session, should_close = _resolve_session(db)
    notifications = []
    try:
        user_id = _resolve_doctor_user_id(doctor_id, session)
        if not user_id:
            logger.warning(f"notify_doctor_verification_approved: doctor {doctor_id} not found")
            return notifications

        email_notif = create_notification(
            recipient_user_id=user_id,
            recipient_type="doctor",
            notification_type="DOCTOR_VERIFICATION_APPROVED",
            title="Doctor Account Approved",
            message="Congratulations! Your medical registration and credentials have been verified. You now have full access to AuraMed clinical features.",
            delivery_method="email",
            delivery_status="pending",
            related_resource_type="doctor",
            related_resource_id=str(doctor_id),
            db=session,
        )
        if email_notif:
            notifications.append(email_notif)

        in_app = create_notification(
            recipient_user_id=user_id,
            recipient_type="doctor",
            notification_type="DOCTOR_VERIFICATION_APPROVED",
            title="Doctor Account Approved",
            message="Your account has been approved. You can now register patients and generate AI diagnostic scans.",
            delivery_method="in_app",
            delivery_status="sent",
            related_resource_type="doctor",
            related_resource_id=str(doctor_id),
            db=session,
        )
        if in_app:
            notifications.append(in_app)

    finally:
        if should_close:
            session.close()
    return notifications


def notify_doctor_verification_rejected(
    doctor_id: Any,
    reason: str,
    db: Optional[Session] = None,
) -> list[Notification]:
    """Creates email notification to doctor upon verification rejection."""
    session, should_close = _resolve_session(db)
    notifications = []
    try:
        user_id = _resolve_doctor_user_id(doctor_id, session)
        if not user_id:
            logger.warning(f"notify_doctor_verification_rejected: doctor {doctor_id} not found")
            return notifications

        email_notif = create_notification(
            recipient_user_id=user_id,
            recipient_type="doctor",
            notification_type="DOCTOR_VERIFICATION_REJECTED",
            title="Doctor Account Verification Status",
            message=f"Your doctor verification request could not be approved at this time. Reason: {reason}",
            delivery_method="email",
            delivery_status="pending",
            related_resource_type="doctor",
            related_resource_id=str(doctor_id),
            db=session,
        )
        if email_notif:
            notifications.append(email_notif)

        in_app = create_notification(
            recipient_user_id=user_id,
            recipient_type="doctor",
            notification_type="DOCTOR_VERIFICATION_REJECTED",
            title="Doctor Verification Rejected",
            message=f"Verification rejected. Reason: {reason}",
            delivery_method="in_app",
            delivery_status="sent",
            related_resource_type="doctor",
            related_resource_id=str(doctor_id),
            db=session,
        )
        if in_app:
            notifications.append(in_app)

    finally:
        if should_close:
            session.close()
    return notifications


def notify_patient_deletion_request_outcome(
    patient_id: Any,
    approved: bool,
    db: Optional[Session] = None,
) -> list[Notification]:
    """Creates email notification to patient regarding their data deletion request outcome."""
    session, should_close = _resolve_session(db)
    notifications = []
    try:
        user_id, _, _ = _resolve_patient_user_id_and_meta(patient_id, session)
        if not user_id:
            logger.warning(f"notify_patient_deletion_request_outcome: patient {patient_id} not found")
            return notifications

        status_text = "Approved" if approved else "Rejected"
        message_text = (
            "Your personal data deletion request has been approved and processed in accordance with healthcare privacy regulations."
            if approved
            else "Your personal data deletion request has been reviewed and rejected under current statutory data retention requirements."
        )

        email_notif = create_notification(
            recipient_user_id=user_id,
            recipient_type="patient",
            notification_type="DATA_DELETION_OUTCOME",
            title=f"Data Deletion Request {status_text}",
            message=message_text,
            delivery_method="email",
            delivery_status="pending",
            related_resource_type="deletion_request",
            related_resource_id=str(patient_id),
            db=session,
        )
        if email_notif:
            notifications.append(email_notif)

        in_app = create_notification(
            recipient_user_id=user_id,
            recipient_type="patient",
            notification_type="DATA_DELETION_OUTCOME",
            title=f"Data Deletion Request {status_text}",
            message=message_text,
            delivery_method="in_app",
            delivery_status="sent",
            related_resource_type="deletion_request",
            related_resource_id=str(patient_id),
            db=session,
        )
        if in_app:
            notifications.append(in_app)

    finally:
        if should_close:
            session.close()
    return notifications


from app.core.config import settings
from app.services.email_service import (
    EmailService,
    appointment_reminder_email,
    deletion_approved_email,
    doctor_rejected_email,
    doctor_verified_email,
    report_shared_email,
)
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

# Global AsyncIOScheduler instance
scheduler = AsyncIOScheduler()


def process_pending_notifications(db=None):
    from app.services.care_messaging import process_outbox
    session, should_close = _resolve_session(db)
    try:
        return process_outbox(session)
    finally:
        if should_close:
            session.close()


def check_and_schedule_appointment_reminders(reminder_days=1, db=None):
    from app.services.care_messaging import queue_due_reminders
    session, should_close = _resolve_session(db)
    try:
        return queue_due_reminders(session, reminder_days)
    finally:
        if should_close:
            session.close()


def start_notification_scheduler():
    """Starts APScheduler background jobs for pending notifications and daily appointment reminders."""
    if not settings.notification_scheduler_enabled:
        return
    if not scheduler.running:
        scheduler.add_job(reconcile_care_reminders, trigger=IntervalTrigger(minutes=5),
                          id='care_reminder_reconciliation', replace_existing=True,
                          next_run_time=datetime.now(timezone.utc))
        # 1. Process pending notifications every 5 minutes
        scheduler.add_job(
            process_pending_notifications,
            trigger=IntervalTrigger(seconds=30),
            id="process_pending_notifications_job",
            replace_existing=True,
        )
        # 2. Daily appointment reminder scan at 8:00 AM
        scheduler.add_job(
            check_and_schedule_appointment_reminders,
            trigger=CronTrigger(hour=8, minute=0, timezone=settings.clinic_timezone),
            id="daily_appointment_reminders_job",
            replace_existing=True,
        )
        try:
            scheduler.start()
            logger.info("APScheduler notification & reminder engine successfully started.")
        except Exception as e:
            logger.error("Failed to start APScheduler: %s", str(e), exc_info=True)


def reconcile_care_reminders():
    from app.services.care_messaging import queue_catchup_reminders
    with SessionLocal() as db:
        queue_catchup_reminders(db)


def stop_notification_scheduler():
    """Gracefully shuts down APScheduler."""
    if scheduler.running:
        try:
            scheduler.shutdown(wait=False)
            logger.info("APScheduler stopped.")
        except Exception as e:
            logger.error("Error shutting down APScheduler: %s", str(e))


async def run_periodic_notification_worker(interval_seconds: int = 300):
    """
    Fallback asyncio loop runner for environments without APScheduler.
    """
    logger.info(f"Starting periodic notification background worker (interval: {interval_seconds}s)")
    while True:
        try:
            process_pending_notifications()
        except Exception as e:
            logger.error(f"Periodic notification background worker encountered error: {e}", exc_info=True)
        await asyncio.sleep(interval_seconds)
