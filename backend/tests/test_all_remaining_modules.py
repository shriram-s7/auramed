import io
import json
import os
import sys
import unittest
import uuid
from datetime import date, datetime, timedelta

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.main import app
from app.models.audit_log import AuditLog
from app.models.doctor_profile import DoctorProfile
from app.models.patient_profile import PatientProfile
from app.models.scan import Scan
from app.models.report import Report
from app.models.appointment import Appointment
from app.models.referral import Referral
from app.models.data_deletion_request import DataDeletionRequest
from app.models.enums import RiskLevel, ScanStatus, UserRole, ReportStatus, AppointmentStatus


class TestAllRemainingModules(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

        # 1. Doctor Login
        doc_login = cls.client.post(
            "/api/auth/doctor/login",
            json={
                "identifier": "doctor@auramed.com",
                "password": "123",
                "registration_number": "TNMC123456",
            },
        )
        assert doc_login.status_code == 200, f"Doctor login failed: {doc_login.text}"
        cls.doc_token = doc_login.json()["access_token"]
        cls.doc_headers = {"Authorization": f"Bearer {cls.doc_token}"}

        # 2. Admin Login
        admin_login = cls.client.post(
            "/api/auth/admin/login",
            json={
                "email": "admin@auramed.com",
                "password": "123",
            },
        )
        assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
        cls.admin_token = admin_login.json()["access_token"]
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}

        # 3. Patient Login
        pat_login = cls.client.post(
            "/api/auth/patient/login",
            json={
                "identifier": "patient",
                "password": "123",
            },
        )
        assert pat_login.status_code == 200, f"Patient login failed: {pat_login.text}"
        cls.pat_token = pat_login.json()["access_token"]
        cls.pat_headers = {"Authorization": f"Bearer {cls.pat_token}"}

    def setUp(self):
        self.db: Session = SessionLocal()

    def tearDown(self):
        self.db.close()

    def _get_or_create_test_patient_and_scan(self):
        doc = self.db.query(DoctorProfile).first()
        pat = self.db.query(PatientProfile).filter(PatientProfile.doctor_id == doc.id).first()
        if not pat:
            pat = PatientProfile(
                doctor_id=doc.id,
                full_name="Report Test Patient",
                patient_code=f"P-TST-{uuid.uuid4().hex[:4].upper()}",
                date_of_birth=date(1988, 5, 20),
                gender="Female",
                phone="+91-98765-43210",
            )
            self.db.add(pat)
            self.db.commit()
            self.db.refresh(pat)

        scan = Scan(
            patient_id=pat.id,
            doctor_id=doc.id,
            module="breast",
            scan_date=date.today(),
            status=ScanStatus.analyzed,
            risk_level=RiskLevel.high,
            image_model_score=0.82,
            formula_score=0.74,
            fusion_score=0.79,
            confidence_score=0.88,
            clinical_inputs={"palpable_lump": "yes", "family_history": "first_degree"},
            reasoning={
                "model_interpretation": "Localized asymmetric parenchymal density.",
                "image_findings": [{"description": "Irregular microcalcification", "confidence": 0.88}],
            },
        )
        self.db.add(scan)
        self.db.commit()
        self.db.refresh(scan)
        return pat, scan


    def test_01_report_lifecycle(self):
        pat, scan = self._get_or_create_test_patient_and_scan()

        # 1. POST /api/doctor/reports - Create draft report
        create_resp = self.client.post(
            "/api/doctor/reports",
            headers=self.doc_headers,
            json={"scan_id": str(scan.id)},
        )
        self.assertEqual(create_resp.status_code, 201, f"Failed create report: {create_resp.text}")
        rep_data = create_resp.json()
        report_id = rep_data["id"]
        self.assertEqual(rep_data["status"], "draft")
        self.assertTrue(rep_data["report_number"].startswith("RPT-"))
        content = rep_data["content"]
        self.assertIn("patient_information", content)
        self.assertIn("clinical_summary", content)
        self.assertIn("imaging_findings", content)
        self.assertIn("ai_and_clinical_assessment", content)
        self.assertIn("risk_assessment", content)
        self.assertIn("recommendations", content)

        # 2. GET /api/doctor/reports - List reports with filters
        list_resp = self.client.get(
            "/api/doctor/reports?module=breast&page=1&limit=10",
            headers=self.doc_headers,
        )
        self.assertEqual(list_resp.status_code, 200)
        list_data = list_resp.json()
        self.assertIn("items", list_data)
        self.assertIn("stats", list_data)
        found = any(r["report_number"] == rep_data["report_number"] for r in list_data["items"])
        self.assertTrue(found, "Newly created report not found in doctor's report list")

        # 3. GET /api/doctor/reports/:reportId
        get_resp = self.client.get(f"/api/doctor/reports/{report_id}", headers=self.doc_headers)
        self.assertEqual(get_resp.status_code, 200)
        detail_data = get_resp.json()
        self.assertEqual(detail_data["id"], report_id)
        self.assertIn("audit_trail", detail_data)

        # 4. PATCH /api/doctor/reports/:reportId (allowed in draft)
        patch_resp = self.client.patch(
            f"/api/doctor/reports/{report_id}",
            headers=self.doc_headers,
            json={
                "sections": {
                    "clinical_summary": {"summary_text": "Updated clinical summary text by physician", "factors": []}
                },
                "options": {"include_images": True, "include_disclaimers": True},
                "template": "Detailed Oncology Assessment",
            },
        )
        self.assertEqual(patch_resp.status_code, 200)
        patched_data = patch_resp.json()
        self.assertEqual(patched_data["content"]["clinical_summary"]["summary_text"], "Updated clinical summary text by physician")

        # 5. POST /api/doctor/reports/:reportId/share (should FAIL when draft)
        bad_share = self.client.post(
            f"/api/doctor/reports/{report_id}/share",
            headers=self.doc_headers,
            json={"share_with_patient": True, "delivery_method": "portal"},
        )
        self.assertEqual(bad_share.status_code, 400, "Should disallow sharing draft reports")

        # 6. POST /api/doctor/reports/:reportId/sign
        sign_resp = self.client.post(
            f"/api/doctor/reports/{report_id}/sign",
            headers=self.doc_headers,
            json={},
        )
        self.assertEqual(sign_resp.status_code, 200)
        sign_data = sign_resp.json()
        self.assertEqual(sign_data["status"], "signed")
        self.assertIsNotNone(sign_data["signed_at"])
        self.assertIsNotNone(sign_data["signed_by"])

        # 7. PATCH after signed -> must FAIL
        bad_patch = self.client.patch(
            f"/api/doctor/reports/{report_id}",
            headers=self.doc_headers,
            json={"sections": {"clinical_summary": {"summary_text": "Illegal modification", "factors": []}}},
        )
        self.assertEqual(bad_patch.status_code, 400, "Modifying signed report must be rejected")

        # 8. POST /api/doctor/reports/:reportId/addendum
        addendum_resp = self.client.post(
            f"/api/doctor/reports/{report_id}/addendum",
            headers=self.doc_headers,
            json={"addendum_text": "Targeted ultrasound performed. Core biopsy scheduled for next week."},
        )
        self.assertEqual(addendum_resp.status_code, 200)
        addendum_data = addendum_resp.json()
        self.assertEqual(addendum_data["status"], "addendum")
        addendums = addendum_data["content"]["addendums"]
        self.assertTrue(len(addendums) > 0)
        self.assertIn("Targeted ultrasound performed", addendums[-1]["addendum_text"])

        # 9. POST /api/doctor/reports/:reportId/share (now allowed because signed/addendum)
        share_resp = self.client.post(
            f"/api/doctor/reports/{report_id}/share",
            headers=self.doc_headers,
            json={"share_with_patient": True, "delivery_method": "portal", "share_with_physician": False},
        )
        self.assertEqual(share_resp.status_code, 200)
        self.assertTrue(share_resp.json()["shared"])

        # 10. POST /api/doctor/reports/:reportId/generate-pdf
        pdf_resp = self.client.post(
            f"/api/doctor/reports/{report_id}/generate-pdf",
            headers=self.doc_headers,
        )
        self.assertEqual(pdf_resp.status_code, 200)
        self.assertEqual(pdf_resp.headers.get("content-type"), "application/pdf")
        self.assertTrue(len(pdf_resp.content) > 100)

        # 11. Check audit log entries created for report actions
        log_actions = [
            l.action for l in self.db.query(AuditLog).filter(AuditLog.resource_id == uuid.UUID(report_id)).all()
        ]
        self.assertIn("REPORT_CREATED", log_actions)
        self.assertIn("REPORT_SIGNED", log_actions)
        self.assertIn("ADDENDUM_ADDED", log_actions)
        self.assertIn("REPORT_SHARED", log_actions)
        self.assertIn("PDF_GENERATED", log_actions)

    def test_02_appointment_endpoints(self):
        pat, scan = self._get_or_create_test_patient_and_scan()

        # 1. Validation: date in past
        past_resp = self.client.post(
            "/api/doctor/appointments",
            headers=self.doc_headers,
            json={
                "patient_id": str(pat.id),
                "scheduled_date": "2020-01-01",
                "appointment_type": "Biopsy Consultation",
            },
        )
        self.assertEqual(past_resp.status_code, 400)

        # 2. Validation: valid future appointment
        future_date = date.today() + timedelta(days=25)
        create_resp = self.client.post(
            "/api/doctor/appointments",
            headers=self.doc_headers,
            json={
                "patient_id": str(pat.id),
                "scheduled_date": str(future_date),
                "scheduled_time": "11:30",
                "appointment_type": "Specialist Consultation",
                "location": "Room 401",
                "notes": "Bring previous scans",
                "ai_recommended": True,
                "ai_recommended_days": 14,
            },
        )
        self.assertEqual(create_resp.status_code, 201)
        appt_data = create_resp.json()
        appt_id = appt_data["id"]

        # 3. Validation: conflicting appointment on same date
        conflict_resp = self.client.post(
            "/api/doctor/appointments",
            headers=self.doc_headers,
            json={
                "patient_id": str(pat.id),
                "scheduled_date": str(future_date),
                "appointment_type": "Routine Follow-up",
            },
        )
        self.assertEqual(conflict_resp.status_code, 409)

        # 4. GET /api/doctor/appointments
        list_resp = self.client.get("/api/doctor/appointments?limit=10", headers=self.doc_headers)
        self.assertEqual(list_resp.status_code, 200)
        list_data = list_resp.json()
        self.assertIn("summary", list_data)
        self.assertIn("upcoming_count", list_data["summary"])

        # 5. GET /api/doctor/appointments/calendar
        cal_resp = self.client.get(
            f"/api/doctor/appointments/calendar?year={future_date.year}&month={future_date.month}",
            headers=self.doc_headers,
        )
        self.assertEqual(cal_resp.status_code, 200)
        cal_data = cal_resp.json()
        self.assertIn(str(future_date), cal_data)

        # 6. PATCH /api/doctor/appointments/:appointmentId - Reschedule
        new_date = future_date + timedelta(days=3)
        resched_resp = self.client.patch(
            f"/api/doctor/appointments/{appt_id}",
            headers=self.doc_headers,
            json={"scheduled_date": str(new_date), "scheduled_time": "14:00"},
        )
        self.assertEqual(resched_resp.status_code, 200)
        self.assertEqual(resched_resp.json()["scheduled_date"], str(new_date))

        # 7. POST /api/doctor/appointments/:appointmentId/complete
        complete_resp = self.client.post(
            f"/api/doctor/appointments/{appt_id}/complete",
            headers=self.doc_headers,
            json={"completion_notes": "Patient attended and completed examination"},
        )
        self.assertEqual(complete_resp.status_code, 200)
        self.assertEqual(complete_resp.json()["status"], "completed")

    def test_03_referral_and_activity_endpoints(self):
        pat, scan = self._get_or_create_test_patient_and_scan()

        # 1. POST /api/doctor/referrals
        ref_resp = self.client.post(
            "/api/doctor/referrals",
            headers=self.doc_headers,
            json={
                "patient_id": str(pat.id),
                "specialty": "Surgical Oncology",
                "reason": "Multimodal screening indicated focal density requiring core biopsy.",
                "priority": "urgent",
                "specialist_id": "spec-1",
                "attachments": {
                    "include_scans": True,
                    "include_ai_summary": True,
                    "include_clinical_report": True,
                },
                "clinical_notes": "Patient informed about biopsy recommendation.",
            },
        )
        self.assertEqual(ref_resp.status_code, 201)
        ref_data = ref_resp.json()
        ref_id = ref_data["id"]
        self.assertEqual(ref_data["priority"], "urgent")

        # 2. GET /api/doctor/referrals
        list_resp = self.client.get("/api/doctor/referrals", headers=self.doc_headers)
        self.assertEqual(list_resp.status_code, 200)
        self.assertTrue(len(list_resp.json()) > 0)

        # 3. PATCH /api/doctor/referrals/:referralId
        patch_resp = self.client.patch(
            f"/api/doctor/referrals/{ref_id}",
            headers=self.doc_headers,
            json={
                "status": "accepted",
                "response_notes": "Patient scheduled for consultation at Oncology Institute on Thursday.",
            },
        )
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(patch_resp.json()["status"], "accepted")

        # 4. GET /api/doctor/activity
        act_resp = self.client.get("/api/doctor/activity?page=1&limit=10", headers=self.doc_headers)
        self.assertEqual(act_resp.status_code, 200)
        act_data = act_resp.json()
        self.assertIn("items", act_data)
        self.assertIn("insights", act_data)
        insights = act_data["insights"]
        self.assertIn("most_active_module", insights)
        self.assertIn("reports_signed_this_month", insights)
        self.assertIn("total_actions", insights)
        self.assertIn("scans_analyzed", insights)
        self.assertIn("reports_generated", insights)
        self.assertIn("reports_signed", insights)
        self.assertIn("referrals_made", insights)

    def test_04_admin_endpoints(self):
        # 1. GET /api/admin/stats
        stats_resp = self.client.get("/api/admin/stats", headers=self.admin_headers)
        self.assertEqual(stats_resp.status_code, 200)
        st = stats_resp.json()
        self.assertIn("total_patients", st)
        self.assertIn("patients_change_pct", st)
        self.assertIn("registered_doctors", st)
        self.assertIn("doctors_change_pct", st)
        self.assertIn("reports_generated", st)
        self.assertIn("reports_change_pct", st)
        self.assertIn("pending_requests", st)
        self.assertIn("requests_change_pct", st)

        # 2. GET /api/admin/doctors
        doc_resp = self.client.get("/api/admin/doctors?page=1&limit=5", headers=self.admin_headers)
        self.assertEqual(doc_resp.status_code, 200)
        docs = doc_resp.json()
        self.assertIn("items", docs)
        self.assertTrue(len(docs["items"]) > 0)

        # 3. PATCH /api/admin/doctors/:doctorId/verify
        doc_id = docs["items"][0]["id"]
        verify_resp = self.client.patch(f"/api/admin/doctors/{doc_id}/verify", headers=self.admin_headers)
        self.assertEqual(verify_resp.status_code, 200)
        self.assertEqual(verify_resp.json()["status"], "Verified")

        # 4. GET /api/admin/audit-logs
        log_resp = self.client.get("/api/admin/audit-logs?page=1&limit=10", headers=self.admin_headers)
        self.assertEqual(log_resp.status_code, 200)
        logs_data = log_resp.json()
        self.assertIn("stats", logs_data)
        self.assertIn("patient_data_access", logs_data["stats"])

        # 5. GET /api/admin/system-status
        sys_resp = self.client.get("/api/admin/system-status", headers=self.admin_headers)
        self.assertEqual(sys_resp.status_code, 200)
        sys_data = sys_resp.json()
        self.assertIn("application_server", sys_data)
        self.assertIn("ai_inference_engine", sys_data)
        self.assertIn("database", sys_data)
        self.assertIn("file_storage", sys_data)
        self.assertIn("overall", sys_data)

        # 6. Data deletion requests
        del_reqs_resp = self.client.get("/api/admin/data-requests", headers=self.admin_headers)
        self.assertEqual(del_reqs_resp.status_code, 200)

        # Approve and Reject
        sample_id = str(uuid.uuid4())
        appr_resp = self.client.post(f"/api/admin/data-requests/{sample_id}/approve", headers=self.admin_headers)
        self.assertEqual(appr_resp.status_code, 200)
        self.assertEqual(appr_resp.json()["status"], "approved")

        rej_resp = self.client.post(
            f"/api/admin/data-requests/{sample_id}/reject",
            headers=self.admin_headers,
            json={"rejection_reason": "Medical statutory retention required."},
        )
        self.assertEqual(rej_resp.status_code, 200)
        self.assertEqual(rej_resp.json()["status"], "rejected")

    def test_05_patient_portal_endpoints(self):
        # 1. GET /api/patient/dashboard
        dash_resp = self.client.get("/api/patient/dashboard", headers=self.pat_headers)
        self.assertEqual(dash_resp.status_code, 200)
        dash_data = dash_resp.json()
        self.assertIn("total_reports", dash_data)
        self.assertIn("upcoming_appointments_count", dash_data)
        self.assertIn("last_scan_date", dash_data)
        self.assertIn("last_scan_module", dash_data)
        self.assertIn("health_modules", dash_data)
        self.assertIn("recent_reports", dash_data)
        self.assertIn("next_appointment", dash_data)
        self.assertIn("health_timeline_preview", dash_data)

        # 2. GET /api/patient/reports
        rep_resp = self.client.get("/api/patient/reports", headers=self.pat_headers)
        self.assertEqual(rep_resp.status_code, 200)
        rep_list = rep_resp.json()
        self.assertTrue(len(rep_list) > 0)
        first_rep = rep_list[0]
        self.assertIn("date", first_rep)
        self.assertIn("module", first_rep)
        self.assertIn("result", first_rep)
        self.assertIn("report_id", first_rep)

        # 3. GET /api/patient/reports/:reportId (Plain Language Guarantee)
        detail_resp = self.client.get(f"/api/patient/reports/{first_rep['id']}", headers=self.pat_headers)
        self.assertEqual(detail_resp.status_code, 200)
        det = detail_resp.json()
        self.assertIn("plain_language_summary", det)
        self.assertIn("plain_language_findings", det)
        self.assertIn("doctor_recommendations", det)
        self.assertIn("next_steps", det)
        self.assertIn("doctor_name", det)
        self.assertIn("hospital", det)

        # Verify NO raw scores or technical model names are exposed
        det_str = json.dumps(det).lower()
        self.assertNotIn("confidence_score", det_str)
        self.assertNotIn("formula_score", det_str)
        self.assertNotIn("image_model_score", det_str)
        self.assertNotIn("fusion_score", det_str)

        # 4. GET /api/patient/appointments
        appts_resp = self.client.get("/api/patient/appointments", headers=self.pat_headers)
        self.assertEqual(appts_resp.status_code, 200)

        # 5. GET /api/patient/timeline
        time_resp = self.client.get("/api/patient/timeline", headers=self.pat_headers)
        self.assertEqual(time_resp.status_code, 200)
        self.assertIn("events", time_resp.json())

        # 6. PATCH /api/patient/profile
        prof_resp = self.client.patch(
            "/api/patient/profile",
            headers=self.pat_headers,
            json={"phone": "+91-98765-99999", "address": "77 Palm Grove, Bengaluru"},
        )
        self.assertEqual(prof_resp.status_code, 200)
        self.assertEqual(prof_resp.json()["phone"], "+91-98765-99999")

        # 7. POST /api/patient/data-deletion-request
        del_resp = self.client.post(
            "/api/patient/data-deletion-request",
            headers=self.pat_headers,
            json={"reason": "Right to be forgotten request under DPDP 2023", "request_type": "Full Account Deletion"},
        )
        self.assertEqual(del_resp.status_code, 200)
        self.assertEqual(del_resp.json()["status"], "pending")


if __name__ == "__main__":
    unittest.main()
