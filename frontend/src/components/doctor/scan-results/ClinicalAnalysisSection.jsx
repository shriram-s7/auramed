function ContributionCell({ value }) {
  if (value === 0 || value === null || value === undefined) return <span className="text-xs text-primary/40">No effect</span>
  const positive = value > 0
  return (
    <span className={`text-xs font-semibold ${positive ? 'text-danger' : 'text-success'}`}>
      {positive ? '+' : ''}
      {value.toFixed(2)}
    </span>
  )
}

function ClinicalAnalysisSection({ result, sectionRef }) {
  const contributions = result?.clinical_contributions || []

  const isPcos =
    result?.module === 'pcos' ||
    result?.scan_type?.toLowerCase().includes('pcos')

  const c1Met =
    result?.criterion_oligo_anovulation !== undefined && result?.criterion_oligo_anovulation !== null
      ? Boolean(result.criterion_oligo_anovulation)
      : Boolean(
          result?.clinical_inputs?.criterion_oligo_anovulation ||
          ['irregular', 'absent', 'oligomenorrhea', 'amenorrhea'].includes(
            String(result?.clinical_inputs?.menstrual_cycle_regularity || '').toLowerCase().trim()
          )
        )

  const c2Met =
    result?.criterion_hyperandrogenism !== undefined && result?.criterion_hyperandrogenism !== null
      ? Boolean(result.criterion_hyperandrogenism)
      : Boolean(
          result?.clinical_inputs?.criterion_hyperandrogenism ||
          (Array.isArray(result?.clinical_inputs?.clinical_symptoms) &&
            result.clinical_inputs.clinical_symptoms.some((s) => /hirsutism|acne|hair_thinning/i.test(s)))
        )

  const c3Met =
    result?.criterion_polycystic_ovaries !== undefined && result?.criterion_polycystic_ovaries !== null
      ? Boolean(result.criterion_polycystic_ovaries)
      : Boolean(
          (result?.image_model_score != null && Number(result.image_model_score) >= 0.44) ||
          (result?.confidence != null && Number(result.confidence) >= 0.5)
        )

  const metCount =
    result?.rotterdam_criteria_met !== undefined && result?.rotterdam_criteria_met !== null
      ? Number(result.rotterdam_criteria_met)
      : (c1Met ? 1 : 0) + (c2Met ? 1 : 0) + (c3Met ? 1 : 0)

  const isPositive =
    result?.rotterdam_positive !== undefined && result?.rotterdam_positive !== null
      ? Boolean(result.rotterdam_positive)
      : metCount >= 2

  return (
    <div ref={sectionRef} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
          2
        </span>
        <h2 className="text-sm font-bold text-primary">Clinical Analysis (Risk Model)</h2>
        <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
          {result?.clinical_model_name || 'Clinical Factors Model'}
        </span>
      </div>

      <p className="mt-4 text-xs font-semibold text-primary/60">Key Inputs and Their Contribution</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-primary/40">
            <tr>
              <th className="pb-1.5 font-medium">Clinical Factor</th>
              <th className="pb-1.5 font-medium">Value</th>
              <th className="pb-1.5 font-medium">Reference Range</th>
              <th className="pb-1.5 font-medium">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {contributions.length > 0 ? (
              contributions.map((c, idx) => (
                <tr key={`${c.factor}-${idx}`} className="border-t border-border">
                  <td className="py-2.5 pr-2 font-medium text-primary/80">{c.factor}</td>
                  <td className="py-2.5 pr-2 text-primary/70">{String(c.value ?? '—')}</td>
                  <td className="py-2.5 pr-2 text-primary/50">{c.reference_range}</td>
                  <td className="py-2.5">
                    <ContributionCell value={c.contribution} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-4 text-center text-xs text-primary/40">
                  No clinical factor contributions calculated
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rotterdam Criteria Checklist for PCOS */}
      {isPcos && (
        <div className="mt-4 rounded-lg border border-border bg-slate-50/70 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-primary">Rotterdam Criteria (2003)</h3>
            <p className="text-xs text-primary/60">PCOS diagnosis requires 2 of 3 criteria</p>
          </div>

          <div className="space-y-3">
            {/* Row 1: Oligo/Anovulation */}
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none select-none mt-0.5">
                {c1Met ? '✅' : '⬜'}
              </span>
              <div>
                <p className="text-xs font-bold text-primary">Oligo/Anovulation</p>
                <p className="text-xs text-primary/60">Irregular or absent menstrual cycles</p>
              </div>
            </div>

            {/* Row 2: Hyperandrogenism */}
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none select-none mt-0.5">
                {c2Met ? '✅' : '⬜'}
              </span>
              <div>
                <p className="text-xs font-bold text-primary">Hyperandrogenism</p>
                <p className="text-xs text-primary/60">Elevated androgens, hirsutism, or acne</p>
              </div>
            </div>

            {/* Row 3: Polycystic Ovaries */}
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none select-none mt-0.5">
                {c3Met ? '✅' : '⬜'}
              </span>
              <div>
                <p className="text-xs font-bold text-primary">Polycystic Ovaries</p>
                <p className="text-xs text-primary/60">≥12 follicles per ovary or volume &gt;10 mL on ultrasound</p>
              </div>
            </div>
          </div>

          {/* Summary Bar */}
          <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-primary/80">
              {metCount} of 3 criteria met
            </span>
            {isPositive ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                  ROTTERDAM POSITIVE
                </span>
                <span className="text-xs text-primary/60">
                  Meets diagnostic threshold for PCOS (≥2 of 3)
                </span>
              </div>
            ) : metCount === 1 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                  BORDERLINE
                </span>
                <span className="text-xs text-primary/60">
                  Only 1 criterion met — does not meet PCOS threshold
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                  ROTTERDAM NEGATIVE
                </span>
                <span className="text-xs text-primary/60">
                  No criteria met — PCOS unlikely by Rotterdam 2003
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-4 text-center">
        <p className="font-mono text-3xl font-extrabold text-accent">
          {result?.formula_score !== null && result?.formula_score !== undefined
            ? result.formula_score.toFixed(2)
            : '—'}
        </p>
        <p className="mt-1 text-xs font-semibold text-primary/70">Clinical Risk Score</p>
        <p className="mt-1 text-xs text-primary/50">
          Based on modified {result?.clinical_model_name || 'formula'} with clinical inputs
        </p>
      </div>
    </div>
  )
}

export default ClinicalAnalysisSection
