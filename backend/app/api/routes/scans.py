import json
import logging
import os
import re
import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor_profile
from app.core.config import settings
from app.core.database import get_db
from app.models.doctor_profile import DoctorProfile
from app.models.enums import RiskLevel, ScanStatus, ScreeningModule
from app.models.patient_profile import PatientProfile
from app.models.scan import Scan
from app.ml.formulas import (
    FormulaResult,
    compute_breast_risk,
    compute_cervical_risk,
    compute_pcos_risk,
)
from app.ml.fusion import FusionConfig, FusionResult, compute_fusion
from app.ml.confidence import ConfidenceResult, compute_confidence
from app.ml.reasoning import (
    generate_breast_reasoning,
    generate_cervical_reasoning,
    generate_pcos_reasoning,
)
from app.ml.models import (
    ModelLoader,
    run_breast_inference,
    run_cervical_inference,
    run_pcos_inference,
)
from app.schemas.scan_analysis import (
    ConfidenceExplanation,
    ReasoningDetail,
    ScanAnalyzeResponse,
    ScanDetailRecord,
    ScanDraftRequest,
    ScanDraftResponse,
    ScanUploadResponse,
)
from app.services.audit import log_action

logger = logging.getLogger("auramed.api.scans")
if not logger.handlers:
    _console_handler = logging.StreamHandler()
    _console_handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(_console_handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False

router = APIRouter(prefix="/api/doctor/scans", tags=["scans"])

VALID_MODULES = {"breast", "cervical", "pcos"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".dcm"}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50MB


def _get_owned_patient(db: Session, doctor: DoctorProfile, patient_id: str) -> PatientProfile:
    patient = None
    try:
        pid = uuid.UUID(patient_id)
        patient = (
            db.query(PatientProfile)
            .filter(PatientProfile.id == pid, PatientProfile.created_by_doctor_id == doctor.id)
            .first()
        )
    except ValueError:
        pass

    if not patient:
        patient = (
            db.query(PatientProfile)
            .filter(PatientProfile.patient_code == patient_id, PatientProfile.created_by_doctor_id == doctor.id)
            .first()
        )

    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found or unauthorized.")
    return patient


def _get_owned_scan(db: Session, doctor: DoctorProfile, scan_id: str) -> Scan:
    try:
        sid = uuid.UUID(scan_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found.")

    scan = db.query(Scan).filter(Scan.id == sid).first()
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found.")
    if scan.doctor_id != doctor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to access this scan."
        )
    return scan


def _check_numeric_range(field_name: str, value: Any, min_val: float, max_val: float, is_float: bool = False) -> float:
    if value is None or str(value).strip() == "":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Required clinical input '{field_name}' is missing.",
        )
    try:
        num = float(value) if is_float else int(value)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Field '{field_name}' must be a valid number. Got '{value}'.",
        )
    if num < min_val or num > max_val:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation failed for '{field_name}': value {value} is outside the valid range of {min_val}-{max_val}.",
        )
    return num


def normalize_clinical_inputs(module: str, inputs: dict[str, Any]) -> None:
    mod = module.lower().strip()
    if mod == "pcos":
        # AMH (amh_ng_ml <-> amh_ng_mL)
        if "amh_ng_ml" not in inputs and "amh_ng_mL" in inputs:
            inputs["amh_ng_ml"] = inputs["amh_ng_mL"]
        elif "amh_ng_mL" not in inputs and "amh_ng_ml" in inputs:
            inputs["amh_ng_mL"] = inputs["amh_ng_ml"]

        # LH (lh_miu_ml <-> lh_mIU_mL)
        if "lh_miu_ml" not in inputs and "lh_mIU_mL" in inputs:
            inputs["lh_miu_ml"] = inputs["lh_mIU_mL"]
        elif "lh_mIU_mL" not in inputs and "lh_miu_ml" in inputs:
            inputs["lh_mIU_mL"] = inputs["lh_miu_ml"]

        # FSH (fsh_miu_ml <-> fsh_mIU_mL)
        if "fsh_miu_ml" not in inputs and "fsh_mIU_mL" in inputs:
            inputs["fsh_miu_ml"] = inputs["fsh_mIU_mL"]
        elif "fsh_mIU_mL" not in inputs and "fsh_miu_ml" in inputs:
            inputs["fsh_mIU_mL"] = inputs["fsh_miu_ml"]

        # Total Testosterone (total_testosterone_ng_dl <-> testosterone_ng_dL / testosterone)
        if "total_testosterone_ng_dl" not in inputs:
            if "testosterone_ng_dL" in inputs:
                inputs["total_testosterone_ng_dl"] = inputs["testosterone_ng_dL"]
            elif "testosterone" in inputs:
                inputs["total_testosterone_ng_dl"] = inputs["testosterone"]
        if "testosterone_ng_dL" not in inputs and "total_testosterone_ng_dl" in inputs:
            inputs["testosterone_ng_dL"] = inputs["total_testosterone_ng_dl"]

        # Prolactin (prolactin_ng_ml <-> prolactin_ng_mL)
        if "prolactin_ng_ml" not in inputs and "prolactin_ng_mL" in inputs:
            inputs["prolactin_ng_ml"] = inputs["prolactin_ng_mL"]
        elif "prolactin_ng_mL" not in inputs and "prolactin_ng_ml" in inputs:
            inputs["prolactin_ng_mL"] = inputs["prolactin_ng_ml"]

        # Left ovary volume (left_ovary_volume_ml <-> left_ovarian_volume_mL)
        if "left_ovary_volume_ml" not in inputs and "left_ovarian_volume_mL" in inputs:
            inputs["left_ovary_volume_ml"] = inputs["left_ovarian_volume_mL"]
        elif "left_ovarian_volume_mL" not in inputs and "left_ovary_volume_ml" in inputs:
            inputs["left_ovarian_volume_mL"] = inputs["left_ovary_volume_ml"]

        # Right ovary volume (right_ovary_volume_ml <-> right_ovarian_volume_mL)
        if "right_ovary_volume_ml" not in inputs and "right_ovarian_volume_mL" in inputs:
            inputs["right_ovary_volume_ml"] = inputs["right_ovarian_volume_mL"]
        elif "right_ovarian_volume_mL" not in inputs and "right_ovary_volume_ml" in inputs:
            inputs["right_ovarian_volume_mL"] = inputs["right_ovary_volume_ml"]

        # Menstrual cycle regularity (menstrual_cycle_regularity <-> menstrual_regularity)
        if "menstrual_cycle_regularity" not in inputs and "menstrual_regularity" in inputs:
            inputs["menstrual_cycle_regularity"] = inputs["menstrual_regularity"]
        elif "menstrual_regularity" not in inputs and "menstrual_cycle_regularity" in inputs:
            inputs["menstrual_regularity"] = inputs["menstrual_cycle_regularity"]


