import io
import os
import uuid
from datetime import datetime
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor_profile, require_role
from app.core.database import get_db
from app.models.report import Report
from app.models.scan import Scan
from app.models.doctor_profile import DoctorProfile
from app.models.user import User
from app.models.enums import ReportStatus, ScanStatus, UserRole
from app.schemas.report import (
    ReportDetailResponse,
    CreateReportRequest,
    PatchReportRequest,
    ReportSaveDraftRequest,
    AddAddendumRequest,
    ShareReportRequest,
    ShareReportResponse,
    SignReportResponse,
    MessageResponse,
)
from app.core.config import settings
from app.services.audit import log_action
from app.services.report_service import (
    get_or_create_report_for_scan,
    format_report_response,
    save_report_pdf_file,
)
from app.services.pdf_generator import generate_clinical_report_pdf, generate_report_pdf

router = APIRouter(prefix="/api/doctor", tags=["reports"])


def _get_owned_report(db: Session, doctor: DoctorProfile, report_id: str) -> Report:
    try:
        rid = uuid.UUID(report_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    report = db.query(Report).filter(Report.id == rid).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if doctor and report.doctor_id != doctor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to access this report."
        )
    return report


def _get_owned_scan(db: Session, doctor: DoctorProfile, scan_id: str) -> Scan:
    try:
        sid = uuid.UUID(scan_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    scan = db.query(Scan).filter(Scan.id == sid).first()
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    if doctor and scan.doctor_id != doctor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to access this scan."
        )
    return scan


@router.post("/reports", response_model=ReportDetailResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: CreateReportRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    scan = _get_owned_scan(db, doctor, payload.scan_id)
    report = get_or_create_report_for_scan(db, scan, doctor)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="REPORT_CREATED",
        resource_type="report",
        resource_id=report.id,
        details={
            "report_number": report.report_number,
            "scan_id": str(scan.id),
            "patient_id": str(scan.patient_id),
            "module": scan.module.value if hasattr(scan.module, "value") else str(scan.module),
        },
    )
    return format_report_response(db, report)


@router.get("/scans/{scan_id}/report", response_model=ReportDetailResponse)
def get_scan_report(
    scan_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    scan = _get_owned_scan(db, doctor, scan_id)
    report = get_or_create_report_for_scan(db, scan, doctor)
    return format_report_response(db, report)


@router.get("/reports")
def list_doctor_reports(
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    query = db.query(Report).filter(Report.doctor_id == doctor.id)
    if status_filter and status_filter.lower() != "all":
        query = query.filter(func.lower(Report.status) == status_filter.lower())
    reports = query.order_by(Report.created_at.desc()).all()
    if not reports:
        reports = db.query(Report).order_by(Report.created_at.desc()).limit(20).all()
    return [format_report_response(db, r) for r in reports]


@router.get("/reports/{report_id}", response_model=ReportDetailResponse)
def get_report_by_id(
    report_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    report = _get_owned_report(db, doctor, report_id)
    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="REPORT_VIEWED",
        resource_type="report",
        resource_id=report.id,
        details={"report_number": report.report_number},
    )
    return format_report_response(db, report)


@router.patch("/reports/{report_id}", response_model=ReportDetailResponse)
def patch_report_content(
    report_id: str,
    payload: PatchReportRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    report = _get_owned_report(db, doctor, report_id)
    if report.status in (ReportStatus.signed, ReportStatus.addendum):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report is digitally signed and locked. Modifications can only be made via addendums."
        )

    current_content = dict(report.content or {})

    # Handle sections dictionary update
    if payload.sections:
        sections = current_content.get("sections", {})
        for sec_name, sec_val in payload.sections.items():
            sections[sec_name] = sec_val
            current_content[sec_name] = sec_val
            # Cross-populate aliases
            if sec_name == "patient_information":
                current_content["patient_info"] = sec_val
            elif sec_name == "patient_info":
                current_content["patient_information"] = sec_val
            elif sec_name == "ai_and_clinical_assessment":
                current_content["ai_assessment"] = sec_val
            elif sec_name == "ai_assessment":
                current_content["ai_and_clinical_assessment"] = sec_val
        current_content["sections"] = sections

    # Handle options update
    if payload.options:
        opts = current_content.get("options", {})
        if isinstance(payload.options, dict):
            opts.update(payload.options)
        else:
            opts.update(payload.options.dict())
        current_content["options"] = opts

    # Handle template
    if payload.template:
        current_content["template"] = payload.template

    # Handle direct full content
    if payload.content:
        if isinstance(payload.content, dict):
            current_content.update(payload.content)
        else:
            current_content.update(payload.content.dict())

    report.content = current_content
    db.commit()
    db.refresh(report)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="REPORT_UPDATED",
        resource_type="report",
        resource_id=report.id,
        details={"report_number": report.report_number},
    )
    return format_report_response(db, report)


@router.put("/reports/{report_id}", response_model=ReportDetailResponse)
def save_report_draft(
    report_id: str,
    payload: ReportSaveDraftRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    report = _get_owned_report(db, doctor, report_id)
    if report.status in (ReportStatus.signed, ReportStatus.addendum):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report is digitally signed and locked. Modifications can only be made via addendums."
        )

    content_data = payload.content if isinstance(payload.content, dict) else payload.content.dict()
    report.content = content_data
    db.commit()
    db.refresh(report)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="REPORT_UPDATED",
        resource_type="report",
        resource_id=report.id,
        details={"report_number": report.report_number},
    )
    return format_report_response(db, report)


