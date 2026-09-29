import React, { useState } from 'react'
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  HeartPulse,
  FileText,
  Calendar,
  Clock,
  User,
  HelpCircle,
  LogOut,
  PhoneCall,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import InitialsAvatar from '../common/InitialsAvatar'

const NAV_ITEMS = [
  { to: '/patient/dashboard', label: 'Dashboard', icon: HeartPulse },
  { to: '/patient/reports', label: 'My Reports', icon: FileText },
  { to: '/patient/appointments', label: 'Appointments', icon: Calendar },
  { to: '/patient/timeline', label: 'Health Timeline', icon: Clock },
  { to: '/patient/profile', label: 'My Profile', icon: User },
]

export default function PatientSidebar({ patientInfo }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const pathname = location.pathname
  const [showSupportModal, setShowSupportModal] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }


  const patientName = patientInfo?.full_name || 'Anita Sharma'
  const patientCode = patientInfo?.patient_code || 'P-2026-0001'

  return (
    <div className="w-[220px] h-full flex flex-col bg-white text-slate-700 border-r border-teal-100 select-none overflow-hidden shrink-0 shadow-xs">
      {/* AuraMed Logo Header */}
      <div className="flex h-16 items-center px-4 border-b border-teal-50 shrink-0">
        <Link to="/patient/dashboard" className="flex items-center space-x-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-base shadow-xs shrink-0">
            A
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold tracking-tight text-slate-800 block truncate leading-tight">
              Aura<span className="text-teal-600">Med</span>
            </span>
            <span className="text-[9px] font-semibold tracking-wider text-teal-600 uppercase block leading-tight">
              Patient Portal
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 p-2.5 overflow-y-auto">
        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          My Care
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.to ||
            (item.to === '/patient/reports' && pathname.startsWith('/patient/reports/'))
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-teal-50 text-teal-700 border border-teal-200/80 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50/50 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0 text-teal-600" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom Need Help Button */}
      <div className="p-2.5 border-t border-teal-50 shrink-0 space-y-2 bg-slate-50/60">
        <button
          onClick={() => setShowSupportModal(true)}
          className="w-full flex items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <PhoneCall className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Talk to support team</span>
        </button>

        {/* Patient Profile */}
        <div className="p-2 rounded-lg bg-white border border-teal-100 flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            <InitialsAvatar name={patientName} size={28} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{patientName}</p>
              <p className="text-[9px] text-teal-600 font-medium truncate leading-tight">{patientCode}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-slate-100 rounded transition-colors"
            title="Log out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Support Modal */}
      {showSupportModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in"
          onClick={() => setShowSupportModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 border border-teal-100 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-teal-800">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-sm">AuraMed Patient Care</h3>
              </div>
              <button
                onClick={() => setShowSupportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Our clinical care coordinators are available Monday to Saturday, 8 AM – 8 PM IST.
            </p>
            <div className="p-3 bg-teal-50 rounded-xl space-y-1 text-xs">
              <p className="font-semibold text-teal-900">Toll-Free Patient Helpline:</p>
              <p className="text-teal-700 font-mono font-bold text-sm">1800-AURA-CARE (1800-287-2227)</p>
              <p className="text-[11px] text-teal-600">Email: care@auramed.health</p>
            </div>
            <button
              onClick={() => setShowSupportModal(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
