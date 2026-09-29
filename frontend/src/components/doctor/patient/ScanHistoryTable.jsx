import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import RiskBadge from '../../common/RiskBadge'
import ModulePill from '../../common/ModulePill'
import RotterdamBadge from '../../common/RotterdamBadge'

function ScanHistoryTable({ scans }) {
  const [expanded, setExpanded] = useState(null)
  const [moduleFilter, setModuleFilter] = useState('all')

  const filtered = moduleFilter === 'all' ? scans : scans.filter((s) => s.module === moduleFilter)

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-primary outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="all">All Modules</option>
          <option value="breast">Breast Cancer</option>
          <option value="cervical">Cervical Cancer</option>
          <option value="pcos">PCOS</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-primary/50">
          No scans recorded.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-primary/40">
              <tr>
                <th className="w-8 px-3 py-3" />
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Module</th>
                <th className="px-3 py-3 font-medium">Image Quality</th>
                <th className="px-3 py-3 font-medium">Risk</th>
                <th className="px-3 py-3 font-medium">Confidence</th>
                <th className="px-3 py-3 font-medium">Doctor</th>
                <th className="px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((scan) => (
                <Fragment key={scan.id}>
                  <tr className="border-b border-border last:border-0 hover:bg-background/60">
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === scan.id ? null : scan.id)}
                        className="text-primary/40 hover:text-primary"
                      >
                        {expanded === scan.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-primary/70">{scan.scan_date || '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ModulePill module={scan.module} />
                        {scan.module === 'pcos' && (
                          <RotterdamBadge
                            positive={scan.rotterdam_positive}
                            pending={scan.rotterdam_positive === null || scan.rotterdam_positive === undefined}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-primary/70">{scan.image_quality || '—'}</td>
                    <td className="px-3 py-3">
                      <RiskBadge level={scan.risk_level} />
                    </td>
                    <td className="px-3 py-3 text-primary/70">
                      {scan.confidence_score != null ? `${Math.round(scan.confidence_score * 100)}%` : '—'}
                    </td>
                    <td className="px-3 py-3 text-primary/70">{scan.doctor_name || '—'}</td>
                    <td className="px-3 py-3 capitalize text-primary/70">{scan.status}</td>
                  </tr>
                  {expanded === scan.id && (
                    <tr className="border-b border-border bg-background/40">
                      <td />
                      <td colSpan={7} className="px-3 py-3">
                        <p className="text-xs font-semibold text-primary/60">Clinical inputs used</p>
                        <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-primary/60">
                          {scan.clinical_inputs
                            ? JSON.stringify(scan.clinical_inputs, null, 2)
                            : 'No structured clinical inputs recorded for this scan.'}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ScanHistoryTable
