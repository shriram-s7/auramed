import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck, Info, ArrowLeft } from 'lucide-react'
import AuthSidePanel from '../../components/common/AuthSidePanel'
import TextField from '../../components/common/TextField'
import PasswordField from '../../components/common/PasswordField'
import { useAuth } from '../../context/AuthContext'

function validate(form) {
  const errors = {}
  if (!form.identifier.trim()) errors.identifier = 'Email or Doctor ID is required'
  if (!form.password) errors.password = 'Password is required'
  if (!form.registrationNumber.trim()) errors.registrationNumber = 'Registration number is required'
  return errors
}

function DoctorLoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ identifier: '', password: '', registrationNumber: '', remember: false })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoToast, setSsoToast] = useState(false)

  function updateField(field) {
    return (e) => {
      const value = field === 'remember' ? e.target.checked : e.target.value
      setForm((f) => ({ ...f, [field]: value }))
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
      await login('doctor', form)
      navigate('/doctor/dashboard')
    } catch (err) {
      setApiError(err.response?.data?.detail || 'Unable to log in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleSsoClick() {
    setSsoToast(true)
    setTimeout(() => setSsoToast(false), 2500)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AuthSidePanel
        variant="navy"
        badge="For Clinicians"
        headline="Empowering Clinicians for Healthier Tomorrows"
        bullets={['AI-Powered Insights', 'Secure and Compliant', 'Better Patient Outcomes']}
        quote="“AuraMed gives our screening team a second, consistent opinion on every case.”"
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

          <h1 className="mt-4 text-2xl font-bold text-primary lg:mt-0">Doctor Login</h1>
          <p className="mt-1 text-sm text-primary/60">Sign in to access your clinical workspace.</p>

          {/* Quick Demo Fill Card */}
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1 text-blue-800">
                ⚡ Quick Test Mode
              </span>
              <button
                type="button"
                onClick={() => {
                  setForm({ identifier: 'dr.mehta@auramed.com', registrationNumber: '123', password: '123', remember: false })
                  setErrors({})
                }}
                className="rounded-md bg-blue-700 px-2.5 py-1 text-xs font-semibold text-white shadow hover:bg-blue-800 transition"
              >
                1-Click Auto Fill
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-blue-700">
              Test password: <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono font-bold text-blue-900">123</code> &bull; Reg: <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono font-bold text-blue-900">123</code> &bull; ID: <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono font-bold text-blue-900">dr.mehta@auramed.com</code>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <TextField
              id="identifier"
              label="Email or Doctor ID"
              value={form.identifier}
              onChange={updateField('identifier')}
              error={errors.identifier}
              autoComplete="username"
            />
            <PasswordField
              id="password"
              label="Password"
              value={form.password}
              onChange={updateField('password')}
              error={errors.password}
            />
            <TextField
              id="registrationNumber"
              label="Registration Number (MCI/NMC)"
              value={form.registrationNumber}
              onChange={updateField('registrationNumber')}
              error={errors.registrationNumber}
            />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-primary/70">
                <input
                  type="checkbox"
                  checked={form.remember}
                  onChange={updateField('remember')}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
                Remember me
              </label>
              <Link to="#" className="text-accent hover:underline">
                Forgot password?
              </Link>
            </div>

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

            <button
              type="button"
              onClick={handleSsoClick}
              className="w-full rounded-md border border-border py-2.5 text-sm font-medium text-primary hover:border-accent"
            >
              Continue with Hospital SSO
            </button>
            {ssoToast && (
              <p className="rounded-md bg-primary/5 px-3 py-2 text-center text-xs text-primary/70">
                Hospital SSO is coming soon.
              </p>
            )}
          </form>

          <div className="mt-6 flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-800">
            <Info size={16} className="mt-0.5 shrink-0" />
            Restricted access. This portal is for verified, admin-approved clinicians only.
          </div>

          <div className="mt-6 flex justify-between text-xs text-primary/50">
            <Link to="#" className="hover:text-accent">
              Need help?
            </Link>
            <Link to="/register/doctor" className="hover:text-accent">
              Request Access
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DoctorLoginPage
