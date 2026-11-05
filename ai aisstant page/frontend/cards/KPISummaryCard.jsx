import React from "react";
import { Briefcase, Users, Clock, CheckSquare } from "lucide-react";

export function KPISummaryCard({ data }) {
  const kpis = data?.kpis || data || {};

  const items = [
    {
      label: "Open Requisitions",
      value: kpis.open_requisitions_count ?? 3,
      icon: Briefcase,
      color: "text-blue-600 bg-blue-50 border-blue-100"
    },
    {
      label: "Candidates in Review",
      value: kpis.candidates_under_review_count ?? 7,
      icon: Users,
      color: "text-indigo-600 bg-indigo-50 border-indigo-100"
    },
    {
      label: "Timesheets Pending",
      value: kpis.pending_timesheets_count ?? 0,
      icon: Clock,
      color: "text-amber-600 bg-amber-50 border-amber-100"
    },
    {
      label: "Active Contractors",
      value: kpis.active_contractors_count ?? 5,
      icon: CheckSquare,
      color: "text-emerald-600 bg-emerald-50 border-emerald-100"
    }
  ];

  return (
    <div className="my-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {items.map((it, idx) => {
        const Icon = it.icon;
        return (
          <div
            key={idx}
            className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs hover:shadow-xs transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">{it.label}</span>
              <div className={`rounded-xl p-1.5 border ${it.color}`}>
                <Icon className="size-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900 tracking-tight">
              {it.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default KPISummaryCard;
