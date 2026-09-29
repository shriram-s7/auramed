"""
Unit and Integration Test Suite for AuraMed Multimodal Fusion & Confidence Engine.
Tests:
- Fusion computation for Breast, Cervical, and PCOS (app/ml/fusion.py)
- Conservative clinical weighting on score disagreement
- Risk tier assignments across modules
- Diagnostic confidence scoring, categories, limitations, and explanations (app/ml/confidence.py)
- Integration with POST /api/doctor/scans/analyze returning formula_result, fusion_result, confidence_result
"""
import json
import unittest
import uuid

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.ml.confidence import ConfidenceResult, compute_confidence
from app.ml.formulas.base import FactorContribution, FormulaResult
from app.ml.fusion import FusionConfig, FusionResult, compute_fusion
from app.models.doctor_profile import DoctorProfile
from app.models.enums import UserRole
from app.models.patient_profile import PatientProfile
from app.models.user import User


class TestFusionAndConfidence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Doctor user & profile
        cls.doc_user = cls.db.query(User).filter(User.email == "fusion_doc@auramed.test").first()
        if not cls.doc_user:
            cls.doc_user = User(
                email="fusion_doc@auramed.test",
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
                full_name="Dr. Fusion Specialist",
                registration_number=f"DOC-FUSION-{uuid.uuid4().hex[:4].upper()}",
                specialty="Diagnostic Oncology",
                hospital="AuraMed Medical Center",
                is_approved=True,
            )
            cls.db.add(cls.doc_profile)
            cls.db.flush()

        # Patient user & profile
        cls.pat_user = cls.db.query(User).filter(User.email == "fusion_pat@auramed.test").first()
        if not cls.pat_user:
            cls.pat_user = User(
                email="fusion_pat@auramed.test",
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
                patient_code=f"P-FUSION-{uuid.uuid4().hex[:4].upper()}",
                full_name="Priyanka Sharma",
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
    # 1. FUSION ENGINE TESTS
    # =========================================================================
    def test_01_breast_fusion_weights_and_standard_concordance(self):
        """Tests standard Breast fusion (0.60 image, 0.40 formula) when scores agree."""
        formula_res = FormulaResult(
            formula_score=0.70,
            formula_name="Gail Model",
            raw_score=0.70,
            risk_tier="critical",
            interpretation="Elevated risk",
            clinical_basis="Literature",
        )
        fusion = compute_fusion(
            module="breast",
            image_model_score=0.80,
            formula_result=formula_res,
        )
        self.assertFalse(fusion.disagreement_detected)
        self.assertEqual(fusion.image_weight, 0.60)
        self.assertEqual(fusion.formula_weight, 0.40)
        # weighted = (0.80 * 0.60) + (0.70 * 0.40) = 0.48 + 0.28 = 0.76
        self.assertAlmostEqual(fusion.weighted_score, 0.76, places=3)
        self.assertAlmostEqual(fusion.final_score, 0.76, places=3)
        self.assertEqual(fusion.final_risk_level, "critical")

    def test_02_disagreement_detection_image_higher(self):
        """When image > formula by > 0.30, conservative 70/30 weighting applies favoring higher score."""
        formula_res = FormulaResult(
            formula_score=0.20,
            formula_name="Gail Model",
            raw_score=0.20,
            risk_tier="moderate",
            interpretation="Moderate risk",
            clinical_basis="Literature",
        )
        fusion = compute_fusion(
            module="breast",
            image_model_score=0.85,
            formula_result=formula_res,
        )
        self.assertTrue(fusion.disagreement_detected)
        self.assertIn("suspicious findings that are not fully reflected", fusion.disagreement_explanation)
        # higher=0.85 * 0.70 = 0.595, lower=0.20 * 0.30 = 0.06 -> final = 0.655
        self.assertAlmostEqual(fusion.final_score, 0.655, places=3)
        self.assertEqual(fusion.final_risk_level, "critical")

    def test_03_disagreement_detection_formula_higher(self):
        """When formula > image by > 0.30, conservative 70/30 weighting applies favoring higher score."""
        formula_res = FormulaResult(
            formula_score=0.80,
            formula_name="Gail Model",
            raw_score=0.80,
            risk_tier="critical",
            interpretation="High risk",
            clinical_basis="Literature",
        )
        fusion = compute_fusion(
            module="cervical",
            image_model_score=0.30,
            formula_result=formula_res,
        )
        self.assertTrue(fusion.disagreement_detected)
        self.assertIn("clinical risk factors indicate elevated risk", fusion.disagreement_explanation)
        # higher=0.80 * 0.70 = 0.56, lower=0.30 * 0.30 = 0.09 -> final = 0.65
        self.assertAlmostEqual(fusion.final_score, 0.65, places=3)
        self.assertEqual(fusion.final_risk_level, "moderate")

    def test_04_cervical_and_pcos_risk_thresholds(self):
        """Tests Cervical (normal, low, moderate, high, critical) and PCOS (unlikely, possible, likely, confirmed)."""
        # Cervical normal (<0.20)
        cerv_normal = compute_fusion(
            module="cervical",
            image_model_score=0.10,
            formula_result=FormulaResult(
                formula_score=0.10,
                formula_name="Bethesda",
                raw_score=0.10,
                risk_tier="normal",
                interpretation="Normal",
                clinical_basis="Bethesda",
            ),
        )
        self.assertEqual(cerv_normal.final_risk_level, "normal")

        # Cervical critical (>0.80)
        cerv_crit = compute_fusion(
            module="cervical",
            image_model_score=0.90,
            formula_result=FormulaResult(
                formula_score=0.85,
                formula_name="Bethesda",
                raw_score=0.85,
                risk_tier="critical",
                interpretation="HSIL",
                clinical_basis="Bethesda",
            ),
        )
        self.assertEqual(cerv_crit.final_risk_level, "critical")

        # PCOS confirmed (>0.80)
        pcos_conf = compute_fusion(
            module="pcos",
            image_model_score=0.85,
            formula_result=FormulaResult(
                formula_score=0.85,
                formula_name="Rotterdam",
                raw_score=0.85,
                risk_tier="confirmed",
                interpretation="Confirmed",
                clinical_basis="Rotterdam",
            ),
        )
        self.assertEqual(pcos_conf.final_risk_level, "confirmed")

        # PCOS unlikely (<0.30)
        pcos_unlikely = compute_fusion(
            module="pcos",
            image_model_score=0.15,
            formula_result=FormulaResult(
                formula_score=0.10,
                formula_name="Rotterdam",
                raw_score=0.10,
                risk_tier="unlikely",
                interpretation="Unlikely",
                clinical_basis="Rotterdam",
            ),
        )
        self.assertEqual(pcos_unlikely.final_risk_level, "unlikely")

    # =========================================================================
    # 2. CONFIDENCE ENGINE TESTS
    # =========================================================================
    def test_05_confidence_high_concordance_and_good_quality(self):
        """Tests high confidence scoring when image is good and scores agree."""
        formula_res = FormulaResult(
            formula_score=0.80,
            formula_name="Rotterdam",
            raw_score=0.80,
            risk_tier="confirmed",
            criteria_met=["Oligo/Anovulation", "Hyperandrogenism"],
            interpretation="PCOS confirmed",
            clinical_basis="Rotterdam 2003",
        )
        fusion_res = compute_fusion("pcos", 0.78, formula_res)
        clinical_inputs = {
            "age": 26,
            "menstrual_cycle_regularity": "irregular",
            "cycle_length_days": 42,
            "clinical_symptoms": ["acne", "hirsutism"],
            "amh_ng_ml": 7.2,
            "lh_miu_ml": 14.0,
            "fsh_miu_ml": 5.0,
            "total_testosterone_ng_dl": 58.0,
            "prolactin_ng_ml": 14.0,
            "left_ovary_volume_ml": 11.0,
            "left_follicle_count": 14,
            "right_ovary_volume_ml": 12.0,
            "right_follicle_count": 16,
        }
        conf = compute_confidence(
            module="pcos",
            image_model_score=0.78,
            formula_result=formula_res,
            fusion_result=fusion_res,
            clinical_inputs=clinical_inputs,
            image_quality="good",
        )
        self.assertIn(conf.confidence_label, ["High", "Very High"])
        self.assertGreaterEqual(conf.confidence_score, 0.80)
        self.assertIn("Multiple Rotterdam diagnostic criteria clearly satisfied", conf.reasons_for_confidence)
        self.assertIn("Image model and clinical formula are in strong agreement", conf.reasons_for_confidence)
        self.assertTrue(len(conf.plain_explanation) > 20)

    def test_06_confidence_penalties_poor_image_and_disagreement(self):
        """Tests confidence drop and warning messages on poor image quality and score divergence."""
        formula_res = FormulaResult(
            formula_score=0.15,
            formula_name="Gail Model",
            raw_score=0.15,
            risk_tier="low",
            interpretation="Low risk",
            clinical_basis="Gail et al.",
            limitations=["Image quality was poor"],
        )
        fusion_res = compute_fusion("breast", 0.85, formula_res)
        clinical_inputs = {
            "age": 45,
            "menopausal_status": "premenopausal",
            "family_history_breast_cancer": "none",
            "palpable_lump": "no",
            "nipple_discharge": "no",
            "skin_changes": "no",
            "previous_biopsy": "no",
        }
        conf = compute_confidence(
            module="breast",
            image_model_score=0.85,
            formula_result=formula_res,
            fusion_result=fusion_res,
            clinical_inputs=clinical_inputs,
            image_quality="poor",
        )
        self.assertIn(conf.confidence_label, ["Low", "Very Low", "Moderate"])
        self.assertTrue(any("Poor image quality" in r for r in conf.reasons_against_confidence))
        self.assertTrue(any("disagreement" in r.lower() for r in conf.reasons_against_confidence))
        self.assertTrue(len(conf.limitations) > 0)
        self.assertIn("clinical judgment should take precedence", conf.plain_explanation.lower())

    def test_07_cervical_unsatisfactory_sample_penalty(self):
        """Unsatisfactory cervical sample imposes a major diagnostic penalty (-0.25)."""
        formula_res = FormulaResult(
            formula_score=0.40,
            formula_name="Bethesda",
            raw_score=0.40,
            risk_tier="moderate",
            interpretation="LSIL",
            clinical_basis="Bethesda",
        )
        fusion_res = compute_fusion("cervical", 0.45, formula_res)
        clinical_inputs = {
            "age": 35,
            "hpv_status": "positive",
            "sample_adequacy": "unsatisfactory",
            "history_of_abnormal_pap": "no",
            "smoking_status": "never",
            "immunocompromised": "no",
        }
        conf = compute_confidence(
            module="cervical",
            image_model_score=0.45,
            formula_result=formula_res,
            fusion_result=fusion_res,
            clinical_inputs=clinical_inputs,
            image_quality="adequate",
        )
        self.assertTrue(any("Unsatisfactory sample" in r for r in conf.reasons_against_confidence))
        self.assertTrue(any("unsatisfactory sample adequacy" in lim.lower() for lim in conf.limitations))

    # =========================================================================
    # 3. INTEGRATION WITH POST /api/doctor/scans/analyze
    # =========================================================================
    def test_08_analyze_endpoint_full_response_structure(self):
        """Verifies /analyze returns complete formula_result, fusion_result, confidence_result, and followup days."""
        # 1. Create draft scan
        draft_payload = {
            "patient_id": str(self.pat_profile.id),
            "module": "breast",
            "clinical_inputs": {
                "age": 52,
                "menopausal_status": "postmenopausal",
                "family_history_breast_cancer": "first_degree",
                "palpable_lump": "yes",
                "lump_size_cm": 3.2,
                "nipple_discharge": "yes",
                "skin_changes": "yes",
                "previous_biopsy": "yes",
                "image_quality": "good",
            },
        }
        draft_resp = self.client.post("/api/doctor/scans/draft", json=draft_payload, headers=self.headers)
        self.assertEqual(draft_resp.status_code, 201)
        scan_id = draft_resp.json()["scan_id"]

        # 2. Run /analyze
        analyze_resp = self.client.post(
            "/api/doctor/scans/analyze",
            data={
                "scan_id": scan_id,
                "clinical_inputs": json.dumps(draft_payload["clinical_inputs"]),
                "image_quality": "good",
            },
            headers=self.headers,
        )
        self.assertEqual(analyze_resp.status_code, 200, analyze_resp.text)
        data = analyze_resp.json()

        # Check top-level fields
        self.assertEqual(data["scan_id"], scan_id)
        self.assertEqual(data["module"], "breast")
        self.assertEqual(data["status"], "analyzed")
        self.assertIn(data["image_model_score"], [0.75, data["formula_score"]])
        self.assertIsNotNone(data["formula_score"])
        self.assertIsNotNone(data["fusion_score"])
        self.assertIsNotNone(data["risk_level"])
        self.assertIsNotNone(data["confidence_score"])
        self.assertIn("confidence_explanation", data)
        self.assertIn("reasoning", data)

        # Check formula_result
        self.assertIn("formula_result", data)
        f_res = data["formula_result"]
        self.assertEqual(f_res["formula_name"], "Modified Gail Model (clinical approximation)")
        self.assertIsInstance(f_res["contributions"], list)
        self.assertGreater(len(f_res["contributions"]), 0)

        # Check fusion_result
        self.assertIn("fusion_result", data)
        fus_res = data["fusion_result"]
        self.assertIn(fus_res["image_score"], [0.75, data["formula_score"]])
        self.assertIn("formula_score", fus_res)
        self.assertIn("image_weight", fus_res)
        self.assertIn("formula_weight", fus_res)
        self.assertIn("final_score", fus_res)
        self.assertIn("final_risk_level", fus_res)
        self.assertIn("disagreement_detected", fus_res)

        # Check confidence_result
        self.assertIn("confidence_result", data)
        c_res = data["confidence_result"]
        self.assertIn("confidence_score", c_res)
        self.assertIn("confidence_label", c_res)
        self.assertIn("reasons_for_confidence", c_res)
        self.assertIn("reasons_against_confidence", c_res)
        self.assertIn("plain_explanation", c_res)
        self.assertIn("limitations", c_res)

        # Check followup days and actions
        # For critical cases, recommended followup is 7 days
        self.assertIn(data["recommended_followup_days"], [7, 30])
        self.assertIsInstance(data["recommended_actions"], list)
        self.assertGreater(len(data["recommended_actions"]), 0)

        # 3. Verify GET /api/doctor/scans/{scan_id} includes fusion_result and confidence_result
        get_resp = self.client.get(f"/api/doctor/scans/{scan_id}", headers=self.headers)
        self.assertEqual(get_resp.status_code, 200)
        scan_detail = get_resp.json()
        self.assertIsNotNone(scan_detail.get("fusion_result"))
        self.assertIsNotNone(scan_detail.get("confidence_result"))
        self.assertIn(scan_detail["fusion_result"]["image_score"], [0.75, data["formula_score"]])


if __name__ == "__main__":
    unittest.main()