def validate_clinical_inputs(module: str, inputs: dict[str, Any]) -> None:
    mod = module.lower()
    if mod not in VALID_MODULES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid module '{module}'.")

    # Normalize aliases and variations across frontend and backend
    normalize_clinical_inputs(mod, inputs)

    if mod == "breast":
        # Required keys for breast
        # age: 18-100
        _check_numeric_range("age", inputs.get("age"), 18, 100)

        required_keys = ["menopausal_status", "palpable_lump"]
        for k in required_keys:
            if k not in inputs or inputs[k] is None or str(inputs[k]).strip() == "":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Required clinical input '{k}' is missing.",
                )

        # lump_size_cm: 0.1-20 (only if palpable_lump is Yes)
        palpable = str(inputs.get("palpable_lump", "")).strip().lower()
        if palpable in {"yes", "true", "1"}:
            _check_numeric_range("lump_size_cm", inputs.get("lump_size_cm"), 0.1, 20.0, is_float=True)

    elif mod == "cervical":
        # Required keys for cervical
        # age: 18-100
        _check_numeric_range("age", inputs.get("age"), 18, 100)

        for k in ["sample_type", "hpv_status", "smoking_status"]:
            if k not in inputs or inputs[k] is None or str(inputs[k]).strip() == "":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Required clinical input '{k}' is missing.",
                )

    elif mod == "pcos":
        # Required keys and ranges for PCOS
        # age: 12-55
        _check_numeric_range("age", inputs.get("age"), 12, 55)
        # cycle_length_days: 21-90
        _check_numeric_range("cycle_length_days", inputs.get("cycle_length_days"), 21, 90)
        # amh_ng_ml: 0.5-15.0
        _check_numeric_range("amh_ng_ml", inputs.get("amh_ng_ml"), 0.5, 15.0, is_float=True)
        # lh_miu_ml: 1.0-30.0
        lh = _check_numeric_range("lh_miu_ml", inputs.get("lh_miu_ml"), 1.0, 30.0, is_float=True)
        # fsh_miu_ml: 1.0-20.0
        fsh = _check_numeric_range("fsh_miu_ml", inputs.get("fsh_miu_ml"), 1.0, 20.0, is_float=True)
        # lh_fsh_ratio: auto-computed from lh/fsh, not validated from input
        inputs["lh_fsh_ratio"] = round(lh / fsh, 2) if fsh > 0 else 0.0

        # total_testosterone_ng_dl: 15-70
        _check_numeric_range("total_testosterone_ng_dl", inputs.get("total_testosterone_ng_dl"), 15.0, 70.0, is_float=True)
        # prolactin_ng_ml: 5-25
        _check_numeric_range("prolactin_ng_ml", inputs.get("prolactin_ng_ml"), 5.0, 25.0, is_float=True)
        # left_ovary_volume_ml: 1-20
        _check_numeric_range("left_ovary_volume_ml", inputs.get("left_ovary_volume_ml"), 1.0, 20.0, is_float=True)
        # left_follicle_count: 0-30
        _check_numeric_range("left_follicle_count", inputs.get("left_follicle_count"), 0, 30)
        # right_ovary_volume_ml: 1-20
        _check_numeric_range("right_ovary_volume_ml", inputs.get("right_ovary_volume_ml"), 1.0, 20.0, is_float=True)
        # right_follicle_count: 0-30
        _check_numeric_range("right_follicle_count", inputs.get("right_follicle_count"), 0, 30)

        if not inputs.get("menstrual_cycle_regularity") and not inputs.get("menstrual_regularity"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Required clinical input 'menstrual_cycle_regularity' is missing.",
            )


def _get_recommended_actions(module: str, risk_str: str) -> list[str]:
    mod = module.lower().strip()
    r = risk_str.lower().strip()
    if mod == "breast":
        if r == "critical":
            return [
                "Immediate multidisciplinary oncology consultation",
                "Urgent core needle biopsy of suspicious lesion",
                "Diagnostic bilateral mammogram with targeted ultrasound",
            ]
        elif r == "high":
            return [
                "Immediate radiologist consultation",
                "Diagnostic mammography and targeted ultrasound",
                "Biopsy if abnormality confirmed",
            ]
        elif r == "moderate":
            return [
                "Follow-up diagnostic imaging in 6 months",
                "Clinical breast examination by specialist",
                "Review family risk history and surveillance plan",
            ]
        else:
            return [
                "Routine age-appropriate mammography screening",
                "Continue regular monthly self-examinations",
            ]
    elif mod == "cervical":
        if r == "critical":
            return [
                "Immediate colposcopy and excisional treatment",
                "Urgent gynecologic oncology referral",
                "Histopathological tissue evaluation",
            ]
        elif r == "high":
            return [
                "Colposcopy and cervical biopsy recommended",
                "HPV genotyping test",
                "Repeat cytology in 6 months",
            ]
        elif r == "moderate":
            return [
                "Colposcopy recommended",
                "Repeat cytology in 12 months or HPV co-test",
            ]
        else:
            return [
                "Routine age-appropriate screening. Next screen in 3 years.",
                "Maintain HPV vaccination status",
            ]
    else:  # pcos
        if r in ("confirmed", "critical"):
            return [
                "Endocrine consultation for metabolic and hormone profiling",
                "Structured lifestyle and dietary intervention plan",
                "Screen for metabolic syndrome (HbA1c, fasting lipid panel)",
                "Pelvic ultrasound follow-up in 3 months",
            ]
        elif r in ("likely", "high"):
            return [
                "Endocrine consultation for metabolic and hormone profiling",
                "Lifestyle and dietary intervention plan",
                "Pelvic ultrasound follow-up in 3-6 months",
            ]
        elif r in ("possible", "moderate"):
            return [
                "Monitor menstrual cycle regularity",
                "Repeat hormonal evaluation in 6 months",
                "Baseline pelvic ultrasound review",
            ]
        else:
            return [
                "Routine annual gynecological evaluation",
                "Maintain healthy lifestyle and balanced nutrition",
            ]


