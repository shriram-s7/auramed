// DEV ONLY — Remove this component before production deployment
// To remove: delete this file and remove its import from App.jsx

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

const TEST_ACCOUNTS = {
  ADMIN: [
    {
      id: 'testadmin1',
      name: 'Admin',
      email: 'testadmin1@auramed.com',
      password: 'Admin@123',
      role: 'admin',
      badge: 'Admin',
      targetPath: '/admin',
    },
  ],
  DOCTORS: [
    {
      id: 'testdr1',
      name: 'Dr. Sharma (Radiology)',
      email: 'testdr1@auramed.com',
      password: 'Doctor@123',
      role: 'doctor',
      badge: 'Radiology',
      targetPath: '/doctor',
    },
    {
      id: 'testdr2',
      name: 'Dr. Mehta (Oncology)',
      email: 'testdr2@auramed.com',
      password: 'Doctor@123',
      role: 'doctor',
      badge: 'Oncology',
      targetPath: '/doctor',
    },
    {
      id: 'testdr3',
      name: 'Dr. Iyer (Gynecology)',
      email: 'testdr3@auramed.com',
      password: 'Doctor@123',
      role: 'doctor',
      badge: 'Gynecology',
      targetPath: '/doctor',
    },
  ],
  PATIENTS: [
    {
      id: 'testpatient1',
      name: 'Priya Nair (34F)',
      email: 'testpatient1@auramed.com',
      password: 'Patient@123',
      role: 'patient',
      badge: 'Patient',
      targetPath: '/patient',
    },
    {
      id: 'testpatient2',
      name: 'Meera Krishnan (45F)',
      email: 'testpatient2@auramed.com',
      password: 'Patient@123',
      role: 'patient',
      badge: 'Patient',
      targetPath: '/patient',
    },
    {
      id: 'testpatient3',
      name: 'Lakshmi Venkat (28F)',
      email: 'testpatient3@auramed.com',
      password: 'Patient@123',
      role: 'patient',
      badge: 'Patient',
      targetPath: '/patient',
    },
  ],
}

export default function DevTestingPanel() {
  // Safety guard: only render in development mode
  if (import.meta.env.MODE !== 'development') {
    return null
  }

  const [isOpen, setIsOpen] = useState(false)
  const [loadingId, setLoadingId] = useState(null)
  const [toast, setToast] = useState(null)
  const navigate = useNavigate()
  const { token, role: currentRole, setDirectAuth } = useAuth()

  // Decode active user email from token
  const activeEmail = (() => {
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.email || null
    } catch {
      return null
    }
  })()

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleLogin = async (account) => {
    try {
      setLoadingId(account.id)
      // POST to /api/auth/login with account's email and password
      const response = await api.post('/auth/login', {
        email: account.email,
        password: account.password,
      })

      // Store the token + role in AuthContext exactly as normal login does
      setDirectAuth(account.role, response.data)

      // Show small toast: "Logged in as [name]"
      setToast(`Logged in as ${account.name}`)

      // Collapse panel automatically
      setIsOpen(false)

      // Navigate to correct portal based on role
      navigate(account.targetPath)
    } catch (err) {
      console.error('Dev testing login error:', err)
      setToast(`Login failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <>
      {/* Small Toast Notification */}
      {toast && (
        <div
          id="dev-toast"
          className="fixed bottom-16 right-4 z-[10000] px-3.5 py-2 rounded-lg bg-slate-900 border border-emerald-500/40 text-emerald-300 text-xs font-medium shadow-2xl flex items-center gap-2 animate-fade-in"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{toast}</span>
        </div>
      )}

      {/* Floating Dev Testing Panel */}
      <div className="fixed bottom-4 right-4 z-[9999] font-sans">
        {!isOpen ? (
          /* Collapsed State: Pill Button */
          <button
            id="dev-panel-toggle"
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/25 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer border border-amber-400/40"
            title="Open Dev Testing Accounts Panel"
          >
            <span className="text-sm">🧪</span>
            <span>Dev</span>
          </button>
        ) : (
          /* Expanded State: 280px Card */
          <div
            id="dev-panel-card"
            className="w-[280px] bg-[#1e1e2e] border border-slate-700/70 rounded-xl shadow-2xl p-3.5 text-slate-200 transition-all duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-700/60">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🧪</span>
                <span className="font-bold text-xs tracking-wider uppercase text-amber-400">
                  Dev Testing Panel
                </span>
              </div>
              <button
                id="dev-panel-close"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm p-1 rounded hover:bg-slate-800 transition-colors"
                title="Collapse Panel"
              >
                ✕
              </button>
            </div>

            {/* Test Accounts Grouped by Role */}
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {Object.entries(TEST_ACCOUNTS).map(([groupTitle, accounts]) => (
                <div key={groupTitle}>
                  {/* Role Section Label */}
                  <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1.5 px-1">
                    {groupTitle}
                  </div>

                  {/* Account Buttons */}
                  <div className="space-y-1">
                    {accounts.map((account) => {
                      const isActive = activeEmail === account.email
                      const isLoading = loadingId === account.id

                      return (
                        <button
                          key={account.id}
                          id={`dev-login-${account.id}`}
                          onClick={() => handleLogin(account)}
                          disabled={isLoading}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                            isActive
                              ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-200'
                              : 'bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/40 text-slate-200 hover:border-slate-600'
                          } ${isLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {isActive && (
                              <span
                                className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
                                title="Active Session"
                              />
                            )}
                            <span className="truncate">{account.name}</span>
                          </div>

                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 ml-1.5 ${
                              isActive
                                ? 'bg-emerald-800/60 text-emerald-200'
                                : 'bg-slate-900/60 text-slate-400'
                            }`}
                          >
                            {isLoading ? '...' : account.badge}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Active Account Status Bar */}
            <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
              <span className="truncate">
                Active:{' '}
                <span className="text-slate-300 font-medium truncate">
                  {activeEmail || 'None (Logged out)'}
                </span>
              </span>
              {activeEmail && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Live
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
