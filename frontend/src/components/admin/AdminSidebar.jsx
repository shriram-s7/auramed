import React from 'react'
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  UserCheck,
  Users,
  ScanLine,
  FileText,
  Calendar,
  ScrollText,
  FileX2,
  ShieldAlert,
  Trash2,
  Settings,
  HelpCircle,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/doctors', label: 'Doctors', icon: UserCheck },
  { to: '/admin/patients', label: 'Patients', icon: Users },
  { to: '/admin/scans', label: 'All Scans', icon: ScanLine },
  { to: '/admin/reports', label: 'All Reports', icon: FileText },
  { to: '/admin/appointments', label: 'Appointments', icon: Calendar },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { to: '/admin/data-requests', label: 'Data Requests', icon: ShieldAlert },
  { to: '/admin/settings', label: 'System Settings', icon: Settings },
]

export default function AdminSidebar() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const pathname = location.pathname

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }


  return (
    <div className="w-[220px] h-full flex flex-col bg-slate-950 text-white border-r border-slate-800 select-none overflow-hidden shrink-0">
      {/* Brand Header */}
      <div className="flex h-16 items-center px-4 border-b border-slate-800/80 shrink-0">
        <Link to="/admin/dashboard" className="flex items-center space-x-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 font-black text-base shadow-xs shrink-0">
            A
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold tracking-tight text-white block truncate leading-tight">
              Aura<span className="text-teal-400">Med</span>
            </span>
            <span className="text-[9px] font-semibold tracking-wider text-teal-400/80 uppercase block leading-tight">
              Admin Console
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 p-2.5 overflow-y-auto">
        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Governance
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.to || pathname.startsWith(item.to + '/')
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Support & Admin Profile */}
      <div className="p-2.5 border-t border-slate-900 shrink-0 space-y-2 bg-slate-950">
        <a
          href="#help"
          onClick={(e) => {
            e.preventDefault()
            alert('AuraMed Admin Support: Contact support@auramed.health for platform escalations.')
          }}
          className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          <span className="truncate">Help and Support</span>
        </a>

        <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
              AD
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white truncate leading-tight">Admin User</p>
              <p className="text-[9px] text-teal-400 truncate leading-tight">System Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
