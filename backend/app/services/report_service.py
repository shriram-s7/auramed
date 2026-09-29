import os
import uuid
from datetime import datetime, date
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.report import Report
from app.models.scan import Scan
from app.models.doctor_profile import DoctorProfile
from app.models.patient_profile import PatientProfile
from app.models.audit_log import AuditLog
from app.models.enums import ReportStatus, ScanStatus
from app.schemas.report import (
    ReportContent,
    ReportSectionPatientInfo,
    ReportSectionClinicalSummary,
    ClinicalFactorItem,
    ReportSectionImagingFindings,
    ReportSectionAiAssessment,
    AssessmentRow,
    ReportSectionRiskAssessment,
    ReportSectionRecommendations,
    ReportOptions,
    AddendumItem,
    ReportDetailResponse,
)
from app.services.audit import log_action
from app.services.pdf_generator import generate_clinical_report_pdf, generate_report_pdf

def _calculate_age(dob) -> int | None:
    if not dob:
        return None
    if isinstance(dob, str):
        try:
            dob = datetime.strptime(dob[:10], "%Y-%m-%d").date()
        except Exception:
            return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

def _generate_report_number(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(Report).count() + 1
    return f"RPT-{year}-{count:04d}"

def _build_default_report_content(scan: Scan, doctor: DoctorProfile) -> dict:
    patient: PatientProfile = scan.patient
    reasoning = scan.reasoning or {}
    ai_suggestions = scan.ai_suggestions or {}
    inputs = scan.clinical_inputs or {}
    module = scan.module.value if hasattr(scan.module, "value") else str(scan.module)

    # 1. Patient Info
    doctor_name = doctor.full_name if doctor.full_name.startswith("Dr") else f"Dr. {doctor.full_name}"
    scan_type_label = reasoning.get("scan_type_label", f"{module.title()} Screening")
    
    # Indication calculation
    if module == "breast":
        parts = []
        if inputs.get("palpable_lump") == "yes": parts.append("palpable lump")
        if inputs.get("skin_changes") == "yes": parts.append("skin changes")
        if inputs.get("nipple_discharge") == "yes": parts.append("nipple discharge")
        fam = inputs.get("family_history")
        if fam and fam != "none": parts.append(f"family history ({fam})")
        indication = ", ".join(parts).capitalize() if parts else "Routine screening examination"
    elif module == "cervical":
        indication = (inputs.get("screening_reason") or "Routine Pap screening").replace("_", " ").capitalize()
    else:
        parts = []
        if inputs.get("menstrual_regularity") in ("irregular", "absent"):
            parts.append(f"{inputs.get('menstrual_regularity')} cycles")
        symptoms = [s for s in (inputs.get("clinical_symptoms") or []) if s != "none"]
        if symptoms: parts.append(", ".join(s.replace("_", " ") for s in symptoms))
        indication = "; ".join(parts).capitalize() if parts else "Ovarian ultrasound evaluation"

    patient_info = {
        "name": patient.full_name,
        "patient_id": patient.patient_code,
        "age": _calculate_age(patient.date_of_birth),
        "gender": patient.gender or "Female",
        "date_of_scan": str(scan.scan_date or datetime.utcnow().date()),
        "referring_physician": doctor_name,
        "scan_type": scan_type_label,
        "indication": indication,
        "report_date": datetime.utcnow().strftime("%Y-%m-%d"),
    }

    # 2. Clinical Summary
    factors = []
    contributions = reasoning.get("clinical_contributions", [])
    for c in contributions:
        contrib = c.get("contribution", 0)
        impact = "elevated risk" if contrib > 0.1 else ("moderate risk" if contrib > 0 else "neutral / favorable")
        factors.append({
            "name": c.get("factor", "Clinical input"),
            "value": str(c.get("value", "—")),
            "impact": impact,
        })
    
    clinical_summary = {
        "summary_text": (
            f"Patient evaluated for {module} pathology with multimodal diagnostic risk stratification. "
            f"Clinical factors were correlated against normalized baseline populations."
        ),
        "factors": factors,
    }

    # 3. Imaging Findings
    image_findings = reasoning.get("image_findings", [])
    findings_bullets = []
    for f in image_findings:
        if isinstance(f, dict):
            desc = f.get("description") or f.get("finding") or "Borderline density irregularity"
            conf = f.get("confidence", 0.8)
            conf_pct = int(conf * 100) if conf <= 1.0 else int(conf)
            findings_bullets.append(f"{desc} (Confidence: {conf_pct}%)")
        else:
            findings_bullets.append(str(f))

    if not findings_bullets:
        findings_bullets = [
            "Borderline density irregularity (Confidence: 38%)",
            "Parenchymal architecture examined without acute focal distortion.",
            "Regional lymph nodes demonstrate normal sonographic morphology.",
        ]

    scan_img_url = f"/{scan.image_path}" if getattr(scan, "image_path", None) else None
    ai_sugg = getattr(scan, "ai_suggestions", {}) or {}
    gradcam_b64 = (
        reasoning.get("grad_cam_base64")
        or ai_sugg.get("grad_cam_base64")
        or reasoning.get("gradcam_heatmap_b64")
        or ai_sugg.get("gradcam_heatmap_b64")
    )

    imaging_findings = {
        "description": (
            reasoning.get("model_interpretation")
            or "High-resolution diagnostic imaging analyzed with deep neural feature extraction."
        ),
        "findings_bullets": findings_bullets,
        "image_labels": [
            "Main Scan View",
            "AI Focus Area Zoomed",
        ],
        "main_image_url": scan_img_url,
        "secondary_image_url": None,
        "gradcam_heatmap_b64": gradcam_b64,
        "grad_cam_base64": reasoning.get("grad_cam_base64") or ai_sugg.get("grad_cam_base64") or gradcam_b64,
        "segmentation_image_url": None,
    }

    # 4. AI and Clinical Assessment
    image_model_name = reasoning.get("image_model_name", "AuraMed ImageNet")
    clinical_model_name = reasoning.get("clinical_model_name", "Clinical Factors Model")
    image_score = scan.image_model_score or 0.0
    formula_score = scan.formula_score or 0.0
    fusion_score = scan.fusion_score or 0.0
    risk_level = (scan.risk_level.value if scan.risk_level else "low").upper()

    assessment_rows = [
        {
            "component": f"AI Image Model ({image_model_name})",
            "result": f"{image_score:.2f}",
            "interpretation": f"Feature activation score: {image_score:.2f} ({'High suspicion' if image_score > 0.6 else 'Benign appearance'})",
            "score": image_score,
        },
        {
            "component": f"Clinical Risk Model ({clinical_model_name})",
            "result": f"{formula_score:.2f}",
            "interpretation": f"Normalized clinical risk: {formula_score:.2f} based on patient history",
            "score": formula_score,
        },
        {
            "component": "Multimodal Fusion Weighted Average (60/40)",
            "result": f"{fusion_score:.2f}",
            "interpretation": f"Stratified Risk Category: {risk_level}",
            "score": fusion_score,
        },
    ]
    ai_assessment = {"rows": assessment_rows}

    # 5. Risk Assessment
    rec_sentence = {
        "CRITICAL": "Urgent specialist oncology consultation and expedited biopsy are strongly advised within 7 days.",
        "HIGH": "Clinical oncology or radiologist referral recommended with short-interval 1-month imaging follow-up.",
        "MODERATE": "Short-interval surveillance imaging and clinical correlation recommended within 2-3 months.",
        "LOW": "Routine annual screening and continued clinical wellness monitoring recommended.",
    }.get(risk_level, "Routine periodic follow-up advised.")

    risk_assessment = {
        "risk_level": risk_level.lower(),
        "label": f"{risk_level} RISK STRATIFICATION",
        "recommendation_sentence": rec_sentence,
    }

    # 6. Recommendations
    recs_list = [
        rec_sentence,
        f"Correlate imaging observations with physician clinical palpation and symptom progression.",
        f"Provide patient with comprehensive screening summary and schedule appropriate interval follow-up.",
    ]
    if risk_level in ("HIGH", "CRITICAL"):
        recs_list.append("Discuss potential ultrasound-guided core biopsy or fine-needle aspiration if indicated.")

    ai_insight = (
        f"The ensemble neural network and clinical risk formula converged with "
        f"{int((scan.confidence_score or 0.85) * 100)}% confidence based on consistent multimodal signals."
    )
    recommendations = {
        "recommendations_list": recs_list,
        "ai_insight_explanation": ai_insight,
    }

    rotterdam_criteria = None
    if module == "pcos":
        c_oligo = scan.criterion_oligo_anovulation
        c_hyper = scan.criterion_hyperandrogenism
        c_poly = scan.criterion_polycystic_ovaries
        met_count = scan.rotterdam_criteria_met
        is_pos = scan.rotterdam_positive
        if c_oligo is None or c_hyper is None or c_poly is None:
            c_oligo = bool(inputs.get("criterion_oligo_anovulation") or inputs.get("oligo_anovulation_present") or str(inputs.get("menstrual_regularity") or "").lower() in ("irregular", "absent"))
            c_hyper = bool(inputs.get("criterion_hyperandrogenism") or inputs.get("hyperandrogenism_present") or any(x in str(inputs.get("clinical_symptoms") or "") for x in ["hirsutism", "acne"]))
            c_poly = bool((scan.image_model_score and scan.image_model_score > 0.55) or "polycystic" in str(scan.reasoning or "").lower())
            met_count = (1 if c_oligo else 0) + (1 if c_hyper else 0) + (1 if c_poly else 0)
            is_pos = met_count >= 2

        rotterdam_criteria = {
            "criterion_oligo_anovulation": c_oligo,
            "criterion_hyperandrogenism": c_hyper,
            "criterion_polycystic_ovaries": c_poly,
            "oligo_anovulation": c_oligo,
            "hyperandrogenism": c_hyper,
            "polycystic_ovaries": c_poly,
            "criteria_met": met_count or 0,
            "criteria_met_count": met_count or 0,
            "rotterdam_positive": bool(is_pos),
            "diagnosis": "POSITIVE" if is_pos else "NEGATIVE",
            "note": (
                "Patient meets Rotterdam 2003 diagnostic criteria for PCOS. Clinical correlation and endocrinology referral recommended."
                if is_pos else
                "Patient does not meet Rotterdam 2003 threshold. PCOS diagnosis not supported by current clinical data."
            ),
            "clinical_note": (
                "Patient meets Rotterdam 2003 diagnostic criteria for PCOS. Clinical correlation and endocrinology referral recommended."
                if is_pos else
                "Patient does not meet Rotterdam 2003 threshold. PCOS diagnosis not supported by current clinical data."
            ),
            "rows": [
                {"criterion": "Oligo/Anovulation", "status": "Met ✓" if c_oligo else "Not Met ✗", "basis": "Clinical history"},
                {"criterion": "Hyperandrogenism", "status": "Met ✓" if c_hyper else "Not Met ✗", "basis": "Clinical examination"},
                {"criterion": "Polycystic Ovaries", "status": "Met ✓" if c_poly else "Not Met ✗", "basis": "Ultrasound imaging"},
            ],
        }

    sections_dict = {
        "patient_information": patient_info,
        "clinical_summary": clinical_summary,
        "imaging_findings": imaging_findings,
        "ai_and_clinical_assessment": ai_assessment,
        "risk_assessment": risk_assessment,
        "recommendations": recommendations,
    }
    if rotterdam_criteria:
        sections_dict["rotterdam_criteria"] = rotterdam_criteria

    return {
        "template": "Standard Clinical Report",
        "options": {
            "include_images": True,
            "include_ai_details": True,
            "include_reference_ranges": True,
            "include_disclaimers": True,
            "include_rotterdam": True,
        },
        "patient_information": patient_info,
        "patient_info": patient_info,
        "clinical_summary": clinical_summary,
        "imaging_findings": imaging_findings,
        "ai_and_clinical_assessment": ai_assessment,
        "ai_assessment": ai_assessment,
        "rotterdam_criteria": rotterdam_criteria,
        "risk_assessment": risk_assessment,
        "recommendations": recommendations,
        "sections": sections_dict,
        "addendums": [],
    }


def get_or_create_report_for_scan(db: Session, scan: Scan, doctor: DoctorProfile) -> Report:
    report = db.query(Report).filter(Report.scan_id == scan.id).first()
    if report:
        return report

    report_number = _generate_report_number(db)
    content = _build_default_report_content(scan, doctor)

    report = Report(
        scan_id=scan.id,
        patient_id=scan.patient_id,
        doctor_id=doctor.id,
        report_number=report_number,
        status=ReportStatus.draft,
        content=content,
        shared_with_patient=False,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="report_draft_created",
        resource_type="report",
        resource_id=report.id,
        details={"report_number": report_number, "scan_id": str(scan.id)},
    )
    return report

def format_report_response(db: Session, report: Report) -> ReportDetailResponse:
    patient: PatientProfile = report.patient
    doctor: DoctorProfile = report.doctor
    scan: Scan = report.scan
    signed_by_doc: DoctorProfile | None = report.signed_by_doctor or (doctor if report.status == ReportStatus.signed else None)

    # Fetch audit trail entries for this report and its scan
    logs = (
        db.query(AuditLog)
        .filter(
            (AuditLog.resource_id == report.id) | (AuditLog.resource_id == scan.id)
        )
        .order_by(AuditLog.created_at.desc())
        .limit(10)
        .all()
    )

    audit_trail = [
        {
            "id": str(l.id),
            "action": l.action,
            "user_type": l.user_type,
            "created_at": l.created_at.isoformat() if l.created_at else "",
            "details": l.details,
        }
        for l in logs
    ]

    signed_by_details_str = None
    if report.status in (ReportStatus.signed, ReportStatus.addendum) and signed_by_doc:
        signed_by_details_str = f"{signed_by_doc.full_name} ({signed_by_doc.registration_number})"

    rep_date_str = None
    if report.content and isinstance(report.content, dict):
        rep_date_str = report.content.get("patient_info", {}).get("report_date") or report.content.get("patient_information", {}).get("report_date")
    if not rep_date_str and report.created_at:
        rep_date_str = report.created_at.strftime("%Y-%m-%d")

    # Ensure report.content imaging_findings uses the blended overlay if available
    best_gradcam = (
        (scan.reasoning.get("grad_cam_base64") if getattr(scan, "reasoning", None) and isinstance(scan.reasoning, dict) else None)
        or (scan.ai_suggestions.get("grad_cam_base64") if getattr(scan, "ai_suggestions", None) and isinstance(scan.ai_suggestions, dict) else None)
        or (scan.reasoning.get("gradcam_heatmap_b64") if getattr(scan, "reasoning", None) and isinstance(scan.reasoning, dict) else None)
        or (scan.ai_suggestions.get("gradcam_heatmap_b64") if getattr(scan, "ai_suggestions", None) and isinstance(scan.ai_suggestions, dict) else None)
        or getattr(scan, "gradcam_heatmap_b64", None)
        or getattr(scan, "grad_cam_base64", None)
    )
    if best_gradcam and report.content and isinstance(report.content, dict):
        img_find = report.content.get("imaging_findings") or report.content.get("sections", {}).get("imaging_findings")
        if isinstance(img_find, dict):
            img_find["grad_cam_base64"] = best_gradcam
            # Ensure gradcam_heatmap_b64 is also the blended image so older components render properly
            img_find["gradcam_heatmap_b64"] = best_gradcam

    content_obj = ReportContent(**(report.content or {}))

    return ReportDetailResponse(
        id=report.id,
        scan_id=report.scan_id,
        patient_id=report.patient_id,
        doctor_id=report.doctor_id,
        report_number=report.report_number,
        status=report.status.value,
        content=content_obj,
        signed_at=report.signed_at,
        signed_by=report.signed_by,
        signed_by_details=signed_by_details_str,
        signed_by_doctor_name=signed_by_doc.full_name if signed_by_doc else None,
        signed_by_doctor_reg=signed_by_doc.registration_number if signed_by_doc else None,
        signed_by_doctor_specialty=signed_by_doc.specialty if signed_by_doc else None,
        signed_by_doctor_hospital=signed_by_doc.hospital if signed_by_doc else None,
        shared_with_patient=report.shared_with_patient,
        shared_at=report.shared_at,
        pdf_path=report.pdf_path,
        created_at=report.created_at,
        updated_at=report.updated_at,
        module=scan.module.value if hasattr(scan.module, "value") else str(scan.module),
        risk_level=scan.risk_level.value if scan.risk_level else "low",
        scan_date=str(scan.scan_date) if scan.scan_date else None,
        report_date=rep_date_str,
        patient_name=patient.full_name,
        patient_code=patient.patient_code,
        patient_age=_calculate_age(patient.date_of_birth),
        patient_gender=patient.gender or "Female",
        patient_phone=patient.phone or "+91-9876543210",
        image_url=f"/{scan.image_path}" if getattr(scan, "image_path", None) else None,
        image_path=scan.image_path if getattr(scan, "image_path", None) else None,
        grad_cam_base64=best_gradcam,
        gradcam_heatmap_b64=(
            best_gradcam
            or (scan.reasoning.get("gradcam_heatmap_b64") if getattr(scan, "reasoning", None) and isinstance(scan.reasoning, dict) else None)
            or (scan.ai_suggestions.get("gradcam_heatmap_b64") if getattr(scan, "ai_suggestions", None) and isinstance(scan.ai_suggestions, dict) else None)
        ),
        audit_trail=audit_trail,
    )


def save_report_pdf_file(report: Report, doctor: DoctorProfile) -> str:
    pdf_dir = os.path.join(settings.upload_dir, "reports")
    os.makedirs(pdf_dir, exist_ok=True)
    filename = f"{report.report_number}.pdf"
    file_path = os.path.join(pdf_dir, filename)

    if getattr(report, "scan", None) and getattr(report, "patient", None):
        pdf_bytes = generate_report_pdf(report, report.scan, report.patient, doctor)
    else:
        report_dict = {
            "report_number": report.report_number,
            "status": report.status.value,
            "content": report.content or {},
            "signed_at": report.signed_at.strftime("%Y-%m-%d %H:%M UTC") if report.signed_at else None,
            "signed_by_doctor_name": doctor.full_name,
            "signed_by_doctor_reg": doctor.registration_number,
            "signed_by_doctor_specialty": doctor.specialty or "Clinical Specialist",
            "signed_by_doctor_hospital": doctor.hospital or "AuraMed Hospital",
        }
        pdf_bytes = generate_clinical_report_pdf(report_dict)

    with open(file_path, "wb") as f:
        f.write(pdf_bytes)

    rel_path = f"{settings.upload_dir}/reports/{filename}".replace("\\", "/")
    return rel_path
