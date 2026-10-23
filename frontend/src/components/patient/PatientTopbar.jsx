import { Menu } from 'lucide-react'
export default function PatientTopbar({patientInfo,onToggleSidebar}) {
 return <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-5"><button aria-label="Toggle navigation" onClick={onToggleSidebar} className="rounded-lg p-2 hover:bg-slate-100"><Menu size={20}/></button><span className="text-sm text-slate-600">{patientInfo?.patient_code || 'Your patient portal'}</span><span className="ml-auto text-xs text-slate-500">Clinician-released information</span></header>
}
