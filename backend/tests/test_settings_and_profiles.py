import json
import unittest
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.constants import (
    ALL_SESSIONS_REVOKED,
    DATA_EXPORTED,
    FEATURE_FLAG_UPDATED,
    LOGIN_FAILED,
    LOGIN_SUCCESS,
    PASSWORD_CHANGED,
    PATIENT_PROFILE_UPDATED,
    PROFILE_UPDATED,
    SESSION_REVOKED,
    SYSTEM_SETTINGS_UPDATED,
)
from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password, verify_password
from app.main import app
from app.models.appointment import Appointment
from app.models.audit_log import AuditLog
from app.models.doctor_profile import DoctorProfile
from app.models.enums import AppointmentStatus, RiskLevel, ScreeningModule, UserRole
from app.models.patient_profile import PatientProfile
from app.models.referral import Referral
from app.models.report import Report
from app.models.scan import Scan
from app.models.session import DoctorSession
from app.models.system_settings import SystemSettings
from app.models.user import User


class TestSettingsAndProfiles(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Admin user
        cls.admin_user = cls.db.query(User).filter(User.email == "admin_settings@test.com").first()
        if not cls.admin_user:
            cls.admin_user = User(
                email="admin_settings@test.com",
                password_hash=hash_password("AdminPass123!"),
                role=UserRole.admin,
                is_active=True,
                is_verified=True,
            )
            cls.db.add(cls.admin_user)
            cls.db.flush()

        # Doctor user & profile
        cls.doc_user = cls.db.query(User).filter(User.email == "doc_settings@test.com").first()
        if not cls.doc_user:
            cls.doc_user = User(
                email="doc_settings@test.com",
                password_hash=hash_password("DoctorPass123!"),
                role=UserRole.doctor,
                is_active=True,
                is_verified=True,
            )
            cls.db.add(cls.doc_user)
            cls.db.flush()

        cls.doc_profile = cls.db.query(DoctorProfile).filter(DoctorProfile.user_id == cls.doc_user.id).first()
        if not cls.doc_profile:
            cls.doc_profile = DoctorProfile(
                user_id=cls.doc_user.id,
                full_name="Dr. Priya Seth",
                registration_number=f"DOC-{uuid.uuid4().hex[:6].upper()}",
                specialty="Gynecologic Oncology",
                hospital="AuraMed Chennai Center",
                phone="+91-98765-11111",
                address="75 Anna Salai, Chennai, TN",
                is_approved=True,
                approved_at=datetime.now(timezone.utc),
            )
            cls.db.add(cls.doc_profile)
            cls.db.flush()

        # Patient user & profile
        cls.pat_user = cls.db.query(User).filter(User.email == "pat_settings@test.com").first()
        if not cls.pat_user:
            cls.pat_user = User(
                email="pat_settings@test.com",
                password_hash=hash_password("PatientPass123!"),
                role=UserRole.patient,
                is_active=True,
                is_verified=True,
            )
            cls.db.add(cls.pat_user)
            cls.db.flush()

        cls.pat_profile = cls.db.query(PatientProfile).filter(PatientProfile.user_id == cls.pat_user.id).first()
        if not cls.pat_profile:
            cls.pat_profile = PatientProfile(
                user_id=cls.pat_user.id,
                patient_code=f"P-SET-{uuid.uuid4().hex[:4].upper()}",
                full_name="Kavita Nair",
                date_of_birth=date(1992, 5, 10),
                gender="Female",
                phone="+91-98765-22222",
                address="12 MG Road, Bengaluru",
                created_by_doctor_id=cls.doc_profile.id,
            )
            cls.db.add(cls.pat_profile)
            cls.db.flush()

        # Reset test passwords to ensure tests are idempotent
        cls.doc_user.password_hash = hash_password("DoctorPass123!")
        cls.pat_user.password_hash = hash_password("PatientPass123!")
        cls.db.commit()

        # Generate tokens with unique jti
        cls.admin_token = create_access_token({"sub": str(cls.admin_user.id), "role": "admin", "type": "access", "jti": str(uuid.uuid4())})
        cls.doc_jti = str(uuid.uuid4())
        cls.doc_token = create_access_token({"sub": str(cls.doc_user.id), "role": "doctor", "type": "access", "jti": cls.doc_jti})
        cls.pat_jti = str(uuid.uuid4())
        cls.pat_token = create_access_token({"sub": str(cls.pat_user.id), "role": "patient", "type": "access", "jti": cls.pat_jti})

        # Register doctor session in db
        cls.doc_session = DoctorSession(
            doctor_id=cls.doc_profile.id,
            user_id=cls.doc_user.id,
            token_jti=cls.doc_jti,
            device="Desktop",
            browser="Chrome",
            ip="127.0.0.1",
            location="Chennai, India",
            last_active=datetime.now(timezone.utc),
            is_revoked=False,
            is_expired=False,
        )
        cls.db.add(cls.doc_session)
        cls.db.commit()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_get_doctor_settings(self):
        """GET /api/doctor/settings returns profile, notifications, clinical, and security."""
        headers = {"Authorization": f"Bearer {self.doc_token}"}
        res = self.client.get("/api/doctor/settings", headers=headers)
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertIn("profile", data)
        self.assertIn("notifications", data)
        self.assertIn("clinical", data)
        self.assertIn("security", data)

        profile = data["profile"]
        self.assertEqual(profile["full_name"], "Dr. Priya Seth")
        self.assertIn("specialty", profile)
        self.assertIn("hospital", profile)
        self.assertIn("phone", profile)
        self.assertIn("email", profile)
        self.assertIn("address", profile)

        security = data["security"]
        self.assertIn("two_factor_enabled", security)
        self.assertIn("active_sessions", security)
        self.assertGreaterEqual(security["active_sessions"], 1)

    def test_02_patch_doctor_profile_validation_and_update(self):
        """PATCH /api/doctor/settings/profile validates phone and updates profile & user."""
        headers = {"Authorization": f"Bearer {self.doc_token}"}

        # Invalid phone format
        bad_payload = {
            "full_name": "Dr. Priya Seth Updated",
            "phone": "12345",  # Invalid phone
        }
        bad_res = self.client.patch("/api/doctor/settings/profile", json=bad_payload, headers=headers)
        self.assertEqual(bad_res.status_code, 422)

        # Valid payload
        updated_doc_email = f"doc_updated_{uuid.uuid4().hex[:6]}@test.com"
        valid_payload = {
            "full_name": "Dr. Priya Seth Senior",
            "specialty": "Senior Gynecologic Oncologist",
            "hospital": "AuraMed Main Hospital",
            "phone": "+91-98765-33333",
            "email": updated_doc_email,
            "address": "100 TTK Road, Alwarpet, Chennai",
        }
        res = self.client.patch("/api/doctor/settings/profile", json=valid_payload, headers=headers)
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertEqual(data["full_name"], "Dr. Priya Seth Senior")
        self.assertEqual(data["phone"], "+91-98765-33333")
        self.assertEqual(data["email"], updated_doc_email)

        # Verify audit log: PROFILE_UPDATED
        audit = (
            self.db.query(AuditLog)
            .filter(AuditLog.user_id == self.doc_user.id, AuditLog.action == PROFILE_UPDATED)
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        self.assertIsNotNone(audit)

    def test_03_patch_doctor_notifications(self):
        """PATCH /api/doctor/settings/notifications saves notification preferences."""
        headers = {"Authorization": f"Bearer {self.doc_token}"}
        notif_prefs = {
            "email_alerts": True,
            "sms_urgent_cases": True,
            "weekly_digest": False,
            "daily_appointment_summary": True,
        }
        res = self.client.patch("/api/doctor/settings/notifications", json=notif_prefs, headers=headers)
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertEqual(data["email_alerts"], True)
        self.assertEqual(data["weekly_digest"], False)

    def test_04_patch_doctor_clinical(self):
        """PATCH /api/doctor/settings/clinical saves clinical preferences."""
        headers = {"Authorization": f"Bearer {self.doc_token}"}
        clinical_prefs = {
            "default_followup_interval_days": 14,
            "auto_include_ai_reasoning": True,
            "high_risk_immediate_alert": True,
            "report_theme": "detailed_clinical",
        }
        res = self.client.patch("/api/doctor/settings/clinical", json=clinical_prefs, headers=headers)
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertEqual(data["default_followup_interval_days"], 14)
        self.assertEqual(data["auto_include_ai_reasoning"], True)

    def test_05_doctor_change_password_validation(self):
        """POST /api/doctor/change-password validates current password, match, and complexity policy."""
        headers = {"Authorization": f"Bearer {self.doc_token}"}

        # 1. Wrong current password
        wrong_curr = {
            "current_password": "WrongPassword123!",
            "new_password": "NewStrongPass123!",
            "confirm_new_password": "NewStrongPass123!",
        }
        res = self.client.post("/api/doctor/change-password", json=wrong_curr, headers=headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("incorrect", res.text.lower())

        # 2. Mismatched new passwords
        mismatch = {
            "current_password": "DoctorPass123!",
            "new_password": "NewStrongPass123!",
            "confirm_new_password": "DifferentPass123!",
        }
        res = self.client.post("/api/doctor/change-password", json=mismatch, headers=headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("do not match", res.text)

        # 3. Policy violation (too simple: no number or special char)
        weak_pass = {
            "current_password": "DoctorPass123!",
            "new_password": "passwordonly",
            "confirm_new_password": "passwordonly",
        }
        res = self.client.post("/api/doctor/change-password", json=weak_pass, headers=headers)
        self.assertEqual(res.status_code, 400)

        # 4. Valid password change
        valid_change = {
            "current_password": "DoctorPass123!",
            "new_password": "DoctorNewPass789!",
            "confirm_new_password": "DoctorNewPass789!",
        }
        res = self.client.post("/api/doctor/change-password", json=valid_change, headers=headers)
        self.assertEqual(res.status_code, 200, res.text)

        # Verify DB hash updated
        self.db.refresh(self.doc_user)
        self.assertTrue(verify_password("DoctorNewPass789!", self.doc_user.password_hash))

        # Verify audit log: PASSWORD_CHANGED
        audit = (
            self.db.query(AuditLog)
            .filter(AuditLog.user_id == self.doc_user.id, AuditLog.action == PASSWORD_CHANGED)
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        self.assertIsNotNone(audit)

    def test_06_doctor_sessions_and_revocation(self):
        """GET, DELETE /api/doctor/sessions/:id and DELETE all-others."""
        # Create a second doctor session to test revocation
        other_jti = str(uuid.uuid4())
        other_session = DoctorSession(
            doctor_id=self.doc_profile.id,
            user_id=self.doc_user.id,
            token_jti=other_jti,
            device="Mobile iPhone",
            browser="Mobile Safari",
            ip="192.168.1.10",
            location="Bengaluru, India",
            last_active=datetime.now(timezone.utc),
            is_revoked=False,
            is_expired=False,
        )
        self.db.add(other_session)
        self.db.commit()

        # Re-authenticate doctor with new password
        login_res = self.client.post(
            "/api/auth/doctor/login",
            json={
                "identifier": self.doc_user.email,
                "registration_number": self.doc_profile.registration_number,
                "password": "DoctorNewPass789!",
            },
        )
        self.assertEqual(login_res.status_code, 200, login_res.text)
        new_token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {new_token}"}

        # 1. GET /api/doctor/sessions
        get_sess = self.client.get("/api/doctor/sessions", headers=headers)
        self.assertEqual(get_sess.status_code, 200)
        sessions = get_sess.json()
        self.assertIsInstance(sessions, list)
        self.assertGreaterEqual(len(sessions), 1)
        first_sess = sessions[0]
        self.assertIn("device", first_sess)
        self.assertIn("browser", first_sess)
        self.assertIn("ip", first_sess)
        self.assertIn("is_current", first_sess)

        # 2. DELETE /api/doctor/sessions/:sessionId
        del_one = self.client.delete(f"/api/doctor/sessions/{other_session.id}", headers=headers)
        self.assertEqual(del_one.status_code, 200)

        # Verify revoked in DB
        self.db.refresh(other_session)
        self.assertTrue(other_session.is_revoked)

        # Verify audit log: SESSION_REVOKED
        audit_rev = (
            self.db.query(AuditLog)
            .filter(AuditLog.user_id == self.doc_user.id, AuditLog.action == SESSION_REVOKED)
            .first()
        )
        self.assertIsNotNone(audit_rev)

        # 3. DELETE /api/doctor/sessions/all-others
        del_others = self.client.delete("/api/doctor/sessions/all-others", headers=headers)
        self.assertEqual(del_others.status_code, 200)

        audit_all = (
            self.db.query(AuditLog)
            .filter(AuditLog.user_id == self.doc_user.id, AuditLog.action == ALL_SESSIONS_REVOKED)
            .first()
        )
        self.assertIsNotNone(audit_all)

    def test_07_doctor_login_history(self):
        """GET /api/doctor/login-history returns last 20 login success/failure entries."""
        # Log an event
        audit_log = AuditLog(
            user_id=self.doc_user.id,
            user_type="doctor",
            action=LOGIN_SUCCESS,
            resource_type="auth",
            resource_id=str(self.doc_user.id),
            details={"ip": "127.0.0.1", "device": "Desktop"},
        )
        self.db.add(audit_log)
        self.db.commit()

        # Log in to get token
        login_res = self.client.post(
            "/api/auth/doctor/login",
            json={
                "identifier": self.doc_user.email,
                "registration_number": self.doc_profile.registration_number,
                "password": "DoctorNewPass789!",
            },
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = self.client.get("/api/doctor/login-history", headers=headers)
        self.assertEqual(res.status_code, 200)
        history = res.json()
        self.assertIsInstance(history, list)
        self.assertGreaterEqual(len(history), 1)
        self.assertIn(history[0]["action"], [LOGIN_SUCCESS, LOGIN_FAILED])

    def test_08_doctor_export_data(self):
        """POST /api/doctor/export-data generates a JSON export file download."""
        login_res = self.client.post(
            "/api/auth/doctor/login",
            json={
                "identifier": self.doc_user.email,
                "registration_number": self.doc_profile.registration_number,
                "password": "DoctorNewPass789!",
            },
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = self.client.post("/api/doctor/export-data", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertIn("attachment", res.headers.get("Content-Disposition", ""))
        self.assertIn("application/json", res.headers.get("Content-Type", ""))

        export_data = res.json()
        self.assertIn("profile", export_data)
        self.assertIn("patients", export_data)
        self.assertIn("scans", export_data)
        self.assertIn("reports", export_data)
        self.assertIn("activity_log", export_data)

        # Verify audit log: DATA_EXPORTED
        audit = (
            self.db.query(AuditLog)
            .filter(AuditLog.user_id == self.doc_user.id, AuditLog.action == DATA_EXPORTED)
            .first()
        )
        self.assertIsNotNone(audit)

    def test_09_admin_settings_crud(self):
        """GET and PATCH /api/admin/settings updates settings and logs audit."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}

        # 1. GET /api/admin/settings
        res = self.client.get("/api/admin/settings", headers=headers)
        self.assertEqual(res.status_code, 200)
        settings = res.json()
        self.assertIn("general", settings)
        self.assertIn("security", settings)

        # 2. PATCH /api/admin/settings with {section, settings}
        patch_body = {
            "section": "general",
            "settings": {
                "hospital_name": "AuraMed Health Systems v2",
                "support_email": "support@auramed.org",
            },
        }
        patch_res = self.client.patch("/api/admin/settings", json=patch_body, headers=headers)
        self.assertEqual(patch_res.status_code, 200, patch_res.text)

        # Verify audit log: SYSTEM_SETTINGS_UPDATED
        audit = (
            self.db.query(AuditLog)
            .filter(AuditLog.user_id == self.admin_user.id, AuditLog.action == SYSTEM_SETTINGS_UPDATED)
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        self.assertIsNotNone(audit)
        self.assertTrue("new_value" in audit.details or "new_values" in audit.details)

    def test_10_admin_feature_flags(self):
        """GET and PATCH /api/admin/settings/feature-flags."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}

        # 1. GET /api/admin/settings/feature-flags
        res = self.client.get("/api/admin/settings/feature-flags", headers=headers)
        self.assertEqual(res.status_code, 200)
        flags = res.json()
        self.assertIsInstance(flags, dict)
        self.assertIn("patient_self_registration", flags)

        # 2. PATCH /api/admin/settings/feature-flags
        patch_body = {"flag_name": "enable_beta_ai_reasoning", "enabled": True}
        patch_res = self.client.patch("/api/admin/settings/feature-flags", json=patch_body, headers=headers)
        self.assertEqual(patch_res.status_code, 200, patch_res.text)
        updated_flags = patch_res.json()
        self.assertTrue(updated_flags.get("flags", {}).get("enable_beta_ai_reasoning") or updated_flags.get("enabled"))

        # Verify audit log: FEATURE_FLAG_UPDATED
        audit = (
            self.db.query(AuditLog)
            .filter(AuditLog.user_id == self.admin_user.id, AuditLog.action == FEATURE_FLAG_UPDATED)
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        self.assertIsNotNone(audit)

    def test_11_admin_database_backup(self):
        """POST /api/admin/backup triggers a backup file dump."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        res = self.client.post("/api/admin/backup", headers=headers)
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertIn("backup_file", data)
        self.assertIn("created_at", data)
        self.assertTrue(data["backup_file"].startswith("auramed_backup_"))

    def test_12_patient_profile_update_validation(self):
        """PATCH /api/patient/profile validates phone format and updates profile."""
        headers = {"Authorization": f"Bearer {self.pat_token}"}

        # Invalid phone format
        bad_res = self.client.patch("/api/patient/profile", json={"phone": "invalid_phone"}, headers=headers)
        self.assertEqual(bad_res.status_code, 422)

        # Valid update
        updated_pat_email = f"pat_updated_{uuid.uuid4().hex[:6]}@test.com"
        valid_res = self.client.patch(
            "/api/patient/profile",
            json={
                "phone": "+91-98765-99999",
                "email": updated_pat_email,
                "address": "45 Palm Boulevard, Indiranagar, Bengaluru",
            },
            headers=headers,
        )
        self.assertEqual(valid_res.status_code, 200, valid_res.text)
        data = valid_res.json()
        self.assertEqual(data["phone"], "+91-98765-99999")
        self.assertEqual(data["email"], updated_pat_email)
        self.assertEqual(data["address"], "45 Palm Boulevard, Indiranagar, Bengaluru")

        # Verify audit log: PATIENT_PROFILE_UPDATED
        audit = (
            self.db.query(AuditLog)
            .filter(AuditLog.user_id == self.pat_user.id, AuditLog.action == PATIENT_PROFILE_UPDATED)
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        self.assertIsNotNone(audit)

    def test_13_patient_change_password(self):
        """POST /api/patient/change-password validates complexity and updates password."""
        headers = {"Authorization": f"Bearer {self.pat_token}"}

        # Weak password attempt
        weak_res = self.client.post(
            "/api/patient/change-password",
            json={
                "current_password": "PatientPass123!",
                "new_password": "simplepassword",
                "confirm_new_password": "simplepassword",
            },
            headers=headers,
        )
        self.assertEqual(weak_res.status_code, 400)

        # Valid change
        valid_res = self.client.post(
            "/api/patient/change-password",
            json={
                "current_password": "PatientPass123!",
                "new_password": "PatientStrongPass789!",
                "confirm_new_password": "PatientStrongPass789!",
            },
            headers=headers,
        )
        self.assertEqual(valid_res.status_code, 200, valid_res.text)

        # Verify audit log: PASSWORD_CHANGED
        audit = (
            self.db.query(AuditLog)
            .filter(AuditLog.user_id == self.pat_user.id, AuditLog.action == PASSWORD_CHANGED)
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        self.assertIsNotNone(audit)

    def test_14_patient_export_data(self):
        """POST /api/patient/export-data generates patient's personal JSON export."""
        headers = {"Authorization": f"Bearer {self.pat_token}"}
        res = self.client.post("/api/patient/export-data", headers=headers)
        self.assertEqual(res.status_code, 200, res.text)
        self.assertIn("attachment", res.headers.get("Content-Disposition", ""))

        data = res.json()
        self.assertIn("personal_information", data)
        self.assertIn("reports", data)
        self.assertIn("appointments", data)

        # Verify audit log: DATA_EXPORTED
        audit = (
            self.db.query(AuditLog)
            .filter(AuditLog.user_id == self.pat_user.id, AuditLog.action == DATA_EXPORTED)
            .first()
        )
        self.assertIsNotNone(audit)

    def test_15_seed_data_validation(self):
        """Verify seeded dataset for dr.mehta meets all clinical criteria."""
        # 1. 10 Patients (P-2026-0001 through P-2026-0010)
        expected_codes = [f"P-2026-000{i}" for i in range(1, 10)] + ["P-2026-0010"]
        patients = (
            self.db.query(PatientProfile)
            .filter(PatientProfile.patient_code.in_(expected_codes))
            .all()
        )
        self.assertEqual(len(patients), 10)

        # 2. Check risk levels variation (high, moderate, low)
        risk_levels = set()
        urgent_count = 0
        p1_modules = set()

        for p in patients:
            if p.is_urgent:
                urgent_count += 1
            for m in (p.preferred_modules or []):
                s = (
                    self.db.query(Scan)
                    .filter(Scan.patient_id == p.id, Scan.module == ScreeningModule(m))
                    .first()
                )
                self.assertIsNotNone(s, f"Missing scan for patient {p.patient_code} module {m}")
                if s.risk_level:
                    risk_levels.add(s.risk_level)
                rep = self.db.query(Report).filter(Report.scan_id == s.id).first()
                self.assertIsNotNone(rep, f"Scan {s.id} lacks report")
            if p.patient_code == "P-2026-0001":
                p1_modules = set(p.preferred_modules or [])

        self.assertIn(RiskLevel.high, risk_levels)
        self.assertIn(RiskLevel.moderate, risk_levels)
        self.assertIn(RiskLevel.low, risk_levels)
        self.assertGreaterEqual(urgent_count, 1)

        # 3. Patient P-2026-0001 has all three modules
        self.assertEqual(p1_modules, {"breast", "cervical", "pcos"})

        # 4. Check upcoming follow-ups within 7 days
        today = date.today()
        upcoming_7 = (
            self.db.query(Appointment)
            .filter(
                Appointment.scheduled_date >= today,
                Appointment.scheduled_date <= today + timedelta(days=7),
            )
            .all()
        )
        self.assertGreaterEqual(len(upcoming_7), 2)

        # 5. Check 2-3 Referrals exist
        refs = self.db.query(Referral).all()
        self.assertGreaterEqual(len(refs), 3)


if __name__ == "__main__":
    unittest.main()
