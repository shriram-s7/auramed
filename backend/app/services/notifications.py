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
        email_enabled = consent.get("email_notifications", True) if isinstance(consent, dict) else True
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


def notify_patient_appointment_reminder(
    patient_id: Any,
    appointment_id: Any,
    db: Optional[Session] = None,
) -> list[Notification]:
    """Creates in-app and email/SMS notification for appointment reminder."""
    session, should_close = _resolve_session(db)
    notifications = []
    try:
        user_id, _, phone = _resolve_patient_user_id_and_meta(patient_id, session)
        if not user_id:
            logger.warning(f"notify_patient_appointment_reminder: patient {patient_id} not found")
            return notifications

        # 1. In-App Notification
        in_app = create_notification(
            recipient_user_id=user_id,
            recipient_type="patient",
            notification_type="APPOINTMENT_REMINDER",
            title="Upcoming Appointment Reminder",
            message="You have an upcoming medical appointment scheduled.",
            delivery_method="in_app",
            delivery_status="sent",
            related_resource_type="appointment",
            related_resource_id=str(appointment_id),
            db=session,
        )
        if in_app:
            notifications.append(in_app)

        # 2. Email Notification
        email_notif = create_notification(
            recipient_user_id=user_id,
            recipient_type="patient",
            notification_type="APPOINTMENT_REMINDER",
            title="Appointment Reminder - AuraMed",
            message="This is a reminder for your upcoming medical consultation. Please check your schedule in AuraMed.",
            delivery_method="email",
            delivery_status="pending",
            related_resource_type="appointment",
            related_resource_id=str(appointment_id),
            db=session,
        )
        if email_notif:
            notifications.append(email_notif)

        # 3. SMS Notification
        sms_notif = create_notification(
            recipient_user_id=user_id,
            recipient_type="patient",
            notification_type="APPOINTMENT_REMINDER",
            title="AuraMed Appointment Reminder",
            message=f"Reminder: You have an upcoming appointment scheduled. Appointment ID: {appointment_id}",
            delivery_method="sms",
            delivery_status="pending",
            related_resource_type="appointment",
            related_resource_id=str(appointment_id),
            db=session,
        )
        if sms_notif:
            notifications.append(sms_notif)

    finally:
        if should_close:
            session.close()
    return notifications


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


def process_pending_notifications(db: Optional[Session] = None) -> list[Notification]:
    """
    Checks for pending email/SMS notification records and delivers them.
    Emails are sent via EmailService with clinical HTML templates or logged in dev mode.
    Handles retries up to 3 times before marking as permanently_failed.
    """
    session, should_close = _resolve_session(db)
    processed = []
    email_service = EmailService()

    try:
        pending_items = (
            session.query(Notification)
            .filter(
                Notification.delivery_status == "pending",
                Notification.delivery_method.in_(["email", "sms"]),
            )
            .all()
        )
        for item in pending_items:
            log_line = (
                f"[NOTIFICATION DELIVERY] [{item.delivery_method.upper()}] "
                f"ID: {item.id} | Recipient User ID: {item.recipient_user_id} ({item.recipient_type}) | "
                f"Type: {item.notification_type} | Title: '{item.title}' | "
                f"Message: '{item.message}' | Resource: {item.related_resource_type}:{item.related_resource_id}"
            )
            print(log_line)
            logger.info(log_line)

            if item.delivery_method == "email":
                user = session.query(User).filter(User.id == item.recipient_user_id).first()
                if not user or not user.email:
                    logger.warning("Recipient user or email missing for notification %s", item.id)
                    item.delivery_status = "permanently_failed"
                    continue

                # Resolve recipient profile for personalization
                patient_name = "Valued Patient"
                doctor_name = "Attending Physician"
                if item.recipient_type == "patient":
                    pat = session.query(PatientProfile).filter(PatientProfile.user_id == item.recipient_user_id).first()
                    if pat and pat.full_name:
                        patient_name = pat.full_name
                elif item.recipient_type == "doctor":
                    doc = session.query(DoctorProfile).filter(DoctorProfile.user_id == item.recipient_user_id).first()
                    if doc and doc.full_name:
                        doctor_name = doc.full_name

                # Select appropriate template
                ntype = (item.notification_type or "").upper()
                if ntype == "REPORT_SHARED":
                    rep_date = item.created_at.strftime("%Y-%m-%d") if item.created_at else datetime.utcnow().strftime("%Y-%m-%d")
                    html_content = report_shared_email(
                        patient_name=patient_name,
                        doctor_name=doctor_name,
                        module="Screening",
                        report_date=rep_date,
                        portal_url=settings.patient_portal_url,
                    )
                elif ntype == "APPOINTMENT_REMINDER":
                    appt_date = datetime.utcnow().strftime("%Y-%m-%d")
                    html_content = appointment_reminder_email(
                        patient_name=patient_name,
                        appointment_type="Diagnostic Follow-up",
                        doctor_name=doctor_name,
                        appointment_date=appt_date,
                        appointment_time="10:00 AM",
                        location="AuraMed Clinical Facility",
                    )
                elif ntype == "DOCTOR_VERIFICATION_APPROVED":
                    html_content = doctor_verified_email(
                        doctor_name=doctor_name,
                        login_url=f"{settings.cors_origins.split(',')[0]}/login",
                    )
                elif ntype == "DOCTOR_VERIFICATION_REJECTED":
                    reason_clean = item.message.split("Reason:")[-1].strip() if "Reason:" in item.message else item.message
                    html_content = doctor_rejected_email(
                        doctor_name=doctor_name,
                        reason=reason_clean,
                    )
                elif ntype == "DATA_DELETION_OUTCOME":
                    html_content = deletion_approved_email(patient_name=patient_name)
                else:
                    html_content = (
                        f"<html><body><h2>{item.title}</h2><p>{item.message}</p>"
                        f"<p><small>AuraMed Clinical Intelligence</small></p></body></html>"
                    )

                success = email_service.send_email(
                    to_email=user.email,
                    subject=item.title,
                    html_content=html_content,
                    text_content=item.message,
                )

                if success:
                    item.delivery_status = "sent"
                    item.sent_at = datetime.now(timezone.utc)
                    processed.append(item)
                else:
                    item.retry_count = (getattr(item, "retry_count", 0) or 0) + 1
                    if item.retry_count > 3:
                        item.delivery_status = "permanently_failed"
                        logger.error("Notification %s permanently failed after %d retries.", item.id, item.retry_count)
                    else:
                        item.delivery_status = "failed"
                        logger.warning("Notification %s delivery failed, retry count: %d", item.id, item.retry_count)

            elif item.delivery_method == "sms":
                # Simulated SMS delivery
                item.delivery_status = "sent"
                item.sent_at = datetime.now(timezone.utc)
                processed.append(item)

        if processed or pending_items:
            session.commit()
    except Exception as e:
        logger.error(f"Error executing process_pending_notifications: {e}", exc_info=True)
        try:
            session.rollback()
        except Exception:
            pass
    finally:
        if should_close:
            session.close()
    return processed


