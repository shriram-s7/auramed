"""
Unit and Integration Test Suite for AuraMed Pretrained Deep Learning Models.
Tests:
- Breast Cancer ResNet-50, IQA heuristics, and Grad-CAM explainability (app/ml/models/breast_model.py)
- Cervical Cytology ViT-Base, 5-class distribution, and Bethesda mapping (app/ml/models/cervical_model.py)
- PCOS Ultrasound Custom ResNet-50, Rotterdam image criterion, and Grad-CAM (app/ml/models/pcos_model.py)
- Singleton ModelLoader lifecycle, error isolation, and status monitoring (app/ml/models/model_loader.py)
- End-to-end integration with POST /api/doctor/scans/analyze returning real model scores and Grad-CAM
- Graceful degradation when model/image is unavailable
"""
import base64
import io
import json
import os
import unittest
import uuid

import numpy as np
import torch
from fastapi.testclient import TestClient
from PIL import Image

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.ml.models.breast_model import (
    BreastCancerModel,
    assess_image_quality,
    load_breast_model,
    run_breast_inference,
)
from app.ml.models.cervical_model import (
    CLASS_NAMES as CERVICAL_CLASSES,
    BETHESDA_MAP,
    BETHESDA_RISK_WEIGHTS,
    load_cervical_model,
    run_cervical_inference,
)
from app.ml.models.model_loader import ModelLoader
from app.ml.models.pcos_model import (
    PCOSVisionModel,
    load_pcos_model,
    run_pcos_inference,
)
from app.models.doctor_profile import DoctorProfile
from app.models.enums import UserRole
from app.models.patient_profile import PatientProfile
from app.models.user import User


