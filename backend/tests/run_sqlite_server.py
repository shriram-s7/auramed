"""
Runs the real FastAPI app against an in-memory SQLite DB, for manual/browser
end-to-end testing of the auth flows without a live PostgreSQL server.
Seeds the same three demo accounts as app/seed.py.
"""
import os
import sys
import uuid

os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("SECRET_KEY", "dev-e2e-secret")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, TypeDecorator, CHAR, event
from sqlalchemy.orm import sessionmaker
import sqlalchemy.dialects.postgresql as pg_types


class SqliteUUID(TypeDecorator):
    impl = CHAR(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return str(value) if value is not None else value

    def process_result_value(self, value, dialect):
        return uuid.UUID(value) if value is not None else value


pg_types.UUID = lambda as_uuid=True: SqliteUUID()

import app.core.database as database_module

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sqlite_path = os.path.join(base_dir, "auramed_dev.db")

for p in [sqlite_path, sqlite_path + "-wal", sqlite_path + "-shm"]:
    try:
        if os.path.exists(p):
            os.remove(p)
    except Exception:
        pass

engine = create_engine(
    f"sqlite:///{sqlite_path}",
    connect_args={"check_same_thread": False, "timeout": 30},
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.close()


database_module.engine = engine
database_module.SessionLocal = sessionmaker(
    autocommit=False, autoflush=False, expire_on_commit=False, bind=engine
)

import app.models  # noqa
from app.core.database import Base
from app.core.security import hash_password
from app.models.enums import (
    AppointmentStatus,
    RiskLevel,
    ScanStatus,
    ScreeningModule,
    UserRole,
)
from app.models.user import User
from app.models.doctor_profile import DoctorProfile
from app.models.patient_profile import PatientProfile
from app.models.scan import Scan
from app.models.appointment import Appointment
from app.models.report import Report
from app.models.referral import Referral
from app.services.audit import log_action

import datetime as _dt

Base.metadata.create_all(bind=engine)

db = database_module.SessionLocal()

# --- ADMIN ACCOUNTS ---
testadmin1 = User(email="testadmin1@auramed.com", password_hash=hash_password("Admin@123"), role=UserRole.admin, is_active=True, is_verified=True)
legacy_admin = User(email="admin@auramed.com", password_hash=hash_password("123"), role=UserRole.admin, is_active=True, is_verified=True)
db.add_all([testadmin1, legacy_admin])
db.flush()

# --- DOCTORS ---
# testdr1: Dr. Ananya Sharma (Radiology)
dr1_user = User(email="testdr1@auramed.com", password_hash=hash_password("Doctor@123"), role=UserRole.doctor, is_active=True, is_verified=True)
db.add(dr1_user)
db.flush()
dr1_profile = DoctorProfile(
    user_id=dr1_user.id, full_name="Dr. Ananya Sharma", registration_number="TNMC-DR-001",
    specialty="Radiology", hospital="AuraMed Clinical Center", phone="+91-9800000001",
    is_approved=True, approved_at=_dt.datetime.now(_dt.timezone.utc),
)
db.add(dr1_profile)
db.flush()

# testdr2: Dr. Rohan Mehta (Oncology)
dr2_user = User(email="testdr2@auramed.com", password_hash=hash_password("Doctor@123"), role=UserRole.doctor, is_active=True, is_verified=True)
db.add(dr2_user)
db.flush()
dr2_profile = DoctorProfile(
    user_id=dr2_user.id, full_name="Dr. Rohan Mehta", registration_number="TNMC-DR-002",
    specialty="Oncology", hospital="AuraMed General Hospital", phone="+91-9800000002",
    is_approved=True, approved_at=_dt.datetime.now(_dt.timezone.utc),
)
db.add(dr2_profile)
db.flush()

# testdr3: Dr. Priya Iyer (Gynecology)
dr3_user = User(email="testdr3@auramed.com", password_hash=hash_password("Doctor@123"), role=UserRole.doctor, is_active=True, is_verified=True)
db.add(dr3_user)
db.flush()
dr3_profile = DoctorProfile(
    user_id=dr3_user.id, full_name="Dr. Priya Iyer", registration_number="TNMC-DR-003",
    specialty="Gynecology", hospital="AuraMed Specialty Clinic", phone="+91-9800000003",
    is_approved=True, approved_at=_dt.datetime.now(_dt.timezone.utc),
)
db.add(dr3_profile)
db.flush()

# Legacy doctor: dr.mehta@auramed.com / 123
legacy_doc = User(email="dr.mehta@auramed.com", password_hash=hash_password("123"), role=UserRole.doctor, is_active=True, is_verified=True)
db.add(legacy_doc)
db.flush()
legacy_doc_profile = DoctorProfile(
    user_id=legacy_doc.id, full_name="Dr. Mehta", registration_number="TNMC123456",
    specialty="Gynecologic Oncology", hospital="AuraMed General Hospital", phone="+91-9000000001",
    is_approved=True,
)
db.add(legacy_doc_profile)
db.flush()

# --- PATIENTS ---
# testpatient1: Priya Nair (34F)
p1_user = User(email="testpatient1@auramed.com", password_hash=hash_password("Patient@123"), role=UserRole.patient, is_active=True, is_verified=True)
db.add(p1_user)
db.flush()
p1_profile = PatientProfile(user_id=p1_user.id, patient_code="P-2026-0001", full_name="Priya Nair", gender="Female", created_by_doctor_id=dr1_profile.id)
db.add(p1_profile)
db.flush()

# testpatient2: Meera Krishnan (45F)
p2_user = User(email="testpatient2@auramed.com", password_hash=hash_password("Patient@123"), role=UserRole.patient, is_active=True, is_verified=True)
db.add(p2_user)
db.flush()
p2_profile = PatientProfile(user_id=p2_user.id, patient_code="P-2026-0002", full_name="Meera Krishnan", gender="Female", created_by_doctor_id=dr1_profile.id)
db.add(p2_profile)
db.flush()

# testpatient3: Lakshmi Venkat (28F)
p3_user = User(email="testpatient3@auramed.com", password_hash=hash_password("Patient@123"), role=UserRole.patient, is_active=True, is_verified=True)
db.add(p3_user)
db.flush()
p3_profile = PatientProfile(user_id=p3_user.id, patient_code="P-2026-0003", full_name="Lakshmi Venkat", gender="Female", created_by_doctor_id=dr1_profile.id)
db.add(p3_profile)
db.flush()

# Legacy patient: anita@auramed.com / 123
legacy_pat = User(email="anita@auramed.com", password_hash=hash_password("123"), role=UserRole.patient, is_active=True, is_verified=True)
db.add(legacy_pat)
db.flush()
legacy_pat_profile = PatientProfile(user_id=legacy_pat.id, patient_code="P-2026-0004", full_name="Anita Sharma", created_by_doctor_id=dr1_profile.id)
db.add(legacy_pat_profile)
db.flush()

today = _dt.date.today()

# Scans for testdr1 and patients
scan1 = Scan(
    patient_id=p1_profile.id, doctor_id=dr1_profile.id, module=ScreeningModule.breast,
    scan_date=today - _dt.timedelta(days=1), status=ScanStatus.analyzed, risk_level=RiskLevel.critical,
    confidence_explanation="Dense mass with irregular margins detected on mammogram.",
    fusion_score=0.91, confidence_score=0.88,
)
scan2 = Scan(
    patient_id=p2_profile.id, doctor_id=dr1_profile.id, module=ScreeningModule.cervical,
    scan_date=today - _dt.timedelta(days=2), status=ScanStatus.analyzed, risk_level=RiskLevel.high,
    confidence_explanation="High-grade squamous lesion suspected on cytology.",
    fusion_score=0.78, confidence_score=0.81,
)
scan3 = Scan(
    patient_id=p1_profile.id, doctor_id=dr1_profile.id, module=ScreeningModule.pcos,
    scan_date=today - _dt.timedelta(days=5), status=ScanStatus.reported, risk_level=RiskLevel.low,
    confidence_explanation="Routine baseline assessment, normal ovarian morphology.",
    fusion_score=0.22, confidence_score=0.9,
)
scan1_early = Scan(
    patient_id=p1_profile.id, doctor_id=dr1_profile.id, module=ScreeningModule.breast,
    scan_date=today - _dt.timedelta(days=90), status=ScanStatus.reported, risk_level=RiskLevel.low,
    confidence_explanation="Routine baseline mammogram, no abnormalities.",
    fusion_score=0.18, confidence_score=0.92,
)
scan1_mid = Scan(
    patient_id=p1_profile.id, doctor_id=dr1_profile.id, module=ScreeningModule.breast,
    scan_date=today - _dt.timedelta(days=45), status=ScanStatus.reported, risk_level=RiskLevel.moderate,
    confidence_explanation="Slight density change noted, recommended closer follow-up.",
    fusion_score=0.48, confidence_score=0.85,
)

db.add_all([scan1_early, scan1_mid, scan1, scan2, scan3])
db.flush()

referral1 = Referral(
    patient_id=p1_profile.id, from_doctor_id=dr1_profile.id,
    to_specialist="Dr. Kavitha Suresh", specialty="Breast Oncology Surgery",
    reason="Critical risk mammogram finding requires surgical oncology evaluation.",
    priority="urgent", status="pending",
)
db.add(referral1)

report3 = Report(
    scan_id=scan3.id, patient_id=p1_profile.id, doctor_id=dr1_profile.id,
    report_number="RPT-2026-0001", status="signed", signed_at=_dt.datetime.now(_dt.timezone.utc),
    content={
        "patient_info": {
            "name": "Priya Nair",
            "patient_id": "P-2026-0001",
            "age": 34,
            "gender": "Female",
            "date_of_scan": str(today - _dt.timedelta(days=5)),
            "referring_physician": "Dr. Ananya Sharma",
            "scan_type": "PCOS Screening Ultrasound",
            "indication": "Routine Baseline Ultrasound",
            "report_date": str(today - _dt.timedelta(days=5)),
        },
        "clinical_summary": {
            "summary_text": "Patient presented for baseline PCOS screening evaluation. No acute abnormalities.",
            "factors": []
        },
        "imaging_findings": {
            "description": "Pelvic ultrasound demonstrates normal ovarian morphology.",
            "findings_bullets": ["Normal ovarian volume bilaterally", "Follicular distribution physiologic"]
        },
        "risk_assessment": {
            "risk_level": "low",
            "label": "Low Risk",
            "recommendation_sentence": "Routine follow-up in 12 months."
        },
        "recommendations": {
            "recommendations_list": ["Routine annual screening"],
            "ai_insight_explanation": "Multimodal analysis consistent with low risk."
        },
        "addendums": []
    },
)
db.add(report3)

appt0 = Appointment(
    patient_id=p1_profile.id, doctor_id=dr1_profile.id, scan_id=scan1_mid.id,
    appointment_type="Follow-up", scheduled_date=today - _dt.timedelta(days=44),
    status=AppointmentStatus.completed,
)
appt1 = Appointment(
    patient_id=p1_profile.id, doctor_id=dr1_profile.id, scan_id=scan1.id,
    appointment_type="Follow-up", scheduled_date=today + _dt.timedelta(days=2),
    status=AppointmentStatus.scheduled,
)
appt2 = Appointment(
    patient_id=p3_profile.id, doctor_id=dr1_profile.id,
    appointment_type="Consultation", scheduled_date=today + _dt.timedelta(days=10),
    status=AppointmentStatus.scheduled,
)
db.add_all([appt0, appt1, appt2])

db.commit()

log_action(db, user_id=dr1_user.id, user_type="doctor", action="patient_registered", resource_type="patient_profile", resource_id=p1_profile.id)
log_action(db, user_id=dr1_user.id, user_type="doctor", action="login_success", resource_type="auth")

db.close()

print("Seeded testadmin1@auramed.com / Admin@123")
print("Seeded testdr1@auramed.com, testdr2@auramed.com, testdr3@auramed.com / Doctor@123")
print("Seeded testpatient1@auramed.com, testpatient2@auramed.com, testpatient3@auramed.com / Patient@123")
print("Seeded admin@auramed.com, dr.mehta@auramed.com, anita@auramed.com / 123")
print("Seeded sample scans, appointments, and a signed report for dashboard testing")

import uvicorn
import app.main as main_module

if __name__ == "__main__":
    uvicorn.run(main_module.app, host="127.0.0.1", port=8000, log_level="info")
