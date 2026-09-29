import { useState } from 'react'
import {
  Check,
  Lock,
  Mail,
  Send,
  Share2,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react'

export default function ShareReportModal({
  isOpen,
  onClose,
  onConfirm,
  report,
  sharing = false,
}) {
  const [deliveryChannel, setDeliveryChannel] = useState('portal')
  const [shareWithPhysician, setShareWithPhysician] = useState(true)
  const [message, setMessage] = useState(
    'Your clinical screening analysis is complete. Please review the attached findings and follow-up plan.'
  )

  if (!isOpen || !report) return null

  const handleShare = () => {
    onConfirm({
      share_with_patient: true,
      delivery_method: deliveryChannel,
      share_with_physician: shareWithPhysician,
      message,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Share2 size={16} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-primary">Share Diagnostic Report</h3>
              <p className="text-[11px] text-primary/60">
                {report.report_number} • Patient: {report.patient_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-primary/40 hover:bg-slate-200 hover:text-primary transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Signed Status Pill */}
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-emerald-900">
            <ShieldCheck size={18} className="text-emerald-600 flex-shrink-0" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold">Digitally Certified: </span>
              This report is permanently signed and locked. Secure transmission will be logged in the audit registry.
            </div>
          </div>

          {/* Delivery Channel Options */}
          <div>
            <label className="font-bold text-primary block mb-2">Select Delivery Channel</label>
            <div className="grid grid-cols-3 gap-2">
              {/* Channel 1: Patient Portal (Active) */}
              <button
                type="button"
                onClick={() => setDeliveryChannel('portal')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition ${
                  deliveryChannel === 'portal'
                    ? 'border-accent bg-accent/10 text-accent ring-2 ring-accent/30 font-bold'
                    : 'border-border bg-background text-primary/70 hover:bg-slate-100'
                }`}
              >
                <Share2 size={18} className={deliveryChannel === 'portal' ? 'text-accent' : 'text-primary/60'} />
                <span className="text-xs">Patient Portal</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.2 text-[9px] font-bold text-emerald-800">
                  Ready
                </span>
              </button>

              {/* Channel 2: Email (Coming Soon) */}
              <button
                type="button"
                disabled
                title="Direct email dispatch is coming soon"
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-slate-50 p-3 text-center opacity-60 cursor-not-allowed"
              >
                <Mail size={18} className="text-primary/40" />
                <span className="text-xs text-primary/60">Email PDF</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.2 text-[9px] font-semibold text-slate-600">
                  Coming soon
                </span>
              </button>

              {/* Channel 3: SMS Link (Coming Soon) */}
              <button
                type="button"
                disabled
                title="SMS dispatch is coming soon"
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-slate-50 p-3 text-center opacity-60 cursor-not-allowed"
              >
                <Smartphone size={18} className="text-primary/40" />
                <span className="text-xs text-primary/60">SMS Link</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.2 text-[9px] font-semibold text-slate-600">
                  Coming soon
                </span>
              </button>
            </div>
          </div>

          {/* Share with Referring Physician */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
            <div>
              <p className="font-semibold text-primary">Copy Referring Physician</p>
              <p className="text-[10px] text-primary/50">Send transmission receipt and report link</p>
            </div>
            <input
              type="checkbox"
              checked={shareWithPhysician}
              onChange={(e) => setShareWithPhysician(e.target.checked)}
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
            />
          </div>

          {/* Optional Message */}
          <div>
            <div className="flex items-center justify-between mb-1 text-primary/70">
              <label className="font-semibold text-primary">Message to Patient</label>
              <span className="font-mono text-[10px]">{message.length}/500</span>
            </div>
            <textarea
              rows={3}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3.5 bg-slate-50/50">
          <button
            type="button"
            disabled={sharing}
            onClick={onClose}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-primary hover:bg-slate-100 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={sharing}
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2 text-xs font-bold text-white shadow transition hover:bg-accent/90 disabled:opacity-50"
          >
            <Send size={13} />
            {sharing ? 'Sharing Report...' : 'Confirm & Share'}
          </button>
        </div>
      </div>
    </div>
  )
}
