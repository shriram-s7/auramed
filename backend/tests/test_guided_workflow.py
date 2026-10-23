import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
import test_care_coordination as care_tests
import unittest
from app.api.routes import workflow, reports, patient_portal
from app.api.deps import get_current_user
from app.models.report import Report
from app.models.appointment import Appointment
from app.models.appointment_request import AppointmentRequest
from app.core.config import settings
from unittest.mock import patch
from datetime import timedelta
from app.services.care_messaging import clinic_today
import uuid
class GuidedTests(unittest.TestCase):
 tearDown = care_tests.CareTests.tearDown
 book = care_tests.CareTests.book
 def setUp(self):
  care_tests.CareTests.setUp(self)
  for r in (workflow.router,reports.router,patient_portal.router): self.app.include_router(r)
  self.app.dependency_overrides[get_current_user]=lambda:self.docuser
  self.app.dependency_overrides[patient_portal.get_current_patient]=lambda:self.patient
 def visit(self):
  r=self.client.post('/api/doctor/workflow/visits',json={'patient_id':str(self.patient.id),'module':'breast'})
  self.assertEqual(r.status_code,201,r.text);return r.json()['id']
 def review(self,vid):
  return self.client.patch(f'/api/doctor/workflow/visits/{vid}/review',json={'findings':'Synthetic finding explicitly recorded','source':'Synthetic external report dated today','assessment':'Synthetic assessment','plan':'Return to Test Clinic on agreed date','next_action':'appointment','complete':True})
 def test_review_finalize_release_and_lock(self):
  vid=self.visit()
  r=self.client.patch(f'/api/doctor/workflow/visits/{vid}/review',json={'complete':True});self.assertEqual(r.status_code,422)
  r=self.review(vid);self.assertEqual(r.status_code,200,r.text);rid=r.json()['report_id']
  self.assertEqual(self.client.get(f'/api/patient/reports/{rid}').status_code,404)
  self.assertEqual(self.client.post(f'/api/doctor/reports/{rid}/share',json={'share_with_patient':True,'delivery_method':'portal'}).status_code,422)
  with patch('app.api.routes.reports.save_report_pdf_file',return_value='isolated.pdf'):
   r=self.client.post(f'/api/doctor/reports/{rid}/sign');self.assertEqual(r.status_code,200,r.text)
  self.assertEqual(self.client.get(f'/api/patient/reports/{rid}').status_code,404)
  r=self.client.post(f'/api/doctor/reports/{rid}/share',json={'share_with_patient':True,'delivery_method':'portal'});self.assertEqual(r.status_code,200,r.text)
  r=self.client.get(f'/api/patient/reports/{rid}');self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['findings'],'Synthetic finding explicitly recorded')
  self.assertEqual(self.review(vid).status_code,409)
  pdf=self.client.get(f'/api/patient/reports/{rid}/pdf');self.assertEqual(pdf.status_code,200,pdf.text[:100]);self.assertTrue(pdf.content.startswith(b'%PDF'))
  self.assertEqual(self.client.get('/api/doctor/reports').status_code,200)
 def request(self,aid):
  return self.client.patch(f'/api/patient/appointments/{aid}/reschedule',json={'preferred_date':str(clinic_today()+timedelta(days=3)),'preferred_time':'16:00','reason':'Test request'})
 def test_request_accept_is_persistent_and_not_auto_booking(self):
  aid=self.book();before=self.db.get(Appointment,uuid.UUID(aid)).scheduled_time
  r=self.request(aid);self.assertEqual(r.status_code,200,r.text);rid=r.json()['id'];self.db.expire_all()
  self.assertEqual(self.db.get(Appointment,uuid.UUID(aid)).scheduled_time,before)
  self.assertEqual(self.request(aid).status_code,409)
  r=self.client.get('/api/doctor/workflow/requests');self.assertEqual(len(r.json()),1)
  r=self.client.post(f'/api/doctor/workflow/requests/{rid}/resolve',json={'decision':'accept','response':'New time confirmed'});self.assertEqual(r.status_code,200,r.text)
  self.db.expire_all();self.assertEqual(self.db.get(Appointment,uuid.UUID(aid)).scheduled_time.hour,16)
  self.assertEqual(self.db.get(AppointmentRequest,uuid.UUID(rid)).status,'accepted')
  self.assertEqual(self.client.post(f'/api/doctor/workflow/requests/{rid}/resolve',json={'decision':'accept','response':'Duplicate'}).status_code,409)
 def test_patient_cancel_withdraws_pending_request(self):
  aid=self.book();rid=self.request(aid).json()['id']
  r=self.client.patch(f'/api/patient/appointments/{aid}/cancel',json={'reason':'Changed plan'});self.assertEqual(r.status_code,200,r.text)
  self.db.expire_all();self.assertEqual(self.db.get(AppointmentRequest,uuid.UUID(rid)).status,'withdrawn')
  self.assertEqual(self.db.get(Appointment,uuid.UUID(aid)).status.value,'cancelled')
 def test_doctor_cannot_read_another_doctors_visit(self):
  vid=self.visit();self.doctor=self.other
  self.assertEqual(self.client.get(f'/api/doctor/workflow/visits/{vid}').status_code,404)
 def test_patient_profile_does_not_invent_information(self):
  r=self.client.get('/api/patient/profile');self.assertEqual(r.status_code,200,r.text)
  self.assertEqual(r.json()['blood_group'],'');self.assertEqual(r.json()['address'],'');self.assertEqual(r.json()['date_of_birth'],'')
if __name__=='__main__':
 import unittest
 unittest.main()
