import React, { useState, useEffect } from 'react'
import {
  User,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  Lock,
  Bell,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Save,
  MapPin
} from 'lucide-react'
import PatientLayout from '../../components/patient/PatientLayout'
import InitialsAvatar from '../../components/common/InitialsAvatar'
import {
  fetchPatientProfile,
  updatePatientProfile,
  changePatientPassword,
  submitPatientDataDeletion
} from '../../services/patientPortalService'

export default function PatientProfile() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  // Editable fields
  const [phone, setPhone] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [address, setAddress] = useState('')
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [smsNotifs, setSmsNotifs] = useState(true)

  // Change password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Deletion modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [toastMessage, setToastMessage] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  const loadProfile = async () => {
    try {
      setLoading(true)
      const res = await fetchPatientProfile()
      const p = res.data
      setProfile(p)
      setPhone(p.phone || '')
      setEmergencyContact(p.emergency_contact || '')
      setAddress(p.address || '')
      setEmailNotifs(p.email_notifications !== false)
      setSmsNotifs(p.sms_notifications !== false)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const handleSaveContact = async e => {
    e.preventDefault()
    try {
      setActionLoading(true)
      await updatePatientProfile({
        phone,
        emergency_contact: emergencyContact,
        address,
        email_notifications: emailNotifs,
        sms_notifications: smsNotifs
      })
      showToast('Contact details and notification preferences saved!')
    } catch (err) {
      console.error(err)
      showToast('Failed to save profile changes', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleChangePassword = async e => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error')
      return
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }
    try {
      setActionLoading(true)
      await changePatientPassword({
        current_password: currentPassword,
        new_password: newPassword
      })
      showToast('Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      console.error(err)
      showToast(err.response?.data?.detail || 'Current password incorrect', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSubmitDeletion = async e => {
    e.preventDefault()
    if (!deleteReason.trim()) return
    try {
      setActionLoading(true)
      await submitPatientDataDeletion({
        reason: deleteReason.trim(),
        request_type: 'Full Account Deletion'
      })
      showToast('Data erasure request submitted to compliance administrator.')
      setShowDeleteModal(false)
      setDeleteReason('')
    } catch (err) {
      console.error(err)
      showToast('Failed to submit erasure request', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading || !profile) {
    return (
      <PatientLayout>
        <div className="py-20 text-center text-slate-400 text-xs">
          Loading your personal health profile...
        </div>
      </PatientLayout>
    )
  }

  return (
    <PatientLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Toast */}
        {toastMessage && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-lg border text-sm font-medium flex items-center space-x-2 transition-all ${
            toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            {toastMessage.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            My Profile & Preferences
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your personal information, notification settings, and privacy rights
          </p>
        </div>

        {/* SECTION 1: PERSONAL INFORMATION (Read-only except contact details) */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center space-x-4 pb-4 border-b border-slate-100">
            <InitialsAvatar name={profile.full_name} size={56} />
            <div>
              <h2 className="text-lg font-bold text-slate-900">{profile.full_name}</h2>
              <p className="text-xs font-mono text-teal-600 font-semibold">Patient ID: {profile.patient_code}</p>
              <p className="text-xs text-slate-400 mt-0.5">Verified Primary Health Profile</p>
            </div>
          </div>

          {/* Read-only Medical Demographics */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Medical Demographics (Official Records)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block font-semibold">Date of Birth</span>
                <span className="font-mono text-slate-800 font-bold">{profile.date_of_birth}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block font-semibold">Gender</span>
                <span className="text-slate-800 font-bold">{profile.gender}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block font-semibold">Blood Group</span>
                <span className="text-slate-800 font-bold">{profile.blood_group}</span>
              </div>
            </div>
          </div>

          {/* Editable Contact Information Form */}
          <form onSubmit={handleSaveContact} className="space-y-4 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Editable Contact Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={profile.email}
                  className="w-full bg-slate-100/70 border border-slate-200 rounded-2xl px-3.5 py-2 font-mono text-slate-500 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Registered login email</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mobile Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 font-medium text-slate-900 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Emergency Contact Information</label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={e => setEmergencyContact(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 font-medium text-slate-900 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Residential Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 font-medium text-slate-900 focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Notification Preferences (email/SMS toggles) */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Care Notification Preferences
              </h3>

              <label className="flex items-center space-x-3 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={emailNotifs}
                  onChange={e => setEmailNotifs(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                <span className="text-slate-700 font-medium">
                  Receive email alerts when diagnostic reports or doctor notes are issued
                </span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={smsNotifs}
                  onChange={e => setSmsNotifs(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                <span className="text-slate-700 font-medium">
                  Receive SMS reminders 24 hours prior to scheduled clinic consultations
                </span>
              </label>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs shadow-2xs transition-colors flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Contact & Notification Settings</span>
              </button>
            </div>
          </form>
        </div>

        {/* SECTION 2: CHANGE PASSWORD */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">Security & Password</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs max-w-md">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Current Password *</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">New Password *</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Confirm New Password *</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={actionLoading || !currentPassword || !newPassword}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs shadow-2xs transition-colors"
            >
              Update Password
            </button>
          </form>
        </div>

        {/* SECTION 3: PRIVACY & DATA DELETION REQUEST */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-rose-100 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-rose-700 border-b border-rose-50 pb-3">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="text-sm font-bold text-slate-900">Privacy & Data Governance Rights</h3>
          </div>

          <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
            <p>
              Under the Indian Digital Personal Data Protection (DPDP) Act 2023 and GDPR Article 17, you have the right to request permanent erasure of your personal health data and imaging archives.
            </p>
            <p className="text-slate-500">
              Note: If you are undergoing active clinical oncology treatment, certain records may be subject to statutory 3-year medical council retention requirements.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2.5 border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold rounded-2xl text-xs transition-colors flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Request Account & Medical Data Deletion</span>
            </button>
          </div>
        </div>
      </div>

      {/* DATA DELETION REQUEST MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Request Data Deletion</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                This will submit a formal data erasure request to our compliance administrator.
              </p>
            </div>

            <form onSubmit={handleSubmitDeletion} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for Deletion *</label>
                <textarea
                  rows={3}
                  required
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  placeholder="e.g. Relocating abroad, wish to exercise Right to be Forgotten..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-medium focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2 rounded-2xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !deleteReason.trim()}
                  className="flex-1 py-2 rounded-2xl text-white bg-rose-600 hover:bg-rose-700 font-bold shadow-2xs"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PatientLayout>
  )
}
