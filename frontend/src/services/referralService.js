import api from './api'

export function fetchSpecialists() {
  return api.get('/doctor/referrals/specialists')
}

export function fetchPatientReferralContext(patientId) {
  return api.get('/doctor/referrals/patient-context/' + patientId)
}

export function createReferral(payload) {
  return api.post('/doctor/referrals', payload)
}

export function fetchDoctorReferrals() {
  return api.get('/doctor/referrals')
}
