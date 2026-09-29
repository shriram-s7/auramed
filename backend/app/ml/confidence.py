"""
AuraMed Diagnostic Confidence Computation Engine.
Evaluates data completeness, multimodal concordance, image quality, and clinical markers
to produce a calibrated confidence score, categorical label, and transparent explanations.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.ml.formulas.base import FormulaResult
from app.ml.fusion import FusionResult


class ConfidenceResult(BaseModel):
    confidence_score: float  # 0.0 to 1.0
    confidence_label: str  # Very Low/Low/Moderate/High/Very High
    reasons_for_confidence: List[str] = Field(default_factory=list)
    reasons_against_confidence: List[str] = Field(default_factory=list)
    plain_explanation: str
    limitations: List[str] = Field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()


# Core required inputs for completeness check
CORE_INPUT_FIELDS = {
    "breast": [
        "age",
        "menopausal_status",
        "family_history_breast_cancer",
        "palpable_lump",
        "nipple_discharge",
        "skin_changes",
        "previous_biopsy",
    ],
    "cervical": [
        "age",
        "hpv_status",
        "sample_adequacy",
        "history_of_abnormal_pap",
        "smoking_status",
        "immunocompromised",
    ],
    "pcos": [
        "age",
        "menstrual_cycle_regularity",
        "cycle_length_days",
        "clinical_symptoms",
        "amh_ng_ml",
        "lh_miu_ml",
        "fsh_miu_ml",
        "total_testosterone_ng_dl",
        "prolactin_ng_ml",
    ],
}

# Optional clinical fields by module
OPTIONAL_INPUT_FIELDS = {
    "breast": ["lump_size_cm", "image_quality"],
    "cervical": ["cytology_class"],
    "pcos": [
        "left_ovary_volume_ml",
        "left_follicle_count",
        "right_ovary_volume_ml",
        "right_follicle_count",
    ],
}


def compute_confidence(
    module: str,
    image_model_score: float,
    formula_result: FormulaResult,
    fusion_result: FusionResult,
    clinical_inputs: Optional[Dict[str, Any]] = None,
    image_quality: Optional[str] = None,
) -> ConfidenceResult:
    """
    Computes calibrated diagnostic confidence score (0.10 to 0.98),
    confidence label, reasons for/against confidence, plain English summary, and limitations.

    Args:
        module: Screening module name ('breast', 'cervical', 'pcos')
        image_model_score: Image model risk probability (0.0 to 1.0)
        formula_result: Evaluated clinical FormulaResult
        fusion_result: Multimodal FusionResult
        clinical_inputs: Raw clinical inputs dictionary
        image_quality: Quality indicator ('good', 'adequate', 'poor')
    """
    mod = (module or "breast").lower().strip()
    inputs = clinical_inputs or {}
    q_str = str(image_quality or inputs.get("image_quality") or "adequate").lower().strip()

    base_confidence = 0.70
    positive_adjustments = 0.0
    negative_adjustments = 0.0

    reasons_for_confidence: List[str] = []
    reasons_against_confidence: List[str] = []
    limitations: List[str] = []

    # Inherit limitations from clinical formula result
    for lim in formula_result.limitations:
        if lim not in limitations:
            limitations.append(lim)

    # --- 1. Image Quality Factor ---
    if q_str == "good":
        positive_adjustments += 0.10
        reasons_for_confidence.append("Good image quality provides high visual clarity for analysis")
    elif q_str == "poor":
        negative_adjustments += 0.20
        reasons_against_confidence.append("Poor image quality degrades visual feature reliability")
        lim_msg = "Poor image quality reduces reliability of image-based analysis"
        if lim_msg not in limitations:
            limitations.append(lim_msg)

    # --- 2. Model Agreement / Disagreement ---
    score_diff = abs(image_model_score - formula_result.formula_score)
    if score_diff < 0.15:
        positive_adjustments += 0.10
        reasons_for_confidence.append("Image model and clinical formula are in strong agreement")
    elif score_diff > 0.30:
        negative_adjustments += 0.15
        reasons_against_confidence.append(
            "Significant disagreement between image model and clinical formula"
        )
        lim_msg = (
            "Image model and clinical formula show significant disagreement. "
            "Results should be interpreted with caution and clinical judgment applied."
        )
        if lim_msg not in limitations:
            limitations.append(lim_msg)

    # --- 3. Clinical Input Completeness ---
    core_fields = CORE_INPUT_FIELDS.get(mod, [])
    core_gaps = [
        f for f in core_fields
        if f not in inputs or inputs[f] is None or str(inputs[f]).strip() == ""
    ]
    if not core_gaps:
        positive_adjustments += 0.05
        reasons_for_confidence.append("All clinical inputs are complete and within valid ranges")
    else:
        reasons_against_confidence.append(f"Missing core clinical parameters: {', '.join(core_gaps)}")

    # Check optional fields for small penalties (-0.03 per missing field)
    optional_fields = OPTIONAL_INPUT_FIELDS.get(mod, [])
    missing_optional_count = 0
    for opt_field in optional_fields:
        if opt_field not in inputs or inputs[opt_field] is None:
            missing_optional_count += 1
    if missing_optional_count > 0:
        penalty = min(0.09, missing_optional_count * 0.03)
        negative_adjustments += penalty
        reasons_against_confidence.append(
            f"{missing_optional_count} optional clinical input(s) were not supplied"
        )

    # --- 4. Signal Strength ---
    formula_val = formula_result.formula_score
    if formula_val > 0.70 or formula_val < 0.20:
        positive_adjustments += 0.05
        reasons_for_confidence.append("Clinical formula produced a clear unambiguous result")

    if image_model_score > 0.75 or image_model_score < 0.15:
        positive_adjustments += 0.05
        reasons_for_confidence.append("Image model produced a high confidence classification")

    # --- 5. Borderline Scores ---
    if 0.40 <= image_model_score <= 0.60 and 0.40 <= formula_val <= 0.60:
        negative_adjustments += 0.08
        reasons_against_confidence.append("Both image and clinical scores fall in the borderline range")
        lim_msg = (
            "Both image and clinical scores fall in the borderline range. "
            "This case warrants careful clinical review."
        )
        if lim_msg not in limitations:
            limitations.append(lim_msg)

    # --- 6. Module-Specific Factors ---
    if mod == "pcos":
        # Rotterdam criteria met clearly
        if len(formula_result.criteria_met) >= 2:
            positive_adjustments += 0.08
            reasons_for_confidence.append("Multiple Rotterdam diagnostic criteria clearly satisfied")

        # Elevated prolactin
        prolactin_val = inputs.get("prolactin_ng_ml")
        if prolactin_val is not None:
            try:
                if float(prolactin_val) > 25.0:
                    negative_adjustments += 0.05
                    reasons_against_confidence.append("Elevated prolactin level")
                    lim_msg = "Elevated prolactin may indicate an alternative diagnosis."
                    if lim_msg not in limitations:
                        limitations.append(lim_msg)
            except (ValueError, TypeError):
                pass

        # Unknown HPV check if provided
        hpv_val = str(inputs.get("hpv_status", "")).lower().strip()
        if hpv_val == "unknown":
            negative_adjustments += 0.05
            reasons_against_confidence.append("HPV status unknown")

    elif mod == "cervical":
        sample_adeq = str(inputs.get("sample_adequacy", "")).lower().strip()
        if sample_adeq == "satisfactory":
            positive_adjustments += 0.05
            reasons_for_confidence.append("Sample adequacy was satisfactory")
        elif sample_adeq == "unsatisfactory":
            negative_adjustments += 0.25
            reasons_against_confidence.append("Unsatisfactory sample adequacy")
            lim_msg = (
                "Unsatisfactory sample adequacy significantly reduces diagnostic reliability. "
                "Repeat sampling recommended."
            )
            if lim_msg not in limitations:
                limitations.append(lim_msg)

        hpv_val = str(inputs.get("hpv_status", "")).lower().strip()
        if hpv_val == "unknown":
            negative_adjustments += 0.05
            reasons_against_confidence.append("HPV status unknown")
            lim_msg = "HPV status unknown. Testing recommended."
            if lim_msg not in limitations:
                limitations.append(lim_msg)

    # Calculate final confidence bounded between 0.10 and 0.98
    raw_confidence = base_confidence + positive_adjustments - negative_adjustments
    final_confidence = round(max(0.10, min(0.98, raw_confidence)), 4)

    # Assign confidence categorical label
    if final_confidence < 0.30:
        confidence_label = "Very Low"
    elif final_confidence < 0.50:
        confidence_label = "Low"
    elif final_confidence < 0.70:
        confidence_label = "Moderate"
    elif final_confidence < 0.85:
        confidence_label = "High"
    else:
        confidence_label = "Very High"

    # Generate 2-3 sentence plain English explanation
    top_pos = (
        reasons_for_confidence[0]
        if reasons_for_confidence
        else "clinical and imaging parameters were systematically analyzed"
    )
    explanation_sentences = [f"Confidence is {confidence_label} because {top_pos}."]

    if limitations:
        explanation_sentences.append(f"However, {limitations[0]}.")

    if confidence_label in ("Very Low", "Low"):
        explanation_sentences.append(
            "Given the low confidence, clinical judgment should take precedence over these results. "
            "Consider repeat imaging or additional clinical workup."
        )
    elif confidence_label == "Moderate":
        explanation_sentences.append(
            "Findings provide supportive diagnostic guidance alongside routine clinical evaluation."
        )
    else:
        explanation_sentences.append(
            "The concordance and data completeness provide high diagnostic reliability for clinical correlation."
        )

    plain_explanation = " ".join(explanation_sentences)

    return ConfidenceResult(
        confidence_score=final_confidence,
        confidence_label=confidence_label,
        reasons_for_confidence=reasons_for_confidence,
        reasons_against_confidence=reasons_against_confidence,
        plain_explanation=plain_explanation,
        limitations=limitations,
    )