class TestVisionModels(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Doctor user & profile
        cls.doc_user = cls.db.query(User).filter(User.email == "vision_doc@auramed.test").first()
        if not cls.doc_user:
            cls.doc_user = User(
                email="vision_doc@auramed.test",
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
                full_name="Dr. Deep Learning",
                registration_number=f"DOC-VISION-{uuid.uuid4().hex[:4].upper()}",
                specialty="Radiology and Pathology",
                hospital="AuraMed Imaging Institute",
                is_approved=True,
            )
            cls.db.add(cls.doc_profile)
            cls.db.flush()

        # Patient profile
        cls.pat_user = cls.db.query(User).filter(User.email == "vision_pat@auramed.test").first()
        if not cls.pat_user:
            cls.pat_user = User(
                email="vision_pat@auramed.test",
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
                patient_code=f"P-VISION-{uuid.uuid4().hex[:4].upper()}",
                full_name="Devi Priya",
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

        # Create temporary synthetic test images
        cls.test_dir = os.path.join(os.getcwd(), "tests", "scratch_images")
        os.makedirs(cls.test_dir, exist_ok=True)

        # 1. Normal/Good synthetic image (224x224 grayscale pattern)
        cls.good_img_path = os.path.join(cls.test_dir, "good_scan.png")
        good_arr = np.random.randint(60, 180, (250, 250, 3), dtype=np.uint8)
        Image.fromarray(good_arr).save(cls.good_img_path)

        # 2. Poor/Dark image (too dark)
        cls.poor_dark_path = os.path.join(cls.test_dir, "poor_dark.png")
        dark_arr = np.zeros((150, 150, 3), dtype=np.uint8)
        Image.fromarray(dark_arr).save(cls.poor_dark_path)

        # Initialize model loader
        cls.loader = ModelLoader.get_instance()
        cls.loader.load_all_models()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()
        # Clean up synthetic test images
        try:
            for f in os.listdir(cls.test_dir):
                os.remove(os.path.join(cls.test_dir, f))
            os.rmdir(cls.test_dir)
        except Exception:
            pass

    # =========================================================================
    # 1. MODEL LOADER SINGLETON TESTS
    # =========================================================================
    def test_01_model_loader_singleton_and_status(self):
        """Verifies singleton instance identity and status reporting."""
        l1 = ModelLoader.get_instance()
        l2 = ModelLoader.get_instance()
        self.assertIs(l1, l2)

        status = l1.get_model_status()
        self.assertIn("breast", status)
        self.assertIn("cervical", status)
        self.assertIn("pcos", status)
        self.assertIn(status["breast"], ["loaded", "not_loaded"])

    # =========================================================================
    # 2. BREAST MODEL & GRAD-CAM TESTS
    # =========================================================================
    def test_02_breast_inference_and_gradcam(self):
        """Runs ResNet-50 breast inference and validates Grad-CAM base64 JPEG encoding."""
        model = self.loader.breast_model
        self.assertIsNotNone(model)

        result = run_breast_inference(model, self.good_img_path)
        self.assertIn("image_score", result)
        self.assertGreaterEqual(result["image_score"], 0.0)
        self.assertLessEqual(result["image_score"], 1.0)
        self.assertEqual(result["image_quality"], "good")

        # Verify Grad-CAM base64 string
        self.assertIn("grad_cam_base64", result)
        self.assertTrue(len(result["grad_cam_base64"]) > 100)
        # Verify valid base64
        decoded = base64.b64decode(result["grad_cam_base64"])
        self.assertTrue(len(decoded) > 0)

        # Verify key findings and interpretation
        self.assertIsInstance(result["key_findings"], list)
        self.assertGreater(len(result["key_findings"]), 0)
        self.assertIsInstance(result["model_interpretation"], str)

    def test_03_breast_image_quality_assessment(self):
        """Tests image quality assessment heuristics for dark or undersized images."""
        dark_img = Image.open(self.poor_dark_path)
        self.assertEqual(assess_image_quality(dark_img), "poor")

        good_img = Image.open(self.good_img_path)
        self.assertEqual(assess_image_quality(good_img), "good")

    # =========================================================================
    # 3. CERVICAL MODEL TESTS
    # =========================================================================
    def test_04_cervical_vit_inference_and_bethesda_mapping(self):
        """Verifies ViT-Base 5-class probability distribution and Bethesda classification."""
        model = self.loader.cervical_model
        self.assertIsNotNone(model)

        result = run_cervical_inference(model, self.good_img_path)
        self.assertIn(result["predicted_class"], CERVICAL_CLASSES)
        self.assertGreaterEqual(result["confidence"], 0.0)
        self.assertLessEqual(result["confidence"], 1.0)

        # Check all class probabilities
        probs = result["all_class_probabilities"]
        self.assertEqual(len(probs), 5)
        total_p = sum(probs.values())
        self.assertAlmostEqual(total_p, 1.0, delta=0.05)

        # Check Bethesda mapping
        self.assertIn(result["bethesda_mapping"], BETHESDA_MAP.values())

        # image_score must be the severity-weighted, risk-directional score -
        # NOT the raw top-class confidence. A confident Normal prediction
        # must NOT produce a high image_score.
        expected_score = round(
            sum(probs[CERVICAL_CLASSES[i]] * BETHESDA_RISK_WEIGHTS[i] for i in range(5)), 4
        )
        self.assertAlmostEqual(result["image_score"], expected_score, places=3)
        self.assertGreaterEqual(result["image_score"], 0.0)
        self.assertLessEqual(result["image_score"], 1.0)
        self.assertIn(result["predicted_class"], result["finding_description"])

    def test_04b_cervical_confident_normal_yields_low_risk_score(self):
        """
        Regression test for the image_score inversion bug: a high-confidence
        Normal (NILM) prediction must produce a LOW risk-directional
        image_score, not a high one equal to the raw confidence.
        """
        pure_normal_probs = [0.0, 0.0, 0.0, 0.0, 1.0]
        weighted = sum(p * w for p, w in zip(pure_normal_probs, BETHESDA_RISK_WEIGHTS))
        self.assertEqual(weighted, 0.0)

        confident_normal_probs = [0.02, 0.02, 0.02, 0.02, 0.92]
        weighted_confident_normal = sum(p * w for p, w in zip(confident_normal_probs, BETHESDA_RISK_WEIGHTS))
        self.assertLess(weighted_confident_normal, 0.15)

        confident_hsil_probs = [0.92, 0.02, 0.02, 0.02, 0.02]
        weighted_confident_hsil = sum(p * w for p, w in zip(confident_hsil_probs, BETHESDA_RISK_WEIGHTS))
        self.assertGreater(weighted_confident_hsil, 0.8)

    # =========================================================================
    # 4. PCOS MODEL & CRITERIA TESTS
    # =========================================================================
    def test_05_pcos_model_inference_and_morphology_criterion(self):
        """Verifies PCOS binary classification, Grad-CAM, and Rotterdam image criterion."""
        model = self.loader.pcos_model
        self.assertIsNotNone(model)

        result = run_pcos_inference(model, self.good_img_path)
        self.assertIn(result["predicted_class"], ["Healthy", "PCOS"])
        self.assertIn("pcos_probability", result)
        self.assertIn("healthy_probability", result)
        self.assertAlmostEqual(result["pcos_probability"] + result["healthy_probability"], 1.0, delta=0.05)
        self.assertIsInstance(result["image_criterion_met"], bool)

        # Verify Grad-CAM
        self.assertIn("grad_cam_base64", result)
        self.assertTrue(len(result["grad_cam_base64"]) > 100)

    def test_06_pcos_model_prefix_stripping(self):
        """Verifies state_dict key stripping for 'network.' prefixes."""
        # Create a mock state dict with 'network.' prefix
        base_model = PCOSVisionModel()
        original_keys = list(base_model.state_dict().keys())
        mock_state = {f"network.{k}": v.clone() for k, v in base_model.state_dict().items()}

        # Save to temporary path and test load_pcos_model
        tmp_weights = os.path.join(self.test_dir, "mock_pcos.pth")
        torch.save(mock_state, tmp_weights)

        loaded_model = load_pcos_model(tmp_weights)
        self.assertIsNotNone(loaded_model)
        # Verify inference succeeds
        inp = torch.randn(1, 3, 224, 224)
        with torch.no_grad():
            out = loaded_model(inp)
        self.assertEqual(out.shape, (1, 2))

    # =========================================================================
    # 5. INTEGRATION VIA POST /api/doctor/scans/analyze
    # =========================================================================
    def test_07_analyze_endpoint_executes_real_model_and_returns_gradcam(self):
        """End-to-end test: uploads scan image and calls /analyze, verifying real model output."""
        # 1. Upload scan image
        with open(self.good_img_path, "rb") as f:
            upload_resp = self.client.post(
                "/api/doctor/scans/upload",
                headers=self.headers,
                data={"patient_id": str(self.pat_profile.id), "module": "breast"},
                files={"file": ("mammogram_test.png", f.read(), "image/png")},
            )
        self.assertEqual(upload_resp.status_code, 201)
        scan_id = upload_resp.json()["scan_id"]

        # 2. Call /analyze with clinical inputs
        clinical_inputs = {
            "age": 49,
            "menopausal_status": "premenopausal",
            "family_history_breast_cancer": "none",
            "palpable_lump": "no",
            "nipple_discharge": "no",
            "skin_changes": "no",
            "previous_biopsy": "no",
        }
        analyze_resp = self.client.post(
            "/api/doctor/scans/analyze",
            headers=self.headers,
            data={
                "scan_id": scan_id,
                "clinical_inputs": json.dumps(clinical_inputs),
            },
        )
        self.assertEqual(analyze_resp.status_code, 200, analyze_resp.text)
        data = analyze_resp.json()

        # Verify real image_model_score is returned (not hardcoded 0.75)
        self.assertIn("image_model_score", data)
        self.assertIsNotNone(data["image_model_score"])
        self.assertGreaterEqual(data["image_model_score"], 0.0)
        self.assertLessEqual(data["image_model_score"], 1.0)

        # Verify Grad-CAM base64 is returned in response
        self.assertIn("grad_cam_base64", data)
        self.assertIsNotNone(data["grad_cam_base64"])
        self.assertTrue(len(data["grad_cam_base64"]) > 50)

        # Verify fusion and confidence incorporated the real image model score
        self.assertEqual(data["fusion_result"]["image_score"], data["image_model_score"])
        self.assertIsNotNone(data["confidence_result"])

        # 3. Verify GET /api/doctor/scans/{scan_id} includes grad_cam_base64
        get_resp = self.client.get(f"/api/doctor/scans/{scan_id}", headers=self.headers)
        self.assertEqual(get_resp.status_code, 200)
        detail = get_resp.json()
        self.assertIsNotNone(detail.get("grad_cam_base64"))

    def test_08_analyze_graceful_degradation_when_no_image(self):
        """When a scan has no physical image attached, falls back to formula proxy and sets limitation note."""
        # Create draft without physical image
        draft_payload = {
            "patient_id": str(self.pat_profile.id),
            "module": "breast",
            "clinical_inputs": {
                "age": 42,
                "menopausal_status": "premenopausal",
                "family_history_breast_cancer": "none",
                "palpable_lump": "no",
                "nipple_discharge": "no",
                "skin_changes": "no",
                "previous_biopsy": "no",
            },
        }
        draft_resp = self.client.post("/api/doctor/scans/draft", json=draft_payload, headers=self.headers)
        self.assertEqual(draft_resp.status_code, 201)
        scan_id = draft_resp.json()["scan_id"]

        analyze_resp = self.client.post(
            "/api/doctor/scans/analyze",
            headers=self.headers,
            data={
                "scan_id": scan_id,
                "clinical_inputs": json.dumps(draft_payload["clinical_inputs"]),
            },
        )
        self.assertEqual(analyze_resp.status_code, 200)
        data = analyze_resp.json()

        # When image unavailable, image_model_score equals formula_score proxy
        self.assertAlmostEqual(data["image_model_score"], data["formula_score"], delta=0.001)
        # Limitations note is appended
        limitations = data["formula_result"]["limitations"]
        self.assertTrue(any("Image model temporarily unavailable" in lim for lim in limitations))

    # =========================================================================
    # 5. GRAD-CAM HEATMAP OUTPUT (NO PEAK-ATTENTION COORDINATE)
    # =========================================================================
    def test_09_gradcam_extras_produce_heatmap_without_attention_peak(self):
        """
        attention_peak was removed from the pipeline entirely: the coordinate
        mapping between model input space (224x224) and display space was
        unreliable, and a wrong point on a clinical image is worse than none.
        build_gradcam_extras must still produce a valid 224x224 heatmap, but
        must NOT compute or return any peak-attention coordinate.
        """
        from app.ml.models.gradcam_utils import build_gradcam_extras

        raw = np.zeros((7, 7), dtype=np.float32)
        raw[1, 5] = 1.0
        result = build_gradcam_extras(raw, module_name="test")

        self.assertIn("gradcam_heatmap_b64", result)
        self.assertGreater(len(result["gradcam_heatmap_b64"]), 100)
        self.assertNotIn("attention_peak", result)


if __name__ == "__main__":
    unittest.main()
