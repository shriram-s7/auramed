import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
export default function PatientSidebar({patientInfo}) {
 const {logout}=useAuth(), navigate=useNavigate()
 return <div className="flex h-full w-[220px] flex-col border-r border-slate-200 bg-white"><NavLink to="/patient" className="p-6 text-xl font-semibold text-teal-800">AuraMed</NavLink><nav className="flex-1 space-y-2 p-3">{[['/patient','My care'],['/patient/appointments','Appointments'],['/patient/reports','Reports'],['/patient/profile','My profile']].map(([to,label]) => <NavLink end key={to} to={to} className={({isActive})=>`block rounded-xl p-3 text-sm font-semibold ${isActive?'bg-teal-50 text-teal-800':'text-slate-600 hover:bg-slate-50'}`}>{label}</NavLink>)}</nav><div className="space-y-3 border-t border-slate-200 p-5"><p className="text-sm">{patientInfo?.full_name || 'Patient'}</p><p className="text-xs text-slate-500">{patientInfo?.patient_code || ''}</p><button className="text-sm font-semibold text-teal-800" onClick={async()=>{await logout(); navigate('/login')}}>Sign out</button></div></div>
}
