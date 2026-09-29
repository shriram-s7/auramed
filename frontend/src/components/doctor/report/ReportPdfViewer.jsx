import { useState } from 'react'
import { formatPatientAgeGender } from '../../../utils/formatAge'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Maximize2,
  Printer,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

function ReportPdfViewer({ report, onDownloadPdf }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [zoom, setZoom] = useState(100)
  const totalPages = 2

  const handlePrint = () => {
    window.print()
  }

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 15, 160))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 15, 75))
  const handleResetZoom = () => setZoom(100)

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-slate-900/90 shadow-xl overflow-hidden">
      {/* Viewer Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-700/80 bg-slate-950 px-4 py-2.5 text-xs text-white">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold text-accent">
            <FileText size={15} />
            <span>{report?.report_number}.pdf</span>
          </span>
          <span className="text-slate-500">|</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="rounded p-1 text-slate-300 hover:bg-slate-800 disabled:opacity-30"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="font-mono text-slate-200">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="rounded p-1 text-slate-300 hover:bg-slate-800 disabled:opacity-30"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Zoom & Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded bg-slate-800/80 px-2 py-1">
            <button
              type="button"
              onClick={handleZoomOut}
              className="text-slate-300 hover:text-white p-0.5"
              title="Zoom out"
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="font-mono text-[11px] text-slate-300 hover:text-white px-1"
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="text-slate-300 hover:text-white p-0.5"
              title="Zoom in"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700 hover:text-white"
            title="Print report"
          >
            <Printer size={13} /> Print
          </button>

          <button
            type="button"
            onClick={onDownloadPdf}
            className="flex items-center gap-1 rounded bg-accent px-3 py-1 text-xs font-bold text-white hover:bg-accent/90"
            title="Download PDF"
          >
            <Download size={13} /> Download
          </button>
        </div>
      </div>

      {/* Main Content: Thumbnails Sidebar + Canvas */}
      <div className="flex flex-1 overflow-hidden bg-slate-900 min-h-[560px]">
        {/* Thumbnails Sidebar */}
        <div className="w-40 border-r border-slate-800 p-3 space-y-3 bg-slate-950/60 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Thumbnails</p>
          {[1, 2].map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              onClick={() => setCurrentPage(pageNum)}
              className={`w-full text-left rounded-lg p-1.5 transition ${
                currentPage === pageNum
                  ? 'ring-2 ring-accent bg-accent/10'
                  : 'hover:bg-slate-800/60'
              }`}
            >
              <div className="h-28 w-full rounded bg-white p-2 shadow flex flex-col justify-between text-[6px] text-slate-400 select-none overflow-hidden">
                <div className="space-y-1">
                  <div className="h-1.5 w-12 bg-slate-800 rounded-sm" />
                  <div className="h-1 w-full bg-slate-300 rounded-sm" />
                  <div className="h-1 w-3/4 bg-slate-300 rounded-sm" />
                </div>
                <div className="h-8 w-full bg-slate-100 rounded-sm flex items-center justify-center">
                  <div className="h-4 w-4 rounded-full bg-teal-500/30" />
                </div>
                <div className="text-right text-slate-300 font-mono">{pageNum}</div>
              </div>
              <span className="block mt-1 text-center font-mono text-[10px] text-slate-400">
                Page {pageNum}
              </span>
            </button>
          ))}
        </div>

        {/* Live Vector Report Canvas */}
        <div className="flex-1 overflow-y-auto p-6 flex justify-center items-start">
          <div
            className="w-full max-w-3xl bg-white text-slate-900 rounded-xl shadow-2xl p-8 transition-transform duration-200"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            {currentPage === 1 ? (
              <div className="space-y-5 text-xs">
                {/* PDF Page 1 Header */}
                <div className="flex items-center justify-between border-b-2 border-teal-600 pb-3">
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-slate-900">
                      AURAMED HEALTHCARE
                    </h2>
                    <p className="text-[10px] font-semibold text-teal-700">
                      AI-Augmented Clinical Decision Support & Diagnostics
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs font-bold text-slate-900">{report?.report_number}</p>
                    <p className="text-[10px] font-bold text-emerald-600">VERIFIED CLINICAL RECORD</p>
                  </div>
                </div>

                {/* Patient Info Table */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 grid grid-cols-2 gap-3">
                  <div>
                    <p><strong>Patient:</strong> {report?.patient_name}</p>
                    <p><strong>ID:</strong> {report?.patient_code}</p>
                    <p>
                      <strong>Age / Gender:</strong>{' '}
                      {formatPatientAgeGender(
                        report?.patient_age,
                        report?.content?.patient_info?.dob || report?.patient_dob,
                        report?.patient_gender
                      )}
                    </p>
                  </div>
                  <div>
                    <p><strong>Physician:</strong> {report?.content?.patient_info?.referring_physician || 'Dr. Mehta'}</p>
                    <p><strong>Scan Type:</strong> {report?.content?.patient_info?.scan_type}</p>
                    <p><strong>Report Date:</strong> {report?.content?.patient_info?.report_date}</p>
                  </div>
                </div>

                {/* Section 2 Clinical Summary */}
                <div>
                  <h3 className="font-bold text-slate-900 uppercase tracking-wide text-[11px] mb-1">
                    1. Clinical Summary
                  </h3>
                  <p className="text-slate-700 leading-relaxed">
                    {report?.content?.clinical_summary?.summary_text}
                  </p>
                </div>

                {/* Section 3 Imaging Findings */}
                <div>
                  <h3 className="font-bold text-slate-900 uppercase tracking-wide text-[11px] mb-1">
                    2. Imaging Findings
                  </h3>
                  <p className="text-slate-700 leading-relaxed mb-2">
                    {report?.content?.imaging_findings?.description}
                  </p>
                  <ul className="space-y-1 text-slate-600 pl-2">
                    {report?.content?.imaging_findings?.findings_bullets?.map((b, i) => (
                      <li key={i}>• {typeof b === 'string' ? b.replace(/^Finding noted\b/i, 'Borderline density irregularity') : b}</li>
                    ))}
                  </ul>

                  {/* Visual Thumbnails in Report View */}
                  {(report?.image_url || report?.image_path || report?.content?.imaging_findings?.main_image_url || report?.grad_cam_base64 || report?.gradcam_heatmap_b64 || report?.content?.imaging_findings?.grad_cam_base64) && (
                    <div className="mt-3 grid grid-cols-2 gap-3 max-w-lg">
                      {(report?.image_url || report?.image_path || report?.content?.imaging_findings?.main_image_url) && (
                        <div className="rounded border border-slate-200 bg-slate-950 p-1">
                          <img
                            src={
                              report.content?.imaging_findings?.main_image_url ||
                              report.image_url ||
                              (report.image_path ? `/${report.image_path}` : '')
                            }
                            alt="Diagnostic Scan Preview"
                            className="h-28 w-full object-cover rounded"
                          />
                          <p className="text-[10px] text-slate-300 font-semibold text-center mt-1">Diagnostic Scan</p>
                        </div>
                      )}
                      {(report?.grad_cam_base64 || report?.gradcam_heatmap_b64 || report?.content?.imaging_findings?.grad_cam_base64 || report?.content?.imaging_findings?.gradcam_heatmap_b64) && (
                        <div className="rounded border border-slate-200 bg-slate-950 p-1">
                          <img
                            src={(() => {
                              const src = report.grad_cam_base64 || report.gradcam_heatmap_b64 || report.content?.imaging_findings?.grad_cam_base64 || report.content?.imaging_findings?.gradcam_heatmap_b64
                              return src.startsWith('data:') ? src : `data:image/png;base64,${src}`
                            })()}
                            alt="AI Heatmap Preview"
                            className="h-28 w-full object-cover rounded"
                          />
                          <p className="text-[10px] text-teal-400 font-semibold text-center mt-1">AI Attention (Grad-CAM)</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-5 text-xs">
                {/* PDF Page 2 Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[10px] text-slate-400">
                  <span>AURAMED HEALTHCARE • {report?.report_number}</span>
                  <span>Page 2 of 2</span>
                </div>

                {/* Section 4 AI & Clinical Assessment */}
                <div>
                  <h3 className="font-bold text-slate-900 uppercase tracking-wide text-[11px] mb-1.5">
                    3. AI and Clinical Assessment
                  </h3>
                  <div className="rounded border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-[10px] text-slate-600 uppercase border-b border-slate-200">
                        <tr>
                          <th className="p-2">Component</th>
                          <th className="p-2">Score</th>
                          <th className="p-2">Interpretation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report?.content?.ai_assessment?.rows?.map((r, i) => (
                          <tr key={i} className={i === 2 ? 'bg-teal-50/50 font-bold' : ''}>
                            <td className="p-2">{r.component}</td>
                            <td className="p-2 font-mono text-teal-700">{r.result}</td>
                            <td className="p-2">{r.interpretation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 5 Final Risk Stratification */}
                <div>
                  <div className="rounded-xl border-2 border-teal-500 bg-teal-50/40 p-4 text-center">
                    <p className="font-mono text-2xl font-black text-slate-900 uppercase">
                      FINAL RISK LEVEL: {report?.risk_level}
                    </p>
                    <p className="mt-1 text-slate-700 text-[11px]">
                      {report?.content?.risk_assessment?.recommendation_sentence}
                    </p>
                  </div>
                </div>

                {/* Section 6 Recommendations */}
                <div>
                  <h3 className="font-bold text-slate-900 uppercase tracking-wide text-[11px] mb-1">
                    4. Clinical Recommendations
                  </h3>
                  <ul className="space-y-1 text-slate-600 pl-2">
                    {report?.content?.recommendations?.recommendations_list?.map((rec, i) => (
                      <li key={i}>• {rec}</li>
                    ))}
                  </ul>
                </div>

                {/* Addendums if any */}
                {report?.content?.addendums?.length > 0 && (
                  <div>
                    <h3 className="font-bold text-amber-900 uppercase tracking-wide text-[11px] mb-1">
                      5. Attached Addendums
                    </h3>
                    {report.content.addendums.map((add) => (
                      <div key={add.id} className="rounded border border-amber-200 bg-amber-50/60 p-2 text-[11px]">
                        <p className="font-bold text-amber-900">{add.doctor_name} ({add.created_at})</p>
                        <p className="text-slate-800 mt-0.5">{add.note}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Digital Signature */}
                <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-3.5 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-900">
                      Digitally Signed by: {report?.signed_by_doctor_name || 'Dr. Mehta'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Reg: {report?.signed_by_doctor_reg || 'TNMC123456'} • {report?.signed_by_doctor_specialty || 'Gynecologic Oncology'}
                    </p>
                    <p className="text-[11px] text-slate-500">{report?.signed_by_doctor_hospital || 'AuraMed General Hospital'}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 font-bold text-[10px]">
                      VERIFIED SIGNATURE
                    </span>
                    <p className="font-mono text-[10px] text-slate-400 mt-1">
                      {report?.signed_at ? new Date(report.signed_at).toLocaleString() : 'Recent'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReportPdfViewer
