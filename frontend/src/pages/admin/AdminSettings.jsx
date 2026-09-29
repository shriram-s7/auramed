import React, { useState, useEffect } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Edit2,
  Eye,
  EyeOff,
  FileCheck,
  FileCode,
  FileText,
  Globe,
  HardDrive,
  HelpCircle,
  Info,
  Key,
  Layers,
  Lock,
  Mail,
  MessageSquare,
  Power,
  RefreshCw,
  Save,
  Send,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Terminal,
  Trash2,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react'
import {
  fetchAdminSettings,
  updateAdminSettings,
  testAdminEmail,
  testAdminSMS,
  runAdminBackup,
  downloadAdminBackup,
  clearAdminCache,
  executeDangerAction,
} from '../../services/adminService'

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('general') // general | users | security | notifications | compliance | maintenance
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)

  // Full Settings State
  const [general, setGeneral] = useState({
    platform_name: 'AuraMed',
    platform_version: 'v1.0.0',
    support_email: 'support@auramed.health',
    support_phone: '+91 800-287-2227',
    organization_name: 'AuraMed Healthcare Systems Private Limited',
    feature_flags: {
      patient_self_registration: false,
      google_login_patients: false,
      hospital_sso_doctors: false,
      automated_followup_scheduling: true,
      cross_disease_risk_flagging: false,
    },
    default_behaviors: {
      max_file_upload_size: '50MB',
      session_timeout: '1hr',
      default_followup_intervals: {
        critical_risk: { value: 2, unit: 'days' },
        high_risk: { value: 1, unit: 'weeks' },
        moderate_risk: { value: 4, unit: 'weeks' },
        low_risk: { value: 6, unit: 'months' },
      },
    },
  })

  const [userMgmt, setUserMgmt] = useState({
    doctor_registration: {
      auto_approve_doctors: false,
      require_reg_verification: true,
      allowed_specialties: ['Radiology', 'Gynecology', 'Oncology', 'Pathology', 'Internal Medicine'],
      required_fields: [
        'Full Legal Name',
        'Medical Council Registration Number (MCI/NMC)',
        'Hospital / Clinical Institution Affiliation',
        'Official Medical Email Address',
        'Emergency Clinical Contact Number',
      ],
    },
    patient_account: {
      patient_id_format: 'P-YYYY-XXXX',
      temp_password_length: 8,
      force_pw_change_first_login: true,
      account_expiry: 'Never',
    },
  })

  const [security, setSecurity] = useState({
    password_policy: {
      min_length: 8,
      require_uppercase: true,
      require_numbers: true,
      require_special_chars: true,
      password_expiry: 'Never',
    },
    session_settings: {
      max_concurrent_sessions: 3,
      session_timeout_minutes: 60,
      force_logout_on_pw_change: true,
    },
    access_control: {
      max_failed_attempts: 5,
      lockout_duration_minutes: 30,
      ip_whitelist: '192.168.1.0/24\n10.20.0.0/16',
    },
  })

  const [notifications, setNotifications] = useState({
    email_config: {
      smtp_host: 'smtp.auramed.internal',
      smtp_port: 587,
      smtp_username: 'no-reply@auramed.health',
      from_email: 'notifications@auramed.health',
      from_name: 'AuraMed Healthcare Platform',
    },
    sms_config: {
      provider: 'Twilio Telehealth SMS Gateway',
      api_key: 'sk_live_994829384729104',
      sender_id: 'AURAMD',
    },
    templates: {
      new_report_available: 'Dear {patient_name},\n\nYour clinical screening report is now ready for review. Access your secure, private report at:\n{report_link}\n\nIf you have any questions, please consult your reporting doctor.\n\nWarm regards,\nAuraMed Care Team',
      appointment_reminder: 'Hello {patient_name},\n\nThis is a reminder for your upcoming follow-up screening consultation with Dr. {doctor_name} on {appointment_date} at {appointment_time}.\n\nLocation: {hospital_name}\n\nBest health,\nAuraMed',
      doctor_verification_approved: 'Dear Dr. {doctor_name},\n\nYour medical council registration ({registration_number}) has been verified and approved by system administration. You may now access the clinician workbench at https://auramed.health/login/doctor.\n\nWelcome,\nAuraMed Administration',
      doctor_verification_rejected: 'Dear Dr. {doctor_name},\n\nYour practitioner access application could not be verified at this time for the following reason:\n{rejection_reason}\n\nPlease contact compliance@auramed.health for re-verification.',
      data_deletion_approved: 'Dear {patient_name},\n\nYour data deletion request ({request_id}) has been approved and processed in compliance with the Digital Personal Data Protection (DPDP) Act 2023. All identifiable biometric and screening records have been permanently expunged.',
    },
  })

  const [complianceLegal, setComplianceLegal] = useState({
    privacy_policy: {
      last_updated: 'Sep 01, 2026',
      content: 'AuraMed Healthcare Systems complies with DPDP Act 2023 and global health data protection frameworks. All diagnostic scans are stored with AES-256 encryption at rest and TLS 1.3 in transit.',
    },
    terms_of_service: {
      last_updated: 'Aug 15, 2026',
      content: 'AuraMed Software as a Medical Device (SaMD) terms govern the authorized clinical screening and doctor-patient communications conducted across this platform.',
    },
    data_retention: {
      patient_data_retention: '10 years',
      audit_log_retention: '5 years',
      deleted_account_data: '30 days',
    },
    compliance_info: {
      hipaa_notice: 'Platform implements technical safeguards under 45 CFR § 164.312 for Access Control, Audit Controls, Integrity, and Transmission Security.',
      dpdp_notice: 'Compliant with India\'s Digital Personal Data Protection (DPDP) Act 2023 guidelines for Digital Health Fiduciaries.',
      data_processing_region: 'India (MeitY-empaneled Tier-4 Secure Cloud Data Centers)',
    },
  })

  const [maintenance, setMaintenance] = useState({
    database: {
      last_backup: 'Today, 02:00 AM IST',
      status: 'Healthy (WAL Mode • 0 errors)',
    },
    cache: {
      status: 'Active (128 cached sessions / query keys)',
    },
  })

  // Specialty Tag Input State
  const [newSpecialtyInput, setNewSpecialtyInput] = useState('')

  // Template Modal State
  const [editingTemplateKey, setEditingTemplateKey] = useState(null)
  const [templateContent, setTemplateContent] = useState('')

  // Legal Editor Modal State
  const [editingLegalDoc, setEditingLegalDoc] = useState(null) // 'privacy' | 'terms'
  const [legalContent, setLegalContent] = useState('')

  // Danger Zone Modal State
  const [dangerAction, setDangerAction] = useState(null) // 'reset_flags' | 'clear_drafts'
  const [adminPasswordInput, setAdminPasswordInput] = useState('')
  const [dangerLoading, setDangerLoading] = useState(false)

  // Test Communications Loading States
  const [testingEmail, setTestingEmail] = useState(false)
  const [testingSMS, setTestingSMS] = useState(false)
  const [backingUp, setBackingUp] = useState(false)

  // Toast Helper
  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Load Settings from API
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await fetchAdminSettings()
      if (res.data) {
        if (res.data.general) setGeneral(res.data.general)
        if (res.data.user_management) setUserMgmt(res.data.user_management)
        if (res.data.security) setSecurity(res.data.security)
        if (res.data.notifications) setNotifications(res.data.notifications)
        if (res.data.compliance_legal) setComplianceLegal(res.data.compliance_legal)
        if (res.data.maintenance) setMaintenance(res.data.maintenance)
      }
    } catch (err) {
      console.error('Failed to load admin settings:', err)
      showToast('Failed to load system settings. Using local defaults.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Save Settings for Active Tab
  const handleSaveActiveTab = async () => {
    setSaving(true)
    try {
      const payload = {}
      if (activeTab === 'general') payload.general = general
      if (activeTab === 'users') payload.user_management = userMgmt
      if (activeTab === 'security') payload.security = security
      if (activeTab === 'notifications') payload.notifications = notifications
      if (activeTab === 'compliance') payload.compliance_legal = complianceLegal
      if (activeTab === 'maintenance') payload.maintenance = maintenance

      await updateAdminSettings(payload)
      showToast('System configuration saved successfully.')
    } catch (err) {
      console.error('Failed to save settings:', err)
      showToast(err.response?.data?.detail || 'Failed to save configuration.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Test Email
  const handleTestEmail = async () => {
    setTestingEmail(true)
    try {
      const res = await testAdminEmail()
      showToast(res.data.message || 'Test email sent successfully.')
    } catch (err) {
      showToast('Failed to transmit test email.', 'error')
    } finally {
      setTestingEmail(false)
    }
  }

  // Test SMS
  const handleTestSMS = async () => {
    setTestingSMS(true)
    try {
      const res = await testAdminSMS()
      showToast(res.data.message || 'Test SMS sent successfully.')
    } catch (err) {
      showToast('Failed to transmit test SMS.', 'error')
    } finally {
      setTestingSMS(false)
    }
  }

  // Run Backup Now
  const handleRunBackup = async () => {
    setBackingUp(true)
    try {
      const res = await runAdminBackup()
      setMaintenance((prev) => ({
        ...prev,
        database: { ...prev.database, last_backup: res.data.timestamp },
      }))
      showToast(`Backup created: ${res.data.filename}`)
    } catch (err) {
      showToast('Failed to run backup snapshot.', 'error')
    } finally {
      setBackingUp(false)
    }
  }

  // Download Backup
  const handleDownloadBackup = async () => {
    try {
      const res = await downloadAdminBackup()
      const blob = new Blob([res.data], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `auramed_backup_${new Date().toISOString().slice(0, 10)}.json`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      showToast('Backup archive download started.')
    } catch (err) {
      showToast('Failed to download backup.', 'error')
    }
  }

  // Clear Cache
  const handleClearCache = async (type) => {
    try {
      const res = await clearAdminCache(type)
      showToast(res.data.message || `${type} cache purged.`)
    } catch (err) {
      showToast('Failed to clear cache.', 'error')
    }
  }

  // Danger Zone Action Execution
  const handleConfirmDangerAction = async (e) => {
    e.preventDefault()
    if (!adminPasswordInput) {
      showToast('Admin password is required.', 'error')
      return
    }

    setDangerLoading(true)
    try {
      const res = await executeDangerAction(adminPasswordInput, dangerAction)
      showToast(res.data.message)
      setDangerAction(null)
      setAdminPasswordInput('')
      loadSettings()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Invalid administrator password.', 'error')
    } finally {
      setDangerLoading(false)
    }
  }

  // Specialty Tag helpers
  const handleAddSpecialty = (e) => {
    if (e.key === 'Enter' && newSpecialtyInput.trim()) {
      e.preventDefault()
      const val = newSpecialtyInput.trim()
      if (!userMgmt.doctor_registration.allowed_specialties.includes(val)) {
        setUserMgmt({
          ...userMgmt,
          doctor_registration: {
            ...userMgmt.doctor_registration,
            allowed_specialties: [...userMgmt.doctor_registration.allowed_specialties, val],
          },
        })
      }
      setNewSpecialtyInput('')
    }
  }

  const handleRemoveSpecialty = (sp) => {
    setUserMgmt({
      ...userMgmt,
      doctor_registration: {
        ...userMgmt.doctor_registration,
        allowed_specialties: userMgmt.doctor_registration.allowed_specialties.filter((s) => s !== sp),
      },
    })
  }

  const tabs = [
    { id: 'general', label: 'General Settings', icon: Sliders },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'security', label: 'Security Settings', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'compliance', label: 'Compliance & Legal', icon: FileCheck },
    { id: 'maintenance', label: 'System Maintenance', icon: Database },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-3 ${
            toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle size={16} className="text-rose-600" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-600" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* PAGE HEADER */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
          <Sliders className="w-6 h-6 text-teal-600" />
          <span>System Settings</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure platform settings, manage system behavior, and maintain compliance.
        </p>
      </div>

      {/* MAIN TWO-COLUMN LAYOUT: TABS ON LEFT + CONTENT ON RIGHT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT VERTICAL TABS */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-xs space-y-1">
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
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* RIGHT CONTENT AREA */}
        <div className="lg:col-span-9 space-y-6">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 space-y-3">
              <RefreshCw size={24} className="animate-spin mx-auto text-teal-600" />
              <p className="text-sm font-medium">Loading system settings...</p>
            </div>
          ) : (
            <>
              {/* ============================================================== */}
              {/* TAB 1: GENERAL SETTINGS */}
              {/* ============================================================== */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  {/* Platform Information */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-base font-bold text-slate-900">Platform Information</h2>
                      <p className="text-xs text-slate-500">Core instance identity and clinical support channels.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Platform Name</label>
                        <input
                          type="text"
                          value={general.platform_name}
                          onChange={(e) => setGeneral({ ...general, platform_name: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-medium text-slate-900 outline-none focus:ring-2 focus:ring-teal-500/30"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Platform Version</label>
                        <input
                          type="text"
                          readOnly
                          value={general.platform_version}
                          className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 font-mono font-bold text-slate-500 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Support Email Address</label>
                        <input
                          type="email"
                          value={general.support_email}
                          onChange={(e) => setGeneral({ ...general, support_email: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-medium text-slate-900 outline-none focus:ring-2 focus:ring-teal-500/30"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Support Phone Helpline</label>
                        <input
                          type="text"
                          value={general.support_phone}
                          onChange={(e) => setGeneral({ ...general, support_phone: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-medium text-slate-900 outline-none focus:ring-2 focus:ring-teal-500/30"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="font-semibold text-slate-700 block mb-1">Organization Name</label>
                        <input
                          type="text"
                          value={general.organization_name}
                          onChange={(e) => setGeneral({ ...general, organization_name: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-medium text-slate-900 outline-none focus:ring-2 focus:ring-teal-500/30"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Feature Flags */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-base font-bold text-slate-900">Feature Flags</h2>
                      <p className="text-xs text-slate-500">Toggle operational features and access pathways.</p>
                    </div>

                    <div className="divide-y divide-slate-100 text-xs">
                      {[
                        {
                          key: 'patient_self_registration',
                          label: 'Patient self-registration',
                          desc: 'If disabled, only doctors can create patient accounts during visits.',
                        },
                        {
                          key: 'google_login_patients',
                          label: 'Google login for patients',
                          desc: 'Allow OAuth 2.0 social sign-in for patient portal.',
                        },
                        {
                          key: 'hospital_sso_doctors',
                          label: 'Hospital SSO for doctors',
                          desc: 'Enforce SAML 2.0 / OIDC hospital single sign-on for clinicians.',
                        },
                        {
                          key: 'automated_followup_scheduling',
                          label: 'Automated follow-up scheduling',
                          desc: 'Suggest appointments automatically based on AI risk stratification score.',
                        },
                        {
                          key: 'cross_disease_risk_flagging',
                          label: 'Cross-disease risk flagging (future feature)',
                          desc: 'Correlate PCOS endocrine risks with cervical & metabolic oncology markers.',
                        },
                      ].map((flag) => (
                        <div key={flag.key} className="py-3 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">{flag.label}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{flag.desc}</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={!!general.feature_flags[flag.key]}
                              onChange={(e) =>
                                setGeneral({
                                  ...general,
                                  feature_flags: { ...general.feature_flags, [flag.key]: e.target.checked },
                                })
                              }
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Default System Behaviors */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-base font-bold text-slate-900">Default System Behaviors</h2>
                      <p className="text-xs text-slate-500">System-wide baseline parameters for scans and sessions.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Maximum File Upload Size</label>
                        <select
                          value={general.default_behaviors.max_file_upload_size}
                          onChange={(e) =>
                            setGeneral({
                              ...general,
                              default_behaviors: { ...general.default_behaviors, max_file_upload_size: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                        >
                          <option value="10MB">10 MB</option>
                          <option value="20MB">20 MB</option>
                          <option value="50MB">50 MB (Recommended)</option>
                          <option value="100MB">100 MB (High-res DICOM)</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">System Session Timeout</label>
                        <select
                          value={general.default_behaviors.session_timeout}
                          onChange={(e) =>
                            setGeneral({
                              ...general,
                              default_behaviors: { ...general.default_behaviors, session_timeout: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                        >
                          <option value="30min">30 minutes</option>
                          <option value="1hr">1 hour (Recommended)</option>
                          <option value="2hr">2 hours</option>
                          <option value="4hr">4 hours</option>
                          <option value="8hr">8 hours (Clinic shift)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 2: USER MANAGEMENT SETTINGS */}
              {/* ============================================================== */}
              {activeTab === 'users' && (
                <div className="space-y-6">
                  {/* Doctor Registration Settings */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-base font-bold text-slate-900">Doctor Registration Governance</h2>
                      <p className="text-xs text-slate-500">Rules for approving and onboarding healthcare practitioners.</p>
                    </div>

                    <div className="space-y-3 text-xs">
                      {/* Auto-approve toggle (Dangerous) */}
                      <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
                        <div>
                          <p className="font-bold text-amber-900 flex items-center gap-1.5">
                            <AlertTriangle size={14} className="text-amber-700 shrink-0" />
                            <span>Auto-approve Doctors (Dangerous)</span>
                          </p>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            If enabled, registered doctors can immediately sign clinical reports without manual admin verification.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={!!userMgmt.doctor_registration.auto_approve_doctors}
                            onChange={(e) =>
                              setUserMgmt({
                                ...userMgmt,
                                doctor_registration: {
                                  ...userMgmt.doctor_registration,
                                  auto_approve_doctors: e.target.checked,
                                },
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                        </label>
                      </div>

                      {/* Require Registration Number Verification */}
                      <div className="py-2 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">Require Registration Number Verification</p>
                          <p className="text-[11px] text-slate-500">Verify MCI/NMC credentials against national council registries.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={!!userMgmt.doctor_registration.require_reg_verification}
                            onChange={(e) =>
                              setUserMgmt({
                                ...userMgmt,
                                doctor_registration: {
                                  ...userMgmt.doctor_registration,
                                  require_reg_verification: e.target.checked,
                                },
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                        </label>
                      </div>

                      {/* Allowed Specialties (Tag input) */}
                      <div className="pt-2">
                        <label className="font-semibold text-slate-700 block mb-1">Allowed Specialties (Press Enter to add)</label>
                        <div className="p-2 border border-slate-200 bg-slate-50 rounded-xl flex flex-wrap gap-1.5 items-center">
                          {userMgmt.doctor_registration.allowed_specialties.map((sp) => (
                            <span
                              key={sp}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs"
                            >
                              <span>{sp}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSpecialty(sp)}
                                className="text-slate-400 hover:text-rose-500 p-0.5"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                          <input
                            type="text"
                            placeholder="Add specialty..."
                            value={newSpecialtyInput}
                            onChange={(e) => setNewSpecialtyInput(e.target.value)}
                            onKeyDown={handleAddSpecialty}
                            className="bg-transparent border-none text-xs outline-none px-2 py-1 text-slate-800 placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      {/* Required Fields Checklist */}
                      <div className="pt-2">
                        <label className="font-semibold text-slate-700 block mb-1.5">Required Fields for Doctor Onboarding:</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          {userMgmt.doctor_registration.required_fields.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                              <CheckCircle2 size={14} className="text-teal-600 shrink-0" />
                              <span className="font-medium text-slate-800">{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Patient Account Settings */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-base font-bold text-slate-900">Patient Account Settings</h2>
                      <p className="text-xs text-slate-500">Parameters for patient identifier generation and temporary credentials.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Patient ID Format (Read-Only)</label>
                        <input
                          type="text"
                          readOnly
                          value={userMgmt.patient_account.patient_id_format}
                          className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 font-mono font-bold text-slate-600 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Temporary Password Length</label>
                        <input
                          type="number"
                          min={6}
                          max={16}
                          value={userMgmt.patient_account.temp_password_length}
                          onChange={(e) =>
                            setUserMgmt({
                              ...userMgmt,
                              patient_account: { ...userMgmt.patient_account, temp_password_length: Number(e.target.value) },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-bold text-slate-900 outline-none"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Patient Account Expiry</label>
                        <select
                          value={userMgmt.patient_account.account_expiry}
                          onChange={(e) =>
                            setUserMgmt({
                              ...userMgmt,
                              patient_account: { ...userMgmt.patient_account, account_expiry: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                        >
                          <option value="Never">Never (Permanent Health Record)</option>
                          <option value="1 year">1 year</option>
                          <option value="2 years">2 years</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                          <p className="font-bold text-slate-900">Force Password Change</p>
                          <p className="text-[10px] text-slate-500">Require patient to set custom password on first portal login.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={!!userMgmt.patient_account.force_pw_change_first_login}
                            onChange={(e) =>
                              setUserMgmt({
                                ...userMgmt,
                                patient_account: {
                                  ...userMgmt.patient_account,
                                  force_pw_change_first_login: e.target.checked,
                                },
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 3: SECURITY SETTINGS */}
              {/* ============================================================== */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  {/* Password Policy */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-base font-bold text-slate-900">System Password Policy</h2>
                      <p className="text-xs text-slate-500">Enforce enterprise complexity across clinician and administrative accounts.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Minimum Password Length</label>
                        <input
                          type="number"
                          min={6}
                          max={32}
                          value={security.password_policy.min_length}
                          onChange={(e) =>
                            setSecurity({
                              ...security,
                              password_policy: { ...security.password_policy, min_length: Number(e.target.value) },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-bold"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Password Expiration Interval</label>
                        <select
                          value={security.password_policy.password_expiry}
                          onChange={(e) =>
                            setSecurity({
                              ...security,
                              password_policy: { ...security.password_policy, password_expiry: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                        >
                          <option value="Never">Never</option>
                          <option value="90 days">90 days</option>
                          <option value="180 days">180 days</option>
                          <option value="1 year">1 year</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2 divide-y divide-slate-100 pt-1">
                        {[
                          { key: 'require_uppercase', label: 'Require Uppercase Letter' },
                          { key: 'require_numbers', label: 'Require Numbers' },
                          { key: 'require_special_chars', label: 'Require Special Characters (!@#$%^&*)' },
                        ].map((p) => (
                          <div key={p.key} className="py-2.5 flex items-center justify-between">
                            <span className="font-semibold text-slate-900">{p.label}</span>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                checked={!!security.password_policy[p.key]}
                                onChange={(e) =>
                                  setSecurity({
                                    ...security,
                                    password_policy: {
                                      ...security.password_policy,
                                      [p.key]: e.target.checked,
                                    },
                                  })
                                }
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Session Settings & Access Control */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-base font-bold text-slate-900">Session Settings & Access Control</h2>
                      <p className="text-xs text-slate-500">Lockout parameters and network IP whitelisting.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Max Concurrent Sessions</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={security.session_settings.max_concurrent_sessions}
                          onChange={(e) =>
                            setSecurity({
                              ...security,
                              session_settings: {
                                ...security.session_settings,
                                max_concurrent_sessions: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-bold"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Max Failed Login Attempts</label>
                        <input
                          type="number"
                          min={3}
                          max={10}
                          value={security.access_control.max_failed_attempts}
                          onChange={(e) =>
                            setSecurity({
                              ...security,
                              access_control: {
                                ...security.access_control,
                                max_failed_attempts: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-bold"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Lockout Duration (Minutes)</label>
                        <input
                          type="number"
                          min={5}
                          max={1440}
                          value={security.access_control.lockout_duration_minutes}
                          onChange={(e) =>
                            setSecurity({
                              ...security,
                              access_control: {
                                ...security.access_control,
                                lockout_duration_minutes: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-bold"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="font-semibold text-slate-700 block mb-1">
                          IP Whitelist (CIDR / IP per line - optional)
                        </label>
                        <textarea
                          rows={3}
                          value={security.access_control.ip_whitelist}
                          onChange={(e) =>
                            setSecurity({
                              ...security,
                              access_control: {
                                ...security.access_control,
                                ip_whitelist: e.target.value,
                              },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800"
                          placeholder="192.168.1.0/24&#10;10.20.0.0/16"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 4: NOTIFICATION SETTINGS */}
              {/* ============================================================== */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  {/* Email Configuration */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Email Gateway Configuration (SMTP)</h2>
                        <p className="text-xs text-slate-500">Outbound transactional clinical communication relay.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleTestEmail}
                        disabled={testingEmail}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
                      >
                        {testingEmail ? 'Sending...' : 'Test Email'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">SMTP Host</label>
                        <input
                          type="text"
                          value={notifications.email_config.smtp_host}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              email_config: { ...notifications.email_config, smtp_host: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">SMTP Port</label>
                        <input
                          type="number"
                          value={notifications.email_config.smtp_port}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              email_config: { ...notifications.email_config, smtp_port: Number(e.target.value) },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">SMTP Username</label>
                        <input
                          type="password"
                          value={notifications.email_config.smtp_username}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              email_config: { ...notifications.email_config, smtp_username: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">From Email Address</label>
                        <input
                          type="email"
                          value={notifications.email_config.from_email}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              email_config: { ...notifications.email_config, from_email: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="font-semibold text-slate-700 block mb-1">From Sender Display Name</label>
                        <input
                          type="text"
                          value={notifications.email_config.from_name}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              email_config: { ...notifications.email_config, from_name: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SMS Configuration */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">SMS Gateway Configuration</h2>
                        <p className="text-xs text-slate-500">Telehealth patient reminder and authentication SMS relay.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleTestSMS}
                        disabled={testingSMS}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
                      >
                        {testingSMS ? 'Transmitting...' : 'Test SMS'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Provider</label>
                        <select
                          value={notifications.sms_config.provider}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              sms_config: { ...notifications.sms_config, provider: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                        >
                          <option value="Twilio Telehealth SMS Gateway">Twilio Telehealth SMS Gateway</option>
                          <option value="AWS SNS Healthcare Messaging">AWS SNS Healthcare Messaging</option>
                          <option value="MessageBird Medical Cloud">MessageBird Medical Cloud</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">API Key / Secret Token</label>
                        <input
                          type="password"
                          value={notifications.sms_config.api_key}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              sms_config: { ...notifications.sms_config, api_key: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Sender ID (Alpha Header)</label>
                        <input
                          type="text"
                          value={notifications.sms_config.sender_id}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              sms_config: { ...notifications.sms_config, sender_id: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* System Notification Templates */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-base font-bold text-slate-900">System Notification Templates</h2>
                      <p className="text-xs text-slate-500">Edit dynamic transactional messages sent to patients and clinicians.</p>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      {[
                        { key: 'new_report_available', label: 'New Report Available (Patient Email)' },
                        { key: 'appointment_reminder', label: 'Appointment Reminder (Patient Email / SMS)' },
                        { key: 'doctor_verification_approved', label: 'Doctor Verification Approved (Doctor Email)' },
                        { key: 'doctor_verification_rejected', label: 'Doctor Verification Rejected (Doctor Email)' },
                        { key: 'data_deletion_approved', label: 'Data Deletion Approved (Patient Email)' },
                      ].map((t) => (
                        <div
                          key={t.key}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{t.label}</p>
                            <p className="text-[11px] text-slate-500 truncate max-w-xl mt-0.5 font-mono">
                              {notifications.templates[t.key]?.replace(/\n/g, ' ')}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTemplateKey(t.key)
                              setTemplateContent(notifications.templates[t.key] || '')
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0"
                          >
                            <Edit2 size={13} />
                            <span>Edit Template</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 5: COMPLIANCE AND LEGAL */}
              {/* ============================================================== */}
              {activeTab === 'compliance' && (
                <div className="space-y-6">
                  {/* Policies & Terms */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-base font-bold text-slate-900">Legal Documents & Terms</h2>
                      <p className="text-xs text-slate-500">Public policy text rendered across consent modals and footer links.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      {/* Privacy Policy */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">Privacy Policy</span>
                          <span className="text-[10px] text-slate-400">Updated: {complianceLegal.privacy_policy.last_updated}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2">
                          {complianceLegal.privacy_policy.content}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLegalDoc('privacy')
                            setLegalContent(complianceLegal.privacy_policy.content)
                          }}
                          className="text-xs font-bold text-teal-600 hover:underline inline-flex items-center gap-1 pt-1"
                        >
                          <Edit2 size={12} />
                          <span>Edit Privacy Policy</span>
                        </button>
                      </div>

                      {/* Terms of Service */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">Terms of Service</span>
                          <span className="text-[10px] text-slate-400">Updated: {complianceLegal.terms_of_service.last_updated}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2">
                          {complianceLegal.terms_of_service.content}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLegalDoc('terms')
                            setLegalContent(complianceLegal.terms_of_service.content)
                          }}
                          className="text-xs font-bold text-teal-600 hover:underline inline-flex items-center gap-1 pt-1"
                        >
                          <Edit2 size={12} />
                          <span>Edit Terms of Service</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Data Retention Policy */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-base font-bold text-slate-900">Data Retention Policy</h2>
                      <p className="text-xs text-slate-500">Statutory retention windows and cold purge schedules.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Patient Screening Data Retention</label>
                        <select
                          value={complianceLegal.data_retention.patient_data_retention}
                          onChange={(e) =>
                            setComplianceLegal({
                              ...complianceLegal,
                              data_retention: { ...complianceLegal.data_retention, patient_data_retention: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                        >
                          <option value="5 years">5 years</option>
                          <option value="7 years">7 years</option>
                          <option value="10 years">10 years (Standard)</option>
                          <option value="Forever">Forever</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Audit Log Retention</label>
                        <select
                          value={complianceLegal.data_retention.audit_log_retention}
                          onChange={(e) =>
                            setComplianceLegal({
                              ...complianceLegal,
                              data_retention: { ...complianceLegal.data_retention, audit_log_retention: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                        >
                          <option value="1 year">1 year</option>
                          <option value="2 years">2 years</option>
                          <option value="5 years">5 years (Recommended)</option>
                          <option value="Forever">Forever</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Deleted Account Data Purge</label>
                        <select
                          value={complianceLegal.data_retention.deleted_account_data}
                          onChange={(e) =>
                            setComplianceLegal({
                              ...complianceLegal,
                              data_retention: { ...complianceLegal.data_retention, deleted_account_data: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                        >
                          <option value="Immediate">Immediate</option>
                          <option value="30 days">30 days (DPDP grace period)</option>
                          <option value="90 days">90 days</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Compliance Information (Display Only) */}
                  <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-6 shadow-xs space-y-3">
                    <div className="flex items-center gap-2 text-teal-900 border-b border-teal-200/80 pb-2">
                      <ShieldCheck size={18} className="text-teal-700" />
                      <h3 className="font-bold text-sm">Regulatory Compliance Specifications</h3>
                    </div>

                    <div className="space-y-2 text-xs text-teal-900">
                      <p><strong>HIPAA Technical Safeguards:</strong> {complianceLegal.compliance_info.hipaa_notice}</p>
                      <p><strong>India DPDP Act 2023:</strong> {complianceLegal.compliance_info.dpdp_notice}</p>
                      <p><strong>Data Residency:</strong> {complianceLegal.compliance_info.data_processing_region}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 6: SYSTEM MAINTENANCE */}
              {/* ============================================================== */}
              {activeTab === 'maintenance' && (
                <div className="space-y-6">
                  {/* Live System Status */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Live System Status</h2>
                        <p className="text-xs text-slate-500">Real-time health telemetry across platform services.</p>
                      </div>
                      <button
                        type="button"
                        onClick={loadSettings}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
                      >
                        <RefreshCw size={13} />
                        <span>Refresh Telemetry</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-500 font-medium">Database Core</span>
                        <p className="font-bold text-emerald-700 mt-1 flex items-center gap-1">
                          <CheckCircle2 size={13} /> Operational
                        </p>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-500 font-medium">AI Inference Engine</span>
                        <p className="font-bold text-emerald-700 mt-1 flex items-center gap-1">
                          <CheckCircle2 size={13} /> Multi-modal Active
                        </p>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-500 font-medium">Storage Volume</span>
                        <p className="font-bold text-emerald-700 mt-1 flex items-center gap-1">
                          <CheckCircle2 size={13} /> 94% Available
                        </p>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-500 font-medium">Data Encryption</span>
                        <p className="font-bold text-emerald-700 mt-1 flex items-center gap-1">
                          <CheckCircle2 size={13} /> AES-256 Validated
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Database Backups */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-base font-bold text-slate-900">Database Snapshots & Backups</h2>
                      <p className="text-xs text-slate-500">Automated cold snapshots and point-in-time recovery archives.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">Last Cold Snapshot:</p>
                        <p className="font-mono text-xs text-slate-600 mt-0.5">{maintenance.database.last_backup}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleRunBackup}
                          disabled={backingUp}
                          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                        >
                          {backingUp ? 'Creating Snapshot...' : 'Run Backup Now'}
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadBackup}
                          className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          <Download size={14} />
                          <span>Download Latest</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Cache Controls & Audit Log Export */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-base font-bold text-slate-900">Cache Controls & Audit Log Export</h2>
                      <p className="text-xs text-slate-500">Purge temporary caches and export full security traces.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <div>
                          <p className="font-bold text-slate-900">Application & Session Cache</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Flush in-memory query results and active browser session tokens.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleClearCache('application')}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
                          >
                            Clear App Cache
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClearCache('session')}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
                          >
                            Clear Session Cache
                          </button>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <div>
                          <p className="font-bold text-slate-900">Export All Audit Logs</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Download full immutable forensic trace as CSV.</p>
                        </div>
                        <a
                          href="http://127.0.0.1:8000/api/admin/audit-logs?limit=1000"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs"
                        >
                          <Download size={13} />
                          <span>Export Full Audit CSV</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Danger Zone (Red Bordered Section) */}
                  <div className="rounded-2xl border border-rose-300 bg-rose-50/40 p-6 shadow-xs space-y-4">
                    <div className="border-b border-rose-200 pb-3">
                      <h2 className="text-base font-bold text-rose-900 flex items-center gap-2">
                        <AlertTriangle className="text-rose-600" size={18} />
                        <span>Danger Zone (Irreversible Actions)</span>
                      </h2>
                      <p className="text-xs text-rose-700">
                        These actions modify global operational state and require administrator password confirmation.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                      <div>
                        <p className="font-bold text-rose-900">Reset All Feature Flags to Default</p>
                        <p className="text-[11px] text-rose-700">Restores all flags to strict zero-trust hospital defaults.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDangerAction('reset_flags')}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs shrink-0"
                      >
                        Reset Feature Flags
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs pt-3 border-t border-rose-200/80">
                      <div>
                        <p className="font-bold text-rose-900">Clear All Unfinalized Draft Reports</p>
                        <p className="text-[11px] text-rose-700">Deletes unfinalized drafts. Signed reports remain permanently untouched.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDangerAction('clear_drafts')}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs shrink-0"
                      >
                        Clear Draft Reports
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SAVE SETTINGS FIXED BAR (BOTTOM) */}
              <div className="sticky bottom-4 z-20 flex justify-end bg-white/90 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200 shadow-xl">
                <button
                  type="button"
                  onClick={handleSaveActiveTab}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50 transition shadow-xs"
                >
                  <Save size={15} />
                  <span>{saving ? 'Saving System Configuration...' : 'Save Settings'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* TEMPLATE EDITOR MODAL */}
      {editingTemplateKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setEditingTemplateKey(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Edit Notification Template</h3>
              <button
                type="button"
                onClick={() => setEditingTemplateKey(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <span className="font-semibold text-slate-700 block">Available Template Dynamic Variables:</span>
              <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                {['{patient_name}', '{doctor_name}', '{report_link}', '{appointment_date}', '{hospital_name}', '{registration_number}'].map((v) => (
                  <span key={v} className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-teal-800 font-bold">
                    {v}
                  </span>
                ))}
              </div>

              <div className="pt-2">
                <label className="font-semibold text-slate-700 block mb-1">Message Body:</label>
                <textarea
                  rows={6}
                  value={templateContent}
                  onChange={(e) => setTemplateContent(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/30"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingTemplateKey(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotifications({
                    ...notifications,
                    templates: { ...notifications.templates, [editingTemplateKey]: templateContent },
                  })
                  setEditingTemplateKey(null)
                  showToast('Template updated. Click "Save Settings" to persist.')
                }}
                className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEGAL EDITOR MODAL */}
      {editingLegalDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setEditingLegalDoc(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Edit {editingLegalDoc === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingLegalDoc(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <textarea
                rows={10}
                value={legalContent}
                onChange={(e) => setLegalContent(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-sans text-xs text-slate-800 outline-none leading-relaxed"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingLegalDoc(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const docKey = editingLegalDoc === 'privacy' ? 'privacy_policy' : 'terms_of_service'
                  setComplianceLegal({
                    ...complianceLegal,
                    [docKey]: {
                      ...complianceLegal[docKey],
                      content: legalContent,
                      last_updated: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                    },
                  })
                  setEditingLegalDoc(null)
                  showToast('Policy updated. Click "Save Settings" to persist.')
                }}
                className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
              >
                Save Legal Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DANGER CONFIRMATION MODAL */}
      {dangerAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setDangerAction(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-rose-300 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-rose-800 border-b border-rose-100 pb-3">
              <AlertTriangle size={20} className="text-rose-600" />
              <h3 className="font-bold text-sm">Confirm Critical Administrative Action</h3>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              {dangerAction === 'reset_flags'
                ? 'Are you sure you want to reset all feature flags to strict zero-trust defaults? This will disable patient self-registration and third-party logins.'
                : 'Are you sure you want to purge all unfinalized draft reports across the platform? This cannot be undone.'}
            </p>

            <form onSubmit={handleConfirmDangerAction} className="space-y-3 pt-2">
              <div>
                <label className="font-semibold text-slate-900 text-xs block mb-1">
                  Enter Administrator Password to Authorize:
                </label>
                <input
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="Enter admin password (e.g. 123)"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDangerAction(null)
                    setAdminPasswordInput('')
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dangerLoading}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition"
                >
                  {dangerLoading ? 'Verifying...' : 'Authorize Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