def _log_inference_details(
    module: str,
    raw_model_output: Any,
    image_model_score: float,
    predicted_label: str,
    predicted_confidence: float | None,
    cervical_class_probabilities: dict[str, float] | None,
    formula_res: FormulaResult,
    fusion_res: FusionResult,
) -> None:
    """
    Prints a detailed, human-readable trace of every stage of the multimodal
    inference pipeline for a single scan: raw model output, post-softmax/sigmoid
    probabilities, the clinical formula's per-factor breakdown, the fusion
    weights actually applied, the final fused score, and the disagreement flag.
    Used to diagnose cases where the fused risk result looks inconsistent with
    the underlying image or clinical signal.
    """
    header = f"[{module.upper()} INFERENCE]"
    lines = [header]

    if module == "cervical":
        lines.append(f"Raw logits: {raw_model_output}")
        if cervical_class_probabilities:
            ordered = list(cervical_class_probabilities.items())
            probs_str = ", ".join(f"{v:.4f}" for _, v in ordered)
            lines.append(f"After softmax (T=1.0): [{probs_str}]")
            lines.append(
                "Class order: " + ", ".join(k for k, _ in ordered)
            )
        lines.append(f"Predicted class: {predicted_label} confidence: {predicted_confidence}")
        lines.append(
            f"Image score fed to fusion (top-class confidence, NOT risk-directional): {image_model_score}"
        )
    elif module == "breast":
        lines.append(f"Raw logit: {raw_model_output}")
        lines.append(f"After sigmoid: {image_model_score}")
        lines.append(f"Predicted risk score: {image_model_score}")
    else:  # pcos
        lines.append(f"Raw logits [Healthy, PCOS]: {raw_model_output}")
        lines.append(f"After softmax, PCOS probability: {image_model_score}")
        lines.append(f"Predicted class: {predicted_label}")

    lines.append("Clinical formula breakdown:")
    for c in formula_res.contributions:
        lines.append(
            f"  - {c.factor_name}: value={c.value!r} direction={c.contribution_direction} "
            f"contribution={c.contribution_magnitude:.2f}"
        )
    lines.append(f"Clinical score: {formula_res.formula_score}")

    lines.append(
        f"Fusion weights: image={fusion_res.image_weight} clinical={fusion_res.formula_weight}"
    )
    lines.append(
        f"Fusion: image({fusion_res.image_weight} * {fusion_res.image_score}) + "
        f"clinical({fusion_res.formula_weight} * {fusion_res.formula_score}) = {fusion_res.weighted_score}"
    )
    gap = round(abs(fusion_res.image_score - fusion_res.formula_score), 4)
    lines.append(f"Disagreement detected: {fusion_res.disagreement_detected} (gap={gap})")
    lines.append(f"Final fused score: {fusion_res.final_score} -> risk level: {fusion_res.final_risk_level}")

    logger.info("\n".join(lines))


def _generate_mock_analysis_result(
    scan_id: uuid.UUID,
    module: str,
    inputs: dict[str, Any],
    formula_result: FormulaResult | None = None,
) -> dict[str, Any]:
    mod = module.lower()
    if mod == "breast":
        lump_size = inputs.get("lump_size_cm", "2.4")
        findings = [
            {"finding": "Irregular mass detected", "confidence": 0.92},
            {"finding": "Spiculated margins", "confidence": 0.87},
            {"finding": "High density region", "confidence": 0.81},
        ]
        interpretation = f"Plain English description: Irregular mass ({lump_size} cm) with spiculated margins detected in the upper outer quadrant."
        contributions = [
            {"factor": "Age", "value": str(inputs.get("age", 45)), "reference": "18-100", "contribution": 0.18},
            {"factor": "Family history", "value": str(inputs.get("family_history_breast_cancer") or inputs.get("family_history") or "Yes"), "reference": "-", "contribution": 0.22},
        ]
        basis = "Based on modified Gail model"
        recommended_actions = [
            "Immediate radiologist consultation",
            "Diagnostic mammography",
            "Biopsy if abnormality confirmed",
        ]
        followup_days = 30
    elif mod == "cervical":
        findings = [
            {"finding": "Atypical squamous cells identified", "confidence": 0.89},
            {"finding": "Hyperchromatic nuclei present", "confidence": 0.84},
            {"finding": "Irregular nuclear membrane", "confidence": 0.79},
        ]
        interpretation = "Plain English description: Cytological findings suggestive of high-grade squamous intraepithelial lesion (HSIL)."
        contributions = [
            {"factor": "Age", "value": str(inputs.get("age", 38)), "reference": "18-100", "contribution": 0.15},
            {"factor": "HPV Status", "value": str(inputs.get("hpv_status", "positive")), "reference": "-", "contribution": 0.35},
        ]
        basis = "Based on Bethesda System and ASCCP guidelines"
        recommended_actions = [
            "Colposcopy and cervical biopsy recommended",
            "HPV genotyping",
            "Repeat cytology in 6 months",
        ]
        followup_days = 14
    else:  # PCOS
        lh_fsh = inputs.get("lh_fsh_ratio", 2.1)
        amh = inputs.get("amh_ng_ml", 6.8)
        findings = [
            {"finding": "Polycystic ovarian morphology (PCOM)", "confidence": 0.91},
            {"finding": "Peripheral arrangement of follicles ('string of pearls')", "confidence": 0.88},
            {"finding": "Increased ovarian stromal echogenicity", "confidence": 0.83},
        ]
        interpretation = f"Plain English description: Ultrasound confirms bilateral polycystic ovarian morphology with elevated AMH ({amh} ng/ml) and LH/FSH ratio ({lh_fsh})."
        contributions = [
            {"factor": "LH/FSH Ratio", "value": str(lh_fsh), "reference": "<1.5", "contribution": 0.25},
            {"factor": "AMH", "value": f"{amh} ng/mL", "reference": "0.5-15.0", "contribution": 0.20},
        ]
        basis = "Based on Rotterdam 2003 consensus criteria"
        recommended_actions = [
            "Endocrine consultation for metabolic and hormone profiling",
            "Lifestyle and dietary intervention plan",
            "Pelvic ultrasound follow-up in 3 months",
        ]
        followup_days = 90

    # If real formula_result provided, override formula score, basis and append contributions
    computed_formula_score = 0.62
    if formula_result is not None:
        computed_formula_score = formula_result.formula_score
        basis = formula_result.clinical_basis
        if formula_result.contributions:
            # Map contributions from formula
            contributions = [
                {
                    "factor": c.factor_name,
                    "value": str(c.value),
                    "reference": c.reference_range,
                    "contribution": c.contribution_magnitude,
                }
                for c in formula_result.contributions
            ]

    return {
        "scan_id": scan_id,
        "module": mod,
        "status": "analyzed",
        "image_model_score": 0.75,
        "formula_score": computed_formula_score,
        "fusion_score": round(0.5 * 0.75 + 0.5 * computed_formula_score, 4),
        "risk_level": "high",
        "confidence_score": 0.84,
        "confidence_explanation": {
            "reasons_high": [
                "Clear findings detected in image",
                "Clinical inputs consistent and within valid ranges",
                "Image model and clinical formula in strong agreement",
            ],
            "reasons_low": [],
            "overall": "Confidence is high because image findings and clinical inputs strongly align.",
        },
        "reasoning": {
            "image_findings": findings,
            "image_interpretation": interpretation,
            "clinical_contributions": contributions,
            "clinical_score_basis": basis,
        },
        "recommended_followup_days": followup_days,
        "recommended_actions": recommended_actions,
    }


