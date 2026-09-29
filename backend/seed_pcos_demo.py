import json
import uuid
from datetime import date, datetime, timezone

from app.core.database import SessionLocal
from app.models.user import User
from app.models.doctor_profile import DoctorProfile
from app.models.patient_profile import PatientProfile
from app.models.scan import Scan
from app.models.report import Report
from app.models.enums import ScreeningModule, ScanStatus, RiskLevel, ReportStatus
from app.services.report_service import get_or_create_report_for_scan

db = SessionLocal()
try:
    doc = db.query(DoctorProfile).first()
    pat = db.query(PatientProfile).first()

    clinical_inputs = {
        "age": 28,
        "menstrual_regularity": "irregular",
        "cycle_length_days": 45,
        "amh_ng_ml": 4.8,
        "lh_miu_ml": 8.5,
        "fsh_miu_ml": 4.2,
        "total_testosterone_ng_dl": 42.0,
        "prolactin_ng_ml": 14.0,
        "criterion_oligo_anovulation": True,
        "criterion_hyperandrogenism": False,
        "left_ovary_volume_ml": 11.8,
        "left_follicle_count": 14,
        "right_ovary_volume_ml": 12.2,
        "right_follicle_count": 16,
    }

    scan = Scan(
        doctor_id=doc.id,
        patient_id=pat.id,
        module=ScreeningModule.pcos,
        scan_date=date.today(),
        image_path="uploads/pcos/pcos_demo.jpg",
        file_name="pcos_demo.jpg",
        file_size=10240,
        image_quality="good",
        status=ScanStatus.analyzed,
        clinical_inputs=clinical_inputs,
        image_model_score=0.78,
        formula_score=0.72,
        fusion_score=0.75,
        risk_level=RiskLevel.high,
        confidence_score=0.88,
        criterion_oligo_anovulation=True,
        criterion_hyperandrogenism=False,
        criterion_polycystic_ovaries=True,
        rotterdam_criteria_met=2,
        rotterdam_positive=True,
        reasoning={
            "formula_result": {
                "score": 0.72,
                "risk_level": "high",
                "criteria_met": ["Oligo/Anovulation", "Polycystic Ovaries"],
                "criteria_not_met": ["Hyperandrogenism"],
                "factor_contributions": {
                    "Menstrual Cycle Regularity": 0.35,
                    "Polycystic Ovarian Morphology": 0.30,
                    "AMH": 0.05,
                    "LH/FSH Ratio": 0.02,
                }
            }
        }
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    # Create report
    report = get_or_create_report_for_scan(db, scan, doc)
    report.status = ReportStatus.shared_with_patient
    report.shared_with_patient = True
    db.commit()
    db.refresh(report)

    print("SUCCESS")
    print("SCAN_ID:", str(scan.id))
    print("REPORT_ID:", str(report.id))
    print("PATIENT_USER_EMAIL:", pat.user.email if pat.user else "testpatient1@auramed.com")
finally:
    db.close()
