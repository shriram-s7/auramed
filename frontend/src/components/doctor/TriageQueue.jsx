import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, AlertTriangle, SlidersHorizontal } from 'lucide-react'

const labels = { review: 'Review', priority: 'Priority', routine: 'Routine' }
const colors = { review: 'bg-amber-50 text-amber-900 border-amber-200', priority: 'bg-rose-50 text-rose-900 border-rose-200', routine: 'bg-teal-50 text-teal-900 border-teal-200' }
const score = value => value == null ? 'Unavailable' : `${Math.round(value * 100)} / 100`

export default function TriageQueue({ rows, onDecision, onReferral }) {
  const [queue, setQueue] = useState('all')
  const visible = rows.filter(row => queue === 'all' || row.queue === queue)
  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-xl font-semibold">A clear next step for every case</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Uncertainty and disagreement are surfaced first. Clinicians set the final priority; routine does not mean a negative diagnosis.</p></div>
      <span className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500 border border-slate-200">Rules v1.0 · research workflow</span>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Filter triage queue">{['all', 'review', 'priority', 'routine'].map(key => <button key={key} aria-pressed={queue === key} onClick={() => setQueue(key)} className={`rounded-xl border p-4 text-left transition ${queue === key ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600' : 'border-slate-200 bg-white hover:border-teal-300'}`}><span className="text-xs font-semibold text-slate-500">{key === 'all' ? 'All cases' : labels[key]}</span><span className="mt-1 block text-2xl font-semibold">{rows.filter(r => key === 'all' || r.queue === key).length}</span></button>)}</div>
    {visible.map(row => <article key={row.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{row.patient_name}</h3><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${colors[row.queue]}`}>{labels[row.queue]}</span>{row.elevated_flag && <span className="text-xs font-semibold text-rose-700">Elevated research flag</span>}</div><p className="mt-2 text-xs text-slate-500">{row.module.toUpperCase()} · {row.date || 'Date not recorded'}{row.synthetic ? ' · Synthetic demonstration' : ''}</p></div><button onClick={() => onDecision(row)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"><SlidersHorizontal size={15}/>Set review priority</button></div>
      <div className="mx-5 rounded-xl bg-slate-50 p-4"><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600"><AlertTriangle size={14}/>Why this case is here</p><ul className="space-y-1 text-sm text-slate-600">{(row.reasons || [row.reason]).map(reason => <li key={reason}>{reason}</li>)}</ul></div>
      <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">{[['Image output', row.scores?.image], ['Clinical score', row.scores?.clinical], ['Combined score', row.scores?.fusion], ['Confidence heuristic', row.scores?.confidence]].map(([name,value]) => <div key={name}><p className="text-xs text-slate-500">{name}</p><p className="mt-1 font-semibold tabular-nums">{score(value)}</p><div className="mt-2 h-1 rounded-full bg-slate-100"><div className="h-1 rounded-full bg-teal-600" style={{width: `${value == null ? 0 : value * 100}%`}}/></div></div>)}</div>
      {row.override && <div className="mx-5 mb-4 rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm text-teal-900"><strong>Clinician priority: {labels[row.override.queue]}.</strong> {row.override.note}<p className="mt-1 text-xs">Recorded {new Date(row.override.at).toLocaleString()} · Original suggestion: {labels[row.suggested_queue]}</p></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-4"><p className="max-w-md text-xs text-slate-500">Scores are research outputs, not calibrated disease probabilities.{!row.has_image && ' No source image is attached.'}</p><div className="flex gap-2"><button onClick={() => onReferral(row)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">Create referral</button>{row.has_image && <Link to={`/doctor/scan/${row.module}/results/${row.id}`} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Review scan <ArrowRight size={14}/></Link>}</div></div>
    </article>)}
    {!visible.length && <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">No cases in this queue.</p>}
  </section>
}
