import io
import json
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import get_db, SessionLocal
from app.models.user import User
from app.models.enums import UserRole, ScreeningModule, RiskLevel, ScanStatus, ReportStatus
from app.models.patient_profile import PatientProfile
from app.models.doctor_profile import DoctorProfile
from app.models.scan import Scan
from app.models.report import Report
from app.core.security import create_access_token, hash_password


client = TestClient(app)


def test_rotterdam_end_to_end():
    db: Session = SessionLocal()
    try:
        # 1. Setup Doctor & Patient in database
        doc_email = f"doctor_rotterdam_{uuid.uuid4().hex[:6]}@auramed.io"
        doctor = User(
            email=doc_email,
            password_hash=hash_password("DoctorPass123!"),
            role=UserRole.doctor,
            is_active=True,
        )
        db.add(doctor)
        db.flush()

        doc_prof = DoctorProfile(
            user_id=doctor.id,
            full_name="Dr. Elena Vance",
            registration_number=f"DOC-{uuid.uuid4().hex[:6].upper()}",
            specialty="Gynecology",
            hospital="AuraMed Central Clinic",
            is_approved=True,
        )
        db.add(doc_prof)
        db.flush()

        patient_user = User(
            email=f"patient_rotterdam_{uuid.uuid4().hex[:6]}@auramed.io",
            password_hash=hash_password("PatientPass123!"),
            role=UserRole.patient,
            is_active=True,
        )
        db.add(patient_user)
        db.flush()

        patient_profile = PatientProfile(
            user_id=patient_user.id,
            patient_code=f"AM-PCOS-{uuid.uuid4().hex[:4].upper()}",
            full_name="Sarah Connor",
            gender="female",
            created_by_doctor_id=doc_prof.id,
        )
        db.add(patient_profile)
        db.commit()

        doctor_token = create_access_token({"sub": str(doctor.id), "role": "doctor", "email": doctor.email})
        patient_token = create_access_token({"sub": str(patient_user.id), "role": "patient", "email": patient_user.email})
        doc_headers = {"Authorization": f"Bearer {doctor_token}"}
        pat_headers = {"Authorization": f"Bearer {patient_token}"}

        # 2. Doctor opens PCOS scan form:
        # Checks "Oligo/Anovulation present" = True
        # Leaves "Hyperandrogenism present" = False
        # Uploads a PCOS ultrasound image
        clinical_inputs = {
            "age": 27,
            "menstrual_regularity": "irregular",
            "cycle_length_days": 45,
            "amh_ng_ml": 4.5,
            "lh_miu_ml": 8.0,
            "fsh_miu_ml": 4.0,
            "total_testosterone_ng_dl": 40.0,
            "prolactin_ng_ml": 12.0,
            "criterion_oligo_anovulation": True,
            "criterion_hyperandrogenism": False,
            "left_ovary_volume_ml": 11.5,
            "left_follicle_count": 14,
            "right_ovary_volume_ml": 12.0,
            "right_follicle_count": 15,
        }

        # Create 1x1 test image bytes
        dummy_img = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9")

        # 3. Submits scan (using POST /api/doctor/scans/analyze)
        analyze_resp = client.post(
            "/api/doctor/scans/analyze",
            headers=doc_headers,
            data={
                "module": "pcos",
                "patient_id": str(patient_profile.id),
                "clinical_inputs": json.dumps(clinical_inputs),
                "image_quality": "good",
            },
            files={"image": ("ultrasound.jpg", dummy_img.getvalue(), "image/jpeg")}
        )
        assert analyze_resp.status_code == 200, f"Analyze failed: {analyze_resp.text}"
        scan_data = analyze_resp.json()
        scan_id = scan_data["scan_id"]

        # 4. On results page: Rotterdam checklist data
        results_resp = client.get(f"/api/doctor/scan/results/{scan_id}", headers=doc_headers)
        assert results_resp.status_code == 200, f"Get results failed: {results_resp.text}"
        res = results_resp.json()

        assert res["criterion_oligo_anovulation"] is True
        assert res["criterion_hyperandrogenism"] is False
        assert res["criterion_polycystic_ovaries"] is True
        assert res["rotterdam_criteria_met"] == 2
        assert res["rotterdam_positive"] is True

        # 5. Doctor navigates to report builder — Rotterdam section
        rep_resp = client.get(f"/api/doctor/scans/{scan_id}/report", headers=doc_headers)
        assert rep_resp.status_code == 200, f"Report get failed: {rep_resp.text}"
        rep_data = rep_resp.json()
        rep_content = rep_data["content"]
        assert "rotterdam_criteria" in rep_content
        rotterdam_sec = rep_content["rotterdam_criteria"]
        assert rotterdam_sec["criteria_met"] == 2
        assert rotterdam_sec["rotterdam_positive"] is True
        assert rotterdam_sec["oligo_anovulation"] is True
        assert rotterdam_sec["hyperandrogenism"] is False
        assert rotterdam_sec["polycystic_ovaries"] is True
        assert "Patient meets Rotterdam 2003 diagnostic criteria for PCOS" in rotterdam_sec["note"]

        # Test PDF generation includes Rotterdam section
        report_id = rep_data["id"]
        pdf_resp = client.post(f"/api/doctor/reports/{report_id}/generate-pdf", headers=doc_headers)
        assert pdf_resp.status_code == 200, f"PDF generation failed: {pdf_resp.text}"
        assert pdf_resp.headers["content-type"] == "application/pdf"
        assert len(pdf_resp.content) > 1000

        # 6. Doctor signs and shares report
        sign_resp = client.post(
            f"/api/doctor/reports/{report_id}/sign",
            headers=doc_headers,
        )
        assert sign_resp.status_code == 200

        # Share with patient
        share_resp = client.post(
            f"/api/doctor/reports/{report_id}/share",
            headers=doc_headers,
            json={"share_with_patient": True}
        )
        assert share_resp.status_code == 200

        # 7. Patient logs in and views report — sees plain language summary
        pat_rep_resp = client.get(f"/api/patient/reports/{report_id}", headers=pat_headers)
        assert pat_rep_resp.status_code == 200, f"Patient view failed: {pat_rep_resp.text}"
        pat_rep = pat_rep_resp.json()
        assert "diagnostic_criteria_assessment" in pat_rep["summary_tab"]
        dca = pat_rep["summary_tab"]["diagnostic_criteria_assessment"]
        assert dca["heading"] == "Diagnostic Criteria Assessment"
        
        # Verify plain-language items
        items_by_name = {item["name"]: item["status"] for item in dca["items"]}
        assert items_by_name["Irregular periods"] == "Detected"
        assert items_by_name["Hormone markers"] == "Normal"
        assert items_by_name["Ovarian appearance"] == "Consistent with PCOS"
        assert "Based on your scan and clinical history, 2 or more PCOS diagnostic criteria were identified." in dca["summary"]
        
        # Verify NO raw scores or "Rotterdam Positive/Negative" labels exposed in plain-language DCA
        dca_str = json.dumps(dca)
        assert "Rotterdam Positive" not in dca_str
        assert "ROTTERDAM POSITIVE" not in dca_str
        assert "Rotterdam Negative" not in dca_str

        # 8. Scan history list — Rotterdam badge available
        # Doctor scan list
        doc_scans_resp = client.get("/api/doctor/scans?module=pcos", headers=doc_headers)
        assert doc_scans_resp.status_code == 200
        scans_list = doc_scans_resp.json()
        match_scan = next((s for s in scans_list if s["id"] == scan_id), None)
        assert match_scan is not None
        assert match_scan["rotterdam_positive"] is True

        # Patient scan / reports list
        pat_list_resp = client.get("/api/patient/reports", headers=pat_headers)
        assert pat_list_resp.status_code == 200
        pat_reports = pat_list_resp.json()
        match_rep = next((pr for pr in pat_reports if pr["id"] == report_id), None)
        assert match_rep is not None
        assert match_rep["rotterdam_positive"] is True

    finally:
        db.close()
