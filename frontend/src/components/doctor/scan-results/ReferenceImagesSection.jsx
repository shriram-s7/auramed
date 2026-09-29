import { useState } from 'react'
import { ArrowUpRight, CheckCircle2, Expand, X } from 'lucide-react'
import ReferenceImagesModal from './ReferenceImagesModal'
import { REFERENCE_CASES, resolveNearestMatch, resolveNearestMatchId, severityColor } from '../../../config/referenceCases'

function ReferenceCardThumbnail({ caseData, color, onOpenLightbox }) {
  const [errored, setErrored] = useState(false)
  const thumbSrc = caseData.images?.[0]

  if (!thumbSrc || errored) {
    // No dataset image extracted yet (or it 404'd) - fall back to a plain
    // color swatch so the card still reads cleanly without a broken image.
    return <div className="h-32 w-full" style={{ backgroundColor: color, opacity: 0.15 }} />
  }

  return (
    <button
      type="button"
      onClick={onOpenLightbox}
      className="group relative block h-32 w-full overflow-hidden bg-slate-950"
    >
      <img
        src={thumbSrc}
        alt={`${caseData.caseTypeLabel} reference — ${caseData.classification}`}
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
        onError={() => setErrored(true)}
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4">
        <span className="text-[10px] font-bold uppercase tracking-wide text-white">{caseData.classification}</span>
      </div>
      <span className="absolute right-1.5 top-1.5 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
        <Expand size={12} />
      </span>
    </button>
  )
}

function ReferenceLightbox({ caseData, onClose }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const images = caseData.images || []
  const src = images[activeIdx]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={onClose}>
      <div
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={src} alt={caseData.classification} className="max-h-[70vh] w-full object-contain" />
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-white">{caseData.caseTypeLabel}</p>
            <p className="text-xs text-white/60">{caseData.classification}</p>
          </div>
          {images.length > 1 && (
            <div className="flex items-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className={`h-2 w-2 rounded-full ${i === activeIdx ? 'bg-accent' : 'bg-white/30'}`}
                  aria-label={`Image ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-white hover:bg-black/90"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

function ReferenceImagesSection({ result, sectionRef }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [lightboxCase, setLightboxCase] = useState(null)
  const module = result?.module || 'breast'
  const cases = REFERENCE_CASES[module] || REFERENCE_CASES.breast
  const matchResult = resolveNearestMatch(result)
  const nearestMatchId = matchResult.nearestMatchId
  const matchPct = matchResult.matchPct

  return (
    <div ref={sectionRef} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            4
          </span>
          <h2 className="text-sm font-bold text-primary">Reference Images from Dataset</h2>
          <span className="text-xs text-primary/40">(Verified Pathology Atlas)</span>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          View More Cases <ArrowUpRight size={14} />
        </button>
      </div>

      <p className="mt-1 text-xs text-primary/60">
        Representative clinical atlas cases matched to image analysis findings and visual morphology.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cases.map((c) => {
          const isMatch = c.id === nearestMatchId
          const color = severityColor(c.severity)
          return (
            <div
              key={c.id}
              className={`flex flex-col overflow-hidden rounded-xl bg-background transition-shadow hover:shadow-md ${
                isMatch ? 'border-2 border-success ring-2 ring-success/20' : 'border border-border'
              }`}
            >
              <div className="relative">
                <ReferenceCardThumbnail caseData={c} color={color} onOpenLightbox={() => setLightboxCase(c)} />
                {isMatch && (
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-success px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    <CheckCircle2 size={10} /> Nearest Match
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-3">
                <p className={`text-xs font-bold ${isMatch ? 'text-success' : 'text-primary'}`}>{c.caseTypeLabel}</p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>
                  {c.classification}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-primary/70 line-clamp-2">
                  {c.description}
                </p>
                {isMatch && (
                  <p className="mt-2 text-[11px] font-semibold text-success">{matchPct}% Match</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {modalOpen && (
        <ReferenceImagesModal
          module={module}
          onClose={() => setModalOpen(false)}
        />
      )}

      {lightboxCase && (
        <ReferenceLightbox caseData={lightboxCase} onClose={() => setLightboxCase(null)} />
      )}
    </div>
  )
}

export default ReferenceImagesSection