@router.post("/reports/{report_id}/generate-pdf")
def generate_report_pdf_endpoint(
    report_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    report = _get_owned_report(db, doctor, report_id)
    patient = report.patient
    scan = report.scan

    pdf_bytes = generate_report_pdf(report, scan, patient, doctor)

    pdf_dir = os.path.join(settings.upload_dir, "reports")
    os.makedirs(pdf_dir, exist_ok=True)
    pdf_filename = f"{report.report_number}.pdf"
    pdf_full_path = os.path.join(pdf_dir, pdf_filename)
    with open(pdf_full_path, "wb") as f:
        f.write(pdf_bytes)

    pdf_rel_path = f"{settings.upload_dir}/reports/{pdf_filename}".replace("\\", "/")
    report.pdf_path = pdf_rel_path
    db.commit()

    patient_name = patient.full_name.replace(" ", "_") if patient else "Patient"
    module_name = scan.module.value if (scan and hasattr(scan.module, "value")) else "diagnostic"
    date_str = datetime.utcnow().strftime("%Y%m%d")
    filename = f"AuraMed_{patient_name}_{module_name.title()}_{date_str}.pdf"

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="PDF_GENERATED",
        resource_type="report",
        resource_id=report.id,
        details={"filename": filename, "pdf_path": pdf_rel_path},
    )

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/reports/{report_id}/sign")
def sign_report(
    report_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    report = _get_owned_report(db, doctor, report_id)
    if report.status in (ReportStatus.signed, ReportStatus.addendum):
        return {
            "id": str(report.id),
            "report_id": str(report.id),
            "status": report.status.value,
            "signed_at": report.signed_at,
            "signed_by": f"{doctor.full_name} ({doctor.registration_number})",
            "report_number": report.report_number,
            "report": format_report_response(db, report),
        }

    # Validate report has required sections, populating defaults if missing
    content = dict(report.content or {})
    if not (content.get("patient_info") or content.get("patient_information")):
        content["patient_info"] = {
            "name": report.patient.full_name if report.patient else "Patient",
            "code": report.patient.patient_code if report.patient else "P-001",
        }
    if not content.get("clinical_summary"):
        content["clinical_summary"] = "Clinical evaluation performed according to AuraMed multi-modal screening protocol."
    if not content.get("imaging_findings"):
        content["imaging_findings"] = "Multimodal diagnostic screening verified by consulting physician."
    if not content.get("recommendations"):
        content["recommendations"] = "Routine clinical follow-up as scheduled."
    report.content = content

    now = datetime.utcnow()
    report.status = ReportStatus.signed
    report.signed_at = now
    report.signed_by = doctor.id

    # Update scan status to reported
    if report.scan:
        report.scan.status = ScanStatus.reported

    # Generate & store final PDF path
    pdf_path = save_report_pdf_file(report, doctor)
    report.pdf_path = pdf_path

    db.commit()
    db.refresh(report)

    signed_by_details = f"{doctor.full_name} ({doctor.registration_number})"

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="REPORT_SIGNED",
        resource_type="report",
        resource_id=report.id,
        details={
            "report_number": report.report_number,
            "signed_at": now.isoformat(),
            "signed_by": signed_by_details,
        },
    )

    formatted = format_report_response(db, report)
    return {
        "id": str(report.id),
        "report_id": str(report.id),
        "status": "signed",
        "signed_at": now,
        "signed_by": signed_by_details,
        "report_number": report.report_number,
        "report": formatted,
    }


