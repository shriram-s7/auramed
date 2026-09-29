import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Activity,
  Dna,
  Info,
  ShieldCheck,
} from 'lucide-react'

export default function RotterdamCriteriaSection({ result, sectionRef }) {
  const inputs = result?.clinical_inputs || {}
  const formulaResult = result?.formula_result || result?.ai_suggestions?.formula_result || {}
  const criteriaMet = Array.isArray(formulaResult.criteria_met) ? formulaResult.criteria_met : []
  const criteriaNotMet = Array.isArray(formulaResult.criteria_not_met) ? formulaResult.criteria_not_met : []

  // --- CRITERION 1: Oligo/Anovulation ---
  const regStr = String(inputs.menstrual_cycle_regularity || '').toLowerCase().trim()
  const rawCycleLen = inputs.cycle_length_days
  const cycleLen = rawCycleLen != null && rawCycleLen !== '' ? Number(rawCycleLen) : null

  const c1FromCriteria = criteriaMet.some((c) => /oligo|anovulation|menstrual/i.test(c))
  const c1Fallback =
    ['irregular', 'absent', 'oligomenorrhea', 'amenorrhea'].includes(regStr) ||
    (cycleLen !== null && (cycleLen > 35 || cycleLen < 21))
  const c1Met = criteriaMet.length > 0 ? c1FromCriteria : c1Fallback

  const cycleRegularityLabel = inputs.menstrual_cycle_regularity
    ? String(inputs.menstrual_cycle_regularity).charAt(0).toUpperCase() +
      String(inputs.menstrual_cycle_regularity).slice(1)
    : 'Not recorded'
  const cycleLengthLabel = cycleLen !== null ? `${cycleLen} days` : 'Not recorded'
  const c1ClinicalNote = c1Met ? 'Menstrual irregularity confirmed' : 'Regular cycles noted'

  // --- CRITERION 2: Hyperandrogenism ---
  const rawSymptoms = Array.isArray(inputs.clinical_symptoms)
    ? inputs.clinical_symptoms
    : typeof inputs.clinical_symptoms === 'string'
    ? inputs.clinical_symptoms.split(',').map((s) => s.trim())
    : []
  const clinicalSigns = rawSymptoms.filter((s) =>
    /hirsutism|acne|hair_thinning|hair thinning|alopecia/i.test(s)
  )
  const clinicalSignsPresent = clinicalSigns.length > 0

  const rawTesto = inputs.total_testosterone_ng_dl ?? inputs.testosterone
  const testosterone = rawTesto != null && rawTesto !== '' ? Number(rawTesto) : null
  const biochemicalPresent = testosterone !== null && testosterone > 50.0

  const c2FromCriteria = criteriaMet.some((c) => /hyperandrogenism/i.test(c))
  const c2Fallback = clinicalSignsPresent || biochemicalPresent
  const c2Met = criteriaMet.length > 0 ? c2FromCriteria : c2Fallback

  // --- CRITERION 3: Polycystic Ovarian Morphology (PCOM) ---
  const isPending =
    criteriaNotMet.some((c) => /pending/i.test(c)) ||
    (result?.image_model_score == null &&
      inputs.left_ovary_volume_ml == null &&
      inputs.right_ovary_volume_ml == null &&
      inputs.left_follicle_count == null &&
      inputs.right_follicle_count == null)

  const c3FromCriteria = criteriaMet.some((c) => /polycystic|morphology|pcom/i.test(c))
  const rawLeftVol = inputs.left_ovary_volume_ml
  const rawRightVol = inputs.right_ovary_volume_ml
  const rawLeftFollicles = inputs.left_follicle_count
  const rawRightFollicles = inputs.right_follicle_count

  const leftVol = rawLeftVol != null && rawLeftVol !== '' ? Number(rawLeftVol) : null
  const rightVol = rawRightVol != null && rawRightVol !== '' ? Number(rawRightVol) : null
  const leftFollicles = rawLeftFollicles != null && rawLeftFollicles !== '' ? Number(rawLeftFollicles) : null
  const rightFollicles = rawRightFollicles != null && rawRightFollicles !== '' ? Number(rawRightFollicles) : null

  const morphPositive =
    (leftVol !== null && leftVol > 10.0) ||
    (rightVol !== null && rightVol > 10.0) ||
    (leftFollicles !== null && leftFollicles >= 12) ||
    (rightFollicles !== null && rightFollicles >= 12) ||
    (result?.image_model_score != null && Number(result.image_model_score) >= 0.44)

  const c3Met = !isPending && (criteriaMet.length > 0 ? c3FromCriteria : morphPositive)

  // --- SUMMARY COUNT ---
  const satisfiedCount = (c1Met ? 1 : 0) + (c2Met ? 1 : 0) + (c3Met ? 1 : 0)

  // --- SUPPORTING BIOMARKERS ---
  const rawLh = inputs.lh_miu_ml ?? inputs.lh
  const rawFsh = inputs.fsh_miu_ml ?? inputs.fsh
  const lh = rawLh != null && rawLh !== '' ? Number(rawLh) : null
  const fsh = rawFsh != null && rawFsh !== '' ? Number(rawFsh) : null
  const lhFshRatio = lh !== null && fsh !== null && fsh > 0 ? Number((lh / fsh).toFixed(2)) : null

  const rawAmh = inputs.amh_ng_ml ?? inputs.amh
  const amh = rawAmh != null && rawAmh !== '' ? Number(rawAmh) : null

  const rawProlactin = inputs.prolactin_ng_ml ?? inputs.prolactin
  const prolactin = rawProlactin != null && rawProlactin !== '' ? Number(rawProlactin) : null

  return (
    <div ref={sectionRef} className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-6">
      {/* Header with Teal Pill & Shield Icon */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white shadow-sm">
            <Dna size={15} />
          </span>
          <div>
            <h2 className="text-base font-bold text-primary">Rotterdam Criteria Assessment (2003)</h2>
            <p className="text-xs text-primary/60">
              International ESHRE / ASRM Consensus Guidelines for Polycystic Ovary Syndrome
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 border border-teal-200 shadow-xs">
          <ShieldCheck size={14} className="text-teal-600" />
          Clinical CDS Diagnostic Standard
        </span>
      </div>

      {/* Three Criterion Cards Side by Side with Colored Header Bars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CRITERION 1 CARD */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
          <div>
            {/* Colored Header Bar */}
            <div
              className={`flex items-center justify-between px-3.5 py-2.5 text-white ${
                c1Met ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              <span className="font-bold text-xs tracking-wide">Criterion 1: Oligo/Anovulation</span>
              <div className="flex items-center gap-1 text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                {c1Met ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                <span>{c1Met ? 'Met' : 'Not Met'}</span>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-3.5 space-y-2.5 text-xs">
              <p className="text-[11px] text-primary/60 font-medium">Ovulatory dysfunction & cycle irregularity</p>

              <div className="rounded-lg bg-background p-2.5 space-y-2 border border-border/60">
                <div className="flex items-center justify-between">
                  <span className="text-primary/60">Cycle Regularity:</span>
                  <span className="font-bold text-primary">{cycleRegularityLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-primary/60">Cycle Length:</span>
                  <span className="font-bold text-primary">{cycleLengthLabel}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-primary/45 pt-1.5 border-t border-border/40">
                  <span>Normal Threshold:</span>
                  <span className="font-medium">21 – 35 days</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 pt-0 border-t border-border/50 text-xs">
            <p className="mt-2.5 text-primary/80">
              <span className="font-semibold text-primary/60">Clinical Note: </span>
              <span className="font-bold text-primary">{c1ClinicalNote}</span>
            </p>
          </div>
        </div>

        {/* CRITERION 2 CARD */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
          <div>
            {/* Colored Header Bar */}
            <div
              className={`flex items-center justify-between px-3.5 py-2.5 text-white ${
                c2Met ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              <span className="font-bold text-xs tracking-wide">Criterion 2: Hyperandrogenism</span>
              <div className="flex items-center gap-1 text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                {c2Met ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                <span>{c2Met ? 'Met' : 'Not Met'}</span>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-3.5 space-y-2.5 text-xs">
              <p className="text-[11px] text-primary/60 font-medium">Clinical signs or elevated serum androgens</p>

              <div className="rounded-lg bg-background p-2.5 space-y-2.5 border border-border/60">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-primary/60">Clinical Signs:</span>
                    <span
                      className={`font-bold ${
                        clinicalSignsPresent ? 'text-amber-700' : 'text-primary'
                      }`}
                    >
                      {clinicalSignsPresent ? 'Present' : 'Absent'}
                    </span>
                  </div>
                  <p className="text-[11px] text-primary/50 mt-0.5">
                    {clinicalSignsPresent
                      ? clinicalSigns.map((s) => s.replace('_', ' ')).join(', ')
                      : 'No hirsutism, acne, or alopecia reported'}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-primary/60">Biochemical:</span>
                    <span
                      className={`font-bold ${
                        biochemicalPresent ? 'text-amber-700' : 'text-primary'
                      }`}
                    >
                      {testosterone !== null ? `${testosterone.toFixed(1)} ng/dL` : 'Not tested'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-primary/45 mt-0.5">
                    <span>Normal Range:</span>
                    <span className="font-medium">≤ 50.0 ng/dL</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 pt-0 border-t border-border/50 text-xs">
            <p className="mt-2.5 text-[11px] text-primary/60 italic">
              Either clinical OR biochemical being positive satisfies this criterion.
            </p>
          </div>
        </div>

        {/* CRITERION 3 CARD */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
          <div>
            {/* Colored Header Bar */}
            <div
              className={`flex items-center justify-between px-3.5 py-2.5 text-white ${
                isPending ? 'bg-amber-600' : c3Met ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              <span className="font-bold text-xs tracking-wide">Criterion 3: PCOM (Ultrasound)</span>
              <div className="flex items-center gap-1 text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                {isPending ? (
                  <Clock size={13} />
                ) : c3Met ? (
                  <CheckCircle2 size={13} />
                ) : (
                  <XCircle size={13} />
                )}
                <span>{isPending ? 'Pending' : c3Met ? 'Met' : 'Not Met'}</span>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-3.5 space-y-2.5 text-xs">
              <p className="text-[11px] text-primary/60 font-medium">Ultrasound features: volume & follicle count</p>

              <div className="rounded-lg bg-background p-2.5 space-y-2 border border-border/60">
                <div className="flex items-center justify-between">
                  <span className="text-primary/60">Ovarian Volume:</span>
                  <span className="font-bold text-primary">
                    L: {leftVol !== null ? `${leftVol.toFixed(1)} mL` : '—'} | R:{' '}
                    {rightVol !== null ? `${rightVol.toFixed(1)} mL` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-primary/45">
                  <span>Volume Threshold:</span>
                  <span className="font-medium">&gt; 10.0 mL</span>
                </div>

                <div className="pt-1.5 border-t border-border/40 flex items-center justify-between">
                  <span className="text-primary/60">Follicle Count:</span>
                  <span className="font-bold text-primary">
                    L: {leftFollicles !== null ? leftFollicles : '—'} | R:{' '}
                    {rightFollicles !== null ? rightFollicles : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-primary/45">
                  <span>Count Threshold:</span>
                  <span className="font-medium">≥ 12 per ovary</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 pt-0 border-t border-border/50 text-xs">
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-primary/60">Image model score:</span>
              <span className="font-mono font-bold text-teal-700">
                {result?.image_model_score != null
                  ? Number(result.image_model_score).toFixed(2)
                  : 'No image uploaded'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Row (Full-width color-coded banner with inline text result) */}
      <div>
        {satisfiedCount >= 2 ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 shadow-sm flex items-start gap-3.5">
            <div className="rounded-full bg-emerald-200/80 p-2 text-emerald-800 shrink-0 mt-0.5">
              <CheckCircle2 size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-900">
                {satisfiedCount} of 3 Rotterdam criteria satisfied —{' '}
                <span className="font-extrabold text-emerald-700">PCOS Likely</span>
              </p>
              <p className="mt-1 text-xs text-emerald-800/90 leading-relaxed">
                At least 2 of the 3 Rotterdam consensus criteria are met. This supports a clinical
                diagnosis of polycystic ovary syndrome in conjunction with clinical correlation and
                exclusion of secondary etiologies.
              </p>
            </div>
          </div>
        ) : satisfiedCount === 1 ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm flex items-start gap-3.5">
            <div className="rounded-full bg-amber-200/80 p-2 text-amber-800 shrink-0 mt-0.5">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900">
                1 of 3 Rotterdam criteria satisfied —{' '}
                <span className="font-extrabold text-amber-700">Inconclusive</span>
              </p>
              <p className="mt-1 text-xs text-amber-800/90 leading-relaxed">
                Rotterdam guidelines require at least 2 distinct criteria to confirm PCOS. Repeat
                hormonal evaluation or follow-up transvaginal ultrasound imaging is advised.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-slate-800 shadow-sm flex items-start gap-3.5">
            <div className="rounded-full bg-slate-200 p-2 text-slate-600 shrink-0 mt-0.5">
              <Info size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">
                0 of 3 Rotterdam criteria satisfied —{' '}
                <span className="font-extrabold text-slate-600">PCOS Unlikely</span>
              </p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                No ovulatory dysfunction, hyperandrogenism, or polycystic ovarian morphology was
                identified based on the submitted clinical and ultrasound parameters.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 24px Section Divider */}
      <hr className="my-6 border-border" />

      {/* Supporting Biomarkers Section (3-column layout with reference range on 2nd line in muted text) */}
      <div className="rounded-xl border border-border bg-background/60 p-4.5 space-y-4">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-teal-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
            Supporting Endocrine Biomarkers
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* LH/FSH RATIO */}
          <div className="rounded-lg border border-border bg-surface p-3.5 text-xs space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-primary">LH / FSH Ratio</span>
              <span className="font-mono font-bold text-sm text-teal-700">
                {lhFshRatio !== null ? lhFshRatio.toFixed(2) : 'Not recorded'}
              </span>
            </div>
            {/* Reference range on second line in muted text */}
            <p className="text-[11px] text-primary/50">Reference: 1.0 – 1.5</p>
            <p
              className={`text-[11px] font-medium pt-1.5 border-t border-border/40 ${
                lhFshRatio !== null && lhFshRatio > 2.0
                  ? 'text-amber-700 font-semibold'
                  : 'text-primary/70'
              }`}
            >
              {lhFshRatio !== null
                ? lhFshRatio > 2.0
                  ? 'Elevated (> 2.0) — supports neuroendocrine PCOS dysregulation'
                  : lhFshRatio > 1.5
                  ? 'Borderline elevated (1.5 – 2.0)'
                  : 'Normal ratio (≤ 1.5)'
                : 'LH and FSH levels required to calculate ratio'}
            </p>
          </div>

          {/* AMH LEVEL */}
          <div className="rounded-lg border border-border bg-surface p-3.5 text-xs space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-primary">Anti-Müllerian Hormone (AMH)</span>
              <span className="font-mono font-bold text-sm text-teal-700">
                {amh !== null ? `${amh.toFixed(1)} ng/mL` : 'Not recorded'}
              </span>
            </div>
            {/* Reference range on second line in muted text */}
            <p className="text-[11px] text-primary/50">Reference: 1.0 – 3.5 ng/mL</p>
            <p
              className={`text-[11px] font-medium pt-1.5 border-t border-border/40 ${
                amh !== null && amh > 3.5 ? 'text-amber-700 font-semibold' : 'text-primary/70'
              }`}
            >
              {amh !== null
                ? amh > 3.5
                  ? 'Elevated (> 3.5 ng/mL) — supports PCOS follicular excess'
                  : 'Normal ovarian reserve (≤ 3.5 ng/mL)'
                : 'AMH marker not provided'}
            </p>
          </div>

          {/* PROLACTIN NOTE */}
          <div className="rounded-lg border border-border bg-surface p-3.5 text-xs space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-primary">Serum Prolactin</span>
              <span className="font-mono font-bold text-sm text-teal-700">
                {prolactin !== null ? `${prolactin.toFixed(1)} ng/mL` : 'Not recorded'}
              </span>
            </div>
            {/* Reference range on second line in muted text */}
            <p className="text-[11px] text-primary/50">Reference: 4.8 – 23.3 ng/mL</p>
            <p
              className={`text-[11px] font-medium pt-1.5 border-t border-border/40 ${
                prolactin !== null && prolactin > 25.0
                  ? 'text-rose-700 font-semibold'
                  : 'text-primary/70'
              }`}
            >
              {prolactin !== null
                ? prolactin > 25.0
                  ? 'Elevated (> 25.0 ng/mL) — rule out hyperprolactinemia'
                  : 'Normal (≤ 25.0 ng/mL) — pituitary etiology ruled out'
                : 'Prolactin level not provided'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

