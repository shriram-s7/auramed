import api from './api'

export function fetchPatientStats() {
  return api.get('/doctor/patients/stats')
}

export function fetchPatients(params) {
  return api.get('/doctor/patients', { params })
}

export function createPatient(payload) {
  return api.post('/doctor/patients', payload)
}

export function updatePatientStatus(patientId, statusValue) {
  return api.patch(`/doctor/patients/${patientId}/status`, { status: statusValue })
}

export function deletePatient(patientId) {
  return api.delete(`/doctor/patients/${patientId}`)
}