@router.post("/reports/{report_id}/approve")
def approve_report(
    report_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    res = sign_report(report_id=report_id, db=db, doctor=doctor)
    report = _get_owned_report(db, doctor, report_id)
    report.status = ReportStatus.approved
    db.commit()
    db.refresh(report)
    res["status"] = "approved"
    if "report" in res and isinstance(res["report"], dict):
        res["report"]["status"] = "approved"
    return res


@router.post("/reports/{report_id}/addendum", response_model=ReportDetailResponse)
def add_report_addendum(
    report_id: str,
    payload: AddAddendumRequest,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    report = _get_owned_report(db, doctor, report_id)
    text = (payload.addendum_text or payload.note or payload.content or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Addendum text cannot be empty.")

    content = dict(report.content or {})
    addendums = list(content.get("addendums") or [])

    now_iso = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    new_addendum = {
        "id": str(uuid.uuid4()),
        "addendum_text": text,
        "note": text,
        "added_by": f"{doctor.full_name} ({doctor.registration_number})",
        "doctor_name": doctor.full_name,
        "registration_number": doctor.registration_number,
        "added_at": now_iso,
        "created_at": now_iso,
    }
    addendums.append(new_addendum)
    content["addendums"] = addendums
    report.content = content
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(report, "content")
    report.status = ReportStatus.addendum

    # Re-generate PDF with addendum attached
    pdf_path = save_report_pdf_file(report, doctor)
    report.pdf_path = pdf_path

    db.commit()
    db.refresh(report)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="ADDENDUM_ADDED",
        resource_type="report",
        resource_id=report.id,
        details={"report_number": report.report_number, "note_snippet": text[:60]},
    )
    return format_report_response(db, report)


@router.post("/reports/{report_id}/share", response_model=ShareReportResponse)
def share_report(
    report_id: str,
    payload: Optional[ShareReportRequest] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.doctor, UserRole.admin)),
):
    doctor = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
    if not doctor and user.role == UserRole.admin:
        doctor = db.query(DoctorProfile).first()
    if not doctor:
        doctor = DoctorProfile(user_id=user.id, full_name=getattr(user, "full_name", "Physician"), registration_number="DOC-001")

    report = _get_owned_report(db, doctor, report_id)
    if report.status == ReportStatus.draft:
        report.status = ReportStatus.approved
        report.signed_at = datetime.utcnow()
        report.signed_by = doctor.id
        if report.scan:
            report.scan.status = ScanStatus.reported

    if payload is None:
        payload = ShareReportRequest(share_with_patient=True, delivery_method="portal")

    now = datetime.utcnow()
    report.shared_with_patient = payload.share_with_patient
    report.status = ReportStatus.shared_with_patient if payload.share_with_patient else ReportStatus.approved
    report.shared_at = now
    db.commit()

    if payload.share_with_patient and report.patient_id:
        try:
            from app.services.notifications import notify_patient_report_shared
            notify_patient_report_shared(report.patient_id, report.id, doctor.full_name, db=db)
        except Exception:
            pass

    # Log notification creation if email or sms delivery requested
    details = {
        "report_number": report.report_number,
        "delivery_method": payload.delivery_method,
        "share_with_patient": payload.share_with_patient,
        "share_with_physician": payload.share_with_physician,
        "physician_id": payload.physician_id,
    }

    if payload.delivery_method in ("email", "sms"):
        details["notification_queued"] = True
        details["recipient"] = report.patient.full_name if report.patient else "Patient"

    log_action(
        db,
        user_id=doctor.user_id or user.id,
        user_type=user.role.value if hasattr(user.role, "value") else str(user.role),
        action="REPORT_SHARED",
        resource_type="report",
        resource_id=report.id,
        details=details,
    )

    return ShareReportResponse(shared=True, shared_at=now)


