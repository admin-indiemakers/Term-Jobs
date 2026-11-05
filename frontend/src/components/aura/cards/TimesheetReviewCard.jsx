import React from "react";
import { FileText, Clock, User, CheckCircle2, ExternalLink } from "lucide-react";

export function TimesheetReviewCard({ data }) {
  const timesheets = Array.isArray(data?.timesheets)
    ? data.timesheets
    : Array.isArray(data?.data?.timesheets)
    ? data.data.timesheets
    : Array.isArray(data)
    ? data
    : [];

  if (timesheets.length === 0) {
    return (
      <div className="my-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-2.5 flex items-center justify-between text-xs shadow-2xs">
        <div className="flex items-center gap-2 text-emerald-800 font-semibold">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <span>Contractor Timesheets Current</span>
        </div>
        <span className="text-[11px] font-medium text-emerald-700 bg-white px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
          0 Pending Approvals
        </span>
      </div>
    );
  }

  return (
    <div className="my-3 rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
      <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Clock className="size-3.5" />
          </div>
          <h4 className="text-xs sm:text-sm font-bold text-slate-900">
            Timesheets Awaiting Review
          </h4>
          <span className="bg-amber-100 text-amber-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
            {timesheets.length} Pending
          </span>
        </div>

        <a
          href="/dashboard/timesheets"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
        >
          <span>Timesheets Portal</span>
          <ExternalLink className="size-3" />
        </a>
      </div>

      <div className="divide-y divide-slate-100">
        {timesheets.map((ts, idx) => (
          <div
            key={ts.id || idx}
            className="p-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {ts.contractor_name || "Contractor"}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Week Ending: <span className="font-medium text-slate-700">{ts.week_ending || "Current"}</span> • {ts.project || "Platform"}
              </div>
            </div>

            <div className="text-right space-y-1">
              <div className="text-sm font-bold text-slate-900">
                {ts.total_hours || 40.0} hrs
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 px-2 py-0.5 text-[10px] font-semibold">
                <span className="size-1.5 rounded-full bg-amber-500" /> SUBMITTED
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TimesheetReviewCard;
