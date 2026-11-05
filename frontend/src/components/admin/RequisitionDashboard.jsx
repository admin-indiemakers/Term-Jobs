import { ArrowUpRight, Briefcase, Building2, CalendarClock, CheckCircle2, Eye, Users } from 'lucide-react';
import { AdminMetric } from './AdminPageHeader';
import { requisitionDashboard } from '../../utils/requisitionDashboard';

export default function RequisitionDashboard({ rows, ready, loading, onReview }) {
  const data = requisitionDashboard(rows);
  const value = key => ready ? data[key].toLocaleString() : null;
  return <section aria-labelledby="requisition-dashboard-title" aria-busy={loading} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 id="requisition-dashboard-title" className="text-lg font-semibold text-gray-900">Hiring snapshot</h2><p className="mt-1 text-sm text-gray-500">All company requisitions · Counts refresh with the postings below.</p></div>
      {loading && <p role="status" className="text-xs text-gray-500">Updating metrics…</p>}
    </div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
      <AdminMetric label="Total applications" value={value('applications')} detail="Across open and closed roles" icon={Users} />
      <AdminMetric label="Role viewers" value={value('viewers')} detail="Candidate / browser sessions per role" icon={Eye} />
      <AdminMetric label="Open roles" value={value('open')} detail="Currently published postings" icon={Briefcase} />
      <AdminMetric label="Closed roles" value={value('closed')} detail="Expired or manually closed" icon={CheckCircle2} />
      <AdminMetric label="Companies" value={value('companies')} detail="Companies with a posting" icon={Building2} />
      <AdminMetric label="Awaiting applicants" value={value('awaitingApplicants')} detail="Open roles with no applications" icon={Users} />
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <section aria-labelledby="top-requisitions-title" className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5">
        <h3 id="top-requisitions-title" className="font-semibold text-gray-900">Most applied roles</h3>
        <p className="mt-1 text-xs text-gray-500">Top five by total applications, including closed postings.</p>
        {!ready ? <p className="py-6 text-sm text-gray-500">{loading ? 'Loading application activity…' : 'Metrics unavailable. Refresh to try again.'}</p>
          : !data.topRoles.length ? <p className="py-6 text-sm text-gray-500">No applications yet. Activity will appear when candidates apply.</p>
            : <div className="mt-4 space-y-1">{data.topRoles.map(row => <button key={row.id} type="button" onClick={() => onReview(row, 'applicants')} aria-label={`Review applications for ${row.title}`} className="block w-full rounded-lg p-2 text-left hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800">
              <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-900">{row.title}</p><p className="truncate text-xs text-gray-500">{row.company_name}{row.status === 'Closed' ? ' · Closed' : ''}</p></div><span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-gray-900">{Number(row.applicants_count).toLocaleString()}<ArrowUpRight size={14} aria-hidden="true" /></span></div>
              <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-900" style={{ width: `${Number(row.applicants_count) / Number(data.topRoles[0].applicants_count) * 100}%` }} /></div>
            </button>)}</div>}
      </section>
      <section aria-labelledby="closing-requisitions-title" className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3"><h3 id="closing-requisitions-title" className="font-semibold text-gray-900">Closing in the next 7 days</h3><CalendarClock size={18} className="text-gray-400" aria-hidden="true" /></div>
        <p className="mt-1 text-xs text-gray-500">Application deadlines use the India calendar day.</p>
        {!ready ? <p className="py-6 text-sm text-gray-500">{loading ? 'Loading deadlines…' : 'Metrics unavailable. Refresh to try again.'}</p>
          : !data.closingSoon.length ? <p className="py-6 text-sm text-gray-500">No open roles are due in the next 7 days.</p>
            : <div className="mt-4 divide-y divide-gray-100">{data.closingSoon.slice(0, 5).map(row => <button type="button" key={row.id} onClick={() => onReview(row, 'applicants')} aria-label={`Review closing role ${row.title}`} className="flex w-full items-center justify-between gap-4 rounded-lg px-2 py-3 text-left hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800">
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-900">{row.title}</p><p className="truncate text-xs text-gray-500">{row.company_name} · {row.structured_role.submission_deadline}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${row.daysLeft === 0 ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{row.daysLeft === 0 ? 'Today' : row.daysLeft === 1 ? 'Tomorrow' : `In ${row.daysLeft} days`}</span>
            </button>)}{data.closingSoon.length > 5 && <p className="pt-3 text-xs text-gray-500">{data.closingSoon.length - 5} more approaching deadlines in the list below.</p>}</div>}
      </section>
    </div>
    <p className="text-xs text-gray-500">Applications count submissions, not unique people. Viewer counts start from the tracking update and may include the same person across different roles.</p>
  </section>;
}
