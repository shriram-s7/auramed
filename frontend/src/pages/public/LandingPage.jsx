import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileBadge,
  GitMerge,
  Layers,
  Lock,
  Menu,
  Microscope,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Upload,
  UserCheck,
  X,
} from 'lucide-react'

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Screening Modules', href: '#technology' },
  { label: 'Clinical Novelties', href: '#novelties' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Benchmark Datasets', href: '#evidence' },
]

const MODULES = [
  {
    key: 'breast',
    title: 'Breast Cancer Screening',
    accent: 'pink',
    icon: ScanLine,
    points: [
      'ResNet-50 mammography classification fused with clinical risk factors',
      'Modified Gail Model risk stratification for physician review',
      'Grad-CAM visual saliency identifying micro-calcifications and focal densities',
    ],
  },
  {
    key: 'cervical',
    title: 'Cervical Cancer Screening',
    accent: 'purple',
    icon: Microscope,
    points: [
      'Vision Transformer (ViT) cytology image classification support',
      'Bethesda 2014 and ASCCP consensus guidelines integration',
      'High-grade lesion triage with colposcopy and HPV correlation',
    ],
  },
  {
    key: 'pcos',
    title: 'PCOS Screening',
    accent: 'teal',
    icon: Activity,
    points: [
      'Pelvic ultrasound follicle pattern and stromal echogenicity review',
      'Rotterdam 2003 consensus criteria questionnaire scoring',
      'Endocrine marker correlation and metabolic risk categorization',
    ],
  },
]

const MODULE_ACCENT_CLASSES = {
  pink: {
    border: 'border-pink-200',
    iconBg: 'bg-pink-50',
    icon: 'text-pink-600',
    bullet: 'text-pink-600',
  },
  purple: {
    border: 'border-purple-200',
    iconBg: 'bg-purple-50',
    icon: 'text-purple-600',
    bullet: 'text-purple-600',
  },
  teal: {
    border: 'border-teal-200',
    iconBg: 'bg-teal-50',
    icon: 'text-accent',
    bullet: 'text-accent',
  },
}

const NOVELTIES = [
  {
    icon: Eye,
    title: 'Explainable AI with Grad-CAM Attention Heatmaps',
    description:
      'Unlike black-box algorithms, AuraMed computes pixel-level Grad-CAM heatmaps allowing clinicians to visually inspect the exact anatomical regions and suspicious patterns driving classification.',
    badge: 'Explainable AI',
  },
  {
    icon: GitMerge,
    title: 'Hybrid Fusion: Deep Vision + Validated Clinical Guidelines',
    description:
      'Imaging models never operate in a vacuum. Deep vision predictions are mathematically fused with patient history, physical examination findings, Gail Model risk indices, and Rotterdam consensus criteria.',
    badge: 'Clinical Governance',
  },
  {
    icon: FileBadge,
    title: 'Digitally Signed & Cryptographically Verified Reports',
    description:
      'Every issued report is sealed with a unique SHA-256 digital signature, locking findings against unauthorized alterations while supporting timestamped addendums for legal and medical auditability.',
    badge: 'Tamper-Evident',
  },
  {
    icon: UserCheck,
    title: 'Dual Synchronized Doctor & Patient Portals',
    description:
      'Physicians work in a comprehensive PACS-grade diagnostic environment, while patients receive compassionate plain-language translations along with instant download access to their complete signed clinical report.',
    badge: 'Patient-Centric',
  },
]

const HOW_IT_WORKS = [
  { label: 'Input', icon: Upload, desc: 'Diagnostic imaging and patient clinical factors are securely ingested' },
  { label: 'Deep Learning', icon: BrainCircuit, desc: 'Neural vision and clinical formulas independently analyze the case' },
  { label: 'Physician Review', icon: Stethoscope, desc: 'The treating clinician reviews image findings and Grad-CAM overlays' },
  { label: 'Hybrid Fusion', icon: GitMerge, desc: 'Model features and clinician inputs are synthesized into an integrated risk score' },
  { label: 'Verified Report', icon: ClipboardCheck, desc: 'A tamper-evident signed report is generated and instantly accessible' },
]

const ACCURACY_CARDS = [
  {
    title: 'Breast Cancer',
    dataset: 'CBIS-DDSM & INbreast',
    model: 'ResNet-50 Binary Classifier',
    metricLabel: 'Benchmark AUC',
    metricValue: '0.91',
  },
  {
    title: 'Cervical Cancer',
    dataset: 'SIPaKMeD Cytology Benchmark',
    model: 'ViT-Base-Patch16-224',
    metricLabel: 'Benchmark Accuracy',
    metricValue: '98.3%',
  },
  {
    title: 'PCOS Screening',
    dataset: 'Ultrasound Ovary Dataset',
    model: 'ResNet-50 with Dropout Regularization',
    metricLabel: 'Benchmark Accuracy',
    metricValue: '96.8%',
  },
]

