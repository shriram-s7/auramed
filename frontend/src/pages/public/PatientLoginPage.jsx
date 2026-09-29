import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import AuthSidePanel from '../../components/common/AuthSidePanel'
import TextField from '../../components/common/TextField'
import PasswordField from '../../components/common/PasswordField'
import { useAuth } from '../../context/AuthContext'

function validate(form) {
  const errors = {}
  if (!form.identifier.trim()) errors.identifier = 'Patient ID or email is required'
  if (!form.password) errors.password = 'Password is required'
  return errors
}

function PatientLoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

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
      await login('patient', form)
      navigate('/patient/dashboard')
    } catch (err) {
      setApiError(err.response?.data?.detail || 'Unable to log in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AuthSidePanel
        variant="light"
        badge="For Patients"
        headline="Your Screening Journey, All in One Place"
        bullets={[
          'View your reports as soon as your doctor shares them',
          'Track appointments and follow-ups',
          'See your screening history over time',
        ]}
        quote="“Knowing where things stand, in plain language, made all the difference.”"
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

          <h1 className="mt-4 text-2xl font-bold text-primary lg:mt-0">Patient Login</h1>
          <p className="mt-1 text-sm text-primary/60">Sign in to view your reports and appointments.</p>

          {/* Quick Demo Fill Card */}
          <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/80 p-3 text-xs text-teal-900 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1 text-teal-800">
                ⚡ Quick Test Mode
              </span>
              <button
                type="button"
                onClick={() => {
                  setForm({ identifier: 'anita@auramed.com', password: '123' })
                  setErrors({})
                }}
                className="rounded-md bg-teal-700 px-2.5 py-1 text-xs font-semibold text-white shadow hover:bg-teal-800 transition"
              >
                1-Click Auto Fill
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-teal-700">
              Test password: <code className="rounded bg-teal-100 px-1.5 py-0.5 font-mono font-bold text-teal-900">123</code> &bull; ID: <code className="rounded bg-teal-100 px-1.5 py-0.5 font-mono font-bold text-teal-900">anita@auramed.com</code> or <code className="rounded bg-teal-100 px-1.5 py-0.5 font-mono font-bold text-teal-900">123</code>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <TextField
              id="identifier"
              label="Patient ID or Email"
              value={form.identifier}
              onChange={updateField('identifier')}
              error={errors.identifier}
              autoComplete="username"
              placeholder="P-2026-0001"
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
              className="flex w-full items-center justify-center gap-2 rounded-md bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
            >
              <ShieldCheck size={16} />
              {loading ? 'Signing in…' : 'Login'}
            </button>

            <button
              type="button"
              disabled
              title="Coming soon"
              className="w-full cursor-not-allowed rounded-md border border-border py-2.5 text-sm font-medium text-primary/40"
            >
              Continue with Google
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-primary/50">
            Don&rsquo;t have an account?{' '}
            <button type="button" onClick={() => setInfoOpen(true)} className="text-accent hover:underline">
              Register as a Patient
            </button>
          </p>
        </div>
      </div>

      {infoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setInfoOpen(false)}
        >
          <div className="max-w-sm rounded-xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-primary">How patient accounts work</h3>
            <p className="mt-2 text-sm text-primary/60">
              Patient accounts on AuraMed are created by your doctor during your first visit. Your
              doctor will give you a Patient ID and a temporary password so you can log in and
              view your reports.
            </p>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              className="mt-5 w-full rounded-md bg-primary py-2 text-sm font-semibold text-white"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default PatientLoginPage