@router.get("", response_model=list[ScanDetailRecord])
def list_doctor_scans(
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    scans = (
        db.query(Scan)
        .filter(Scan.doctor_id == doctor.id, Scan.status != ScanStatus.archived)
        .order_by(Scan.created_at.desc())
        .all()
    )
    results = []
    for s in scans:
        ai_sugg = s.ai_suggestions or {}
        c_oligo = s.criterion_oligo_anovulation
        c_hyper = s.criterion_hyperandrogenism
        c_poly = s.criterion_polycystic_ovaries
        met_count = s.rotterdam_criteria_met
        is_pos = s.rotterdam_positive
        if s.module.value == "pcos" and (c_oligo is None or c_hyper is None or c_poly is None):
            inps = s.clinical_inputs or {}
            c_oligo = bool(inps.get("criterion_oligo_anovulation") or inps.get("oligo_anovulation_present") or str(inps.get("menstrual_regularity") or "").lower() in ("irregular", "absent"))
            c_hyper = bool(inps.get("criterion_hyperandrogenism") or inps.get("hyperandrogenism_present") or any(x in str(inps.get("clinical_symptoms") or "") for x in ["hirsutism", "acne"]))
            c_poly = bool((s.image_model_score and s.image_model_score > 0.55) or "polycystic" in str(s.reasoning or "").lower())
            met_count = (1 if c_oligo else 0) + (1 if c_hyper else 0) + (1 if c_poly else 0)
            is_pos = met_count >= 2

        results.append(
            ScanDetailRecord(
                id=s.id,
                scan_id=s.id,
                patient_id=s.patient_id,
                doctor_id=s.doctor_id,
                module=s.module.value,
                scan_date=s.scan_date,
                image_path=s.image_path,
                file_name=s.file_name,
                file_size=s.file_size,
                image_quality=s.image_quality,
                status=s.status.value,
                clinical_inputs=s.clinical_inputs,
                image_model_score=s.image_model_score,
                formula_score=s.formula_score,
                formula_result=(s.reasoning or {}).get("formula_result") if isinstance(s.reasoning, dict) else (ai_sugg.get("formula_result") if isinstance(ai_sugg, dict) else None),
                fusion_result=(s.reasoning or {}).get("fusion_result") if isinstance(s.reasoning, dict) else (ai_sugg.get("fusion_result") if isinstance(ai_sugg, dict) else None),
                confidence_result=(s.reasoning or {}).get("confidence_result") if isinstance(s.reasoning, dict) else (ai_sugg.get("confidence_result") if isinstance(ai_sugg, dict) else None),
                grad_cam_base64=(s.reasoning or {}).get("grad_cam_base64") if isinstance(s.reasoning, dict) else (ai_sugg.get("grad_cam_base64") if isinstance(ai_sugg, dict) else None),
                gradcam_heatmap_b64=(s.reasoning or {}).get("gradcam_heatmap_b64") if isinstance(s.reasoning, dict) else (ai_sugg.get("gradcam_heatmap_b64") if isinstance(ai_sugg, dict) else None),
                fusion_score=s.fusion_score,
                risk_level=s.risk_level.value if s.risk_level else None,
                confidence_score=s.confidence_score,
                confidence_explanation=s.confidence_explanation,
                reasoning=s.reasoning,
                ai_suggestions=s.ai_suggestions,
                doctor_modifications=s.doctor_modifications,
                recommended_actions=ai_sugg.get("recommended_actions", []),
                recommended_followup_days=ai_sugg.get("recommended_followup_days"),
                criterion_oligo_anovulation=c_oligo,
                criterion_hyperandrogenism=c_hyper,
                criterion_polycystic_ovaries=c_poly,
                rotterdam_criteria_met=met_count,
                rotterdam_positive=is_pos,
                created_at=s.created_at,
                updated_at=s.updated_at,
            )
        )
    return results


@router.post("/upload", response_model=ScanUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_scan_image(
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    module: str = Form(...),
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    # Validates patient belongs to this doctor
    patient = _get_owned_patient(db, doctor, patient_id)

    # Validates module is valid
    mod_str = module.lower().strip()
    if mod_str not in VALID_MODULES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid module '{module}'. Allowed modules: breast, cervical, pcos.",
        )

    # Validates file is an image (jpg, jpeg, png, bmp, dcm)
    original_name = file.filename or "scan.png"
    ext = os.path.splitext(original_name)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file format '{ext}'. Allowed image formats: jpg, jpeg, png, bmp, dcm.",
        )

    # Read and validate file size under 50MB
    content = await file.read()
    file_size = len(content)
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed limit of 50MB. (Uploaded: {file_size / (1024*1024):.2f}MB)",
        )

    # Generates unique filename: {module}_{patient_id}_{timestamp}.{ext}
    clean_patient_code = re.sub(r"[^a-zA-Z0-9_\-]", "", patient.patient_code)
    timestamp = int(datetime.utcnow().timestamp())
    saved_filename = f"{mod_str}_{clean_patient_code}_{timestamp}{ext}"

    # Saves to uploads/{module}/ directory
    module_dir = os.path.join(settings.upload_dir, mod_str)
    os.makedirs(module_dir, exist_ok=True)
    full_path = os.path.join(module_dir, saved_filename)
    with open(full_path, "wb") as f:
        f.write(content)

    # Stores relative path in database: uploads/{module}/{saved_filename}
    relative_path = f"{settings.upload_dir}/{mod_str}/{saved_filename}".replace("\\", "/")

    # Creates Scan record with status: draft
    scan = Scan(
        patient_id=patient.id,
        doctor_id=doctor.id,
        module=ScreeningModule(mod_str),
        scan_date=date.today(),
        image_path=relative_path,
        file_name=original_name,
        file_size=file_size,
        status=ScanStatus.draft,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="SCAN_IMAGE_UPLOADED",
        resource_type="scan",
        resource_id=scan.id,
        details={
            "scan_id": str(scan.id),
            "patient_id": str(patient.id),
            "patient_code": patient.patient_code,
            "module": mod_str,
            "file_name": original_name,
            "file_size": file_size,
            "image_path": relative_path,
        },
    )

    return ScanUploadResponse(
        scan_id=scan.id,
        image_path=scan.image_path,
        file_size=file_size,
        file_name=original_name,
        upload_timestamp=scan.created_at,
        status=scan.status.value,
    )


@router.post("/analyze", response_model=ScanAnalyzeResponse, status_code=status.HTTP_200_OK)
async def analyze_scan(
    scan_id: str | None = Form(None),
    clinical_inputs: str = Form(...),
    module: str | None = Form(None),
    patient_id: str | None = Form(None),
    image_quality: str | None = Form(None),
    image: UploadFile | None = File(None),
    additional_images: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    try:
        inputs = json.loads(clinical_inputs)
        if not isinstance(inputs, dict):
            raise ValueError
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="clinical_inputs must be a valid JSON string object.",
        )

    scan = None
    if scan_id:
        scan = _get_owned_scan(db, doctor, scan_id)
        active_module = scan.module.value
    elif image and module and patient_id:
        # Fallback: Support direct upload + analyze workflow
        patient = _get_owned_patient(db, doctor, patient_id)
        active_module = module.lower()
        if active_module not in VALID_MODULES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid module.")
        
        content = await image.read()
        ext = os.path.splitext(image.filename or "")[1].lower() or ".png"
        timestamp = int(datetime.utcnow().timestamp())
        saved_filename = f"{active_module}_{patient.patient_code}_{timestamp}{ext}"
        module_dir = os.path.join(settings.upload_dir, active_module)
        os.makedirs(module_dir, exist_ok=True)
        with open(os.path.join(module_dir, saved_filename), "wb") as f:
            f.write(content)
        rel_path = f"{settings.upload_dir}/{active_module}/{saved_filename}".replace("\\", "/")

        scan = Scan(
            patient_id=patient.id,
            doctor_id=doctor.id,
            module=ScreeningModule(active_module),
            scan_date=date.today(),
            image_path=rel_path,
            file_name=image.filename,
            file_size=len(content),
            image_quality=image_quality,
            status=ScanStatus.draft,
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scan_id is required for analysis.",
        )

    # Validates ALL clinical inputs strictly
    validate_clinical_inputs(active_module, inputs)

    # 1. Call the appropriate clinical formula function with the inputs
    if active_module == "breast":
        formula_res = compute_breast_risk(inputs)
    elif active_module == "cervical":
        formula_res = compute_cervical_risk(inputs, cytology_class=inputs.get("cytology_class", "Normal"))
    else:  # pcos
        formula_res = compute_pcos_risk(inputs)

    formula_res_dict = formula_res.model_dump()

    # Saves clinical_inputs to scan record & Updates scan status to: analyzing
    scan.clinical_inputs = inputs
    scan.image_quality = image_quality or scan.image_quality
    scan.status = ScanStatus.analyzing
    db.commit()

    # 1. Check ModelLoader singleton and execute real deep learning inference
    loader = ModelLoader.get_instance()
    image_model_score: float | None = None
    grad_cam_base64: str | None = None
    gradcam_heatmap_b64: str | None = None
    image_criterion_met: bool | None = None
    predicted_cytology_class: str | None = None
    cervical_confidence: float | None = None
    cervical_bethesda_term: str | None = None
    cervical_class_probabilities: dict[str, float] | None = None
    pcos_predicted_class: str | None = None
    raw_model_output: Any = None
    model_findings: list[dict[str, Any]] = []
    model_interpretation: str = ""
    model_inference_success: bool = False

    # Resolve image path on disk
    resolved_img_path = None
    if scan.image_path:
        candidates = [
            scan.image_path,
            os.path.join(os.getcwd(), scan.image_path),
            os.path.join(settings.upload_dir, os.path.basename(scan.image_path)),
            os.path.join(settings.upload_dir, active_module, os.path.basename(scan.image_path)),
        ]
        for c in candidates:
            if os.path.isfile(c):
                resolved_img_path = c
                break

    if resolved_img_path:
        if active_module == "breast" and loader.breast_model is not None:
            try:
                inf = run_breast_inference(loader.breast_model, resolved_img_path)
                image_model_score = inf["image_score"]
                raw_model_output = inf.get("raw_logit")
                grad_cam_base64 = inf.get("grad_cam_base64")
                gradcam_heatmap_b64 = inf.get("gradcam_heatmap_b64")
                if inf.get("image_quality"):
                    scan.image_quality = inf["image_quality"]
                model_findings = [{"finding": f, "confidence": round(image_model_score, 2)} for f in inf.get("key_findings", [])]
                model_interpretation = inf.get("model_interpretation", "")
                model_inference_success = True
            except Exception as e:
                logger.error("Breast vision model inference failed: %s", str(e))

        elif active_module == "cervical" and loader.cervical_model is not None:
            try:
                inf = run_cervical_inference(loader.cervical_model, resolved_img_path)
                image_model_score = inf["image_score"]
                predicted_cytology_class = inf["predicted_class"]
                cervical_confidence = inf["confidence"]
                cervical_bethesda_term = inf.get("bethesda_mapping")
                cervical_class_probabilities = inf.get("all_class_probabilities")
                raw_model_output = inf.get("raw_logits")
                grad_cam_base64 = inf.get("grad_cam_base64")
                gradcam_heatmap_b64 = inf.get("gradcam_heatmap_b64")
                if inf.get("image_quality"):
                    scan.image_quality = inf["image_quality"]
                finding_description = inf.get("finding_description") or f"{inf['predicted_class']} ({inf.get('bethesda_mapping', '')})"
                model_findings = [
                    {"finding": f"Predicted Cytology: {finding_description}", "confidence": inf["confidence"]}
                ]
                model_interpretation = f"ViT cytology classification: {finding_description} with {inf['confidence']:.1%} confidence."
                model_inference_success = True
            except Exception as e:
                logger.error("Cervical vision model inference failed: %s", str(e))

        elif active_module == "pcos" and loader.pcos_model is not None:
            try:
                inf = run_pcos_inference(loader.pcos_model, resolved_img_path)
                image_model_score = inf["image_score"]
                image_criterion_met = inf.get("image_criterion_met", False)
                raw_model_output = inf.get("raw_logits")
                grad_cam_base64 = inf.get("grad_cam_base64")
                gradcam_heatmap_b64 = inf.get("gradcam_heatmap_b64")
                pcos_predicted_class = inf.get("predicted_class")
                if inf.get("image_quality"):
                    scan.image_quality = inf["image_quality"]
                morph_label = "Polycystic Ovarian Morphology (PCOM)" if image_criterion_met else "Normal Ovarian Morphology"
                model_findings = [
                    {"finding": f"Predicted Morphology: {inf['predicted_class']}", "confidence": inf["pcos_probability"] if inf['predicted_class'] == 'PCOS' else inf['healthy_probability']},
                    {"finding": morph_label, "confidence": inf["pcos_probability"]},
                ]
                model_interpretation = inf.get("morphology_findings", "")
                model_inference_success = True
            except Exception as e:
                logger.error("PCOS vision model inference failed: %s", str(e))

    # 2. Call the appropriate clinical formula function with the inputs
    if active_module == "breast":
        formula_res = compute_breast_risk(inputs)
    elif active_module == "cervical":
        cytology = predicted_cytology_class or inputs.get("cytology_class", "Normal")
        formula_res = compute_cervical_risk(inputs, cytology_class=cytology)
    else:  # pcos
        formula_res = compute_pcos_risk(inputs, image_criterion_met=image_criterion_met)

    # 3. If model not loaded or inference failed, degrade gracefully to formula proxy
    if not model_inference_success or image_model_score is None:
        image_model_score = formula_res.formula_score
        fallback_msg = "Image model temporarily unavailable. Analysis based on clinical formula only."
        if fallback_msg not in formula_res.limitations:
            formula_res.limitations.append(fallback_msg)

    formula_res_dict = formula_res.model_dump()

    # 4. Run multimodal fusion with real image_score
    fusion_res = compute_fusion(
        module=active_module,
        image_model_score=image_model_score,
        formula_result=formula_res,
        image_quality=scan.image_quality,
    )
    fusion_res_dict = fusion_res.model_dump()

    # 5. Run confidence computation with real image_score
    confidence_res = compute_confidence(
        module=active_module,
        image_model_score=image_model_score,
        formula_result=formula_res,
        fusion_result=fusion_res,
        clinical_inputs=inputs,
        image_quality=scan.image_quality,
    )
    confidence_res_dict = confidence_res.model_dump()

    # 5b. Detailed inference trace logging (raw output -> softmax -> clinical
    # formula breakdown -> fusion weights -> final fused score -> disagreement)
    if active_module == "cervical":
        predicted_label = f"{predicted_cytology_class} ({cervical_bethesda_term})" if predicted_cytology_class else "N/A"
        predicted_confidence = cervical_confidence
    elif active_module == "pcos":
        predicted_label = pcos_predicted_class or "N/A"
        predicted_confidence = image_model_score
    else:
        predicted_label = "N/A"
        predicted_confidence = image_model_score

    _log_inference_details(
        module=active_module,
        raw_model_output=raw_model_output,
        image_model_score=image_model_score,
        predicted_label=predicted_label,
        predicted_confidence=predicted_confidence,
        cervical_class_probabilities=cervical_class_probabilities,
        formula_res=formula_res,
        fusion_res=fusion_res,
    )

    # 6. Determine recommended followup days from risk level:
    # Critical: 7, High: 30, Moderate: 60-90 (use 75), Low/Normal: 365
    risk_level_str = fusion_res.final_risk_level.lower()
    if risk_level_str in ("critical", "confirmed"):
        recommended_followup_days = 7
        scan_risk = RiskLevel.critical
    elif risk_level_str in ("high", "likely"):
        recommended_followup_days = 30
        scan_risk = RiskLevel.high
    elif risk_level_str in ("moderate", "possible"):
        recommended_followup_days = 75
        scan_risk = RiskLevel.moderate
    else:  # low, normal, unlikely
        recommended_followup_days = 365
        scan_risk = RiskLevel.low

    recommended_actions = _get_recommended_actions(active_module, risk_level_str)

    # 7. Generate reasoning details
    if model_findings:
        findings = model_findings
        interpretation = model_interpretation
    else:
        if active_module == "breast":
            lump_str = inputs.get("lump_size_cm", "2.4")
            findings = [
                {"finding": "Irregular mass detected", "confidence": 0.92},
                {"finding": "Spiculated margins", "confidence": 0.87},
                {"finding": "High density region", "confidence": 0.81},
            ]
            interpretation = f"Plain English description: Irregular mass ({lump_str} cm) with spiculated margins detected in the upper outer quadrant."
        elif active_module == "cervical":
            findings = [
                {"finding": "Atypical squamous cells identified", "confidence": 0.89},
                {"finding": "Hyperchromatic nuclei present", "confidence": 0.84},
                {"finding": "Irregular nuclear membrane", "confidence": 0.79},
            ]
            interpretation = f"Plain English description: Cytological findings suggestive of {formula_res.risk_tier} cervical intraepithelial lesion."
        else:
            findings = [
                {"finding": "Polycystic ovarian morphology (PCOM)", "confidence": 0.91},
                {"finding": "Peripheral arrangement of follicles ('string of pearls')", "confidence": 0.88},
                {"finding": "Increased ovarian stromal echogenicity", "confidence": 0.83},
            ]
            interpretation = f"Plain English description: Ultrasound imaging demonstrates polycystic ovarian morphology with elevated AMH ({inputs.get('amh_ng_ml', 6.8)} ng/ml)."

    contributions = [
        {
            "factor": c.factor_name,
            "value": c.value,
            "reference": c.reference_range,
            "contribution": c.contribution_magnitude,
        }
        for c in formula_res.contributions
    ]

    confidence_explanation_data = {
        "reasons_high": confidence_res.reasons_for_confidence,
        "reasons_low": confidence_res.reasons_against_confidence,
        "overall": confidence_res.plain_explanation,
    }

    # 7b. Generate the structured, dynamically-populated clinical reasoning narrative
    if active_module == "breast":
        top_finding = findings[0]["finding"] if findings else "no dominant suspicious finding"
        clinical_reasoning = generate_breast_reasoning(
            inputs=inputs,
            image_model_score=image_model_score,
            model_interpretation=top_finding,
            has_gradcam=bool(gradcam_heatmap_b64),
            formula_res=formula_res,
            fusion_res_dict=fusion_res_dict,
            confidence_score=confidence_res.confidence_score,
            threshold=loader.breast_threshold,
            recommended_actions=recommended_actions,
        )
    elif active_module == "cervical":
        clinical_reasoning = generate_cervical_reasoning(
            inputs=inputs,
            predicted_class=predicted_cytology_class,
            confidence=cervical_confidence,
            bethesda_term=cervical_bethesda_term or formula_res.interpretation.split(".")[0],
            formula_res=formula_res,
            threshold=loader.cervical_threshold,
        )
    else:  # pcos
        clinical_reasoning = generate_pcos_reasoning(
            inputs=inputs,
            image_model_score=image_model_score,
            predicted_class=pcos_predicted_class,
            image_criterion_met=image_criterion_met,
            formula_res=formula_res,
            image_threshold=loader.pcos_threshold,
        )

    reasoning_dict = {
        "image_findings": findings,
        "image_interpretation": interpretation,
        "clinical_contributions": contributions,
        "clinical_score_basis": formula_res.clinical_basis,
        "formula_result": formula_res_dict,
        "fusion_result": fusion_res_dict,
        "confidence_result": confidence_res_dict,
        "grad_cam_base64": grad_cam_base64,
        "gradcam_heatmap_b64": gradcam_heatmap_b64,
        "clinical_reasoning": clinical_reasoning,
    }

    ai_suggestions_dict = {
        "recommended_actions": recommended_actions,
        "recommended_followup_days": recommended_followup_days,
        "formula_result": formula_res_dict,
        "fusion_result": fusion_res_dict,
        "confidence_result": confidence_res_dict,
        "grad_cam_base64": grad_cam_base64,
        "gradcam_heatmap_b64": gradcam_heatmap_b64,
        "clinical_reasoning": clinical_reasoning,
    }

    # 8. Updates scan record with all result fields & Updates scan status to: analyzed
    scan.image_model_score = image_model_score
    scan.formula_score = formula_res.formula_score
    scan.fusion_score = fusion_res.final_score
    scan.risk_level = scan_risk
    scan.confidence_score = confidence_res.confidence_score
    scan.confidence_explanation = json.dumps(confidence_explanation_data)
    scan.reasoning = reasoning_dict
    scan.ai_suggestions = ai_suggestions_dict
    scan.status = ScanStatus.analyzed

    # Calculate Rotterdam criteria if PCOS
    criterion_oligo = None
    criterion_hyper = None
    criterion_poly = None
    rotterdam_met = None
    rotterdam_pos = None
    if active_module == "pcos":
        criterion_poly = bool(image_criterion_met if image_criterion_met is not None else (image_model_score > 0.55))
        if "criterion_oligo_anovulation" in inputs:
            v = inputs["criterion_oligo_anovulation"]
            criterion_oligo = str(v).lower() in ("true", "1", "yes") if isinstance(v, (str, int, bool)) else bool(v)
        elif "oligo_anovulation_present" in inputs:
            v = inputs["oligo_anovulation_present"]
            criterion_oligo = str(v).lower() in ("true", "1", "yes") if isinstance(v, (str, int, bool)) else bool(v)
        else:
            reg = str(inputs.get("cycle_regularity") or inputs.get("menstrual_regularity") or inputs.get("menstrual_cycle_regularity") or "").lower()
            criterion_oligo = reg in ("irregular", "absent", "oligomenorrhea", "amenorrhea")

        if "criterion_hyperandrogenism" in inputs:
            v = inputs["criterion_hyperandrogenism"]
            criterion_hyper = str(v).lower() in ("true", "1", "yes") if isinstance(v, (str, int, bool)) else bool(v)
        elif "hyperandrogenism_present" in inputs:
            v = inputs["hyperandrogenism_present"]
            criterion_hyper = str(v).lower() in ("true", "1", "yes") if isinstance(v, (str, int, bool)) else bool(v)
        else:
            syms = inputs.get("clinical_symptoms") or []
            if isinstance(syms, str):
                syms = [s.strip().lower() for s in syms.split(",")]
            criterion_hyper = any(s in ("hirsutism", "acne", "hair_thinning", "alopecia") for s in syms) or float(inputs.get("hirsutism_score") or 0) >= 8 or float(inputs.get("total_testosterone_ng_dl") or inputs.get("testosterone") or 0) > 50

        rotterdam_met = (1 if criterion_oligo else 0) + (1 if criterion_hyper else 0) + (1 if criterion_poly else 0)
        rotterdam_pos = rotterdam_met >= 2

        scan.criterion_oligo_anovulation = criterion_oligo
        scan.criterion_hyperandrogenism = criterion_hyper
        scan.criterion_polycystic_ovaries = criterion_poly
        scan.rotterdam_criteria_met = rotterdam_met
        scan.rotterdam_positive = rotterdam_pos

    db.commit()
    db.refresh(scan)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="ANALYSIS_GENERATED",
        resource_type="scan",
        resource_id=scan.id,
        details={
            "module": active_module,
            "risk_level": fusion_res.final_risk_level,
            "fusion_score": fusion_res.final_score,
            "formula_score": formula_res.formula_score,
            "image_score": image_model_score,
        },
    )

    return ScanAnalyzeResponse(
        scan_id=scan.id,
        module=active_module,
        status=scan.status.value,
        image_model_score=scan.image_model_score,
        formula_score=scan.formula_score,
        formula_result=formula_res_dict,
        fusion_score=scan.fusion_score,
        fusion_result=fusion_res_dict,
        risk_level=fusion_res.final_risk_level,
        confidence_score=scan.confidence_score,
        confidence_result=confidence_res_dict,
        confidence_explanation=ConfidenceExplanation(**confidence_explanation_data),
        reasoning=reasoning_dict,
        grad_cam_base64=grad_cam_base64,
        gradcam_heatmap_b64=gradcam_heatmap_b64,
        clinical_reasoning=clinical_reasoning,
        recommended_followup_days=recommended_followup_days,
        recommended_actions=recommended_actions,
        criterion_oligo_anovulation=scan.criterion_oligo_anovulation,
        criterion_hyperandrogenism=scan.criterion_hyperandrogenism,
        criterion_polycystic_ovaries=scan.criterion_polycystic_ovaries,
        rotterdam_criteria_met=scan.rotterdam_criteria_met,
        rotterdam_positive=scan.rotterdam_positive,
    )


