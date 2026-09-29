"""
Unit and Integration Tests for Longitudinal Risk Trajectory and PDF Report Generation.
"""
from datetime import date, datetime, timedelta
import unittest
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, SessionLocal, engine
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.doctor_profile import DoctorProfile
from app.models.enums import ReportStatus, ScanStatus, ScreeningModule, UserRole
from app.models.patient_profile import PatientProfile
from app.models.report import Report
from app.models.scan import Scan
from app.models.user import User
from app.ml.trajectory import TrajectoryResult, compute_risk_trajectory
from app.services.pdf_generator import generate_report_pdf


class TestTrajectoryAndPdf(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

        db = SessionLocal()
        cls.test_email = f"dr_traj_{datetime.utcnow().timestamp()}@auramed.com"
        user = User(
            email=cls.test_email,
            password_hash=hash_password("DoctorSecure123!"),
            role=UserRole.doctor,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        doctor = DoctorProfile(
            user_id=user.id,
            full_name="Dr. Radhika Sen",
            registration_number=f"MCI-{uuid.uuid4().hex[:6].upper()}",
            specialty="Surgical Oncology",
            hospital="AuraMed Comprehensive Cancer Center",
            phone="+91-9988776655",
        )
        db.add(doctor)
        db.commit()
        db.refresh(doctor)

        cls.user_id = user.id
        cls.doctor_id = doctor.id
        cls.token = create_access_token({"sub": str(user.id), "role": "doctor"})
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

        # Create a patient user and profile
        pat_user = User(
            email=f"sunita_{datetime.utcnow().timestamp()}@example.com",
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
            full_name="Sunita Sharma",
            date_of_birth=date(1985, 4, 12),
            gender="Female",
            phone="+91-9876543210",
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
        cls.patient_id = patient.id
        cls.patient_code = patient.patient_code

        # Create 3 sequential scans
        scan1 = Scan(
            patient_id=patient.id,
            doctor_id=doctor.id,
            module=ScreeningModule.breast,
            scan_date=date.today() - timedelta(days=90),
            status=ScanStatus.analyzed,
            image_model_score=0.25,
            formula_score=0.30,
            fusion_score=0.27,
            risk_level="low",
            confidence_score=0.88,
            clinical_inputs={"age": 39, "family_history_breast_cancer": "No"},
            reasoning={"image_findings": ["No focal abnormalities"]},
        )
        scan2 = Scan(
            patient_id=patient.id,
            doctor_id=doctor.id,
            module=ScreeningModule.breast,
            scan_date=date.today() - timedelta(days=45),
            status=ScanStatus.analyzed,
            image_model_score=0.42,
            formula_score=0.45,
            fusion_score=0.43,
            risk_level="moderate",
            confidence_score=0.85,
            clinical_inputs={"age": 39, "family_history_breast_cancer": "No"},
            reasoning={"image_findings": ["Mild parenchymal asymmetry"]},
        )
        scan3 = Scan(
            patient_id=patient.id,
            doctor_id=doctor.id,
            module=ScreeningModule.breast,
            scan_date=date.today(),
            status=ScanStatus.analyzed,
            image_model_score=0.72,
            formula_score=0.68,
            fusion_score=0.70,
            risk_level="high",
            confidence_score=0.84,
            clinical_inputs={"age": 39, "family_history_breast_cancer": "No"},
            reasoning={"image_findings": ["Suspicious focal mass upper outer quadrant"]},
        )
        db.add_all([scan1, scan2, scan3])
        db.commit()
        db.refresh(scan3)
        cls.scan_id = scan3.id

        # Create a report
        report = Report(
            scan_id=scan3.id,
            patient_id=patient.id,
            doctor_id=doctor.id,
            report_number=f"RPT-{uuid.uuid4().hex[:8].upper()}",
            status=ReportStatus.draft,
            content={
                "patient_info": {
                    "name": patient.full_name,
                    "patient_id": patient.patient_code,
                    "age": 39,
                    "gender": "Female",
                    "date_of_scan": str(scan3.scan_date),
                    "indication": "Annual Diagnostic Mammogram",
                },
                "clinical_summary": {
                    "summary_text": "Patient presented for scheduled follow-up mammography.",
                    "factors": [{"name": "Age", "value": "39", "impact": "low"}],
                },
                "imaging_findings": {
                    "description": "Focal dense mass detected in the upper outer quadrant.",
                    "findings_bullets": ["Irregular mass margins", "Localized architectural distortion"],
                },
                "ai_assessment": {
                    "rows": [
                        {"component": "Vision Model", "result": "0.72", "interpretation": "High probability of lesion"},
                    ]
                },
                "risk_assessment": {
                    "risk_level": "HIGH",
                    "recommendation_sentence": "Urgent biopsy and ultrasound-guided histopathology advised.",
                },
                "recommendations": {
                    "recommendations_list": [
                        "Ultrasound-guided core needle biopsy",
                        "Surgical oncology consultation within 14 days",
                    ],
                    "ai_insight_explanation": "Multimodal fusion indicates significant elevation above baseline.",
                },
            },
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        cls.report_id = report.id
        db.close()

    def test_01_trajectory_insufficient_data(self):
        """Tests trajectory when fewer than 2 scans exist."""
        single_scan = [{"scan_date": date.today(), "fusion_score": 0.45, "risk_level": "moderate"}]
        res = compute_risk_trajectory(single_scan, module="breast")
        self.assertEqual(res.trend_direction, "insufficient_data")
        self.assertEqual(res.trend_slope, 0.0)
        self.assertIn("At least 2 scans required", res.trend_explanation)
        self.assertEqual(res.trajectory_risk, "moderate")

    def test_02_trajectory_worsening_trend(self):
        """Tests worsening trajectory slope > 0.001."""
        history = [
            {"scan_date": date.today() - timedelta(days=60), "fusion_score": 0.20, "risk_level": "low"},
            {"scan_date": date.today() - timedelta(days=30), "fusion_score": 0.45, "risk_level": "moderate"},
            {"scan_date": date.today(), "fusion_score": 0.75, "risk_level": "high"},
        ]
        res = compute_risk_trajectory(history, module="breast")
        self.assertEqual(res.trend_direction, "worsening")
        self.assertGreater(res.trend_slope, 0.001)
        self.assertIn("upward trend", res.trend_explanation)
        self.assertEqual(res.trajectory_risk, "high")  # latest_score 0.75 > 0.50

    def test_03_trajectory_improving_trend(self):
        """Tests improving trajectory slope < -0.001."""
        history = [
            {"scan_date": date.today() - timedelta(days=90), "fusion_score": 0.75, "risk_level": "high"},
            {"scan_date": date.today() - timedelta(days=45), "fusion_score": 0.45, "risk_level": "moderate"},
            {"scan_date": date.today(), "fusion_score": 0.20, "risk_level": "moderate"},
        ]
        res = compute_risk_trajectory(history, module="breast")
        self.assertEqual(res.trend_direction, "improving")
        self.assertLess(res.trend_slope, -0.001)
        self.assertIn("downward trend", res.trend_explanation)
        # Improving drops one tier below latest_risk ("moderate" -> "low")
        self.assertEqual(res.trajectory_risk, "low")

    def test_04_trajectory_stable_trend(self):
        """Tests stable trajectory between -0.001 and 0.001."""
        history = [
            {"scan_date": date.today() - timedelta(days=60), "fusion_score": 0.35, "risk_level": "moderate"},
            {"scan_date": date.today() - timedelta(days=30), "fusion_score": 0.36, "risk_level": "moderate"},
            {"scan_date": date.today(), "fusion_score": 0.35, "risk_level": "moderate"},
        ]
        res = compute_risk_trajectory(history, module="pcos")
        self.assertEqual(res.trend_direction, "stable")
        self.assertTrue(-0.001 <= res.trend_slope <= 0.001)
        self.assertIn("relatively stable", res.trend_explanation)
        self.assertEqual(res.trajectory_risk, "moderate")

    def test_05_patient_risk_trend_endpoint(self):
        """Tests GET /api/doctor/patients/:patientId/risk-trend returns structured trajectory."""
        resp = self.client.get(
            f"/api/doctor/patients/{self.patient_id}/risk-trend?module=breast",
            headers=self.headers,
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("data_points", data)
        self.assertIn("trajectory", data)
        self.assertEqual(data["module"], "breast")
        self.assertGreaterEqual(len(data["data_points"]), 3)
        self.assertEqual(data["trajectory"]["trend_direction"], "worsening")
        self.assertEqual(data["trajectory"]["trajectory_risk"], "high")

    def test_06_pdf_generation_service(self):
        """Directly tests generate_report_pdf with Report, Scan, Patient, Doctor objects."""
        db = SessionLocal()
        report = db.query(Report).filter(Report.id == self.report_id).first()
        scan = db.query(Scan).filter(Scan.id == self.scan_id).first()
        patient = db.query(PatientProfile).filter(PatientProfile.id == self.patient_id).first()
        doctor = db.query(DoctorProfile).filter(DoctorProfile.id == self.doctor_id).first()

        pdf_bytes = generate_report_pdf(report, scan, patient, doctor)
        db.close()

        self.assertIsInstance(pdf_bytes, bytes)
        self.assertGreater(len(pdf_bytes), 1000)
        # PDF magic number
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))

    def test_07_generate_pdf_endpoint(self):
        """Tests POST /api/doctor/reports/:reportId/generate-pdf endpoint."""
        resp = self.client.post(
            f"/api/doctor/reports/{self.report_id}/generate-pdf",
            headers=self.headers,
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get("content-type"), "application/pdf")
        self.assertIn("attachment; filename=", resp.headers.get("content-disposition", ""))
        self.assertTrue(resp.content.startswith(b"%PDF-"))
        self.assertGreater(len(resp.content), 1000)

        # Verify report.pdf_path was recorded
        db = SessionLocal()
        rep = db.query(Report).filter(Report.id == self.report_id).first()
        self.assertIsNotNone(rep.pdf_path)
        self.assertTrue(rep.pdf_path.endswith(".pdf"))
        db.close()


if __name__ == "__main__":
    unittest.main()
