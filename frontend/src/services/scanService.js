import api from './api'

export function analyzeScan({ module, patientId, clinicalInputs, imageQuality, image, scanId, additionalImages = [] }) {
  const formData = new FormData()
  if (scanId) formData.append('scan_id', scanId)
  formData.append('module', module)
  formData.append('patient_id', patientId)
  formData.append('clinical_inputs', JSON.stringify(clinicalInputs))
  if (imageQuality) formData.append('image_quality', imageQuality)
  formData.append('image', image)
  for (const extra of additionalImages) {
    formData.append('additional_images', extra)
  }
  return api.post('/doctor/scans/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function saveScanDraft({ module, patientId, clinicalInputs, scanDate, scanId }) {
  return api.post('/doctor/scans/draft', {
    module,
    patient_id: patientId,
    clinical_inputs: clinicalInputs,
    scan_date: scanDate || undefined,
    scan_id: scanId || undefined,
  })
}

export function getScanPrimaryImage(scanId) {
  return api.get(`/scans/${scanId}/primary-image`)
}

export function getScanResults(scanId) {
  return api.get(`/doctor/scans/${scanId}/results`)
}
