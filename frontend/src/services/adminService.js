import api from './api'

export function fetchAdminStats() {
  return api.get('/admin/stats')
}

export function fetchSystemStatus() {
  return api.get('/admin/system-status')
}

export function fetchPendingCounts() {
  return api.get('/admin/pending-counts')
}

export function fetchAdminDoctors(params = {}) {
  return api.get('/admin/doctors', { params })
}

export function verifyDoctor(doctorId) {
  return api.patch(`/admin/doctors/${doctorId}/verify`)
}

export function updateDoctorStatus(doctorId, statusValue) {
  return api.patch(`/admin/doctors/${doctorId}/status`, { status: statusValue })
}

export function createDoctor(payload) {
  return api.post('/admin/doctors', payload)
}

export function fetchAdminPatients(params = {}) {
  return api.get('/admin/patients', { params })
}

export function deleteAdminPatient(patientId) {
  return api.delete(`/admin/patients/${patientId}`)
}

export function fetchAdminScans(params = {}) {
  return api.get('/admin/scans', { params })
}

export function fetchAdminReports(params = {}) {
  return api.get('/admin/reports', { params })
}

export function fetchAdminAppointments(params = {}) {
  return api.get('/admin/appointments', { params })
}

export function cancelAdminAppointment(appointmentId, reason = '') {
  return api.delete(`/admin/appointments/${appointmentId}`, { params: { reason } })
}

export function fetchAdminAuditLogs(params = {}) {

  return api.get('/admin/audit-logs', { params })
}

export function fetchDataDeletionRequests(params = {}) {
  return api.get('/admin/data-requests', { params })
}

export function approveDataDeletionRequest(requestId) {
  return api.post(`/admin/data-requests/${requestId}/approve`)
}

export function rejectDataDeletionRequest(requestId, reason) {
  return api.post(`/admin/data-requests/${requestId}/reject`, { reason })
}

export function fetchAdminSettings() {
  return api.get('/admin/settings')
}

export function updateAdminSettings(payload) {
  return api.patch('/admin/settings', payload)
}

export function testAdminEmail() {
  return api.post('/admin/settings/test-email')
}

export function testAdminSMS() {
  return api.post('/admin/settings/test-sms')
}

export function runAdminBackup() {
  return api.post('/admin/settings/backup')
}

export function downloadAdminBackup() {
  return api.get('/admin/settings/download-backup', { responseType: 'blob' })
}

export function clearAdminCache(type = 'all') {
  return api.post('/admin/settings/clear-cache', { type })
}

export function executeDangerAction(password, action) {
  return api.post('/admin/settings/danger-action', { password, action })
}
