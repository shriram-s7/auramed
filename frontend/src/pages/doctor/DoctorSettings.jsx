import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronRight,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileCheck,
  FileText,
  Globe,
  Info,
  Key,
  Layers,
  Lock,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  Save,
  Scan,
  Send,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2,
  User,
  Users,
  XCircle,
} from 'lucide-react'
import InitialsAvatar from '../../components/common/InitialsAvatar'
import {
  fetchDoctorSettings,
  updateDoctorSettings,
  changeDoctorPassword,
  revokeSession,
  revokeAllOtherSessions,
  exportDoctorData,
  deactivateDoctorAccount,
} from '../../services/settingsService'

export default function DoctorSettings() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('profile') // profile | notifications | clinical | security | privacy
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null) // { type: 'success' | 'error', message: '' }

  // Settings Data
  const [profile, setProfile] = useState({
    full_name: '',
    registration_number: '',
    specialty: 'Radiology',
    hospital: '',
    phone: '',
    email: '',
    address: '',
  })
  const [accountInfo, setAccountInfo] = useState({
    doctor_id: '',
    account_created: '',
    last_login: '',
    account_status: 'Verified',
    verified_on: '',
  })
  const [notifications, setNotifications] = useState({
    email: {
      new_patient_assigned: true,
      scan_analysis_completed: true,
      report_ready_for_review: true,
      followup_appointment_due: true,
      followup_days_before: 2,
      patient_viewed_report: true,
      referral_status_updated: true,
      system_maintenance_alerts: true,
      new_guidelines_uploaded: false,
    },
    in_app: {
      new_patient_assigned: true,
      scan_analysis_completed: true,
      report_ready_for_review: true,
      followup_appointment_due: true,
      followup_days_before: 2,
      patient_viewed_report: true,
      referral_status_updated: true,
      system_maintenance_alerts: true,
      new_guidelines_uploaded: true,
    },
    frequency: {
      digest: 'realtime',
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
    },
  })
  const [clinicalPrefs, setClinicalPrefs] = useState({
    default_scan_settings: {
      image_quality_threshold: 'Adequate',
      followup_intervals: {
        critical_risk: { value: 2, unit: 'days' },
        high_risk: { value: 1, unit: 'weeks' },
        moderate_risk: { value: 4, unit: 'weeks' },
        low_risk: { value: 6, unit: 'months' },
      },
    },
    report_preferences: {
      default_template: 'Comprehensive Oncological Screening Report',
      auto_include_ai_analysis: true,
      auto_include_reference_ranges: true,
      auto_include_disclaimers: true,
      digital_signature_style: 'Dr. [Full Name]',
    },
    display_preferences: {
      default_workbench_module: 'breast',
      results_page_layout: 'Detailed',
      date_format: 'DD/MM/YYYY',
      time_format: '12 hour',
    },
  })
  const [securityData, setSecurityData] = useState({
    two_factor_enabled: false,
    active_sessions: [],
    login_history: [],
  })
  const [privacyData, setPrivacyData] = useState({
    allow_anonymized_data: true,
    receive_product_updates: true,
    is_deactivated: false,
  })

  // Form errors
  const [profileErrors, setProfileErrors] = useState({})

  // Password Change State
  const [pwForm, setPwForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  // 2FA Modal
  const [show2FAModal, setShow2FAModal] = useState(false)

  // Deactivate Modal
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  // Fetch Settings on Mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await fetchDoctorSettings()
      if (res.data) {
        setProfile(res.data.profile || {})
        setAccountInfo(res.data.account_info || {})
        if (res.data.notifications) setNotifications(res.data.notifications)
        if (res.data.clinical_preferences) setClinicalPrefs(res.data.clinical_preferences)
        if (res.data.security) setSecurityData(res.data.security)
        if (res.data.privacy_data) setPrivacyData(res.data.privacy_data)
      }
    } catch (err) {
      console.error('Failed to load doctor settings:', err)
      showToast('error', 'Failed to load settings. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => {
      setToast(null)
    }, 4000)
  }

  // Handle Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    const errors = {}
    if (!profile.full_name?.trim()) errors.full_name = 'Full name is required.'
    if (!profile.email?.trim()) errors.email = 'Email address is required.'
    if (profile.phone && !/^[+0-9\s-]{8,20}$/.test(profile.phone)) {
      errors.phone = 'Please enter a valid phone number.'
    }
    setProfileErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    try {
      await updateDoctorSettings({ profile })
      showToast('success', 'Profile and account details saved successfully.')
    } catch (err) {
      console.error('Error saving profile:', err)
      showToast('error', err.response?.data?.detail || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  // Handle Save Notifications
  const handleSaveNotifications = async () => {
    setSaving(true)
    try {
      await updateDoctorSettings({ notifications })
      showToast('success', 'Notification preferences saved successfully.')
    } catch (err) {
      console.error('Error saving notifications:', err)
      showToast('error', 'Failed to save notification preferences.')
    } finally {
      setSaving(false)
    }
  }

  // Handle Save Clinical Preferences
  const handleSaveClinicalPrefs = async () => {
    setSaving(true)
    try {
      await updateDoctorSettings({ clinical_preferences: clinicalPrefs })
      showToast('success', 'Clinical preferences saved successfully.')
    } catch (err) {
      console.error('Error saving clinical preferences:', err)
      showToast('error', 'Failed to save clinical preferences.')
    } finally {
      setSaving(false)
    }
  }

  // Handle Save Privacy
  const handleSavePrivacy = async (updatedPrivacy) => {
    setSaving(true)
    try {
      await updateDoctorSettings({ privacy_data: updatedPrivacy })
      setPrivacyData(updatedPrivacy)
      showToast('success', 'Privacy preferences updated.')
    } catch (err) {
      console.error('Error saving privacy preferences:', err)
      showToast('error', 'Failed to update privacy preferences.')
    } finally {
      setSaving(false)
    }
  }

  // Password Strength Calculation
  const pwMetrics = {
    length: pwForm.new_password.length >= 8,
    upper: /[A-Z]/.test(pwForm.new_password),
    number: /[0-9]/.test(pwForm.new_password),
    special: /[^A-Za-z0-9]/.test(pwForm.new_password),
  }
  const pwScore = Object.values(pwMetrics).filter(Boolean).length

  // Handle Change Password
  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault()
    setPwError('')
    if (!pwForm.current_password) {
      setPwError('Current password is required.')
      return
    }
    if (pwScore < 4) {
      setPwError('New password must satisfy all 4 security criteria below.')
      return
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError('New password and confirm password do not match.')
      return
    }

    setPwSaving(true)
    try {
      await changeDoctorPassword({
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      })
      showToast('success', 'Password changed successfully.')
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      console.error('Change password failed:', err)
      setPwError(err.response?.data?.detail || 'Failed to update password.')
    } finally {
      setPwSaving(false)
    }
  }

  // Handle Session Revocation
  const handleRevokeSession = async (sessionId) => {
    try {
      const res = await revokeSession(sessionId)
      setSecurityData((prev) => ({
        ...prev,
        active_sessions: res.data.active_sessions || prev.active_sessions.filter((s) => s.id !== sessionId),
      }))
      showToast('success', 'Session revoked.')
    } catch (err) {
      console.error('Revoke session failed:', err)
      showToast('error', 'Could not revoke session.')
    }
  }

  const handleRevokeAllOtherSessions = async () => {
    try {
      const res = await revokeAllOtherSessions()
      setSecurityData((prev) => ({
        ...prev,
        active_sessions: res.data.active_sessions || prev.active_sessions.filter((s) => s.is_current),
      }))
      showToast('success', 'All other active sessions have been terminated.')
    } catch (err) {
      console.error('Revoke all failed:', err)
      showToast('error', 'Could not revoke sessions.')
    }
  }

  // Handle Export Data
  const handleExportData = async () => {
    try {
      showToast('success', 'Generating full account and clinical activity archive...')
      const res = await exportDoctorData()
      const blob = new Blob([res.data], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `auramed_doctor_archive_${new Date().toISOString().slice(0, 10)}.json`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      console.error('Export failed:', err)
      showToast('error', 'Data export failed. Please try again.')
    }
  }

  // Handle Account Deactivation
  const handleDeactivate = async () => {
    setDeactivating(true)
    try {
      await deactivateDoctorAccount()
      setShowDeactivateModal(false)
      alert('Account deactivated. You will now be redirected to the login page.')
      navigate('/login/doctor')
    } catch (err) {
      console.error('Deactivation failed:', err)
      showToast('error', 'Deactivation failed. Please contact admin.')
    } finally {
      setDeactivating(false)
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile and Account', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'clinical', label: 'Clinical Preferences', icon: Sliders },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'privacy', label: 'Privacy and Data', icon: Key },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold animate-in fade-in slide-in-from-top-3 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-rose-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* PAGE HEADER */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Settings</h1>
        <p className="mt-1 text-sm text-primary/60">
          Manage your account, preferences, and security settings.
        </p>
      </div>

      {/* MAIN LAYOUT: VERTICAL TABS (LEFT) + TAB CONTENT (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT VERTICAL TAB NAVIGATION */}
        <div className="lg:col-span-3 rounded-2xl border border-border bg-surface p-2 shadow-xs space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                  isActive
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-primary/70 hover:bg-background hover:text-primary'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-white' : 'text-primary/50'} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* RIGHT CONTENT AREA */}
        <div className="lg:col-span-9 space-y-6">
          {loading ? (
            <div className="rounded-2xl border border-border bg-surface p-12 text-center text-primary/40 space-y-3">
              <RefreshCw size={24} className="animate-spin mx-auto text-accent" />
              <p className="text-sm font-medium">Loading settings...</p>
            </div>
          ) : (
            <>
              {/* ============================================================== */}
              {/* TAB 1: PROFILE AND ACCOUNT */}
              {/* ============================================================== */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  {/* Section 1: Profile Information Form */}
                  <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                      <div>
                        <h2 className="text-base font-bold text-primary">Profile Information</h2>
                        <p className="text-xs text-primary/50">
                          Update your personal and professional clinician information.
                        </p>
                      </div>

                      {/* Profile Photo / Initials Avatar Circle (Not photo upload) */}
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={profile.full_name || 'Dr. Mehta'} size={48} />
                        <div>
                          <p className="text-xs font-bold text-primary leading-tight">Clinician Avatar</p>
                          <p className="text-[11px] text-primary/50 leading-tight">
                            Your avatar is generated from your initials.
                          </p>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleSaveProfile} className="space-y-4" noValidate>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        {/* Full Name */}
                        <div>
                          <label className="font-semibold text-primary block mb-1.5">Full Name</label>
                          <input
                            type="text"
                            value={profile.full_name || ''}
                            onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                            className={`w-full rounded-xl border bg-background px-3.5 py-2 text-xs font-medium text-primary outline-none transition focus:ring-2 focus:ring-accent/40 ${
                              profileErrors.full_name ? 'border-rose-400' : 'border-border'
                            }`}
                            placeholder="Dr. Kavitha Mehta"
                          />
                          {profileErrors.full_name && (
                            <p className="mt-1 text-[11px] text-rose-500">{profileErrors.full_name}</p>
                          )}
                        </div>

                        {/* Registration Number (Read Only + Lock Icon) */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="font-semibold text-primary flex items-center gap-1">
                              <span>Registration Number</span>
                              <Lock size={12} className="text-primary/40" />
                            </label>
                            <span
                              className="text-[10px] text-primary/40 cursor-help underline decoration-dotted"
                              title="Contact admin to update registration number"
                            >
                              Contact admin to update
                            </span>
                          </div>
                          <input
                            type="text"
                            readOnly
                            disabled
                            value={profile.registration_number || 'TNMC123456'}
                            className="w-full rounded-xl border border-border/80 bg-slate-100/70 px-3.5 py-2 text-xs font-mono font-medium text-primary/60 cursor-not-allowed"
                          />
                        </div>

                        {/* Specialty Dropdown */}
                        <div>
                          <label className="font-semibold text-primary block mb-1.5">Specialty</label>
                          <select
                            value={profile.specialty || 'Radiology'}
                            onChange={(e) => setProfile({ ...profile, specialty: e.target.value })}
                            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-primary outline-none transition focus:ring-2 focus:ring-accent/40"
                          >
                            <option value="Radiology">Radiology</option>
                            <option value="Gynecology">Gynecology</option>
                            <option value="Oncology">Oncology</option>
                            <option value="Internal Medicine">Internal Medicine</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        {/* Hospital / Institution */}
                        <div>
                          <label className="font-semibold text-primary block mb-1.5">Hospital / Institution</label>
                          <input
                            type="text"
                            value={profile.hospital || ''}
                            onChange={(e) => setProfile({ ...profile, hospital: e.target.value })}
                            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-primary outline-none transition focus:ring-2 focus:ring-accent/40"
                            placeholder="Apollo Cancer Centre, Chennai"
                          />
                        </div>

                        {/* Phone Number */}
                        <div>
                          <label className="font-semibold text-primary block mb-1.5">Phone Number</label>
                          <input
                            type="tel"
                            value={profile.phone || ''}
                            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                            className={`w-full rounded-xl border bg-background px-3.5 py-2 text-xs font-medium text-primary outline-none transition focus:ring-2 focus:ring-accent/40 ${
                              profileErrors.phone ? 'border-rose-400' : 'border-border'
                            }`}
                            placeholder="+91 98401 23456"
                          />
                          {profileErrors.phone && (
                            <p className="mt-1 text-[11px] text-rose-500">{profileErrors.phone}</p>
                          )}
                        </div>

                        {/* Email Address */}
                        <div>
                          <label className="font-semibold text-primary block mb-1.5">Email Address</label>
                          <input
                            type="email"
                            value={profile.email || ''}
                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                            className={`w-full rounded-xl border bg-background px-3.5 py-2 text-xs font-medium text-primary outline-none transition focus:ring-2 focus:ring-accent/40 ${
                              profileErrors.email ? 'border-rose-400' : 'border-border'
                            }`}
                            placeholder="dr.mehta@auramed.com"
                          />
                          {profileErrors.email && (
                            <p className="mt-1 text-[11px] text-rose-500">{profileErrors.email}</p>
                          )}
                        </div>

                        {/* Address (Full Span) */}
                        <div className="sm:col-span-2">
                          <label className="font-semibold text-primary block mb-1.5">Clinic / Hospital Address</label>
                          <input
                            type="text"
                            value={profile.address || ''}
                            onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-primary outline-none transition focus:ring-2 focus:ring-accent/40"
                            placeholder="Suite 402, Clinical Diagnostic Wing, Chennai, Tamil Nadu"
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={saving}
                          className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50 transition shadow-xs"
                        >
                          <Save size={14} />
                          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Section 2: Account Information (Read Only Display) */}
                  <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
                    <div className="border-b border-border pb-3">
                      <h2 className="text-base font-bold text-primary">Account Information</h2>
                      <p className="text-xs text-primary/50">
                        Official registration, licensing, and access parameters.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
                      <div className="p-3 bg-background rounded-xl border border-border/80">
                        <p className="text-[11px] text-primary/50 font-medium">Doctor ID</p>
                        <p className="text-xs font-mono font-bold text-primary mt-0.5">{accountInfo.doctor_id || 'DOC-2026-0891'}</p>
                      </div>

                      <div className="p-3 bg-background rounded-xl border border-border/80">
                        <p className="text-[11px] text-primary/50 font-medium">Account Created</p>
                        <p className="text-xs font-bold text-primary mt-0.5">{accountInfo.account_created || 'Jan 15, 2026'}</p>
                      </div>

                      <div className="p-3 bg-background rounded-xl border border-border/80">
                        <p className="text-[11px] text-primary/50 font-medium">Last Login</p>
                        <p className="text-xs font-bold text-primary mt-0.5">{accountInfo.last_login || 'Today, 08:30 AM'}</p>
                      </div>

                      <div className="p-3 bg-background rounded-xl border border-border/80">
                        <p className="text-[11px] text-primary/50 font-medium">Account Status</p>
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={11} />
                          <span>Verified</span>
                        </span>
                      </div>

                      <div className="p-3 bg-background rounded-xl border border-border/80">
                        <p className="text-[11px] text-primary/50 font-medium">Verified On</p>
                        <p className="text-xs font-bold text-primary mt-0.5">{accountInfo.verified_on || 'Jan 16, 2026'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 2: NOTIFICATIONS */}
              {/* ============================================================== */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  {/* Email Notifications */}
                  <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
                    <div className="border-b border-border pb-3">
                      <h2 className="text-base font-bold text-primary">Email Notifications</h2>
                      <p className="text-xs text-primary/50">
                        Choose which clinical and patient milestones trigger direct email alerts.
                      </p>
                    </div>

                    <div className="divide-y divide-border/60 text-xs">
                      {[
                        { key: 'new_patient_assigned', label: 'New patient assigned to you', desc: 'When a new patient is registered under your clinical workspace' },
                        { key: 'scan_analysis_completed', label: 'Scan analysis completed', desc: 'AI multimodality segmentation and risk prediction completes' },
                        { key: 'report_ready_for_review', label: 'Report ready for review', desc: 'When draft screening reports are generated and awaiting sign-off' },
                        {
                          key: 'followup_appointment_due',
                          label: 'Follow-up appointment due',
                          desc: 'Reminder before scheduled patient follow-up',
                          hasDropdown: true,
                        },
                        { key: 'patient_viewed_report', label: 'Patient viewed their report', desc: 'Alert when a patient accesses shared report via patient portal' },
                        { key: 'referral_status_updated', label: 'Referral status updated', desc: 'Specialist confirms receipt or signs consultation notes' },
                        { key: 'system_maintenance_alerts', label: 'System maintenance alerts', desc: 'Scheduled maintenance windows and platform upgrades' },
                        { key: 'new_guidelines_uploaded', label: 'New guidelines uploaded', desc: 'Updated clinical protocols or WHO/NCCN screening recommendations' },
                      ].map((item) => (
                        <div key={item.key} className="py-3 flex items-center justify-between gap-4">
                          <div className="pr-4">
                            <p className="font-semibold text-primary">{item.label}</p>
                            <p className="text-[11px] text-primary/50 mt-0.5">{item.desc}</p>
                            {item.hasDropdown && notifications.email[item.key] && (
                              <div className="mt-2 flex items-center gap-2 text-xs">
                                <span className="text-primary/60 font-medium">Remind me:</span>
                                <select
                                  value={notifications.email.followup_days_before}
                                  onChange={(e) =>
                                    setNotifications({
                                      ...notifications,
                                      email: { ...notifications.email, followup_days_before: Number(e.target.value) },
                                    })
                                  }
                                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold text-primary outline-none"
                                >
                                  <option value={1}>1 day before</option>
                                  <option value={2}>2 days before</option>
                                  <option value={3}>3 days before</option>
                                  <option value={7}>7 days before</option>
                                </select>
                              </div>
                            )}
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={!!notifications.email[item.key]}
                              onChange={(e) =>
                                setNotifications({
                                  ...notifications,
                                  email: { ...notifications.email, [item.key]: e.target.checked },
                                })
                              }
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* In-App Notifications */}
                  <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
                    <div className="border-b border-border pb-3">
                      <h2 className="text-base font-bold text-primary">In-App Notifications</h2>
                      <p className="text-xs text-primary/50">
                        Populate topbar bell notifications while using the clinician workbench.
                      </p>
                    </div>

                    <div className="divide-y divide-border/60 text-xs">
                      {[
                        { key: 'new_patient_assigned', label: 'New patient assigned to you' },
                        { key: 'scan_analysis_completed', label: 'Scan analysis completed' },
                        { key: 'report_ready_for_review', label: 'Report ready for review' },
                        { key: 'followup_appointment_due', label: 'Follow-up appointment due' },
                        { key: 'patient_viewed_report', label: 'Patient viewed their report' },
                        { key: 'referral_status_updated', label: 'Referral status updated' },
                        { key: 'system_maintenance_alerts', label: 'System maintenance alerts' },
                        { key: 'new_guidelines_uploaded', label: 'New guidelines uploaded' },
                      ].map((item) => (
                        <div key={item.key} className="py-2.5 flex items-center justify-between gap-4">
                          <span className="font-semibold text-primary">{item.label}</span>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={!!notifications.in_app[item.key]}
                              onChange={(e) =>
                                setNotifications({
                                  ...notifications,
                                  in_app: { ...notifications.in_app, [item.key]: e.target.checked },
                                })
                              }
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notification Frequency & Quiet Hours */}
                  <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
                    <div className="border-b border-border pb-3">
                      <h2 className="text-base font-bold text-primary">Notification Frequency & Quiet Hours</h2>
                      <p className="text-xs text-primary/50">
                        Control batching intervals and mute notifications outside duty hours.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="font-semibold text-primary block mb-1.5">Digest Emails</label>
                        <select
                          value={notifications.frequency?.digest || 'realtime'}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              frequency: { ...notifications.frequency, digest: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-primary outline-none focus:ring-2 focus:ring-accent/40"
                        >
                          <option value="realtime">Real-time (Immediate notification)</option>
                          <option value="daily">Daily Digest (Consolidated morning summary)</option>
                          <option value="weekly">Weekly Digest (Monday morning overview)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-semibold text-primary">Enable Quiet Hours</label>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!notifications.frequency?.quiet_hours_enabled}
                              onChange={(e) =>
                                setNotifications({
                                  ...notifications,
                                  frequency: { ...notifications.frequency, quiet_hours_enabled: e.target.checked },
                                })
                              }
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                          </label>
                        </div>
                        {notifications.frequency?.quiet_hours_enabled && (
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="time"
                              value={notifications.frequency.quiet_hours_start}
                              onChange={(e) =>
                                setNotifications({
                                  ...notifications,
                                  frequency: { ...notifications.frequency, quiet_hours_start: e.target.value },
                                })
                              }
                              className="w-1/2 rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs text-primary font-mono"
                            />
                            <span className="text-primary/40 font-medium">to</span>
                            <input
                              type="time"
                              value={notifications.frequency.quiet_hours_end}
                              onChange={(e) =>
                                setNotifications({
                                  ...notifications,
                                  frequency: { ...notifications.frequency, quiet_hours_end: e.target.value },
                                })
                              }
                              className="w-1/2 rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs text-primary font-mono"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveNotifications}
                        disabled={saving}
                        className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50 transition shadow-xs"
                      >
                        <Save size={14} />
                        <span>{saving ? 'Saving...' : 'Save Notification Preferences'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 3: CLINICAL PREFERENCES */}
              {/* ============================================================== */}
              {activeTab === 'clinical' && (
                <div className="space-y-6">
                  {/* Default Scan Settings */}
                  <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
                    <div className="border-b border-border pb-3">
                      <h2 className="text-base font-bold text-primary">Default Scan Settings</h2>
                      <p className="text-xs text-primary/50">
                        Configure baseline threshold warnings and default follow-up schedules.
                      </p>
                    </div>

                    <div className="space-y-4 text-xs">
                      <div>
                        <label className="font-semibold text-primary block mb-1.5">
                          Default Image Quality Threshold (warn if below):
                        </label>
                        <select
                          value={clinicalPrefs.default_scan_settings.image_quality_threshold}
                          onChange={(e) =>
                            setClinicalPrefs({
                              ...clinicalPrefs,
                              default_scan_settings: {
                                ...clinicalPrefs.default_scan_settings,
                                image_quality_threshold: e.target.value,
                              },
                            })
                          }
                          className="w-full sm:w-72 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-primary outline-none"
                        >
                          <option value="Good">Good (Strict clinical resolution)</option>
                          <option value="Adequate">Adequate (Standard threshold)</option>
                          <option value="Poor">Poor (Flag severe artifacts only)</option>
                        </select>
                      </div>

                      <div className="pt-2">
                        <label className="font-semibold text-primary block mb-2">
                          Default Follow-up Intervals per Risk Level:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Critical */}
                          <div className="p-3 bg-background rounded-xl border border-border flex items-center justify-between">
                            <span className="font-bold text-rose-700">Critical Risk</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                max={60}
                                value={clinicalPrefs.default_scan_settings.followup_intervals.critical_risk.value}
                                onChange={(e) =>
                                  setClinicalPrefs({
                                    ...clinicalPrefs,
                                    default_scan_settings: {
                                      ...clinicalPrefs.default_scan_settings,
                                      followup_intervals: {
                                        ...clinicalPrefs.default_scan_settings.followup_intervals,
                                        critical_risk: {
                                          ...clinicalPrefs.default_scan_settings.followup_intervals.critical_risk,
                                          value: Number(e.target.value),
                                        },
                                      },
                                    },
                                  })
                                }
                                className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-center font-bold text-xs"
                              />
                              <select
                                value={clinicalPrefs.default_scan_settings.followup_intervals.critical_risk.unit}
                                onChange={(e) =>
                                  setClinicalPrefs({
                                    ...clinicalPrefs,
                                    default_scan_settings: {
                                      ...clinicalPrefs.default_scan_settings,
                                      followup_intervals: {
                                        ...clinicalPrefs.default_scan_settings.followup_intervals,
                                        critical_risk: {
                                          ...clinicalPrefs.default_scan_settings.followup_intervals.critical_risk,
                                          unit: e.target.value,
                                        },
                                      },
                                    },
                                  })
                                }
                                className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                              >
                                <option value="days">days</option>
                                <option value="weeks">weeks</option>
                              </select>
                            </div>
                          </div>

                          {/* High */}
                          <div className="p-3 bg-background rounded-xl border border-border flex items-center justify-between">
                            <span className="font-bold text-orange-700">High Risk</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                max={60}
                                value={clinicalPrefs.default_scan_settings.followup_intervals.high_risk.value}
                                onChange={(e) =>
                                  setClinicalPrefs({
                                    ...clinicalPrefs,
                                    default_scan_settings: {
                                      ...clinicalPrefs.default_scan_settings,
                                      followup_intervals: {
                                        ...clinicalPrefs.default_scan_settings.followup_intervals,
                                        high_risk: {
                                          ...clinicalPrefs.default_scan_settings.followup_intervals.high_risk,
                                          value: Number(e.target.value),
                                        },
                                      },
                                    },
                                  })
                                }
                                className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-center font-bold text-xs"
                              />
                              <select
                                value={clinicalPrefs.default_scan_settings.followup_intervals.high_risk.unit}
                                onChange={(e) =>
                                  setClinicalPrefs({
                                    ...clinicalPrefs,
                                    default_scan_settings: {
                                      ...clinicalPrefs.default_scan_settings,
                                      followup_intervals: {
                                        ...clinicalPrefs.default_scan_settings.followup_intervals,
                                        high_risk: {
                                          ...clinicalPrefs.default_scan_settings.followup_intervals.high_risk,
                                          unit: e.target.value,
                                        },
                                      },
                                    },
                                  })
                                }
                                className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                              >
                                <option value="days">days</option>
                                <option value="weeks">weeks</option>
                              </select>
                            </div>
                          </div>

                          {/* Moderate */}
                          <div className="p-3 bg-background rounded-xl border border-border flex items-center justify-between">
                            <span className="font-bold text-amber-700">Moderate Risk</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                max={60}
                                value={clinicalPrefs.default_scan_settings.followup_intervals.moderate_risk.value}
                                onChange={(e) =>
                                  setClinicalPrefs({
                                    ...clinicalPrefs,
                                    default_scan_settings: {
                                      ...clinicalPrefs.default_scan_settings,
                                      followup_intervals: {
                                        ...clinicalPrefs.default_scan_settings.followup_intervals,
                                        moderate_risk: {
                                          ...clinicalPrefs.default_scan_settings.followup_intervals.moderate_risk,
                                          value: Number(e.target.value),
                                        },
                                      },
                                    },
                                  })
                                }
                                className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-center font-bold text-xs"
                              />
                              <select
                                value={clinicalPrefs.default_scan_settings.followup_intervals.moderate_risk.unit}
                                onChange={(e) =>
                                  setClinicalPrefs({
                                    ...clinicalPrefs,
                                    default_scan_settings: {
                                      ...clinicalPrefs.default_scan_settings,
                                      followup_intervals: {
                                        ...clinicalPrefs.default_scan_settings.followup_intervals,
                                        moderate_risk: {
                                          ...clinicalPrefs.default_scan_settings.followup_intervals.moderate_risk,
                                          unit: e.target.value,
                                        },
                                      },
                                    },
                                  })
                                }
                                className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                              >
                                <option value="days">days</option>
                                <option value="weeks">weeks</option>
                              </select>
                            </div>
                          </div>

                          {/* Low */}
                          <div className="p-3 bg-background rounded-xl border border-border flex items-center justify-between">
                            <span className="font-bold text-emerald-700">Low Risk</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                max={24}
                                value={clinicalPrefs.default_scan_settings.followup_intervals.low_risk.value}
                                onChange={(e) =>
                                  setClinicalPrefs({
                                    ...clinicalPrefs,
                                    default_scan_settings: {
                                      ...clinicalPrefs.default_scan_settings,
                                      followup_intervals: {
                                        ...clinicalPrefs.default_scan_settings.followup_intervals,
                                        low_risk: {
                                          ...clinicalPrefs.default_scan_settings.followup_intervals.low_risk,
                                          value: Number(e.target.value),
                                        },
                                      },
                                    },
                                  })
                                }
                                className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-center font-bold text-xs"
                              />
                              <span className="text-xs text-primary/70 font-semibold px-2">months</span>
                            </div>
                          </div>
                        </div>

                        <p className="mt-2 text-[11px] text-primary/50 italic">
                          Note: These are your personal defaults. You can always override per patient during report finalization.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Report Preferences */}
                  <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
                    <div className="border-b border-border pb-3">
                      <h2 className="text-base font-bold text-primary">Report Preferences</h2>
                      <p className="text-xs text-primary/50">
                        Default templates and auto-included attachments for generated diagnostic reports.
                      </p>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="font-semibold text-primary block mb-1.5">Default Report Template</label>
                        <select
                          value={clinicalPrefs.report_preferences.default_template}
                          onChange={(e) =>
                            setClinicalPrefs({
                              ...clinicalPrefs,
                              report_preferences: { ...clinicalPrefs.report_preferences, default_template: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-primary outline-none"
                        >
                          <option value="Comprehensive Oncological Screening Report">Comprehensive Oncological Screening Report</option>
                          <option value="BI-RADS Standard Diagnostic Format">BI-RADS Standard Diagnostic Format</option>
                          <option value="Executive Summary Layout">Executive Summary Layout</option>
                        </select>
                      </div>

                      <div className="divide-y divide-border/60 pt-2">
                        {[
                          { key: 'auto_include_ai_analysis', label: 'Auto-include AI analysis details', desc: 'Include model confidence, heatmap coordinates, and feature attribution in final report' },
                          { key: 'auto_include_reference_ranges', label: 'Auto-include reference ranges', desc: 'Include biomarker reference bounds and clinical validation standard citations' },
                          { key: 'auto_include_disclaimers', label: 'Auto-include disclaimers', desc: 'Include statutory regulatory and SaMD diagnostic disclaimer notes' },
                        ].map((pref) => (
                          <div key={pref.key} className="py-2.5 flex items-center justify-between gap-4">
                            <div>
                              <p className="font-semibold text-primary">{pref.label}</p>
                              <p className="text-[11px] text-primary/50">{pref.desc}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                checked={!!clinicalPrefs.report_preferences[pref.key]}
                                onChange={(e) =>
                                  setClinicalPrefs({
                                    ...clinicalPrefs,
                                    report_preferences: {
                                      ...clinicalPrefs.report_preferences,
                                      [pref.key]: e.target.checked,
                                    },
                                  })
                                }
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                            </label>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2">
                        <label className="font-semibold text-primary block mb-1.5">Digital Signature Style</label>
                        <select
                          value={clinicalPrefs.report_preferences.digital_signature_style}
                          onChange={(e) =>
                            setClinicalPrefs({
                              ...clinicalPrefs,
                              report_preferences: {
                                ...clinicalPrefs.report_preferences,
                                digital_signature_style: e.target.value,
                              },
                            })
                          }
                          className="w-full sm:w-72 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-primary outline-none"
                        >
                          <option value="Dr. [Full Name]">Dr. [Full Name]</option>
                          <option value="Dr. [Last Name]">Dr. [Last Name]</option>
                          <option value="Full Name with credentials">Full Name with credentials (MD, DNB, FRCR)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Display Preferences */}
                  <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
                    <div className="border-b border-border pb-3">
                      <h2 className="text-base font-bold text-primary">Display Preferences</h2>
                      <p className="text-xs text-primary/50">
                        Default UI workbench layouts and localization formats.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="font-semibold text-primary block mb-1.5">Default Scan Workbench Module</label>
                        <select
                          value={clinicalPrefs.display_preferences.default_workbench_module}
                          onChange={(e) =>
                            setClinicalPrefs({
                              ...clinicalPrefs,
                              display_preferences: {
                                ...clinicalPrefs.display_preferences,
                                default_workbench_module: e.target.value,
                              },
                            })
                          }
                          className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-primary outline-none"
                        >
                          <option value="breast">Breast Cancer (Mammography / Ultrasound)</option>
                          <option value="cervical">Cervical Cancer (Colposcopy / Pap)</option>
                          <option value="pcos">PCOS (Pelvic Ultrasound / Hormones)</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-primary block mb-1.5">Results Page Layout</label>
                        <select
                          value={clinicalPrefs.display_preferences.results_page_layout}
                          onChange={(e) =>
                            setClinicalPrefs({
                              ...clinicalPrefs,
                              display_preferences: {
                                ...clinicalPrefs.display_preferences,
                                results_page_layout: e.target.value,
                              },
                            })
                          }
                          className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-primary outline-none"
                        >
                          <option value="Detailed">Detailed (3-Column Fusion Matrix)</option>
                          <option value="Compact">Compact (Summary First)</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-primary block mb-1.5">Date Format</label>
                        <select
                          value={clinicalPrefs.display_preferences.date_format}
                          onChange={(e) =>
                            setClinicalPrefs({
                              ...clinicalPrefs,
                              display_preferences: {
                                ...clinicalPrefs.display_preferences,
                                date_format: e.target.value,
                              },
                            })
                          }
                          className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-primary outline-none"
                        >
                          <option value="DD/MM/YYYY">DD/MM/YYYY (Indian Standard)</option>
                          <option value="MM/DD/YYYY">MM/DD/YYYY (US Standard)</option>
                          <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-primary block mb-1.5">Time Format</label>
                        <select
                          value={clinicalPrefs.display_preferences.time_format}
                          onChange={(e) =>
                            setClinicalPrefs({
                              ...clinicalPrefs,
                              display_preferences: {
                                ...clinicalPrefs.display_preferences,
                                time_format: e.target.value,
                              },
                            })
                          }
                          className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-primary outline-none"
                        >
                          <option value="12 hour">12-hour (08:30 PM)</option>
                          <option value="24 hour">24-hour (20:30)</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveClinicalPrefs}
                        disabled={saving}
                        className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50 transition shadow-xs"
                      >
                        <Save size={14} />
                        <span>{saving ? 'Saving...' : 'Save Clinical Preferences'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 4: SECURITY */}
              {/* ============================================================== */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  {/* Section 1: Change Password */}
                  <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
                    <div className="border-b border-border pb-3">
                      <h2 className="text-base font-bold text-primary">Change Password</h2>
                      <p className="text-xs text-primary/50">
                        Ensure your account is protected with a strong, compliant passphrase.
                      </p>
                    </div>

                    <form onSubmit={handleChangePasswordSubmit} className="space-y-4 max-w-lg text-xs">
                      {pwError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                          <AlertTriangle size={15} className="shrink-0" />
                          <span>{pwError}</span>
                        </div>
                      )}

                      {/* Current Password */}
                      <div>
                        <label className="font-semibold text-primary block mb-1">Current Password</label>
                        <div className="relative">
                          <input
                            type={showCurrentPw ? 'text' : 'password'}
                            value={pwForm.current_password}
                            onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
                            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 pr-10 text-xs text-primary outline-none focus:ring-2 focus:ring-accent/40"
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPw(!showCurrentPw)}
                            className="absolute right-3 top-2.5 text-primary/40 hover:text-primary"
                          >
                            {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      {/* New Password */}
                      <div>
                        <label className="font-semibold text-primary block mb-1">New Password</label>
                        <div className="relative">
                          <input
                            type={showNewPw ? 'text' : 'password'}
                            value={pwForm.new_password}
                            onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 pr-10 text-xs text-primary outline-none focus:ring-2 focus:ring-accent/40"
                            placeholder="Enter new strong password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPw(!showNewPw)}
                            className="absolute right-3 top-2.5 text-primary/40 hover:text-primary"
                          >
                            {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>

                        {/* Password Strength Indicator Bar */}
                        {pwForm.new_password && (
                          <div className="mt-2 space-y-1">
                            <div className="flex gap-1 h-1.5 w-full">
                              {[1, 2, 3, 4].map((step) => (
                                <div
                                  key={step}
                                  className={`flex-1 rounded-full transition-all ${
                                    pwScore >= step
                                      ? pwScore === 4
                                        ? 'bg-emerald-500'
                                        : pwScore >= 2
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                      : 'bg-slate-200'
                                  }`}
                                />
                              ))}
                            </div>
                            <p className="text-[10px] text-right font-bold text-primary/60">
                              {pwScore === 4 ? 'Strong password' : pwScore >= 2 ? 'Medium strength' : 'Weak password'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Confirm New Password */}
                      <div>
                        <label className="font-semibold text-primary block mb-1">Confirm New Password</label>
                        <div className="relative">
                          <input
                            type={showConfirmPw ? 'text' : 'password'}
                            value={pwForm.confirm_password}
                            onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })}
                            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 pr-10 text-xs text-primary outline-none focus:ring-2 focus:ring-accent/40"
                            placeholder="Re-enter new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPw(!showConfirmPw)}
                            className="absolute right-3 top-2.5 text-primary/40 hover:text-primary"
                          >
                            {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      {/* Requirements List */}
                      <div className="p-3 bg-background rounded-xl border border-border space-y-1.5 text-[11px]">
                        <p className="font-bold text-primary/70">Password Requirements:</p>
                        <div className="grid grid-cols-2 gap-1 text-primary/60">
                          <div className={`flex items-center gap-1.5 ${pwMetrics.length ? 'text-emerald-700 font-semibold' : ''}`}>
                            <Check size={12} className={pwMetrics.length ? 'text-emerald-600' : 'text-slate-300'} />
                            <span>Minimum 8 characters</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${pwMetrics.upper ? 'text-emerald-700 font-semibold' : ''}`}>
                            <Check size={12} className={pwMetrics.upper ? 'text-emerald-600' : 'text-slate-300'} />
                            <span>At least 1 uppercase letter</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${pwMetrics.number ? 'text-emerald-700 font-semibold' : ''}`}>
                            <Check size={12} className={pwMetrics.number ? 'text-emerald-600' : 'text-slate-300'} />
                            <span>At least 1 number</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${pwMetrics.special ? 'text-emerald-700 font-semibold' : ''}`}>
                            <Check size={12} className={pwMetrics.special ? 'text-emerald-600' : 'text-slate-300'} />
                            <span>At least 1 special character</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={pwSaving}
                        className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50 transition shadow-xs"
                      >
                        <Key size={14} />
                        <span>{pwSaving ? 'Updating...' : 'Change Password'}</span>
                      </button>
                    </form>
                  </div>

                  {/* Section 2: Two-Factor Authentication */}
                  <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div>
                        <h2 className="text-base font-bold text-primary">Two-Factor Authentication (2FA)</h2>
                        <p className="text-xs text-primary/50">
                          Protect clinical access with TOTP authenticator app tokens.
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                          securityData.two_factor_enabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {securityData.two_factor_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xs">
                        <p className="font-semibold text-primary">Require 2FA for all portal logins</p>
                        <p className="text-[11px] text-primary/50">
                          Prompts for a 6-digit code generated from Google Authenticator or 1Password.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShow2FAModal(true)}
                        className="px-3.5 py-1.5 rounded-xl border border-border text-xs font-semibold text-primary hover:bg-background hover:border-accent transition"
                      >
                        {securityData.two_factor_enabled ? 'Reconfigure 2FA' : 'Enable 2FA'}
                      </button>
                    </div>
                  </div>

                  {/* Section 3: Active Sessions */}
                  <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                      <div>
                        <h2 className="text-base font-bold text-primary">Active Sessions</h2>
                        <p className="text-xs text-primary/50">
                          Devices and workstations currently authenticated to your doctor profile.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRevokeAllOtherSessions}
                        className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold transition"
                      >
                        Revoke All Other Sessions
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-border/80 bg-background/50 text-[10px] font-semibold text-primary/60 uppercase">
                            <th className="py-2.5 px-3">Device & Browser</th>
                            <th className="py-2.5 px-3">IP Address</th>
                            <th className="py-2.5 px-3">Location</th>
                            <th className="py-2.5 px-3">Last Active</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {securityData.active_sessions.map((sess) => (
                            <tr key={sess.id}>
                              <td className="py-3 px-3">
                                <p className="font-semibold text-primary flex items-center gap-1.5">
                                  <Monitor size={14} className="text-primary/50" />
                                  <span>{sess.device}</span>
                                </p>
                                <p className="text-[10px] text-primary/40 pl-5">{sess.browser}</p>
                              </td>
                              <td className="py-3 px-3 font-mono text-[11px] text-slate-700">
                                {sess.ip_address}
                              </td>
                              <td className="py-3 px-3 text-primary/70">{sess.location}</td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                {sess.is_current ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Current Session
                                  </span>
                                ) : (
                                  <span className="text-primary/60">{sess.last_active}</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {!sess.is_current && (
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeSession(sess.id)}
                                    className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline"
                                  >
                                    Revoke
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 4: Login History */}
                  <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div>
                        <h2 className="text-base font-bold text-primary">Login History</h2>
                        <p className="text-xs text-primary/50">Recent authentication events for this clinician account.</p>
                      </div>
                      <Link
                        to="/doctor/activity"
                        className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                      >
                        <span>View Full History</span>
                        <ChevronRight size={14} />
                      </Link>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-border/80 bg-background/50 text-[10px] font-semibold text-primary/60 uppercase">
                            <th className="py-2.5 px-3">Date / Time</th>
                            <th className="py-2.5 px-3">Device</th>
                            <th className="py-2.5 px-3">IP Address</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {securityData.login_history.map((log, idx) => (
                            <tr key={idx}>
                              <td className="py-2.5 px-3 font-semibold text-primary">{log.date_time}</td>
                              <td className="py-2.5 px-3 text-primary/70">{log.device}</td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">{log.ip_address}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    log.status === 'Success'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {log.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 5: PRIVACY AND DATA */}
              {/* ============================================================== */}
              {activeTab === 'privacy' && (
                <div className="space-y-6">
                  {/* Section 1: Data Usage */}
                  <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
                    <div className="border-b border-border pb-3">
                      <h2 className="text-base font-bold text-primary">Data Usage & Research Consents</h2>
                      <p className="text-xs text-primary/50">
                        Manage permissions for model fine-tuning and operational analytics.
                      </p>
                    </div>

                    <div className="divide-y divide-border/60 text-xs">
                      <div className="py-3 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-primary">Allow anonymized data for platform improvement</p>
                          <p className="text-[11px] text-primary/50 mt-0.5">
                            De-identified clinical calibration metrics help refine model accuracy and reduce false positives.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={!!privacyData.allow_anonymized_data}
                            onChange={(e) =>
                              handleSavePrivacy({ ...privacyData, allow_anonymized_data: e.target.checked })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                        </label>
                      </div>

                      <div className="py-3 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-primary">Receive product updates and clinical guidelines</p>
                          <p className="text-[11px] text-primary/50 mt-0.5">
                            Notifications regarding newly published multicenter validation studies and algorithm releases.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={!!privacyData.receive_product_updates}
                            onChange={(e) =>
                              handleSavePrivacy({ ...privacyData, receive_product_updates: e.target.checked })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Download My Data */}
                  <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
                    <div className="border-b border-border pb-3">
                      <h2 className="text-base font-bold text-primary">Download My Data</h2>
                      <p className="text-xs text-primary/50">
                        Export an immutable, machine-readable JSON archive of your clinician profile, preferences, and action history.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                      <div>
                        <p className="font-semibold text-primary">Complete Clinical Archive</p>
                        <p className="text-[11px] text-primary/50">
                          Includes profile, clinical configurations, audit logs, and notification setups.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleExportData}
                        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white hover:bg-primary/90 transition shadow-xs shrink-0"
                      >
                        <Download size={14} />
                        <span>Export All Data</span>
                      </button>
                    </div>
                  </div>

                  {/* Section 3: Account Actions (Deactivate) */}
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6 shadow-xs space-y-4">
                    <div className="border-b border-amber-200/80 pb-3">
                      <h2 className="text-base font-bold text-amber-900">Account Actions</h2>
                      <p className="text-xs text-amber-700">
                        Manage lifecycle and clinical status of this practitioner profile.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                      <div>
                        <p className="font-bold text-amber-900">Deactivate Clinician Account</p>
                        <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                          Deactivating your account will prevent login but preserve all patient records and diagnostic reports. Contact administrator to reactivate.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDeactivateModal(true)}
                        className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs shrink-0"
                      >
                        Deactivate Account
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 2FA SETUP MODAL */}
      {show2FAModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setShow2FAModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl border border-border space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-accent" />
                <h3 className="text-sm font-bold text-primary">Two-Factor Authentication Setup</h3>
              </div>
              <button
                type="button"
                onClick={() => setShow2FAModal(false)}
                className="text-primary/40 hover:text-primary p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-primary/70">
              <p>Scan this QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, or 1Password):</p>
              
              {/* Pure SVG QR Code Placeholder */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 mx-auto w-48 h-48">
                <div className="w-36 h-36 bg-white border border-slate-300 rounded-xl p-2 flex items-center justify-center">
                  <div className="grid grid-cols-4 gap-1.5 w-full h-full p-1 bg-slate-900 rounded-lg">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div key={i} className={`rounded-xs ${i % 3 === 0 ? 'bg-white' : 'bg-slate-800'}`} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-center">
                <span className="text-[11px] text-primary/50 block font-medium">Or enter code manually:</span>
                <code className="font-mono text-xs font-bold text-primary bg-background px-2.5 py-1 rounded-md border border-border inline-block mt-1">
                  AURAMED-SEC-7842-NMC
                </code>
              </div>

              <div className="pt-2">
                <label className="font-semibold text-primary block mb-1">Enter 6-digit confirmation code:</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  className="w-full text-center tracking-widest font-mono text-base rounded-xl border border-border bg-background py-2 text-primary font-bold outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShow2FAModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-primary hover:bg-background"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setSecurityData({ ...securityData, two_factor_enabled: true })
                  setShow2FAModal(false)
                  showToast('success', 'Two-Factor Authentication enabled successfully.')
                }}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent/90"
              >
                Verify & Activate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEACTIVATE CONFIRMATION MODAL */}
      {showDeactivateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setShowDeactivateModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl border border-amber-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-amber-800">
              <AlertTriangle size={22} className="text-amber-600" />
              <h3 className="text-sm font-bold">Deactivate Clinician Account?</h3>
            </div>

            <p className="text-xs text-primary/70 leading-relaxed">
              Are you sure you want to deactivate your clinician profile? You will no longer be able to log in or analyze incoming scans. All historical patient records and diagnostic reports signed under registration <strong>{profile.registration_number || 'TNMC123456'}</strong> will remain permanently preserved.
            </p>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 font-medium">
              To reactivate in the future, contact your hospital administrator at <strong>admin@auramed.com</strong>.
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeactivateModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-primary hover:bg-background"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivating}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition"
              >
                {deactivating ? 'Deactivating...' : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
