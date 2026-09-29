import { useState } from 'react'
import { Info, Maximize2, ScanSearch, X, ZoomIn } from 'lucide-react'

function HeatmapLegend() {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-white/80">
      <span>Low</span>
      <span
        className="h-2 w-14 rounded-full"
        style={{ background: 'linear-gradient(to right, #1d4ed8, #22d3ee, #facc15, #dc2626)' }}
      />
      <span>High</span>
    </div>
  )
}

// Base image and heatmap overlay both use object-cover inside a fixed-size
// position:relative container, so neither one letterboxes.
function HeatmapComposite({ imageUrl, heatmapB64, showHeatmap }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <img src={imageUrl} alt="Scan" className="absolute inset-0 h-full w-full object-cover" />
      {showHeatmap && heatmapB64 && (
        <img
          src={`data:image/png;base64,${heatmapB64}`}
          alt="Grad-CAM attention heatmap (red = high attention, blue = low attention)"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0.45, mixBlendMode: 'multiply' }}
        />
      )}
    </div>
  )
}

function HeatmapLightbox({ imageUrl, heatmapB64, showHeatmap, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
      onClick={onClose}
    >
      <div
        className="relative flex h-[85vh] w-[85vw] max-w-4xl items-center justify-center overflow-hidden rounded-xl bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <HeatmapComposite imageUrl={imageUrl} heatmapB64={heatmapB64} showHeatmap={showHeatmap} />
        {showHeatmap && (
          <div className="absolute bottom-4 left-4">
            <HeatmapLegend />
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-white hover:bg-black/90"
          aria-label="Close full-size view"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

function AiFocusPanel({ imageUrl, module, result }) {
  const heatmapB64 = result?.gradcam_heatmap_b64 || null
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  if (!imageUrl) {
    return (
      <div className="h-full w-full">
        <MedicalScanSvg module={module} isZoomed={true} />
      </div>
    )
  }

  if (heatmapB64) {
    return (
      <>
        <HeatmapComposite imageUrl={imageUrl} heatmapB64={heatmapB64} showHeatmap={showHeatmap} />
        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowHeatmap((v) => !v)}
            className="rounded bg-black/70 px-2 py-1 text-[10px] font-semibold text-white hover:bg-black/90"
          >
            {showHeatmap ? 'Hide Heatmap' : 'Show Heatmap'}
          </button>
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold text-white hover:bg-black/90"
            title="View Full Size"
          >
            <Maximize2 size={10} /> View Full Size
          </button>
        </div>
        {showHeatmap && (
          <div className="absolute bottom-8 left-2">
            <HeatmapLegend />
          </div>
        )}
        {lightboxOpen && (
          <HeatmapLightbox
            imageUrl={imageUrl}
            heatmapB64={heatmapB64}
            showHeatmap={showHeatmap}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </>
    )
  }

  return <img src={imageUrl} alt="Scan" className="max-h-full max-w-full object-contain" />
}

function ConfidenceBar({ value }) {
  const pct = Math.round((value ?? 0) * 100)
  const color = value >= 0.7 ? 'bg-danger' : value >= 0.45 ? 'bg-warning' : 'bg-success'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-border">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs font-semibold text-primary">{(value ?? 0).toFixed(2)}</span>
    </div>
  )
}

function MedicalScanSvg({ module = 'breast', isZoomed = false }) {
  if (module === 'breast') {
    return (
      <svg viewBox="0 0 200 160" className="h-full w-full select-none" role="img" aria-label="Breast mammogram scan visualization">
        <defs>
          <radialGradient id="denseTissue" cx="55%" cy="45%" r="35%">
            <stop offset="0%" stopColor="#CBD5E1" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#94A3B8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#334155" stopOpacity="0.1" />
          </radialGradient>
          <radialGradient id="calcification" cx="50%" cy="50%" r="40%">
            <stop offset="0%" stopColor="#F87171" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#DC2626" stopOpacity="0.2" />
          </radialGradient>
        </defs>
        <rect width="200" height="160" fill="#0F172A" />
        <path
          d="M 20 10 C 90 20 170 60 175 110 C 180 145 130 155 20 155 Z"
          fill="#1E293B"
          stroke="#475569"
          strokeWidth="1.5"
        />
        <path
          d="M 40 40 Q 110 50 130 95 Q 120 135 40 140 Z"
          fill="url(#denseTissue)"
        />
        <ellipse cx="105" cy="82" rx={isZoomed ? "28" : "16"} ry={isZoomed ? "22" : "12"} fill="url(#calcification)" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="3,2" />
        <circle cx="102" cy="80" r="3" fill="#FEF08A" />
        <circle cx="108" cy="85" r="2.5" fill="#FEF08A" />
        <circle cx="98" cy="84" r="2" fill="#FEF08A" />
        <circle cx="90" cy="72" r="1.5" fill="#FFFFFF" opacity="0.8" />
        <circle cx="118" cy="92" r="1.5" fill="#FFFFFF" opacity="0.8" />
      </svg>
    )
  }

  if (module === 'cervical') {
    return (
      <svg viewBox="0 0 200 160" className="h-full w-full select-none" role="img" aria-label="Cervical cytology visualization">
        <rect width="200" height="160" fill="#0F172A" />
        <circle cx="100" cy="80" r="65" fill="#1E293B" stroke="#475569" strokeWidth="1.5" />
        <circle cx="100" cy="80" r="22" fill="#0F172A" stroke="#64748B" strokeWidth="1" />
        <circle cx="100" cy="80" r="42" fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.8" />
        <g transform={isZoomed ? "translate(15, -10) scale(1.3)" : ""}>
          <circle cx="82" cy="65" r="9" fill="#DC2626" opacity="0.5" stroke="#EF4444" strokeWidth="1" />
          <circle cx="82" cy="65" r="5" fill="#7F1D1D" />
          <circle cx="72" cy="72" r="7" fill="#DC2626" opacity="0.4" stroke="#EF4444" strokeWidth="1" />
          <circle cx="72" cy="72" r="4" fill="#7F1D1D" />
        </g>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 200 160" className="h-full w-full select-none" role="img" aria-label="Ovarian ultrasound visualization">
      <rect width="200" height="160" fill="#0F172A" />
      <ellipse cx="100" cy="80" rx="72" ry="52" fill="#1E293B" stroke="#475569" strokeWidth="1.5" />
      <ellipse cx="100" cy="80" rx="38" ry="24" fill="#334155" opacity="0.7" />
      {[
        [50, 65], [62, 50], [82, 42], [105, 40], [128, 45], [145, 58],
        [152, 75], [148, 95], [132, 110], [108, 118], [80, 115], [58, 102], [46, 82]
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="6" fill="#0284C7" opacity="0.7" stroke="#38BDF8" strokeWidth="1" />
      ))}
      <circle cx="132" cy="110" r="14" fill="none" stroke="#F43F5E" strokeWidth="1.5" strokeDasharray="3,2" />
    </svg>
  )
}

function ImageAnalysisSection({ result, sectionRef }) {
  const [tooltip, setTooltip] = useState(false)
  const imageUrl = result?.image_path ? `/${result.image_path}` : null
  const module = result?.module || 'breast'
  const imageFindings = result?.image_findings || []

  const hasHeatmap = Boolean(result?.gradcam_heatmap_b64)

  return (
    <div ref={sectionRef} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            1
          </span>
          <h2 className="text-sm font-bold text-primary">Image Analysis (AI Model)</h2>
        </div>
        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setTooltip(true)}
            onMouseLeave={() => setTooltip(false)}
            className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent transition hover:bg-accent/20"
          >
            {result?.image_model_name || 'AuraMed Image Model'} <Info size={12} />
          </button>
          {tooltip && (
            <div className="absolute right-0 top-full z-20 mt-1 w-60 rounded-lg bg-primary px-3 py-2 text-xs text-white shadow-xl">
              Deep convolutional neural network trained to detect anatomical and cellular anomalies.
              Model output serves as clinical decision support.
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs font-semibold text-primary/60">Key Findings from Image</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div className="relative flex h-44 flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-slate-950">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Uploaded scan"
              className="max-h-full max-w-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const fallback = e.currentTarget.nextSibling
                if (fallback) fallback.style.display = 'block'
              }}
            />
          ) : null}
          <div className={`h-full w-full ${imageUrl ? 'hidden' : 'block'}`}>
            <MedicalScanSvg module={module} isZoomed={false} />
          </div>
          <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white/90">
            Source Scan
          </span>
        </div>

        <div className="relative flex h-44 flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-accent bg-slate-950">
          <AiFocusPanel imageUrl={imageUrl} module={module} result={result} />
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-accent">
            <ScanSearch size={11} /> AI Focus Area
          </span>
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white/80">
            <ZoomIn size={10} /> {hasHeatmap ? 'Grad-CAM' : '2.0x'}
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-primary/40">
            <tr>
              <th className="pb-1.5 font-medium">Finding Description</th>
              <th className="pb-1.5 font-medium">Model Confidence</th>
            </tr>
          </thead>
          <tbody>
            {imageFindings.length > 0 ? (
              imageFindings.map((f, idx) => (
                <tr key={`${f.description}-${idx}`} className="border-t border-border">
                  <td className="py-2.5 pr-2 font-medium text-primary/80">{f.description}</td>
                  <td className="py-2.5">
                    <ConfidenceBar value={f.confidence} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="py-4 text-center text-xs text-primary/40">
                  No explicit image findings recorded
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ClinicalReasoningSection result={result} />
    </div>
  )
}

function ClinicalReasoningSection({ result }) {
  const [expanded, setExpanded] = useState(true)
  const reasoningText = result?.clinical_reasoning || result?.model_interpretation
    || 'Analysis completed with module-specific deep neural network.'

  return (
    <div className="mt-4 rounded-lg bg-background border border-border/60">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between p-3.5 text-left"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-primary/60">
          Clinical Reasoning &amp; AI Interpretation
        </p>
        <span className="text-xs font-semibold text-accent">{expanded ? 'Collapse' : 'Expand'}</span>
      </button>
      {expanded && (
        <p className="whitespace-pre-line px-3.5 pb-3.5 text-xs leading-relaxed text-primary/80">
          {reasoningText}
        </p>
      )}
    </div>
  )
}

export default ImageAnalysisSection
