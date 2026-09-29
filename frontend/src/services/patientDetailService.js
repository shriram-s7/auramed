import api from './api'

export function fetchPatientDetail(patientId) {
  return api.get(`/doctor/patients/${patientId}`)
}

export function updatePatient(patientId, payload) {
  return api.patch(`/doctor/patients/${patientId}`, payload)
}

export function updateOverallNotes(patientId, overallNotes) {
  return api.patch(`/doctor/patients/${patientId}/overall-notes`, { overall_notes: overallNotes })
}

export function addPatientNote(patientId, text) {
  return api.post(`/doctor/patients/${patientId}/notes`, { text })
}

export function toggleUrgentFlag(patientId) {
  return api.post(`/doctor/patients/${patientId}/flag-urgent`)
}
