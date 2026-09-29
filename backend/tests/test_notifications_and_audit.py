import unittest
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

from fastapi import Request
from fastapi.testclient import TestClient

from app.core.audit import log_audit_event, log_audit_event_sync
from app.core.constants import (
    ADDENDUM_ADDED,
    ANALYSIS_GENERATED,
    APPOINTMENT_CANCELLED,
    APPOINTMENT_COMPLETED,
    APPOINTMENT_SCHEDULED,
    APPOINTMENT_UPDATED,
    ARCHIVED_SCAN,
    DATA_DELETION_APPROVED,
    DATA_DELETION_REJECTED,
    DELETION_REQUEST_SUBMITTED,
    DOCTOR_SUSPENDED,
    DOCTOR_VERIFIED,
    LOGIN_FAILED,
    LOGIN_SUCCESS,
    LOGOUT,
    MODIFIED_CLINICAL_VALUE,
    NEW_PATIENT_REGISTERED,
    PASSWORD_CHANGED,
    PATIENT_PROFILE_UPDATED,
    PDF_GENERATED,
    REFERRAL_CREATED,
    REFERRAL_UPDATED,
    REPORT_CREATED,
    REPORT_SHARED,
    REPORT_SIGNED,
    REPORT_UPDATED,
    UNAUTHORIZED_ACCESS_ATTEMPT,
)
from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.audit_log import AuditLog
from app.models.doctor_profile import DoctorProfile
from app.models.enums import UserRole
from app.models.notification import Notification
from app.models.patient_profile import PatientProfile
from app.models.user import User
from app.services.notifications import (
    create_notification,
    notify_doctor_verification_approved,
    notify_doctor_verification_rejected,
    notify_patient_appointment_reminder,
    notify_patient_deletion_request_outcome,
    notify_patient_report_shared,
    process_pending_notifications,
)


class TestNotificationsAndAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Create doctor test user
        cls.doc_user = cls.db.query(User).filter(User.email == "notif_doc@test.com").first()
        if not cls.doc_user:
            cls.doc_user = User(
                email="notif_doc@test.com",
                password_hash=hash_password("password"),
                role=UserRole.doctor,
                is_active=True,
                is_verified=True,
            )
            cls.db.add(cls.doc_user)
            cls.db.flush()

        cls.doc_profile = cls.db.query(DoctorProfile).filter(DoctorProfile.user_id == cls.doc_user.id).first()
        if not cls.doc_profile:
            cls.doc_profile = DoctorProfile(
                user_id=cls.doc_user.id,
                full_name="Dr. Notif Test",
                registration_number=f"DOC-{uuid.uuid4().hex[:6].upper()}",
                specialty="General Oncology",
                hospital="Test Hospital",
                is_approved=True,
            )
            cls.db.add(cls.doc_profile)

        # Create patient test user
        cls.pat_user = cls.db.query(User).filter(User.email == "notif_pat@test.com").first()
        if not cls.pat_user:
            cls.pat_user = User(
                email="notif_pat@test.com",
                password_hash=hash_password("password"),
                role=UserRole.patient,
                is_active=True,
                is_verified=True,
            )
            cls.db.add(cls.pat_user)
            cls.db.flush()

        cls.pat_profile = cls.db.query(PatientProfile).filter(PatientProfile.user_id == cls.pat_user.id).first()
        if not cls.pat_profile:
            cls.pat_profile = PatientProfile(
                user_id=cls.pat_user.id,
                patient_code=f"P-{uuid.uuid4().hex[:6].upper()}",
                full_name="Anita Notif Patient",
                phone="+91-9999900001",
                created_by_doctor_id=cls.doc_profile.id,
                consent={"email_notifications": True, "appointment_reminders": True},
            )
            cls.db.add(cls.pat_profile)

        cls.db.commit()

        cls.doc_token = create_access_token({"sub": str(cls.doc_user.id), "role": "doctor", "type": "access"})
        cls.pat_token = create_access_token({"sub": str(cls.pat_user.id), "role": "patient", "type": "access"})

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_constants_defined(self):
        """Verify all 27 audit action constants are properly defined."""
        expected_constants = [
            NEW_PATIENT_REGISTERED,
            PATIENT_PROFILE_UPDATED,
            ANALYSIS_GENERATED,
            MODIFIED_CLINICAL_VALUE,
            ARCHIVED_SCAN,
            REPORT_CREATED,
            REPORT_UPDATED,
            REPORT_SIGNED,
            ADDENDUM_ADDED,
            REPORT_SHARED,
            PDF_GENERATED,
            APPOINTMENT_SCHEDULED,
            APPOINTMENT_UPDATED,
            APPOINTMENT_CANCELLED,
            APPOINTMENT_COMPLETED,
            REFERRAL_CREATED,
            REFERRAL_UPDATED,
            DOCTOR_VERIFIED,
            DOCTOR_SUSPENDED,
            DATA_DELETION_APPROVED,
            DATA_DELETION_REJECTED,
            DELETION_REQUEST_SUBMITTED,
            LOGIN_SUCCESS,
            LOGIN_FAILED,
            LOGOUT,
            PASSWORD_CHANGED,
            UNAUTHORIZED_ACCESS_ATTEMPT,
        ]
        self.assertEqual(len(expected_constants), 27)
        for c in expected_constants:
            self.assertIsInstance(c, str)
            self.assertTrue(len(c) > 0)

    def test_log_audit_event_sync_extracts_headers_and_never_fails(self):
        """Test log_audit_event extracts IP and user agent, and does not crash on errors."""
        # Create a mock Request
        mock_request = MagicMock(spec=Request)
        mock_request.headers = {
            "x-forwarded-for": "203.0.113.195, 10.0.0.1",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AuraMed/1.0",
        }
        mock_request.client = None

        audit = log_audit_event_sync(
            db=self.db,
            user_id=self.doc_user.id,
            user_type="doctor",
            action=REPORT_CREATED,
            resource_type="report",
            resource_id="12345",
            details={"notes": "Draft report initialized"},
            request=mock_request,
        )

        self.assertIsNotNone(audit)
        self.assertEqual(audit.action, REPORT_CREATED)
        self.assertEqual(audit.ip_address, "203.0.113.195")
        self.assertEqual(audit.details.get("user_agent"), "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AuraMed/1.0")
        self.assertEqual(audit.details.get("raw_resource_id"), "12345")

        # Never raises exception on broken db or invalid data
        bad_result = log_audit_event_sync(
            db=None,  # Intentionally bad db
            user_id=None,
            user_type=None,
            action=UNAUTHORIZED_ACCESS_ATTEMPT,
            resource_type="route",
        )
        self.assertIsNone(bad_result)

    def test_notification_model_and_creation(self):
        """Test creating Notification records in db."""
        notif = create_notification(
            recipient_user_id=self.pat_user.id,
            recipient_type="patient",
            notification_type="TEST_ALERT",
            title="System Test Alert",
            message="This is a test notification message.",
            delivery_method="in_app",
            delivery_status="sent",
            related_resource_type="patient",
            related_resource_id=str(self.pat_profile.id),
            db=self.db,
        )
        self.assertIsNotNone(notif)
        self.assertEqual(notif.recipient_user_id, self.pat_user.id)
        self.assertEqual(notif.recipient_type, "patient")
        self.assertEqual(notif.title, "System Test Alert")
        self.assertFalse(notif.is_read)
        self.assertEqual(notif.delivery_status, "sent")
        self.assertIsNotNone(notif.created_at)

    def test_trigger_notify_patient_report_shared(self):
        """Test notify_patient_report_shared creates in-app and email records."""
        report_id = uuid.uuid4()
        notifs = notify_patient_report_shared(
            patient_id=self.pat_profile.id,
            report_id=report_id,
            doctor_name="Dr. Mehta",
            db=self.db,
        )
        self.assertTrue(len(notifs) >= 1)
        methods = [n.delivery_method for n in notifs]
        self.assertIn("in_app", methods)
        self.assertIn("email", methods)

        in_app = next(n for n in notifs if n.delivery_method == "in_app")
        self.assertEqual(in_app.delivery_status, "sent")
        self.assertEqual(in_app.notification_type, "REPORT_SHARED")

        email_rec = next(n for n in notifs if n.delivery_method == "email")
        self.assertEqual(email_rec.delivery_status, "pending")

    def test_trigger_notify_patient_appointment_reminder(self):
        """Test notify_patient_appointment_reminder creates in-app, email, and sms."""
        appt_id = uuid.uuid4()
        notifs = notify_patient_appointment_reminder(
            patient_id=self.pat_profile.id,
            appointment_id=appt_id,
            db=self.db,
        )
        self.assertTrue(len(notifs) >= 2)
        methods = [n.delivery_method for n in notifs]
        self.assertIn("in_app", methods)
        self.assertIn("email", methods)
        self.assertIn("sms", methods)

    def test_trigger_notify_doctor_verification_approved_and_rejected(self):
        """Test notify_doctor_verification_approved and rejected."""
        approved_notifs = notify_doctor_verification_approved(
            doctor_id=self.doc_profile.id,
            db=self.db,
        )
        self.assertTrue(len(approved_notifs) >= 1)
        methods = [n.delivery_method for n in approved_notifs]
        self.assertIn("email", methods)

        rejected_notifs = notify_doctor_verification_rejected(
            doctor_id=self.doc_profile.id,
            reason="Medical license expired",
            db=self.db,
        )
        self.assertTrue(len(rejected_notifs) >= 1)
        self.assertTrue(any("license expired" in n.message for n in rejected_notifs))

    def test_trigger_notify_patient_deletion_outcome(self):
        """Test notify_patient_deletion_request_outcome for both approval and rejection."""
        approved = notify_patient_deletion_request_outcome(
            patient_id=self.pat_profile.id,
            approved=True,
            db=self.db,
        )
        self.assertTrue(len(approved) >= 1)
        self.assertTrue(any("Approved" in n.title for n in approved))

        rejected = notify_patient_deletion_request_outcome(
            patient_id=self.pat_profile.id,
            approved=False,
            db=self.db,
        )
        self.assertTrue(len(rejected) >= 1)
        self.assertTrue(any("Rejected" in n.title for n in rejected))

    def test_notification_endpoints(self):
        """Test GET /api/notifications, unread-count, read, and read-all."""
        # 1. Seed unread notifications
        n1 = create_notification(
            recipient_user_id=self.pat_user.id,
            recipient_type="patient",
            notification_type="SYSTEM",
            title="Notice 1",
            message="Unread notice 1",
            db=self.db,
        )
        n2 = create_notification(
            recipient_user_id=self.pat_user.id,
            recipient_type="patient",
            notification_type="SYSTEM",
            title="Notice 2",
            message="Unread notice 2",
            db=self.db,
        )

        headers = {"Authorization": f"Bearer {self.pat_token}"}

        # 2. GET /api/notifications/unread-count
        res_count = self.client.get("/api/notifications/unread-count", headers=headers)
        self.assertEqual(res_count.status_code, 200)
        data_count = res_count.json()
        self.assertIn("count", data_count)
        self.assertGreaterEqual(data_count["count"], 2)

        # 3. GET /api/notifications
        res_list = self.client.get("/api/notifications?page=1&limit=10", headers=headers)
        self.assertEqual(res_list.status_code, 200)
        notifs = res_list.json()
        self.assertIsInstance(notifs, list)
        self.assertGreaterEqual(len(notifs), 2)
        self.assertIn("X-Total-Count", res_list.headers)

        # 4. PATCH /api/notifications/:id/read
        res_read = self.client.patch(f"/api/notifications/{n1.id}/read", headers=headers)
        self.assertEqual(res_read.status_code, 200)
        self.assertTrue(res_read.json()["success"])

        # 5. PATCH /api/notifications/read-all
        res_read_all = self.client.patch("/api/notifications/read-all", headers=headers)
        self.assertEqual(res_read_all.status_code, 200)
        self.assertTrue(res_read_all.json()["success"])

        # Unread count should now be 0
        res_count_after = self.client.get("/api/notifications/unread-count", headers=headers)
        self.assertEqual(res_count_after.status_code, 200)
        self.assertEqual(res_count_after.json()["count"], 0)

    def test_background_pending_notification_delivery(self):
        """Test process_pending_notifications delivers email/SMS and sets status to sent."""
        # Seed a pending notification
        pending_email = create_notification(
            recipient_user_id=self.pat_user.id,
            recipient_type="patient",
            notification_type="APPOINTMENT_REMINDER",
            title="Pending Email Reminder",
            message="Deliver me via background runner",
            delivery_method="email",
            delivery_status="pending",
            db=self.db,
        )
        self.assertIsNotNone(pending_email)
        self.assertEqual(pending_email.delivery_status, "pending")
        self.assertIsNone(pending_email.sent_at)

        processed = process_pending_notifications(db=self.db)
        self.assertTrue(any(p.id == pending_email.id for p in processed))

        self.db.refresh(pending_email)
        self.assertEqual(pending_email.delivery_status, "sent")
        self.assertIsNotNone(pending_email.sent_at)


if __name__ == "__main__":
    unittest.main()
