import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Activity,
  Heart,
  Microscope,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, role } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // If already authenticated, redirect to appropriate portal
  useEffect(() => {
    if (isAuthenticated && role) {
      const from = location.state?.from?.pathname
      if (from && from !== '/login') {
        navigate(from, { replace: true })
      } else if (role === 'admin') {
        navigate('/admin', { replace: true })
      } else if (role === 'doctor') {
        navigate('/doctor', { replace: true })
      } else {
        navigate('/patient', { replace: true })
      }
    }
  }, [isAuthenticated, role, navigate, location.state])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Please enter both email/identifier and password.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const authState = await login(email.trim(), password)
      const targetRole = authState?.role

      if (targetRole === 'admin') {
        navigate('/admin', { replace: true })
      } else if (targetRole === 'doctor') {
        navigate('/doctor', { replace: true })
      } else {
        navigate('/patient', { replace: true })
      }
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        (typeof err.response?.data?.message === 'string' ? err.response?.data?.message : null) ||
        'Authentication failed. Please check your credentials.'
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden select-none">
      {/* Background visual elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-950/40 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link to="/" className="flex items-center justify-center space-x-3 mb-6 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-teal-500/20 group-hover:scale-105 transition-transform">
            A
          </div>
          <div>
            <span className="text-2xl font-bold tracking-tight text-white block">
              Aura<span className="text-teal-400">Med</span>
            </span>
          </div>
        </Link>

        <h2 className="text-center text-2xl font-bold tracking-tight text-white">
          Sign in to Clinical Portal
        </h2>
        <p className="mt-2 text-center text-xs text-slate-400">
          Secure, authenticated access for clinicians, patients, and administrators
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="email-input">
                Email Address or Medical ID
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email-input"
                  name="email"
                  type="text"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@auramed.com or ID"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="password-input">
                Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-slate-950 bg-gradient-to-r from-teal-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </div>
              ) : (
                <span className="flex items-center space-x-1.5">
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col space-y-3 text-center">
            <div className="text-xs text-slate-400">
              New patient without an account?{' '}
              <Link to="/register" className="text-teal-400 hover:text-teal-300 font-semibold underline underline-offset-2">
                Register as Patient
              </Link>
            </div>
            <div>
              <Link to="/" className="text-xs text-slate-500 hover:text-slate-400">
                &larr; Return to AuraMed Overview
              </Link>
            </div>
          </div>
        </div>

        {/* Security / Compliance Badge */}
        <div className="mt-6 flex items-center justify-center space-x-2 text-slate-500 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400/80" />
          <span>AES-256 Encrypted &bull; HIPAA & DPDP Compliant &bull; Role-Isolated Session</span>
        </div>
      </div>
    </div>
  )
}
