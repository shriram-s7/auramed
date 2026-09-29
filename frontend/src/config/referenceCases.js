// Representative reference cases shown in "Reference Images from Dataset".
// Each case renders as a styled clinical card (colored severity bar,
// case-type label, BI-RADS/Bethesda classification, and a short clinical
// description) — no photographic illustration is attempted.

const SEVERITY_COLOR = {
  high: '#dc2626', // red
  moderate: '#f59e0b', // amber
  normal: '#16a34a', // green
}

// image() builds the list of candidate filenames for a case's reference
// photos, served from public/reference-images/{module}/. Files that don't
// exist (e.g. before the dataset extraction scripts have been run) fail
// their <img onError> gracefully and the card falls back to text-only.
function breastImages(indices) {
  return indices.map((i) => `/reference-images/breast/breast_ref_${String(i).padStart(2, '0')}.jpg`)
}
function labeledImages(module, label, count) {
  return Array.from({ length: count }, (_, i) => `/reference-images/${module}/${module}_${label}_${String(i).padStart(2, '0')}.jpg`)
}

export const REFERENCE_CASES = {
  breast: [
    {
      id: 'high_risk',
      caseTypeLabel: 'High Risk Case',
      classification: 'BI-RADS 5',
      severity: 'high',
      riskLevel: 'critical',
      description: 'BI-RADS 5 — Spiculated mass, irregular margins, microcalcifications. Immediate biopsy recommended.',
      images: breastImages([0, 1, 2, 3]),
    },
    {
      id: 'moderate',
      caseTypeLabel: 'Moderate Risk',
      classification: 'BI-RADS 4',
      severity: 'moderate',
      riskLevel: 'high',
      description: 'BI-RADS 4 — Asymmetric density, architectural distortion. Short-interval follow-up or biopsy.',
      images: breastImages([4, 5, 6, 7]),
    },
    {
      id: 'benign',
      caseTypeLabel: 'Benign',
      classification: 'BI-RADS 3',
      severity: 'moderate',
      riskLevel: 'moderate',
      description: 'BI-RADS 3 — Well-circumscribed oval mass, circumscribed margins. 6-month follow-up.',
      images: breastImages([8, 9, 10, 11]),
    },
    {
      id: 'normal',
      caseTypeLabel: 'Normal',
      classification: 'BI-RADS 1',
      severity: 'normal',
      riskLevel: 'low',
      description: 'BI-RADS 1 — Uniform fibroglandular density. Routine annual screening.',
      images: breastImages([12, 13, 14]),
    },
  ],
  cervical: [
    {
      id: 'hsil',
      caseTypeLabel: 'High Risk Case',
      classification: 'HSIL',
      severity: 'high',
      riskLevel: 'critical',
      description: 'Dyskeratotic — Hyperchromatic nucleus, high N/C ratio, irregular chromatin. Immediate colposcopy.',
      images: labeledImages('cervical', 'hsil', 6),
    },
    {
      id: 'lsil',
      caseTypeLabel: 'Moderate Risk',
      classification: 'LSIL',
      severity: 'moderate',
      riskLevel: 'high',
      description: 'Koilocytotic — Perinuclear halo, HPV cytopathic effect. Colposcopy or repeat cytology.',
      images: labeledImages('cervical', 'lsil', 6),
    },
    {
      id: 'ascus',
      caseTypeLabel: 'Benign',
      classification: 'ASC-US',
      severity: 'moderate',
      riskLevel: 'moderate',
      description: 'Metaplastic — Mild nuclear atypia, dense cytoplasm. HPV triage or repeat in 12 months.',
      images: labeledImages('cervical', 'ascus', 6),
    },
    {
      id: 'normal',
      caseTypeLabel: 'Normal',
      classification: 'NILM',
      severity: 'normal',
      riskLevel: 'low',
      description: 'NILM — Transparent cytoplasm, small pyknotic nucleus. Routine screening interval.',
      images: labeledImages('cervical', 'normal', 6),
    },
  ],
  pcos: [
    {
      id: 'pcos',
      caseTypeLabel: 'High Risk Case',
      classification: 'Rotterdam Positive',
      severity: 'high',
      riskLevel: 'high',
      description: 'Polycystic morphology — String of pearls sign, 12+ peripheral follicles, hyperechoic stroma.',
      images: labeledImages('pcos', 'pcos', 8),
    },
    {
      id: 'normal',
      caseTypeLabel: 'Normal',
      classification: 'Rotterdam Negative',
      severity: 'normal',
      riskLevel: 'low',
      description: 'Normal ovary — 1-3 dominant follicles, homogeneous stroma, normal volume.',
      images: labeledImages('pcos', 'normal', 8),
    },
  ],
}

