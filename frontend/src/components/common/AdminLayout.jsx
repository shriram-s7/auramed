import React, { createContext, useContext, useState } from 'react'
import { Outlet } from 'react-router-dom'
import AdminSidebar from '../admin/AdminSidebar'
import AdminTopbar from '../admin/AdminTopbar'

export const AdminLayoutContext = createContext(false)

export default function AdminLayout({ children }) {
  const isAlreadyInAdminLayout = useContext(AdminLayoutContext)
  if (isAlreadyInAdminLayout) {
    return <>{children}</>
  }

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('auramed_admin_sidebar_open')
      return saved !== null ? saved === 'true' : true
    } catch {
      return true
    }
  })
  const [search, setSearch] = useState('')

  function toggleSidebar() {
    setSidebarOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem('auramed_admin_sidebar_open', String(next))
      } catch {}
      return next
    })
  }

  return (
    <AdminLayoutContext.Provider value={true}>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 antialiased">
        {/* Left: AdminSidebar (fixed 220px, slides in/out with transition) */}
        <aside
          className={`h-full shrink-0 overflow-hidden transition-all duration-300 ease-in-out select-none ${
            sidebarOpen ? 'w-[220px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
          }`}
          aria-hidden={!sidebarOpen}
        >
          <AdminSidebar />
        </aside>

        {/* Right: Main Content Area */}
        <div className="flex flex-1 flex-col h-full overflow-hidden min-w-0">
          <AdminTopbar
            search={search}
            onSearchChange={setSearch}
            onToggleSidebar={toggleSidebar}
            sidebarOpen={sidebarOpen}
          />
          <main className="flex-1 overflow-y-auto min-h-0 p-6">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </AdminLayoutContext.Provider>
  )
}
