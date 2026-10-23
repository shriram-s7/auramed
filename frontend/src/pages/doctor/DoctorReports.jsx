import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { Shell, ErrorBox, card, button, input } from './GuidedWorkspace'
export default function DoctorReports() {
 const [rows,setRows]=useState([]), [error,setError]=useState(''), [search,setSearch]=useState(''), [loaded,setLoaded]=useState(false)
 async function load() { try { setError(''); const r=await api.get('/doctor/workflow/visits'); setRows(r.data.filter(v=>v.report_id)); setLoaded(true) } catch {setError('Unable to load reports. Please retry.')} }
 useEffect(()=>{load()},[])
 const visible=rows.filter(v=>(v.patient_name+' '+v.patient_code+' '+v.module).toLowerCase().includes(search.toLowerCase()))
 return <Shell title="Reports" intro="Open a visit to review, finalize, download or release its report." actions={<button className={button} onClick={load}>Refresh</button>}><ErrorBox error={error}/><input className={input} aria-label="Search reports" placeholder="Search patient name, ID or assessment area" value={search} onChange={e=>setSearch(e.target.value)}/><section className={card}>{!loaded && !error && <p>Loading reports…</p>}{loaded && !visible.length && <p className="text-sm text-slate-500">No matching reports. Complete a patient visit review to prepare a report.</p>}{visible.map(v=><div key={v.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 py-4"><div><p className="font-semibold">{v.patient_name} · {v.patient_code}</p><p className="mt-1 text-sm text-slate-500">{v.module} · {v.date} · {v.released ? 'Released to patient' : v.signed ? 'Finalized · release pending' : v.review.complete ? 'Draft · finalization pending' : 'Review required'}</p></div><Link className={button} to={`/doctor/visits/${v.id}`}>Open report workflow →</Link></div>)}</section></Shell>
}
