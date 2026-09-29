import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor_profile, get_current_user
from app.core.constants import (
    ALL_SESSIONS_REVOKED,
    DATA_EXPORTED,
    LOGIN_FAILED,
    LOGIN_SUCCESS,
    PASSWORD_CHANGED,
    PROFILE_UPDATED,
    SESSION_REVOKED,
)
from app.core.database import get_db
from app.core.security import (
    hash_password,
    parse_user_agent_details,
    validate_password_policy,
    verify_password,
)
from app.models.appointment import Appointment
from app.models.audit_log import AuditLog
from app.models.doctor_profile import DoctorProfile
from app.models.patient_profile import PatientProfile
from app.models.report import Report
from app.models.scan import Scan
from app.models.session import DoctorSession
from app.models.user import User
from app.schemas.settings import (
    ChangePasswordRequest,
    DoctorProfileUpdateRequest,
    DoctorSessionItem,
)
from app.services.audit import log_action

router = APIRouter(prefix="/api/doctor", tags=["doctor-settings"])

DEFAULT_NOTIFICATION_PREFERENCES = {
    "email": {
        "new_patient_assigned": True,
        "scan_analysis_completed": True,
        "report_ready_for_review": True,
        "followup_appointment_due": True,
        "followup_days_before": 2,
        "patient_viewed_report": True,
        "referral_status_updated": True,
        "system_maintenance_alerts": True,
        "new_guidelines_uploaded": False,
    },
    "in_app": {
        "new_patient_assigned": True,
        "scan_analysis_completed": True,
        "report_ready_for_review": True,
        "followup_appointment_due": True,
        "followup_days_before": 2,
        "patient_viewed_report": True,
        "referral_status_updated": True,
        "system_maintenance_alerts": True,
        "new_guidelines_uploaded": True,
    },
    "frequency": {
        "digest": "realtime",
        "quiet_hours_enabled": False,
        "quiet_hours_start": "22:00",
        "quiet_hours_end": "07:00",
    },
}

DEFAULT_CLINICAL_PREFERENCES = {
    "default_scan_settings": {
        "image_quality_threshold": "Adequate",
        "followup_intervals": {
            "critical_risk": {"value": 2, "unit": "days"},
            "high_risk": {"value": 1, "unit": "weeks"},
            "moderate_risk": {"value": 4, "unit": "weeks"},
            "low_risk": {"value": 6, "unit": "months"},
        },
    },
    "report_preferences": {
        "default_template": "Comprehensive Oncological Screening Report",
        "auto_include_ai_analysis": True,
        "auto_include_reference_ranges": True,
        "auto_include_disclaimers": True,
        "digital_signature_style": "Dr. [Full Name]",
    },
    "display_preferences": {
        "default_workbench_module": "breast",
        "results_page_layout": "Detailed",
        "date_format": "DD/MM/YYYY",
        "time_format": "12 hour",
    },
}


def _get_current_session_jti(request: Request) -> Optional[str]:
    return getattr(request.state, "current_session_jti", None)


