import { useRef, useState } from 'react'
export default function ImageUploadPanel({ images, onImagesChange }) {
 const ref = useRef(null), [error, setError] = useState('')
 function choose(files) {
  const file = files?.[0]; if (!file) return
  if (!/\.(jpe?g|png)$/i.test(file.name) || file.size > 50 * 1024 * 1024) { setError('Choose one JPEG or PNG image, up to 50 MB.'); return }
  images.forEach(i => URL.revokeObjectURL(i.url)); onImagesChange([{ file, url: URL.createObjectURL(file), name: file.name, size: file.size }]); setError('')
 }
 return <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Select one image for research analysis</h2><p className="mt-2 text-sm text-slate-600">JPEG or PNG only, up to 50 MB. DICOM and multiple-image analysis are not supported. The output requires clinician review.</p><input ref={ref} aria-label="Research image" className="mt-4 block w-full text-sm" type="file" accept="image/jpeg,image/png" onChange={e => choose(e.target.files)} />{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{images[0] && <div className="mt-4"><img className="max-h-80 max-w-full rounded-lg" src={images[0].url} alt="Selected image preview" /><p className="mt-2 break-all text-xs">{images[0].name}</p><button type="button" className="mt-3 text-sm font-semibold text-red-700" onClick={() => { URL.revokeObjectURL(images[0].url); onImagesChange([]); ref.current.value = '' }}>Remove image</button></div>}</section>
}
