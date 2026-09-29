import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  unifiedLogin,
  loginAdmin,
  loginDoctor,
  loginPatient,
  logoutRequest,
  refreshTokenRequest,
} from '../services/authService'
import { readAuthStorage, writeAuthStorage } from '../services/api'

export function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

function buildAuthState(data, explicitRole = null) {
  const token = data.access_token || data.token
  const decoded = decodeJwt(token)
  const role = explicitRole || data.role || decoded?.role || 'patient'
  const user = data.user || {
    id: decoded?.sub,
    email: decoded?.email,
    name: decoded?.name,
    role,
    doctor_id: decoded?.doctor_id,
    patient_id: decoded?.patient_id,
    specialty: decoded?.specialty,
  }

  return {
    token,
    accessToken: token,
    refreshToken: data.refresh_token || data.refreshToken,
    role,
    user,
    expiresAt: data.expires_in
      ? Date.now() + data.expires_in * 1000
      : data.expiresAt || (decoded?.exp ? decoded.exp * 1000 : null),
  }
}

const AuthContext = createContext(null)

const REFRESH_BUFFER_MS = 5 * 60 * 1000

const LOGIN_FNS = {
  admin: (creds) => loginAdmin(creds.email, creds.password),
  doctor: (creds) => loginDoctor(creds.identifier, creds.password, creds.registrationNumber),
  patient: (creds) => loginPatient(creds.identifier, creds.password),
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const stored = readAuthStorage()
    if (!stored) return null
    const token = stored.token || stored.accessToken
    const decoded = decodeJwt(token)
    const role = stored.role || decoded?.role || null
    return {
      ...stored,
      token,
      accessToken: token,
      role,
      user: stored.user || (decoded ? { id: decoded.sub, email: decoded.email, name: decoded.name, role } : null),
    }
  })

  const refreshTimerRef = useRef(null)

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  const persist = useCallback((next) => {
    setAuth(next)
    writeAuthStorage(next)
  }, [])

  const doRefresh = useCallback(async () => {
    const current = readAuthStorage()
    if (!current?.refreshToken) return null
    try {
      const response = await refreshTokenRequest(current.refreshToken)
      const next = buildAuthState({
        ...current,
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
      })
      persist(next)
      return next
    } catch {
      persist(null)
      return null
    }
  }, [persist])

  const scheduleRefresh = useCallback(
    (expiresAt) => {
      clearRefreshTimer()
      if (!expiresAt) return
      const delay = Math.max(expiresAt - Date.now() - REFRESH_BUFFER_MS, 0)
      refreshTimerRef.current = setTimeout(() => {
        doRefresh()
      }, delay)
    },
    [clearRefreshTimer, doRefresh],
  )

  useEffect(() => {
    if (auth?.expiresAt) {
      scheduleRefresh(auth.expiresAt)
    } else {
      clearRefreshTimer()
    }
    return clearRefreshTimer
  }, [auth?.expiresAt, clearRefreshTimer, scheduleRefresh])

  const login = useCallback(
    async (firstArg, secondArg) => {
      let response
      let assignedRole = null

      if (typeof firstArg === 'string' && secondArg && typeof secondArg === 'object') {
        const role = firstArg
        const credentials = secondArg
        const loginFn = LOGIN_FNS[role]
        if (loginFn) {
          try {
            response = await loginFn(credentials)
            assignedRole = role
          } catch {
            const ident = credentials.email || credentials.identifier
            response = await unifiedLogin(ident, credentials.password)
          }
        } else {
          response = await unifiedLogin(credentials.email || credentials.identifier, credentials.password)
        }
      } else if (typeof firstArg === 'string' && typeof secondArg === 'string') {
        response = await unifiedLogin(firstArg, secondArg)
      } else if (firstArg && typeof firstArg === 'object') {
        const { email, identifier, password } = firstArg
        response = await unifiedLogin(email || identifier, password)
      } else {
        throw new Error('Invalid login credentials provided')
      }

      const next = buildAuthState(response.data, assignedRole)
      persist(next)
      return next
    },
    [persist],
  )

  const logout = useCallback(async () => {
    try {
      if (readAuthStorage()?.accessToken) {
        await logoutRequest()
      }
    } catch {
      // ignore network errors during logout
    } finally {
      clearRefreshTimer()
      persist(null)
    }
  }, [clearRefreshTimer, persist])

  const setDirectAuth = useCallback(
    (role, data) => {
      const next = buildAuthState(data, role)
      persist(next)
      return next
    },
    [persist],
  )

  const value = useMemo(
    () => ({
      user: auth?.user ?? null,
      role: auth?.role ?? null,
      token: auth?.token ?? auth?.accessToken ?? null,
      isAuthenticated: Boolean(auth?.token || auth?.accessToken),
      login,
      logout,
      setDirectAuth,
      refreshToken: doRefresh,
    }),
    [auth, login, logout, setDirectAuth, doRefresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}

