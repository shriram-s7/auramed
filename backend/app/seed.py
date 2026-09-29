"""Seed the database with one admin, one doctor, and one patient for testing.

Usage:
    python -m app.seed
"""
from datetime import date

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.doctor_profile import DoctorProfile
from app.models.enums import UserRole
from app.models.patient_profile import PatientProfile
from app.models.user import User


def seed() -> None:
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin@auramed.com").first()
        if not admin:
            admin = User(
                email="admin@auramed.com",
                password_hash=hash_password("Admin@123"),
                role=UserRole.admin,
                is_active=True,
                is_verified=True,
            )
            db.add(admin)
            print("Created admin user: admin@auramed.com")
        else:
            print("Admin user already exists, skipping")

        doctor_user = db.query(User).filter(User.email == "dr.mehta@auramed.com").first()
        if not doctor_user:
            doctor_user = User(
                email="dr.mehta@auramed.com",
                password_hash=hash_password("Doctor@123"),
                role=UserRole.doctor,
                is_active=True,
                is_verified=True,
            )
            db.add(doctor_user)
            db.flush()

            doctor_profile = DoctorProfile(
                user_id=doctor_user.id,
                full_name="Dr. Mehta",
                registration_number="TNMC123456",
                specialty="Gynecologic Oncology",
                hospital="AuraMed General Hospital",
                phone="+91-9000000001",
                is_approved=True,
                approved_by=None,
                approved_at=None,
            )
            db.add(doctor_profile)
            print("Created doctor user: dr.mehta@auramed.com")
        else:
            print("Doctor user already exists, skipping")

        patient_user = db.query(User).filter(User.email == "anita@auramed.com").first()
        if not patient_user:
            patient_user = User(
                email="anita@auramed.com",
                password_hash=hash_password("Patient@123"),
                role=UserRole.patient,
                is_active=True,
                is_verified=True,
            )
            db.add(patient_user)
            db.flush()

            patient_profile = PatientProfile(
                user_id=patient_user.id,
                patient_code="P-2026-0001",
                full_name="Anita Sharma",
                date_of_birth=date(1990, 4, 12),
                gender="female",
                phone="+91-9000000002",
                address="12 MG Road, Chennai",
                pin_code="600001",
                blood_group="O+",
                emergency_contact_name="Ravi Sharma",
                emergency_contact_phone="+91-9000000003",
                emergency_contact_relation="Spouse",
                family_history={},
                personal_medical_history={},
                allergies=None,
                current_medications=None,
            )
            db.add(patient_profile)
            print("Created patient user: anita@auramed.com")
        else:
            print("Patient user already exists, skipping")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
