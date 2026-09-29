import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ShieldCheck, ArrowLeft } from 'lucide-react'
import AuthSidePanel from '../../components/common/AuthSidePanel'
import TextField from '../../components/common/TextField'
import PasswordField from '../../components/common/PasswordField'
import { useAuth } from '../../context/AuthContext'

function validate(form) {
  const errors = {}
  if (!form.email.trim()) {
    errors.email = 'Administrator ID is required'
  }
  if (!form.password) errors.password = 'Password is required'
  return errors
}

function AdminLoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateField(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
      setErrors((errs) => ({ ...errs, [field]: undefined }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationErrors = validate(form)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setApiError('')
    setLoading(true)
    try {
      await login('admin', form)
      navigate('/admin/dashboard')
    } catch (err) {
      setApiError(err.response?.data?.detail || 'Unable to log in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AuthSidePanel
        variant="serious"
        badge="Administrator Access"
        headline="Platform Governance and Oversight"
        bullets={['Approve and manage clinician accounts', 'Review platform-wide audit logs', 'Oversee data deletion requests']}
        quote="“Every action on this platform is accountable to someone.”"
      />

      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link
            to="/"
            className="group mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary/60 hover:text-primary transition-colors"
          >
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
            <span>Back to Home</span>
          </Link>

          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white font-bold">
              A
            </div>
            <p className="text-sm font-bold text-primary">AuraMed</p>
          </div>

          <h1 className="mt-4 text-2xl font-bold text-primary lg:mt-0">Admin Login</h1>
          <p className="mt-1 text-sm text-primary/60">Platform administration access only.</p>

          {/* Quick Demo Fill Card */}
          <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50/80 p-3 text-xs text-purple-900 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1 text-purple-800">
                ⚡ Quick Test Mode
              </span>
              <button
                type="button"
                onClick={() => {
                  setForm({ email: 'admin@auramed.com', password: '123' })
                  setErrors({})
                }}
                className="rounded-md bg-purple-700 px-2.5 py-1 text-xs font-semibold text-white shadow hover:bg-purple-800 transition"
              >
                1-Click Auto Fill
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-purple-700">
              Test password: <code className="rounded bg-purple-100 px-1.5 py-0.5 font-mono font-bold text-purple-900">123</code> &bull; ID: <code className="rounded bg-purple-100 px-1.5 py-0.5 font-mono font-bold text-purple-900">admin@auramed.com</code> or <code className="rounded bg-purple-100 px-1.5 py-0.5 font-mono font-bold text-purple-900">123</code>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <TextField
              id="email"
              label="Administrator ID"
              value={form.email}
              onChange={updateField('email')}
              error={errors.email}
              autoComplete="username"
              placeholder="admin@auramed.com"
            />
            <PasswordField
              id="password"
              label="Password"
              value={form.password}
              onChange={updateField('password')}
              error={errors.password}
            />

            {apiError && (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{apiError}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              <ShieldCheck size={16} />
              {loading ? 'Signing in…' : 'Secure Login'}
            </button>
          </form>

          <div className="mt-6 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5 text-xs text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            Restricted access. Unauthorized attempts to access this system are prohibited.
          </div>

          <p className="mt-6 text-center text-xs text-primary/40">
            All access to this portal is logged and monitored.
          </p>
        </div>
      </div>
    </div>
  )
}

export default AdminLoginPage
