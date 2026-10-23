"""Guided clinical workflow: explicit review and persistent patient requests."""
import uuid
from datetime import date, datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_doctor_profile
from app.models.scan import Scan
from app.models.report import Report
from app.models.appointment import Appointment
from app.models.appointment_request import AppointmentRequest
from app.models.patient_profile import PatientProfile
from app.models.enums import ScanStatus, ScreeningModule, ReportStatus, AppointmentStatus
from app.services.clinical_record import review_of, report_content
from app.services.audit import log_action
from app.services.care_messaging import clinic_today

router = APIRouter(prefix='/api/doctor/workflow', tags=['guided-workflow'])


def identifier(value):
    try: return uuid.UUID(str(value))
    except ValueError: raise HTTPException(404, 'Record not found')


def owned_visit(db, doctor, value):
    row = db.query(Scan).filter(Scan.id == identifier(value), Scan.doctor_id == doctor.id).first()
    if not row: raise HTTPException(404, 'Visit not found')
    return row


def visit_json(row, db):
    report = db.query(Report).filter(Report.scan_id == row.id).first()
    research = row.reasoning or {}
    return {'id': str(row.id), 'patient_id': str(row.patient_id), 'patient_name': row.patient.full_name,
            'patient_code': row.patient.patient_code, 'module': row.module.value, 'date': row.scan_date,
            'status': row.status.value, 'review': review_of(row), 'inputs': row.clinical_inputs or {},
            'image_score': row.image_model_score, 'has_image': bool(row.image_path),
            'analysis_state': research.get('analysis_state', 'completed' if row.image_model_score is not None else 'not_requested'),
            'research_class': (research.get('model_class') or None),
            'explanation': research.get('grad_cam_base64') or research.get('gradcam_heatmap_b64'),
            'synthetic': bool((row.patient.consent or {}).get('synthetic_demo')),
            'report_id': str(report.id) if report else None,
            'addendums': (report.content or {}).get('addendums', []) if report else [],
            'signed': bool(report and report.signed_at),
            'released': bool(report and report.shared_with_patient)}


class VisitCreate(BaseModel):
    patient_id: str
    module: Literal['breast', 'cervical', 'pcos']


@router.post('/visits', status_code=201)
def create_visit(payload: VisitCreate, db: Session = Depends(get_db), doctor=Depends(get_current_doctor_profile)):
    patient = db.query(PatientProfile).filter(PatientProfile.id == identifier(payload.patient_id),
        PatientProfile.created_by_doctor_id == doctor.id).first()
    if not patient: raise HTTPException(404, 'Patient not found')
    row = Scan(patient_id=patient.id, doctor_id=doctor.id, module=ScreeningModule(payload.module),
               scan_date=clinic_today(), status=ScanStatus.draft, clinical_inputs={},
               reasoning={'analysis_state': 'not_requested'})
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user_id=doctor.user_id, user_type='doctor', action='VISIT_CREATED', resource_type='scan', resource_id=row.id)
    return visit_json(row, db)


@router.get('/visits')
def list_visits(patient_id: str | None = None, db: Session = Depends(get_db), doctor=Depends(get_current_doctor_profile)):
    query = db.query(Scan).filter(Scan.doctor_id == doctor.id, Scan.status != ScanStatus.archived)
    if patient_id: query = query.filter(Scan.patient_id == identifier(patient_id))
    return [visit_json(row, db) for row in query.order_by(Scan.created_at.desc()).all()]


@router.get('/visits/{visit_id}')
def get_visit(visit_id: str, db: Session = Depends(get_db), doctor=Depends(get_current_doctor_profile)):
    return visit_json(owned_visit(db, doctor, visit_id), db)


class Review(BaseModel):
    findings: str = Field(default='', max_length=10000)
    source: str = Field(default='', max_length=1000)
    assessment: str = Field(default='', max_length=10000)
    plan: str = Field(default='', max_length=10000)
    next_action: Literal['none', 'appointment', 'referral', 'repeat', 'recall'] = 'appointment'
    priority: Literal['routine', 'priority'] = 'routine'
    complete: bool = False


