import { useRef, useState } from 'react'
import {
  CheckCircle2,
  Maximize,
  Plus,
  RotateCw,
  Sun,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import AbstractMedicalIllustration from '../../common/AbstractMedicalIllustration'

const MAX_FILE_SIZE_MB = 50

const TABS = ['Upload Image', 'View Sample Images', 'Image Guidelines']

const SAMPLE_IMAGES_BY_MODULE = {
  breast: [
    { src: '/reference-images/breast/breast_ref_00.jpg', label: 'High Risk — BI-RADS 5' },
    { src: '/reference-images/breast/breast_ref_02.jpg', label: 'High Risk — BI-RADS 5' },
    { src: '/reference-images/breast/breast_ref_04.jpg', label: 'Moderate — BI-RADS 4' },
    { src: '/reference-images/breast/breast_ref_06.jpg', label: 'Moderate — BI-RADS 4' },
    { src: '/reference-images/breast/breast_ref_08.jpg', label: 'Benign — BI-RADS 3' },
    { src: '/reference-images/breast/breast_ref_12.jpg', label: 'Normal — BI-RADS 1' },
  ],
  cervical: [
    { src: '/reference-images/cervical/cervical_hsil_00.jpg', label: 'HSIL — Dyskeratotic' },
    { src: '/reference-images/cervical/cervical_hsil_02.jpg', label: 'HSIL — Dyskeratotic' },
    { src: '/reference-images/cervical/cervical_lsil_00.jpg', label: 'LSIL — Koilocytotic' },
    { src: '/reference-images/cervical/cervical_ascus_00.jpg', label: 'ASC-US — Metaplastic' },
    { src: '/reference-images/cervical/cervical_asch_00.jpg', label: 'ASC-H — Parabasal' },
    { src: '/reference-images/cervical/cervical_normal_00.jpg', label: 'NILM — Normal' },
  ],
  pcos: [
    { src: '/reference-images/pcos/pcos_pcos_00.jpg', label: 'PCOS — String of pearls' },
    { src: '/reference-images/pcos/pcos_pcos_02.jpg', label: 'PCOS — Multiple follicles' },
    { src: '/reference-images/pcos/pcos_pcos_04.jpg', label: 'PCOS — Enlarged ovary' },
    { src: '/reference-images/pcos/pcos_normal_00.jpg', label: 'Normal — 1-3 follicles' },
    { src: '/reference-images/pcos/pcos_normal_02.jpg', label: 'Normal — Homogeneous stroma' },
    { src: '/reference-images/pcos/pcos_normal_04.jpg', label: 'Normal ovarian morphology' },
  ],
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ImageUploadPanel({ moduleConfig, images, onImagesChange }) {
  const [tab, setTab] = useState('Upload Image')
  const [activeIndex, setActiveIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState('')
  const [sampleModalImg, setSampleModalImg] = useState(null)
  const inputRef = useRef(null)
  const addViewInputRef = useRef(null)

  const active = images[activeIndex]

  function handleFiles(fileList) {
    const file = fileList[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFileError(`File exceeds the ${MAX_FILE_SIZE_MB}MB limit.`)
      return
    }
    setFileError('')
    const entry = { file, url: URL.createObjectURL(file), name: file.name, size: file.size, view: null }
    onImagesChange([...images, entry])
    setActiveIndex(images.length)
    setZoom(1)
    setRotation(0)
    setBrightness(100)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  function removeImage(index) {
    const next = images.filter((_, i) => i !== index)
    onImagesChange(next)
    setActiveIndex(0)
  }

  function setViewLabel(index, view) {
    const next = images.map((img, i) => (i === index ? { ...img, view } : img))
    onImagesChange(next)
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-semibold ${
              tab === t ? 'border-b-2 border-accent text-accent' : 'text-primary/50 hover:text-primary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Upload Image' && (
        <div className="mt-4">
          {images.length === 0 ? (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 text-center ${
                dragOver ? 'border-accent bg-accent/5' : 'border-border'
              }`}
            >
              <Upload size={28} className="text-accent" />
              <p className="mt-3 text-sm font-medium text-primary">Drag and drop image here, or click to browse</p>
              <p className="mt-1 text-xs text-primary/50">Supported formats: {moduleConfig.acceptedFormats}</p>
              <p className="text-xs text-primary/50">Max file size: {MAX_FILE_SIZE_MB}MB</p>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          ) : (
            <div>
              <div className="relative overflow-hidden rounded-lg border border-border bg-background">
                <div className="flex h-64 items-center justify-center overflow-hidden">
                  <img
                    src={active.url}
                    alt="Uploaded scan preview"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      filter: `brightness(${brightness}%)`,
                    }}
                    className="max-h-full max-w-full transition-transform"
                  />
                </div>
                <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => removeImage(activeIndex)}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-danger"
                  aria-label="Remove image"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="mt-2 flex items-center justify-center gap-1">
                <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="rounded-md border border-border p-1.5 text-primary/60 hover:border-accent hover:text-accent" aria-label="Zoom in">
                  <ZoomIn size={14} />
                </button>
                <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="rounded-md border border-border p-1.5 text-primary/60 hover:border-accent hover:text-accent" aria-label="Zoom out">
                  <ZoomOut size={14} />
                </button>
                <button type="button" onClick={() => setZoom(1)} className="rounded-md border border-border p-1.5 text-primary/60 hover:border-accent hover:text-accent" aria-label="Fit to screen">
                  <Maximize size={14} />
                </button>
                <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)} className="rounded-md border border-border p-1.5 text-primary/60 hover:border-accent hover:text-accent" aria-label="Rotate">
                  <RotateCw size={14} />
                </button>
                <span className="mx-1 h-4 w-px bg-border" />
                <Sun size={14} className="text-primary/40" />
                <input
                  type="range"
                  min={50}
                  max={150}
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-20"
                  aria-label="Brightness"
                />
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-md bg-success/5 px-3 py-2 text-xs text-success">
                <CheckCircle2 size={14} />
                <span className="truncate text-primary">{active.name}</span>
                <span className="text-primary/40">({formatSize(active.size)})</span>
                <span className="ml-auto font-medium text-success">Uploaded</span>
              </div>

              {moduleConfig.multiView && (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-2">
                    {images.map((img, i) => (
                      <button
                        key={img.url}
                        type="button"
                        onClick={() => setActiveIndex(i)}
                        className={`relative h-14 w-14 overflow-hidden rounded-md border-2 ${
                          i === activeIndex ? 'border-accent' : 'border-border'
                        }`}
                      >
                        <img src={img.url} alt={img.view || 'view'} className="h-full w-full object-cover" />
                        {img.view && (
                          <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[8px] text-white">
                            {img.view}
                          </span>
                        )}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => addViewInputRef.current?.click()}
                      className="flex h-14 w-14 flex-col items-center justify-center rounded-md border-2 border-dashed border-border text-primary/40 hover:border-accent hover:text-accent"
                    >
                      <Plus size={16} />
                      <span className="text-[9px]">Add view</span>
                    </button>
                    <input
                      ref={addViewInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                  </div>
                  {active && moduleConfig.viewOptions && (
                    <select
                      value={active.view || ''}
                      onChange={(e) => setViewLabel(activeIndex, e.target.value)}
                      className="mt-2 rounded-md border border-border px-2 py-1 text-xs text-primary outline-none focus:ring-2 focus:ring-accent/40"
                    >
                      <option value="">Label this view…</option>
                      {moduleConfig.viewOptions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}
          {fileError && <p className="mt-2 text-xs text-danger">{fileError}</p>}
        </div>
      )}

      {tab === 'View Sample Images' && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600 font-medium flex items-center justify-between">
            <span>Representative cases from clinical training dataset</span>
            <span className="text-[11px] text-slate-400">Click to expand</span>
          </div>

          <div className="max-h-[460px] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 justify-items-center">
              {(
                SAMPLE_IMAGES_BY_MODULE[(moduleConfig?.key || 'breast').toLowerCase()] ||
                SAMPLE_IMAGES_BY_MODULE.breast
              ).map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setSampleModalImg(item)}
                  className="group flex flex-col items-center cursor-pointer rounded-xl border border-border bg-surface p-2 shadow-xs transition hover:border-accent/60 hover:shadow-md"
                  style={{ width: '166px' }}
                >
                  <div
                    className="overflow-hidden rounded-lg bg-slate-900 flex items-center justify-center relative"
                    style={{ width: '150px', height: '150px' }}
                  >
                    <img
                      src={item.src}
                      alt={item.label}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                      style={{ width: '150px', height: '150px', objectFit: 'cover' }}
                    />
                    <div className="absolute inset-0 bg-black/25 opacity-0 transition group-hover:opacity-100 flex items-center justify-center">
                      <span className="flex items-center gap-1 rounded-md bg-black/75 px-2 py-1 text-[11px] font-semibold text-white">
                        <Maximize size={12} /> Expand
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-center text-primary/80 line-clamp-2 leading-tight">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'Image Guidelines' && (
        <ul className="mt-4 space-y-2 text-sm text-primary/70">
          <li>• Ensure the image is in focus with no motion blur.</li>
          <li>• Use consistent lighting and avoid shadows across the region of interest.</li>
          <li>• Crop to the relevant anatomical area where possible.</li>
          <li>• Supported formats for this module: {moduleConfig.acceptedFormats}.</li>
          <li>• Maximum file size is {MAX_FILE_SIZE_MB}MB per image.</li>
          {moduleConfig.multiView && <li>• Upload all available standard views for a more complete assessment.</li>}
        </ul>
      )}

      {/* Lightbox Modal for Sample Images */}
      {sampleModalImg && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSampleModalImg(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 px-2 text-white">
              <div>
                <h4 className="text-sm font-bold">{sampleModalImg.label}</h4>
                <p className="text-[11px] text-slate-400">Clinical reference standard dataset</p>
              </div>
              <button
                type="button"
                onClick={() => setSampleModalImg(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center justify-center p-4">
              <img
                src={sampleModalImg.src}
                alt={sampleModalImg.label}
                className="max-h-[70vh] w-auto rounded-lg object-contain shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageUploadPanel
