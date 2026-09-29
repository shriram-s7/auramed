import { AlertTriangle, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react'
import ReportVisualPlaceholders from './ReportVisualPlaceholders'
import { formatPatientAgeGender } from '../../../utils/formatAge'

function getRiskBadgeColor(level = '') {
  const l = level.toLowerCase()
  if (l === 'critical') return 'bg-danger text-white border-danger'
  if (l === 'high') return 'bg-danger/10 text-danger border-danger/30'
  if (l === 'moderate') return 'bg-warning/10 text-warning border-warning/30'
  return 'bg-success/10 text-success border-success/30'
}

function ReportPreview({
  content,
  reportNumber,
  status = 'draft',
  sectionRefs = {},
  report = null,
}) {
  if (!content) return null

  const {
    template = 'Standard Clinical Report',
    options = {},
    patient_info = {},
    clinical_summary = {},
    imaging_findings = {},
    ai_assessment = {},
    rotterdam_criteria = null,
    risk_assessment = {},
    recommendations = {},
    addendums = [],
  } = content

  const riskLevel = (risk_assessment.risk_level || 'low').toUpperCase()
  const isSigned = status === 'signed' || status === 'addendum'

  const isPcos =
    report?.module === 'pcos' ||
    report?.scan_type?.toLowerCase().includes('pcos') ||
    Boolean(rotterdam_criteria) ||
    patient_info?.scan_type?.toLowerCase().includes('pcos')

  const showRotterdam = isPcos && options.include_rotterdam !== false

  const rData = rotterdam_criteria || {}
  const c1Met = Boolean(rData.oligo_anovulation ?? report?.criterion_oligo_anovulation)
  const c2Met = Boolean(rData.hyperandrogenism ?? report?.criterion_hyperandrogenism)
  const c3Met = Boolean(rData.polycystic_ovaries ?? report?.criterion_polycystic_ovaries)
  const metCount =
    rData.criteria_met ??
    report?.rotterdam_criteria_met ??
    (c1Met ? 1 : 0) + (c2Met ? 1 : 0) + (c3Met ? 1 : 0)
  const isPositive =
    rData.rotterdam_positive ??
    report?.rotterdam_positive ??
    (metCount >= 2)

  return (
    <div className="relative rounded-2xl border border-border bg-surface p-8 shadow-md">
      {/* Draft / Signed Watermark Badge */}
      <div className="absolute right-6 top-6">
        <span
          className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
            isSigned
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}
        >
          {isSigned ? 'SIGNED & LOCKED' : 'DRAFT PREVIEW'}
        </span>
      </div>

      {/* Header with AuraMed Logo and Tagline */}
      <div className="border-b-2 border-accent pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-black text-sm">
            AM
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-primary">
              AURAMED HEALTHCARE
            </h1>
            <p className="text-[10px] font-semibold tracking-wider text-accent uppercase">
              Multimodal Clinical Decision Support System
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-primary/70">
          <p className="font-bold text-primary">{template}</p>
          <p className="font-mono text-primary/60">
            Report ID: <strong className="text-primary">{reportNumber || 'RPT-PENDING'}</strong>
          </p>
        </div>
      </div>

      {/* SECTION 1: Patient Information */}
      <div ref={sectionRefs.patient_info} className="mt-6 border-b border-border/80 pb-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-primary/50">
          1. Patient Information
        </h2>
        <div className="mt-2.5 grid grid-cols-1 gap-4 rounded-xl border border-border/70 bg-slate-50/70 p-4 text-xs sm:grid-cols-2">
          <div className="space-y-1.5">
            <p>
              <strong className="text-primary/60">Name:</strong>{' '}
              <span className="font-bold text-primary">{patient_info.name}</span>
            </p>
            <p>
              <strong className="text-primary/60">Patient ID:</strong>{' '}
              <span className="font-mono font-semibold text-primary">{patient_info.patient_id}</span>
            </p>
            <p>
              <strong className="text-primary/60">Age / Gender:</strong>{' '}
              <span className="font-medium text-primary">
                {formatPatientAgeGender(patient_info.age, patient_info.dob, patient_info.gender)}
              </span>
            </p>
            <p>
              <strong className="text-primary/60">Date of Scan:</strong>{' '}
              <span className="font-medium text-primary">{patient_info.date_of_scan}</span>
            </p>
          </div>
          <div className="space-y-1.5">
            <p>
              <strong className="text-primary/60">Referring Physician:</strong>{' '}
              <span className="font-medium text-primary">{patient_info.referring_physician}</span>
            </p>
            <p>
              <strong className="text-primary/60">Scan Type:</strong>{' '}
              <span className="font-medium text-primary">{patient_info.scan_type}</span>
            </p>
            <p>
              <strong className="text-primary/60">Clinical Indication:</strong>{' '}
              <span className="font-medium text-primary">{patient_info.indication}</span>
            </p>
            <p>
              <strong className="text-primary/60">Report Date:</strong>{' '}
              <span className="font-medium text-primary">{patient_info.report_date}</span>
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 2: Clinical Summary */}
      <div ref={sectionRefs.clinical_summary} className="mt-6 border-b border-border/80 pb-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-primary/50">
          2. Clinical Summary
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-primary/80">
          {clinical_summary.summary_text}
        </p>

        {options.include_reference_ranges && clinical_summary.factors?.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-slate-50/50">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-slate-100/70 uppercase text-primary/50 text-[10px]">
                <tr>
                  <th className="py-1.5 px-3">Clinical Factor</th>
                  <th className="py-1.5 px-3">Value Entered</th>
                  <th className="py-1.5 px-3">Contribution / Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clinical_summary.factors.map((f, i) => (
                  <tr key={i}>
                    <td className="py-1.5 px-3 font-semibold text-primary/90">{f.name}</td>
                    <td className="py-1.5 px-3 text-primary/70">{f.value}</td>
                    <td className="py-1.5 px-3 font-medium text-primary/80 capitalize">{f.impact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 3: Imaging Findings */}
      <div ref={sectionRefs.imaging_findings} className="mt-6 border-b border-border/80 pb-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-primary/50">
          3. Imaging Findings
        </h2>

        {/* Image Thumbnails */}
        {options.include_images && (
          <div className="mt-3">
            <ReportVisualPlaceholders
              labels={imaging_findings.image_labels}
              mainImageUrl={
                imaging_findings.main_image_url ||
                report?.image_url ||
                (report?.image_path ? `/${report.image_path}` : null)
              }
              gradcamHeatmapB64={
                report?.grad_cam_base64 ||
                imaging_findings.grad_cam_base64 ||
                (report?.gradcam_heatmap_b64 && !report.gradcam_heatmap_b64.startsWith('/9j/') && imaging_findings.grad_cam_base64 ? imaging_findings.grad_cam_base64 : null) ||
                imaging_findings.gradcam_heatmap_b64 ||
                report?.gradcam_heatmap_b64
              }
              secondaryImageUrl={imaging_findings.secondary_image_url}
              segmentationImageUrl={imaging_findings.segmentation_image_url}
            />
          </div>
        )}

        <p className="mt-3 text-xs leading-relaxed text-primary/80">
          {imaging_findings.description}
        </p>

        <ul className="mt-2 space-y-1 text-xs text-primary/70">
          {imaging_findings.findings_bullets?.map((bullet, idx) => {
            const formattedBullet = typeof bullet === 'string'
              ? bullet.replace(/^Finding noted\b/i, 'Borderline density irregularity')
              : bullet
            return (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                <span>{formattedBullet}</span>
              </li>
            )
          })}
        </ul>
      </div>

      {/* SECTION 4: AI & Clinical Assessment Table */}
      {options.include_ai_details && (
        <div ref={sectionRefs.ai_assessment} className="mt-6 border-b border-border/80 pb-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary/50">
            4. AI and Clinical Assessment
          </h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-slate-100/80 text-[10px] uppercase text-primary/60">
                <tr>
                  <th className="py-2 px-3">Component</th>
                  <th className="py-2 px-3">Result / Score</th>
                  <th className="py-2 px-3">Interpretation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ai_assessment.rows?.map((row, idx) => {
                  const isFusion = idx === 2
                  return (
                    <tr
                      key={idx}
                      className={isFusion ? 'bg-accent/5 font-semibold' : 'bg-surface'}
                    >
                      <td className="py-2 px-3 font-semibold text-primary">{row.component}</td>
                      <td className="py-2 px-3 font-mono text-accent font-bold">{row.result}</td>
                      <td className="py-2 px-3 text-primary/80">
                        {isFusion ? (
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold border ${getRiskBadgeColor(
                              riskLevel
                            )}`}
                          >
                            {riskLevel} RISK
                          </span>
                        ) : (
                          row.interpretation
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: Rotterdam Criteria Assessment for PCOS */}
      {showRotterdam && (
        <div ref={sectionRefs.rotterdam_criteria} className="mt-6 border-b border-border/80 pb-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary/50">
            3. ROTTERDAM CRITERIA ASSESSMENT
          </h2>

          <div className="mt-2.5 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-slate-100/80 text-[10px] uppercase text-primary/60">
                <tr>
                  <th className="py-2 px-3">CRITERION</th>
                  <th className="py-2 px-3">STATUS</th>
                  <th className="py-2 px-3">BASIS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="bg-surface">
                  <td className="py-2 px-3 font-semibold text-primary">Oligo/Anovulation</td>
                  <td className="py-2 px-3 font-medium">
                    {c1Met ? (
                      <span className="text-emerald-700 font-bold">Met ✓</span>
                    ) : (
                      <span className="text-primary/50">Not Met ✗</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-primary/70">Clinical history</td>
                </tr>
                <tr className="bg-surface">
                  <td className="py-2 px-3 font-semibold text-primary">Hyperandrogenism</td>
                  <td className="py-2 px-3 font-medium">
                    {c2Met ? (
                      <span className="text-emerald-700 font-bold">Met ✓</span>
                    ) : (
                      <span className="text-primary/50">Not Met ✗</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-primary/70">Clinical examination</td>
                </tr>
                <tr className="bg-surface">
                  <td className="py-2 px-3 font-semibold text-primary">Polycystic Ovaries</td>
                  <td className="py-2 px-3 font-medium">
                    {c3Met ? (
                      <span className="text-emerald-700 font-bold">Met ✓</span>
                    ) : (
                      <span className="text-primary/50">Not Met ✗</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-primary/70">Ultrasound imaging</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <p className="font-bold text-primary">
              Criteria Met: {metCount} of 3
            </p>
            <p className="font-bold">
              Rotterdam Diagnosis:{' '}
              <span className={isPositive ? 'text-rose-600 font-black' : 'text-emerald-600 font-black'}>
                {isPositive ? 'POSITIVE' : 'NEGATIVE'}
              </span>
            </p>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-primary/70 italic">
            {rData.note ||
              (isPositive
                ? 'Patient meets Rotterdam 2003 diagnostic criteria for PCOS. Clinical correlation and endocrinology referral recommended.'
                : 'Patient does not meet Rotterdam 2003 threshold. PCOS diagnosis not supported by current clinical data.')}
          </p>
        </div>
      )}

      {/* SECTION 5: Risk Assessment Banner */}
      <div ref={sectionRefs.risk_assessment} className="mt-6 border-b border-border/80 pb-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-primary/50">
          5. Risk Assessment
        </h2>
        <div
          className={`mt-2.5 rounded-xl border-2 p-5 text-center shadow-sm ${
            riskLevel === 'CRITICAL' || riskLevel === 'HIGH'
              ? 'border-danger/30 bg-danger/5'
              : riskLevel === 'MODERATE'
              ? 'border-warning/30 bg-warning/5'
              : 'border-success/30 bg-success/5'
          }`}
        >
          <p className="text-xs font-bold tracking-wider text-primary/60 uppercase">
            {risk_assessment.label || 'FINAL RISK STRATIFICATION'}
          </p>
          <p
            className={`mt-1 font-mono text-3xl font-black ${
              riskLevel === 'CRITICAL' || riskLevel === 'HIGH'
                ? 'text-danger'
                : riskLevel === 'MODERATE'
                ? 'text-warning'
                : 'text-success'
            }`}
          >
            {riskLevel} RISK
          </p>
          <p className="mt-2 text-xs font-medium text-primary/80 max-w-lg mx-auto">
            {risk_assessment.recommendation_sentence}
          </p>
        </div>
      </div>

      {/* SECTION 6: Recommendations */}
      <div ref={sectionRefs.recommendations} className="mt-6 border-b border-border/80 pb-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-primary/50">
          6. Recommendations & Plan
        </h2>
        <ul className="mt-2.5 space-y-1.5 text-xs text-primary/80">
          {recommendations.recommendations_list?.map((rec, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
              <span>{rec}</span>
            </li>
          ))}
        </ul>

        {/* AI Insight Callout Box */}
        {recommendations.ai_insight_explanation && (
          <div className="mt-3.5 rounded-lg border border-accent/30 bg-accent/10 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-accent">
              <Sparkles size={13} />
              <span>AI Multimodal Model Explanation</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-primary/80">
              {recommendations.ai_insight_explanation}
            </p>
          </div>
        )}
      </div>

      {/* Addendums if present */}
      {addendums && addendums.length > 0 && (
        <div className="mt-6 border-b border-border/80 pb-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-700">
            7. Official Addendums
          </h2>
          <div className="mt-2.5 space-y-2">
            {addendums.map((add) => (
              <div
                key={add.id}
                className="rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-xs"
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                  <span>Dr. {add.doctor_name} ({add.registration_number})</span>
                  <span className="font-mono text-amber-700">{add.created_at}</span>
                </div>
                <p className="mt-1.5 text-primary/90 leading-relaxed">{add.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Disclaimer */}
      {options.include_disclaimers && (
        <div className="mt-6 pt-2 text-center text-[11px] text-primary/50">
          <p>
            This report is generated with the assistance of AI models and should be interpreted in
            the context of clinical findings.
          </p>
          <p className="mt-0.5 text-[10px]">
            AuraMed v2.4 • Confidential Clinical Healthcare Record
          </p>
        </div>
      )}
    </div>
  )
}

export default ReportPreview
