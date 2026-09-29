import { useState } from 'react'
import {
  Calendar,
  Check,
  Download,
  FileCheck,
  Mail,
  Send,
  Share2,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'

function ReportEditSectionPanel({
  activeSection,
  content,
  isSigned = false,
  onSignReport,
  onViewSignedReport,
  onContentChange,
  onDownloadPdf,
  onSaveDraft,
  onSharePatient,
  onScheduleFollowup,
  onReferSpecialist,
  savingDraft = false,
  downloadingPdf = false,
}) {
  const [copiedMsg, setCopiedMsg] = useState('')

  if (!content) return null

  const handlePatientInfoChange = (field, val) => {
    onContentChange({
      ...content,
      patient_info: {
        ...content.patient_info,
        [field]: val,
      },
    })
  }

  const handleTextChange = (section, field, val) => {
    onContentChange({
      ...content,
      [section]: {
        ...content[section],
        [field]: val,
      },
    })
  }

  const handleSendPhysician = () => {
    navigator.clipboard?.writeText(window.location.href)
    setCopiedMsg('Report link copied to clipboard for referring physician!')
    setTimeout(() => setCopiedMsg(''), 3500)
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-6">
      {/* Dynamic Section Fields */}
      <div>
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
            Edit: {activeSection.replace(/_/g, ' ')}
          </h3>
          <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
            Live Editable
          </span>
        </div>

        <div className="mt-3 space-y-3 text-xs">
          {activeSection === 'patient_info' && (
            <>
              <div>
                <label className="font-semibold text-primary/70">Patient Name</label>
                <input
                  type="text"
                  value={content.patient_info?.name || ''}
                  onChange={(e) => handlePatientInfoChange('name', e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-primary/70">Patient ID</label>
                  <input
                    type="text"
                    value={content.patient_info?.patient_id || ''}
                    onChange={(e) => handlePatientInfoChange('patient_id', e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-primary/70">Age</label>
                  <input
                    type="number"
                    value={content.patient_info?.age ?? ''}
                    onChange={(e) => handlePatientInfoChange('age', parseInt(e.target.value) || 0)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-primary/70">Gender</label>
                <input
                  type="text"
                  value={content.patient_info?.gender || ''}
                  onChange={(e) => handlePatientInfoChange('gender', e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-primary/70">Date of Scan</label>
                <input
                  type="date"
                  value={content.patient_info?.date_of_scan || ''}
                  onChange={(e) => handlePatientInfoChange('date_of_scan', e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-primary/70">Referring Physician</label>
                <input
                  type="text"
                  value={content.patient_info?.referring_physician || ''}
                  onChange={(e) => handlePatientInfoChange('referring_physician', e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-primary/70">Clinical Indication</label>
                <textarea
                  rows={2}
                  value={content.patient_info?.indication || ''}
                  onChange={(e) => handlePatientInfoChange('indication', e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
                />
              </div>
            </>
          )}

          {activeSection === 'clinical_summary' && (
            <div>
              <label className="font-semibold text-primary/70">Clinical Summary Narrative</label>
              <textarea
                rows={5}
                value={content.clinical_summary?.summary_text || ''}
                onChange={(e) => handleTextChange('clinical_summary', 'summary_text', e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background p-2 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
              />
            </div>
          )}

          {activeSection === 'imaging_findings' && (
            <div>
              <label className="font-semibold text-primary/70">Findings Description</label>
              <textarea
                rows={5}
                value={content.imaging_findings?.description || ''}
                onChange={(e) => handleTextChange('imaging_findings', 'description', e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background p-2 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
              />
            </div>
          )}

          {activeSection === 'rotterdam_criteria' && (
            <div>
              <label className="font-semibold text-primary/70">Rotterdam Assessment Note</label>
              <textarea
                rows={4}
                value={content.rotterdam_criteria?.note || ''}
                onChange={(e) => handleTextChange('rotterdam_criteria', 'note', e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background p-2 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
              />
            </div>
          )}

          {activeSection === 'risk_assessment' && (
            <div>
              <label className="font-semibold text-primary/70">Risk Recommendation Sentence</label>
              <textarea
                rows={4}
                value={content.risk_assessment?.recommendation_sentence || ''}
                onChange={(e) => handleTextChange('risk_assessment', 'recommendation_sentence', e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background p-2 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
              />
            </div>
          )}

          {activeSection === 'recommendations' && (
            <div>
              <label className="font-semibold text-primary/70">AI Insight Explanation</label>
              <textarea
                rows={4}
                value={content.recommendations?.ai_insight_explanation || ''}
                onChange={(e) => handleTextChange('recommendations', 'ai_insight_explanation', e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background p-2 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {copiedMsg && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-[11px] font-semibold text-emerald-800">
          ✓ {copiedMsg}
        </div>
      )}

      {/* Quick Actions */}
      <div className="border-t border-border pt-4">
        <label className="text-xs font-bold uppercase tracking-wider text-primary/60">
          Quick Actions
        </label>
        <div className="mt-2.5 space-y-2">
          {isSigned ? (
            <button
              type="button"
              onClick={onViewSignedReport}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <ShieldCheck size={14} /> View Signed Report
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignReport}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-accent/90"
            >
              <ShieldCheck size={14} /> Sign &amp; Lock Report
            </button>
          )}

          <button
            type="button"
            disabled={downloadingPdf}
            onClick={onDownloadPdf}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-1.5 text-xs font-semibold text-primary transition hover:bg-slate-100 disabled:opacity-50"
          >
            <Download size={13} className="text-primary/60" />
            {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>

          <button
            type="button"
            onClick={onSharePatient}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-1.5 text-xs font-semibold text-primary transition hover:bg-slate-100"
          >
            <Share2 size={13} className="text-accent" /> Share with Patient
          </button>

          <button
            type="button"
            onClick={handleSendPhysician}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-1.5 text-xs font-semibold text-primary transition hover:bg-slate-100"
          >
            <Mail size={13} className="text-primary/60" /> Send to Referring Physician
          </button>

          <button
            type="button"
            disabled={savingDraft}
            onClick={onSaveDraft}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-1.5 text-xs font-semibold text-primary transition hover:bg-slate-100 disabled:opacity-50"
          >
            <FileCheck size={13} className="text-primary/60" />
            {savingDraft ? 'Saving Draft...' : 'Save as Draft'}
          </button>
        </div>
      </div>

      {/* Next Steps Section */}
      <div className="border-t border-border pt-4">
        <label className="text-xs font-bold uppercase tracking-wider text-primary/60">
          Next Steps
        </label>
        <div className="mt-2.5 space-y-2">
          <button
            type="button"
            onClick={onScheduleFollowup}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-1.5 text-xs font-medium text-primary hover:bg-slate-100"
          >
            <Calendar size={12} className="text-accent" /> Schedule Follow-up
          </button>
          <button
            type="button"
            onClick={onReferSpecialist}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-1.5 text-xs font-medium text-primary hover:bg-slate-100"
          >
            <UserPlus size={12} className="text-purple-600" /> Refer to Specialist
          </button>
          <button
            type="button"
            onClick={onSaveDraft}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-1.5 text-xs font-medium text-primary hover:bg-slate-100"
          >
            <Check size={12} className="text-emerald-600" /> Add to Patient Records
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReportEditSectionPanel
