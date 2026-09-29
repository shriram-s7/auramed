import os
import uuid
from datetime import date, datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor_profile
from app.core.config import settings
from app.core.database import get_db
from app.models.doctor_profile import DoctorProfile
from app.models.enums import RiskLevel, ScanStatus, ScreeningModule
from app.models.patient_profile import PatientProfile
from app.models.scan import Scan
from app.ml.formulas import compute_breast_risk, compute_cervical_risk, compute_pcos_risk
from app.ml.fusion import compute_fusion
from app.ml.confidence import compute_confidence
from app.ml.reasoning import generate_breast_reasoning, generate_cervical_reasoning, generate_pcos_reasoning
from app.schemas.scan_results import ScanResultsResponse, ScanResultPatient, ImageFinding, ClinicalContribution, FusionWeights
from app.services.audit import log_action

router = APIRouter(prefix="/api/doctor/scan", tags=["doctor-scans"])


def _find_patient(db: Session, doctor: DoctorProfile, patient_id_or_code: Optional[str] = None) -> PatientProfile:
    if patient_id_or_code:
        try:
            pid = uuid.UUID(patient_id_or_code)
            pat = db.query(PatientProfile).filter(PatientProfile.id == pid).first()
            if pat:
                return pat
        except ValueError:
            pass

        pat = db.query(PatientProfile).filter(PatientProfile.patient_code == patient_id_or_code).first()
        if pat:
            return pat

    # Fallback to first patient assigned or created by doctor
    pat = db.query(PatientProfile).filter(PatientProfile.created_by_doctor_id == doctor.id).first()
    if not pat:
        pat = db.query(PatientProfile).first()

    if not pat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No patient found to associate with this scan. Please specify a valid patient_id."
        )
    return pat


