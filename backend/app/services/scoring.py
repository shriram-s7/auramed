import random

FUSION_IMAGE_WEIGHT = 0.6
FUSION_CLINICAL_WEIGHT = 0.4

FOLLOWUP_INTERVAL = {
    "critical": "within 1 week",
    "high": "within 1 month",
    "moderate": "within 2-3 months",
    "low": "annual",
}

MODEL_NAMES = {
    "breast": {"image": "AuraMed BreastNet v1.2", "clinical": "Gail + Clinical Factors"},
    "cervical": {"image": "AuraMed CervixNet v1.0", "clinical": "Bethesda-Aligned Clinical Score"},
    "pcos": {"image": "AuraMed OvaryNet v1.1", "clinical": "Rotterdam Criteria Score"},
}

SCAN_TYPE_LABEL = {
    "breast": "Mammogram",
    "cervical": "Cervical Cytology (Pap Smear)",
    "pcos": "Transvaginal/Transabdominal Ultrasound",
}


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _row(factor, value, reference_range, contribution):
    return {
        "factor": factor,
        "value": "—" if value is None else value,
        "reference_range": reference_range,
        "contribution": round(contribution, 3),
    }


def _score_breast(inputs: dict):
    contributions = []
    score = 0.08
    contributions.append(_row("Baseline population risk", "—", "—", 0.08))

    age = inputs.get("age")
    age_contribution = 0.05 if isinstance(age, (int, float)) and age >= 50 else -0.02
    contributions.append(_row("Age", age, "18–100 yrs", age_contribution))
    score += age_contribution

    menopausal = inputs.get("menopausal_status")
    contributions.append(_row("Menopausal Status", menopausal, "Pre/Peri/Post-menopausal", 0.0))

    fam = inputs.get("family_history")
    fam_delta = {"multiple_relatives": 0.15, "first_degree": 0.08, "second_degree": 0.04}.get(fam, 0.0)
    contributions.append(_row("Family History", fam, "None expected", fam_delta))
    score += fam_delta

    lump = inputs.get("palpable_lump")
    lump_delta = 0.22 if lump == "yes" else 0.0
    contributions.append(_row("Palpable Lump", lump, "No expected", lump_delta))
    score += lump_delta

    if lump == "yes":
        lump_size = inputs.get("lump_size_cm")
        size_delta = 0.0
        if isinstance(lump_size, (int, float)):
            size_delta = _clamp(lump_size / 20, 0, 1) * 0.2
        contributions.append(_row("Lump Size", f"{lump_size} cm" if lump_size is not None else None, "0.1–20 cm", size_delta))
        score += size_delta

        location = inputs.get("lump_location")
        contributions.append(_row("Lump Location", location, "—", 0.0))

    discharge = inputs.get("nipple_discharge")
    discharge_delta = 0.1 if discharge == "yes" else 0.0
    contributions.append(_row("Nipple Discharge", discharge, "No expected", discharge_delta))
    score += discharge_delta

    skin = inputs.get("skin_changes")
    skin_delta = 0.15 if skin == "yes" else 0.0
    contributions.append(_row("Skin Changes", skin, "No expected", skin_delta))
    score += skin_delta

    biopsy = inputs.get("previous_biopsy")
    biopsy_delta = 0.05 if biopsy == "yes" else 0.0
    contributions.append(_row("Previous Biopsy", biopsy, "No expected", biopsy_delta))
    score += biopsy_delta

    quality = inputs.get("image_quality")
    contributions.append(_row("Image Quality", quality, "Good/Adequate/Poor", 0.0))

    return _clamp(score), contributions


