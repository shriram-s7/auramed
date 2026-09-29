import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle,
  Eye,
  Layers,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react'
import { getScanPrimaryImage } from '../../../services/scanService'

const MODULE_CONFIG = {
  breast: {
    areaLabel: 'Mammogram AI Focus Map',
    note: 'Suspicious regions in mammography typically appear in the upper outer quadrant.',
  },
  cervical: {
    areaLabel: 'Cervical Cell AI Attention Map',
    note: 'Cell morphology anomalies drive model activation in cervical classification.',
  },
  pcos: {
    areaLabel: 'Ovarian Ultrasound AI Saliency Map',
    note: 'Follicle distribution and ovarian volume are primary attention drivers.',
  },
}

export default function AiVisualIntelligenceSection({
  module = 'breast',
  result,
  scanId,
  sectionRef,
}) {
  const [viewMode, setViewMode] = useState('heatmap') // 'heatmap' | 'diagnostic'
  const [isExpanded, setIsExpanded] = useState(false)
  const [primaryImage, setPrimaryImage] = useState(null)

  const modKey = (module || 'breast').toLowerCase()
  const config = MODULE_CONFIG[modKey] || MODULE_CONFIG.breast

  // Helper to ensure proper data URL format (JPEG vs PNG)
  const toDataUrl = (b64) => {
    if (!b64) return null
    if (b64.startsWith('data:')) return b64
    const mime = b64.startsWith('/9j/') ? 'image/jpeg' : 'image/png'
    return `data:${mime};base64,${b64}`
  }

  // Prioritize pre-blended overlay (scan + heatmap) over raw standalone heatmap
  const blendedGradcamB64 =
    result?.grad_cam_base64 ||
    result?.reasoning?.grad_cam_base64 ||
    result?.ai_suggestions?.grad_cam_base64 ||
    result?.gradcam_image ||
    null

  const rawHeatmapB64 =
    result?.gradcam_heatmap_b64 ||
    result?.heatmap_base64 ||
    result?.reasoning?.gradcam_heatmap_b64 ||
    result?.ai_suggestions?.gradcam_heatmap_b64 ||
    null

  // Extract source/diagnostic scan image
  const rawSourceImage =
    result?.image_url ||
    result?.image_path ||
    result?.primary_image ||
    result?.scan?.image_path ||
    null

  // Fetch primary image if missing and scanId provided
  useEffect(() => {
    const sId = scanId || result?.scan_id || result?.id
    if (!rawSourceImage && sId) {
      getScanPrimaryImage(sId)
        .then((res) => {
          const img = res.data?.image_b64 || res.data?.image_url
          if (img) setPrimaryImage(img)
        })
        .catch(() => {})
    }
  }, [scanId, result, rawSourceImage])

  const cleanSource = primaryImage || rawSourceImage
  const sourceSrc = cleanSource
    ? cleanSource.startsWith('data:') || cleanSource.startsWith('http')
      ? cleanSource
      : cleanSource.startsWith('/')
      ? cleanSource
      : `/${cleanSource}`
    : null

  // Overlay image source
  const overlaySrc = toDataUrl(blendedGradcamB64)
  const standaloneHeatmapSrc = toDataUrl(rawHeatmapB64)

  // Primary heatmap image to display: if blended is available, use it;
  // otherwise fallback to standalone heatmap
  const activeHeatmapSrc = overlaySrc || standaloneHeatmapSrc
  const isUsingBlended = Boolean(overlaySrc)

  return (
    <div
      ref={sectionRef}
      className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-5"
    >
      {/* 1. Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm">
            <Sparkles size={18} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-primary">AI Visual Intelligence</h2>
              <span className="text-xs font-semibold text-primary/50">•</span>
              <span className="text-xs font-medium text-primary/70">
                Grad-CAM Neural Activation Map
              </span>
            </div>
            <p className="text-xs text-primary/60 mt-0.5">
              The deep learning model&apos;s visual attention — showing exactly which image regions drove
              the risk prediction.
            </p>
          </div>
        </div>

        {/* Novelty Feature Badge */}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 border border-teal-200 shadow-xs">
          <Sparkles size={12} className="text-teal-600" />
          Novelty Feature
        </span>
      </div>

      {/* 2. Image Area Controls (Segmented Control + Expand Button) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs">
          <span className="font-bold text-primary">{config.areaLabel}</span>
          <span className="text-primary/50 ml-2 font-mono text-[11px]">
            {viewMode === 'heatmap' ? 'Grad-CAM Overlay View' : 'Original Diagnostic Scan'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented Control Pill Toggle */}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-border">
            <button
              type="button"
              onClick={() => setViewMode('diagnostic')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'diagnostic'
                  ? 'bg-surface text-primary shadow-xs'
                  : 'text-primary/60 hover:text-primary'
              }`}
            >
              <Eye size={13} />
              Diagnostic View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('heatmap')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'heatmap'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-primary/60 hover:text-primary'
              }`}
            >
              <Layers size={13} />
              AI Heatmap View
            </button>
          </div>

          {/* Expanded View Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-slate-50"
          >
            {isExpanded ? (
              <>
                <Minimize2 size={13} />
                Collapse
              </>
            ) : (
              <>
                <Maximize2 size={13} />
                Expand
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Image Display Area with Smooth Crossfade & Height Transition */}
      <div
        className={`relative w-full rounded-xl overflow-hidden bg-slate-950 border border-border flex items-center justify-center transition-[height] duration-300 ease-in-out ${
          isExpanded ? 'h-[560px]' : 'h-[320px]'
        }`}
      >
        {/* Diagnostic Scan Image */}
        {sourceSrc ? (
          <img
            src={sourceSrc}
            alt="Original Diagnostic Scan"
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ease-in-out ${
              viewMode === 'diagnostic' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'
            }`}
          />
        ) : (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs transition-opacity duration-300 ${
              viewMode === 'diagnostic' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'
            }`}
          >
            <Eye size={24} className="mb-1 text-slate-600" />
            Original diagnostic image not loaded
          </div>
        )}

        {/* AI Heatmap / Grad-CAM Overlay Image */}
        {activeHeatmapSrc ? (
          <>
            {/* If fallback to raw standalone heatmap and source scan is present, render source scan underneath */}
            {!isUsingBlended && sourceSrc && (
              <img
                src={sourceSrc}
                alt="Original Diagnostic Scan (Underlay)"
                className={`absolute inset-0 h-full w-full object-contain ${
                  viewMode === 'heatmap' ? 'opacity-100 z-5' : 'opacity-0 pointer-events-none'
                }`}
              />
            )}
            <img
              src={activeHeatmapSrc}
              alt="AI Saliency Grad-CAM Heatmap Overlay"
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ease-in-out ${
                viewMode === 'heatmap'
                  ? `opacity-100 z-10 ${!isUsingBlended ? 'mix-blend-screen' : ''}`
                  : 'opacity-0 pointer-events-none z-0'
              }`}
            />
          </>
        ) : (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs transition-opacity duration-300 ${
              viewMode === 'heatmap' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'
            }`}
          >
            <Sparkles size={24} className="mb-1 text-slate-600" />
            Grad-CAM heatmap not available for this scan
          </div>
        )}

        {/* In-image Active Badge */}
        <div className="absolute bottom-2.5 right-2.5 z-20 rounded-md bg-black/70 px-2 py-1 font-mono text-[10px] text-white backdrop-blur-xs">
          {viewMode === 'heatmap' ? 'SALIENCY OVERLAY ACTIVE' : 'DIAGNOSTIC RAW VIEW'}
        </div>
      </div>

      {/* 4. Color Legend */}
      <div className="space-y-1.5 rounded-xl border border-border bg-slate-50/70 p-3">
        <div className="flex items-center justify-between text-xs font-semibold text-primary/70">
          <span>Low</span>
          <span className="text-[11px] font-medium text-primary/50">Model attention intensity</span>
          <span>High</span>
        </div>
        {/* Horizontal Gradient Bar from blue -> green -> yellow -> red */}
        <div className="h-2.5 w-full rounded-full bg-gradient-to-r from-blue-600 via-emerald-500 via-yellow-400 to-red-600 shadow-inner" />
      </div>

      {/* 5. Clinical Annotation Strip (3 Info Cards with subtle teal left border) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg border border-border border-l-4 border-l-teal-600 bg-surface p-3 text-primary/80 space-y-1">
          <p className="font-bold text-primary">Activation Weighting</p>
          <p className="text-[11px] text-primary/70 leading-relaxed">
            Regions highlighted in red/yellow received the highest model activation weight.
          </p>
        </div>

        <div className="rounded-lg border border-border border-l-4 border-l-teal-600 bg-surface p-3 text-primary/80 space-y-1">
          <p className="font-bold text-primary">Clinical Correlation</p>
          <p className="text-[11px] text-primary/70 leading-relaxed">
            Cross-reference highlighted regions with clinical examination findings.
          </p>
        </div>

        <div className="rounded-lg border border-border border-l-4 border-l-teal-600 bg-surface p-3 text-primary/80 space-y-1">
          <p className="font-bold text-primary">Attention vs. Pathology</p>
          <p className="text-[11px] text-primary/70 leading-relaxed">
            This map does not indicate pathology — it shows model attention, not diagnosis.
          </p>
        </div>
      </div>

      {/* 6. Module-Specific Note */}
      <div className="rounded-lg bg-teal-50/70 border border-teal-200 p-3 text-xs text-teal-950 flex items-start gap-2">
        <AlertCircle size={15} className="text-teal-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">{config.areaLabel}: </span>
          <span className="text-teal-900">{config.note}</span>
        </div>
      </div>
    </div>
  )
}
