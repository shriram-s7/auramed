import api from './api'

export function fetchDoctorSettings() {
  return api.get('/doctor/settings')
}

export function updateDoctorSettings(payload) {
  return api.patch('/doctor/settings', payload)
}

export function changeDoctorPassword(payload) {
  return api.post('/doctor/change-password', payload)
}

export function revokeSession(sessionId) {
  return api.delete(`/doctor/sessions/${sessionId}`)
}

export function revokeAllOtherSessions() {
  return api.delete('/doctor/sessions')
}

export function exportDoctorData() {
  return api.post('/doctor/export-data', {}, { responseType: 'blob' })
}

export function deactivateDoctorAccount() {
  return api.post('/doctor/deactivate')
}