export function severityColor(severity) {
  return SEVERITY_COLOR[severity] || SEVERITY_COLOR.moderate
}

const RISK_TIER_TO_CASE_ID = {
  breast: { critical: 'high_risk', high: 'moderate', moderate: 'benign', low: 'normal' },
  cervical: { critical: 'hsil', high: 'lsil', moderate: 'ascus', low: 'normal' },
  pcos: {
    critical: 'pcos',
    high: 'pcos',
    confirmed: 'pcos',
    likely: 'pcos',
    moderate: 'normal',
    possible: 'normal',
    low: 'normal',
    unlikely: 'normal',
  },
}

/**
 * Resolves the nearest matching reference atlas case and match percentage
 * strictly based on the image analysis model's findings, classification,
 * and image score ALONE — independent of the clinical formula or final fused risk.
 *
 * @param {Object} result - The full scan result object from the API
 * @returns {{ nearestMatchId: string, matchPct: number }}
 */
export function resolveNearestMatch(result) {
  const module = result?.module || 'breast'
  const imageScore =
    result?.image_model_score != null
      ? Number(result.image_model_score)
      : result?.fusion_result?.image_score != null
      ? Number(result.fusion_result.image_score)
      : result?.image_score != null
      ? Number(result.image_score)
      : null

  const findings = Array.isArray(result?.image_findings)
    ? result.image_findings
    : Array.isArray(result?.reasoning?.image_findings)
    ? result.reasoning.image_findings
    : []

  const docMods = result?.doctor_modifications || {}
  const interpretation = String(
    result?.model_interpretation ||
    result?.reasoning?.model_interpretation ||
    result?.reasoning?.image_interpretation ||
    ''
  ).toLowerCase()

  const findingsText = findings
    .map((f) => String(f.description || f.finding || ''))
    .join(' ')
    .toLowerCase()

  // -------------------------------------------------------------
  // 1. PCOS SCREENING MODULE (Ultrasound Morphology Alone)
  // -------------------------------------------------------------
  if (module === 'pcos') {
    // A. Doctor manual override on image/ultrasound
    if (docMods.rotterdam_polycystic_ovaries !== undefined) {
      return docMods.rotterdam_polycystic_ovaries
        ? { nearestMatchId: 'pcos', matchPct: 95 }
        : { nearestMatchId: 'normal', matchPct: 95 }
    }

    // B. Check morphological findings & interpretation from Image Analysis alone
    const hasPcosMorphology =
      /polycystic ovarian morphology|peripheral follicle clustering|string of pearls|increased stromal/i.test(findingsText) ||
      /polycystic ovarian morphology|string of pearls/i.test(interpretation)
    const hasHealthyMorphology =
      /predominantly normal ovarian morphology|even follicle distribution|no dominant peripheral follicle|healthy/i.test(findingsText) ||
      /predominantly normal ovarian morphology|normal ovarian/i.test(interpretation)

    // C. Evaluate based on image score (pcos_probability from ultrasound model)
    if (imageScore !== null) {
      if (imageScore >= 0.50 || (hasPcosMorphology && !hasHealthyMorphology)) {
        const pct = Math.min(99, Math.max(60, Math.round(imageScore * 100)))
        return { nearestMatchId: 'pcos', matchPct: pct }
      } else {
        const pct = Math.min(99, Math.max(60, Math.round((1.0 - imageScore) * 100)))
        return { nearestMatchId: 'normal', matchPct: pct }
      }
    }

    if (hasPcosMorphology) {
      return { nearestMatchId: 'pcos', matchPct: 88 }
    }
    return { nearestMatchId: 'normal', matchPct: 90 }
  }

  // -------------------------------------------------------------
  // 2. CERVICAL SCREENING MODULE (Pap Smear Cytology ViT Alone)
  // -------------------------------------------------------------
  if (module === 'cervical') {
    // A. Doctor override on cytology classification
    const docClass = String(docMods.classification_suggested || '').toLowerCase()
    if (/hsil|cin\s*3|cin\s*2|asc-h|asch/.test(docClass)) return { nearestMatchId: 'hsil', matchPct: 98 }
    if (/lsil|cin\s*1/.test(docClass)) return { nearestMatchId: 'lsil', matchPct: 98 }
    if (/asc-?us/.test(docClass)) return { nearestMatchId: 'ascus', matchPct: 98 }
    if (/nilm|normal/.test(docClass)) return { nearestMatchId: 'normal', matchPct: 98 }

    // B. Cytology class identified by vision model
    let cytoClass = ''
    let cytoConf = null

    for (const f of findings) {
      const desc = String(f.description || f.finding || '')
      const conf = f.confidence != null ? Number(f.confidence) : null
      const m = desc.match(/Predicted Cytology:\s*([A-Za-z0-9\-_]+)/i)
      if (m) {
        cytoClass = m[1].toLowerCase()
        cytoConf = conf
        break
      } else if (/hsil|dyskeratotic|hyperchromatic nucleus|high n\/c ratio/i.test(desc)) {
        cytoClass = 'hsil'
        cytoConf = conf
      } else if (/lsil|koilocytic|koilocytotic/i.test(desc)) {
        cytoClass = 'lsil'
        cytoConf = conf
      } else if (/asc-?us|asc-h|metaplastic|atypical squamous/i.test(desc)) {
        cytoClass = 'ascus'
        cytoConf = conf
      } else if (/nilm|normal|regular nuclear morphology|normal n:c ratio/i.test(desc)) {
        cytoClass = 'nilm'
        cytoConf = conf
      }
    }

    if (!cytoClass && interpretation) {
      if (/dyskeratotic|hsil/i.test(interpretation)) cytoClass = 'hsil'
      else if (/koilocytotic|lsil/i.test(interpretation)) cytoClass = 'lsil'
      else if (/metaplastic|asc-?us/i.test(interpretation)) cytoClass = 'ascus'
      else if (/normal|nilm/i.test(interpretation)) cytoClass = 'nilm'
    }

    if (cytoClass) {
      const confPct = cytoConf != null ? Math.round(cytoConf * 100) : 88
      if (/hsil|dyskeratotic/.test(cytoClass)) return { nearestMatchId: 'hsil', matchPct: Math.min(99, Math.max(65, confPct)) }
      if (/lsil|koilocytic/.test(cytoClass)) return { nearestMatchId: 'lsil', matchPct: Math.min(95, Math.max(65, confPct)) }
      if (/ascus|metaplastic|asc-us/.test(cytoClass)) return { nearestMatchId: 'ascus', matchPct: Math.min(95, Math.max(65, confPct)) }
      if (/nilm|normal/.test(cytoClass)) return { nearestMatchId: 'normal', matchPct: Math.min(99, Math.max(65, confPct)) }
    }

    // C. Evaluate from imageScore alone
    if (imageScore !== null) {
      if (imageScore >= 0.75) {
        return { nearestMatchId: 'hsil', matchPct: Math.min(99, Math.max(65, Math.round(imageScore * 100))) }
      }
      if (imageScore >= 0.55) {
        return { nearestMatchId: 'lsil', matchPct: Math.min(95, Math.max(65, Math.round(imageScore * 100))) }
      }
      if (imageScore >= 0.25) {
        return { nearestMatchId: 'ascus', matchPct: Math.min(95, Math.max(65, Math.round(Math.max(imageScore, 1.0 - Math.abs(imageScore - 0.45)) * 100))) }
      }
      return { nearestMatchId: 'normal', matchPct: Math.min(99, Math.max(65, Math.round((1.0 - imageScore) * 100))) }
    }

    return { nearestMatchId: 'normal', matchPct: 88 }
  }

  // -------------------------------------------------------------
  // 3. BREAST CANCER MODULE (Mammogram ResNet-50 Alone)
  // -------------------------------------------------------------
  // A. Doctor manual override on BI-RADS
  const docBirads = String(docMods.birads_suggested || '').toUpperCase()
  if (docBirads.includes('BI-RADS 5') || docBirads.endsWith('5')) return { nearestMatchId: 'high_risk', matchPct: 98 }
  if (docBirads.includes('BI-RADS 4') || docBirads.endsWith('4')) return { nearestMatchId: 'moderate', matchPct: 98 }
  if (docBirads.includes('BI-RADS 3') || docBirads.includes('BI-RADS 2') || docBirads.endsWith('3') || docBirads.endsWith('2')) return { nearestMatchId: 'benign', matchPct: 98 }
  if (docBirads.includes('BI-RADS 1') || docBirads.endsWith('1')) return { nearestMatchId: 'normal', matchPct: 98 }

  // B. Image Model Score alone (ResNet-50 continuous probability)
  // Note: We do NOT use the final fusion risk level or clinical formula (e.g. Gail model).
  // If the image model score indicates normal/low risk, map to Normal regardless of final risk.
  if (imageScore !== null) {
    if (imageScore >= 0.70) {
      // High suspicion / malignant features
      return {
        nearestMatchId: 'high_risk',
        matchPct: Math.min(99, Math.max(65, Math.round(imageScore * 100)))
      }
    }
    if (imageScore >= 0.45) {
      // Moderate / indeterminate suspicion
      return {
        nearestMatchId: 'moderate',
        matchPct: Math.min(95, Math.max(65, Math.round((1.0 - Math.abs(imageScore - 0.58) * 1.2) * 100)))
      }
    }
    if (imageScore >= 0.25) {
      // Benign parenchymal alterations / circumscribed mass
      return {
        nearestMatchId: 'benign',
        matchPct: Math.min(95, Math.max(65, Math.round((1.0 - Math.abs(imageScore - 0.35) * 1.5) * 100)))
      }
    }
    // Normal / predominantly fatty or negative screening (< 0.25)
    return {
      nearestMatchId: 'normal',
      matchPct: Math.min(99, Math.max(65, Math.round((1.0 - imageScore) * 100)))
    }
  }

  // C. Fallback to image interpretation text if imageScore was not recorded
  if (interpretation) {
    if (/elevated suspicion|high density features/i.test(interpretation)) {
      return { nearestMatchId: 'high_risk', matchPct: 85 }
    }
    if (/intermediate density/i.test(interpretation)) {
      return { nearestMatchId: 'moderate', matchPct: 80 }
    }
    if (/benign parenchymal|no dominant suspicious/i.test(interpretation)) {
      return { nearestMatchId: 'normal', matchPct: 88 }
    }
  }

  return { nearestMatchId: 'normal', matchPct: 88 }
}

export function resolveNearestMatchId(module, riskLevel, result = null) {
  if (result) {
    return resolveNearestMatch(result).nearestMatchId
  }
  const map = {
    breast: 'normal',
    cervical: 'normal',
    pcos: 'normal',
  }
  return map[module] || 'normal'
}
