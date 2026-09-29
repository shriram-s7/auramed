import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import RiskBadgeCompact from './RiskBadgeCompact'

function FusionFinalResultSection({ result, sectionRef }) {
  const imageScore = result?.image_model_score ?? 0
  const clinicalScore = result?.formula_score ?? 0
  const fusionScore = result?.fusion_score ?? 0
  const confidenceScore = result?.confidence_score ?? 0
  const confidencePct = Math.round(confidenceScore * 100)

  const imageWeight = Math.round((result?.fusion_weights?.image ?? 0.6) * 100)
  const clinicalWeight = Math.round((result?.fusion_weights?.clinical ?? 0.4) * 100)

  const confidenceReasons = result?.confidence_reasons || []
  const limitations = result?.limitations || []
  const isHighConfidence = confidenceScore >= 0.75

  const scoreGap = Math.abs(imageScore - clinicalScore)
  const hasDisagreement = scoreGap >= 0.3
  const isImageDriven = imageScore > clinicalScore
  const riskDriver = hasDisagreement ? (isImageDriven ? 'Image-driven' : 'Clinical-driven') : undefined

  return (
    <div ref={sectionRef} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
          3
        </span>
        <h2 className="text-sm font-bold text-primary">Fusion & Final Result</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Image Model</p>
          <p className="mt-1 font-mono text-3xl font-black text-teal-600">
            {imageScore.toFixed(2)}
          </p>
          <p className="mt-0.5 text-[11px] text-teal-700/70">Raw Neural Score</p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">Clinical Model</p>
          <p className="mt-1 font-mono text-3xl font-black text-blue-600">
            {clinicalScore.toFixed(2)}
          </p>
          <p className="mt-0.5 text-[11px] text-blue-700/70">Formula Score</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-background p-3.5 border border-border/70">
        <div className="flex items-center justify-between text-xs font-medium text-primary/70">
          <span className="flex items-center gap-1 text-teal-700 font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-teal-500" />
            Image ({imageWeight}%)
          </span>
          <span className="font-semibold text-primary/50 text-[11px]">Ensemble Fusion</span>
          <span className="flex items-center gap-1 text-blue-700 font-semibold">
            Clinical ({clinicalWeight}%)
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
          </span>
        </div>

        <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full border border-border/80 bg-slate-100">
          <div
            className="h-full bg-teal-500 transition-all duration-700"
            style={{ width: `${imageWeight}%` }}
            title={`Image Model Weight: ${imageWeight}%`}
          />
          <div
            className="h-full bg-blue-500 transition-all duration-700"
            style={{ width: `${clinicalWeight}%` }}
            title={`Clinical Model Weight: ${clinicalWeight}%`}
          />
        </div>
      </div>

      {hasDisagreement && (
        <div className="mt-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-3.5 text-amber-900">
          <p className="text-xs font-extrabold uppercase tracking-wide text-amber-800">
            ⚠️ Diagnostic Disagreement Detected
          </p>
          <p className="mt-1.5 text-xs leading-relaxed">
            Image model score ({imageScore.toFixed(2)}) and clinical formula score ({clinicalScore.toFixed(2)}) diverge
            significantly (gap: {scoreGap.toFixed(2)}).{' '}
            {isImageDriven
              ? 'Imaging findings suggest higher risk than clinical inputs alone indicate. Image findings take precedence.'
              : 'The image appears normal/low-risk but clinical risk factors independently elevate risk. Conservative protocol applies clinical score weight.'}
          </p>
        </div>
      )}

      <div className="mt-5 flex items-center justify-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary/50">Overall Risk Level</p>
        <RiskBadgeCompact level={result?.risk_level} suffix={riskDriver} />
      </div>

      <div className="mt-4 flex items-center justify-around rounded-lg border border-border/80 bg-slate-50 py-3">
        <div className="text-center">
          <p className="text-[11px] font-semibold text-primary/50 uppercase">Risk Score</p>
          <p className="font-mono text-xl font-extrabold text-primary">
            {fusionScore.toFixed(2)}
          </p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <p className="text-[11px] font-semibold text-primary/50 uppercase">Model Confidence</p>
          <p className="font-mono text-xl font-extrabold text-accent">
            {confidencePct}%
          </p>
        </div>
      </div>

      <div
        className={`mt-4 rounded-lg border p-3.5 ${
          isHighConfidence
            ? 'border-emerald-200 bg-emerald-50/60 text-emerald-950'
            : 'border-amber-200 bg-amber-50/60 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
          {isHighConfidence ? (
            <CheckCircle2 size={14} className="text-emerald-600" />
          ) : (
            <AlertCircle size={14} className="text-amber-600" />
          )}
          <span>{isHighConfidence ? 'Why Confidence Is High' : 'Confidence Factors'}</span>
        </div>
        <ul className="mt-2 space-y-1.5 pl-2 text-xs">
          {confidenceReasons.length > 0 ? (
            confidenceReasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-1.5 text-primary/80">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                <span>{reason}</span>
              </li>
            ))
          ) : (
            <li className="text-primary/60">Sufficient multimodal signals were collected for fusion.</li>
          )}
        </ul>
      </div>

      <div className="mt-3.5 rounded-lg border border-amber-300 bg-amber-50/70 p-3.5 text-amber-900">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
          <AlertTriangle size={14} className="text-amber-600" />
          <span>Diagnostic Limitations</span>
        </div>
        <ul className="mt-2 space-y-1.5 pl-2 text-xs">
          {limitations.length > 0 ? (
            limitations.map((limitation, i) => (
              <li key={i} className="flex items-start gap-1.5 text-amber-900/90">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                <span>{limitation}</span>
              </li>
            ))
          ) : (
            <li className="text-amber-800/80">
              This analysis is decision support only and does not replace histopathological confirmation.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

export default FusionFinalResultSection