def check_and_schedule_appointment_reminders(
    reminder_days: int = 1,
    db: Optional[Session] = None,
) -> list[Notification]:
    """
    Finds scheduled appointments occurring in reminder_days (default tomorrow / 24h)
    where reminder_sent is False, creates notification records, and marks reminder_sent=True.
    """
    from datetime import date, timedelta
    from app.models.appointment import Appointment
    from app.models.enums import AppointmentStatus

    session, should_close = _resolve_session(db)
    notifications = []
    try:
        target_date = date.today() + timedelta(days=reminder_days)
        appointments = (
            session.query(Appointment)
            .filter(
                Appointment.scheduled_date == target_date,
                Appointment.status == AppointmentStatus.scheduled,
                (Appointment.reminder_sent == False) | (Appointment.reminder_sent.is_(None)),
            )
            .all()
        )

        for appt in appointments:
            patient = appt.patient
            if patient:
                notifs = notify_patient_appointment_reminder(
                    patient_id=patient.id,
                    appointment_id=appt.id,
                    db=session,
                )
                notifications.extend(notifs)
                appt.reminder_sent = True

        if appointments:
            session.commit()
            logger.info("Created reminders for %d appointments scheduled on %s", len(appointments), target_date)
    except Exception as e:
        logger.error("Error in check_and_schedule_appointment_reminders: %s", str(e), exc_info=True)
        try:
            session.rollback()
        except Exception:
            pass
    finally:
        if should_close:
            session.close()
    return notifications


def start_notification_scheduler():
    """Starts APScheduler background jobs for pending notifications and daily appointment reminders."""
    if not scheduler.running:
        # 1. Process pending notifications every 5 minutes
        scheduler.add_job(
            process_pending_notifications,
            trigger=IntervalTrigger(minutes=5),
            id="process_pending_notifications_job",
            replace_existing=True,
        )
        # 2. Daily appointment reminder scan at 8:00 AM
        scheduler.add_job(
            check_and_schedule_appointment_reminders,
            trigger=CronTrigger(hour=8, minute=0),
            id="daily_appointment_reminders_job",
            replace_existing=True,
        )
        try:
            scheduler.start()
            logger.info("APScheduler notification & reminder engine successfully started.")
        except Exception as e:
            logger.error("Failed to start APScheduler: %s", str(e), exc_info=True)


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