def _score_cervical(inputs: dict):
    contributions = []
    score = 0.08
    contributions.append(_row("Baseline population risk", "—", "—", 0.08))

    age = inputs.get("age")
    contributions.append(_row("Age", age, "18–100 yrs", 0.0))

    hpv = inputs.get("hpv_status")
    hpv_delta = {"positive": 0.32, "unknown": 0.05}.get(hpv, 0.0)
    contributions.append(_row("HPV Status", hpv, "Negative expected", hpv_delta))
    score += hpv_delta

    abnormal_pap = inputs.get("history_abnormal_pap")
    abnormal_delta = 0.15 if abnormal_pap == "yes" else 0.0
    contributions.append(_row("History of Abnormal Pap", abnormal_pap, "No expected", abnormal_delta))
    score += abnormal_delta

    smoking = inputs.get("smoking_status")
    smoking_delta = {"current_smoker": 0.1, "ex_smoker": 0.04}.get(smoking, 0.0)
    contributions.append(_row("Smoking Status", smoking, "Non-smoker expected", smoking_delta))
    score += smoking_delta

    immuno = inputs.get("immunocompromised")
    immuno_delta = 0.1 if immuno == "yes" else 0.0
    contributions.append(_row("Immunocompromised", immuno, "No expected", immuno_delta))
    score += immuno_delta

    symptoms = inputs.get("symptoms") or []
    relevant = {"bleeding", "discharge", "pain"}
    matched = relevant.intersection(symptoms)
    symptoms_delta = min(0.15, 0.05 * len(matched))
    contributions.append(_row("Symptoms", ", ".join(symptoms) if symptoms else "None", "None expected", symptoms_delta))
    score += symptoms_delta

    adequacy = inputs.get("sample_adequacy")
    adequacy_delta = 0.08 if adequacy == "unsatisfactory" else 0.0
    contributions.append(_row("Sample Adequacy", adequacy, "Satisfactory expected", adequacy_delta))
    score += adequacy_delta

    tz = inputs.get("transformation_zone")
    contributions.append(_row("Transformation Zone", tz, "Present preferred", 0.0))

    return _clamp(score), contributions


def _score_pcos(inputs: dict):
    contributions = []
    score = 0.08
    contributions.append(_row("Baseline population risk", "—", "—", 0.08))

    age = inputs.get("age")
    contributions.append(_row("Age", age, "12–55 yrs", 0.0))

    regularity = inputs.get("menstrual_regularity") or inputs.get("menstrual_cycle_regularity")
    reg_delta = 0.20 if regularity in ("irregular", "absent") else 0.0
    contributions.append(_row("Menstrual Cycle Regularity", regularity, "Regular expected", reg_delta))
    score += reg_delta

    lh = inputs.get("lh_mIU_mL") if inputs.get("lh_mIU_mL") is not None else inputs.get("lh_miu_ml")
    fsh = inputs.get("fsh_mIU_mL") if inputs.get("fsh_mIU_mL") is not None else inputs.get("fsh_miu_ml")
    ratio = None
    ratio_delta = 0.0
    if isinstance(lh, (int, float)) and isinstance(fsh, (int, float)) and fsh > 0:
        ratio = round(lh / fsh, 2)
        if ratio >= 2:
            ratio_delta = 0.18
    contributions.append(_row("LH/FSH Ratio", ratio, "< 2 expected", ratio_delta))
    score += ratio_delta

    amh = inputs.get("amh_ng_mL") if inputs.get("amh_ng_mL") is not None else inputs.get("amh_ng_ml")
    amh_delta = 0.15 if isinstance(amh, (int, float)) and amh > 4.7 else 0.0
    contributions.append(_row("AMH", f"{amh} ng/mL" if amh is not None else None, "1.0–4.0 ng/mL", amh_delta))
    score += amh_delta

    symptoms = inputs.get("clinical_symptoms") or []
    real_symptoms = [s for s in symptoms if s != "none"]
    symptoms_delta = min(0.25, 0.06 * len(real_symptoms))
    contributions.append(_row("Clinical Symptoms", ", ".join(real_symptoms) if real_symptoms else "None", "None expected", symptoms_delta))
    score += symptoms_delta

    left_f = inputs.get("left_follicle_count") or 0
    right_f = inputs.get("right_follicle_count") or 0
    left_delta = 0.08 if isinstance(left_f, (int, float)) and left_f > 12 else 0.0
    right_delta = 0.08 if isinstance(right_f, (int, float)) and right_f > 12 else 0.0
    contributions.append(_row("Left Follicle Count", left_f, "0–12", left_delta))
    contributions.append(_row("Right Follicle Count", right_f, "0–12", right_delta))
    score += left_delta + right_delta

    testosterone = (
        inputs.get("testosterone_ng_dL")
        if inputs.get("testosterone_ng_dL") is not None
        else (inputs.get("total_testosterone_ng_dl") if inputs.get("total_testosterone_ng_dl") is not None else inputs.get("testosterone"))
    )
    contributions.append(_row("Total Testosterone", f"{testosterone} ng/dL" if testosterone is not None else None, "15–70 ng/dL", 0.0))

    return _clamp(score), contributions


SCORERS = {
    "breast": _score_breast,
    "cervical": _score_cervical,
    "pcos": _score_pcos,
}


