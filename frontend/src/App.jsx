import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import DoctorLayout from './components/common/DoctorLayout'
import PatientLayout from './components/common/PatientLayout'
import AdminLayout from './components/common/AdminLayout'
import LandingPage from './pages/public/LandingPage'
import LoginPage from './pages/public/LoginPage'
import DoctorRegisterPage from './pages/public/DoctorRegisterPage'
import ForbiddenPage from './pages/public/ForbiddenPage'
import NotFoundPage from './pages/public/NotFoundPage'
import { WorkflowHome, PatientRecord, VisitReview, ReportRedirect } from './pages/doctor/GuidedWorkspace'
import { PatientList, PatientRegistration } from './pages/doctor/SimplePatients'
import SimpleSettings from './pages/doctor/SimpleSettings'
import CareHub from './pages/doctor/CareHub'
import ScanModule from './pages/doctor/ScanModule'
import DoctorReports from './pages/doctor/DoctorReports'
import PatientWorkspace from './pages/patient/PatientWorkspace'
import PatientProfile from './pages/patient/PatientProfile'
import SystemOverview from './pages/admin/SystemOverview'
import AdminDoctors from './pages/admin/AdminDoctors'
import AdminPatients from './pages/admin/AdminPatients'
import AdminScans from './pages/admin/AdminScans'
import AdminReports from './pages/admin/AdminReports'
import AdminAppointments from './pages/admin/AdminAppointments'
import AdminAuditLogs from './pages/admin/AdminAuditLogs'
import AdminDataRequests from './pages/admin/AdminDataRequests'

export default function App() {
 return <BrowserRouter><AuthProvider><Routes>
  <Route path="/" element={<LandingPage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/login/:role" element={<LoginPage />} />
  <Route path="/register" element={<Navigate to="/login" replace />} />
  <Route path="/register/doctor" element={<DoctorRegisterPage />} />
  <Route path="/403" element={<ForbiddenPage />} />
  <Route path="/doctor" element={<ProtectedRoute allowedRoles={['doctor']}><DoctorLayout /></ProtectedRoute>}>
    <Route index element={<WorkflowHome />} />
    <Route path="dashboard" element={<Navigate to="/doctor" replace />} />
    <Route path="clinical" element={<Navigate to="/doctor" replace />} />
    <Route path="activity" element={<Navigate to="/doctor" replace />} />
    <Route path="patients" element={<PatientList />} />
    <Route path="patients/new" element={<PatientRegistration />} />
    <Route path="patients/:id" element={<PatientRecord />} />
    <Route path="visits/:visitId" element={<VisitReview />} />
    <Route path="scan/:module" element={<ScanModule />} />
    <Route path="scan/:module/results/:id" element={<VisitReview />} />
    <Route path="scan/:module/report/:id" element={<VisitReview />} />
    <Route path="scan/:module/share/:scanId" element={<VisitReview />} />
    <Route path="follow-up" element={<CareHub initialTab="Appointments" />} />
    <Route path="appointments" element={<CareHub initialTab="Appointments" />} />
    <Route path="referrals" element={<CareHub initialTab="Referrals" />} />
    <Route path="referrals/new" element={<CareHub initialTab="Referrals" />} />
    <Route path="referrals/new/:patientId" element={<CareHub initialTab="Referrals" />} />
    <Route path="reports" element={<DoctorReports />} />
    <Route path="reports/:reportId" element={<ReportRedirect />} />
    <Route path="settings" element={<SimpleSettings />} />
  </Route>
  <Route path="/patient" element={<ProtectedRoute allowedRoles={['patient']}><PatientLayout /></ProtectedRoute>}>
    <Route index element={<PatientWorkspace />} />
    <Route path="dashboard" element={<Navigate to="/patient" replace />} />
    <Route path="appointments" element={<PatientWorkspace />} />
    <Route path="reports" element={<PatientWorkspace />} />
    <Route path="reports/:id" element={<PatientWorkspace />} />
    <Route path="timeline" element={<Navigate to="/patient" replace />} />
    <Route path="profile" element={<PatientProfile />} />
  </Route>
  <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
    <Route index element={<SystemOverview />} />
    <Route path="dashboard" element={<SystemOverview />} />
    <Route path="settings" element={<SystemOverview />} />
    <Route path="doctors" element={<AdminDoctors />} />
    <Route path="patients" element={<AdminPatients />} />
    <Route path="scans" element={<AdminScans />} />
    <Route path="reports" element={<AdminReports />} />
    <Route path="appointments" element={<AdminAppointments />} />
    <Route path="audit-logs" element={<AdminAuditLogs />} />
    <Route path="data-requests" element={<AdminDataRequests />} />
  </Route>
  <Route path="*" element={<NotFoundPage />} />
 </Routes></AuthProvider></BrowserRouter>
}
