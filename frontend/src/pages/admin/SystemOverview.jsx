import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { Shell, ErrorBox, card, button } from '../doctor/GuidedWorkspace'
export default function SystemOverview() {
  const [data, setData] = useState(null), [error, setError] = useState('')
  async function load() { try { setError(''); const [stats, status] = await Promise.all([api.get('/admin/dashboard'), api.get('/admin/system-status')]); setData({ stats: stats.data.stats, status: status.data }) } catch { setError('Unable to load system records. Retry below.') } }
  useEffect(() => { load() }, [])
  return <Shell title="Administration" intro="Actual account counts and checked service readiness. No availability or uptime estimates are shown." actions={<button className={button} onClick={load}>Refresh</button>}><ErrorBox error={error} />{data && <><div className="grid gap-4 sm:grid-cols-3">{Object.entries(data.stats).map(([key, value]) => <div key={key} className={card}><p className="text-3xl font-semibold">{value}</p><p className="mt-2 text-sm capitalize text-slate-600">{key.replaceAll('_', ' ')}</p></div>)}</div><section className={card}><h2 className="font-semibold">Service checks</h2>{data.status.services.map(s => <div className="flex justify-between border-b border-slate-100 py-4 text-sm" key={s.name}><span>{s.name}</span><span>{s.status}</span></div>)}<p className="mt-4 text-xs text-slate-500">Configuration is not proof of message delivery. Test SMS is limited to the owner’s verified number. Database recovery requires a verified backup and restore procedure; this screen does not run backups.</p></section><div className="flex flex-wrap gap-3"><Link className={button} to="/admin/doctors">Manage clinicians</Link><Link className={button} to="/admin/audit-logs">View recorded audit events</Link></div></>}</Shell>
}
