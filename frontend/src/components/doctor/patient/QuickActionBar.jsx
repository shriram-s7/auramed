import React, { useState, useEffect } from 'react'
import { AlertTriangle, Calendar, FileText, Flag, ScanLine, Send, StickyNote } from 'lucide-react'
import { useDoctorLayout } from '../../common/DoctorLayout'

function QuickActionBar({
  isUrgent,
  onNewScan,
  onScheduleFollowup,
  onGenerateReport,
  onAddNote,
  onRefer,
  onToggleUrgent,
}) {
  const layoutCtx = useDoctorLayout()
  const [localSidebarOpen, setLocalSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem('auramed_sidebar_open') !== 'false'
    } catch {
      return true
    }
  })

  // Listen to sidebar-toggle and storage events for reactive sync
  useEffect(() => {
    const handleToggle = () => {
      try {
        setLocalSidebarOpen(localStorage.getItem('auramed_sidebar_open') !== 'false')
      } catch {}
    }
    window.addEventListener('storage', handleToggle)
    window.addEventListener('sidebar-toggle', handleToggle)
    return () => {
      window.removeEventListener('storage', handleToggle)
      window.removeEventListener('sidebar-toggle', handleToggle)
    }
  }, [])

  // If inside DoctorLayout, prefer context state; fallback to local state
  const sidebarOpen = layoutCtx?.sidebarOpen !== undefined ? layoutCtx.sidebarOpen : localSidebarOpen

  return (
    <div
      className={`fixed bottom-0 right-0 z-30 border-t border-border bg-surface/95 backdrop-blur transition-all duration-300 ease-in-out ${
        sidebarOpen ? 'left-[220px]' : 'left-0'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onNewScan}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 shadow-2xs transition-colors"
          >
            <ScanLine size={16} /> New Scan
          </button>
          <button
            type="button"
            onClick={onScheduleFollowup}
            className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-primary hover:border-accent hover:text-accent transition-colors"
          >
            <Calendar size={16} /> Schedule Follow-up
          </button>
          <button
            type="button"
            onClick={onGenerateReport}
            className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-primary hover:border-accent hover:text-accent transition-colors"
          >
            <FileText size={16} /> Generate Report
          </button>
          <button
            type="button"
            onClick={onAddNote}
            className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-primary hover:border-accent hover:text-accent transition-colors"
          >
            <StickyNote size={16} /> Add Note
          </button>
          <button
            type="button"
            onClick={onRefer}
            className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-primary hover:border-accent hover:text-accent transition-colors"
          >
            <Send size={16} /> Refer to Specialist
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleUrgent}
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
            isUrgent ? 'bg-danger text-white hover:bg-danger/90' : 'border border-danger text-danger bg-white hover:bg-danger/10'
          }`}
        >
          {isUrgent ? <AlertTriangle size={16} /> : <Flag size={16} />}
          {isUrgent ? 'Urgent' : 'Flag as Urgent'}
        </button>
      </div>
    </div>
  )
}

export default QuickActionBar
