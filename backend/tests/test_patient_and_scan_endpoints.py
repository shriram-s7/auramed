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
from app.models.enums import RiskLevel, ScanStatus, UserRole
from app.models.patient_profile import PatientProfile
from app.models.scan import Scan
from app.models.user import User


class TestPatientAndScanEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # Login as doctor to get bearer token
        login_resp = cls.client.post(
            "/api/auth/doctor/login",
            json={
                "identifier": "doctor@auramed.com",
                "password": "123",
                "registration_number": "TNMC123456",
            },
        )
        assert login_resp.status_code == 200, f"Doctor login failed: {login_resp.text}"
        data = login_resp.json()
        cls.token = data["access_token"]
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    def setUp(self):
        self.db: Session = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_01_create_patient_valid_and_validations(self):
        # 1. Test invalid phone number format
        bad_phone_resp = self.client.post(
            "/api/doctor/patients",
            headers=self.headers,
            json={
                "full_name": "Test Invalid Phone",
                "date_of_birth": "1990-01-01",
                "phone": "123",  # Too short
                "address": "123 Test St",
                "consent": {"data_storage_and_ai_analysis": True},
            },
        )
        self.assertEqual(bad_phone_resp.status_code, 400)
        self.assertIn("Invalid phone number format", bad_phone_resp.json()["detail"])

        # 2. Test date of birth in the future
        future_dob = (date.today() + timedelta(days=10)).isoformat()
        future_dob_resp = self.client.post(
            "/api/doctor/patients",
            headers=self.headers,
            json={
                "full_name": "Test Future DOB",
                "date_of_birth": future_dob,
                "phone": "9876543210",
                "address": "123 Test St",
                "consent": {"data_storage_and_ai_analysis": True},
            },
        )
        self.assertEqual(future_dob_resp.status_code, 400)
        self.assertIn("Date of birth must be in the past", future_dob_resp.json()["detail"])

        # 3. Test successful patient registration
        unique_phone = f"99{datetime.utcnow().strftime('%H%M%S%f')[:8]}"
        reg_resp = self.client.post(
            "/api/doctor/patients",
            headers=self.headers,
            json={
                "full_name": "Meera Krishnan",
                "date_of_birth": "1988-04-12",
                "gender": "female",
                "phone": unique_phone,
                "email": f"meera_{datetime.utcnow().timestamp()}@example.com",
                "address": "45 Lotus Avenue, Chennai",
                "pin_code": "600001",
                "blood_group": "O+",
                "emergency_contact_name": "Ravi Krishnan",
                "emergency_contact_phone": "9876543219",
                "emergency_contact_relation": "Spouse",
                "family_history": {"breast_cancer": True},
                "personal_medical_history": {"hypertension": False},
                "allergies": "None",
                "current_medications": "Vitamin D",
                "overall_notes": "Initial consultation for regular screening",
                "preferred_modules": ["breast"],
                "consent": {
                    "data_storage_and_ai_analysis": True,
                    "share_with_referring_physicians": True,
                },
            },
        )
        self.assertEqual(reg_resp.status_code, 201)
        reg_data = reg_resp.json()
        self.assertIn("patient_id", reg_data)
        self.assertIn("patient_code", reg_data)
        self.assertTrue(reg_data["patient_code"].startswith("P-"))
        self.assertEqual(reg_data["full_name"], "Meera Krishnan")
        self.assertEqual(len(reg_data["temporary_password"]), 8)
        self.assertIn("created_at", reg_data)

        # 4. Test duplicate phone registration under same doctor
        dup_resp = self.client.post(
            "/api/doctor/patients",
            headers=self.headers,
            json={
                "full_name": "Duplicate Meera",
                "date_of_birth": "1988-04-12",
                "phone": unique_phone,
                "address": "Another address",
                "consent": {"data_storage_and_ai_analysis": True},
            },
        )
        self.assertEqual(dup_resp.status_code, 400)
        self.assertIn("already registered under your account", dup_resp.json()["detail"])

        # Check Audit Log for registration
        audit = (
            self.db.query(AuditLog)
            .filter(AuditLog.action == "NEW_PATIENT_REGISTERED")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        self.assertIsNotNone(audit)
        self.assertIn("Meera Krishnan", str(audit.details))

    def test_02_list_patients_and_filtering(self):
        resp = self.client.get(
            "/api/doctor/patients?page=1&limit=10&sort_by=last_scan_newest",
            headers=self.headers,
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("items", data)
        self.assertIn("total", data)
        self.assertIn("page", data)
        self.assertIn("limit", data)
        self.assertIn("total_pages", data)
        self.assertGreater(data["total"], 0)

        # Check patient item structure
        item = data["items"][0]
        expected_keys = [
            "id", "full_name", "patient_id", "patient_code", "date_of_birth",
            "age", "gender", "phone", "email", "status", "modules_used",
            "last_scan_date", "last_scan_risk_level", "next_followup_date", "created_at"
        ]
        for key in expected_keys:
            self.assertIn(key, item, f"Missing key '{key}' in patient item")

        # Test search filter
        search_resp = self.client.get(
            f"/api/doctor/patients?search={item['full_name']}",
            headers=self.headers,
        )
        self.assertEqual(search_resp.status_code, 200)
        self.assertGreaterEqual(search_resp.json()["total"], 1)

        # Check Audit Log for list
        audit = (
            self.db.query(AuditLog)
            .filter(AuditLog.action == "PATIENT_LIST_VIEWED")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        self.assertIsNotNone(audit)

    def test_03_patient_profile_and_read_only_patch(self):
        # Fetch any patient of doctor
        list_resp = self.client.get("/api/doctor/patients?limit=1", headers=self.headers)
        patient_id = list_resp.json()["items"][0]["id"]

        # GET /api/doctor/patients/:patientId
        detail_resp = self.client.get(f"/api/doctor/patients/{patient_id}", headers=self.headers)
        self.assertEqual(detail_resp.status_code, 200)
        detail_data = detail_resp.json()
        self.assertIn("patient", detail_data)
        self.assertIn("total_scans", detail_data)
        self.assertIn("scans_by_module", detail_data)
        self.assertIn("latest_risk_per_module", detail_data)
        self.assertIn("next_followup_dates", detail_data)
        self.assertIn("overall_notes", detail_data["patient"])

        # Check Audit Log for GET patient
        audit = (
            self.db.query(AuditLog)
            .filter(AuditLog.action == "PATIENT_RECORD_VIEWED")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        self.assertIsNotNone(audit)

        # PATCH /api/doctor/patients/:patientId with read-only fields -> must be rejected with 400
        for ro_field in ["date_of_birth", "gender", "patient_id"]:
            ro_resp = self.client.patch(
                f"/api/doctor/patients/{patient_id}",
                headers=self.headers,
                json={ro_field: "modified_value"},
            )
            self.assertEqual(ro_resp.status_code, 400, f"Expected 400 for read-only field '{ro_field}'")
            self.assertIn("read-only", ro_resp.json()["detail"])

        # PATCH /api/doctor/patients/:patientId with allowed fields
        patch_resp = self.client.patch(
            f"/api/doctor/patients/{patient_id}",
            headers=self.headers,
            json={
                "address": "Updated Street 789",
                "allergies": "Penicillin, Dust",
                "overall_notes": "Updated doctor observation notes.",
            },
        )
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(patch_resp.json()["patient"]["address"], "Updated Street 789")
        self.assertEqual(patch_resp.json()["patient"]["allergies"], "Penicillin, Dust")

        # Check Audit Log for PATCH patient
        audit_patch = (
            self.db.query(AuditLog)
            .filter(AuditLog.action == "PATIENT_PROFILE_UPDATED")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        self.assertIsNotNone(audit_patch)
        self.assertIn("address", str(audit_patch.details))

    def test_04_patient_timeline_and_risk_trend(self):
        list_resp = self.client.get("/api/doctor/patients?limit=1", headers=self.headers)
        patient_id = list_resp.json()["items"][0]["id"]

        # GET /api/doctor/patients/:patientId/timeline
        timeline_resp = self.client.get(f"/api/doctor/patients/{patient_id}/timeline", headers=self.headers)
        self.assertEqual(timeline_resp.status_code, 200)
        timeline = timeline_resp.json()
        self.assertIsInstance(timeline, list)
        self.assertGreater(len(timeline), 0)
        ev = timeline[0]
        self.assertIn("date", ev)
        self.assertIn("event_type", ev)
        self.assertIn("title", ev)
        self.assertIn("description", ev)
        self.assertIn("related_id", ev)
        self.assertIn("icon_type", ev)

        trend_resp = self.client.get(f"/api/doctor/patients/{patient_id}/risk-trend?module=breast", headers=self.headers)
        self.assertEqual(trend_resp.status_code, 200)
        trend = trend_resp.json()
        self.assertIn("data_points", trend)
        self.assertIn("trajectory", trend)
        self.assertEqual(trend["module"], "breast")
        self.assertIn("trend_direction", trend["trajectory"])

    def test_05_scan_upload_and_analyze_lifecycle(self):
        # 1. Get patient
        list_resp = self.client.get("/api/doctor/patients?limit=1", headers=self.headers)
        patient_id = list_resp.json()["items"][0]["id"]

        # 2. Upload valid image
        dummy_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
        upload_resp = self.client.post(
            "/api/doctor/scans/upload",
            headers=self.headers,
            data={"patient_id": str(patient_id), "module": "breast"},
            files={"file": ("test_mammogram.png", dummy_png, "image/png")},
        )
        self.assertEqual(upload_resp.status_code, 201)
        upload_data = upload_resp.json()
        self.assertIn("scan_id", upload_data)
        self.assertIn("image_path", upload_data)
        self.assertEqual(upload_data["status"], "draft")
        self.assertEqual(upload_data["file_name"], "test_mammogram.png")
        self.assertGreater(upload_data["file_size"], 0)

        scan_id = upload_data["scan_id"]

        # Check Audit Log for upload
        audit_upload = (
            self.db.query(AuditLog)
            .filter(AuditLog.action == "SCAN_IMAGE_UPLOADED")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        self.assertIsNotNone(audit_upload)

        # 3. Test analyze with out-of-range clinical inputs
        bad_inputs = {
            "age": 10,  # Invalid: Breast age must be 18-100
            "menopausal_status": "premenopausal",
            "family_history_breast_cancer": "no",
            "palpable_lump": "no",
        }
        bad_analyze_resp = self.client.post(
            "/api/doctor/scans/analyze",
            headers=self.headers,
            data={"scan_id": scan_id, "clinical_inputs": json.dumps(bad_inputs)},
        )
        self.assertEqual(bad_analyze_resp.status_code, 400)
        self.assertIn("outside the valid range of 18-100", bad_analyze_resp.json()["detail"])

        # 4. Test analyze with valid clinical inputs
        valid_inputs = {
            "age": 48,
            "menopausal_status": "perimenopausal",
            "family_history_breast_cancer": "yes",
            "palpable_lump": "yes",
            "lump_location": "upper_outer",
            "lump_size_cm": 2.4,
            "nipple_discharge": "no",
            "skin_changes": "no",
            "previous_biopsy": "no",
            "mammogram_views": "CC and MLO",
            "image_quality": "diagnostic",
            "notes": "Patient noticed mass 3 weeks ago",
        }
        analyze_resp = self.client.post(
            "/api/doctor/scans/analyze",
            headers=self.headers,
            data={"scan_id": scan_id, "clinical_inputs": json.dumps(valid_inputs)},
        )
        self.assertEqual(analyze_resp.status_code, 200)
        analyze_data = analyze_resp.json()
        self.assertEqual(analyze_data["status"], "analyzed")
        self.assertIn(analyze_data["risk_level"], ["high", "critical"])
        self.assertGreater(analyze_data["confidence_score"], 0)
        self.assertIn("confidence_explanation", analyze_data)
        self.assertIn("reasons_high", analyze_data["confidence_explanation"])
        self.assertIn("reasoning", analyze_data)
        self.assertIn("image_findings", analyze_data["reasoning"])
        self.assertIn("clinical_contributions", analyze_data["reasoning"])
        self.assertIn(analyze_data["recommended_followup_days"], [7, 30])
        self.assertIn("recommended_actions", analyze_data)

        # Check Audit Log for analysis
        audit_analysis = (
            self.db.query(AuditLog)
            .filter(AuditLog.action == "ANALYSIS_GENERATED")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        self.assertIsNotNone(audit_analysis)

        # 5. GET /api/doctor/scans/:scanId
        get_scan_resp = self.client.get(f"/api/doctor/scans/{scan_id}", headers=self.headers)
        self.assertEqual(get_scan_resp.status_code, 200)
        scan_record = get_scan_resp.json()
        self.assertEqual(scan_record["scan_id"], scan_id)
        self.assertEqual(scan_record["status"], "analyzed")
        self.assertIn("clinical_inputs", scan_record)

        # 6. GET /api/doctor/scans/:scanId/results
        results_resp = self.client.get(f"/api/doctor/scans/{scan_id}/results", headers=self.headers)
        self.assertEqual(results_resp.status_code, 200)
        results_data = results_resp.json()
        self.assertEqual(results_data["scan_id"], scan_id)
        self.assertIn("patient", results_data)
        self.assertEqual(results_data["patient"]["id"], str(patient_id))

        # 7. PATCH /api/doctor/scans/:scanId/doctor-review
        review_resp = self.client.patch(
            f"/api/doctor/scans/{scan_id}/doctor-review",
            headers=self.headers,
            json={
                "modifications": [
                    {"parameter": "lump_size_cm", "ai_value": "2.4", "doctor_value": "2.7"}
                ],
                "notes": "Verified lump measurement on ultrasound correlation.",
            },
        )
        self.assertEqual(review_resp.status_code, 200)

        # Check Audit Log for review
        audit_review = (
            self.db.query(AuditLog)
            .filter(AuditLog.action == "MODIFIED_CLINICAL_VALUE")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        self.assertIsNotNone(audit_review)
        self.assertIn("lump_size_cm", str(audit_review.details))

        # 8. DELETE /api/doctor/scans/:scanId (Soft Delete)
        delete_resp = self.client.delete(f"/api/doctor/scans/{scan_id}", headers=self.headers)
        self.assertEqual(delete_resp.status_code, 200)
        self.assertEqual(delete_resp.json()["status"], "archived")

        # Verify in database: status is archived, record still exists
        scan_db = self.db.query(Scan).filter(Scan.id == uuid.UUID(scan_id)).first()
        self.assertIsNotNone(scan_db)
        self.assertEqual(scan_db.status, ScanStatus.archived)

        # Check Audit Log for archived scan
        audit_archive = (
            self.db.query(AuditLog)
            .filter(AuditLog.action == "ARCHIVED_SCAN")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        self.assertIsNotNone(audit_archive)

    def test_06_cervical_and_pcos_validation(self):
        list_resp = self.client.get("/api/doctor/patients?limit=1", headers=self.headers)
        patient_id = list_resp.json()["items"][0]["id"]
        dummy_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"

        # Cervical test: upload + analyze
        cerv_upload = self.client.post(
            "/api/doctor/scans/upload",
            headers=self.headers,
            data={"patient_id": str(patient_id), "module": "cervical"},
            files={"file": ("pap_smear.png", dummy_png, "image/png")},
        )
        self.assertEqual(cerv_upload.status_code, 201)
        cerv_scan_id = cerv_upload.json()["scan_id"]

        # Cervical out of range: age 150
        bad_cerv = {"age": 150, "sample_type": "liquid_based", "hpv_status": "negative", "smoking_status": "no"}
        bad_cerv_resp = self.client.post(
            "/api/doctor/scans/analyze",
            headers=self.headers,
            data={"scan_id": cerv_scan_id, "clinical_inputs": json.dumps(bad_cerv)},
        )
        self.assertEqual(bad_cerv_resp.status_code, 400)
        self.assertIn("18-100", bad_cerv_resp.json()["detail"])

        # Cervical valid analyze
        good_cerv = {"age": 34, "sample_type": "liquid_based", "hpv_status": "positive", "smoking_status": "never"}
        good_cerv_resp = self.client.post(
            "/api/doctor/scans/analyze",
            headers=self.headers,
            data={"scan_id": cerv_scan_id, "clinical_inputs": json.dumps(good_cerv)},
        )
        self.assertEqual(good_cerv_resp.status_code, 200)
        self.assertEqual(good_cerv_resp.json()["module"], "cervical")

        # PCOS test: upload + analyze
        pcos_upload = self.client.post(
            "/api/doctor/scans/upload",
            headers=self.headers,
            data={"patient_id": str(patient_id), "module": "pcos"},
            files={"file": ("pelvic_us.png", dummy_png, "image/png")},
        )
        self.assertEqual(pcos_upload.status_code, 201)
        pcos_scan_id = pcos_upload.json()["scan_id"]

        # PCOS out of range: amh_ng_ml = 25.0 (valid 0.5-15.0)
        bad_pcos = {
            "age": 26,
            "menstrual_cycle_regularity": "irregular",
            "cycle_length_days": 45,
            "amh_ng_ml": 25.0,  # Out of range!
            "lh_miu_ml": 14.0,
            "fsh_miu_ml": 5.0,
            "total_testosterone_ng_dl": 45.0,
            "prolactin_ng_ml": 12.0,
            "left_ovary_volume_ml": 11.0,
            "left_follicle_count": 16,
            "right_ovary_volume_ml": 12.0,
            "right_follicle_count": 18,
        }
        bad_pcos_resp = self.client.post(
            "/api/doctor/scans/analyze",
            headers=self.headers,
            data={"scan_id": pcos_scan_id, "clinical_inputs": json.dumps(bad_pcos)},
        )
        self.assertEqual(bad_pcos_resp.status_code, 400)
        self.assertIn("0.5-15.0", bad_pcos_resp.json()["detail"])

        # PCOS valid analyze
        good_pcos = dict(bad_pcos)
        good_pcos["amh_ng_ml"] = 8.5
        good_pcos_resp = self.client.post(
            "/api/doctor/scans/analyze",
            headers=self.headers,
            data={"scan_id": pcos_scan_id, "clinical_inputs": json.dumps(good_pcos)},
        )
        self.assertEqual(good_pcos_resp.status_code, 200)
        self.assertEqual(good_pcos_resp.json()["module"], "pcos")

        # Verify auto-computed lh_fsh_ratio in saved scan
        pcos_scan_rec = self.client.get(f"/api/doctor/scans/{pcos_scan_id}", headers=self.headers).json()
        self.assertEqual(pcos_scan_rec["clinical_inputs"]["lh_fsh_ratio"], 2.8)


if __name__ == "__main__":
    unittest.main()
