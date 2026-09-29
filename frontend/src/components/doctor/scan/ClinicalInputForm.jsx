import { Info } from 'lucide-react'
import { SCAN_MODULES } from '../../../config/scanModules'
import { RISK_TIERS } from '../../../config/scanTestCases'
import { isFieldVisible, validateField } from '../../../utils/scanValidation'

const TIER_BUTTON_STYLES = {
  low: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
  medium: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
  high: 'bg-red-100 text-red-800 hover:bg-red-200',
}

function FieldError({ error }) {
  if (!error) return null
  return <p className="mt-1 text-xs text-danger">{error}</p>
}

function NumberField({ field, value, onChange, error }) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary">
        {field.label} {field.required !== false && '*'} {field.unit && <span className="text-primary/40">({field.unit})</span>}
      </label>
      <input
        type="number"
        step={field.step || 1}
        value={value ?? ''}
        onChange={(e) => onChange(field.key, e.target.value === '' ? '' : Number(e.target.value))}
        className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40 ${error ? 'border-danger' : 'border-border'}`}
      />
      {field.hint && <p className="mt-1 text-xs text-primary/40">{field.hint}</p>}
      <FieldError error={error} />
    </div>
  )
}

function SelectField({ field, value, onChange, error }) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary">
        {field.label} {field.required !== false && '*'}
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(field.key, e.target.value)}
        className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40 ${error ? 'border-danger' : 'border-border'}`}
      >
        <option value="">Select</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError error={error} />
    </div>
  )
}

