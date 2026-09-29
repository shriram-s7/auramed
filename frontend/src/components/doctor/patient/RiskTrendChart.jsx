import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const MODULE_COLORS = {
  breast: '#DB2777',
  cervical: '#9333EA',
  pcos: '#0D9488',
}

const MODULE_LABELS = {
  breast: 'Breast Cancer',
  cervical: 'Cervical Cancer',
  pcos: 'PCOS',
}

function RiskTrendChart({ riskTrend }) {
  const [module, setModule] = useState('breast')
  const points = riskTrend[module] || []
  const color = MODULE_COLORS[module]

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-primary">Risk Score Trend</p>
        <select
          value={module}
          onChange={(e) => setModule(e.target.value)}
          className="rounded-md border border-border px-2 py-1 text-xs text-primary outline-none focus:ring-2 focus:ring-accent/40"
        >
          {Object.keys(MODULE_LABELS).map((key) => (
            <option key={key} value={key}>
              {MODULE_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {points.length === 0 ? (
        <p className="mt-10 mb-10 text-center text-xs text-primary/40">
          No {MODULE_LABELS[module].toLowerCase()} scans recorded yet.
        </p>
      ) : (
        <div className="mt-3 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#0A1628' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 10, fill: '#0A1628' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#E2E8F0' }} />
              <Line type="monotone" dataKey="score" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default RiskTrendChart
