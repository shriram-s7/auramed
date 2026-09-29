import axios from 'axios'

const AUTH_STORAGE_KEY = 'auramed_auth'
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export function readAuthStorage() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...parsed,
        token: parsed.token || parsed.accessToken,
        accessToken: parsed.accessToken || parsed.token,
      }
    }
    const token = localStorage.getItem('token')
    const role = localStorage.getItem('role')
    if (token) {
      return { token, accessToken: token, role, user: null }
    }
    return null
  } catch {
    return null
  }
}

export function writeAuthStorage(auth) {
  if (!auth) {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    return
  }
  const normalized = {
    ...auth,
    token: auth.token || auth.accessToken,
    accessToken: auth.accessToken || auth.token,
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalized))
  if (normalized.token) {
    localStorage.setItem('token', normalized.token)
  }
  if (normalized.role) {
    localStorage.setItem('role', normalized.role)
  }
}

function showNetworkErrorToast(message = 'Network error. Please check backend connection.') {
  try {
    const event = new CustomEvent('auramed_toast', { detail: { message, type: 'error' } })
    window.dispatchEvent(event)

    const toastId = 'auramed-network-toast-banner'
    let banner = document.getElementById(toastId)
    if (!banner && typeof document !== 'undefined') {
      banner = document.createElement('div')
      banner.id = toastId
      banner.style.cssText =
        'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#ef4444;color:#ffffff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:999999;box-shadow:0 10px 25px -5px rgba(0,0,0,0.3);transition:opacity 0.3s ease;pointer-events:none;'
      banner.textContent = message
      document.body.appendChild(banner)
      setTimeout(() => {
        banner?.remove()
      }, 4000)
    }
  } catch {
    // ignore in non-browser environments
  }
}

function redirectToLogin() {
  writeAuthStorage(null)
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

export const api = axios.create({
  baseURL: BASE_URL,
})

api.interceptors.request.use((config) => {
  const auth = readAuthStorage()
  const token = auth?.token || auth?.accessToken
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise = null

async function performRefresh() {
  const auth = readAuthStorage()
  if (!auth?.refreshToken) {
    throw new Error('No refresh token available')
  }

  const response = await axios.post(`${BASE_URL}/auth/refresh`, {
    refresh_token: auth.refreshToken,
  })

  const updated = {
    ...auth,
    token: response.data.access_token,
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresAt: Date.now() + response.data.expires_in * 1000,
  }
  writeAuthStorage(updated)
  return updated
}

const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/admin/login',
  '/auth/doctor/login',
  '/auth/patient/login',
  '/auth/doctor/register',
  '/auth/patient/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
]

function isPublicAuthRequest(url) {
  return PUBLIC_AUTH_PATHS.some((path) => url?.includes(path))
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Handle Network / Connection Errors
    if (!error.response || error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      showNetworkErrorToast('Network error: Unable to reach AuraMed server. Please check your connection.')
      return Promise.reject(error)
    }

    // Public auth requests failing with 401 should report error to form without redirecting
    if (isPublicAuthRequest(originalRequest?.url)) {
      return Promise.reject(error)
    }

    // Attempt token refresh on 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        if (!refreshPromise) {
          refreshPromise = performRefresh().finally(() => {
            refreshPromise = null
          })
        }
        const updated = await refreshPromise
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${updated.token}`
        return api(originalRequest)
      } catch {
        redirectToLogin()
        return Promise.reject(error)
      }
    }

    // If 401 persists after retry
    if (error.response?.status === 401) {
      redirectToLogin()
    }

    return Promise.reject(error)
  },
)

export default api