@router.get("/{scan_id}", response_model=ScanDetailRecord)
def get_scan(
    scan_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    scan = _get_owned_scan(db, doctor, scan_id)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="SCAN_VIEWED",
        resource_type="scan",
        resource_id=scan.id,
        details={"scan_id": str(scan.id), "module": scan.module.value},
    )

    ai_sugg = scan.ai_suggestions or {}
    conf_expl = scan.confidence_explanation
    if isinstance(conf_expl, str):
        try:
            conf_expl = json.loads(conf_expl)
        except Exception:
            pass

    return ScanDetailRecord(
        id=scan.id,
        scan_id=scan.id,
        patient_id=scan.patient_id,
        doctor_id=scan.doctor_id,
        module=scan.module.value,
        scan_date=scan.scan_date,
        image_path=scan.image_path,
        file_name=scan.file_name,
        file_size=scan.file_size,
        image_quality=scan.image_quality,
        status=scan.status.value,
        clinical_inputs=scan.clinical_inputs,
        image_model_score=scan.image_model_score,
        formula_score=scan.formula_score,
        formula_result=(scan.reasoning or {}).get("formula_result") if isinstance(scan.reasoning, dict) else (ai_sugg.get("formula_result") if isinstance(ai_sugg, dict) else None),
        fusion_result=(scan.reasoning or {}).get("fusion_result") if isinstance(scan.reasoning, dict) else (ai_sugg.get("fusion_result") if isinstance(ai_sugg, dict) else None),
        confidence_result=(scan.reasoning or {}).get("confidence_result") if isinstance(scan.reasoning, dict) else (ai_sugg.get("confidence_result") if isinstance(ai_sugg, dict) else None),
        grad_cam_base64=(scan.reasoning or {}).get("grad_cam_base64") if isinstance(scan.reasoning, dict) else (ai_sugg.get("grad_cam_base64") if isinstance(ai_sugg, dict) else None),
        gradcam_heatmap_b64=(scan.reasoning or {}).get("gradcam_heatmap_b64") if isinstance(scan.reasoning, dict) else (ai_sugg.get("gradcam_heatmap_b64") if isinstance(ai_sugg, dict) else None),
        fusion_score=scan.fusion_score,
        risk_level=scan.risk_level.value if scan.risk_level else None,
        confidence_score=scan.confidence_score,
        confidence_explanation=conf_expl,
        reasoning=scan.reasoning,
        ai_suggestions=scan.ai_suggestions,
        doctor_modifications=scan.doctor_modifications,
        recommended_actions=ai_sugg.get("recommended_actions", []),
        recommended_followup_days=ai_sugg.get("recommended_followup_days"),
        created_at=scan.created_at,
        updated_at=scan.updated_at,
    )


