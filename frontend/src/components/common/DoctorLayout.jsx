import React, { createContext, useContext, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import DoctorSidebar from '../doctor/DoctorSidebar'
import DoctorNavbar from '../doctor/DoctorNavbar'
import { fetchCurrentUser } from '../../services/authService'
import { fetchNotifications } from '../../services/dashboardService'

export const DoctorLayoutContext = createContext({ inLayout: false, sidebarOpen: true })

export function useDoctorLayout() {
  const ctx = useContext(DoctorLayoutContext)
  return ctx || { inLayout: false, sidebarOpen: true }
}

export default function DoctorLayout({ children }) {
  const layoutCtx = useContext(DoctorLayoutContext)
  if (layoutCtx?.inLayout || layoutCtx === true) {
    return <>{children}</>
  }

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('auramed_sidebar_open')
      return saved !== null ? saved === 'true' : true
    } catch {
      return true
    }
  })

  const [doctor, setDoctor] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchCurrentUser()
      .then((res) => {
        if (res.data?.profile) setDoctor(res.data.profile)
      })
      .catch(() => {})
    fetchNotifications()
      .then((res) => {
        if (res.data) setNotifications(res.data)
      })
      .catch(() => {})
  }, [])

  function toggleSidebar() {
    setSidebarOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem('auramed_sidebar_open', String(next))
        window.dispatchEvent(new Event('sidebar-toggle'))
      } catch {}
      return next
    })
  }

  return (
    <DoctorLayoutContext.Provider value={{ inLayout: true, sidebarOpen, toggleSidebar }}>
      {/* Outer div: flex, full height, full width, overflow hidden */}
      <div className="flex h-screen w-screen overflow-hidden bg-background text-primary antialiased">
        {/* Left: DoctorSidebar (fixed width 220px, full height, overflow-y auto, never collapses unless toggled) */}
        <aside
          className={`h-full shrink-0 overflow-hidden transition-all duration-300 ease-in-out select-none ${
            sidebarOpen ? 'w-[220px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
          }`}
          aria-hidden={!sidebarOpen}
        >
          <DoctorSidebar doctor={doctor} />
        </aside>

        {/* Right: main content area (flex-1, overflow-y auto, full height) */}
        <div className="flex flex-1 flex-col h-full overflow-hidden min-w-0">
          {/* Top: DoctorNavbar spans full width of the right content area only */}
          <DoctorNavbar
            doctor={doctor}
            notificationCount={notifications.length}
            notifications={notifications}
            search={search}
            onSearchChange={setSearch}
            onToggleSidebar={toggleSidebar}
            sidebarOpen={sidebarOpen}
          />

          {/* Scrollable page body */}
          <main className="flex-1 overflow-y-auto min-h-0 bg-background">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </DoctorLayoutContext.Provider>
  )
}
