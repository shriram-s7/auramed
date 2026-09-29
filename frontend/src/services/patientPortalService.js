import api from './api'

export function fetchPatientDashboard() {
  return api.get('/patient/dashboard')
}

export function fetchPatientReports(params = {}) {
  return api.get('/patient/reports', { params })
}

export function fetchPatientReportDetail(reportId) {
  return api.get(`/patient/reports/${reportId}`)
}

export function downloadPatientReportPdf(reportId) {
  return api.get(`/patient/reports/${reportId}/pdf`, { responseType: 'blob' })
}

export function fetchPatientAppointments() {
  return api.get('/patient/appointments')
}

export function reschedulePatientAppointment(appointmentId, payload) {
  return api.patch(`/patient/appointments/${appointmentId}/reschedule`, payload)
}

export function cancelPatientAppointment(appointmentId, payload) {
  return api.patch(`/patient/appointments/${appointmentId}/cancel`, payload)
}

export function fetchPatientTimeline() {
  return api.get('/patient/timeline')
}

export function fetchPatientProfile() {
  return api.get('/patient/profile')
}

export function updatePatientProfile(payload) {
  return api.patch('/patient/profile', payload)
}

export function changePatientPassword(payload) {
  return api.post('/patient/change-password', payload)
}

export function submitPatientDataDeletion(payload) {
  return api.post('/patient/data-deletion-request', payload)
}
