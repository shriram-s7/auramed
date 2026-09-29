import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  FileText,
  Download,
  Share2,
  Printer,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  User,
  Building2,
  Calendar,
  Info,
  PhoneCall,
  HelpCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react'
import PatientLayout from '../../components/patient/PatientLayout'
import { getModuleSvgIcon } from '../../components/patient/ModuleIcons'
import { fetchPatientReportDetail, downloadPatientReportPdf } from '../../services/patientPortalService'
import { triggerPdfDownload } from '../../utils/downloadPdf'

export default function PatientReportDetail() {
  const params = useParams()
  const reportId = params.reportId || params.id
  const [loading, setLoading] = useState(true)

  const [report, setReport] = useState(null)
  const [activeTab, setActiveTab] = useState('summary') // 'summary' | 'findings' | 'recommendations' | 'next_steps'
  const [toastMessage, setToastMessage] = useState(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const showToast = msg => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  useEffect(() => {
    setLoading(true)
    fetchPatientReportDetail(reportId || 'rep-demo-01')
      .then(res => setReport(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [reportId])

  if (loading || !report) {
    return (
      <PatientLayout>
        <div className="py-24 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-semibold">Preparing your patient-friendly health summary...</p>
        </div>
      </PatientLayout>
    )
  }

  const { header, summary_tab, findings_tab, recommendations_tab, next_steps_tab, previous_reports } = report

  const isPcosReport =
    header?.module === 'pcos' ||
    report?.module === 'pcos' ||
    header?.report_type?.toLowerCase().includes('pcos') ||
    Boolean(summary_tab?.diagnostic_criteria_assessment)

  const dca = summary_tab?.diagnostic_criteria_assessment
  const criteriaItems = dca?.items || [
    {
      name: 'Irregular periods',
      status: report?.criterion_oligo_anovulation ? 'Detected' : 'Not detected',
      detected: Boolean(report?.criterion_oligo_anovulation),
    },
    {
      name: 'Hormone markers',
      status: report?.criterion_hyperandrogenism ? 'Elevated' : 'Normal',
      detected: Boolean(report?.criterion_hyperandrogenism),
    },
    {
      name: 'Ovarian appearance',
      status: report?.criterion_polycystic_ovaries ? 'Consistent with PCOS' : 'Normal',
      detected: Boolean(report?.criterion_polycystic_ovaries),
    },
  ]
  const dcaPositive = dca?.is_positive ?? (report?.rotterdam_positive || false)
  const dcaSummary =
    dca?.summary ||
    (dcaPositive
      ? 'Based on your scan and clinical history, 2 or more PCOS diagnostic criteria were identified. Your doctor will discuss next steps with you.'
      : 'Your results did not meet the threshold for a PCOS diagnosis based on current findings.')

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = async () => {
    setDownloadingPdf(true)
    showToast('Generating official diagnostic report PDF...')
    try {
      const res = await downloadPatientReportPdf(reportId || 'rep-demo-01')
      const patientName = (header?.patient_name || 'Patient').replace(/\s+/g, '_')
      const mod = (header?.module || 'Report').toUpperCase()
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const filename = `AuraMed_${patientName}_${mod}_${dateStr}.pdf`
      triggerPdfDownload(res.data, filename)
      showToast('Official clinical report PDF downloaded.')
    } catch (err) {
      console.error('Failed to download PDF:', err)
      showToast('Failed to generate PDF. Please try again.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: header.report_type,
        text: `AuraMed Health Report - ${header.result_badge}`,
        url: window.location.href
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(window.location.href)
      showToast('Secure report link copied to clipboard!')
    }
  }

  return (
    <PatientLayout>
      <div className="space-y-6 max-w-6xl mx-auto print:p-0">
        {/* Toast */}
        {toastMessage && (
          <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-lg border bg-emerald-50 text-emerald-800 border-emerald-200 text-sm font-medium flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Back Link */}
        <Link
          to="/patient/reports"
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-teal-600 hover:text-teal-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to all reports</span>
        </Link>

        {/* REPORT HEADER:
            Module icon, report type, date, result badge (large)
            Patient name, Patient ID, Reporting Doctor, Hospital, Report ID
        */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
              {getModuleSvgIcon(header.module, "w-8 h-8")}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-600 font-mono">
                  {header.report_id}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-mono">{header.date}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {header.report_type}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
                <span>Patient: <strong className="text-slate-800">{header.patient_name}</strong> ({header.patient_code})</span>
                <span>•</span>
                <span>Reporting Doctor: <strong className="text-slate-800">{header.doctor_name}</strong></span>
                <span>•</span>
                <span>{header.hospital}</span>
              </div>
            </div>
          </div>

          {/* Large Result Badge */}
          <div className="self-start md:self-center flex flex-col items-start md:items-end">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Overall Finding
            </span>
            <div className={`px-4 py-1.5 rounded-full text-sm font-black border ${
              header.result_color === 'red' || header.result_badge === 'Needs Follow-up'
                ? 'bg-rose-100 text-rose-800 border-rose-200 ring-4 ring-rose-50'
                : header.result_color === 'amber'
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
            }`}>
              {header.result_badge}
            </div>
          </div>
        </div>

        {/* MAIN TWO-COLUMN CONTENT: Tabs Content (Left) + Actions/Support Sidebar (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Tab bar + Tab Content + Previous Reports */}
          <div className="lg:col-span-8 space-y-6">
            {/* TAB BAR: Summary, Findings, Recommendations, Next Steps */}
            <div className="flex items-center space-x-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto">
              {[
                { key: 'summary', label: 'Summary' },
                { key: 'findings', label: 'Findings' },
                { key: 'recommendations', label: 'Recommendations' },
                { key: 'next_steps', label: 'Next Steps & FAQ' }
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    activeTab === t.key
                      ? 'bg-white text-teal-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB CONTENT CARDS */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
              {/* TAB 1: SUMMARY */}
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  {/* Result Highlight Box (Color coded) */}
                  <div className={`p-4 sm:p-5 rounded-2xl border flex items-start space-x-3.5 ${
                    summary_tab.highlight_box.headline.includes('suspicious')
                      ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  }`}>
                    <div className={`p-2 rounded-xl flex-shrink-0 ${
                      summary_tab.highlight_box.headline.includes('suspicious') ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm sm:text-base">
                        {summary_tab.highlight_box.headline}
                      </h4>
                      <p className="text-xs sm:text-sm leading-relaxed mt-1 opacity-90">
                        {summary_tab.highlight_box.message}
                      </p>
                    </div>
                  </div>

                  {/* Plain English Paragraph explaining results (No jargon, no model scores) */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2">Overview of Your Results</h3>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      {summary_tab.plain_paragraph}
                    </p>
                  </div>

                  {/* Key Findings Section */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2">Key Findings in Plain Language</h3>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                      {summary_tab.key_findings.map((kf, i) => (
                        <li key={i} className="flex items-start space-x-2.5">
                          <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                          <span>{kf}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* PCOS Diagnostic Criteria Assessment (Plain Language Only) */}
                  {isPcosReport && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {dca?.heading || 'Diagnostic Criteria Assessment'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Standard medical guidelines assess three key areas to understand your reproductive health:
                        </p>
                      </div>

                      <div className="space-y-2.5">
                        {criteriaItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded-xl bg-white px-4 py-3 border border-slate-200/80 text-xs sm:text-sm"
                          >
                            <span className="font-semibold text-slate-800">{item.name}</span>
                            <span
                              className={`font-bold px-2.5 py-1 rounded-lg text-xs ${
                                item.detected
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-teal-50/60 p-3.5 rounded-xl border border-teal-100">
                        {dcaSummary}
                      </p>
                    </div>
                  )}

                  {/* What this means section */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2">What This Means For You</h3>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-teal-50/30 p-4 rounded-2xl border border-teal-100">
                      {summary_tab.what_this_means}
                    </p>
                  </div>

                  {/* Important Note Disclaimer */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start space-x-2.5 text-xs text-slate-600">
                    <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    <p className="leading-snug">{summary_tab.disclaimer}</p>
                  </div>
                </div>
              )}

              {/* TAB 2: FINDINGS */}
              {activeTab === 'findings' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Detailed Observations</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{findings_tab.description}</p>
                  </div>

                  <div className="space-y-3">
                    {findings_tab.sections.map((sec, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{sec.title}</h4>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{sec.details}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-teal-50/50 rounded-2xl border border-teal-100 text-[11px] text-teal-800 leading-relaxed">
                    Note: Clinical anatomical findings are provided for your knowledge and personal records. Your doctor is available to review them with you at any time.
                  </div>
                </div>
              )}

              {/* TAB 3: RECOMMENDATIONS */}
              {activeTab === 'recommendations' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">What Your Doctor Recommends</h3>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 mt-2">
                      {recommendations_tab.doctor_advice}
                    </p>
                  </div>

                  {/* Next appointment details if scheduled */}
                  {recommendations_tab.next_appointment && (
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                        Scheduled Follow-up Appointment
                      </span>
                      <h4 className="font-black text-slate-900 text-base">
                        {recommendations_tab.next_appointment.type}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                        <p><strong>Doctor:</strong> {recommendations_tab.next_appointment.doctor}</p>
                        <p><strong>Date & Time:</strong> {recommendations_tab.next_appointment.date} at {recommendations_tab.next_appointment.time}</p>
                        <p className="sm:col-span-2"><strong>Location:</strong> {recommendations_tab.next_appointment.location}</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Wellness & Lifestyle Guidelines</h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {recommendations_tab.lifestyle_notes}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 4: NEXT STEPS & FAQ */}
              {activeTab === 'next_steps' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-3">What to Expect & How to Prepare</h3>
                    <div className="space-y-3">
                      {next_steps_tab.steps.map(s => (
                        <div key={s.step} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start space-x-3">
                          <div className="w-6 h-6 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {s.step}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-900">{s.title}</p>
                            <p className="text-xs text-slate-600 leading-snug mt-0.5">{s.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-3">Frequently Asked Questions</h3>
                    <div className="space-y-3">
                      {next_steps_tab.faq.map((f, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-slate-50/60 border border-slate-100 space-y-1">
                          <p className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <HelpCircle className="w-3.5 h-3.5 text-teal-600" />
                            <span>{f.q}</span>
                          </p>
                          <p className="text-xs text-slate-600 leading-relaxed pl-5">{f.a}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PREVIOUS REPORTS SECTION (Table of past reports of same type) */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Previous Reports of Same Type</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Report ID</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Result</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previous_reports.map(pr => (
                      <tr key={pr.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-mono">{pr.date}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{pr.report_id}</td>
                        <td className="py-2.5 px-3">{pr.type}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {pr.result_badge}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            to={`/patient/reports/${pr.id}`}
                            className="text-teal-600 hover:text-teal-800 font-bold"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR: Report Actions + Related Info + Need Support */}
          <div className="lg:col-span-4 space-y-6">
            {/* Report Actions Panel */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Report Actions</h3>
              <div className="space-y-2 text-xs">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloadingPdf}
                  className="w-full py-2.5 px-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center space-x-2 shadow-2xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>{downloadingPdf ? 'Generating PDF...' : 'Download Official PDF Report'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl flex items-center justify-center space-x-2 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share with Outside Doctor</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full py-2.5 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-2xl flex items-center justify-center space-x-2 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Friendly Report</span>
                </button>
              </div>
            </div>

            {/* Related Information Links (Educational) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Helpful Reading</h3>
              <div className="space-y-2 text-xs text-slate-700">
                <a
                  href="#info-guide"
                  onClick={e => { e.preventDefault(); setActiveTab('next_steps') }}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50/50 border border-slate-100 flex items-center justify-between block transition-colors"
                >
                  <span className="font-semibold">Questions to Ask Your Doctor</span>
                  <ArrowRight className="w-3.5 h-3.5 text-teal-600" />
                </a>

                <a
                  href="#info-biopsy"
                  onClick={e => { e.preventDefault(); setActiveTab('next_steps') }}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50/50 border border-slate-100 flex items-center justify-between block transition-colors"
                >
                  <span className="font-semibold">What Happens in a Core Biopsy?</span>
                  <ArrowRight className="w-3.5 h-3.5 text-teal-600" />
                </a>
              </div>
            </div>

            {/* Need Support Section with Contact Support Button */}
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-3xl p-5 border border-teal-200 space-y-2.5">
              <div className="flex items-center space-x-2 text-teal-800">
                <PhoneCall className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Have Questions?</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                If anything in this report feels confusing or stressful, please talk to our compassionate care coordinator.
              </p>
              <button
                type="button"
                onClick={() => showToast('Care team helpline: +91 800-AURA-MED. Line connected.')}
                className="w-full py-2 px-3 bg-white hover:bg-teal-600 hover:text-white border border-teal-300 text-teal-800 font-bold rounded-2xl text-xs transition-colors shadow-2xs text-center"
              >
                Contact Support Coordinator
              </button>
            </div>
          </div>
        </div>
      </div>
    </PatientLayout>
  )
}
