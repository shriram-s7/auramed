import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  Menu,
  Bell,
  ChevronDown,
  ShieldCheck,
  LogOut,
  User,
  Settings,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function AdminTopbar({ search, onSearchChange, notificationCount = 5, onToggleSidebar = () => {}, sidebarOpen = true }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const NOTIFICATIONS = [
    {
      id: 1,
      title: 'New Doctor Verification Request',
      detail: 'Dr. Arvind Menon submitted medical registration credentials',
      time: '12m ago',
      type: 'info'
    },
    {
      id: 2,
      title: 'Data Deletion Request Filed',
      detail: 'Patient Sunita Verma requested DPDP erasure under Right to be Forgotten',
      time: '45m ago',
      type: 'warning'
    },
    {
      id: 3,
      title: 'AI Model Benchmark Routine OK',
      detail: 'Multi-modal inference engine passed daily validation suite at 99.4% accuracy',
      time: '2h ago',
      type: 'success'
    },
    {
      id: 4,
      title: 'Audit Log Retention Cycle',
      detail: 'Immutable log archiving completed with 0 errors',
      time: '4h ago',
      type: 'info'
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
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
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
          placeholder="Search users, doctors, reports, or requests..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
        />
        </div>
      </div>

      {/* Right Controls: Notification Bell & Admin Profile Dropdown */}
      <div className="flex items-center space-x-3">
        {/* Notification Bell with Badge */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications)
              setShowUserMenu(false)
            }}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {notificationCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div
              onMouseLeave={() => setShowNotifications(false)}
              className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 text-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-900 text-sm">System Notifications</span>
                <span className="text-[10px] font-semibold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200">
                  {notificationCount} new
                </span>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto no-scrollbar">
                {NOTIFICATIONS.map(n => (
                  <div key={n.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-800 text-[11px]">{n.title}</p>
                      <span className="text-[10px] text-slate-400">{n.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{n.detail}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <Link
                  to="/admin/audit-logs"
                  onClick={() => setShowNotifications(false)}
                  className="text-[11px] font-semibold text-teal-600 hover:text-teal-800 underline"
                >
                  View All in Audit Logs
                </Link>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200" />

        {/* Admin User Avatar (Initials AD), System Administrator label, Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu)
              setShowNotifications(false)
            }}
            className="flex items-center space-x-2.5 p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-left"
          >
            {/* Initials Avatar AD */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
              AD
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-slate-900 leading-tight">Admin User</p>
              <p className="text-[10px] font-medium text-slate-400 leading-tight">System Administrator</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* User Profile Dropdown Menu */}
          {showUserMenu && (
            <div
              onMouseLeave={() => setShowUserMenu(false)}
              className="absolute right-0 top-12 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="px-3.5 py-2 border-b border-slate-100">
                <p className="font-bold text-slate-900">Admin User</p>
                <p className="text-[11px] text-slate-400 truncate">admin@auramed.com</p>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 mt-1">
                  Root Administrator
                </span>
              </div>

              <Link
                to="/admin/settings"
                onClick={() => setShowUserMenu(false)}
                className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>System Settings</span>
              </Link>

              <Link
                to="/admin/audit-logs"
                onClick={() => setShowUserMenu(false)}
                className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Security & Audits</span>
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