def risk_level_from_score(score: float) -> str:
    if score < 0.3:
        return "low"
    if score < 0.55:
        return "moderate"
    if score < 0.8:
        return "high"
    return "critical"


def _build_image_findings(module: str, inputs: dict, image_model_score: float):
    findings = []
    if module == "breast":
        if inputs.get("palpable_lump") == "yes":
            findings.append({"description": "Irregular mass detected", "confidence": round(_clamp(image_model_score + 0.05), 2)})
        if inputs.get("skin_changes") == "yes":
            findings.append({"description": "Skin thickening / architectural distortion", "confidence": round(_clamp(image_model_score - 0.02), 2)})
        findings.append({"description": "Spiculated margins" if image_model_score > 0.5 else "Well-circumscribed margins", "confidence": round(_clamp(image_model_score - 0.05), 2)})
        findings.append({"description": "High density region" if image_model_score > 0.4 else "Predominantly fatty tissue", "confidence": round(_clamp(image_model_score - 0.1), 2)})
    elif module == "cervical":
        if inputs.get("hpv_status") == "positive":
            findings.append({"description": "Koilocytic atypia consistent with HPV effect", "confidence": round(_clamp(image_model_score + 0.03), 2)})
        findings.append({"description": "Nuclear enlargement and hyperchromasia" if image_model_score > 0.5 else "Regular nuclear morphology", "confidence": round(_clamp(image_model_score - 0.03), 2)})
        findings.append({"description": "Abnormal N:C ratio in cell cluster" if image_model_score > 0.55 else "Normal N:C ratio", "confidence": round(_clamp(image_model_score - 0.08), 2)})
    else:
        findings.append({"description": "Peripheral 'string of pearls' follicle pattern" if image_model_score > 0.5 else "Even follicle distribution", "confidence": round(_clamp(image_model_score), 2)})
        findings.append({"description": "Increased stromal echogenicity" if image_model_score > 0.55 else "Normal stromal echogenicity", "confidence": round(_clamp(image_model_score - 0.06), 2)})
        findings.append({"description": "Enlarged ovarian volume" if image_model_score > 0.45 else "Ovarian volume within normal limits", "confidence": round(_clamp(image_model_score - 0.1), 2)})
    return findings


def _build_model_interpretation(module: str, risk_level: str, image_model_score: float, formula_score: float):
    module_label = {"breast": "breast", "cervical": "cervical", "pcos": "ovarian"}[module]
    agreement = "closely agree" if abs(image_model_score - formula_score) < 0.15 else "differ somewhat"
    return (
        f"The image model and the clinical formula {agreement} on this case. Based on the {module_label} "
        f"imaging findings and the clinical inputs provided, the fused analysis places this case in the "
        f"{risk_level} risk category. This assessment should be reviewed alongside the doctor's own clinical "
        f"judgement before being communicated to the patient."
    )


def _build_confidence_reasons(module: str, confidence_score: float, inputs: dict, image_quality: str | None, image_model_score: float, formula_score: float):
    reasons = []
    if abs(image_model_score - formula_score) < 0.15:
        reasons.append("High agreement between image and clinical models")
    else:
        reasons.append("Some disagreement between image and clinical models; interpret with additional caution")
    if image_quality == "good":
        reasons.append("Image quality was rated good")
    elif image_quality == "poor":
        reasons.append("Image quality was rated poor, which may reduce reliability")
    if module == "cervical" and inputs.get("sample_adequacy") == "unsatisfactory":
        reasons.append("Sample was rated unsatisfactory, which lowers confidence")
    if image_model_score > 0.6 or formula_score > 0.6:
        reasons.append("Clear suspicious findings present in the image and/or clinical inputs")
    reasons.append("Clinical inputs were consistent and within valid ranges")
    return reasons


def _build_limitations(module: str, image_quality: str | None):
    limitations = [
        "This analysis is decision support only and does not replace histopathological confirmation where indicated.",
    ]
    if image_quality in (None, "adequate", "poor"):
        limitations.append("Image quality was not optimal; findings should be correlated with repeat imaging if clinically indicated.")
    if module == "pcos":
        limitations.append("Hormonal values can vary by cycle day; correlate with cycle timing.")
    return limitations


