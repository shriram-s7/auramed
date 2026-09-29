import api from './api'

export function unifiedLogin(email, password) {
  return api.post('/auth/login', { email, password })
}

export function selfRegisterPatient(payload) {
  return api.post('/auth/register', payload)
}

export function loginAdmin(email, password) {

  return api.post('/auth/admin/login', { email, password })
}

export function loginDoctor(identifier, password, registrationNumber) {
  return api.post('/auth/doctor/login', {
    identifier,
    password,
    registration_number: registrationNumber,
  })
}

export function loginPatient(identifier, password) {
  return api.post('/auth/patient/login', { identifier, password })
}

export function registerDoctor(payload) {
  return api.post('/auth/doctor/register', payload)
}

export function registerPatient(payload) {
  return api.post('/auth/patient/register', payload)
}

export function logoutRequest() {
  return api.post('/auth/logout')
}

export function fetchCurrentUser() {
  return api.get('/auth/me')
}

export function refreshTokenRequest(refreshToken) {
  return api.post('/auth/refresh', { refresh_token: refreshToken })
}

export function forgotPassword(email) {
  return api.post('/auth/forgot-password', { email })
}

export function resetPassword(token, newPassword) {
  return api.post('/auth/reset-password', { token, new_password: newPassword })
}