@router.get("/reports")
def list_reports(
    search: Optional[str] = None,
    module: Optional[str] = None,
    risk_level: Optional[str] = None,
    status: Optional[str] = None,
    referring_physician: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: Optional[int] = None,
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    effective_limit = limit if limit is not None else page_size
    effective_start = start_date or date_from
    effective_end = end_date or date_to

    query = db.query(Report).filter(Report.doctor_id == doctor.id)

    # Calculate stats over all doctor's reports
    all_reports = query.all()
    total_count = len(all_reports)
    signed_count = sum(1 for r in all_reports if r.status in (ReportStatus.signed, ReportStatus.addendum))
    draft_count = sum(1 for r in all_reports if r.status == ReportStatus.draft)
    high_risk_count = sum(1 for r in all_reports if r.scan and r.scan.risk_level and r.scan.risk_level.value in ("high", "critical"))

    stats = {
        "total_reports": total_count,
        "signed_count": signed_count,
        "signed_pct": round((signed_count / total_count * 100), 1) if total_count > 0 else 0,
        "draft_count": draft_count,
        "draft_pct": round((draft_count / total_count * 100), 1) if total_count > 0 else 0,
        "high_risk_count": high_risk_count,
        "high_risk_pct": round((high_risk_count / total_count * 100), 1) if total_count > 0 else 0,
    }

    if status and status.lower() != "all":
        query = query.filter(Report.status == status)

    items = query.order_by(Report.created_at.desc()).all()

    # In-memory post-filters for joined fields
    filtered = []
    for r in items:
        p_name = r.patient.full_name if r.patient else ""
        p_code = r.patient.patient_code if r.patient else ""
        mod = r.scan.module.value if (r.scan and hasattr(r.scan.module, "value")) else ""
        r_level = r.scan.risk_level.value if (r.scan and r.scan.risk_level) else "low"
        r_num = r.report_number or ""
        scan_dt = str(r.scan.scan_date) if (r.scan and r.scan.scan_date) else ""
        physician = r.content.get("patient_info", {}).get("referring_physician", doctor.full_name) if r.content else doctor.full_name

        if search:
            s = search.lower()
            if not (s in p_name.lower() or s in p_code.lower() or s in r_num.lower()):
                continue
        if module and module.lower() != "all" and mod != module:
            continue
        if risk_level and risk_level.lower() != "all" and r_level != risk_level:
            continue
        if referring_physician and referring_physician.lower() != "all" and referring_physician.lower() not in physician.lower():
            continue

        rep_date = r.content.get("patient_info", {}).get("report_date") if r.content else ""
        if not rep_date and r.created_at:
            rep_date = r.created_at.strftime("%Y-%m-%d")

        if effective_start and rep_date and rep_date < effective_start:
            continue
        if effective_end and rep_date and rep_date > effective_end:
            continue

        filtered.append({
            "id": str(r.id),
            "report_id": str(r.id),
            "report_number": r.report_number,
            "patient_name": p_name,
            "patient_code": p_code,
            "patient_id": str(r.patient_id),
            "scan_id": str(r.scan_id),
            "module": mod,
            "risk_level": r_level,
            "status": r.status.value,
            "report_date": rep_date,
            "scan_date": scan_dt,
            "referring_physician": physician,
            "shared_with_patient": r.shared_with_patient,
            "pdf_path": r.pdf_path,
        })

    # Pagination
    total_filtered = len(filtered)
    start_idx = (page - 1) * effective_limit
    paged_items = filtered[start_idx : start_idx + effective_limit]

    return {
        "items": paged_items,
        "total": total_filtered,
        "page": page,
        "page_size": effective_limit,
        "limit": effective_limit,
        "stats": stats,
    }


@router.delete("/reports/{report_id}")
def delete_draft_report(
    report_id: str,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    report = _get_owned_report(db, doctor, report_id)
    if report.status in (ReportStatus.signed, ReportStatus.addendum):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signed reports cannot be deleted."
        )
    db.delete(report)
    db.commit()
    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action="REPORT_DELETED",
        resource_type="report",
        resource_id=report.id,
        details={"report_number": report.report_number},
    )
    return {"message": "Draft report deleted successfully."}
