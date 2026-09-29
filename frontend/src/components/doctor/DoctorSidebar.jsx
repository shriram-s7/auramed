import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Activity,
  Calendar,
  ChevronDown,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Microscope,
  Send,
  Settings,
  Users,
} from 'lucide-react'
import InitialsAvatar from '../common/InitialsAvatar'

const SCAN_MODULES = [
  { key: 'breast', label: 'Breast Cancer' },
  { key: 'cervical', label: 'Cervical Cancer' },
  { key: 'pcos', label: 'PCOS' },
]

export default function DoctorSidebar({ doctor }) {
  const location = useLocation()
  const pathname = location.pathname

  // Active state matching rules
  const isDashboard = pathname === '/doctor/dashboard'
  const isPatients =
    pathname === '/doctor/patients' || pathname.startsWith('/doctor/patients/')
  const isScan = pathname.startsWith('/doctor/scan')
  const isAppointments = pathname.startsWith('/doctor/appointments')
  const isReports =
    pathname === '/doctor/reports' || pathname.startsWith('/doctor/reports/')
  const isReferrals = pathname.startsWith('/doctor/referrals')
  const isActivity = pathname.startsWith('/doctor/activity')
  const isSettings = pathname.startsWith('/doctor/settings')

  // Scan Workbench auto-expand when on any scan route
  const [scanOpen, setScanOpen] = useState(true)
  useEffect(() => {
    if (isScan) {
      setScanOpen(true)
    }
  }, [isScan])

  const getNavLinkClass = (isActive) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
      isActive
        ? 'bg-accent text-white font-semibold shadow-sm'
        : 'text-white/70 hover:bg-white/10 hover:text-white'
    }`

  return (
    <div className="w-[220px] h-full flex flex-col bg-primary text-white border-r border-white/10 select-none overflow-hidden shrink-0">
      {/* Brand Header */}
      <div className="flex h-16 items-center px-4 border-b border-white/10 shrink-0">
        <Link to="/doctor/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-bold shadow-xs">
            A
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold tracking-tight text-white block">AuraMed</span>
            <span className="block text-[10px] text-accent font-medium -mt-0.5 tracking-wider uppercase">
              Clinician
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
        <Link to="/doctor/dashboard" className={getNavLinkClass(isDashboard)}>
          <LayoutDashboard size={16} className="shrink-0" />
          <span className="truncate">Dashboard</span>
        </Link>

        <Link to="/doctor/patients" className={getNavLinkClass(isPatients)}>
          <Users size={16} className="shrink-0" />
          <span className="truncate">Patients</span>
        </Link>

        {/* Scan Workbench (highlights and auto-expands on /doctor/scan/*) */}
        <div>
          <button
            type="button"
            onClick={() => setScanOpen((v) => !v)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ${
              isScan
                ? 'bg-accent/20 text-accent font-semibold'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Microscope size={16} className="shrink-0" />
              <span className="truncate">Scan Workbench</span>
            </div>
            <ChevronDown
              size={14}
              className={`shrink-0 transition-transform duration-200 ${
                scanOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
          {scanOpen && (
            <div className="ml-5 mt-1 space-y-1 border-l border-white/15 pl-2.5 py-0.5">
              {SCAN_MODULES.map((mod) => {
                const isModActive =
                  pathname === `/doctor/scan/${mod.key}` ||
                  pathname.startsWith(`/doctor/scan/${mod.key}/`)
                return (
                  <Link
                    key={mod.key}
                    to={`/doctor/scan/${mod.key}`}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
                      isModActive
                        ? 'bg-white/15 text-white font-semibold'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        isModActive ? 'bg-accent' : 'bg-white/40'
                      }`}
                    />
                    <span className="truncate">{mod.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <Link to="/doctor/appointments" className={getNavLinkClass(isAppointments)}>
          <Calendar size={16} className="shrink-0" />
          <span className="truncate">Appointments</span>
        </Link>

        <Link to="/doctor/reports" className={getNavLinkClass(isReports)}>
          <FileText size={16} className="shrink-0" />
          <span className="truncate">Reports</span>
        </Link>

        <Link to="/doctor/referrals" className={getNavLinkClass(isReferrals)}>
          <Send size={16} className="shrink-0" />
          <span className="truncate">Referrals</span>
        </Link>

        <Link to="/doctor/activity" className={getNavLinkClass(isActivity)}>
          <Activity size={16} className="shrink-0" />
          <span className="truncate">My Activity</span>
        </Link>

        <Link to="/doctor/settings" className={getNavLinkClass(isSettings)}>
          <Settings size={16} className="shrink-0" />
          <span className="truncate">Settings</span>
        </Link>
      </nav>

      {/* Support & Clinician Profile */}
      <div className="border-t border-white/10 p-2.5 shrink-0 bg-primary/90 space-y-2">
        <a
          href="#support"
          onClick={(e) => {
            e.preventDefault()
            alert('AuraMed Doctor Support: support@auramed.health | Helpline: 1800-AURA-DOC')
          }}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white/60 hover:text-white hover:bg-white/5 transition"
        >
          <HelpCircle size={14} className="shrink-0" />
          <span className="truncate">Help & Clinical Support</span>
        </a>

        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-white/5 border border-white/5">
          <InitialsAvatar name={doctor?.full_name || 'Dr. Mehta'} size={30} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white leading-tight">
              {doctor?.full_name || 'Dr. Kavitha Mehta'}
            </p>
            <p className="truncate text-[10px] text-white/50 leading-tight">
              {doctor?.registration_number || 'TNMC123456'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