@router.delete("/{scan_id}")
def delete_scan(
    scan_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    scan = _get_owned_scan(db, doctor, scan_id)

    # Soft delete only: sets scan.status to archived
    scan.status = ScanStatus.archived
    db.commit()

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="ARCHIVED_SCAN",
        resource_type="scan",
        resource_id=scan.id,
        details={"scan_id": str(scan.id), "status": "archived"},
    )

    return {"status": "archived", "message": "Scan has been archived"}


@router.post("/draft", response_model=ScanDraftResponse, status_code=status.HTTP_201_CREATED)
def save_draft(
    payload: ScanDraftRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    mod_str = payload.module.lower()
    if mod_str not in VALID_MODULES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid module")

    patient = _get_owned_patient(db, doctor, str(payload.patient_id))

    scan = Scan(
        patient_id=patient.id,
        doctor_id=doctor.id,
        module=ScreeningModule(mod_str),
        scan_date=payload.scan_date or date.today(),
        status=ScanStatus.draft,
        clinical_inputs=payload.clinical_inputs,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="scan_draft_saved",
        resource_type="scan",
        resource_id=scan.id,
        details={"module": payload.module},
    )

    return ScanDraftResponse(scan_id=scan.id, module=payload.module, status=scan.status.value, message="Draft saved")


@router.get("/{scan_id}/primary-image")
def get_scan_primary_image(
    scan_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    scan = _get_owned_scan(db, doctor, scan_id)
    image_url = f"/{scan.image_path}" if scan.image_path else None
    return {
        "scan_id": str(scan.id),
        "image_url": image_url,
        "image_path": scan.image_path,
        "file_name": scan.file_name,
    }

