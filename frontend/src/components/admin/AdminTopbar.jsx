import { Link, useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
export default function AdminTopbar({ onToggleSidebar = () => {} }) {
 const { logout } = useAuth(), navigate = useNavigate()
 return <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4"><button aria-label="Toggle sidebar" onClick={onToggleSidebar}><Menu size={20}/></button><span className="text-sm font-semibold">Administration</span><div className="flex gap-4 text-sm"><Link to="/admin/doctors">Doctor accounts</Link><Link to="/admin/audit-logs">Audit records</Link><button onClick={()=>{logout();navigate('/login')}}>Sign out</button></div></header>
}
