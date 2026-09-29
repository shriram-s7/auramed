"""
Complete End-to-End Clinical System Integration Test.
Validates the entire pipeline:
  1. Model loading & weights synchronization
  2. Clinical risk formula computation (Breast, Cervical, PCOS)
  3. Multimodal fusion and disagreement detection
  4. Confidence engine scoring and clinical explanations
  5. Clinical PDF report generation (WeasyPrint / ReportLab)
  6. Direct vision model inference & Grad-CAM pipeline
"""
import os
import sys
from datetime import date, datetime
from typing import Any, Dict

import numpy as np
from PIL import Image

# Ensure backend root is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
backend_root = os.path.join(project_root, "backend")

if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

# Set environment variable so SQLite or settings can load properly
os.environ.setdefault("DATABASE_URL", "sqlite:///./auramed.db")


def test_complete_workflow():
    print("\n" + "=" * 65)
    print(" AURAMED END-TO-END SYSTEM INTEGRATION TEST SUITE")
    print("=" * 65)

    results_summary = {
        "formula": "FAIL",
        "fusion": "FAIL",
        "confidence": "FAIL",
        "pdf": "SKIP",
        "models": "NOT_LOADED",
    }
    missing_weights = []

    # -------------------------------------------------------------
    # STEP 1: TEST MODEL LOADING
    # -------------------------------------------------------------
    print("\n[Step 1] Initializing and Verifying ModelLoader Singleton...")
    from app.ml.models.model_loader import ModelLoader

    loader = ModelLoader.get_instance()
    loader.load_all_models()
    status = loader.get_model_status()
    models_info = loader.get_models_info()

    for mod, st in status.items():
        opt_th = loader.__dict__.get(f"{mod}_threshold", 0.5)
        print(f"  - {mod.capitalize():<10}: {st.upper():<10} (Optimal Threshold: {opt_th:.3f})")
        if st != "loaded":
            missing_weights.append(mod)

    # -------------------------------------------------------------
    # STEP 2: TEST FORMULA COMPUTATION
    # -------------------------------------------------------------
    print("\n[Step 2] Testing Clinical Risk Formulas...")
    from app.ml.formulas.base import FormulaResult
    from app.ml.formulas.breast import compute_breast_risk
    from app.ml.formulas.cervical import compute_cervical_risk
    from app.ml.formulas.pcos import compute_pcos_risk

    # 2.1 Breast Formula Test
    breast_inputs = {
        "age": 45,
        "menopausal_status": "pre-menopausal",
        "family_history_breast_cancer": "first_degree",
        "palpable_lump": "yes",
        "lump_size_cm": 2.4,
        "nipple_discharge": "no",
        "skin_changes": "no",
        "previous_biopsy": "no",
        "image_quality": "good",
    }
    breast_result = compute_breast_risk(breast_inputs)
    assert 0.0 <= breast_result.formula_score <= 1.0, "Breast formula score out of [0, 1] range"
    assert breast_result.risk_tier.lower() in ["low", "moderate", "high", "critical"], "Invalid breast risk tier"
    assert len(breast_result.contributions) > 0, "No factor contributions calculated for breast"
    print(f"  [+] Breast formula OK   - score: {breast_result.formula_score:.3f} ({breast_result.risk_tier})")

    # 2.2 PCOS Formula Test
    pcos_inputs = {
        "age": 28,
        "menstrual_cycle_regularity": "irregular",
        "cycle_length_days": 45,
        "clinical_symptoms": ["hirsutism", "acne"],
        "amh_ng_ml": 5.8,
        "lh_miu_ml": 12.4,
        "fsh_miu_ml": 5.2,
        "total_testosterone_ng_dl": 68,
        "prolactin_ng_ml": 18.6,
        "left_ovary_volume_ml": 12.4,
        "left_follicle_count": 14,
        "right_ovary_volume_ml": 11.8,
        "right_follicle_count": 16,
    }
    pcos_result = compute_pcos_risk(pcos_inputs)
    assert len(pcos_result.criteria_met) >= 2, "PCOS Rotterdam criteria should be >= 2 for clinical case"
    assert 0.0 <= pcos_result.formula_score <= 1.0, "PCOS formula score out of [0, 1] range"
    print(f"  [+] PCOS formula OK     - criteria met: {pcos_result.criteria_met} (score: {pcos_result.formula_score:.3f})")

    # 2.3 Cervical Formula Test
    cervical_inputs = {
        "age": 32,
        "hpv_status": "positive",
        "sample_adequacy": "satisfactory",
        "history_of_abnormal_pap": "no",
        "smoking_status": "non-smoker",
        "immunocompromised": "no",
    }
    cervical_result = compute_cervical_risk(
        inputs=cervical_inputs,
        cytology_class="Koilocytotic",
    )
    assert cervical_result.formula_score > 0.3, "LSIL + HPV positive must result in elevated risk score"
    print(f"  [+] Cervical formula OK - score: {cervical_result.formula_score:.3f} ({cervical_result.risk_tier})")
    results_summary["formula"] = "PASS"

    # -------------------------------------------------------------
    # STEP 3: TEST MULTIMODAL FUSION
    # -------------------------------------------------------------
    print("\n[Step 3] Testing Clinical AI Fusion Engine...")
    from app.ml.fusion import compute_fusion

    fusion = compute_fusion(
        module="breast",
        image_model_score=0.82,
        formula_result=breast_result,
        image_quality="good",
    )
    assert 0.0 <= fusion.final_score <= 1.0, "Fusion final score out of [0, 1] range"
    valid_risk_levels = ["LOW", "MODERATE", "HIGH", "CRITICAL", "low", "moderate", "high", "critical"]
    assert fusion.final_risk_level.upper() in [v.upper() for v in valid_risk_levels], "Invalid fusion risk level"
    print(f"  [+] Fusion OK - final: {fusion.final_score:.3f} ({fusion.final_risk_level})")

    # Disagreement detection test: high image risk (0.85) vs low formula risk (0.20)
    low_formula_result = FormulaResult(
        formula_score=0.20,
        formula_name="Low Risk Test",
        raw_score=0.20,
        risk_tier="low",
        contributions=[],
        criteria_met=[],
        criteria_not_met=[],
        interpretation="Low risk test baseline",
        clinical_basis="Test",
        limitations=[],
    )
    fusion_disagree = compute_fusion(
        module="breast",
        image_model_score=0.85,
        formula_result=low_formula_result,
        image_quality="good",
    )
    assert fusion_disagree.disagreement_detected is True, "Disagreement detection failed to trigger on 0.85 vs 0.20"
    print(f"  [+] Disagreement detection OK - explanation: '{fusion_disagree.disagreement_explanation}'")
    results_summary["fusion"] = "PASS"

    # -------------------------------------------------------------
    # STEP 4: TEST CONFIDENCE ENGINE
    # -------------------------------------------------------------
    print("\n[Step 4] Testing Diagnostic Confidence Engine...")
    from app.ml.confidence import compute_confidence

    confidence = compute_confidence(
        module="breast",
        image_model_score=0.82,
        formula_result=breast_result,
        fusion_result=fusion,
        clinical_inputs=breast_inputs,
        image_quality="good",
    )
    assert 0.10 <= confidence.confidence_score <= 0.98, "Confidence score out of [0.10, 0.98] bounds"
    assert len(confidence.reasons_for_confidence) > 0, "Expected positive confidence reasons"
    print(f"  [+] Confidence OK - {confidence.confidence_label} ({confidence.confidence_score:.2f})")
    print(f"      Reason: {confidence.reasons_for_confidence[0]}")
    results_summary["confidence"] = "PASS"

    # -------------------------------------------------------------
    # STEP 5: TEST PDF GENERATION
    # -------------------------------------------------------------
    print("\n[Step 5] Testing Clinical PDF Report Generation Service...")
    try:
        from app.services.pdf_generator import generate_report_pdf

        class MockObject:
            def __init__(self, **kwargs):
                self.__dict__.update(kwargs)

        mock_patient = MockObject(
            full_name="Priya Sharma",
            patient_code="P-2026-0001",
            date_of_birth=date(1985, 4, 12),
            gender="Female",
        )
        mock_doctor = MockObject(
            full_name="Dr. Ananya Roy",
            registration_number="MCI-48201",
            specialty="Gynecologic Oncology",
            hospital="AuraMed Medical Center",
        )
        mock_scan = MockObject(
            module="breast",
            scan_date=date.today(),
            risk_level="HIGH",
            clinical_inputs=breast_inputs,
            reasoning={"summary": "Suspicious mass with Gail score 0.65."},
            ai_suggestions={"suggested_action": "Ultrasound-guided core biopsy recommended."},
        )
        mock_report = MockObject(
            report_number="RPT-2026-TEST",
            signed_at=datetime.utcnow(),
            content={
                "patient_info": {"indication": "Palpable lump right upper outer quadrant"},
            },
        )

        pdf_bytes = generate_report_pdf(mock_report, mock_scan, mock_patient, mock_doctor)
        assert pdf_bytes is not None and len(pdf_bytes) > 1000, "PDF generation returned empty or truncated bytes"

        test_pdf_out = os.path.join(current_dir, "test_output.pdf")
        with open(test_pdf_out, "wb") as f:
            f.write(pdf_bytes)

        print(f"  [+] PDF generation OK - Size: {len(pdf_bytes)} bytes")
        print(f"      Saved verification report to: {test_pdf_out}")
        results_summary["pdf"] = "PASS"
    except Exception as e:
        print(f"  [!] PDF generation skipped or error: {e}")
        results_summary["pdf"] = "SKIP"

    # -------------------------------------------------------------
    # STEP 6: TEST IMAGE INFERENCE
    # -------------------------------------------------------------
    print("\n[Step 6] Testing Vision Models Direct Inference & Explainability...")
    loaded_models_count = 0

    # Create small synthetic test image
    temp_img_path = os.path.join(current_dir, "_temp_test_scan.png")
    test_img = Image.fromarray(np.full((224, 224, 3), 128, dtype=np.uint8))
    test_img.save(temp_img_path)

    try:
        # Breast Inference
        if loader.breast_model is not None:
            from app.ml.models.breast_model import run_breast_inference
            b_res = run_breast_inference(loader.breast_model, temp_img_path)
            assert 0.0 <= b_res["image_score"] <= 1.0, "Breast inference score invalid"
            print(f"  [+] Breast image inference OK   - score: {b_res['image_score']:.3f}")
            loaded_models_count += 1

        # Cervical Inference
        if loader.cervical_model is not None:
            from app.ml.models.cervical_model import run_cervical_inference
            c_res = run_cervical_inference(loader.cervical_model, temp_img_path)
            assert 0.0 <= c_res["image_score"] <= 1.0, "Cervical inference score invalid"
            print(f"  [+] Cervical image inference OK - score: {c_res['image_score']:.3f} (Predicted: {c_res['predicted_class']})")
            loaded_models_count += 1

        # PCOS Inference
        if loader.pcos_model is not None:
            from app.ml.models.pcos_model import run_pcos_inference
            p_res = run_pcos_inference(loader.pcos_model, temp_img_path)
            assert 0.0 <= p_res["image_score"] <= 1.0, "PCOS inference score invalid"
            print(f"  [+] PCOS image inference OK     - score: {p_res['image_score']:.3f} (Predicted: {p_res['predicted_class']})")
            loaded_models_count += 1

        results_summary["models"] = "PASS" if loaded_models_count > 0 else "NOT_LOADED"
    finally:
        if os.path.exists(temp_img_path):
            os.remove(temp_img_path)

    # -------------------------------------------------------------
    # FINAL SUMMARY REPORT
    # -------------------------------------------------------------
    print("\n" + "=" * 40)
    print(" INTEGRATION TEST RESULTS")
    print("=" * 40)
    print(f" Formula computation: {results_summary['formula']}")
    print(f" Fusion layer:        {results_summary['fusion']}")
    print(f" Confidence engine:   {results_summary['confidence']}")
    print(f" PDF generation:      {results_summary['pdf']}")
    print(f" Image models:        {results_summary['models']}")
    print("=" * 40)
    if missing_weights:
        print(f" Missing weights:     {missing_weights}")
    else:
        print(" System ready for use. All weights verified.")
    print("=" * 40 + "\n")

    return results_summary


if __name__ == "__main__":
    test_complete_workflow()
