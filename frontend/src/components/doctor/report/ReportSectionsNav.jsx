import {
  Activity,
  AlertTriangle,
  CheckSquare,
  Cpu,
  FileText,
  Image as ImageIcon,
  Sliders,
  User,
} from 'lucide-react'

const SECTIONS = [
  { id: 'patient_info', label: 'Patient Information', icon: User },
  { id: 'clinical_summary', label: 'Clinical Summary', icon: Activity },
  { id: 'imaging_findings', label: 'Imaging Findings', icon: ImageIcon },
  { id: 'ai_assessment', label: 'AI & Clinical Assessment', icon: Cpu },
  { id: 'risk_assessment', label: 'Risk Assessment', icon: AlertTriangle },
  { id: 'recommendations', label: 'Recommendations', icon: CheckSquare },
]

const TEMPLATES = [
  'Standard Clinical Report',
  'Detailed Technical Report',
  'Patient Summary Report',
]

function ReportSectionsNav({
  activeSection,
  onSelectSection,
  options = {},
  onOptionsChange,
  template,
  onTemplateChange,
  isPcos = false,
  module = '',
}) {
  const isPcosModule = isPcos || module === 'pcos'

  const sections = [
    { id: 'patient_info', label: 'Patient Information', icon: User },
    { id: 'clinical_summary', label: 'Clinical Summary', icon: Activity },
    { id: 'imaging_findings', label: 'Imaging Findings', icon: ImageIcon },
    { id: 'ai_assessment', label: 'AI & Clinical Assessment', icon: Cpu },
    ...(isPcosModule
      ? [{ id: 'rotterdam_criteria', label: 'Rotterdam Criteria', icon: CheckSquare }]
      : []),
    { id: 'risk_assessment', label: 'Risk Assessment', icon: AlertTriangle },
    { id: 'recommendations', label: 'Recommendations', icon: CheckSquare },
  ]

  const handleToggle = (key) => {
    onOptionsChange({
      ...options,
      [key]: !options[key],
    })
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-5">
      {/* Template Selector */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-primary/60">
          Report Template
        </label>
        <select
          value={template}
          onChange={(e) => onTemplateChange(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-primary focus:border-accent focus:bg-surface focus:outline-none"
        >
          {TEMPLATES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Sections Navigator */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-primary/60">
          Report Sections
        </label>
        <p className="mt-0.5 text-[11px] text-primary/40">Click to navigate and edit</p>

        <nav className="mt-2 space-y-1">
          {sections.map((sec) => {
            const Icon = sec.icon
            const isActive = activeSection === sec.id

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => onSelectSection(sec.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-primary/70 hover:bg-slate-100 hover:text-primary'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-accent'} />
                <span>{sec.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Report Options Toggles */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary/60 mb-2">
          <Sliders size={13} className="text-accent" />
          <span>Report Options</span>
        </div>

        <div className="space-y-2.5 text-xs">
          {[
            { key: 'include_images', label: 'Include images' },
            { key: 'include_ai_details', label: 'Include AI analysis details' },
            ...(isPcosModule
              ? [{ key: 'include_rotterdam', label: 'Include Rotterdam Criteria', defaultChecked: true }]
              : []),
            { key: 'include_reference_ranges', label: 'Include reference ranges' },
            { key: 'include_disclaimers', label: 'Include disclaimers' },
          ].map((item) => {
            const isChecked = options[item.key] !== undefined ? Boolean(options[item.key]) : Boolean(item.defaultChecked)
            return (
              <label
                key={item.key}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <span className="text-primary/80 font-medium">{item.label}</span>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(item.key)}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ReportSectionsNav
