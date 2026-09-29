import ModulePill from '../../common/ModulePill'

function FollowUpPlanList({ plan }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-primary/40">
          <tr>
            <th className="px-4 py-3 font-medium">Module</th>
            <th className="px-4 py-3 font-medium">AI Recommended Date</th>
            <th className="px-4 py-3 font-medium">Doctor Set Date</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {plan.map((item) => (
            <tr key={item.module} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <ModulePill module={item.module} />
              </td>
              <td className="px-4 py-3 text-primary/60">{item.ai_recommended_date || 'Not generated'}</td>
              <td className="px-4 py-3 font-medium text-primary">{item.doctor_set_date || 'Not scheduled'}</td>
              <td className="px-4 py-3 capitalize text-primary/60">{item.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-3 text-xs text-primary/40">
        Override history will appear here once a doctor-set date differs from the AI recommendation
        for a given scan.
      </p>
    </div>
  )
}

export default FollowUpPlanList
