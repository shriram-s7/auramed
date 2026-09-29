import React from 'react'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import DoctorLayout from './components/common/DoctorLayout'
import AdminLayout from './components/common/AdminLayout'
import PatientLayout from './components/common/PatientLayout'
import DevTestingPanel from './components/dev/DevTestingPanel'

// Public Pages
import LandingPage from './pages/public/LandingPage'
import LoginPage from './pages/public/LoginPage'
import RegisterPage from './pages/public/RegisterPage'
import DoctorLoginPage from './pages/public/DoctorLoginPage'
import PatientLoginPage from './pages/public/PatientLoginPage'
import AdminLoginPage from './pages/public/AdminLoginPage'
import DoctorRegisterPage from './pages/public/DoctorRegisterPage'
import ForbiddenPage from './pages/public/ForbiddenPage'
import NotFoundPage from './pages/public/NotFoundPage'

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminDoctors from './pages/admin/AdminDoctors'
import AdminPatients from './pages/admin/AdminPatients'
import AdminScans from './pages/admin/AdminScans'
import AdminReports from './pages/admin/AdminReports'
import AdminAppointments from './pages/admin/AdminAppointments'
import AdminAuditLogs from './pages/admin/AdminAuditLogs'
import AdminDataRequests from './pages/admin/AdminDataRequests'
import AdminSettings from './pages/admin/AdminSettings'

// Doctor Pages
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import DoctorPatients from './pages/doctor/DoctorPatients'
import NewPatient from './pages/doctor/NewPatient'
import PatientDetail from './pages/doctor/PatientDetail'
import ScanModule from './pages/doctor/ScanModule'
import ScanResults from './pages/doctor/ScanResults'
import ScanReport from './pages/doctor/ScanReport'
import ScanShare from './pages/doctor/ScanShare'
import DoctorAppointments from './pages/doctor/DoctorAppointments'
import DoctorReports from './pages/doctor/DoctorReports'
import ReportDetail from './pages/doctor/ReportDetail'
import DoctorReferrals from './pages/doctor/DoctorReferrals'
import DoctorReferralNew from './pages/doctor/DoctorReferralNew'
import DoctorActivity from './pages/doctor/DoctorActivity'
import DoctorSettings from './pages/doctor/DoctorSettings'

// Patient Pages
import PatientDashboard from './pages/patient/PatientDashboard'
import PatientReports from './pages/patient/PatientReports'
import PatientReportDetail from './pages/patient/PatientReportDetail'
import PatientAppointments from './pages/patient/PatientAppointments'
import PatientTimeline from './pages/patient/PatientTimeline'
import PatientProfile from './pages/patient/PatientProfile'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {import.meta.env.DEV && <DevTestingPanel />}
        <Routes>
          {/* ================= PUBLIC ROUTES ================= */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Legacy login redirects/fallbacks to unified LoginPage */}
          <Route path="/login/doctor" element={<LoginPage />} />
          <Route path="/login/patient" element={<LoginPage />} />
          <Route path="/login/admin" element={<LoginPage />} />
          <Route path="/register/doctor" element={<DoctorRegisterPage />} />
          <Route path="/403" element={<ForbiddenPage />} />

          {/* ================= DOCTOR PORTAL (role: doctor) ================= */}
          <Route
            path="/doctor"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <DoctorDashboard />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/doctor/dashboard" element={<Navigate to="/doctor" replace />} />
          <Route
            path="/doctor/patients"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <DoctorPatients />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/patients/new"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <NewPatient />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/patients/:id"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <PatientDetail />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/patients/:patientId"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <PatientDetail />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/appointments"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <DoctorAppointments />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/scan/breast"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ScanModule initialModule="breast" />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/scan/cervical"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ScanModule initialModule="cervical" />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/scan/pcos"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ScanModule initialModule="pcos" />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/scan/:module"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ScanModule />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/scan/breast/results/:id"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ScanResults />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/scan/cervical/results/:id"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ScanResults />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/scan/pcos/results/:id"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ScanResults />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/scan/:module/results/:id"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ScanResults />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/scan/:module/results/:scanId"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ScanResults />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/reports"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <DoctorReports />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/reports/:id"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ReportDetail />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/reports/:reportId"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ReportDetail />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/scan/breast/report/:id"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ScanReport />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/scan/cervical/report/:id"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ScanReport />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/scan/pcos/report/:id"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ScanReport />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/scan/:module/report/:id"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ScanReport />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/scan/:module/report/:scanId"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ScanReport />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/scan/:module/share/:scanId"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <ScanShare />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/referrals"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <DoctorReferrals />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/referrals/new"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <DoctorReferralNew />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/referrals/new/:patientId"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <DoctorReferralNew />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/activity"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <DoctorActivity />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/settings"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorLayout>
                  <DoctorSettings />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />

          {/* ================= PATIENT PORTAL (role: patient) ================= */}
          <Route
            path="/patient"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientLayout>
                  <PatientDashboard />
                </PatientLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/patient/dashboard" element={<Navigate to="/patient" replace />} />
          <Route
            path="/patient/appointments"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientLayout>
                  <PatientAppointments />
                </PatientLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/reports"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientLayout>
                  <PatientReports />
                </PatientLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/reports/:id"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientLayout>
                  <PatientReportDetail />
                </PatientLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/reports/:reportId"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientLayout>
                  <PatientReportDetail />
                </PatientLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/timeline"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientLayout>
                  <PatientTimeline />
                </PatientLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/profile"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientLayout>
                  <PatientProfile />
                </PatientLayout>
              </ProtectedRoute>
            }
          />

          {/* ================= ADMIN PORTAL (role: admin) ================= */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
          <Route
            path="/admin/doctors"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminDoctors />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/patients"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminPatients />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/scans"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminScans />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminReports />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/appointments"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminAppointments />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminAuditLogs />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/data-requests"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminDataRequests />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminSettings />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* Fallback 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
