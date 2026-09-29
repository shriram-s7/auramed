"""
AuraMed PostgreSQL Database Reset and Seed Script
File: E:\\auramed\\backend\\seed_db.py

Completely wipes and reseeds the PostgreSQL database with clean,
correctly relational test data:
- 1 Admin
- 3 Doctors
- 3 Patients
- Relational assignments (Patients -> Doctors)
- 2 Appointments per patient (1 past, 1 upcoming) with foreign keys
- Verification of rows, foreign keys, and bcrypt password verification
"""

import sys
import io

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from datetime import date, datetime, time, timedelta, timezone
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password, verify_password
import app.models  # Register all SQLAlchemy models
from app.models.appointment import Appointment
from app.models.doctor_profile import DoctorProfile
from app.models.enums import AppointmentStatus, UserRole
from app.models.patient_profile import PatientProfile
from app.models.user import User


def wipe_and_reseed():
    print("=" * 65)
    print("AuraMed Database Wipe & Reseed Utility")
    print(f"Target Database URL: {settings.database_url}")
    print("=" * 65)

    # STEP 1: Drop and recreate all tables
    print("\n[STEP 1] Dropping all tables (cascade) and recreating schema...")
    with engine.connect() as conn:
        if engine.dialect.name == "postgresql":
            conn.execute(text("DROP SCHEMA public CASCADE;"))
            conn.execute(text("CREATE SCHEMA public;"))
            conn.execute(text("GRANT ALL ON SCHEMA public TO auramed;"))
            conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
            conn.commit()
            print("  [OK] PostgreSQL schema 'public' wiped and recreated successfully.")
        else:
            Base.metadata.drop_all(bind=conn)
            conn.commit()
            print("  [OK] SQLite tables dropped.")

    # Recreate all tables using SQLAlchemy models
    Base.metadata.create_all(bind=engine)
    print("  ✓ All SQLAlchemy tables created successfully.")

    db = SessionLocal()
    try:
        # STEP 2: Seed accounts with bcrypt-hashed passwords
        print("\n[STEP 2] Seeding admin, doctor, and patient accounts...")

        # 1 Admin
        admin_user = User(
            email="testadmin1@auramed.com",
            password_hash=hash_password("Admin@123"),
            role=UserRole.admin,
            is_active=True,
            is_verified=True,
        )
        db.add(admin_user)
        db.flush()
        print(f"  ✓ Admin created: {admin_user.email} (role: admin)")

        # 3 Doctors
        doctors_meta = [
            {
                "username": "testdr1",
                "email": "testdr1@auramed.com",
                "password": "Doctor@123",
                "name": "Dr. Ananya Sharma",
                "specialization": "Radiology",
                "license": "TNMC-DR-001",
            },
            {
                "username": "testdr2",
                "email": "testdr2@auramed.com",
                "password": "Doctor@123",
                "name": "Dr. Rohan Mehta",
                "specialization": "Oncology",
                "license": "TNMC-DR-002",
            },
            {
                "username": "testdr3",
                "email": "testdr3@auramed.com",
                "password": "Doctor@123",
                "name": "Dr. Priya Iyer",
                "specialization": "Gynecology",
                "license": "TNMC-DR-003",
            },
        ]

        doc_profiles = {}
        for d in doctors_meta:
            doc_user = User(
                email=d["email"],
                password_hash=hash_password(d["password"]),
                role=UserRole.doctor,
                is_active=True,
                is_verified=True,
            )
            db.add(doc_user)
            db.flush()

            profile = DoctorProfile(
                user_id=doc_user.id,
                full_name=d["name"],
                registration_number=d["license"],
                specialty=d["specialization"],
                hospital="AuraMed Clinical Center",
                phone="+91-980000000" + str(len(doc_profiles) + 1),
                is_approved=True,
                approved_at=datetime.now(timezone.utc),
            )
            db.add(profile)
            db.flush()
            doc_profiles[d["username"]] = profile
            print(f"  ✓ Doctor created: {d['email']} | {d['name']} | {d['specialization']} | {d['license']}")

        # 3 Patients
        patients_meta = [
            {
                "username": "testpatient1",
                "email": "testpatient1@auramed.com",
                "password": "Patient@123",
                "name": "Priya Nair",
                "age": 34,
                "gender": "Female",
                "patient_code": "P-2026-0001",
                "assigned_doctor": "testdr1",
            },
            {
                "username": "testpatient2",
                "email": "testpatient2@auramed.com",
                "password": "Patient@123",
                "name": "Meera Krishnan",
                "age": 45,
                "gender": "Female",
                "patient_code": "P-2026-0002",
                "assigned_doctor": "testdr1",
            },
            {
                "username": "testpatient3",
                "email": "testpatient3@auramed.com",
                "password": "Patient@123",
                "name": "Lakshmi Venkat",
                "age": 28,
                "gender": "Female",
                "patient_code": "P-2026-0003",
                "assigned_doctor": "testdr2",
            },
        ]

        patient_profiles = {}
        for p in patients_meta:
            pat_user = User(
                email=p["email"],
                password_hash=hash_password(p["password"]),
                role=UserRole.patient,
                is_active=True,
                is_verified=True,
            )
            db.add(pat_user)
            db.flush()

            assigned_doc = doc_profiles[p["assigned_doctor"]]
            dob = date(2026 - p["age"], 4, 15)

            profile = PatientProfile(
                user_id=pat_user.id,
                patient_code=p["patient_code"],
                full_name=p["name"],
                date_of_birth=dob,
                gender=p["gender"],
                phone="+91-970000000" + str(len(patient_profiles) + 1),
                address="Chennai, Tamil Nadu, India",
                pin_code="600001",
                blood_group="B+",
                created_by_doctor_id=assigned_doc.id,
                status="active",
                preferred_modules=["breast", "cervical", "pcos"],
            )
            db.add(profile)
            db.flush()
            patient_profiles[p["username"]] = profile
            print(f"  ✓ Patient created: {p['email']} | {p['name']} ({p['age']}{p['gender'][0]}) | Assigned to {assigned_doc.full_name}")

        # STEP 3: Seed relational appointments
        print("\n[STEP 3] Seeding relational appointments (2 per patient: 1 past, 1 upcoming)...")
        today = date.today()

        appointments_data = [
            # testpatient1 with testdr1
            {
                "patient_key": "testpatient1",
                "doctor_key": "testdr1",
                "scheduled_date": today - timedelta(days=10),
                "scheduled_time": time(10, 0),
                "type": "breast",
                "status": AppointmentStatus.completed,
                "notes": "Past baseline clinical breast screening completed. No palpable masses noted.",
            },
            {
                "patient_key": "testpatient1",
                "doctor_key": "testdr1",
                "scheduled_date": today + timedelta(days=5),
                "scheduled_time": time(11, 30),
                "type": "cervical",
                "status": AppointmentStatus.scheduled,
                "notes": "Upcoming routine cervical cytology follow-up consultation.",
            },
            # testpatient2 with testdr1
            {
                "patient_key": "testpatient2",
                "doctor_key": "testdr1",
                "scheduled_date": today - timedelta(days=14),
                "scheduled_time": time(9, 30),
                "type": "pcos",
                "status": AppointmentStatus.completed,
                "notes": "Past metabolic panel and endocrine profile review completed.",
            },
            {
                "patient_key": "testpatient2",
                "doctor_key": "testdr1",
                "scheduled_date": today + timedelta(days=8),
                "scheduled_time": time(14, 0),
                "type": "breast",
                "status": AppointmentStatus.scheduled,
                "notes": "Upcoming digital mammography surveillance visit.",
            },
            # testpatient3 with testdr2
            {
                "patient_key": "testpatient3",
                "doctor_key": "testdr2",
                "scheduled_date": today - timedelta(days=20),
                "scheduled_time": time(11, 0),
                "type": "cervical",
                "status": AppointmentStatus.completed,
                "notes": "Past screening review completed with normal visual inspection.",
            },
            {
                "patient_key": "testpatient3",
                "doctor_key": "testdr2",
                "scheduled_date": today + timedelta(days=4),
                "scheduled_time": time(15, 30),
                "type": "pcos",
                "status": AppointmentStatus.scheduled,
                "notes": "Upcoming pelvic ultrasound screening and follicular assessment.",
            },
        ]

        for appt_dict in appointments_data:
            pat_prof = patient_profiles[appt_dict["patient_key"]]
            doc_prof = doc_profiles[appt_dict["doctor_key"]]
            appt = Appointment(
                patient_id=pat_prof.id,
                doctor_id=doc_prof.id,
                scheduled_date=appt_dict["scheduled_date"],
                scheduled_time=appt_dict["scheduled_time"],
                appointment_type=appt_dict["type"],
                status=appt_dict["status"],
                notes=appt_dict["notes"],
                location="AuraMed Clinical Facility Room 204",
                ai_recommended=False,
            )
            db.add(appt)
            db.flush()
            print(f"  ✓ Appointment created: [{appt.status.value.upper()}] {appt.scheduled_date} {appt.scheduled_time} | Type: {appt.appointment_type} | Patient: {pat_prof.full_name} | Doctor: {doc_prof.full_name}")

        db.commit()
        print("\nDatabase committed successfully.")

        # STEP 4: Verification
        print("\n" + "=" * 65)
        print("[STEP 4] VERIFICATION SUMMARY")
        print("=" * 65)

        # 4.1 Count rows per table
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        print("\n--- Seeded Row Counts per Table ---")
        for tbl in sorted(table_names):
            count = db.execute(text(f"SELECT COUNT(*) FROM {tbl}")).scalar()
            print(f"  • {tbl.ljust(25)}: {count} rows")

        # 4.2 Confirm Foreign Keys resolution
        print("\n--- Foreign Key Resolution Check ---")
        all_appts = db.query(Appointment).all()
        for idx, appt in enumerate(all_appts, 1):
            doc = db.query(DoctorProfile).filter(DoctorProfile.id == appt.doctor_id).first()
            pat = db.query(PatientProfile).filter(PatientProfile.id == appt.patient_id).first()
            doc_user = db.query(User).filter(User.id == doc.user_id).first() if doc else None
            pat_user = db.query(User).filter(User.id == pat.user_id).first() if pat else None

            assert doc is not None, f"Foreign key failure: doctor_id {appt.doctor_id} not found"
            assert pat is not None, f"Foreign key failure: patient_id {appt.patient_id} not found"
            assert doc_user is not None, f"Doctor user relationship failure"
            assert pat_user is not None, f"Patient user relationship failure"
            print(f"  ✓ Appt #{idx}: Patient '{pat.full_name}' ({pat_user.email}) -> Doctor '{doc.full_name}' ({doc_user.email}) [FK OK]")

        # Patient created_by_doctor_id FK resolution
        for p_key, p_prof in patient_profiles.items():
            refreshed = db.query(PatientProfile).filter(PatientProfile.id == p_prof.id).first()
            assert refreshed.created_by_doctor is not None
            print(f"  ✓ Patient assignment: '{refreshed.full_name}' assigned to '{refreshed.created_by_doctor.full_name}' [FK OK]")

        # 4.3 Confirm password hashing worked by attempting test login verification
        print("\n--- Password Hashing Verification ---")
        test_dr = db.query(User).filter(User.email == "testdr1@auramed.com").first()
        test_pat = db.query(User).filter(User.email == "testpatient1@auramed.com").first()
        test_adm = db.query(User).filter(User.email == "testadmin1@auramed.com").first()

        assert test_dr is not None, "testdr1 not found"
        assert test_pat is not None, "testpatient1 not found"
        assert test_adm is not None, "testadmin1 not found"

        dr_pass_ok = verify_password("Doctor@123", test_dr.password_hash)
        pat_pass_ok = verify_password("Patient@123", test_pat.password_hash)
        adm_pass_ok = verify_password("Admin@123", test_adm.password_hash)
        bad_pass_rejected = not verify_password("WrongPassword!", test_dr.password_hash)

        print(f"  ✓ testdr1 login verification (Doctor@123): {'PASSED' if dr_pass_ok else 'FAILED'}")
        print(f"  ✓ testpatient1 login verification (Patient@123): {'PASSED' if pat_pass_ok else 'FAILED'}")
        print(f"  ✓ testadmin1 login verification (Admin@123): {'PASSED' if adm_pass_ok else 'FAILED'}")
        print(f"  ✓ Bad password rejection: {'PASSED' if bad_pass_rejected else 'FAILED'}")

        if dr_pass_ok and pat_pass_ok and adm_pass_ok and bad_pass_rejected:
            print("\n>>> ALL VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<")
        else:
            print("\n>>> VERIFICATION FAILED! <<<")
            sys.exit(1)

    finally:
        db.close()


if __name__ == "__main__":
    wipe_and_reseed()
