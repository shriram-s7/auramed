import { TrendingDown, TrendingUp } from 'lucide-react'

function StatCard({ icon: Icon, label, value, changePct, highlight, subtext }) {
  const positive = typeof changePct === 'number' && changePct >= 0
  return (
    <div
      className={`rounded-xl border p-5 shadow-sm ${
        highlight ? 'border-danger/40 bg-danger/5' : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${highlight ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'}`}>
          <Icon size={18} />
        </div>
        {typeof changePct === 'number' && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${
              positive ? 'text-success' : 'text-danger'
            }`}
          >
            {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(changePct)}%
          </span>
        )}
      </div>
      <p className={`mt-4 text-2xl font-bold ${highlight ? 'text-danger' : 'text-primary'}`}>{value}</p>
      <p className="mt-1 text-xs text-primary/50">{label}</p>
      {subtext && <p className="mt-1 text-[11px] text-primary/40">{subtext}</p>}
    </div>
  )
}

export default StatCard
