import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  Menu,
  Bell,
  ChevronDown,
  User,
  LogOut,
  ShieldCheck,
  Calendar,
  FileText,
  HelpCircle
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import InitialsAvatar from '../common/InitialsAvatar'

export default function PatientTopbar({ search, onSearchChange, patientInfo, onToggleSidebar = () => {}, sidebarOpen = true }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const patientName = patientInfo?.full_name || 'Anita Sharma'
  const patientCode = patientInfo?.patient_code || 'P-2026-0001'

  const NOTIFICATIONS = [
    {
      id: 1,
      title: 'New Clinical Report Available',
      detail: 'Your recent breast imaging screening report is ready for viewing',
      time: '1h ago',
      link: '/patient/reports/rep-demo-01'
    },
    {
      id: 2,
      title: 'Upcoming Appointment Reminder',
      detail: 'Follow-up consultation scheduled with Dr. Kavitha Mehta on Sep 18',
      time: '1d ago',
      link: '/patient/appointments'
    },
    {
      id: 3,
      title: 'Health Tip of the Week',
      detail: '3 simple nutrition habits that promote hormonal balance and breast wellness',
      time: '3d ago',
      link: '/patient/dashboard'
    }
  ]

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }


  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 z-20 shrink-0">
      {/* Left: Hamburger & Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-600 hover:text-teal-700 hover:bg-teal-50 transition-colors focus:outline-none"
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="relative flex-1">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search || ''}
          onChange={e => onSearchChange && onSearchChange(e.target.value)}
          placeholder="Search your reports, appointments, or health topics..."
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
        />
        </div>
      </div>

      {/* Right Controls: Notification Bell + Patient Profile Dropdown */}
      <div className="flex items-center space-x-3">
        {/* Notification Bell with Badge */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications)
              setShowUserMenu(false)
            }}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative"
            title="Care notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-teal-500 rounded-full ring-2 ring-white" />
          </button>

          {/* Notifications dropdown */}
          {showNotifications && (
            <div
              onMouseLeave={() => setShowNotifications(false)}
              className="absolute right-0 top-11 w-80 bg-white rounded-3xl shadow-xl border border-slate-200 p-4 z-50 text-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-900 text-sm">Health Updates</span>
                <span className="text-[10px] font-semibold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200">
                  {NOTIFICATIONS.length} new
                </span>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto no-scrollbar">
                {NOTIFICATIONS.map(n => (
                  <Link
                    key={n.id}
                    to={n.link}
                    onClick={() => setShowNotifications(false)}
                    className="block p-2.5 rounded-2xl bg-slate-50 hover:bg-teal-50/40 border border-slate-100 space-y-1 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-800 text-[11px]">{n.title}</p>
                      <span className="text-[10px] text-slate-400">{n.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{n.detail}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200" />

        {/* Patient Name and Patient ID with Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu)
              setShowNotifications(false)
            }}
            className="flex items-center space-x-2.5 p-1 rounded-2xl hover:bg-slate-50 transition-colors text-left"
          >
            {/* Initials avatar only */}
            <InitialsAvatar name={patientName} size={34} />
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-slate-900 leading-tight">{patientName}</p>
              <p className="text-[10px] font-mono text-slate-400 leading-tight">ID: {patientCode}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* User menu dropdown */}
          {showUserMenu && (
            <div
              onMouseLeave={() => setShowUserMenu(false)}
              className="absolute right-0 top-12 w-52 bg-white rounded-3xl shadow-xl border border-slate-200 py-2 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="px-3.5 py-2 border-b border-slate-100">
                <p className="font-bold text-slate-900">{patientName}</p>
                <p className="text-[10px] font-mono text-teal-600 font-semibold">{patientCode}</p>
              </div>

              <Link
                to="/patient/profile"
                onClick={() => setShowUserMenu(false)}
                className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>My Profile</span>
              </Link>

              <Link
                to="/patient/reports"
                onClick={() => setShowUserMenu(false)}
                className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>My Reports</span>
              </Link>

              <Link
                to="/patient/appointments"
                onClick={() => setShowUserMenu(false)}
                className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Appointments</span>
              </Link>

              <div className="border-t border-slate-100 my-1" />

              <button
                onClick={handleLogout}
                className="w-full px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center space-x-2 font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
