import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const PORTAL_BY_ROLE = {
  admin: '/admin',
  doctor: '/doctor',
  patient: '/patient',
}

function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, role } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    const targetPortal = PORTAL_BY_ROLE[role] || '/login'
    return <Navigate to={targetPortal} replace />
  }

  return children
}

export default ProtectedRoute

