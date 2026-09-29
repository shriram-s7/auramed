import React from 'react'

export default function RotterdamBadge({ positive, pending = false, className = '' }) {
  if (pending || positive === null || positive === undefined) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200 whitespace-nowrap ${className}`}
      >
        Pending
      </span>
    )
  }

  if (positive) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 whitespace-nowrap ${className}`}
      >
        Rotterdam +
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 whitespace-nowrap ${className}`}
    >
      Rotterdam -
    </span>
  )
}
