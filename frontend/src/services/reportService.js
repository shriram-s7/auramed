import api from './api'

export function fetchReportForScan(scanId) {
  return api.get('/doctor/scans/' + scanId + '/report')
}

export function fetchReportById(reportId) {
  return api.get('/doctor/reports/' + reportId)
}

export function saveReportDraft(reportId, content) {
  return api.put('/doctor/reports/' + reportId, { content })
}

export function generateReportPdf(reportId) {
  return api.post('/doctor/reports/' + reportId + '/generate-pdf', {}, { responseType: 'blob' })
}

export function signReport(reportId) {
  return api.post('/doctor/reports/' + reportId + '/sign')
}

export function addReportAddendum(reportId, note) {
  const payload = typeof note === 'object' && note !== null
    ? { addendum_text: note.content || note.addendum_text || note.note || '', ...note }
    : { note: String(note || ''), addendum_text: String(note || '') }
  return api.post('/doctor/reports/' + reportId + '/addendum', payload)
}

export function shareReportWithPatient(reportId, payload = {}) {
  const data = {
    share_with_patient: payload.share_with_patient ?? true,
    delivery_method: payload.delivery_method || 'portal',
    share_with_physician: payload.share_with_physician ?? false,
    physician_id: payload.physician_id || undefined,
    message: payload.message || undefined,
  }
  return api.post('/doctor/reports/' + reportId + '/share', data)
}

export function fetchReportsList(params = {}) {
  return api.get('/doctor/reports', { params })
}

export function deleteDraftReport(reportId) {
  return api.delete('/doctor/reports/' + reportId)
}
