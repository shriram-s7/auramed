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

def _build_default_report_content(scan, doctor):
    from app.services.clinical_record import report_content
    return report_content(scan, doctor)


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
        risk_level=scan.risk_level.value if scan.risk_level else None,
        scan_date=str(scan.scan_date) if scan.scan_date else None,
        report_date=rep_date_str,
        patient_name=patient.full_name,
        patient_code=patient.patient_code,
        patient_age=_calculate_age(patient.date_of_birth),
        patient_gender=patient.gender or "Not recorded",
        patient_phone=patient.phone,
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
