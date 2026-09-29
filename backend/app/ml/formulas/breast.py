"""
Breast Cancer Risk Computation Module.
Implements a modified Gail Model-inspired clinical risk calculation
based on published epidemiological risk factor weightings.
"""
from typing import Any, Dict, List, Tuple
from app.ml.formulas.base import FactorContribution, FormulaResult


def _parse_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in ("yes", "true", "1", "positive", "present")
    if isinstance(val, (int, float)):
        return bool(val)
    return False


def _get_age_bracket_risk(age: int) -> Tuple[float, str]:
    if age < 30:
        return 0.05, "18-29"
    elif age < 40:
        return 0.10, "30-39"
    elif age < 50:
        return 0.18, "40-49"
    elif age < 60:
        return 0.25, "50-59"
    elif age < 70:
        return 0.30, "60-69"
    else:
        return 0.35, "70+"


def compute_breast_risk(inputs: Dict[str, Any]) -> FormulaResult:
    """
    Computes modified Gail Model clinical risk score for breast cancer screening.

    Inputs used:
      age: int
      menopausal_status: str (premenopausal/postmenopausal/perimenopausal)
      family_history_breast_cancer: str (none/first_degree/second_degree/multiple)
      palpable_lump: str (yes/no)
      lump_size_cm: float (if palpable_lump is yes)
      nipple_discharge: str (yes/no)
      skin_changes: str (yes/no)
      previous_biopsy: str (yes/no)
      image_quality: str (good/adequate/poor)
    """
    contributions: List[FactorContribution] = []
    criteria_met: List[str] = []
    criteria_not_met: List[str] = []
    limitations: List[str] = []

    # 1. Age Factor
    raw_age = inputs.get("age", 40)
    try:
        age = int(raw_age)
    except (ValueError, TypeError):
        age = 40
    age_risk, age_bracket = _get_age_bracket_risk(age)

    contributions.append(
        FactorContribution(
            factor_name="Age Bracket",
            value=age,
            reference_range="18-29 years (baseline)",
            contribution_direction="increases_risk" if age >= 40 else "neutral",
            contribution_magnitude=round(age_risk, 2),
            explanation=f"Patient age {age} falls into bracket {age_bracket}, giving a base epidemiological risk weight of {age_risk:.2f}.",
        )
    )
    if age >= 50:
        criteria_met.append(f"Age >= 50 ({age} years)")
    else:
        criteria_not_met.append(f"Age < 50 ({age} years)")

    # 2. Family History Multiplier
    fam_history_raw = str(inputs.get("family_history_breast_cancer") or inputs.get("family_history") or "none").lower().strip()
    if "multiple" in fam_history_raw:
        fam_mult = 2.4
        fam_label = "multiple"
    elif "first" in fam_history_raw or fam_history_raw in ("yes", "true", "1"):
        fam_mult = 1.8
        fam_label = "first_degree"
    elif "second" in fam_history_raw:
        fam_mult = 1.3
        fam_label = "second_degree"
    else:
        fam_mult = 1.0
        fam_label = "none"

    contributions.append(
        FactorContribution(
            factor_name="Family History",
            value=fam_label.replace("_", " ").title(),
            reference_range="None (no first/second-degree relatives)",
            contribution_direction="increases_risk" if fam_mult > 1.0 else "neutral",
            contribution_magnitude=round(min(fam_mult - 1.0, 1.0), 2) if fam_mult > 1.0 else 0.0,
            explanation=f"Family history category '{fam_label}' applies a risk multiplier of {fam_mult:.1f}x to base age risk.",
        )
    )
    if fam_mult > 1.0:
        criteria_met.append(f"Family history of breast cancer ({fam_label.replace('_', ' ')})")
    else:
        criteria_not_met.append("No significant family history of breast cancer")

    base = age_risk * fam_mult

    # 3. Additional Risk Factors
    additions = 0.0

    # Palpable Lump
    has_lump = _parse_bool(inputs.get("palpable_lump"))
    if has_lump:
        additions += 0.20
        criteria_met.append("Palpable breast lump present")
        contributions.append(
            FactorContribution(
                factor_name="Palpable Lump",
                value="Yes",
                reference_range="No",
                contribution_direction="increases_risk",
                contribution_magnitude=0.20,
                explanation="Palpable breast mass identified on clinical examination (+0.20 risk weighting).",
            )
        )

        # Lump Size
        raw_size = inputs.get("lump_size_cm") or inputs.get("lump_size") or 0.0
        try:
            lump_size = float(raw_size)
        except (ValueError, TypeError):
            lump_size = 0.0

        size_addition = 0.0
        if lump_size > 4.0:
            size_addition = 0.10 + 0.20  # Cumulative: >2cm (+0.10) and >4cm (+0.20)
            criteria_met.append(f"Lump size > 4.0 cm ({lump_size:.1f} cm)")
            contributions.append(
                FactorContribution(
                    factor_name="Lump Size",
                    value=f"{lump_size:.1f} cm",
                    reference_range="< 2.0 cm",
                    contribution_direction="increases_risk",
                    contribution_magnitude=round(size_addition, 2),
                    explanation=f"Large palpable lesion > 4.0 cm (+0.30 cumulative risk addition).",
                )
            )
        elif lump_size > 2.0:
            size_addition = 0.10
            criteria_met.append(f"Lump size > 2.0 cm ({lump_size:.1f} cm)")
            contributions.append(
                FactorContribution(
                    factor_name="Lump Size",
                    value=f"{lump_size:.1f} cm",
                    reference_range="< 2.0 cm",
                    contribution_direction="increases_risk",
                    contribution_magnitude=0.10,
                    explanation=f"Palpable lesion > 2.0 cm (+0.10 risk addition).",
                )
            )
        else:
            criteria_not_met.append("Lump size <= 2.0 cm")
            contributions.append(
                FactorContribution(
                    factor_name="Lump Size",
                    value=f"{lump_size:.1f} cm" if lump_size > 0 else "N/A",
                    reference_range="< 2.0 cm",
                    contribution_direction="neutral",
                    contribution_magnitude=0.0,
                    explanation="Lesion size does not exceed the 2.0 cm threshold.",
                )
            )
        additions += size_addition

    else:
        criteria_not_met.append("No palpable breast lump")
        contributions.append(
            FactorContribution(
                factor_name="Palpable Lump",
                value="No",
                reference_range="No",
                contribution_direction="neutral",
                contribution_magnitude=0.0,
                explanation="No palpable breast mass reported on examination.",
            )
        )

    # Nipple Discharge
    has_discharge = _parse_bool(inputs.get("nipple_discharge"))
    if has_discharge:
        additions += 0.08
        criteria_met.append("Pathological nipple discharge")
        contributions.append(
            FactorContribution(
                factor_name="Nipple Discharge",
                value="Yes",
                reference_range="No",
                contribution_direction="increases_risk",
                contribution_magnitude=0.08,
                explanation="Spontaneous or suspicious nipple discharge (+0.08 risk weighting).",
            )
        )
    else:
        criteria_not_met.append("No nipple discharge")
        contributions.append(
            FactorContribution(
                factor_name="Nipple Discharge",
                value="No",
                reference_range="No",
                contribution_direction="neutral",
                contribution_magnitude=0.0,
                explanation="No nipple discharge present.",
            )
        )

    # Skin Changes
    has_skin_changes = _parse_bool(inputs.get("skin_changes"))
    if has_skin_changes:
        additions += 0.12
        criteria_met.append("Skin changes (dimpling, edema, or retraction)")
        contributions.append(
            FactorContribution(
                factor_name="Skin Changes",
                value="Yes",
                reference_range="No",
                contribution_direction="increases_risk",
                contribution_magnitude=0.12,
                explanation="Cutaneous alterations including skin dimpling, tethering, or peau d'orange (+0.12 risk weighting).",
            )
        )
    else:
        criteria_not_met.append("No skin changes")
        contributions.append(
            FactorContribution(
                factor_name="Skin Changes",
                value="No",
                reference_range="No",
                contribution_direction="neutral",
                contribution_magnitude=0.0,
                explanation="Skin architecture normal with no focal retraction.",
            )
        )

    # Previous Biopsy
    has_biopsy = _parse_bool(inputs.get("previous_biopsy"))
    if has_biopsy:
        additions += 0.10
        criteria_met.append("History of previous breast biopsy")
        contributions.append(
            FactorContribution(
                factor_name="Previous Biopsy",
                value="Yes",
                reference_range="No",
                contribution_direction="increases_risk",
                contribution_magnitude=0.10,
                explanation="Prior history of breast biopsy (+0.10 risk weighting).",
            )
        )
    else:
        criteria_not_met.append("No prior breast biopsy")
        contributions.append(
            FactorContribution(
                factor_name="Previous Biopsy",
                value="No",
                reference_range="No",
                contribution_direction="neutral",
                contribution_magnitude=0.0,
                explanation="No prior diagnostic breast biopsy.",
            )
        )

    # Menopausal Status
    meno_status = str(inputs.get("menopausal_status") or "").strip().lower()
    is_postmenopausal = meno_status in ("postmenopausal", "post", "post-menopausal")
    if is_postmenopausal:
        additions += 0.08
        criteria_met.append("Postmenopausal status")
        contributions.append(
            FactorContribution(
                factor_name="Menopausal Status",
                value=meno_status.title(),
                reference_range="Premenopausal",
                contribution_direction="increases_risk",
                contribution_magnitude=0.08,
                explanation="Postmenopausal status associated with cumulative lifelong estrogen exposure (+0.08 risk weighting).",
            )
        )
    else:
        criteria_not_met.append(f"Menopausal status: {meno_status.title() if meno_status else 'Premenopausal'}")
        contributions.append(
            FactorContribution(
                factor_name="Menopausal Status",
                value=meno_status.title() if meno_status else "Premenopausal",
                reference_range="Premenopausal",
                contribution_direction="neutral",
                contribution_magnitude=0.0,
                explanation="Premenopausal/perimenopausal status carrying baseline risk weighting.",
            )
        )

    # Image Quality limitation check
    img_qual = str(inputs.get("image_quality") or "").strip().lower()
    if img_qual in ("poor", "suboptimal", "unsatisfactory"):
        limitations.append("Image quality was poor which may affect image model accuracy")

    # Score calculation
    raw_score = base + additions
    formula_score = round(min(raw_score, 1.0), 4)

    # Risk Tier assignment
    if raw_score < 0.20:
        risk_tier = "low"
    elif raw_score < 0.40:
        risk_tier = "moderate"
    elif raw_score <= 0.65:
        risk_tier = "high"
    else:
        risk_tier = "critical"

    # Interpretation text
    top_contributors = [
        c.factor_name for c in sorted(contributions, key=lambda x: x.contribution_magnitude, reverse=True)
        if c.contribution_direction == "increases_risk" and c.contribution_magnitude > 0
    ]
    factors_str = ", ".join(top_contributors[:3]) if top_contributors else "age-appropriate baseline demographics"

    if risk_tier == "critical":
        interpretation = (
            f"Critical risk tier (score: {formula_score:.2f}). Marked elevation in clinical risk driven by "
            f"{factors_str}. Immediate diagnostic mammogram, targeted ultrasound, and histological biopsy strongly recommended."
        )
    elif risk_tier == "high":
        interpretation = (
            f"High risk tier (score: {formula_score:.2f}). Elevated clinical risk primarily influenced by "
            f"{factors_str}. Full diagnostic imaging workup and clinical breast examination recommended within 2 weeks."
        )
    elif risk_tier == "moderate":
        interpretation = (
            f"Moderate risk tier (score: {formula_score:.2f}). Intermediate clinical risk driven by "
            f"{factors_str}. Recommend 6-month clinical follow-up and surveillance imaging."
        )
    else:
        interpretation = (
            f"Low risk tier (score: {formula_score:.2f}). Clinical inputs demonstrate baseline epidemiological risk with "
            f"no suspicious physical findings. Routine age-appropriate screening intervals recommended."
        )

    return FormulaResult(
        formula_score=formula_score,
        formula_name="Modified Gail Model (clinical approximation)",
        raw_score=round(raw_score, 4),
        risk_tier=risk_tier,
        contributions=contributions,
        criteria_met=criteria_met,
        criteria_not_met=criteria_not_met,
        interpretation=interpretation,
        clinical_basis=(
            "Based on Gail et al. 1989 and Tyrer-Cuzick risk factor weighting. "
            "This is a clinical approximation for decision support purposes."
        ),
        limitations=limitations,
    )
