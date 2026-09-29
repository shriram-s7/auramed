import api from './api'

export function fetchScanResults(scanId) {
  return api.get('/doctor/scans/' + scanId + '/results')
}

export function updateDoctorReview(scanId, values, notes) {
  return api.patch('/doctor/scans/' + scanId + '/doctor-review', { values, notes })
}

export function fetchScanAuditLog(scanId) {
  return api.get('/doctor/scans/' + scanId + '/audit-log')
}

export function scheduleFollowup(scanId, scheduledDate, notes) {
  return api.post('/doctor/scans/' + scanId + '/schedule-followup', { scheduled_date: scheduledDate, notes })
}

export function togglePatientUrgent(patientId) {
  return api.post('/doctor/patients/' + patientId + '/flag-urgent')
}