@router.patch('/visits/{visit_id}/review')
def save_review(visit_id: str, payload: Review, db: Session = Depends(get_db), doctor=Depends(get_current_doctor_profile)):
    row = owned_visit(db, doctor, visit_id)
    report = db.query(Report).filter(Report.scan_id == row.id).first()
    if report and report.signed_at: raise HTTPException(409, 'This report is finalized. Use an addendum or start a new visit.')
    if payload.complete and any(not str(getattr(payload, field)).strip() for field in ('findings', 'source', 'assessment', 'plan')):
        raise HTTPException(422, 'Record findings, their source, your assessment and the next-step instructions before completing review.')
    review = {**payload.model_dump(), 'reviewed_at': datetime.now(timezone.utc).isoformat(), 'reviewer': doctor.full_name}
    mods = dict(row.doctor_modifications or {})
    mods['clinical_review'] = review
    row.doctor_modifications = mods
    if payload.complete: row.status = ScanStatus.analyzed
    if report: report.content = report_content(row, doctor)
    db.commit()
    if payload.complete:
        from app.services.report_service import get_or_create_report_for_scan
        get_or_create_report_for_scan(db, row, doctor)
    log_action(db, user_id=doctor.user_id, user_type='doctor', action='CLINICAL_REVIEW_COMPLETED' if payload.complete else 'CLINICAL_REVIEW_SAVED', resource_type='scan', resource_id=row.id)
    return visit_json(row, db)


def request_json(row, db):
    patient = db.get(PatientProfile, row.patient_id)
    appt = db.get(Appointment, row.appointment_id)
    return {'id': str(row.id), 'appointment_id': str(row.appointment_id), 'patient_name': patient.full_name,
            'patient_id': str(row.patient_id), 'date': row.preferred_date, 'time': row.preferred_time.strftime('%H:%M'),
            'reason': row.reason, 'status': row.status, 'response': row.response,
            'original_date': appt.scheduled_date, 'original_time': appt.scheduled_time.strftime('%H:%M') if appt.scheduled_time else None}


@router.get('/requests')
def requests(db: Session = Depends(get_db), doctor=Depends(get_current_doctor_profile)):
    return [request_json(r, db) for r in db.query(AppointmentRequest).filter(AppointmentRequest.doctor_id == doctor.id,
        AppointmentRequest.status == 'pending').order_by(AppointmentRequest.created_at).all()]


class RequestDecision(BaseModel):
    decision: Literal['accept', 'decline']
    response: str = Field(min_length=3, max_length=2000)


@router.post('/requests/{request_id}/resolve')
def resolve_request(request_id: str, payload: RequestDecision, db: Session = Depends(get_db), doctor=Depends(get_current_doctor_profile)):
    row = db.query(AppointmentRequest).filter(AppointmentRequest.id == identifier(request_id), AppointmentRequest.doctor_id == doctor.id).first()
    if not row: raise HTTPException(404, 'Request not found')
    if row.status != 'pending': raise HTTPException(409, 'This request has already been resolved')
    appt = db.get(Appointment, row.appointment_id)
    if appt.status in (AppointmentStatus.cancelled, AppointmentStatus.completed):
        raise HTTPException(409, 'The appointment is closed')
    if payload.decision == 'accept':
        from app.api.routes.appointments import patch_appointment, PatchAppointmentRequest
        patch_appointment(str(appt.id), PatchAppointmentRequest(date=row.preferred_date,
            time=row.preferred_time.strftime('%H:%M')), db, doctor)
    row.status = 'accepted' if payload.decision == 'accept' else 'declined'
    row.response = payload.response.strip()
    db.commit()
    log_action(db, user_id=doctor.user_id, user_type='doctor', action='PATIENT_REQUEST_RESOLVED', resource_type='appointment',
               resource_id=appt.id, details={'request_id': str(row.id), 'decision': row.status})
    return request_json(row, db)
