import { useState } from 'react'
import { Bell, ChevronDown, LogOut, Menu, Search, Settings } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import InitialsAvatar from '../common/InitialsAvatar'
import { useAuth } from '../../context/AuthContext'

export default function DoctorNavbar({
  doctor,
  notificationCount = 0,
  notifications = [],
  search = '',
  onSearchChange = () => {},
  onToggleSidebar = () => {},
  sidebarOpen = true,
}) {
  const [bellOpen, setBellOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }


  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-border bg-surface px-4 sm:px-6 shrink-0 z-20">
      {/* Left section: Hamburger button & Patient search */}
      <div className="flex items-center gap-3 w-full max-w-md">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-primary/70 hover:bg-background hover:text-primary transition focus:outline-none focus:ring-2 focus:ring-accent/40"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <Menu size={20} />
        </button>

        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary/40"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search patients, scans, reports..."
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-sm text-primary placeholder:text-primary/40 outline-none focus:ring-2 focus:ring-accent/40 transition"
          />
        </div>
      </div>

      {/* Right section: Notifications & Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setBellOpen((v) => !v)
              setProfileOpen(false)
            }}
            className="relative rounded-lg p-2 text-primary/70 hover:bg-background hover:text-primary transition focus:outline-none"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {notificationCount > 0 && (
              <span className="absolute 1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white shadow-xs">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-border bg-surface p-2 shadow-xl animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/50">
                <p className="text-xs font-semibold text-primary">Notifications</p>
                <span className="text-[10px] font-medium text-primary/50">{notifications.length} unread</span>
              </div>
              {notifications.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-primary/50">No notifications yet</p>
              ) : (
                <ul className="max-h-72 space-y-1 overflow-y-auto py-1">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-lg p-2 text-xs hover:bg-background transition text-primary"
                    >
                      <p className="font-medium">{n.message}</p>
                      <p className="text-[10px] text-primary/40 mt-0.5">
                        {n.created_at ? new Date(n.created_at).toLocaleString() : 'Just now'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Doctor Profile Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen((v) => !v)
              setBellOpen(false)
            }}
            className="flex items-center gap-2.5 rounded-lg py-1 pl-1.5 pr-2.5 hover:bg-background transition focus:outline-none"
          >
            <InitialsAvatar name={doctor?.full_name || 'Dr. Mehta'} size={32} />
            <div className="hidden text-left sm:block">
              <p className="text-xs font-bold text-primary leading-tight">
                {doctor?.full_name || 'Dr. Kavitha Mehta'}
              </p>
              <p className="text-[10px] text-primary/50 leading-tight">
                {doctor?.registration_number || 'TNMC123456'}
              </p>
            </div>
            <ChevronDown size={14} className="text-primary/40 hidden sm:block" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 z-30 mt-2 w-48 rounded-xl border border-border bg-surface p-1 shadow-xl animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-border/50 sm:hidden">
                <p className="text-xs font-bold text-primary">{doctor?.full_name || 'Dr. Mehta'}</p>
                <p className="text-[10px] text-primary/50">{doctor?.registration_number || 'TNMC123456'}</p>
              </div>
              <Link
                to="/doctor/settings"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-primary hover:bg-background transition"
              >
                <Settings size={15} className="text-primary/60" /> Settings
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-danger hover:bg-danger/10 transition"
              >
                <LogOut size={15} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
