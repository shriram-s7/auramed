import React, { createContext, useContext, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import PatientSidebar from '../patient/PatientSidebar'
import PatientTopbar from '../patient/PatientTopbar'
import { fetchPatientDashboard } from '../../services/patientPortalService'

export const PatientLayoutContext = createContext(false)

export default function PatientLayout({ children }) {
  const isAlreadyInPatientLayout = useContext(PatientLayoutContext)
  if (isAlreadyInPatientLayout) {
    return <>{children}</>
  }

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('auramed_patient_sidebar_open')
      return saved !== null ? saved === 'true' : true
    } catch {
      return true
    }
  })

  const [search, setSearch] = useState('')
  const [patientInfo, setPatientInfo] = useState(null)

  useEffect(() => {
    fetchPatientDashboard()
      .then((res) => {
        if (res.data?.patient) {
          setPatientInfo(res.data.patient)
        }
      })
      .catch(() => {})
  }, [])

  function toggleSidebar() {
    setSidebarOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem('auramed_patient_sidebar_open', String(next))
      } catch {}
      return next
    })
  }

  return (
    <PatientLayoutContext.Provider value={true}>
      <div className="flex h-screen w-screen overflow-hidden bg-[#fafbfc] text-slate-800 antialiased">
        {/* Left: PatientSidebar (fixed 220px, slides in/out with transition) */}
        <aside
          className={`h-full shrink-0 overflow-hidden transition-all duration-300 ease-in-out select-none ${
            sidebarOpen ? 'w-[220px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
          }`}
          aria-hidden={!sidebarOpen}
        >
          <PatientSidebar patientInfo={patientInfo} />
        </aside>

        {/* Right: Main Content Area */}
        <div className="flex flex-1 flex-col h-full overflow-hidden min-w-0">
          <PatientTopbar
            search={search}
            onSearchChange={setSearch}
            patientInfo={patientInfo}
            onToggleSidebar={toggleSidebar}
            sidebarOpen={sidebarOpen}
          />
          <main className="flex-1 overflow-y-auto min-h-0 p-6 md:p-8">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </PatientLayoutContext.Provider>
  )
}
