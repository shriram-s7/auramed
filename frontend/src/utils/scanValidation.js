import { SCAN_MODULES } from '../config/scanModules'

export function isFieldVisible(field, values) {
  if (!field.showIf) return true
  const actual = values[field.showIf.field]
  if (field.showIf.equals !== undefined) return actual === field.showIf.equals
  if (field.showIf.in) return field.showIf.in.includes(actual)
  return true
}

export function allFields(moduleKey) {
  const mod = SCAN_MODULES[moduleKey] || SCAN_MODULES.breast
  if (!mod || !mod.sections) return []
  return mod.sections.flatMap((s) => s.fields).filter((f) => f.type !== 'info')
}

export function validateField(field, value) {
  if (field.type === 'computed') return null

  const required = field.required !== false

  if (field.type === 'multiselect' || field.type === 'checkboxes') {
    if (required && (!value || value.length === 0)) return `${field.label} is required`
    return null
  }

  const isEmpty = value === undefined || value === null || value === ''
  if (required && isEmpty) return `${field.label} is required`
  if (isEmpty) return null

  if (field.type === 'number') {
    const num = Number(value)
    if (Number.isNaN(num)) return `${field.label} must be a number`
    if (field.min !== undefined && num < field.min) {
      return `${field.label} must be at least ${field.min}${field.unit ? ` ${field.unit}` : ''}`
    }
    if (field.max !== undefined && num > field.max) {
      return `${field.label} must be at most ${field.max}${field.unit ? ` ${field.unit}` : ''}`
    }
  }

  return null
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

export function validateClinicalInputs(moduleKey, values) {
  const errors = []
  for (const field of allFields(moduleKey)) {
    if (!isFieldVisible(field, values)) continue
    const val = values[field.key] !== undefined ? values[field.key] : values[FIELD_ALIASES[field.key]]
    const error = validateField(field, val)
    if (error) errors.push(error)
  }
  return { valid: errors.length === 0, errors }
}
