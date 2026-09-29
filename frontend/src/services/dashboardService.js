import api from './api'

export function fetchDashboardSummary() {
  return api.get('/doctor/dashboard/summary')
}

export function fetchUrgentCases() {
  return api.get('/doctor/dashboard/urgent-cases')
}

export function fetchNotifications() {
  return api.get('/notifications')
}

export function fetchUnreadNotificationCount() {
  return api.get('/notifications/unread-count')
}
