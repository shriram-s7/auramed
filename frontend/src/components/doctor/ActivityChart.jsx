import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ActivityChart({ data }) {
  const chartData = data.map((point) => ({ ...point, label: formatDate(point.date) }))

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#0A1628' }}
            interval={4}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 10, fill: '#0A1628' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#E2E8F0' }}
            labelStyle={{ fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="scans_analyzed" name="Scans Analyzed" fill="#0D9488" radius={[3, 3, 0, 0]} />
          <Bar dataKey="reports_signed" name="Reports Signed" fill="#0A1628" radius={[3, 3, 0, 0]} />
          <Bar dataKey="followups_scheduled" name="Follow-ups Scheduled" fill="#D97706" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ActivityChart
