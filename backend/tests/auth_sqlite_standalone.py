"""
Standalone functional test for the auth router against an in-memory SQLite DB.
Not part of the app's permanent test suite -- used here to verify Prompt 3
end-to-end without a live PostgreSQL server.
"""
import os
import sys
import uuid

os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("SECRET_KEY", "test-secret")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, TypeDecorator, CHAR
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import sqlalchemy.dialects.postgresql as pg_types


class SqliteUUID(TypeDecorator):
    impl = CHAR(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return uuid.UUID(value)


pg_types.UUID = lambda as_uuid=True: SqliteUUID()

import app.core.database as database_module

engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
database_module.engine = engine
database_module.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

import app.models  # noqa
from app.core.database import Base, get_db
import app.main as main_module
from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User
from app.models.doctor_profile import DoctorProfile
from app.models.patient_profile import PatientProfile

Base.metadata.create_all(bind=engine)

from fastapi.testclient import TestClient

TestSession = database_module.SessionLocal


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


main_module.app.dependency_overrides[get_db] = override_get_db
client = TestClient(main_module.app)

db = TestSession()

admin = User(
    email="admin@auramed.com",
    password_hash=hash_password("Admin@123"),
    role=UserRole.admin,
    is_active=True,
    is_verified=True,
)
db.add(admin)
db.flush()
admin_id = admin.id

doc_user = User(
    email="dr.mehta@auramed.com",
    password_hash=hash_password("Doctor@123"),
    role=UserRole.doctor,
    is_active=True,
    is_verified=True,
)
db.add(doc_user)
db.flush()
doc_profile = DoctorProfile(
    user_id=doc_user.id,
    full_name="Dr. Mehta",
    registration_number="TNMC123456",
    specialty="Oncology",
    hospital="AuraMed",
    phone="123",
    is_approved=True,
)
db.add(doc_profile)

unapproved_user = User(
    email="dr.new@auramed.com",
    password_hash=hash_password("Doctor@123"),
    role=UserRole.doctor,
    is_active=True,
    is_verified=True,
)
db.add(unapproved_user)
db.flush()
unapproved_profile = DoctorProfile(
    user_id=unapproved_user.id,
    full_name="Dr. New",
    registration_number="TNMC999999",
    specialty=None,
    hospital=None,
    phone=None,
    is_approved=False,
)
db.add(unapproved_profile)

pat_user = User(
    email="anita@auramed.com",
    password_hash=hash_password("Patient@123"),
    role=UserRole.patient,
    is_active=True,
    is_verified=True,
)
db.add(pat_user)
db.flush()
pat_profile = PatientProfile(user_id=pat_user.id, patient_code="P-2026-0001", full_name="Anita Sharma")
db.add(pat_profile)
db.commit()
db.close()

results = []


def check(name, cond):
    results.append((name, cond))
    print(("PASS" if cond else "FAIL"), "-", name)


r = client.post("/api/auth/admin/login", json={"email": "admin@auramed.com", "password": "Admin@123"})
check("admin login 200", r.status_code == 200)
check("admin login role claim", r.json().get("role") == "admin")
admin_token = r.json().get("access_token")

r = client.post("/api/auth/admin/login", json={"email": "admin@auramed.com", "password": "wrong"})
check("admin login wrong password -> 401", r.status_code == 401)

r = client.post(
    "/api/auth/doctor/login",
    json={"identifier": "dr.mehta@auramed.com", "password": "Doctor@123", "registration_number": "TNMC123456"},
)
check("doctor login 200", r.status_code == 200)
body = r.json()
check("doctor login role claim", body.get("role") == "doctor")
doctor_token = body.get("access_token")

r = client.post(
    "/api/auth/doctor/login",
    json={"identifier": "dr.mehta@auramed.com", "password": "Doctor@123", "registration_number": "WRONGNUM"},
)
check("doctor login bad reg number -> 401", r.status_code == 401)

r = client.post(
    "/api/auth/doctor/login",
    json={"identifier": "dr.new@auramed.com", "password": "Doctor@123", "registration_number": "TNMC999999"},
)
check("unapproved doctor login -> 403", r.status_code == 403)

r = client.post("/api/auth/patient/login", json={"identifier": "P-2026-0001", "password": "Patient@123"})
check("patient login by code 200", r.status_code == 200)
patient_token = r.json().get("access_token")

r = client.post("/api/auth/patient/login", json={"identifier": "anita@auramed.com", "password": "Patient@123"})
check("patient login by email 200", r.status_code == 200)

r = client.get("/api/auth/me")
check("me no token -> 401", r.status_code == 401)

r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {doctor_token}"})
check("me doctor 200", r.status_code == 200)
check("me doctor role", r.json().get("role") == "doctor")
check("me doctor profile present", r.json().get("profile", {}).get("registration_number") == "TNMC123456")

r = client.post(
    "/api/auth/doctor/register",
    json={
        "email": "dr.new2@auramed.com",
        "password": "Doctor@123",
        "full_name": "Dr New2",
        "registration_number": "TNMC555555",
    },
)
check("doctor register 201", r.status_code == 201)
check("doctor register not approved", r.json().get("is_approved") is False)

r = client.post("/api/auth/patient/register", json={"full_name": "New Patient"})
check("patient register no auth -> 401", r.status_code == 401)

r = client.post(
    "/api/auth/patient/register",
    json={"full_name": "New Patient"},
    headers={"Authorization": f"Bearer {doctor_token}"},
)
check("patient register as doctor 201", r.status_code == 201)
check("patient register code format", r.json().get("patient_code", "").startswith("P-2026-"))

r = client.post(
    "/api/auth/patient/register",
    json={"full_name": "X"},
    headers={"Authorization": f"Bearer {patient_token}"},
)
check("patient register as patient -> 403", r.status_code == 403)

r = client.post("/api/auth/admin/login", json={"email": "admin@auramed.com", "password": "Admin@123"})
refresh_token = r.json()["refresh_token"]
r = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
check("refresh 200", r.status_code == 200)
check("refresh new access token differs", r.json()["access_token"] != admin_token)

r = client.post("/api/auth/refresh", json={"refresh_token": admin_token})
check("refresh with access token -> 401", r.status_code == 401)

r = client.post("/api/auth/forgot-password", json={"email": "nobody@auramed.com"})
check("forgot-password unknown email 200", r.status_code == 200)

from app.core.security import create_password_reset_token

reset_token = create_password_reset_token({"sub": str(admin_id)})
r = client.post("/api/auth/reset-password", json={"token": reset_token, "new_password": "NewAdmin@123"})
check("reset-password 200", r.status_code == 200)
r = client.post("/api/auth/admin/login", json={"email": "admin@auramed.com", "password": "NewAdmin@123"})
check("login with new password works", r.status_code == 200)
r = client.post("/api/auth/admin/login", json={"email": "admin@auramed.com", "password": "Admin@123"})
check("login with old password fails", r.status_code == 401)

r = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {doctor_token}"})
check("logout 200", r.status_code == 200)

db = TestSession()
from app.models.audit_log import AuditLog

count = db.query(AuditLog).count()
actions = set(a.action for a in db.query(AuditLog).all())
check("audit log has entries", count > 0)
check("audit log has login_success", "login_success" in actions)
check("audit log has login_failed", "login_failed" in actions)
check("audit log has unauthorized_access_attempt", "unauthorized_access_attempt" in actions)
check("audit log has forbidden_access_attempt", "forbidden_access_attempt" in actions)
db.close()

failed = [n for n, ok in results if not ok]
print()
print(f"{len(results) - len(failed)}/{len(results)} checks passed")
if failed:
    print("FAILED:", failed)
    sys.exit(1)
print("ALL CHECKS PASSED")
