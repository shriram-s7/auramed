const STYLES = {
  breast: 'bg-pink-50 text-pink-700',
  cervical: 'bg-purple-50 text-purple-700',
  pcos: 'bg-teal-50 text-accent',
}

const LABELS = {
  breast: 'Breast',
  cervical: 'Cervical',
  pcos: 'PCOS',
}

function ModulePill({ module }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STYLES[module] || 'bg-border text-primary'}`}>
      {LABELS[module] || module}
    </span>
  )
}

export default ModulePill