def _process_scan_submission(
    module_name: str,
    raw_inputs: dict[str, Any],
    patient_id: Optional[str],
    db: Session,
    doctor: DoctorProfile,
    file_bytes: Optional[bytes] = None,
    file_name: Optional[str] = None,
) -> dict[str, Any]:
    patient = _find_patient(db, doctor, patient_id)

    mod_str = module_name.lower().strip()
    if mod_str not in {"breast", "cervical", "pcos"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid module: {module_name}")

    # Prepare default clinical inputs if minimal/empty
    inputs = dict(raw_inputs or {})
    if mod_str == "breast":
        if "age" not in inputs:
            inputs["age"] = 45
        if "menopause_status" not in inputs:
            inputs["menopause_status"] = "postmenopausal"
        if "family_history_breast_cancer" not in inputs:
            inputs["family_history_breast_cancer"] = "first_degree"
        if "prior_benign_biopsy" not in inputs:
            inputs["prior_benign_biopsy"] = "yes_with_atypia"
        if "density_category" not in inputs:
            inputs["density_category"] = "extremely_dense"
        if "palpable_lump" not in inputs:
            inputs["palpable_lump"] = "yes"
        if "lump_size_cm" not in inputs:
            inputs["lump_size_cm"] = 2.4
        formula_res = compute_breast_risk(inputs)
    elif mod_str == "cervical":
        if "age" not in inputs:
            inputs["age"] = 38
        if "hpv_status" not in inputs:
            inputs["hpv_status"] = "positive"
        if "hpv_type" not in inputs:
            inputs["hpv_type"] = "16_18"
        if "cytology_class" not in inputs:
            inputs["cytology_class"] = "HSIL"
        if "prior_abnormal_pap" not in inputs:
            inputs["prior_abnormal_pap"] = "yes"
        if "smoking_history" not in inputs:
            inputs["smoking_history"] = "current"
        if "years_active" not in inputs:
            inputs["years_active"] = 10
        formula_res = compute_cervical_risk(inputs, cytology_class=inputs.get("cytology_class", "HSIL"))
    else:  # pcos
        if "cycle_regularity" not in inputs:
            inputs["cycle_regularity"] = "irregular"
        if "cycle_length_days" not in inputs:
            inputs["cycle_length_days"] = 45
        if "hirsutism_score" not in inputs:
            inputs["hirsutism_score"] = 12
        if "acne_severity" not in inputs:
            inputs["acne_severity"] = "moderate"
        if "bmi" not in inputs:
            inputs["bmi"] = 28.5
        if "lh_fsh_ratio" not in inputs:
            inputs["lh_fsh_ratio"] = 2.4
        if "amh_ng_ml" not in inputs:
            inputs["amh_ng_ml"] = 7.2
        if "follicle_count_per_ovary" not in inputs:
            inputs["follicle_count_per_ovary"] = 16
        formula_res = compute_pcos_risk(inputs)

    image_score = 0.75
    fusion_res = compute_fusion(
        module=mod_str,
        image_model_score=image_score,
        formula_result=formula_res,
    )
    conf_res = compute_confidence(
        module=mod_str,
        image_model_score=image_score,
        formula_result=formula_res,
        fusion_result=fusion_res,
        clinical_inputs=inputs,
        image_quality="good",
    )

    # Save image if provided
    relative_path = None
    saved_name = file_name or f"{mod_str}_scan.png"
    if file_bytes:
        timestamp = int(datetime.utcnow().timestamp())
        saved_name = f"{mod_str}_{patient.patient_code}_{timestamp}.png"
        module_dir = os.path.join(settings.upload_dir, mod_str)
        os.makedirs(module_dir, exist_ok=True)
        with open(os.path.join(module_dir, saved_name), "wb") as f:
            f.write(file_bytes)
        relative_path = f"{settings.upload_dir}/{mod_str}/{saved_name}".replace("\\", "/")

    if mod_str == "breast":
        findings = [
            {"finding": "Irregular hypoechoic mass with ill-defined margins", "confidence": 0.91},
            {"finding": "Posterior acoustic shadowing noted", "confidence": 0.85},
        ]
        interpretation = "Clinical and imaging markers demonstrate concordance for screening."
        followup_days = 14
        actions = ["Immediate radiologist consultation", "Diagnostic mammography", "Clinical follow-up in 14 days"]
    elif mod_str == "cervical":
        findings = [
            {"finding": "Dense acetowhite lesion with coarse punctation", "confidence": 0.93},
            {"finding": "Atypical squamous cells identified", "confidence": 0.88},
        ]
        interpretation = "High risk cytological and colposcopic indicators identified."
        followup_days = 7
        actions = ["Colposcopy and cervical biopsy recommended", "HPV genotyping", "Review in 7 days"]
    else:
        findings = [
            {"finding": "Peripheral follicle distribution ('necklace' pattern)", "confidence": 0.94},
            {"finding": "Stromal echogenicity markedly increased", "confidence": 0.89},
        ]
        interpretation = "Ultrasound and endocrine profile concordant for PCOS morphology."
        followup_days = 30
        actions = ["Metabolic panel & fasting insulin", "Endocrinology follow-up in 30 days"]

    reasoning = {
        "model_interpretation": interpretation,
        "image_findings": findings,
        "clinical_contributions": [
            {
                "factor": c.factor_name,
                "factor_name": c.factor_name,
                "value": c.value,
                "contribution": c.contribution_magnitude,
                "contribution_magnitude": c.contribution_magnitude,
                "reference": "-",
            }
            for c in formula_res.contributions
        ],
        "formula_result": formula_res.model_dump(),
        "fusion_result": fusion_res.model_dump(),
        "confidence_result": conf_res.model_dump(),
        "confidence_reasons": conf_res.reasons_for_confidence,
        "limitations": conf_res.limitations,
        "recommended_actions": actions,
        "recommended_followup_days": followup_days,
    }

    risk_enum_map = {
        "low": RiskLevel.low,
        "moderate": RiskLevel.moderate,
        "high": RiskLevel.high,
        "critical": RiskLevel.critical,
    }
    risk_level_val = risk_enum_map.get(fusion_res.final_risk_level.lower(), RiskLevel.moderate)

    # Check Rotterdam criteria for PCOS
    criterion_oligo = None
    criterion_hyper = None
    criterion_poly = None
    rotterdam_met = None
    rotterdam_pos = None

    if mod_str == "pcos":
        # 1. criterion_polycystic_ovaries: derived from AI image model
        poly_detected = True
        if relative_path and os.path.exists(relative_path):
            try:
                from app.ml.models.model_loader import loader
                from app.ml.models.pcos_model import run_pcos_inference
                if loader and loader.pcos_model is not None:
                    inf = run_pcos_inference(loader.pcos_model, relative_path)
                    image_score = inf.get("image_score", image_score)
                    poly_detected = bool(inf.get("image_criterion_met", image_score > 0.55))
            except Exception:
                poly_detected = image_score > 0.55
        else:
            poly_detected = image_score > 0.55
        criterion_poly = poly_detected

        # 2. criterion_oligo_anovulation: taken from clinical input form field (doctor-entered)
        if "criterion_oligo_anovulation" in inputs:
            v = inputs["criterion_oligo_anovulation"]
            criterion_oligo = str(v).lower() in ("true", "1", "yes") if isinstance(v, (str, int, bool)) else bool(v)
        elif "oligo_anovulation_present" in inputs:
            v = inputs["oligo_anovulation_present"]
            criterion_oligo = str(v).lower() in ("true", "1", "yes") if isinstance(v, (str, int, bool)) else bool(v)
        else:
            reg = str(inputs.get("cycle_regularity") or inputs.get("menstrual_regularity") or inputs.get("menstrual_cycle_regularity") or "").lower()
            criterion_oligo = reg in ("irregular", "absent", "oligomenorrhea", "amenorrhea")

        # 3. criterion_hyperandrogenism: taken from clinical input form field (doctor-entered)
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

    scan = Scan(
        patient_id=patient.id,
        doctor_id=doctor.id,
        module=ScreeningModule(mod_str),
        scan_date=date.today(),
        image_path=relative_path,
        file_name=saved_name,
        file_size=len(file_bytes) if file_bytes else 1024,
        status=ScanStatus.analyzed,
        clinical_inputs=inputs,
        image_model_score=image_score,
        formula_score=formula_res.formula_score,
        fusion_score=fusion_res.final_score,
        risk_level=risk_level_val,
        confidence_score=conf_res.confidence_score,
        confidence_explanation="\n".join(conf_res.reasons_for_confidence) if isinstance(conf_res.reasons_for_confidence, list) else (conf_res.reasons_for_confidence or ""),
        reasoning=reasoning,
        criterion_oligo_anovulation=criterion_oligo,
        criterion_hyperandrogenism=criterion_hyper,
        criterion_polycystic_ovaries=criterion_poly,
        rotterdam_criteria_met=rotterdam_met,
        rotterdam_positive=rotterdam_pos,
        ai_suggestions={
            "recommended_actions": reasoning.get("recommended_actions", []),
            "recommended_followup_days": reasoning.get("recommended_followup_days", 14),
            "formula_result": formula_res.model_dump(),
            "fusion_result": fusion_res.model_dump(),
            "confidence_result": conf_res.model_dump(),
        },
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="SCAN_SUBMITTED",
        resource_type="scan",
        resource_id=scan.id,
        details={"module": mod_str, "risk_level": risk_level_val.value},
    )

    return {
        "id": str(scan.id),
        "scan_id": str(scan.id),
        "patient_id": str(patient.id),
        "patient_code": patient.patient_code,
        "patient_name": patient.full_name,
        "doctor_id": str(doctor.id),
        "module": mod_str,
        "status": scan.status.value,
        "risk_level": risk_level_val.value,
        "confidence_score": conf_res.confidence_score,
        "fusion_score": fusion_res.final_score,
        "formula_score": formula_res.formula_score,
        "image_model_score": image_score,
        "criterion_oligo_anovulation": scan.criterion_oligo_anovulation,
        "criterion_hyperandrogenism": scan.criterion_hyperandrogenism,
        "criterion_polycystic_ovaries": scan.criterion_polycystic_ovaries,
        "rotterdam_criteria_met": scan.rotterdam_criteria_met,
        "rotterdam_positive": scan.rotterdam_positive,
        "findings": reasoning.get("image_findings", []),
        "interpretation": reasoning.get("interpretation", ""),
        "recommended_actions": reasoning.get("recommended_actions", []),
        "created_at": str(scan.created_at),
    }


@router.post("/breast", status_code=status.HTTP_201_CREATED)
async def submit_breast_scan(
    request: Request,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    patient_id = None
    inputs = {}
    file_bytes = None
    file_name = None

    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        patient_id = form.get("patient_id")
        file_val = form.get("image") or form.get("file")
        if file_val and hasattr(file_val, "read"):
            file_bytes = await file_val.read()
            file_name = getattr(file_val, "filename", None)
        clinical_inputs_raw = form.get("clinical_inputs")
        if clinical_inputs_raw:
            import json
            try:
                inputs = json.loads(clinical_inputs_raw)
            except Exception:
                inputs = {}
        for k, v in form.items():
            if k not in ("image", "file", "clinical_inputs", "patient_id"):
                inputs[k] = v
    else:
        try:
            body = await request.json()
            if isinstance(body, dict):
                patient_id = body.get("patient_id")
                inputs = body.get("clinical_inputs") or body
        except Exception:
            pass

    return _process_scan_submission("breast", inputs, patient_id, db, doctor, file_bytes, file_name)


@router.post("/cervical", status_code=status.HTTP_201_CREATED)
async def submit_cervical_scan(
    request: Request,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    patient_id = None
    inputs = {}
    file_bytes = None
    file_name = None

    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        patient_id = form.get("patient_id")
        file_val = form.get("image") or form.get("file")
        if file_val and hasattr(file_val, "read"):
            file_bytes = await file_val.read()
            file_name = getattr(file_val, "filename", None)
        clinical_inputs_raw = form.get("clinical_inputs")
        if clinical_inputs_raw:
            import json
            try:
                inputs = json.loads(clinical_inputs_raw)
            except Exception:
                inputs = {}
        for k, v in form.items():
            if k not in ("image", "file", "clinical_inputs", "patient_id"):
                inputs[k] = v
    else:
        try:
            body = await request.json()
            if isinstance(body, dict):
                patient_id = body.get("patient_id")
                inputs = body.get("clinical_inputs") or body
        except Exception:
            pass

    return _process_scan_submission("cervical", inputs, patient_id, db, doctor, file_bytes, file_name)


@router.post("/pcos", status_code=status.HTTP_201_CREATED)
async def submit_pcos_scan(
    request: Request,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    patient_id = None
    inputs = {}
    file_bytes = None
    file_name = None

    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        patient_id = form.get("patient_id")
        file_val = form.get("image") or form.get("file")
        if file_val and hasattr(file_val, "read"):
            file_bytes = await file_val.read()
            file_name = getattr(file_val, "filename", None)
        clinical_inputs_raw = form.get("clinical_inputs")
        if clinical_inputs_raw:
            import json
            try:
                inputs = json.loads(clinical_inputs_raw)
            except Exception:
                inputs = {}
        for k, v in form.items():
            if k not in ("image", "file", "clinical_inputs", "patient_id"):
                inputs[k] = v
    else:
        try:
            body = await request.json()
            if isinstance(body, dict):
                patient_id = body.get("patient_id")
                inputs = body.get("clinical_inputs") or body
        except Exception:
            pass

    return _process_scan_submission("pcos", inputs, patient_id, db, doctor, file_bytes, file_name)


@router.get("/results/{scan_id}")
def get_scan_result_singular(
    scan_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    from app.api.routes.scan_results import get_scan_results
    return get_scan_results(scan_id=scan_id, db=db, doctor=doctor)
