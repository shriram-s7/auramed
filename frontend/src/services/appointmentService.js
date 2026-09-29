import api from './api'

export function fetchAppointments(params = {}) {
  return api.get('/doctor/appointments', { params })
}

export function scheduleAppointment(payload) {
  return api.post('/doctor/appointments', payload)
}

export function updateAppointment(appointmentId, payload) {
  return api.put('/doctor/appointments/' + appointmentId, payload)
}

export function cancelAppointment(appointmentId) {
  return api.delete('/doctor/appointments/' + appointmentId)
}

export function updateAppointmentStatus(appointmentId, payload) {
  return api.patch('/doctor/appointments/' + appointmentId + '/status', payload)
}
