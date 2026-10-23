"""Isolated behavioural tests; never use the user's database or real message providers.
Run: python tests/test_care_coordination.py
"""
import os
import sys
import unittest
from pathlib import Path
from datetime import timedelta
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['SECRET_KEY'] = 'isolated-care-tests-only'
os.environ['MESSAGING_MODE'] = 'preview'

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.database import Base, get_db
from app.core.config import settings
import app.models
from app.models.user import User
from app.models.doctor_profile import DoctorProfile
from app.models.patient_profile import PatientProfile
from app.models.appointment import Appointment
from app.models.notification import Notification
from app.models.enums import UserRole
from app.api.deps import get_current_doctor_profile
from app.api.routes.care import router as care_router
from app.api.routes.appointments import router as appointment_router
from app.api.routes.referrals import router as referral_router
from app.services.care_messaging import queue_due_reminders, process_outbox, clinic_today


class CareTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine, expire_on_commit=False)()
        self.docuser = User(email='doctor@example.invalid', password_hash='unused', role=UserRole.doctor)
        self.otheruser = User(email='other@example.invalid', password_hash='unused', role=UserRole.doctor)
        self.puser = User(email='patient@test.invalid', password_hash='unused', role=UserRole.patient)
        self.db.add_all([self.docuser, self.otheruser, self.puser]); self.db.flush()
        self.doctor = DoctorProfile(user_id=self.docuser.id, full_name='Test Doctor', registration_number='TEST1', is_approved=True)
        self.other = DoctorProfile(user_id=self.otheruser.id, full_name='Other Doctor', registration_number='TEST2', is_approved=True)
        self.db.add_all([self.doctor, self.other]); self.db.flush()
        self.patient = PatientProfile(user_id=self.puser.id, patient_code='CARE-1', full_name='Test Patient',
            phone='+919999999999', created_by_doctor_id=self.doctor.id,
            consent={f'{c}_notifications': True for c in ('email', 'sms', 'whatsapp')})
        self.db.add(self.patient); self.db.commit()
        self.app = FastAPI()
        for router in (care_router, appointment_router, referral_router): self.app.include_router(router)
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.app.dependency_overrides[get_current_doctor_profile] = lambda: self.doctor
        self.client = TestClient(self.app)
        self.client.__enter__()
        self.mode = patch.object(settings, 'messaging_mode', 'preview'); self.mode.start()

    def tearDown(self):
        self.mode.stop(); self.client.__exit__(None, None, None); self.db.close(); self.engine.dispose()

    def book(self, days=1):
        res = self.client.post('/api/doctor/appointments', json={'patient_id': str(self.patient.id),
            'date': str(clinic_today() + timedelta(days=days)), 'time': '14:30', 'location': 'Test clinic'})
        self.assertEqual(res.status_code, 201, res.text)
        return res.json()['id']

    def external(self):
        return self.db.query(Notification).filter(Notification.delivery_method != 'in_app').all()

    def test_booking_preview_has_real_logistics_and_no_network(self):
        with patch('app.services.care_messaging.twilio_request') as send:
            self.book(); process_outbox(self.db); send.assert_not_called()
        self.assertEqual(len(self.external()), 3)
        for row in self.external():
            self.assertEqual(row.delivery_status, 'preview')
            self.assertIn('14:30', row.message); self.assertIn('Test clinic', row.message)
            self.assertIsNone(row.sent_at)

    def test_reminders_idempotent_across_scheduler_and_manual(self):
        aid = self.book()
        queue_due_reminders(self.db); queue_due_reminders(self.db)
        for _ in range(2):
            self.assertEqual(self.client.post(f'/api/doctor/care/appointments/{aid}/remind').status_code, 200)
        self.assertEqual(len(self.external()), 6)  # confirmation + one reminder, three channels each

    def test_reschedule_and_cancel_invalidate_old_messages(self):
        aid = self.book()
        res = self.client.patch(f'/api/doctor/appointments/{aid}', json={'time': '16:45'})
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(sum(n.delivery_status == 'preview' for n in self.external()), 3)
        self.assertTrue(all('16:45' in n.message for n in self.external() if n.delivery_status == 'preview'))
        res = self.client.patch(f'/api/doctor/appointments/{aid}', json={'status': 'cancelled'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.client.post(f'/api/doctor/care/appointments/{aid}/remind').status_code, 422)
        self.assertTrue(all('cancelled' in n.message for n in self.external() if n.delivery_status == 'preview'))

    def test_opt_out_rechecked_at_delivery(self):
        with patch.object(settings, 'messaging_mode', 'live'):
            self.book()
            self.patient.consent = {}; self.db.commit()
            with patch('app.services.care_messaging.twilio_request') as send:
                process_outbox(self.db); send.assert_not_called()
        self.assertTrue(all(n.delivery_status == 'suppressed' for n in self.external()))

    def test_missing_provider_is_blocked_not_sent(self):
        with patch.object(settings, 'messaging_mode', 'live'), patch('app.services.care_messaging.channel_readiness', return_value={'email': False, 'sms': False, 'whatsapp': False}):
            self.book(); process_outbox(self.db)
        self.assertTrue(all(n.delivery_status == 'blocked' for n in self.external()))

    def test_provider_acceptance_and_delivery_receipt_are_separate(self):
        self.patient.consent = {'sms_notifications': True}; self.db.commit()
        with patch.object(settings, 'messaging_mode', 'live'), patch('app.services.care_messaging.channel_readiness', return_value={'sms': True}), patch('app.services.care_messaging.twilio_request', return_value={'sid': 'SM' + '1'*32, 'status': 'queued'}) as send:
            self.book(); process_outbox(self.db); process_outbox(self.db)
            self.assertEqual(send.call_count, 1)
        item = next(n for n in self.external() if n.delivery_method == 'sms')
        self.assertEqual(item.delivery_status, 'accepted')
        with patch('app.services.care_messaging.twilio_request', return_value={'status': 'delivered'}):
            res = self.client.post(f'/api/doctor/care/messages/{item.id}/refresh')
        self.assertEqual(res.json()['status'], 'delivered')

    def test_ambiguous_timeout_never_auto_resends(self):
        self.patient.consent = {'sms_notifications': True}; self.db.commit()
        with patch.object(settings, 'messaging_mode', 'live'), patch('app.services.care_messaging.channel_readiness', return_value={'sms': True}), patch('app.services.care_messaging.twilio_request', side_effect=TimeoutError) as send:
            self.book(); process_outbox(self.db); process_outbox(self.db)
            self.assertEqual(send.call_count, 1)
        self.assertEqual(next(n for n in self.external() if n.delivery_method == 'sms').delivery_status, 'unknown')

    def test_other_doctor_cannot_read_or_remind(self):
        aid = self.book()
        self.app.dependency_overrides[get_current_doctor_profile] = lambda: self.other
        data = self.client.get('/api/doctor/care').json()
        self.assertEqual(data['messages'], []); self.assertEqual(data['patients'], [])
        self.assertEqual(self.client.post(f'/api/doctor/care/appointments/{aid}/remind').status_code, 404)
        self.assertEqual(self.client.patch(f'/api/doctor/care/patients/{self.patient.id}/contact', json={}).status_code, 404)
        res = self.client.post('/api/doctor/referrals', json={'patient_id':str(self.patient.id),'specialty':'Test','reason':'Test'})
        self.assertEqual(res.status_code, 404)

    def test_referral_requires_evidence_and_valid_transitions(self):
        res = self.client.post('/api/doctor/referrals', json={'patient_id': str(self.patient.id), 'specialty':'Gynaecology', 'reason':'Clinician review', 'to_specialist':'Partner clinic'})
        self.assertEqual(res.status_code, 201, res.text)
        rid = res.json()['id']; url = f'/api/doctor/care/referrals/{rid}'
        self.assertEqual(self.client.patch(url,json={'stage':'outcome_recorded','note':'skip'}).status_code,422)
        for stage in ('contacted','scheduled','seen','outcome_recorded'):
            r=self.client.patch(url,json={'stage':stage,'note':f'Evidence for {stage}'})
            self.assertEqual(r.status_code,200,r.text)
        data=self.client.get('/api/doctor/care').json()
        self.assertEqual(data['metrics']['referral_completion_pct'],100)
        self.assertEqual(len(data['referrals'][0]['events']),4)
        self.assertEqual(data['referrals'][0]['outcome'],'Evidence for outcome_recorded')

    def test_empty_denominator_and_metric_export(self):
        self.assertIsNone(self.client.get('/api/doctor/care').json()['metrics']['referral_completion_pct'])
        res=self.client.get('/api/doctor/care/export')
        self.assertEqual(res.status_code,200); self.assertIn('not clinical effectiveness',res.text)
        self.assertNotIn('Test Patient',res.text)

    def test_past_reschedule_and_conflicting_booking_rejected(self):
        aid=self.book()
        self.assertEqual(self.client.patch(f'/api/doctor/appointments/{aid}',json={'date':str(clinic_today()-timedelta(days=1))}).status_code,422)
        res=self.client.post('/api/doctor/appointments',json={'patient_id':str(self.patient.id),'date':str(clinic_today()+timedelta(days=1))})
        self.assertEqual(res.status_code,409)

    def test_time_only_change_is_rescheduled_and_return_to_old_time_is_new_event(self):
        aid = self.book()
        for clock in ('16:00', '14:30', '16:00'):
            res = self.client.patch(f'/api/doctor/appointments/{aid}', json={'time': clock})
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()['status'], 'rescheduled')
        self.assertEqual(sum(n.delivery_status == 'preview' for n in self.external()), 3)
        self.assertEqual(len(self.external()), 12)

    def test_referral_contact_attempt_can_be_logged_without_advancing(self):
        res = self.client.post('/api/doctor/referrals', json={'patient_id': str(self.patient.id), 'specialty':'Test', 'reason':'Test'})
        rid = res.json()['id']
        res = self.client.patch(f'/api/doctor/care/referrals/{rid}', json={'stage':'referred', 'note':'No answer; try tomorrow'})
        self.assertEqual(res.status_code, 200)
        row = self.client.get('/api/doctor/care').json()['referrals'][0]
        self.assertEqual(row['stage'], 'referred'); self.assertEqual(len(row['events']), 1)

    def test_invalid_time_rejected(self):
        res = self.client.post('/api/doctor/appointments', json={'patient_id':str(self.patient.id),'date':str(clinic_today()),'time':'25:99'})
        self.assertEqual(res.status_code,422)

    def test_password_shortcuts_removed(self):
        from app.core.security import hash_password, verify_password
        hashed = hash_password('A-different-password-2026')
        self.assertFalse(verify_password('Doctor@123', hashed))
        self.assertTrue(verify_password('A-different-password-2026', hashed))

    def test_technical_quality_flags_blank_tiny_and_blurred_images(self):
        import numpy as np
        from PIL import Image, ImageFilter
        from app.services.image_quality import technical_quality
        for img in (Image.new('RGB',(80,80)), Image.new('RGB',(256,256),(128,128,128)), Image.new('RGB',(256,256),'white')):
            self.assertEqual(technical_quality(img)['status'], 'repeat_recommended')
        rng = np.random.default_rng(8)
        detailed = Image.fromarray(rng.integers(30,220,(256,256),dtype=np.uint8))
        self.assertEqual(technical_quality(detailed)['status'],'passed')
        self.assertEqual(technical_quality(detailed.filter(ImageFilter.GaussianBlur(12)))['status'],'repeat_recommended')


    def test_triage_override_owned_and_audited(self):
        from app.models.scan import Scan
        from app.models.enums import ScreeningModule, ScanStatus
        scan = Scan(patient_id=self.patient.id, doctor_id=self.doctor.id,
                    module=ScreeningModule.breast, status=ScanStatus.analyzed, image_quality='poor')
        self.db.add(scan); self.db.commit()
        url = f'/api/doctor/care/scans/{scan.id}/triage'
        result = self.client.patch(url, json={'queue': 'priority', 'note': 'Clinician reviewed source evidence'})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['suggested_queue'], 'review')
        self.assertEqual(result.json()['queue'], 'priority')
        self.db.refresh(scan)
        self.assertEqual(len(scan.doctor_modifications['care_triage_history']), 1)
        self.app.dependency_overrides[get_current_doctor_profile] = lambda: self.other
        self.assertEqual(self.client.patch(url, json={'queue': 'routine', 'note': 'Cannot access'}).status_code, 404)

    def test_referral_source_must_match_patient_and_doctor(self):
        import uuid
        result = self.client.post('/api/doctor/referrals', json={'patient_id': str(self.patient.id),
            'specialty': 'Review', 'reason': 'Clinician requested review', 'priority': 'routine',
            'attachments': {'source_scan_id': str(uuid.uuid4())}})
        self.assertEqual(result.status_code, 404)


    def test_referral_booking_links_visit_and_messages(self):
        ref = self.client.post('/api/doctor/referrals', json={'patient_id': str(self.patient.id),
            'specialty': 'Review', 'reason': 'Clinician requested visit', 'priority': 'routine'}).json()
        rid = ref['id']
        booking = {'patient_id': str(self.patient.id), 'referral_id': rid,
                   'date': str(clinic_today() + timedelta(days=4)), 'time': '11:00'}
        self.assertEqual(self.client.post('/api/doctor/appointments', json=booking).status_code, 422)
        self.assertEqual(self.client.patch(f'/api/doctor/care/referrals/{rid}',
            json={'stage': 'contacted', 'note': 'Patient confirmed availability'}).status_code, 200)
        response = self.client.post('/api/doctor/appointments', json=booking)
        self.assertEqual(response.status_code, 201, response.text)
        row = self.client.get('/api/doctor/care').json()['referrals'][0]
        self.assertEqual(row['stage'], 'scheduled')
        self.assertEqual(row['appointment_id'], response.json()['id'])
        self.assertEqual(len(self.external()), 3)


    def linked_visit(self):
        ref = self.client.post('/api/doctor/referrals', json={'patient_id': str(self.patient.id),
            'specialty': 'Review', 'reason': 'Review needed', 'priority': 'routine'}).json()
        self.client.patch(f"/api/doctor/care/referrals/{ref['id']}",
            json={'stage': 'contacted', 'note': 'Patient contacted'})
        appt = self.client.post('/api/doctor/appointments', json={'patient_id': str(self.patient.id),
            'referral_id': ref['id'], 'date': str(clinic_today()+timedelta(days=3)), 'time': '12:00'}).json()
        return ref['id'], appt['id']

    def test_cancelled_linked_visit_reopens_contact_task(self):
        rid, aid = self.linked_visit()
        self.assertEqual(self.client.patch(f'/api/doctor/appointments/{aid}',
            json={'status': 'cancelled'}).status_code, 200)
        row = self.client.get('/api/doctor/care').json()['referrals'][0]
        self.assertEqual(row['stage'], 'contacted')
        self.assertIn('cancelled', row['events'][-1]['note'])
        self.assertEqual(self.client.post(f'/api/doctor/appointments/{aid}/complete').status_code, 422)

    def test_linked_reschedule_updates_target_without_claiming_specialist_seen(self):
        rid, aid = self.linked_visit()
        future = str(clinic_today()+timedelta(days=7))
        self.client.patch(f'/api/doctor/appointments/{aid}', json={'date': future})
        row = self.client.get('/api/doctor/care').json()['referrals'][0]
        self.assertEqual(row['due_date'], future)
        self.client.post(f'/api/doctor/appointments/{aid}/complete')
        row = self.client.get('/api/doctor/care').json()['referrals'][0]
        self.assertEqual(row['stage'], 'scheduled')
        self.assertIn('Confirm specialist', row['events'][-1]['note'])

    def test_recall_needs_clinician_rationale_and_queues_messages(self):
        payload = {'patient_id': str(self.patient.id), 'appointment_type': 'Screening recall',
                   'date': str(clinic_today()+timedelta(days=180)), 'time': '10:30'}
        self.assertEqual(self.client.post('/api/doctor/appointments', json=payload).status_code, 422)
        payload['notes'] = 'Clinician selected follow-up based on reviewed history'
        self.assertEqual(self.client.post('/api/doctor/appointments', json=payload).status_code, 201)
        self.assertEqual(len(self.external()), 3)
        self.assertEqual(self.client.get('/api/doctor/care').json()['appointments'][0]['appointment_type'], 'Screening recall')

    def test_reminder_catchup_is_idempotent_and_skips_past_time(self):
        from datetime import datetime, time
        from zoneinfo import ZoneInfo
        from app.services.care_messaging import queue_catchup_reminders
        aid = self.book(days=0)
        now = datetime.combine(clinic_today(), time(12), tzinfo=ZoneInfo('Asia/Kolkata'))
        queue_catchup_reminders(self.db, now); queue_catchup_reminders(self.db, now)
        self.assertEqual(len(self.external()), 6)
        appt = self.db.get(Appointment, __import__('uuid').UUID(aid))
        appt.scheduled_time = time(11)
        self.db.commit()
        self.assertEqual(queue_catchup_reminders(self.db, now), [])

    def test_private_upload_requires_auth_and_patient_ownership(self):
        import tempfile
        from app.api.routes.private_files import router
        from app.api.deps import get_current_user
        from app.models.scan import Scan
        from app.models.enums import ScreeningModule, ScanStatus
        self.app.include_router(router)
        test_root = Path(__file__).resolve().parents[2] / 'tmp'
        test_root.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=test_root) as directory, patch.object(settings, 'upload_dir', directory):
            source = Path(directory) / 'test.png'
            source.write_bytes(b'synthetic-file-test')
            scan = Scan(patient_id=self.patient.id, doctor_id=self.doctor.id, module=ScreeningModule.breast,
                        status=ScanStatus.analyzed, image_path=str(source))
            self.db.add(scan); self.db.commit()
            self.assertEqual(self.client.get('/uploads/test.png').status_code, 401)
            self.app.dependency_overrides[get_current_user] = lambda: self.docuser
            response = self.client.get('/uploads/test.png')
            self.assertEqual(response.status_code, 200)
            self.assertIn('no-store', response.headers['cache-control'])
            self.app.dependency_overrides[get_current_user] = lambda: self.otheruser
            self.assertEqual(self.client.get('/uploads/test.png').status_code, 404)
            self.assertEqual(self.client.get(f'/api/scans/{scan.id}/primary-image').status_code, 404)
            self.app.dependency_overrides[get_current_user] = lambda: self.puser
            self.assertEqual(self.client.get('/uploads/test.png').status_code, 200)


    def test_interrupted_message_becomes_unknown_without_resend(self):
        from datetime import datetime, timezone
        self.book()
        message = self.external()[0]
        message.delivery_status = 'processing'
        message.next_attempt_at = datetime.now(timezone.utc) - timedelta(minutes=31)
        self.db.commit()
        with patch('app.services.care_messaging.twilio_request') as send:
            process_outbox(self.db)
            send.assert_not_called()
        self.db.refresh(message)
        self.assertEqual(message.delivery_status, 'unknown')

if __name__ == '__main__':
    unittest.main(verbosity=2)
