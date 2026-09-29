"""
Unit and Integration Tests for Email Notification Service, Templates,
Scheduler Worker, and Complete End-to-End System Wiring.
"""
from datetime import date, datetime, timedelta, timezone
import io
import json
import unittest
import uuid
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.core.database import Base, SessionLocal, engine
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.appointment import Appointment
from app.models.audit_log import AuditLog
from app.models.doctor_profile import DoctorProfile
from app.models.enums import AppointmentStatus, ReportStatus, ScanStatus, ScreeningModule, UserRole
from app.models.notification import Notification
from app.models.patient_profile import PatientProfile
from app.models.report import Report
from app.models.scan import Scan
from app.models.user import User
from app.services.email_service import (
    EmailService,
    appointment_reminder_email,
    deletion_approved_email,
    doctor_rejected_email,
    doctor_verified_email,
    report_shared_email,
)
from app.services.notifications import (
    check_and_schedule_appointment_reminders,
    create_notification,
    process_pending_notifications,
)


class TestEmailAndSystemWiring(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

        db = SessionLocal()
        cls.test_email = f"dr_wiring_{uuid.uuid4().hex[:6]}@auramed.com"
        doc_user = User(
            email=cls.test_email,
            password_hash=hash_password("DoctorSecure123!"),
            role=UserRole.doctor,
            is_active=True,
            is_verified=True,
        )
        db.add(doc_user)
        db.commit()
        db.refresh(doc_user)

        doctor = DoctorProfile(
            user_id=doc_user.id,
            full_name="Dr. Ananya Roy",
            registration_number=f"MCI-{uuid.uuid4().hex[:6].upper()}",
            specialty="Gynecologic Oncology",
            hospital="AuraMed Women's Health Institute",
            phone="+91-9876501234",
            is_approved=True,
        )
        db.add(doctor)
        db.commit()
        db.refresh(doctor)

        cls.doc_user_id = doc_user.id
        cls.doctor_id = doctor.id
        cls.token = create_access_token({"sub": str(doc_user.id), "role": "doctor"})
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

        # Create patient user and profile
        pat_user = User(
            email=f"priya_{uuid.uuid4().hex[:6]}@example.com",
            password_hash=hash_password("PatientSecure123!"),
            role=UserRole.patient,
            is_active=True,
            is_verified=True,
        )
        db.add(pat_user)
        db.commit()
        db.refresh(pat_user)

        patient = PatientProfile(
            user_id=pat_user.id,
            created_by_doctor_id=doctor.id,
            patient_code=f"P-{uuid.uuid4().hex[:8].upper()}",
            full_name="Priya Patel",
            date_of_birth=date(1990, 8, 20),
            gender="Female",
            phone="+91-9811223344",
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

        cls.pat_user_id = pat_user.id
        cls.patient_id = patient.id
        cls.patient_code = patient.patient_code
        cls.patient_token = create_access_token({"sub": str(pat_user.id), "role": "patient"})
        cls.patient_headers = {"Authorization": f"Bearer {cls.patient_token}"}
        db.close()

    def test_01_email_templates(self):
        """Validates all 5 clinical HTML email templates."""
        # 1. report_shared_email
        html_rep = report_shared_email("Priya Patel", "Dr. Roy", "breast", "2026-09-12", "http://localhost:5173/patient/reports")
        self.assertIn("Priya Patel", html_rep)
        self.assertIn("Dr. Roy", html_rep)
        self.assertIn("Breast", html_rep)
        self.assertIn("View Report", html_rep)
        self.assertIn("http://localhost:5173/patient/reports", html_rep)
        self.assertIn("clinical decision support", html_rep)

        # 2. appointment_reminder_email
        html_appt = appointment_reminder_email("Priya Patel", "Follow-up Mammography", "Dr. Roy", "2026-09-15", "11:30 AM", "Room 302, Oncology Wing")
        self.assertIn("Priya Patel", html_appt)
        self.assertIn("Follow-up Mammography", html_appt)
        self.assertIn("15 minutes early", html_appt)
        self.assertIn("Room 302, Oncology Wing", html_appt)

        # 3. doctor_verified_email
        html_doc_ok = doctor_verified_email("Dr. Roy", "http://localhost:5173/login")
        self.assertIn("Dr. Roy", html_doc_ok)
        self.assertIn("Account Verified", html_doc_ok)
        self.assertIn("http://localhost:5173/login", html_doc_ok)

        # 4. doctor_rejected_email
        html_doc_rej = doctor_rejected_email("Dr. Roy", "Expired medical council registration certificate.")
        self.assertIn("Dr. Roy", html_doc_rej)
        self.assertIn("Registration Update", html_doc_rej)
        self.assertIn("Expired medical council registration certificate.", html_doc_rej)

        # 5. deletion_approved_email
        html_del = deletion_approved_email("Priya Patel")
        self.assertIn("Priya Patel", html_del)
        self.assertIn("Data Deletion Request Approved", html_del)

    def test_02_email_service_dev_mode(self):
        """Verifies dev mode fallback logs formatted email block to stdout and returns True."""
        service = EmailService(smtp_host="")  # Unconfigured
        self.assertFalse(service.is_configured)

        with patch("sys.stdout") as mock_stdout:
            result = service.send_email(
                to_email="test@example.com",
                subject="Test Clinical Alert",
                html_content="<p>Test Body</p>",
                text_content="Test Body",
            )
            self.assertTrue(result)

    def test_03_email_service_smtp_configured_success(self):
        """Verifies configured SMTP connection attempts TLS and login."""
        service = EmailService(
            smtp_host="smtp.test.com",
            smtp_port=587,
            smtp_username="testuser",
            smtp_password="testpass",
            from_email="noreply@auramed.in",
            from_name="AuraMed",
        )
        self.assertTrue(service.is_configured)

        with patch("smtplib.SMTP") as mock_smtp:
            instance = MagicMock()
            mock_smtp.return_value = instance

            success = service.send_email(
                to_email="patient@example.com",
                subject="Clinical Notification",
                html_content="<p>Hello Patient</p>",
            )
            self.assertTrue(success)
            instance.starttls.assert_called_once()
            instance.login.assert_called_once_with("testuser", "testpass")
            instance.sendmail.assert_called_once()
            instance.quit.assert_called_once()

    def test_04_email_service_smtp_failure_handling(self):
        """Verifies SMTP network error handling returns False gracefully."""
        service = EmailService(
            smtp_host="smtp.failing.com",
            smtp_port=587,
            smtp_username="testuser",
            smtp_password="testpass",
        )
        with patch("smtplib.SMTP", side_effect=Exception("Connection refused")):
            success = service.send_email(
                to_email="patient@example.com",
                subject="Clinical Notification",
                html_content="<p>Hello</p>",
            )
            self.assertFalse(success)

    def test_05_process_pending_notifications_workflow(self):
        """Verifies process_pending_notifications sends emails and updates status."""
        db = SessionLocal()
        notif = create_notification(
            recipient_user_id=self.pat_user_id,
            recipient_type="patient",
            notification_type="REPORT_SHARED",
            title="Your Breast Screening Report is Ready",
            message="Dr. Ananya Roy has shared your diagnostic report.",
            delivery_method="email",
            delivery_status="pending",
            related_resource_type="report",
            related_resource_id="rpt-1234",
            db=db,
        )
        self.assertIsNotNone(notif)
        notif_id = notif.id
        db.close()

        # Run delivery worker
        processed = process_pending_notifications()
        self.assertGreaterEqual(len(processed), 1)

        # Verify status in database
        db = SessionLocal()
        item = db.query(Notification).filter(Notification.id == notif_id).first()
        self.assertEqual(item.delivery_status, "sent")
        self.assertIsNotNone(item.sent_at)
        db.close()

    def test_06_process_pending_notifications_retry_and_permanent_failure(self):
        """Verifies retry increment on send failure and transition to permanently_failed after 3 retries."""
        db = SessionLocal()
        failing_notif = create_notification(
            recipient_user_id=self.pat_user_id,
            recipient_type="patient",
            notification_type="APPOINTMENT_REMINDER",
            title="Appointment Reminder",
            message="Reminder for appointment",
            delivery_method="email",
            delivery_status="pending",
            related_resource_type="appointment",
            related_resource_id="appt-1234",
            db=db,
        )
        self.assertIsNotNone(failing_notif)
        failing_notif.retry_count = 3  # Next failure will push over threshold
        db.commit()
        failing_notif_id = failing_notif.id
        db.close()

        with patch.object(EmailService, "send_email", return_value=False):
            process_pending_notifications()

        db = SessionLocal()
        item = db.query(Notification).filter(Notification.id == failing_notif_id).first()
        self.assertEqual(item.delivery_status, "permanently_failed")
        self.assertEqual(item.retry_count, 4)
        db.close()

    def test_07_check_and_schedule_appointment_reminders(self):
        """Verifies finding upcoming appointments, generating notifications, and updating reminder_sent."""
        db = SessionLocal()
        tomorrow = date.today() + timedelta(days=1)
        appt = Appointment(
            patient_id=self.patient_id,
            doctor_id=self.doctor_id,
            appointment_type="Routine Breast Screening Follow-up",
            scheduled_date=tomorrow,
            status=AppointmentStatus.scheduled,
            reminder_sent=False,
        )
        db.add(appt)
        db.commit()
        db.refresh(appt)
        appt_id = appt.id
        db.close()

        # Execute daily reminder check for tomorrow (1 day ahead)
        reminders = check_and_schedule_appointment_reminders(reminder_days=1)
        self.assertTrue(len(reminders) >= 1)

        # Verify appointment updated
        db = SessionLocal()
        updated_appt = db.query(Appointment).filter(Appointment.id == appt_id).first()
        self.assertTrue(updated_appt.reminder_sent)

        # Verify notification created
        notifs = db.query(Notification).filter(
            Notification.recipient_user_id == self.pat_user_id,
            Notification.notification_type == "APPOINTMENT_REMINDER",
            Notification.related_resource_id == str(appt_id),
        ).all()
        self.assertGreaterEqual(len(notifs), 1)
        db.close()

    def test_08_complete_scan_to_report_and_patient_portal_wiring(self):
        """
        Tests complete clinical workflow:
        1. Upload scan
        2. Analyze scan (real formula, model, fusion, confidence)
        3. Doctor review and modifications logged to audit trail
        4. Generate report
        5. Sign report
        6. Share report with patient
        7. Patient logs in and views shared report in patient portal
        """
        # 1. Upload scan image
        dummy_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
        up_resp = self.client.post(
            "/api/doctor/scans/upload",
            headers=self.headers,
            data={"patient_id": str(self.patient_id), "module": "breast"},
            files={"file": ("screening_test.png", dummy_png, "image/png")},
        )
        self.assertEqual(up_resp.status_code, 201)
        scan_id = up_resp.json()["scan_id"]

        # 2. Run analysis
        inputs_json = json.dumps({
            "age": 34,
            "menopausal_status": "premenopausal",
            "palpable_lump": "No",
            "family_history_breast_cancer": "Yes",
            "brca_mutation": "positive",
            "dense_breast_tissue": "dense",
            "personal_breast_cancer_history": "No",
        })
        an_resp = self.client.post(
            "/api/doctor/scans/analyze",
            headers=self.headers,
            data={
                "scan_id": str(scan_id),
                "module": "breast",
                "clinical_inputs": inputs_json,
            },
        )
        self.assertEqual(an_resp.status_code, 200)
        an_data = an_resp.json()
        self.assertIn("formula_result", an_data)
        self.assertIn("fusion_result", an_data)
        self.assertIn("confidence_result", an_data)

        # 3. Doctor review & modify
        rev_resp = self.client.patch(
            f"/api/doctor/scans/{scan_id}/doctor-review",
            headers=self.headers,
            json={
                "confirmed_risk_level": "critical",
                "clinical_notes": "Urgent biopsy requested due to confirmed BRCA positive mutation.",
            },
        )
        self.assertEqual(rev_resp.status_code, 200)

        # 4. Generate Report
        rep_resp = self.client.post(
            "/api/doctor/reports",
            headers=self.headers,
            json={"scan_id": scan_id},
        )
        self.assertEqual(rep_resp.status_code, 201)
        report_id = rep_resp.json()["id"]

        # 5. Sign Report
        sign_resp = self.client.post(
            f"/api/doctor/reports/{report_id}/sign",
            headers=self.headers,
            json={"password": "123"},
        )
        self.assertEqual(sign_resp.status_code, 200)
        self.assertEqual(sign_resp.json()["status"], "signed")

        # 6. Share Report with Patient
        share_resp = self.client.post(
            f"/api/doctor/reports/{report_id}/share",
            headers=self.headers,
            json={"share_via_email": True, "share_via_sms": False},
        )
        self.assertEqual(share_resp.status_code, 200)

        # 7. Patient logs into portal and reviews report
        pat_reports_resp = self.client.get(
            "/api/patient/reports",
            headers=self.patient_headers,
        )
        self.assertEqual(pat_reports_resp.status_code, 200)
        pat_reports = pat_reports_resp.json()
        matching_report = [r for r in pat_reports if str(r.get("id")) == str(report_id) or str(r.get("report_id")) == str(report_id)]
        self.assertTrue(len(matching_report) >= 1)

        # 8. Check Audit Trail completeness
        db = SessionLocal()
        audit_records = db.query(AuditLog).filter(
            AuditLog.resource_id.in_([str(scan_id), str(report_id)])
        ).all()
        actions = [a.action for a in audit_records]
        self.assertIn("ANALYSIS_GENERATED", actions)
        self.assertIn("REPORT_CREATED", actions)
        self.assertIn("REPORT_SIGNED", actions)
        self.assertIn("REPORT_SHARED", actions)
        db.close()


if __name__ == "__main__":
    unittest.main()
