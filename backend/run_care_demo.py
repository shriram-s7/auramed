"""Persistent, isolated synthetic presentation dataset. No external messages are sent."""
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta, time, timezone

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
os.environ['DATABASE_URL'] = 'sqlite:///' + str(ROOT / 'auramed_care_demo.db').replace('\\', '/')
os.environ.setdefault('SECRET_KEY', 'local-care-demonstration-only-do-not-deploy')
os.environ['MESSAGING_MODE'] = 'preview'

from app.core.database import Base, engine, SessionLocal, ensure_care_columns
from app.core.security import hash_password
from app.models import User, DoctorProfile, PatientProfile, Appointment, Referral, Scan
from app.models.enums import UserRole, AppointmentStatus, ReferralPriority, ScreeningModule, ScanStatus, RiskLevel
from app.services.care_messaging import clinic_today, queue_appointment_messages
from app.services.care_workflow import transition_referral


def seed():
    Base.metadata.create_all(engine)
    ensure_care_columns()
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == 'care.demo@auramed.example').first():
            return
        user = User(email='care.demo@auramed.example', password_hash=hash_password('CareDemo@2026'),
                    role=UserRole.doctor, is_active=True, is_verified=True)
        db.add(user); db.flush()
        doctor = DoctorProfile(user_id=user.id, full_name='Dr. Maya (Demo)', registration_number='DEMO-CARE-001',
            specialty='Care coordination', hospital='Demonstration clinic · synthetic records', is_approved=True)
        db.add(doctor); db.flush()
        today = clinic_today()
        for i, name in enumerate(['Anita Rao', 'Meena Das', 'Priya Shah', 'Lakshmi Kumar', 'Sara Thomas', 'Nisha Patel']):
            pu = User(email=f'care.patient{i+1}@example.invalid', password_hash=hash_password('PatientDemo@2026'),
                role=UserRole.patient, is_active=True, is_verified=True)
            db.add(pu); db.flush()
            patient = PatientProfile(user_id=pu.id, patient_code=f'DEMO-CARE-{i+1:03}', full_name=f'{name} (demo)',
                created_by_doctor_id=doctor.id, consent={'email_notifications': True, 'sms_notifications': True,
                'whatsapp_notifications': True, 'synthetic_demo': True}, phone=None)
            db.add(patient); db.flush()
            scan = Scan(patient_id=patient.id, doctor_id=doctor.id, module=[ScreeningModule.breast, ScreeningModule.cervical, ScreeningModule.pcos][i%3],
                scan_date=today-timedelta(days=i+1), status=ScanStatus.analyzed if i<3 else ScanStatus.reported,
                image_quality='poor' if i==1 else 'adequate', image_model_score=.75 if i==0 else .3,
                formula_score=.25, fusion_score=.5, risk_level=RiskLevel.moderate,
                reasoning={'synthetic_demo':True,'disagreement_detected':i==0}, clinical_inputs={'synthetic_demo':True})
            db.add(scan); db.flush()
            appt = Appointment(patient_id=patient.id, doctor_id=doctor.id, scan_id=scan.id,
                scheduled_date=today+timedelta(days=[1,-2,3,0,-3,5][i]), scheduled_time=time(10+i,30),
                appointment_type='Follow-up consultation', location='Demonstration clinic, Room 2',
                status=AppointmentStatus.completed if i==4 else AppointmentStatus.scheduled)
            db.add(appt); db.flush()
            if i<5:
                ref = Referral(patient_id=patient.id, from_doctor_id=doctor.id, to_specialist='Demo partner clinic',
                    specialty='Women’s health', reason='Synthetic demonstration referral', priority=ReferralPriority.routine,
                    status='referred', attachments={'synthetic_demo':True,'care_due_date':str(today+timedelta(days=3))})
                db.add(ref); db.flush()
                for stage in ['contacted','scheduled','seen','outcome_recorded'][:i]:
                    transition_referral(ref, stage, f'Synthetic demo: {stage.replace("_", " ")} confirmed by coordinator.', doctor.id)
            db.commit()
            if i in (0,2,3): queue_appointment_messages(db, appt, 'scheduled')
    finally:
        db.close()


if __name__ == '__main__':
    seed()
    import uvicorn
    print('AuraMed care demo: care.demo@auramed.example / CareDemo@2026')
    print('Synthetic data persists between runs. All external messaging stays in preview mode.')
    uvicorn.run('app.main:app', host='127.0.0.1', port=int(os.getenv('CARE_DEMO_PORT','8000')))