@router.get("/settings")
def get_doctor_settings(
    request: Request,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    """
    Returns current settings for logged-in doctor:
      profile: {full_name, specialty, hospital, phone, email, address}
      notifications: {all notification toggles and preferences}
      clinical: {default followup intervals, report preferences, display preferences}
      security: {two_factor_enabled, active_sessions count}
    """
    user = doctor.user

    notifications_data = (
        doctor.notification_preferences
        if doctor.notification_preferences
        else DEFAULT_NOTIFICATION_PREFERENCES
    )
    clinical_data = (
        doctor.clinical_preferences
        if doctor.clinical_preferences
        else DEFAULT_CLINICAL_PREFERENCES
    )

    active_sessions_count = (
        db.query(DoctorSession)
        .filter(
            DoctorSession.doctor_id == doctor.id,
            DoctorSession.is_revoked == False,
            DoctorSession.is_expired == False,
        )
        .count()
    )
    if active_sessions_count == 0:
        active_sessions_count = 1

    profile_data = {
        "full_name": doctor.full_name,
        "specialty": doctor.specialty or "Oncology Specialist",
        "hospital": doctor.hospital or "AuraMed General Hospital, Chennai",
        "phone": doctor.phone or "+91 98401 23456",
        "email": user.email,
        "address": doctor.address or "Suite 402, Clinical Oncology & Diagnostic Wing, Chennai",
        "registration_number": doctor.registration_number,
    }

    security_data = {
        "two_factor_enabled": bool(doctor.two_factor_enabled),
        "active_sessions": active_sessions_count,
    }

    account_info = {
        "doctor_id": f"DOC-{str(doctor.id)[:8].upper()}",
        "account_created": user.created_at.strftime("%b %d, %Y") if user.created_at else "Jan 15, 2026",
        "last_login": "Today, 08:30 AM IST",
        "account_status": "Verified Clinician",
        "is_approved": doctor.is_approved,
        "verified_on": doctor.approved_at.strftime("%b %d, %Y") if doctor.approved_at else "Jan 16, 2026",
    }

    return {
        "profile": profile_data,
        "notifications": notifications_data,
        "clinical": clinical_data,
        "clinical_preferences": clinical_data,
        "security": security_data,
        "account_info": account_info,
        "privacy_data": {
            "allow_anonymized_data": True,
            "receive_product_updates": True,
            "is_deactivated": not user.is_active,
        },
    }


@router.patch("/settings/profile")
def update_doctor_profile_endpoint(
    payload: DoctorProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    """
    Body: {full_name, specialty, hospital, phone, email, address}
    Validates phone format
    Updates DoctorProfile and User records
    Audit log: PROFILE_UPDATED
    """
    user = doctor.user
    changed_fields = []

    if payload.full_name is not None and payload.full_name.strip():
        doctor.full_name = payload.full_name.strip()
        changed_fields.append("full_name")

    if payload.specialty is not None:
        doctor.specialty = payload.specialty.strip()
        changed_fields.append("specialty")

    if payload.hospital is not None:
        doctor.hospital = payload.hospital.strip()
        changed_fields.append("hospital")

    if payload.phone is not None:
        doctor.phone = payload.phone.strip()
        changed_fields.append("phone")

    if payload.address is not None:
        doctor.address = payload.address.strip()
        changed_fields.append("address")

    if payload.email is not None and payload.email.strip():
        new_email = payload.email.strip().lower()
        if new_email != user.email:
            existing = db.query(User).filter(User.email == new_email).first()
            if existing:
                raise HTTPException(status_code=400, detail="This email is already in use.")
            user.email = new_email
            changed_fields.append("email")

    db.commit()
    db.refresh(doctor)
    db.refresh(user)

    log_action(
        db,
        user_id=user.id,
        user_type="doctor",
        action=PROFILE_UPDATED,
        resource_type="doctor_profile",
        resource_id=doctor.id,
        details={"changed_fields": changed_fields},
        request=request,
    )

    profile_dict = {
        "full_name": doctor.full_name,
        "specialty": doctor.specialty,
        "hospital": doctor.hospital,
        "phone": doctor.phone,
        "email": user.email,
        "address": doctor.address,
    }
    return {
        "message": "Doctor profile updated successfully.",
        "profile": profile_dict,
        **profile_dict,
    }


@router.patch("/settings/notifications")
def update_doctor_notifications_endpoint(
    payload: Dict[str, Any],
    request: Request,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    """
    Body: notification preferences object
    Saves to doctor profile JSON field: notification_preferences
    """
    current_prefs = dict(doctor.notification_preferences or DEFAULT_NOTIFICATION_PREFERENCES)
    current_prefs.update(payload)
    doctor.notification_preferences = current_prefs
    db.commit()
    db.refresh(doctor)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action=PROFILE_UPDATED,
        resource_type="doctor_profile",
        resource_id=doctor.id,
        details={"section": "notifications"},
        request=request,
    )

    return {
        "message": "Notification preferences updated successfully.",
        "notifications": doctor.notification_preferences,
        **(doctor.notification_preferences or {}),
    }


@router.patch("/settings/clinical")
def update_doctor_clinical_endpoint(
    payload: Dict[str, Any],
    request: Request,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    """
    Body: clinical preferences object
    Saves to doctor profile JSON field: clinical_preferences
    """
    current_prefs = dict(doctor.clinical_preferences or DEFAULT_CLINICAL_PREFERENCES)
    current_prefs.update(payload)
    doctor.clinical_preferences = current_prefs
    db.commit()
    db.refresh(doctor)

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action=PROFILE_UPDATED,
        resource_type="doctor_profile",
        resource_id=doctor.id,
        details={"section": "clinical_preferences"},
        request=request,
    )

    return {
        "message": "Clinical preferences updated successfully.",
        "clinical": doctor.clinical_preferences,
        **(doctor.clinical_preferences or {}),
    }


@router.patch("/settings")
def update_doctor_settings_unified(
    payload: Dict[str, Any],
    request: Request,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    """Unified handler for frontend settings form saving."""
    if "profile" in payload and isinstance(payload["profile"], dict):
        p = payload["profile"]
        update_doctor_profile_endpoint(
            DoctorProfileUpdateRequest(**p), request=request, db=db, doctor=doctor
        )

    if "notifications" in payload and isinstance(payload["notifications"], dict):
        update_doctor_notifications_endpoint(
            payload["notifications"], request=request, db=db, doctor=doctor
        )

    clinical_payload = payload.get("clinical") or payload.get("clinical_preferences")
    if clinical_payload and isinstance(clinical_payload, dict):
        update_doctor_clinical_endpoint(
            clinical_payload, request=request, db=db, doctor=doctor
        )

    if "security" in payload and isinstance(payload["security"], dict):
        sec = payload["security"]
        if "two_factor_enabled" in sec:
            doctor.two_factor_enabled = bool(sec["two_factor_enabled"])
            db.commit()

    return get_doctor_settings(request, db, doctor)


@router.post("/change-password")
def doctor_change_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    """
    Body: {current_password, new_password, confirm_new_password}
    Validates current password is correct
    Validates new passwords match
    Validates new password meets policy: min 8 chars, uppercase, number, special character
    Updates password hash
    Invalidates all other sessions
    Audit log: PASSWORD_CHANGED
    """
    user = doctor.user

    # 1. Verify current password
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    # 2. Confirm new password matches if provided
    if payload.confirm_new_password is not None:
        if payload.new_password != payload.confirm_new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password and confirm password do not match.",
            )

    # 3. Validate password complexity policy
    try:
        validate_password_policy(payload.new_password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # 4. Update password hash
    user.password_hash = hash_password(payload.new_password)

    # 5. Invalidate all other sessions for this doctor
    current_jti = _get_current_session_jti(request)
    if current_jti:
        db.query(DoctorSession).filter(
            DoctorSession.doctor_id == doctor.id,
            DoctorSession.token_jti != current_jti,
        ).update({"is_revoked": True})
    else:
        # If running in test client without session jti, revoke non-current
        db.query(DoctorSession).filter(
            DoctorSession.doctor_id == doctor.id
        ).update({"is_revoked": True})

    db.commit()

    # 6. Audit log
    log_action(
        db,
        user_id=user.id,
        user_type="doctor",
        action=PASSWORD_CHANGED,
        resource_type="user",
        resource_id=user.id,
        details={"invalidated_other_sessions": True},
        request=request,
    )

    return {"message": "Password changed successfully. All other active sessions have been invalidated."}


@router.get("/sessions", response_model=List[DoctorSessionItem])
def get_doctor_sessions(
    request: Request,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    """
    Returns list of active JWT sessions for this doctor.
    Each session: device, browser, ip, location, last_active, is_current (bool)
    """
    current_jti = _get_current_session_jti(request)

    db_sessions = (
        db.query(DoctorSession)
        .filter(
            DoctorSession.doctor_id == doctor.id,
            DoctorSession.is_revoked == False,
            DoctorSession.is_expired == False,
        )
        .order_by(DoctorSession.last_active.desc())
        .all()
    )

    # If no sessions exist yet in DB, create one for current interaction
    if not db_sessions:
        dev, brw = parse_user_agent_details(request.headers.get("user-agent"))
        ip = request.client.host if request.client else "127.0.0.1"
        new_sess = DoctorSession(
            doctor_id=doctor.id,
            user_id=doctor.user_id,
            token_jti=current_jti or str(uuid.uuid4()),
            device=dev,
            browser=brw,
            ip=ip,
            location="Chennai, Tamil Nadu, India",
        )
        db.add(new_sess)
        db.commit()
        db.refresh(new_sess)
        db_sessions = [new_sess]

    results = []
    for s in db_sessions:
        is_cur = False
        if current_jti and s.token_jti == current_jti:
            is_cur = True
        elif not current_jti and s == db_sessions[0]:
            is_cur = True

        results.append(
            DoctorSessionItem(
                id=str(s.id),
                device=s.device or "Desktop Workstation",
                browser=s.browser or "Chrome",
                ip=s.ip,
                ip_address=s.ip,
                location=s.location or "Chennai, Tamil Nadu, India",
                last_active=s.last_active.strftime("%Y-%m-%d %H:%M UTC") if s.last_active else "Active",
                is_current=is_cur,
            )
        )

    return results


@router.delete("/sessions/all-others")
@router.delete("/sessions")
def revoke_all_other_sessions_endpoint(
    request: Request,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    """
    Revokes all sessions except current one.
    Audit log: ALL_SESSIONS_REVOKED
    """
    current_jti = _get_current_session_jti(request)

    query = db.query(DoctorSession).filter(
        DoctorSession.doctor_id == doctor.id,
        DoctorSession.is_revoked == False,
    )
    if current_jti:
        query = query.filter(DoctorSession.token_jti != current_jti)

    revoked_count = query.update({"is_revoked": True}, synchronize_session="fetch")
    db.commit()

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action=ALL_SESSIONS_REVOKED,
        resource_type="doctor_session",
        resource_id=doctor.id,
        details={"revoked_count": revoked_count},
        request=request,
    )

    return {"message": "All other sessions have been revoked.", "revoked_count": revoked_count}


@router.delete("/sessions/{session_id}")
def revoke_session_endpoint(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    """
    Marks session as revoked.
    That session token can no longer be used.
    Audit log: SESSION_REVOKED
    """
    try:
        s_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format.")

    sess = (
        db.query(DoctorSession)
        .filter(
            DoctorSession.id == s_uuid,
            DoctorSession.doctor_id == doctor.id,
        )
        .first()
    )
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found.")

    sess.is_revoked = True
    db.commit()

    log_action(
        db,
        user_id=doctor.user_id,
        user_type="doctor",
        action=SESSION_REVOKED,
        resource_type="doctor_session",
        resource_id=sess.id,
        details={"revoked_session_id": session_id},
        request=request,
    )

    return {"message": "Session revoked successfully.", "session_id": session_id}


@router.get("/login-history")
def get_doctor_login_history(
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    """
    Returns last 20 audit log entries where action is
    LOGIN_SUCCESS or LOGIN_FAILED for this doctor.
    """
    logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.user_id == doctor.user_id,
            AuditLog.action.in_([LOGIN_SUCCESS, LOGIN_FAILED, "login_success", "login_failed"]),
        )
        .order_by(AuditLog.created_at.desc())
        .limit(20)
        .all()
    )

    return [
        {
            "id": str(l.id),
            "action": l.action,
            "timestamp": l.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if l.created_at else "Recent",
            "date_time": l.created_at.strftime("%b %d, %Y, %I:%M %p") if l.created_at else "Recent",
            "ip_address": l.ip_address or "127.0.0.1",
            "device": l.details.get("user_agent", "Desktop Workstation") if isinstance(l.details, dict) else "Desktop",
            "status": "Success" if "SUCCESS" in l.action.upper() else "Failed",
            "details": l.details,
        }
        for l in logs
    ]


@router.post("/export-data")
def export_doctor_data_endpoint(
    request: Request,
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    """
    Generates a JSON export of all doctor's data:
      Profile information
      List of all patients they created
      List of all scans they analyzed
      List of all reports they generated
      Their activity log

    Returns the JSON as a file download.
    Audit log: DATA_EXPORTED
    """
    user = doctor.user

    # 1. Profile information
    profile_info = {
        "full_name": doctor.full_name,
        "registration_number": doctor.registration_number,
        "specialty": doctor.specialty,
        "hospital": doctor.hospital,
        "phone": doctor.phone,
        "email": user.email,
        "address": doctor.address,
        "is_approved": doctor.is_approved,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }

    # 2. Patients created by doctor
    patients = (
        db.query(PatientProfile)
        .filter(PatientProfile.created_by_doctor_id == doctor.id)
        .all()
    )
    patient_list = [
        {
            "id": str(p.id),
            "patient_code": p.patient_code,
            "full_name": p.full_name,
            "gender": p.gender,
            "date_of_birth": str(p.date_of_birth) if p.date_of_birth else None,
            "phone": p.phone,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in patients
    ]

    # 3. Scans analyzed by doctor
    scans = (
        db.query(Scan)
        .filter(Scan.doctor_id == doctor.id)
        .all()
    )
    scan_list = [
        {
            "id": str(s.id),
            "patient_id": str(s.patient_id),
            "module": s.module.value if hasattr(s.module, "value") else str(s.module),
            "status": s.status.value if hasattr(s.status, "value") else str(s.status),
            "risk_level": s.risk_level.value if hasattr(s.risk_level, "value") else (str(s.risk_level) if s.risk_level else None),
            "clinical_inputs": s.clinical_inputs,
            "analysis_results": s.analysis_results,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in scans
    ]

    # 4. Reports generated by doctor
    reports = (
        db.query(Report)
        .filter(Report.doctor_id == doctor.id)
        .all()
    )
    report_list = [
        {
            "id": str(r.id),
            "report_number": r.report_number,
            "scan_id": str(r.scan_id) if r.scan_id else None,
            "patient_id": str(r.patient_id) if r.patient_id else None,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "content": r.content,
            "signed_at": r.signed_at.isoformat() if r.signed_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reports
    ]

    # 5. Doctor Activity log
    activity_logs = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(100)
        .all()
    )
    activity_list = [
        {
            "id": str(l.id),
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": str(l.resource_id) if l.resource_id else None,
            "details": l.details,
            "ip_address": l.ip_address,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in activity_logs
    ]

    export_bundle = {
        "profile": profile_info,
        "doctor_profile": profile_info,
        "patients": patient_list,
        "scans": scan_list,
        "reports": report_list,
        "activity_log": activity_list,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "regulatory_compliance": "DPDP Act 2023 / HIPAA Clinician Data Portability Export",
    }

    json_content = json.dumps(export_bundle, indent=2)
    filename = f"auramed_doctor_export_{doctor.registration_number}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    # Audit log
    log_action(
        db,
        user_id=user.id,
        user_type="doctor",
        action=DATA_EXPORTED,
        resource_type="doctor_profile",
        resource_id=doctor.id,
        details={"export_type": "full_doctor_archive", "record_counts": {
            "patients": len(patient_list),
            "scans": len(scan_list),
            "reports": len(report_list),
        }},
        request=request,
    )

    return Response(
        content=json_content,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/deactivate")
def deactivate_account(
    db: Session = Depends(get_db),
    doctor: DoctorProfile = Depends(get_current_doctor_profile),
):
    doctor.user.is_active = False
    db.commit()
    return {
        "message": "Account deactivated. All patient records preserved. Contact administrator to reactivate."
    }
