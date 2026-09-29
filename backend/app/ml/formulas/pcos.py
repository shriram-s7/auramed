"""
PCOS Risk Computation Module.
Implements Rotterdam Consensus Criteria (2003) scoring and supporting endocrine
biomarker assessment for polycystic ovary syndrome diagnosis.
"""
from typing import Any, Dict, List, Optional
from app.ml.formulas.base import FactorContribution, FormulaResult


def compute_pcos_risk(
    inputs: Dict[str, Any],
    image_criterion_met: Optional[bool] = None,
) -> FormulaResult:
    """
    Evaluates Rotterdam 2003 criteria and endocrine biomarkers for PCOS risk.

    Input fields:
      age: int
      menstrual_cycle_regularity: str (regular/irregular/absent)
      cycle_length_days: int
      clinical_symptoms: list (hirsutism/acne/weight_gain/hair_thinning/infertility)
      amh_ng_ml: float
      lh_miu_ml: float
      fsh_miu_ml: float
      total_testosterone_ng_dl: float
      prolactin_ng_ml: float
      left_ovary_volume_ml: float
      left_follicle_count: int
      right_ovary_volume_ml: float
      right_follicle_count: int
    """
    contributions: List[FactorContribution] = []
    criteria_met: List[str] = []
    criteria_not_met: List[str] = []
    limitations: List[str] = []

    # 1. CRITERION 1: Oligo-ovulation or Anovulation
    cycle_reg = str(inputs.get("menstrual_cycle_regularity") or inputs.get("menstrual_regularity") or "regular").strip().lower()
    raw_cycle_len = inputs.get("cycle_length_days")
    cycle_len: Optional[int] = None
    if raw_cycle_len is not None:
        try:
            cycle_len = int(raw_cycle_len)
        except (ValueError, TypeError):
            cycle_len = None

    c1_met = False
    c1_reasons = []
    if cycle_reg in ("irregular", "absent", "oligomenorrhea", "amenorrhea"):
        c1_met = True
        c1_reasons.append(f"cycle pattern: {cycle_reg}")
    if cycle_len is not None and cycle_len > 0:
        if cycle_len > 35 or cycle_len < 21:
            c1_met = True
            c1_reasons.append(f"cycle length {cycle_len} days (< 21 or > 35)")

    c1_label = "Oligo/Anovulation"
    if c1_met:
        criteria_met.append(c1_label)
        contributions.append(
            FactorContribution(
                factor_name="Menstrual Cycle / Ovulation",
                value=f"{cycle_reg.title()} ({cycle_len} days)" if cycle_len else cycle_reg.title(),
                reference_range="Regular, 21-35 days",
                contribution_direction="increases_risk",
                contribution_magnitude=0.35,
                explanation=f"Rotterdam Criterion 1 met ({', '.join(c1_reasons)}), indicating oligo- or anovulatory dysfunction.",
            )
        )
    else:
        criteria_not_met.append(c1_label)
        contributions.append(
            FactorContribution(
                factor_name="Menstrual Cycle / Ovulation",
                value=f"{cycle_reg.title()} ({cycle_len} days)" if cycle_len else cycle_reg.title(),
                reference_range="Regular, 21-35 days",
                contribution_direction="neutral",
                contribution_magnitude=0.0,
                explanation="Normal regular ovulatory cycle parameters reported.",
            )
        )

    # 2. CRITERION 2: Clinical or Biochemical Hyperandrogenism
    raw_symptoms = inputs.get("clinical_symptoms") or []
    if isinstance(raw_symptoms, str):
        # Allow comma separated string
        symptoms = [s.strip().lower() for s in raw_symptoms.split(",") if s.strip()]
    elif isinstance(raw_symptoms, list):
        symptoms = [str(s).strip().lower() for s in raw_symptoms]
    else:
        symptoms = []

    clinical_androgen_signs = []
    if "hirsutism" in symptoms:
        clinical_androgen_signs.append("hirsutism")
    if "acne" in symptoms:
        clinical_androgen_signs.append("acne")
    if "hair_thinning" in symptoms or "alopecia" in symptoms or "hair thinning" in symptoms:
        clinical_androgen_signs.append("hair thinning")

    clinical_hyperandrogenism = len(clinical_androgen_signs) > 0

    # Biochemical hyperandrogenism
    raw_testo = inputs.get("total_testosterone_ng_dl") or inputs.get("testosterone_ng_dL") or inputs.get("testosterone")
    testosterone: Optional[float] = None
    if raw_testo is not None:
        try:
            testosterone = float(raw_testo)
        except (ValueError, TypeError):
            testosterone = None

    biochemical_hyperandrogenism = testosterone is not None and testosterone > 50.0

    c2_met = clinical_hyperandrogenism or biochemical_hyperandrogenism
    c2_label = "Hyperandrogenism"

    c2_details = []
    if clinical_hyperandrogenism:
        c2_details.append(f"clinical signs: {', '.join(clinical_androgen_signs)}")
    if biochemical_hyperandrogenism:
        c2_details.append(f"serum testosterone: {testosterone:.1f} ng/dL (> 50.0 ng/dL)")

    if c2_met:
        criteria_met.append(c2_label)
        contributions.append(
            FactorContribution(
                factor_name="Hyperandrogenism",
                value="Present (" + "; ".join(c2_details) + ")",
                reference_range="Total Testosterone <= 50.0 ng/dL, no clinical hirsutism/alopecia",
                contribution_direction="increases_risk",
                contribution_magnitude=0.35,
                explanation=f"Rotterdam Criterion 2 met via {', '.join(c2_details)}.",
            )
        )
    else:
        criteria_not_met.append(c2_label)
        contributions.append(
            FactorContribution(
                factor_name="Hyperandrogenism",
                value=f"Testosterone: {testosterone:.1f} ng/dL" if testosterone is not None else "No clinical or biochemical signs",
                reference_range="Total Testosterone <= 50.0 ng/dL, no clinical signs",
                contribution_direction="neutral",
                contribution_magnitude=0.0,
                explanation="Neither clinical signs of hyperandrogenism nor elevated serum testosterone detected.",
            )
        )

    # 3. CRITERION 3: Polycystic Ovarian Morphology (PCOM)
    c3_label = "Polycystic Ovarian Morphology"
    if image_criterion_met is None:
        image_criterion_met = inputs.get("image_criterion_met")
        if isinstance(image_criterion_met, str):
            image_criterion_met = image_criterion_met.lower() in ("true", "yes", "1")

    # Ultrasound parameters if provided in inputs
    left_vol = inputs.get("left_ovary_volume_ml") if inputs.get("left_ovary_volume_ml") is not None else inputs.get("left_ovarian_volume_mL")
    right_vol = inputs.get("right_ovary_volume_ml") if inputs.get("right_ovary_volume_ml") is not None else inputs.get("right_ovarian_volume_mL")
    left_follicles = inputs.get("left_follicle_count")
    right_follicles = inputs.get("right_follicle_count")

    morph_features = []
    try:
        if left_vol is not None and float(left_vol) > 10.0:
            morph_features.append(f"left ovarian volume {float(left_vol):.1f} mL (> 10 mL)")
        if right_vol is not None and float(right_vol) > 10.0:
            morph_features.append(f"right ovarian volume {float(right_vol):.1f} mL (> 10 mL)")
        if left_follicles is not None and int(left_follicles) >= 12:
            morph_features.append(f"left follicle count {int(left_follicles)} (>= 12)")
        if right_follicles is not None and int(right_follicles) >= 12:
            morph_features.append(f"right follicle count {int(right_follicles)} (>= 12)")
    except (ValueError, TypeError):
        pass

    if image_criterion_met is True or len(morph_features) > 0:
        c3_met = True
        criteria_met.append(c3_label)
        contributions.append(
            FactorContribution(
                factor_name="Polycystic Ovarian Morphology (PCOM)",
                value="Present" + (f" ({', '.join(morph_features)})" if morph_features else " on ultrasound review"),
                reference_range="Ovarian volume <= 10.0 mL, follicle count < 12 per ovary",
                contribution_direction="increases_risk",
                contribution_magnitude=0.30,
                explanation="Rotterdam Criterion 3 met with polycystic morphology characteristic of PCOS.",
            )
        )
    elif image_criterion_met is False:
        c3_met = False
        criteria_not_met.append(c3_label)
        contributions.append(
            FactorContribution(
                factor_name="Polycystic Ovarian Morphology (PCOM)",
                value="Negative",
                reference_range="Ovarian volume <= 10.0 mL, follicle count < 12 per ovary",
                contribution_direction="neutral",
                contribution_magnitude=0.0,
                explanation="Ultrasound imaging does not exhibit polycystic ovarian architecture.",
            )
        )
    else:
        c3_met = False
        criteria_not_met.append(f"{c3_label} (Pending imaging confirmation)")
        contributions.append(
            FactorContribution(
                factor_name="Polycystic Ovarian Morphology (PCOM)",
                value="Pending Image Model Review",
                reference_range="Ovarian volume <= 10.0 mL, follicle count < 12 per ovary",
                contribution_direction="neutral",
                contribution_magnitude=0.0,
                explanation="Transvaginal/pelvic ultrasound imaging analysis pending completion.",
            )
        )

    # 4. SUPPORTING BIOMARKERS
    adjustments = 0.0

    # LH/FSH Ratio
    raw_lh = inputs.get("lh_miu_ml") if inputs.get("lh_miu_ml") is not None else (inputs.get("lh_mIU_mL") or inputs.get("lh"))
    raw_fsh = inputs.get("fsh_miu_ml") if inputs.get("fsh_miu_ml") is not None else (inputs.get("fsh_mIU_mL") or inputs.get("fsh"))
    lh_val: Optional[float] = None
    fsh_val: Optional[float] = None
    if raw_lh is not None:
        try:
            lh_val = float(raw_lh)
        except (ValueError, TypeError):
            pass
    if raw_fsh is not None:
        try:
            fsh_val = float(raw_fsh)
        except (ValueError, TypeError):
            pass

    if lh_val is not None and fsh_val is not None and fsh_val > 0:
        lh_fsh_ratio = round(lh_val / fsh_val, 2)
        if lh_fsh_ratio > 2.0:
            adjustments += 0.05
            contributions.append(
                FactorContribution(
                    factor_name="LH / FSH Ratio",
                    value=f"{lh_fsh_ratio:.2f}",
                    reference_range="1.0 - 1.5",
                    contribution_direction="increases_risk",
                    contribution_magnitude=0.05,
                    explanation=f"LH/FSH ratio of {lh_fsh_ratio:.2f} > 2.0 strongly supports neuroendocrine dysregulation typical of PCOS (+0.05).",
                )
            )
        elif lh_fsh_ratio > 1.5:
            contributions.append(
                FactorContribution(
                    factor_name="LH / FSH Ratio",
                    value=f"{lh_fsh_ratio:.2f}",
                    reference_range="1.0 - 1.5",
                    contribution_direction="increases_risk",
                    contribution_magnitude=0.02,
                    explanation=f"LH/FSH ratio of {lh_fsh_ratio:.2f} is mildly elevated (> 1.5); continued monitoring recommended.",
                )
            )
        else:
            contributions.append(
                FactorContribution(
                    factor_name="LH / FSH Ratio",
                    value=f"{lh_fsh_ratio:.2f}",
                    reference_range="1.0 - 1.5",
                    contribution_direction="neutral",
                    contribution_magnitude=0.0,
                    explanation=f"LH/FSH ratio of {lh_fsh_ratio:.2f} is within normal physiologic range.",
                )
            )

    # Anti-Müllerian Hormone (AMH)
    raw_amh = inputs.get("amh_ng_ml") if inputs.get("amh_ng_ml") is not None else (inputs.get("amh_ng_mL") or inputs.get("amh"))
    amh_val: Optional[float] = None
    if raw_amh is not None:
        try:
            amh_val = float(raw_amh)
        except (ValueError, TypeError):
            pass

    if amh_val is not None:
        if amh_val > 6.0:
            adjustments += 0.05
            contributions.append(
                FactorContribution(
                    factor_name="Anti-Müllerian Hormone (AMH)",
                    value=f"{amh_val:.1f} ng/mL",
                    reference_range="1.0 - 3.5 ng/mL",
                    contribution_direction="increases_risk",
                    contribution_magnitude=0.05,
                    explanation=f"Significantly elevated AMH ({amh_val:.1f} ng/mL > 6.0) reflects excess pre-antral follicles characteristic of PCOS (+0.05).",
                )
            )
        elif amh_val > 3.5:
            contributions.append(
                FactorContribution(
                    factor_name="Anti-Müllerian Hormone (AMH)",
                    value=f"{amh_val:.1f} ng/mL",
                    reference_range="1.0 - 3.5 ng/mL",
                    contribution_direction="increases_risk",
                    contribution_magnitude=0.02,
                    explanation=f"Elevated AMH ({amh_val:.1f} ng/mL > 3.5) supports PCOS diagnosis.",
                )
            )
        elif amh_val >= 1.0:
            contributions.append(
                FactorContribution(
                    factor_name="Anti-Müllerian Hormone (AMH)",
                    value=f"{amh_val:.1f} ng/mL",
                    reference_range="1.0 - 3.5 ng/mL",
                    contribution_direction="neutral",
                    contribution_magnitude=0.0,
                    explanation=f"AMH level ({amh_val:.1f} ng/mL) is within normal adult reference range.",
                )
            )
        else:
            contributions.append(
                FactorContribution(
                    factor_name="Anti-Müllerian Hormone (AMH)",
                    value=f"{amh_val:.1f} ng/mL",
                    reference_range="1.0 - 3.5 ng/mL",
                    contribution_direction="decreases_risk",
                    contribution_magnitude=0.0,
                    explanation=f"Low AMH ({amh_val:.1f} ng/mL < 1.0) may indicate diminished ovarian reserve rather than polycystic proliferation.",
                )
            )

    # Symptom count adjustment
    if len(symptoms) >= 3:
        adjustments += 0.03
        contributions.append(
            FactorContribution(
                factor_name="Symptom Cluster",
                value=f"{len(symptoms)} symptoms ({', '.join(symptoms[:4])})",
                reference_range="< 3 symptoms",
                contribution_direction="increases_risk",
                contribution_magnitude=0.03,
                explanation=f"Multifactorial symptom presentation ({len(symptoms)} signs reported) adds +0.03 risk weighting.",
            )
        )

    # Prolactin Check
    raw_prolactin = inputs.get("prolactin_ng_ml") or inputs.get("prolactin")
    if raw_prolactin is not None:
        try:
            prolactin_val = float(raw_prolactin)
            if prolactin_val > 25.0:
                limitations.append(
                    "Elevated prolactin may indicate hyperprolactinemia which can mimic PCOS symptoms"
                )
                contributions.append(
                    FactorContribution(
                        factor_name="Serum Prolactin",
                        value=f"{prolactin_val:.1f} ng/mL",
                        reference_range="<= 25.0 ng/mL",
                        contribution_direction="neutral",
                        contribution_magnitude=0.0,
                        explanation=f"Elevated prolactin ({prolactin_val:.1f} ng/mL > 25.0); rule out prolactinoma/hyperprolactinemia.",
                    )
                )
        except (ValueError, TypeError):
            pass

    # 5. RISK SCORE COMPUTATION
    criteria_count = (1 if c1_met else 0) + (1 if c2_met else 0) + (1 if c3_met else 0)

    if criteria_count == 0:
        base_score = 0.10
    elif criteria_count == 1:
        base_score = 0.45
    elif criteria_count == 2:
        base_score = 0.75
    else:
        base_score = 0.90

    raw_score = base_score + adjustments
    final_score = round(min(raw_score, 1.0), 4)

    # Risk Tier
    if final_score < 0.25:
        risk_tier = "low"
    elif final_score < 0.50:
        risk_tier = "moderate"
    elif final_score < 0.85:
        risk_tier = "high"
    else:
        risk_tier = "critical"

    # Interpretation
    if criteria_count >= 2:
        interpretation = (
            f"Rotterdam criteria for PCOS are satisfied ({criteria_count} of 3 criteria met). "
            f"PCOS diagnosis is supported with high clinical probability."
        )
    elif criteria_count == 1:
        interpretation = (
            "Only 1 of 3 Rotterdam criteria met. "
            "PCOS is possible but not confirmed. Further evaluation recommended."
        )
    else:
        interpretation = (
            "No Rotterdam criteria met. PCOS is unlikely based on current clinical data."
        )

    return FormulaResult(
        formula_score=final_score,
        formula_name="Rotterdam Consensus Criteria 2003",
        raw_score=round(raw_score, 4),
        risk_tier=risk_tier,
        contributions=contributions,
        criteria_met=criteria_met,
        criteria_not_met=criteria_not_met,
        interpretation=interpretation,
        clinical_basis=(
            "Rotterdam ESHRE/ASRM-Sponsored PCOS Consensus Workshop Group, 2004. "
            "Human Reproduction."
        ),
        limitations=limitations,
    )
