"""
Structured clinical reasoning / AI interpretation text generation.

Replaces the previous one-line "Analysis completed with module-specific deep
neural network" placeholder with a fully dynamic, multi-paragraph narrative
built from the *actual* computed values for a given scan: image model output,
Grad-CAM attention location (when available), each individual clinical-formula
contribution, the fusion result, and the confidence result.

One generator per module: generate_breast_reasoning, generate_cervical_reasoning,
generate_pcos_reasoning. Each takes the raw clinical inputs dict plus the
FormulaResult / FusionResult / ConfidenceResult objects already computed
during analysis, and returns the final reasoning text as a single string.
"""
from typing import Any, Dict, List, Optional


def _pct(value: Optional[float]) -> str:
    if value is None:
        return "N/A"
    return f"{value * 100:.1f}"


def _direction_phrase(direction: str) -> str:
    if direction == "increases_risk":
        return "increases"
    if direction == "decreases_risk":
        return "decreases"
    return "does not change"


def _contribution_bullet(c) -> str:
    return (
        f"- {c.factor_name} ({c.value}): {_direction_phrase(c.contribution_direction)} "
        f"the clinical risk score by {c.contribution_magnitude:.2f} — {c.explanation}"
    )


def _fusion_agreement_paragraph(fusion_result, image_model_score: Optional[float], formula_score: Optional[float]) -> str:
    fusion_score = fusion_result.get("final_score") if isinstance(fusion_result, dict) else None
    disagreement = fusion_result.get("disagreement_detected") if isinstance(fusion_result, dict) else False
    disagreement_explanation = fusion_result.get("disagreement_explanation") if isinstance(fusion_result, dict) else ""

    fusion_str = f"{fusion_score:.2f}" if isinstance(fusion_score, (int, float)) else "N/A"
    image_str = f"{image_model_score:.2f}" if isinstance(image_model_score, (int, float)) else "N/A"
    formula_str = f"{formula_score:.2f}" if isinstance(formula_score, (int, float)) else "N/A"

    if disagreement:
        explanation_text = (disagreement_explanation or "clinical judgment should take precedence over the image-based estimate").rstrip(". ")
        return (
            f"The fusion score of {fusion_str} reflects disagreement between imaging and clinical data. "
            f"The significant divergence between image score ({image_str}) and clinical score ({formula_str}) "
            f"suggests {explanation_text}. "
            "A conservative higher-weight was applied to protect patient safety."
        )
    return (
        f"The fusion score of {fusion_str} reflects agreement between imaging and clinical data, "
        f"with the image score ({image_str}) and clinical score ({formula_str}) converging on a consistent risk estimate."
    )


def generate_breast_reasoning(
    inputs: Dict[str, Any],
    image_model_score: Optional[float],
    model_interpretation: str,
    has_gradcam: bool,
    formula_res,
    fusion_res_dict: Dict[str, Any],
    confidence_score: Optional[float],
    threshold: float,
    recommended_actions: List[str],
) -> str:
    finding = model_interpretation or "no dominant suspicious finding"

    if has_gradcam:
        attention_sentence = (
            "Key imaging features contributing to this assessment are highlighted in the Grad-CAM "
            "attention heatmap accompanying this image; review the heatmap overlay directly for the "
            "specific regions the model weighted most heavily."
        )
    else:
        attention_sentence = (
            "Spatial attention localization (Grad-CAM) was not available for this analysis; "
            "the image-level score below reflects the model's overall output without a localized focus region."
        )

    contribution_lines = "\n".join(_contribution_bullet(c) for c in formula_res.contributions) or "- No clinical risk factors were available for this scan."

    fusion_paragraph = _fusion_agreement_paragraph(fusion_res_dict, image_model_score, formula_res.formula_score)

    will_trigger = isinstance(image_model_score, (int, float)) and image_model_score >= threshold
    trigger_phrase = "would" if will_trigger else "would not"

    recommendation = recommended_actions[0] if recommended_actions else "Clinical correlation and follow-up per standard protocol."

    return (
        f"The mammography image analysis identified {finding.rstrip('.')} with {_pct(image_model_score)}% confidence. "
        f"{attention_sentence}\n\n"
        "Clinical risk factors amplifying/reducing this score:\n"
        f"{contribution_lines}\n\n"
        f"{fusion_paragraph}\n\n"
        f"At the current threshold of {threshold:.2f}, this result {trigger_phrase} trigger recall for further imaging. "
        f"Recommended action: {recommendation}"
    )


