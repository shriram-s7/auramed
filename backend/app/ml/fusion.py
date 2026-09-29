"""
AuraMed Clinical AI Fusion Engine.
Combines image model scores and clinical formula outputs into a unified,
calibrated multimodal score with disagreement detection and conservative clinical risk logic.
"""
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

from app.ml.formulas.base import FormulaResult


class FusionConfig(BaseModel):
    breast_image_weight: float = 0.60
    breast_formula_weight: float = 0.40
    cervical_image_weight: float = 0.55
    cervical_formula_weight: float = 0.45
    pcos_image_weight: float = 0.50
    pcos_formula_weight: float = 0.50


class FusionResult(BaseModel):
    image_score: float
    formula_score: float
    image_weight: float
    formula_weight: float
    weighted_score: float
    final_risk_level: str
    disagreement_detected: bool
    disagreement_explanation: str
    final_score: float

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()


def compute_fusion(
    module: str,
    image_model_score: float,
    formula_result: FormulaResult,
    image_quality: Optional[str] = None,
    config: FusionConfig = FusionConfig(),
) -> FusionResult:
    """
    Computes multimodal risk fusion for Breast, Cervical, and PCOS modules.

    Args:
        module: Screening module name ('breast', 'cervical', 'pcos')
        image_model_score: Normalized image model output score (0.0 to 1.0)
        formula_result: Completed FormulaResult from the clinical formula computation layer
        image_quality: Assessment of image quality ('good', 'adequate', 'poor')
        config: Module-specific weight configurations

    Returns:
        FusionResult with weighted scores, disagreement flags, and final risk tiers.
    """
    mod = (module or "breast").lower().strip()
    image_score = round(max(0.0, min(1.0, float(image_model_score))), 4)
    formula_score = round(max(0.0, min(1.0, float(formula_result.formula_score))), 4)

    # 1. Select module weights
    if mod == "breast":
        image_weight = config.breast_image_weight
        formula_weight = config.breast_formula_weight
    elif mod == "cervical":
        image_weight = config.cervical_image_weight
        formula_weight = config.cervical_formula_weight
    elif mod == "pcos":
        image_weight = config.pcos_image_weight
        formula_weight = config.pcos_formula_weight
    else:
        image_weight = 0.50
        formula_weight = 0.50

    # 2. Standard weighted score
    weighted_score = round((image_score * image_weight) + (formula_score * formula_weight), 4)

    # 3. Disagreement detection
    score_difference = round(abs(image_score - formula_score), 4)
    if score_difference > 0.30:
        disagreement_detected = True
        if image_score > formula_score:
            disagreement_explanation = (
                "The image model detected suspicious findings that are not fully reflected "
                "in the clinical inputs. This may indicate early-stage changes not yet "
                "captured by clinical parameters. Clinical correlation is strongly recommended."
            )
        else:
            disagreement_explanation = (
                "The clinical risk factors indicate elevated risk that is not clearly visible "
                "in the current image. This may be due to image quality limitations or early "
                "pre-imaging changes. Consider repeat imaging or additional clinical workup."
            )

        # Conservative clinical approach: 70% weight on higher score, 30% on lower score
        higher_score = max(image_score, formula_score)
        lower_score = min(image_score, formula_score)
        final_score = round((higher_score * 0.70) + (lower_score * 0.30), 4)
    else:
        disagreement_detected = False
        disagreement_explanation = ""
        final_score = weighted_score

    final_score = max(0.0, min(1.0, final_score))

    # 4. Risk level assignment by module
    if mod == "breast":
        if final_score < 0.20:
            final_risk_level = "low"
        elif final_score <= 0.40:
            final_risk_level = "moderate"
        elif final_score <= 0.65:
            final_risk_level = "high"
        else:
            final_risk_level = "critical"

    elif mod == "cervical":
        if final_score < 0.20:
            final_risk_level = "normal"
        elif final_score <= 0.40:
            final_risk_level = "low"
        elif final_score <= 0.65:
            final_risk_level = "moderate"
        elif final_score <= 0.80:
            final_risk_level = "high"
        else:
            final_risk_level = "critical"

    elif mod == "pcos":
        if final_score < 0.30:
            final_risk_level = "unlikely"
        elif final_score <= 0.55:
            final_risk_level = "possible"
        elif final_score <= 0.80:
            final_risk_level = "likely"
        else:
            final_risk_level = "confirmed"

    else:
        if final_score < 0.30:
            final_risk_level = "low"
        elif final_score <= 0.60:
            final_risk_level = "moderate"
        else:
            final_risk_level = "high"

    return FusionResult(
        image_score=image_score,
        formula_score=formula_score,
        image_weight=image_weight,
        formula_weight=formula_weight,
        weighted_score=weighted_score,
        final_risk_level=final_risk_level,
        disagreement_detected=disagreement_detected,
        disagreement_explanation=disagreement_explanation,
        final_score=final_score,
    )
