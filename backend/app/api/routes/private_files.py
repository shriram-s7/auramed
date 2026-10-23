"""Authenticated, ownership-scoped replacement for public upload serving."""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.doctor_profile import DoctorProfile
from app.models.patient_profile import PatientProfile
from app.models.report import Report
from app.models.scan import Scan
from app.models.user import User

router = APIRouter()


def owned_scans(db, user):
    role = getattr(user.role, 'value', user.role)
    query = db.query(Scan)
    if role == 'doctor':
        doctor = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id,
                                               DoctorProfile.is_approved == True).first()
        return query.filter(Scan.doctor_id == doctor.id) if doctor else query.filter(False)
    if role == 'patient':
        patient = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
        return query.filter(Scan.patient_id == patient.id) if patient else query.filter(False)
    # Administration does not grant blanket clinical-file access here.
    return query.filter(False)


def resolve_upload(stored):
    root = Path(settings.upload_dir).resolve()
    value = str(stored or '').replace('\\', '/')
    path = Path(value)
    if not path.is_absolute():
        if value.startswith('uploads/'):
            path = root / value[len('uploads/'):]
        else:
            path = Path(value).resolve()
    target = path.resolve()
    if not target.is_relative_to(root):
        raise HTTPException(404, 'File not found')
    return target


@router.get('/uploads/{file_path:path}')
def private_upload(file_path: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    root = Path(settings.upload_dir).resolve()
    target = (root / file_path).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        raise HTTPException(404, 'File not found')
    scans = owned_scans(db, user).all()
    allowed = any(s.image_path and resolve_upload(s.image_path) == target for s in scans)
    if not allowed:
        scan_ids = [s.id for s in scans]
        reports = db.query(Report).filter(Report.scan_id.in_(scan_ids)).all()
        allowed = any(r.pdf_path and resolve_upload(r.pdf_path) == target and
                      (getattr(user.role, 'value', user.role) != 'patient' or (r.shared_with_patient and r.signed_at and (r.content or {}).get('workflow_version') == 1))
                      for r in reports)
    if not allowed:
        raise HTTPException(404, 'File not found')
    return FileResponse(target, headers={'Cache-Control': 'private, no-store',
                                        'X-Content-Type-Options': 'nosniff'})


@router.get('/api/scans/{scan_id}/primary-image')
def primary_image(scan_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        identifier = uuid.UUID(scan_id)
    except ValueError:
        raise HTTPException(404, 'Scan not found')
    scan = owned_scans(db, user).filter(Scan.id == identifier).first()
    if not scan:
        raise HTTPException(404, 'Scan not found')
    url = None
    if scan.image_path:
        relative = resolve_upload(scan.image_path).relative_to(Path(settings.upload_dir).resolve())
        url = '/uploads/' + relative.as_posix()
    return {'scan_id': str(scan.id), 'image_url': url}
