import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock,
  Sparkles,
  Calendar,
  FileText,
  User,
  Heart,
  ChevronRight,
  ShieldCheck,
  PhoneCall,
  ArrowRight,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import PatientLayout from '../../components/patient/PatientLayout'
import { getModuleSvgIcon } from '../../components/patient/ModuleIcons'
import { fetchPatientTimeline, fetchPatientDashboard } from '../../services/patientPortalService'

export default function PatientTimeline() {
  const [loading, setLoading] = useState(true)
  const [timelineData, setTimelineData] = useState(null)
  const [dashData, setDashData] = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchPatientTimeline(), fetchPatientDashboard()])
      .then(([timeRes, dashRes]) => {
        setTimelineData(timeRes.data)
        setDashData(dashRes.data)
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const getDotStyle = color => {
    switch (color) {
      case 'pink':
        return 'bg-pink-500 ring-4 ring-pink-100'
      case 'purple':
        return 'bg-purple-500 ring-4 ring-purple-100'
      case 'teal':
        return 'bg-teal-500 ring-4 ring-teal-100'
      case 'blue':
        return 'bg-blue-500 ring-4 ring-blue-100'
      default:
        return 'bg-slate-400 ring-4 ring-slate-100'
    }
  }

  const getModuleBadge = (badge, color) => {
    if (color === 'red' || badge === 'Needs Follow-up') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
          Needs Follow-up
        </span>
      )
    }
    if (color === 'amber' || badge === 'Mild Risk') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
          Mild Risk
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        Normal
      </span>
    )
  }

  const events = timelineData?.events || []
  const healthSummary = timelineData?.health_summary || []
  const upcoming = dashData?.next_appointment

  return (
    <PatientLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Top Header & Motivational Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              My Health Timeline
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              A view of your health journey with AuraMed
            </p>
          </div>

          {/* Motivational card top right: Illustration/Icon, "Small Steps. Healthier Tomorrows." */}
          <div className="bg-gradient-to-r from-teal-50 via-emerald-50 to-cyan-50 border border-teal-200/80 rounded-3xl p-4 shadow-2xs flex items-center space-x-3.5 max-w-sm">
            <div className="w-10 h-10 rounded-2xl bg-white text-teal-600 flex items-center justify-center shadow-xs flex-shrink-0">
              <Sparkles className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="font-bold text-xs text-teal-950">Small Steps. Healthier Tomorrows.</p>
              <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                Each screening protects your future peace of mind.
              </p>
            </div>
          </div>
        </div>

        {/* TWO COLUMN: Left-Center Vertical Timeline + Right Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* VERTICAL TIMELINE (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-4">
            {loading ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                Loading your health milestones...
              </div>
            ) : events.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-2">
                <Heart className="w-10 h-10 text-teal-500 mx-auto" />
                <h3 className="font-bold text-slate-900 text-base">Your health journey begins here.</h3>
                <p className="text-xs text-slate-500">Your first screening will appear here.</p>
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-200 ml-4 sm:ml-6 pl-6 sm:pl-8 space-y-6 py-2">
                {events.map((ev, idx) => (
                  <div key={ev.id || idx} className="relative group">
                    {/* Colored dot on timeline */}
                    <div
                      className={`absolute -left-[31px] sm:-left-[39px] top-4 w-4 h-4 rounded-full border-2 border-white transition-transform group-hover:scale-125 ${getDotStyle(
                        ev.dot_color
                      )}`}
                    />

                    {/* Timeline Event Card */}
                    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:border-teal-300 hover:shadow-sm transition-all space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center space-x-2.5">
                          {/* Event icon in circle */}
                          <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                            {ev.module === 'appointment' ? (
                              <Calendar className="w-4 h-4 text-blue-600" />
                            ) : ev.module === 'registration' ? (
                              <User className="w-4 h-4 text-slate-600" />
                            ) : (
                              getModuleSvgIcon(ev.module, 'w-4 h-4')
                            )}
                          </div>
                          <div>
                            <span className="font-mono text-[10px] font-bold text-slate-400 block uppercase">
                              {ev.date}
                            </span>
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                              {ev.title}
                            </h3>
                          </div>
                        </div>

                        {ev.action_link && (
                          <Link
                            to={ev.action_link}
                            className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-xl text-xs transition-colors self-start sm:self-center shadow-2xs"
                          >
                            {ev.action_label || 'View'}
                          </Link>
                        )}
                      </div>

                      {/* Plain language description */}
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {ev.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR: Health Summary + Upcoming Appointment + Need Assistance (lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-6">
            {/* HEALTH SUMMARY PANEL */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Active Health Summary</h3>
                <p className="text-[11px] text-slate-500">Status across your three screening modules</p>
              </div>

              {/* Three module status rows */}
              <div className="space-y-3 text-xs">
                {healthSummary.map((hs, i) => (
                  <div key={i} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {hs.icon === 'ribbon' ? getModuleSvgIcon('breast', 'w-4 h-4') : hs.icon === 'uterus' ? getModuleSvgIcon('cervical', 'w-4 h-4') : getModuleSvgIcon('pcos', 'w-4 h-4')}
                        <span className="font-bold text-slate-900">{hs.module}</span>
                      </div>
                      {getModuleBadge(hs.status_badge, hs.status_color)}
                    </div>
                    <p className="text-[11px] text-slate-400 pl-6">
                      Last evaluated: <strong className="text-slate-700">{hs.last_screened || hs.last_assessed}</strong>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* UPCOMING APPOINTMENT CARD (Compact version) */}
            {upcoming && (
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Next Visit</h3>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Confirmed
                  </span>
                </div>

                <div className="text-xs space-y-1.5">
                  <p className="font-black text-slate-900 text-sm">{upcoming.type}</p>
                  <p className="text-slate-600">With {upcoming.doctor_name}</p>
                  <p className="text-teal-700 font-bold font-mono">{upcoming.date} at {upcoming.time}</p>
                </div>

                <Link
                  to="/patient/appointments"
                  className="w-full py-2 px-3 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-xl text-xs block text-center transition-colors shadow-2xs"
                >
                  Manage Appointment
                </Link>
              </div>
            )}

            {/* NEED ASSISTANCE PANEL: Support Team Contact Button */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xs space-y-3">
              <div className="flex items-center space-x-2 text-teal-400">
                <PhoneCall className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Need Assistance?</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Have questions regarding your timeline or prior examinations? Our patient navigator is ready to guide you.
              </p>
              <a
                href="tel:18002872633"
                className="w-full py-2 px-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs block text-center shadow-2xs transition-colors"
              >
                Call Care Support (Toll Free)
              </a>
            </div>
          </div>
        </div>
      </div>
    </PatientLayout>
  )
}
