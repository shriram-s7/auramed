import { useEffect, useState } from 'react'
import api from '../../services/api'
import { Shell, ErrorBox, card, input, primary } from './GuidedWorkspace'

export default function SimpleSettings() {
  const [profile, setProfile] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { api.get('/auth/me').then(r => api.get('/doctor/settings').then(s => setProfile({ ...s.data.profile, full_name: r.data.profile.full_name, hospital: r.data.profile.hospital || '' }))).catch(() => setError('Unable to load profile.')) }, [])
  async function save(e) { e.preventDefault(); setBusy(true); setError(''); try { await api.patch('/doctor/settings/profile', profile); setNotice('Profile saved. Reload the workspace to refresh the navigation profile.') } catch (e) { setError(e.response?.data?.detail || 'Unable to save profile.') } finally { setBusy(false) } }
  return <Shell title="Your profile" intro="Keep your clinician name and clinic details accurate. These identify you on finalized reports."><ErrorBox error={error} />{notice && <p role="status" className="text-sm text-teal-800">{notice}</p>}{profile && <form onSubmit={save} className={card + ' space-y-4'}>{[['full_name', 'Clinician name'], ['hospital', 'Clinic / facility'], ['specialty', 'Specialty'], ['phone', 'Clinic contact number'], ['email', 'Account email']].map(([key, label]) => <label key={key} className="block space-y-2 text-sm font-semibold">{label}<input className={input} value={profile[key] || ''} required={['full_name', 'email'].includes(key)} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} /></label>)}<p className="text-sm text-slate-500">Registration: {profile.registration_number}. Account changes requiring administrator review should be handled by your clinic administrator.</p><button disabled={busy} className={primary}>{busy ? 'Saving…' : 'Save profile'}</button></form>}</Shell>
}
