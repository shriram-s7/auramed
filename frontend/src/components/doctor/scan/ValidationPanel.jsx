import { AlertTriangle, CheckCircle2 } from 'lucide-react'

function ValidationPanel({ errors, imageUploaded }) {
  const allErrors = [...errors]
  if (!imageUploaded) allErrors.push('At least one image must be uploaded')

  const valid = allErrors.length === 0

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-primary">Input Validation</p>
      {valid ? (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 size={16} />
          All inputs valid, you can proceed
        </div>
      ) : (
        <div className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle size={16} />
            {allErrors.length} issue{allErrors.length > 1 ? 's' : ''} to resolve
          </div>
          <ul className="mt-1.5 space-y-1 pl-6 text-xs list-disc">
            {allErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default ValidationPanel