_CERVICAL_MORPHOLOGY = {
    "Dyskeratotic": {
        "nuclear": "hyperchromatic nucleus, increased N/C ratio, irregular chromatin distribution",
        "cytoplasmic": "dense, keratinized cytoplasm with dyskeratotic changes",
        "arrangement": "cells present singly or in loose sheets with marked nuclear pleomorphism",
    },
    "Koilocytotic": {
        "nuclear": "mild to moderate nuclear enlargement with binucleation",
        "cytoplasmic": "perinuclear halo (koilocytosis), HPV cytopathic effect",
        "arrangement": "cells arranged in sheets with scattered koilocytes",
    },
    "Metaplastic": {
        "nuclear": "mild nuclear atypia with slightly enlarged nuclei",
        "cytoplasmic": "dense, well-defined metaplastic cytoplasm",
        "arrangement": "cells in cohesive sheets typical of squamous metaplasia",
    },
    "Parabasal": {
        "nuclear": "atypical squamous cells, nucleus cannot exclude high-grade lesion",
        "cytoplasmic": "scant, immature parabasal-type cytoplasm",
        "arrangement": "small immature cells, occasionally in clusters",
    },
    "Normal": {
        "nuclear": "small, pyknotic, uniform nucleus",
        "cytoplasmic": "transparent, well-differentiated superficial-intermediate cytoplasm",
        "arrangement": "cells present singly with normal maturation pattern",
    },
}


def generate_cervical_reasoning(
    inputs: Dict[str, Any],
    predicted_class: Optional[str],
    confidence: Optional[float],
    bethesda_term: str,
    formula_res,
    threshold: float,
) -> str:
    cls = predicted_class or "Normal"
    morph = _CERVICAL_MORPHOLOGY.get(cls, _CERVICAL_MORPHOLOGY["Normal"])

    base_contrib = next((c for c in formula_res.contributions if c.factor_name == "Bethesda Cytology Class"), None)
    hpv_contrib = next((c for c in formula_res.contributions if c.factor_name == "HPV DNA Status"), None)
    other_contribs = [
        c for c in formula_res.contributions
        if c.factor_name not in ("Bethesda Cytology Class", "HPV DNA Status")
    ]

    base_risk_str = f"{base_contrib.contribution_magnitude:.2f}" if base_contrib else "N/A"
    hpv_value = hpv_contrib.value if hpv_contrib else str(inputs.get("hpv_status", "unknown")).title()
    hpv_modifier_str = f"{hpv_contrib.contribution_magnitude:.2f}" if hpv_contrib else "0.00"

    modifiers_lines = "\n".join(f"- {c.factor_name}: {c.value} ({c.explanation})" for c in other_contribs) or "- No additional clinical modifiers applied."

    risk_tier = formula_res.risk_tier
    if risk_tier in ("critical", "high"):
        action_paragraph = (
            "This result meets criteria for immediate colposcopy referral per 2020 ASCCP guidelines."
        )
    elif risk_tier == "moderate":
        action_paragraph = (
            "Repeat cytology in 6-12 months or colposcopy per clinical judgment."
        )
    else:
        action_paragraph = "Routine screening interval maintained."

    return (
        f"Cytology image analysis classified this cell as {cls} ({bethesda_term}) with {_pct(confidence)}% model confidence.\n\n"
        "Key morphological features identified:\n"
        f"- Nuclear characteristics: {morph['nuclear']}\n"
        f"- Cytoplasmic features: {morph['cytoplasmic']}\n"
        f"- Cell arrangement: {morph['arrangement']}\n\n"
        "ASCCP risk matrix application:\n"
        f"- Cytology base risk: {base_risk_str} ({cls})\n"
        f"- HPV modifier: {hpv_modifier_str} ({hpv_value})\n"
        f"- Clinical modifiers applied:\n{modifiers_lines}\n"
        f"- Final clinical score: {formula_res.formula_score:.2f}\n\n"
        f"{action_paragraph}"
    )


def _amh_interpretation(amh_val: Optional[float]) -> str:
    if amh_val is None:
        return "not provided"
    if amh_val > 6.0:
        return f"{amh_val:.1f} ng/mL: significantly elevated, reflecting excess pre-antral follicles characteristic of PCOS"
    if amh_val > 3.5:
        return f"{amh_val:.1f} ng/mL: elevated, supportive of PCOS"
    if amh_val >= 1.0:
        return f"{amh_val:.1f} ng/mL: within normal adult reference range (1.0-3.5 ng/mL)"
    return f"{amh_val:.1f} ng/mL: low, may indicate diminished ovarian reserve rather than polycystic proliferation"


def _lh_fsh_interpretation(lh_val: Optional[float], fsh_val: Optional[float]) -> str:
    if lh_val is None or fsh_val is None or fsh_val == 0:
        return "not calculable (LH and/or FSH not provided)"
    ratio = lh_val / fsh_val
    if ratio > 2.0:
        return f"{ratio:.2f}: elevated (> 2.0), strongly supportive of the neuroendocrine dysregulation typical of PCOS"
    if ratio > 1.5:
        return f"{ratio:.2f}: mildly elevated (> 1.5); continued monitoring recommended"
    return f"{ratio:.2f}: within normal physiologic range"