function DateField({ field, value, onChange, error }) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary">
        {field.label} {field.required !== false && '*'}
      </label>
      <input
        type="date"
        value={value ?? ''}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => onChange(field.key, e.target.value)}
        className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40 ${error ? 'border-danger' : 'border-border'}`}
      />
      <FieldError error={error} />
    </div>
  )
}

function MultiSelectField({ field, value, onChange, error }) {
  const selected = value || []
  function toggle(v) {
    onChange(field.key, selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v])
  }
  return (
    <div>
      <label className="block text-sm font-medium text-primary">
        {field.label} {field.required !== false && '*'}
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        {field.options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              selected.includes(o.value)
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-primary/60 hover:border-accent'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <FieldError error={error} />
    </div>
  )
}

function CheckboxesField({ field, value, onChange, error }) {
  const selected = value || []
  function toggle(v) {
    onChange(field.key, selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v])
  }
  return (
    <div>
      <label className="block text-sm font-medium text-primary">
        {field.label} {field.required !== false && '*'}
      </label>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {field.options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm text-primary/80">
            <input
              type="checkbox"
              checked={selected.includes(o.value)}
              onChange={() => toggle(o.value)}
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
            />
            {o.label}
          </label>
        ))}
      </div>
      <FieldError error={error} />
    </div>
  )
}

function CheckboxField({ field, value, onChange, error }) {
  const checked = Boolean(value)
  return (
    <div className="py-1">
      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(field.key, e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent"
        />
        <div>
          <span className="text-sm font-medium text-primary">{field.label}</span>
          {field.hint && <p className="text-xs text-primary/60 mt-0.5">{field.hint}</p>}
        </div>
      </label>
      <FieldError error={error} />
    </div>
  )
}

function TextareaField({ field, value, onChange }) {
  const text = value || ''
  return (
    <div>
      <label className="block text-sm font-medium text-primary">{field.label}</label>
      <textarea
        value={text}
        maxLength={field.maxLength}
        onChange={(e) => onChange(field.key, e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
      />
      {field.maxLength && (
        <p className="mt-1 text-right text-xs text-primary/40">
          {text.length}/{field.maxLength}
        </p>
      )}
    </div>
  )
}

const FIELD_ALIASES = {
  amh_ng_ml: 'amh_ng_mL',
  amh_ng_mL: 'amh_ng_ml',
  lh_miu_ml: 'lh_mIU_mL',
  lh_mIU_mL: 'lh_miu_ml',
  fsh_miu_ml: 'fsh_mIU_mL',
  fsh_mIU_mL: 'fsh_miu_ml',
  total_testosterone_ng_dl: 'testosterone_ng_dL',
  testosterone_ng_dL: 'total_testosterone_ng_dl',
  prolactin_ng_ml: 'prolactin_ng_mL',
  prolactin_ng_mL: 'prolactin_ng_ml',
  left_ovary_volume_ml: 'left_ovarian_volume_mL',
  left_ovarian_volume_mL: 'left_ovary_volume_ml',
  right_ovary_volume_ml: 'right_ovarian_volume_mL',
  right_ovarian_volume_mL: 'right_ovary_volume_ml',
  menstrual_regularity: 'menstrual_cycle_regularity',
  menstrual_cycle_regularity: 'menstrual_regularity',
}

function resolveFieldValue(values, key) {
  if (!values) return undefined
  if (values[key] !== undefined) return values[key]
  const alt = FIELD_ALIASES[key]
  return alt ? values[alt] : undefined
}

function ComputedField({ field, values }) {
  const lh = values.lh_miu_ml ?? values.lh_mIU_mL
  const fsh = values.fsh_miu_ml ?? values.fsh_mIU_mL
  const ratio = typeof lh === 'number' && typeof fsh === 'number' && fsh > 0 ? (lh / fsh).toFixed(2) : null

  return (
    <div>
      <label className="block text-sm font-medium text-primary">{field.label}</label>
      <div className="mt-1 flex items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm">
        <span className={ratio ? 'font-semibold text-primary' : 'text-primary/40'}>
          {ratio ?? 'Enter LH and FSH to calculate'}
        </span>
      </div>
      {field.hint && <p className="mt-1 text-xs text-primary/40">{field.hint}</p>}
    </div>
  )
}

function ClinicalInputForm({ moduleKey, values, onChange, showErrors, onLoadTestCase }) {
  const mod = SCAN_MODULES[moduleKey]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-primary">Clinical Inputs</h2>
        {onLoadTestCase && (
          <div className="flex items-center gap-1.5">
            {RISK_TIERS.map((tier) => (
              <button
                key={tier.key}
                type="button"
                onClick={() => onLoadTestCase(tier.key)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold shadow-sm ${TIER_BUTTON_STYLES[tier.key]}`}
              >
                {tier.emoji} {tier.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-md bg-accent/5 px-3 py-2 text-xs text-accent">
        <Info size={14} className="mt-0.5 shrink-0" />
        All fields marked with * are required.
      </div>

      {mod.sections.map((section) => (
        <div key={section.title}>
          <h3 className="text-sm font-semibold text-primary">{section.title}</h3>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {section.fields.map((field) => {
              if (!isFieldVisible(field, values)) return null

              if (field.type === 'info') {
                return (
                  <div key={field.key} className="sm:col-span-2 flex items-start gap-2 rounded-md bg-background px-3 py-2 text-xs text-primary/60">
                    <Info size={14} className="mt-0.5 shrink-0 text-accent" />
                    {field.text}
                  </div>
                )
              }

              const fieldValue = resolveFieldValue(values, field.key)
              const error = showErrors ? validateField(field, fieldValue) : null
              const wide = field.type === 'textarea' || field.type === 'checkboxes' || field.type === 'multiselect'

              return (
                <div key={field.key} className={wide ? 'sm:col-span-2' : ''}>
                  {field.type === 'number' && (
                    <NumberField field={field} value={fieldValue} onChange={onChange} error={error} />
                  )}
                  {field.type === 'select' && (
                    <SelectField field={field} value={fieldValue} onChange={onChange} error={error} />
                  )}
                  {field.type === 'date' && (
                    <DateField field={field} value={fieldValue} onChange={onChange} error={error} />
                  )}
                  {field.type === 'multiselect' && (
                    <MultiSelectField field={field} value={fieldValue} onChange={onChange} error={error} />
                  )}
                  {field.type === 'checkboxes' && (
                    <CheckboxesField field={field} value={fieldValue} onChange={onChange} error={error} />
                  )}
                  {(field.type === 'checkbox' || field.type === 'boolean') && (
                    <CheckboxField field={field} value={fieldValue} onChange={onChange} error={error} />
                  )}
                  {field.type === 'textarea' && (
                    <TextareaField field={field} value={fieldValue} onChange={onChange} />
                  )}
                  {field.type === 'computed' && <ComputedField field={field} values={values} />}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default ClinicalInputForm
