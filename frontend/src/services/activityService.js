import api from './api'

export function fetchDoctorActivity(params = {}) {
  return api.get('/doctor/activity', { params })
}

export function exportActivityCSV(params = {}) {
  return api.get('/doctor/activity/export', {
    params,
    responseType: 'blob',
  })
}
