"""
Comprehensive Unit Test Suite for AuraMed Clinical Formula Computations.
Tests:
- Modified Gail model clinical approximation for Breast Cancer (app/ml/formulas/breast.py)
- Rotterdam 2003 criteria & biomarkers for PCOS (app/ml/formulas/pcos.py)
- Bethesda System 2014 cytopathology stratification for Cervical Cancer (app/ml/formulas/cervical.py)
- Integration with POST /api/doctor/scans/analyze endpoint
"""
import json
import unittest
import uuid

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.ml.formulas import (
    FactorContribution,
    FormulaResult,
    compute_breast_risk,
    compute_cervical_risk,
    compute_pcos_risk,
)
from app.models.doctor_profile import DoctorProfile
from app.models.enums import UserRole
from app.models.patient_profile import PatientProfile
from app.models.user import User


class TestClinicalFormulas(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Doctor user & profile
        cls.doc_user = cls.db.query(User).filter(User.email == "formula_doc@auramed.test").first()
        if not cls.doc_user:
            cls.doc_user = User(
                email="formula_doc@auramed.test",
                password_hash=hash_password("DoctorPass123!"),
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
                full_name="Dr. Formula Specialist",
                registration_number=f"DOC-FORMULA-{uuid.uuid4().hex[:4].upper()}",
                specialty="Multidisciplinary Oncology",
                hospital="AuraMed Academic Center",
                is_approved=True,
            )
            cls.db.add(cls.doc_profile)
            cls.db.flush()

        # Patient user & profile
        cls.pat_user = cls.db.query(User).filter(User.email == "formula_pat@auramed.test").first()
        if not cls.pat_user:
            cls.pat_user = User(
                email="formula_pat@auramed.test",
                password_hash=hash_password("PatientPass123!"),
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
                patient_code=f"P-FORMULA-{uuid.uuid4().hex[:4].upper()}",
                full_name="Lakshmi Sundaram",
                created_by_doctor_id=cls.doc_profile.id,
            )
            cls.db.add(cls.pat_profile)
            cls.db.flush()

        cls.db.commit()

        cls.token = create_access_token({
            "sub": str(cls.doc_user.id),
            "role": "doctor",
            "type": "access",
            "jti": str(uuid.uuid4()),
        })
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    # =========================================================================
    # 1. BREAST CANCER FORMULA TESTS
    # =========================================================================
    def test_01_breast_baseline_low_risk(self):
        """Young patient with no risk factors produces low risk score."""
        inputs = {
            "age": 25,
            "menopausal_status": "premenopausal",
            "family_history_breast_cancer": "none",
            "palpable_lump": "no",
            "nipple_discharge": "no",
            "skin_changes": "no",
            "previous_biopsy": "no",
            "image_quality": "good",
        }
        res = compute_breast_risk(inputs)
        self.assertIsInstance(res, FormulaResult)
        # Age 25 (0.05) * 1.0 = 0.05
        self.assertEqual(res.formula_score, 0.05)
        self.assertEqual(res.risk_tier, "low")
        self.assertEqual(res.formula_name, "Modified Gail Model (clinical approximation)")
        self.assertEqual(len(res.limitations), 0)
        self.assertIn("Age Bracket", [c.factor_name for c in res.contributions])

    def test_02_breast_high_risk_and_lump_sizes(self):
        """Older patient with first-degree family history, lump > 4cm, and skin changes."""
        # Age 52 (0.25) * first_degree (1.8) = 0.45
        # Palpable lump: +0.20
        # Lump size 4.5cm (>4cm cumulative): +0.10 + 0.20 = +0.30
        # Skin changes: +0.12
        # Previous biopsy: +0.10
        # Postmenopausal: +0.08
        # Total additions = 0.20 + 0.30 + 0.12 + 0.10 + 0.08 = 0.80
        # Raw score = 0.45 + 0.80 = 1.25 -> capped at 1.0, critical tier
        inputs = {
            "age": 52,
            "menopausal_status": "postmenopausal",
            "family_history_breast_cancer": "first_degree",
            "palpable_lump": "yes",
            "lump_size_cm": 4.5,
            "nipple_discharge": "no",
            "skin_changes": "yes",
            "previous_biopsy": "yes",
            "image_quality": "poor",
        }
        res = compute_breast_risk(inputs)
        self.assertEqual(res.formula_score, 1.0)
        self.assertEqual(res.raw_score, 1.25)
        self.assertEqual(res.risk_tier, "critical")
        self.assertIn("Palpable breast lump present", res.criteria_met)
        self.assertIn("Skin changes (dimpling, edema, or retraction)", res.criteria_met)
        # Verifies poor image quality limitation
        self.assertTrue(any("Image quality was poor" in lim for lim in res.limitations))

    def test_03_breast_moderate_risk_tier(self):
        """Patient with moderate score between 0.20 and 0.40."""
        # Age 42 (0.18) * none (1.0) = 0.18
        # Postmenopausal (+0.08) -> raw_score = 0.26 (moderate)
        inputs = {
            "age": 42,
            "menopausal_status": "postmenopausal",
            "family_history_breast_cancer": "none",
            "palpable_lump": "no",
            "nipple_discharge": "no",
            "skin_changes": "no",
            "previous_biopsy": "no",
        }
        res = compute_breast_risk(inputs)
        self.assertEqual(res.formula_score, 0.26)
        self.assertEqual(res.risk_tier, "moderate")
        self.assertIn("Moderate risk tier", res.interpretation)

    # =========================================================================
    # 2. PCOS FORMULA TESTS (Rotterdam 2003)
    # =========================================================================
    def test_04_pcos_unlikely_zero_criteria(self):
        """Regular cycles, normal testosterone, and no morphology results in 0 criteria."""
        inputs = {
            "age": 28,
            "menstrual_cycle_regularity": "regular",
            "cycle_length_days": 28,
            "clinical_symptoms": [],
            "total_testosterone_ng_dl": 28.0,
            "image_criterion_met": False,
            "lh_miu_ml": 4.5,
            "fsh_miu_ml": 4.2,
            "amh_ng_ml": 2.2,
            "prolactin_ng_ml": 14.0,
        }
        res = compute_pcos_risk(inputs)
        self.assertEqual(len(res.criteria_met), 0)
        self.assertEqual(res.formula_score, 0.10)
        self.assertEqual(res.risk_tier, "low")
        self.assertIn("No Rotterdam criteria met", res.interpretation)

    def test_05_pcos_confirmed_two_criteria_and_biomarkers(self):
        """Irregular cycles and hirsutism satisfies 2 criteria + elevated LH/FSH & AMH."""
        # Criterion 1 met: irregular cycle
        # Criterion 2 met: hirsutism and acne
        # Criterion 3: not met
        # Criteria count = 2 -> base_score = 0.75
        # LH/FSH ratio: 12.0 / 4.0 = 3.0 (> 2.0) -> +0.05
        # AMH: 7.8 (> 6.0) -> +0.05
        # Symptoms: hirsutism, acne, weight_gain (3 symptoms) -> +0.03
        # Prolactin: 32.0 (> 25) -> adds limitation
        # Final score = 0.75 + 0.05 + 0.05 + 0.03 = 0.88 -> critical tier
        inputs = {
            "age": 24,
            "menstrual_cycle_regularity": "irregular",
            "cycle_length_days": 42,
            "clinical_symptoms": ["hirsutism", "acne", "weight_gain"],
            "total_testosterone_ng_dl": 62.0,
            "image_criterion_met": False,
            "lh_miu_ml": 12.0,
            "fsh_miu_ml": 4.0,
            "amh_ng_ml": 7.8,
            "prolactin_ng_ml": 32.0,
        }
        res = compute_pcos_risk(inputs)
        self.assertIn("Oligo/Anovulation", res.criteria_met)
        self.assertIn("Hyperandrogenism", res.criteria_met)
        self.assertEqual(res.formula_score, 0.88)
        self.assertEqual(res.risk_tier, "critical")
        self.assertIn("Rotterdam criteria for PCOS are satisfied (2 of 3 criteria met)", res.interpretation)
        self.assertTrue(any("hyperprolactinemia" in lim for lim in res.limitations))

    def test_06_pcos_possible_one_criterion(self):
        """Single criterion met produces borderline possible status."""
        inputs = {
            "age": 29,
            "menstrual_cycle_regularity": "irregular",
            "cycle_length_days": 38,
            "clinical_symptoms": [],
            "total_testosterone_ng_dl": 35.0,
            "image_criterion_met": False,
            "lh_miu_ml": 5.0,
            "fsh_miu_ml": 4.5,
            "amh_ng_ml": 2.5,
            "prolactin_ng_ml": 15.0,
        }
        res = compute_pcos_risk(inputs)
        self.assertEqual(len(res.criteria_met), 1)
        self.assertEqual(res.formula_score, 0.45)
        self.assertEqual(res.risk_tier, "moderate")
        self.assertIn("Only 1 of 3 Rotterdam criteria met", res.interpretation)

    # =========================================================================
    # 3. CERVICAL CANCER FORMULA TESTS (Bethesda 2014)
    # =========================================================================
    def test_07_cervical_normal_nilm(self):
        """Normal cytology and negative HPV produces low risk."""
        inputs = {
            "age": 32,
            "hpv_status": "negative",
            "sample_adequacy": "satisfactory",
            "history_of_abnormal_pap": "no",
            "smoking_status": "never",
            "immunocompromised": "no",
        }
        res = compute_cervical_risk(inputs, cytology_class="Normal")
        self.assertEqual(res.formula_score, 0.05)
        self.assertEqual(res.risk_tier, "low")
        self.assertIn("Routine age-appropriate screening. Next screen in 3 years.", res.interpretation)

    def test_08_cervical_hsil_high_risk_and_modifiers(self):
        """Dyskeratotic (HSIL) with HPV positive, smoking, and age > 45."""
        # Dyskeratotic -> HSIL base: 0.80
        # HPV positive: +0.15
        # History abnormal pap: +0.10
        # Immunocompromised: +0.10
        # Age 48 > 45 with HSIL: +0.05
        # Smoking current: +0.05
        # Total = 0.80 + 0.15 + 0.10 + 0.10 + 0.05 + 0.05 = 1.25 -> capped at 1.0
        inputs = {
            "age": 48,
            "hpv_status": "positive",
            "sample_adequacy": "unsatisfactory",
            "history_of_abnormal_pap": "yes",
            "smoking_status": "current",
            "immunocompromised": "yes",
        }
        res = compute_cervical_risk(inputs, cytology_class="Dyskeratotic")
        self.assertEqual(res.formula_score, 1.0)
        self.assertEqual(res.risk_tier, "critical")
        self.assertIn("Immediate colposcopy and excisional treatment.", res.interpretation)
        self.assertTrue(any("unsatisfactory sample adequacy" in lim for lim in res.limitations))

    def test_09_cervical_asc_us_and_action_recommendation(self):
        """Metaplastic (ASC-US) maps to 0.25 base risk with repeat cytology advice."""
        inputs = {
            "age": 30,
            "hpv_status": "negative",
            "sample_adequacy": "satisfactory",
            "history_of_abnormal_pap": "no",
            "smoking_status": "never",
            "immunocompromised": "no",
        }
        res = compute_cervical_risk(inputs, cytology_class="Metaplastic")
        self.assertEqual(res.formula_score, 0.25)
        self.assertEqual(res.risk_tier, "moderate")
        self.assertIn("Repeat cytology in 12 months or HPV co-test.", res.interpretation)

    # =========================================================================
    # 4. INTEGRATION WITH POST /api/doctor/scans/analyze
    # =========================================================================
    def test_10_analyze_endpoint_returns_formula_result(self):
        """POST /api/doctor/scans/analyze returns real formula_result and mock image_model_score = 0.75."""
        # 1. Create a draft scan for our test patient
        draft_payload = {
            "patient_id": str(self.pat_profile.id),
            "module": "breast",
            "clinical_inputs": {
                "age": 45,
                "menopausal_status": "premenopausal",
                "family_history_breast_cancer": "first_degree",
                "palpable_lump": "yes",
                "lump_size_cm": 2.5,
                "nipple_discharge": "no",
                "skin_changes": "no",
                "previous_biopsy": "no",
                "image_quality": "good",
            },
        }
        draft_res = self.client.post("/api/doctor/scans/draft", json=draft_payload, headers=self.headers)
        self.assertEqual(draft_res.status_code, 201, draft_res.text)
        scan_id = draft_res.json()["scan_id"]

        # 2. Call /analyze
        analyze_res = self.client.post(
            "/api/doctor/scans/analyze",
            data={
                "scan_id": scan_id,
                "clinical_inputs": json.dumps(draft_payload["clinical_inputs"]),
            },
            headers=self.headers,
        )
        self.assertEqual(analyze_res.status_code, 200, analyze_res.text)
        data = analyze_res.json()

        # Check required fields
        self.assertEqual(data["scan_id"], scan_id)
        self.assertEqual(data["status"], "analyzed")
        self.assertIn(data["image_model_score"], [0.75, data["formula_score"]])
        self.assertIsNotNone(data["formula_score"])
        self.assertIn("formula_result", data)

        formula_res = data["formula_result"]
        self.assertIsInstance(formula_res, dict)
        self.assertIn("formula_score", formula_res)
        self.assertIn("formula_name", formula_res)
        self.assertIn("risk_tier", formula_res)
        self.assertIn("contributions", formula_res)
        self.assertIn("clinical_basis", formula_res)
        self.assertIn("interpretation", formula_res)
        self.assertEqual(formula_res["formula_name"], "Modified Gail Model (clinical approximation)")

        # Verify scan record in DB has stored formula_result in reasoning/ai_suggestions
        scan_get = self.client.get(f"/api/doctor/scans/{scan_id}", headers=self.headers)
        self.assertEqual(scan_get.status_code, 200)
        scan_record = scan_get.json()
        self.assertIsNotNone(scan_record.get("formula_result"))


if __name__ == "__main__":
    unittest.main()