def _prolactin_interpretation(prolactin_val: Optional[float]) -> str:
    if prolactin_val is None:
        return "not provided"
    if prolactin_val > 25.0:
        return f"{prolactin_val:.1f} ng/mL: elevated — flagged for hyperprolactinemia differential"
    return f"{prolactin_val:.1f} ng/mL: normal (<= 25.0 ng/mL)"


def generate_pcos_reasoning(
    inputs: Dict[str, Any],
    image_model_score: Optional[float],
    predicted_class: Optional[str],
    image_criterion_met: Optional[bool],
    formula_res,
    image_threshold: float,
) -> str:
    def _num(*keys):
        for k in keys:
            v = inputs.get(k)
            if v is not None:
                try:
                    return float(v)
                except (ValueError, TypeError):
                    continue
        return None

    cycle_reg = str(inputs.get("menstrual_cycle_regularity") or inputs.get("menstrual_regularity") or "regular").title()
    cycle_len = inputs.get("cycle_length_days", "N/A")

    symptoms = inputs.get("clinical_symptoms") or []
    if isinstance(symptoms, str):
        symptoms = [s.strip().lower() for s in symptoms.split(",") if s.strip()]
    hirsutism = "yes" if "hirsutism" in symptoms else "no"
    acne = "yes" if "acne" in symptoms else "no"

    testosterone = _num("total_testosterone_ng_dl", "testosterone_ng_dL", "testosterone")
    testo_str = f"{testosterone:.1f}" if testosterone is not None else "N/A"
    testo_rel = "above" if (testosterone is not None and testosterone > 50.0) else "below"

    left_vol = _num("left_ovary_volume_ml", "left_ovarian_volume_mL")
    right_vol = _num("right_ovary_volume_ml", "right_ovarian_volume_mL")
    left_follicles = inputs.get("left_follicle_count", "N/A")
    right_follicles = inputs.get("right_follicle_count", "N/A")

    amh_val = _num("amh_ng_ml", "amh_ng_mL", "amh")
    lh_val = _num("lh_miu_ml", "lh_mIU_mL", "lh")
    fsh_val = _num("fsh_miu_ml", "fsh_mIU_mL", "fsh")
    prolactin_val = _num("prolactin_ng_ml", "prolactin")

    criteria_met = set(formula_res.criteria_met)
    c1_met = "Oligo/Anovulation" in criteria_met
    c2_met = "Hyperandrogenism" in criteria_met
    c3_met = "Polycystic Ovarian Morphology" in criteria_met
    criteria_count = sum([c1_met, c2_met, c3_met])

    if criteria_count >= 2:
        diagnosis = "PCOS confirmed"
    elif criteria_count == 1:
        diagnosis = "Borderline — clinical correlation required"
    else:
        diagnosis = "PCOS not confirmed"

    finding_label = predicted_class or ("PCOS" if image_criterion_met else "Healthy")
    morph_label = "polycystic ovarian morphology" if image_criterion_met else "normal ovarian morphology"

    image_rel = "above" if (isinstance(image_model_score, (int, float)) and image_model_score > image_threshold) else "below"

    return (
        f"Ultrasound morphology analysis identified {finding_label} consistent with "
        f"{morph_label} with {_pct(image_model_score)}% confidence.\n\n"
        "Rotterdam Criteria Assessment:\n"
        f"Criterion 1 — Oligo/Anovulation: {'Met' if c1_met else 'Not Met'}\n"
        f"  Evidence: Cycle length {cycle_len} days, regularity: {cycle_reg}\n\n"
        f"Criterion 2 — Hyperandrogenism: {'Met' if c2_met else 'Not Met'}\n"
        f"  Clinical: Hirsutism: {hirsutism}, Acne: {acne}\n"
        f"  Biochemical: Testosterone {testo_str} ng/dL ({testo_rel} 50 ng/dL threshold)\n\n"
        f"Criterion 3 — Polycystic Morphology: {'Met' if c3_met else 'Not Met'}\n"
        f"  Left ovary: Volume {left_vol if left_vol is not None else 'N/A'} mL, Follicles {left_follicles}\n"
        f"  Right ovary: Volume {right_vol if right_vol is not None else 'N/A'} mL, Follicles {right_follicles}\n"
        f"  Image model probability: {image_model_score if image_model_score is not None else 'N/A'} "
        f"({image_rel} {image_threshold:.2f} threshold)\n\n"
        f"Criteria satisfied: {criteria_count}/3\n"
        f"Rotterdam Diagnosis: {diagnosis}\n\n"
        "Endocrine profile:\n"
        f"- AMH {_amh_interpretation(amh_val)}\n"
        f"- LH/FSH ratio {_lh_fsh_interpretation(lh_val, fsh_val)}\n"
        f"- Prolactin {_prolactin_interpretation(prolactin_val)}"
    )
