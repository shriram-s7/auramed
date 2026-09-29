"""
Cervical Risk Computation Module.
Implements Bethesda System (2014) risk tier assignment and clinical action
recommendations combining cytopathology classification and epidemiological modifiers.
"""
from typing import Any, Dict, List, Optional
from app.ml.formulas.base import FactorContribution, FormulaResult


def _parse_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in ("yes", "true", "1", "positive", "present")
    if isinstance(val, (int, float)):
        return bool(val)
    return False


BETHESDA_MAP = {
    "normal": ("NILM", "Negative for Intraepithelial Lesion or Malignancy", 0.05),
    "nilm": ("NILM", "Negative for Intraepithelial Lesion or Malignancy", 0.05),
    "metaplastic": ("ASC-US", "Atypical Squamous Cells of Undetermined Significance", 0.25),
    "asc-us": ("ASC-US", "Atypical Squamous Cells of Undetermined Significance", 0.25),
    "ascus": ("ASC-US", "Atypical Squamous Cells of Undetermined Significance", 0.25),
    "koilocytotic": ("LSIL", "Low-grade Squamous Intraepithelial Lesion", 0.40),
    "lsil": ("LSIL", "Low-grade Squamous Intraepithelial Lesion", 0.40),
    "parabasal": ("ASC-H", "Atypical Squamous Cells, cannot exclude HSIL", 0.60),
    "asc-h": ("ASC-H", "Atypical Squamous Cells, cannot exclude HSIL", 0.60),
    "asch": ("ASC-H", "Atypical Squamous Cells, cannot exclude HSIL", 0.60),
    "dyskeratotic": ("HSIL", "High-grade Squamous Intraepithelial Lesion", 0.80),
    "hsil": ("HSIL", "High-grade Squamous Intraepithelial Lesion", 0.80),
}


def compute_cervical_risk(
    inputs: Dict[str, Any],
    cytology_class: Optional[str] = None,
) -> FormulaResult:
    """
    Evaluates cervical cancer risk according to the Bethesda System 2014.

    Inputs used:
      age: int
      hpv_status: str (positive/negative/unknown)
      sample_adequacy: str (satisfactory/unsatisfactory)
      history_of_abnormal_pap: str (yes/no)
      smoking_status: str (current/former/never)
      immunocompromised: str (yes/no)
      cytology_class: str (from image model or inputs: Normal/Koilocytotic/Metaplastic/Parabasal/Dyskeratotic)
    """
    contributions: List[FactorContribution] = []
    criteria_met: List[str] = []
    criteria_not_met: List[str] = []
    limitations: List[str] = []

    # 1. Resolve Cytology Class & Bethesda Mapping
    raw_cyto = (
        cytology_class
        or inputs.get("cytology_class")
        or inputs.get("cytology_result")
        or inputs.get("bethesda_classification")
        or "Normal"
    )
    cyto_key = str(raw_cyto).strip().lower()
    bethesda_abbr, bethesda_desc, base_risk = BETHESDA_MAP.get(
        cyto_key,
        ("NILM", "Negative for Intraepithelial Lesion or Malignancy", 0.05),
    )

    contributions.append(
        FactorContribution(
            factor_name="Bethesda Cytology Class",
            value=f"{raw_cyto} → {bethesda_abbr}",
            reference_range="NILM (Negative for Intraepithelial Lesion or Malignancy)",
            contribution_direction="increases_risk" if base_risk > 0.05 else "neutral",
            contribution_magnitude=round(base_risk, 2),
            explanation=f"Cytomorphology mapped to {bethesda_abbr} ({bethesda_desc}), establishing a base risk of {base_risk:.2f}.",
        )
    )
    if bethesda_abbr != "NILM":
        criteria_met.append(f"Abnormal cytology: {bethesda_abbr} ({bethesda_desc})")
    else:
        criteria_not_met.append("Normal cytology: NILM (Negative for Intraepithelial Lesion or Malignancy)")

    # 2. Risk Modifiers
    modifiers = 0.0

    # HPV Status
    hpv_raw = str(inputs.get("hpv_status") or inputs.get("hpv_dna") or "unknown").strip().lower()
    if hpv_raw in ("positive", "pos", "detected", "high_risk", "high-risk"):
        modifiers += 0.15
        criteria_met.append("High-Risk HPV positive")
        contributions.append(
            FactorContribution(
                factor_name="HPV DNA Status",
                value="Positive",
                reference_range="Negative",
                contribution_direction="increases_risk",
                contribution_magnitude=0.15,
                explanation="High-risk Human Papillomavirus (HR-HPV) detected (+0.15 risk weighting).",
            )
        )
    elif hpv_raw in ("unknown", "not_tested", "pending"):
        modifiers += 0.05
        criteria_met.append("HPV status unknown/untested")
        contributions.append(
            FactorContribution(
                factor_name="HPV DNA Status",
                value="Unknown / Not Tested",
                reference_range="Negative",
                contribution_direction="increases_risk",
                contribution_magnitude=0.05,
                explanation="HPV status unverified; modest presumptive risk adjustment applied (+0.05).",
            )
        )
    else:
        criteria_not_met.append("High-Risk HPV negative")
        contributions.append(
            FactorContribution(
                factor_name="HPV DNA Status",
                value="Negative",
                reference_range="Negative",
                contribution_direction="decreases_risk",
                contribution_magnitude=0.0,
                explanation="High-risk HPV testing negative, confirming low viral persistence risk.",
            )
        )

    # History of Abnormal Pap
    has_prior_abnormal = _parse_bool(inputs.get("history_of_abnormal_pap") or inputs.get("prior_abnormal_pap"))
    if has_prior_abnormal:
        modifiers += 0.10
        criteria_met.append("History of prior abnormal Pap smear")
        contributions.append(
            FactorContribution(
                factor_name="Prior Abnormal Pap Smear",
                value="Yes",
                reference_range="No",
                contribution_direction="increases_risk",
                contribution_magnitude=0.10,
                explanation="Documented clinical history of prior epithelial cell abnormalities (+0.10).",
            )
        )
    else:
        criteria_not_met.append("No prior abnormal Pap history")
        contributions.append(
            FactorContribution(
                factor_name="Prior Abnormal Pap Smear",
                value="No",
                reference_range="No",
                contribution_direction="neutral",
                contribution_magnitude=0.0,
                explanation="No previous abnormal cervical screening findings reported.",
            )
        )

    # Immunocompromised Status
    is_immunocompromised = _parse_bool(inputs.get("immunocompromised") or inputs.get("immunosuppressed"))
    if is_immunocompromised:
        modifiers += 0.10
        criteria_met.append("Immunocompromised host status")
        contributions.append(
            FactorContribution(
                factor_name="Immune Competence",
                value="Immunocompromised",
                reference_range="Immunocompetent",
                contribution_direction="increases_risk",
                contribution_magnitude=0.10,
                explanation="Immunosuppression increases risk of persistent HPV infection and rapid progression (+0.10).",
            )
        )
    else:
        criteria_not_met.append("Immunocompetent")
        contributions.append(
            FactorContribution(
                factor_name="Immune Competence",
                value="Immunocompetent",
                reference_range="Immunocompetent",
                contribution_direction="neutral",
                contribution_magnitude=0.0,
                explanation="No systemic immunosuppression or active immunodeficiency noted.",
            )
        )

    # Age > 45 with LSIL or above
    raw_age = inputs.get("age", 35)
    try:
        age = int(raw_age)
    except (ValueError, TypeError):
        age = 35

    is_lsil_or_above = bethesda_abbr in ("LSIL", "ASC-H", "HSIL")
    if age > 45 and is_lsil_or_above:
        modifiers += 0.05
        criteria_met.append(f"Age > 45 with {bethesda_abbr} lesion ({age} years)")
        contributions.append(
            FactorContribution(
                factor_name="Age / Lesion Interaction",
                value=f"{age} years with {bethesda_abbr}",
                reference_range="Age <= 45 or NILM",
                contribution_direction="increases_risk",
                contribution_magnitude=0.05,
                explanation="Age > 45 combined with low-grade or high-grade dysplasia increases persistence risk (+0.05).",
            )
        )
    else:
        if age > 45:
            criteria_not_met.append(f"Age > 45 without high-grade lesion ({age} years, {bethesda_abbr})")
        else:
            criteria_not_met.append(f"Age <= 45 ({age} years)")

    # Smoking Status
    smoke_raw = str(inputs.get("smoking_status") or "never").strip().lower()
    is_current_smoker = "current" in smoke_raw or smoke_raw == "yes"
    if is_current_smoker:
        modifiers += 0.05
        criteria_met.append("Current tobacco smoking")
        contributions.append(
            FactorContribution(
                factor_name="Smoking Status",
                value="Current Smoker",
                reference_range="Never / Former Smoker",
                contribution_direction="increases_risk",
                contribution_magnitude=0.05,
                explanation="Current smoking impairs local mucosal cell-mediated immunity in the cervical transformation zone (+0.05).",
            )
        )
    else:
        criteria_not_met.append(f"Smoking status: {smoke_raw.title()}")
        contributions.append(
            FactorContribution(
                factor_name="Smoking Status",
                value=smoke_raw.title(),
                reference_range="Never Smoker",
                contribution_direction="neutral",
                contribution_magnitude=0.0,
                explanation="No active cigarette smoking.",
            )
        )

    # Sample Adequacy Check
    adequacy_raw = str(inputs.get("sample_adequacy") or "satisfactory").strip().lower()
    if adequacy_raw in ("unsatisfactory", "inadequate", "suboptimal"):
        limitations.append("Results may be less reliable due to unsatisfactory sample adequacy")

    # 3. Final Score & Action Recommendation
    raw_score = base_risk + modifiers
    final_score = round(min(raw_score, 1.0), 4)

    # Risk Tier
    if final_score < 0.20:
        risk_tier = "low"
    elif final_score < 0.40:
        risk_tier = "moderate"
    elif final_score <= 0.65:
        risk_tier = "high"
    else:
        risk_tier = "critical"

    # Action Recommendation by final score
    if final_score < 0.20:
        rec_action = "Routine age-appropriate screening. Next screen in 3 years."
    elif final_score < 0.40:
        rec_action = "Repeat cytology in 12 months or HPV co-test."
    elif final_score <= 0.65:
        rec_action = "Colposcopy recommended."
    elif final_score <= 0.80:
        rec_action = "Colposcopy and biopsy recommended."
    else:
        rec_action = "Immediate colposcopy and excisional treatment."

    interpretation = (
        f"Bethesda Classification: {bethesda_abbr} ({bethesda_desc}). "
        f"Calculated risk score: {final_score:.2f} ({risk_tier.upper()} risk). "
        f"Recommended Action: {rec_action}"
    )

    return FormulaResult(
        formula_score=final_score,
        formula_name="Bethesda System 2014 Risk Stratification",
        raw_score=round(raw_score, 4),
        risk_tier=risk_tier,
        contributions=contributions,
        criteria_met=criteria_met,
        criteria_not_met=criteria_not_met,
        interpretation=interpretation,
        clinical_basis=(
            "The Bethesda System for Reporting Cervical Cytology, 3rd Edition, 2015. "
            "Nayar R, Wilbur DC."
        ),
        limitations=limitations,
    )