function GeometricBlob({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="100" cy="100" r="90" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="60" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="30" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
    </svg>
  )
}

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [methodologyOpen, setMethodologyOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-primary">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white font-bold">
              A
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-sm font-bold tracking-tight text-primary leading-tight">AuraMed</span>
              <span className="text-[11px] font-medium text-primary/60 leading-normal mt-0.5">
                Earlier answers. Healthier tomorrows.
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-primary/70 hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2.5 md:flex">
            <Link
              to="/register"
              className="rounded-lg border border-border px-3.5 py-1.5 text-sm font-semibold text-primary hover:border-teal-600 hover:text-teal-600 transition-colors"
            >
              Patient Registration
            </Link>
            <Link
              to="/login"
              className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 shadow-xs transition-colors"
            >
              Sign In
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-border bg-surface px-4 pb-4 md:hidden">
            <nav className="flex flex-col gap-3 pt-3">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-primary/70"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2">
              <Link to="/login" className="rounded-lg bg-teal-600 px-3 py-2 text-center text-sm font-semibold text-white">
                Sign In to Portal
              </Link>
              <Link to="/register" className="rounded-lg border border-border px-3 py-2 text-center text-sm font-semibold text-primary">
                Patient Registration
              </Link>
            </div>
          </div>
        )}
      </header>


      {/* Hero */}
      <section
        id="home"
        className="relative overflow-hidden bg-gradient-to-br from-primary via-[#0F2137] to-[#0A1628] text-white"
      >
        <GeometricBlob className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 text-white" />
        <GeometricBlob className="pointer-events-none absolute -bottom-24 -left-16 h-96 w-96 text-accent" />

        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center md:px-8 md:py-28">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3.5 py-1 text-xs font-medium text-white/90">
            <ShieldCheck size={14} className="text-accent" />
            Multimodal AI Clinical Decision Support Platform
          </p>
          <h1 className="mt-6 text-4xl font-bold leading-tight md:text-6xl">
            Earlier Answers.
            <br />
            Healthier Tomorrows.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/80 md:text-lg leading-relaxed">
            AuraMed combines deep learning vision architectures with validated medical formulas across
            breast cancer, cervical cancer, and PCOS screening &mdash; engineered for explainability,
            clinician autonomy, and transparent patient communication.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-teal-400 transition-colors shadow-lg shadow-teal-500/20"
            >
              Sign In to Portal <ArrowRight size={16} />
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-sm font-bold text-white hover:bg-white/10 transition-colors"
            >
              Patient Registration
            </Link>
          </div>


          {/* Architectural Pillars (Replaces fake adoption stats) */}
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-4 border-t border-white/10 pt-10 md:grid-cols-4 text-left">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <span className="text-accent text-xl font-bold">3 Modules</span>
              <p className="mt-1 text-xs text-white/70">Breast, Cervical & PCOS multi-disease triage</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <span className="text-accent text-xl font-bold">Hybrid AI</span>
              <p className="mt-1 text-xs text-white/70">Deep vision fused with Gail Model & Rotterdam criteria</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <span className="text-accent text-xl font-bold">Grad-CAM</span>
              <p className="mt-1 text-xs text-white/70">Explainable visual attention saliency heatmaps</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <span className="text-accent text-xl font-bold">Verifiable</span>
              <p className="mt-1 text-xs text-white/70">Cryptographic SHA-256 digital signatures & audit logs</p>
            </div>
          </div>
        </div>
      </section>

      {/* Module cards */}
      <section id="technology" className="mx-auto max-w-7xl px-4 py-20 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-primary md:text-3xl">Three Screening Modules, One Unified Platform</h2>
          <p className="mt-3 text-sm text-primary/60 md:text-base">
            Each clinical module pairs a deep neural network with a validated medical consensus formula,
            ensuring the clinician evaluates both algorithmic intelligence and established clinical guidelines.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {MODULES.map((mod) => {
            const accent = MODULE_ACCENT_CLASSES[mod.accent]
            const Icon = mod.icon
            return (
              <div
                key={mod.key}
                className={`rounded-xl border ${accent.border} bg-surface p-6 shadow-sm transition hover:shadow-md`}
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${accent.iconBg}`}>
                  <Icon size={22} className={accent.icon} />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-primary">{mod.title}</h3>
                <ul className="mt-3 space-y-2">
                  {mod.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm text-primary/70">
                      <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${accent.bullet}`} />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      {/* Platform Novelties Section */}
      <section id="novelties" className="border-t border-border bg-slate-50/50 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              <Sparkles size={14} /> Core Innovations
            </span>
            <h2 className="mt-4 text-2xl font-bold text-primary md:text-3xl">
              Platform Features & Technical Novelties
            </h2>
            <p className="mt-3 text-sm text-primary/60 md:text-base">
              AuraMed moves beyond black-box predictions by delivering full explainability, clinician-in-the-loop control,
              and patient-empowering reporting.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {NOVELTIES.map((novelty) => {
              const Icon = novelty.icon
              return (
                <div
                  key={novelty.title}
                  className="rounded-2xl border border-border bg-white p-7 shadow-xs hover:border-accent/40 hover:shadow-sm transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <Icon size={24} />
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                      {novelty.badge}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-primary">{novelty.title}</h3>
                  <p className="mt-2 text-sm text-primary/70 leading-relaxed">{novelty.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-surface py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-primary md:text-3xl">How AuraMed Works</h2>
            <p className="mt-3 text-sm text-primary/60">
              A structured 5-step clinical decision support pipeline designed for diagnostic safety.
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-5">
            {HOW_IT_WORKS.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={step.label} className="relative flex flex-col items-center text-center">
                  {index < HOW_IT_WORKS.length - 1 && (
                    <div className="absolute right-[-16px] top-7 hidden h-px w-8 bg-border md:block" />
                  )}
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background shadow-2xs">
                    <Icon size={24} className="text-accent" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-primary">{step.label}</p>
                  <p className="mt-1 text-xs text-primary/60">{step.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Benchmark Evidence */}
      <section id="evidence" className="mx-auto max-w-7xl px-4 py-20 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-primary md:text-3xl">Benchmark Datasets & Validation</h2>
          <p className="mt-3 text-sm text-primary/60 md:text-base">
            Every module is evaluated against peer-reviewed public reference datasets to establish consistent baseline performance.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {ACCURACY_CARDS.map((card) => (
            <div key={card.title} className="rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-primary">{card.title}</p>
              <p className="mt-1 text-xs text-primary/50 font-mono">{card.dataset}</p>
              <p className="mt-1 text-[11px] text-accent font-medium">{card.model}</p>
              <p className="mt-4 text-3xl font-bold text-accent">{card.metricValue}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-primary/50">{card.metricLabel}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-primary/40">
          Figures reflect published benchmark performance on reference public research cohorts. AuraMed is designed to
          assist licensed physicians and does not replace certified professional clinical judgement.
        </p>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setMethodologyOpen(true)}
            className="rounded-md border border-primary px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-white transition"
          >
            View Datasets and Model Architecture Details
          </button>
        </div>
      </section>

      {/* Exploration Footer */}
      <footer className="bg-primary text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center md:px-8">
          <h2 className="text-2xl font-bold md:text-3xl">Explore the AuraMed Clinical Platform</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/70">
            Access the dedicated workspaces designed for healthcare providers, patients, and platform administrators.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/login/doctor"
              className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 transition"
            >
              Doctor Portal <ArrowRight size={16} />
            </Link>
            <Link
              to="/login/patient"
              className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition"
            >
              Patient Portal
            </Link>
            <Link
              to="/login/admin"
              className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition"
            >
              Admin Governance
            </Link>
          </div>

          <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-white/50 md:flex-row">
            <p>&copy; {new Date().getFullYear()} AuraMed Platform. All rights reserved. Indian DPDP Act 2023 Compliant.</p>
            <div className="flex gap-4">
              <a href="#home" className="hover:text-white">Clinical Governance</a>
              <a href="#home" className="hover:text-white">Security & Audit</a>
              <a href="#home" className="hover:text-white">Privacy Standards</a>
            </div>
          </div>
        </div>
      </footer>

      {methodologyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setMethodologyOpen(false)}
        >
          <div
            className="max-w-lg rounded-2xl bg-surface p-6 shadow-xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-primary">Model Architecture & Datasets</h3>
            <div className="mt-3 space-y-3 text-xs text-primary/70 leading-relaxed">
              <p>
                <strong>Breast Cancer Module:</strong> Uses a fine-tuned ResNet-50 backbone trained on CBIS-DDSM and INbreast mammography datasets, coupled with a Modified Gail Model clinical calculator.
              </p>
              <p>
                <strong>Cervical Cancer Module:</strong> Utilizes a Vision Transformer (ViT-Base-Patch16-224) trained on the SIPaKMeD cytology dataset, aligned with Bethesda 2014 triage guidelines.
              </p>
              <p>
                <strong>PCOS Module:</strong> Employs a custom convolutional model with dropout regularization for ultrasound pattern recognition, fused with Rotterdam 2003 diagnostic consensus criteria.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMethodologyOpen(false)}
              className="mt-6 w-full rounded-md bg-primary py-2 text-sm font-semibold text-white hover:bg-primary/90 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LandingPage