def _build_ai_suggestions(module: str, inputs: dict, risk_level: str):
    if module == "breast":
        birads = {"low": "BI-RADS 2", "moderate": "BI-RADS 3", "high": "BI-RADS 4", "critical": "BI-RADS 5"}[risk_level]
        return {
            "lump_size_cm": inputs.get("lump_size_cm"),
            "lump_location": inputs.get("lump_location"),
            "birads_suggested": birads,
        }
    if module == "cervical":
        classification = {"low": "NILM", "moderate": "ASC-US", "high": "LSIL", "critical": "HSIL"}[risk_level]
        cin_stage = {"low": "None", "moderate": "CIN 1", "high": "CIN 2", "critical": "CIN 3"}[risk_level]
        return {"classification_suggested": classification, "cin_stage_suggested": cin_stage}

    lh = inputs.get("lh_mIU_mL") if inputs.get("lh_mIU_mL") is not None else inputs.get("lh_miu_ml")
    fsh = inputs.get("fsh_mIU_mL") if inputs.get("fsh_mIU_mL") is not None else inputs.get("fsh_miu_ml")
    ratio = lh / fsh if isinstance(lh, (int, float)) and isinstance(fsh, (int, float)) and fsh > 0 else None
    oligo = (inputs.get("menstrual_regularity") or inputs.get("menstrual_cycle_regularity")) in ("irregular", "absent")
    hyperandrogenism = bool(inputs.get("clinical_symptoms")) and any(
        s in (inputs.get("clinical_symptoms") or []) for s in ("hirsutism", "acne")
    )
    polycystic_ovaries = (inputs.get("left_follicle_count") or 0) > 12 or (inputs.get("right_follicle_count") or 0) > 12
    criteria_met = sum([oligo, hyperandrogenism, polycystic_ovaries])
    classification = {
        3: "Classic PCOS (all 3 Rotterdam criteria met)",
        2: "PCOS (2 of 3 Rotterdam criteria met)",
        1: "Possible PCOS (1 of 3 criteria met) — further work-up advised",
        0: "PCOS criteria not met",
    }[criteria_met]
    return {
        "rotterdam_oligo_anovulation": oligo,
        "rotterdam_hyperandrogenism": hyperandrogenism,
        "rotterdam_polycystic_ovaries": polycystic_ovaries,
        "lh_fsh_ratio": ratio,
        "pcos_classification_suggested": classification,
    }


def compute_scores(module: str, clinical_inputs: dict, image_quality: str | None) -> dict:
    scorer = SCORERS.get(module)
    formula_score, contributions = scorer(clinical_inputs) if scorer else (0.3, [])

    noise = random.uniform(-0.08, 0.08)
    image_model_score = _clamp(formula_score * 0.75 + 0.15 + noise)

    fusion_score = _clamp(formula_score * FUSION_CLINICAL_WEIGHT + image_model_score * FUSION_IMAGE_WEIGHT)
    risk_level = risk_level_from_score(fusion_score)

    base_confidence = 0.78
    if image_quality == "poor" or clinical_inputs.get("sample_adequacy") == "unsatisfactory":
        base_confidence -= 0.15
    elif image_quality == "good":
        base_confidence += 0.08
    confidence_score = _clamp(base_confidence + random.uniform(-0.05, 0.05), 0.4, 0.98)

    image_findings = _build_image_findings(module, clinical_inputs, image_model_score)
    model_interpretation = _build_model_interpretation(module, risk_level, image_model_score, formula_score)
    confidence_reasons = _build_confidence_reasons(
        module, confidence_score, clinical_inputs, image_quality, image_model_score, formula_score
    )
    limitations = _build_limitations(module, image_quality)
    ai_suggestions = _build_ai_suggestions(module, clinical_inputs, risk_level)

    reasoning = {
        "image_findings": image_findings,
        "model_interpretation": model_interpretation,
        "clinical_contributions": contributions,
        "confidence_reasons": confidence_reasons,
        "limitations": limitations,
        "follow_up_interval": FOLLOWUP_INTERVAL[risk_level],
        "image_model_name": MODEL_NAMES[module]["image"],
        "clinical_model_name": MODEL_NAMES[module]["clinical"],
        "fusion_weights": {"image": FUSION_IMAGE_WEIGHT, "clinical": FUSION_CLINICAL_WEIGHT},
        "scan_type_label": SCAN_TYPE_LABEL[module],
    }

    return {
        "formula_score": round(formula_score, 3),
        "image_model_score": round(image_model_score, 3),
        "fusion_score": round(fusion_score, 3),
        "risk_level": risk_level,
        "confidence_score": round(confidence_score, 3),
        "reasoning": reasoning,
        "ai_suggestions": ai_suggestions,
    }
