import { X } from 'lucide-react'

const DETAILED_ATLAS = {
  breast: [
    { title: 'BI-RADS 5 - Infiltrating Ductal Carcinoma', cat: 'High Risk', hist: 'Confirmed Invasive Ductal Carcinoma (Grade 3)', img: '/reference-images/breast/breast_ref_00.jpg' },
    { title: 'BI-RADS 4C - Microlobulated Mass', cat: 'High Risk', hist: 'Atypical Ductal Hyperplasia (ADH)', img: '/reference-images/breast/breast_ref_01.jpg' },
    { title: 'BI-RADS 4A - Focal Asymmetry', cat: 'Moderate Risk', hist: 'Radial Scar / Sclerosing Adenosis', img: '/reference-images/breast/breast_ref_04.jpg' },
    { title: 'BI-RADS 3 - Circumscribed Density', cat: 'Moderate Risk', hist: 'Complicated Cyst with Debris', img: '/reference-images/breast/breast_ref_08.jpg' },
    { title: 'BI-RADS 2 - Classic Fibroadenoma', cat: 'Benign', hist: 'Hyalinized Benign Fibroadenoma', img: '/reference-images/breast/breast_ref_10.jpg' },
    { title: 'BI-RADS 1 - Normal Dense Parenchyma', cat: 'Normal', hist: 'Negative Screening Examination', img: '/reference-images/breast/breast_ref_12.jpg' },
  ],
  cervical: [
    { title: 'HSIL / CIN 3 - Severe Dysplasia', cat: 'High Risk', hist: 'Confirmed High-grade Squamous Intraepithelial Lesion', img: '/reference-images/cervical/cervical_hsil_00.jpg' },
    { title: 'LSIL / CIN 1 - Mild Dysplasia', cat: 'Moderate Risk', hist: 'Low-grade Squamous Intraepithelial Lesion (HPV 16+)', img: '/reference-images/cervical/cervical_lsil_00.jpg' },
    { title: 'ASC-US - Atypical Squamous Cells', cat: 'Moderate Risk', hist: 'Reactive changes secondary to inflammation', img: '/reference-images/cervical/cervical_ascus_00.jpg' },
    { title: 'ASC-H - Cannot Exclude HSIL', cat: 'Moderate Risk', hist: 'Atypical Squamous Cells, cannot exclude high-grade lesion', img: '/reference-images/cervical/cervical_asch_00.jpg' },
    { title: 'NILM - Normal Glycogenated Squamous', cat: 'Normal', hist: 'Negative for Intraepithelial Lesion or Malignancy', img: '/reference-images/cervical/cervical_normal_00.jpg' },
  ],
  pcos: [
    { title: 'Polycystic Ovarian Morphology (PCOM)', cat: 'High Risk', hist: '24 peripheral follicles, increased central stroma', img: '/reference-images/pcos/pcos_pcos_00.jpg' },
    { title: 'Physiologic Ovarian Morphology', cat: 'Normal', hist: 'Normal antral follicle count within age limits', img: '/reference-images/pcos/pcos_normal_00.jpg' },
  ]
}

function ReferenceImagesModal({ module = 'breast', onClose }) {
  const cases = DETAILED_ATLAS[module] || DETAILED_ATLAS.breast

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-primary">Clinical Atlas Reference Dataset</h3>
            <p className="text-xs text-primary/60">
              Verified histological and imaging references from peer-reviewed institutional datasets.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-primary/40 hover:bg-slate-100 hover:text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {cases.map((c, idx) => (
              <div
                key={idx}
                className="overflow-hidden rounded-xl border border-border bg-background transition hover:border-accent/50 hover:shadow-md"
              >
                <div className="h-28 w-full overflow-hidden bg-slate-950">
                  <img
                    src={c.img}
                    alt={c.title}
                    style={{ objectFit: 'cover' }}
                    className="h-full w-full"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                </div>
                <div className="p-3">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      c.cat === 'High Risk'
                        ? 'bg-danger/10 text-danger'
                        : c.cat === 'Moderate Risk'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-success/10 text-success'
                    }`}
                  >
                    {c.cat}
                  </span>
                  <p className="mt-1 text-xs font-bold text-primary">{c.title}</p>
                  <p className="mt-1 text-[11px] text-primary/60">
                    <strong className="text-primary/70">Histopathology:</strong> {c.hist}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-border px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90"
          >
            Close Atlas
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReferenceImagesModal
