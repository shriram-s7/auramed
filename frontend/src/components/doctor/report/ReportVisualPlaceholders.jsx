import { useState } from 'react'
import { Eye, Maximize2, Sparkles, X } from 'lucide-react'

function ReportVisualPlaceholders({
  mainImageUrl,
  gradcamHeatmapB64,
  secondaryImageUrl,
  segmentationImageUrl,
  labels = [],
  fourPanel = false,
}) {
  const [lightboxImg, setLightboxImg] = useState(null)

  const gradcamSrc = gradcamHeatmapB64
    ? gradcamHeatmapB64.startsWith('data:')
      ? gradcamHeatmapB64
      : `data:${gradcamHeatmapB64.startsWith('/9j/') ? 'image/jpeg' : 'image/png'};base64,${gradcamHeatmapB64}`
    : null

  const isRawColormap =
    gradcamHeatmapB64 &&
    !gradcamHeatmapB64.startsWith('/9j/') &&
    !gradcamHeatmapB64.includes('image/jpeg') &&
    Boolean(mainImageUrl)

  // Fallbacks for 4-panel mode
  const resolvedSecondarySrc = secondaryImageUrl || mainImageUrl || null
  const resolvedSegmentationSrc = segmentationImageUrl || gradcamSrc || mainImageUrl || null

  return (
    <div className="space-y-4">
      {/* 2-panel or 4-panel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Panel 1: Main Scan View */}
        <div className="flex flex-col space-y-2">
          <div
            onClick={() => mainImageUrl && setLightboxImg({ src: mainImageUrl, label: labels[0] || 'Main Scan View (DICOM)' })}
            className={`group relative h-48 w-full overflow-hidden rounded-xl border border-border bg-slate-950 shadow-sm transition hover:border-teal-500/60 ${
              mainImageUrl ? 'cursor-pointer' : ''
            }`}
          >
            {mainImageUrl ? (
              <>
                <img
                  src={mainImageUrl}
                  alt="Main Diagnostic Scan"
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 transition group-hover:opacity-100 flex items-center justify-center">
                  <span className="flex items-center gap-1.5 rounded-lg bg-black/80 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
                    <Maximize2 size={13} /> View Main Scan
                  </span>
                </div>
                <div className="absolute top-2 left-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-[10px] font-mono font-bold text-teal-400 border border-teal-500/30">
                  PRIMARY DICOM
                </div>
              </>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center text-slate-500">
                <svg viewBox="0 0 160 110" className="h-16 w-24 select-none opacity-40" role="img">
                  <rect width="160" height="110" fill="#0F172A" />
                  <path d="M 20 15 C 70 20 130 45 135 85 C 140 105 100 105 20 105 Z" fill="#1E293B" stroke="#475569" strokeWidth="1" />
                  <circle cx="85" cy="65" r="8" fill="#0D9488" opacity="0.8" />
                </svg>
                <span className="text-[11px] text-slate-400">Primary scan awaiting upload</span>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-primary">{labels[0] || 'Main Scan View'}</p>
            <p className="text-[11px] text-primary/50">Primary radiographic acquisition</p>
          </div>
        </div>

        {/* Panel 2: Secondary Projection */}
        {(fourPanel || secondaryImageUrl) && (
          <div className="flex flex-col space-y-2">
            <div
              onClick={() => resolvedSecondarySrc && setLightboxImg({ src: resolvedSecondarySrc, label: labels[1] || 'Secondary Projection' })}
              className={`group relative h-48 w-full overflow-hidden rounded-xl border border-border bg-slate-950 shadow-sm transition hover:border-teal-500/60 ${
                resolvedSecondarySrc ? 'cursor-pointer' : ''
              }`}
            >
              {resolvedSecondarySrc ? (
                <>
                  <img
                    src={resolvedSecondarySrc}
                    alt="Secondary Projection"
                    style={secondaryImageUrl ? {} : { filter: 'contrast(125%) brightness(95%)' }}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 transition group-hover:opacity-100 flex items-center justify-center">
                    <span className="flex items-center gap-1.5 rounded-lg bg-black/80 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
                      <Maximize2 size={13} /> View Projection
                    </span>
                  </div>
                  <div className="absolute top-2 left-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-[10px] font-mono font-bold text-teal-400 border border-teal-500/30">
                    {secondaryImageUrl ? 'PROJECTION 2' : 'CONTRAST ENHANCED'}
                  </div>
                </>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center text-slate-500">
                  <span className="text-xs font-mono text-teal-400 font-bold">Secondary Projection</span>
                  <span className="text-[11px] text-slate-400 mt-1">Single acquisition sequence</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-primary">{labels[1] || 'Secondary Projection'}</p>
              <p className="text-[11px] text-primary/50">
                {secondaryImageUrl ? 'Orthogonal projection view' : 'High-contrast DICOM tissue projection'}
              </p>
            </div>
          </div>
        )}

        {/* Panel 3: AI Focus Area Zoomed / Grad-CAM */}
        {(gradcamSrc || fourPanel) && (
          <div className="flex flex-col space-y-2">
            <div
              onClick={() => (gradcamSrc || mainImageUrl) && setLightboxImg({ src: gradcamSrc || mainImageUrl, label: labels[2] || 'AI Focus Area (Grad-CAM Saliency)' })}
              className={`group relative h-48 w-full overflow-hidden rounded-xl border border-border bg-slate-950 shadow-sm transition hover:border-teal-500/60 ${
                gradcamSrc || mainImageUrl ? 'cursor-pointer' : ''
              }`}
            >
              {gradcamSrc ? (
                <>
                  {isRawColormap && (
                    <img
                      src={mainImageUrl}
                      alt="Diagnostic Scan Base"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <img
                    src={gradcamSrc}
                    alt="AI Focus Area Zoomed"
                    className={`h-full w-full object-cover transition duration-200 group-hover:scale-105 ${
                      isRawColormap ? 'relative mix-blend-screen opacity-90' : ''
                    }`}
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 transition group-hover:opacity-100 flex items-center justify-center">
                    <span className="flex items-center gap-1.5 rounded-lg bg-black/80 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
                      <Maximize2 size={13} /> View AI Heatmap
                    </span>
                  </div>
                  <div className="absolute top-2 right-2 rounded-full bg-black/80 px-2.5 py-0.5 text-[10px] font-bold text-teal-300 flex items-center gap-1 border border-teal-500/30">
                    <Sparkles size={10} /> Grad-CAM
                  </div>
                </>
              ) : mainImageUrl ? (
                <>
                  <img
                    src={mainImageUrl}
                    alt="AI Focus Zoom"
                    className="h-full w-full object-cover scale-150 transition duration-200 group-hover:scale-160"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 transition group-hover:opacity-100 flex items-center justify-center">
                    <span className="flex items-center gap-1.5 rounded-lg bg-black/80 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
                      <Maximize2 size={13} /> View AI Focus
                    </span>
                  </div>
                  <div className="absolute top-2 right-2 rounded-full bg-black/80 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 flex items-center gap-1 border border-amber-500/30">
                    <Eye size={10} /> ROI ZOOM
                  </div>
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-xs font-mono text-teal-400 font-bold">AI Focus Area Zoomed</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-primary">{labels[2] || 'AI Focus Area Zoomed'}</p>
              <p className="text-[11px] text-primary/60 leading-tight">
                Warmer hues denote neural attention coordinates and highest diagnostic weight.
              </p>
            </div>
          </div>
        )}

        {/* Panel 4: AI Segmentation Mask */}
        {(fourPanel || segmentationImageUrl) && (
          <div className="flex flex-col space-y-2">
            <div
              onClick={() => resolvedSegmentationSrc && setLightboxImg({ src: resolvedSegmentationSrc, label: labels[3] || 'AI Segmentation Mask' })}
              className={`group relative h-48 w-full overflow-hidden rounded-xl border border-border bg-slate-950 shadow-sm transition hover:border-teal-500/60 ${
                resolvedSegmentationSrc ? 'cursor-pointer' : ''
              }`}
            >
              {resolvedSegmentationSrc ? (
                <>
                  <img
                    src={resolvedSegmentationSrc}
                    alt="AI Segmentation Mask"
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  {/* Subtle target ROI focus grid */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-28 w-28 rounded-xl border border-dashed border-teal-400/70 bg-teal-400/10 ring-2 ring-teal-500/30 flex items-start justify-between p-1.5">
                      <span className="text-[9px] font-mono font-bold text-teal-300 bg-slate-950/80 px-1 rounded">ROI #1</span>
                      <span className="text-[9px] font-mono font-bold text-teal-300 bg-slate-950/80 px-1 rounded">MASK</span>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-black/30 opacity-0 transition group-hover:opacity-100 flex items-center justify-center">
                    <span className="flex items-center gap-1.5 rounded-lg bg-black/80 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
                      <Maximize2 size={13} /> View Segmentation
                    </span>
                  </div>
                  <div className="absolute top-2 right-2 rounded-full bg-black/80 px-2.5 py-0.5 text-[10px] font-bold text-teal-300 flex items-center gap-1 border border-teal-500/30">
                    <Eye size={10} /> SEGMENTATION
                  </div>
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-xs font-mono text-teal-400 font-bold">AI Segmentation Mask</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-primary">{labels[3] || 'AI Segmentation Mask'}</p>
              <p className="text-[11px] text-primary/50">Automated lesion delineation and boundary contouring</p>
            </div>
          </div>
        )}
      </div>

      {/* Full-Size Lightbox Modal */}
      {lightboxImg && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-2 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-white">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
                <h4 className="text-sm font-bold">{lightboxImg.label}</h4>
              </div>
              <button
                type="button"
                onClick={() => setLightboxImg(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center justify-center p-3 bg-black">
              <img
                src={lightboxImg.src}
                alt={lightboxImg.label}
                className="max-h-[75vh] w-auto rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportVisualPlaceholders
