import React, { useState } from "react";
import {
  Briefcase,
  MapPin,
  Users,
  DollarSign,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
  Search,
  Filter
} from "lucide-react";

/**
 * Modern Status Badge with colored pulse indicator
 */
function StatusPill({ status = "OPEN" }) {
  const normalized = status.toLowerCase();
  const isPublished = ["published", "open", "active", "approved"].includes(normalized);
  const isPending = [
    "structuring",
    "pending approval",
    "draft",
    "pending",
    "in review"
  ].includes(normalized);
  const isClosed = ["closed", "archived", "filled", "inactive"].includes(normalized);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 border ${
        isPublished
          ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-2xs"
          : isPending
          ? "bg-amber-50 text-amber-700 border-amber-200/80 shadow-2xs"
          : isClosed
          ? "bg-slate-100 text-slate-600 border-slate-200/80"
          : "bg-rose-50 text-rose-700 border-rose-200/80"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          isPublished
            ? "bg-emerald-500 animate-pulse"
            : isPending
            ? "bg-amber-500"
            : isClosed
            ? "bg-slate-400"
            : "bg-rose-500"
        }`}
      />
      {status}
    </span>
  );
}

/**
 * Compact Single Requisition Row in List View
 */
function RequisitionRow({ req, index }) {
  const reqId = req.requisition_id || req.id || "";
  const displayId =
    reqId.length > 18 ? `${reqId.slice(0, 8)}...${reqId.slice(-4)}` : reqId;

  const department =
    req.department || req.department_name || req.company_name || req.client_name || "General";
  const title = req.title || req.job_title || "Untitled Requisition";
  const headcount = req.headcount || 1;
  const workMode = req.work_mode || req.location || "Remote";

  return (
    <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-b-0">
      {/* Left: Index + Title + Department + ID */}
      <div className="flex items-start gap-3 min-w-0">
        <span className="text-slate-400 font-mono text-[11px] font-medium w-5 pt-0.5 shrink-0 text-right">
          {index + 1}
        </span>

        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate tracking-tight group-hover:text-indigo-600 transition-colors">
              {title}
            </h4>
            <span className="inline-block rounded-md bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
              {department}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
            <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/50">
              ID: {displayId}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Users className="size-3 text-slate-400" />
              {headcount} {headcount === 1 ? "Opening" : "Openings"}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3 text-slate-400" />
              {workMode}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Status Pill + View Link */}
      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center pl-8 sm:pl-0">
        <StatusPill status={req.status || "OPEN"} />

        <a
          href={`/dashboard/requisitions`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          title={`View ${title} in portal`}
        >
          <span>View</span>
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}

/**
 * Requisition List Container with Quick Status Filters and View All toggle
 */
function RequisitionListView({ requisitions = [] }) {
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = requisitions.filter((r) => {
    const status = (r.status || "").toLowerCase();
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "published"
        ? ["published", "open", "active"].includes(status)
        : filter === "pending"
        ? ["pending approval", "structuring", "draft"].includes(status)
        : filter === "closed"
        ? ["closed", "archived", "filled"].includes(status)
        : true;

    if (!matchesFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const title = (r.title || r.job_title || "").toLowerCase();
      const id = (r.requisition_id || r.id || "").toLowerCase();
      const dept = (r.department || r.company_name || "").toLowerCase();
      return title.includes(q) || id.includes(q) || dept.includes(q);
    }
    return true;
  });

  const displayList = showAll ? filtered : filtered.slice(0, 6);

  // Status counts
  const publishedCount = requisitions.filter((r) =>
    ["published", "open", "active"].includes((r.status || "").toLowerCase())
  ).length;
  const pendingCount = requisitions.filter((r) =>
    ["pending approval", "structuring", "draft"].includes((r.status || "").toLowerCase())
  ).length;
  const closedCount = requisitions.filter((r) =>
    ["closed", "archived", "filled"].includes((r.status || "").toLowerCase())
  ).length;

  return (
    <div className="my-3 rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
            <Layers className="size-3.5" />
          </div>
          <span className="font-bold text-xs sm:text-sm text-slate-900">
            Requisitions List
          </span>
          <span className="bg-slate-200/80 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
            {requisitions.length}
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              filter === "all"
                ? "bg-slate-900 text-white font-semibold"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60"
            }`}
          >
            All ({requisitions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("published")}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              filter === "published"
                ? "bg-emerald-600 text-white font-semibold"
                : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200/60"
            }`}
          >
            Published ({publishedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              filter === "pending"
                ? "bg-amber-600 text-white font-semibold"
                : "bg-white text-amber-700 hover:bg-amber-50 border border-amber-200/60"
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("closed")}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              filter === "closed"
                ? "bg-slate-600 text-white font-semibold"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60"
            }`}
          >
            Closed ({closedCount})
          </button>
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-100">
        {displayList.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-slate-400">
            No requisitions found matching the selected filter.
          </div>
        ) : (
          displayList.map((req, idx) => (
            <RequisitionRow
              key={req.requisition_id || req.id || req._id || idx}
              req={req}
              index={idx}
            />
          ))
        )}
      </div>

      {/* Footer / Expand Button */}
      <div className="bg-slate-50/60 px-4 py-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing {displayList.length} of {filtered.length} requisitions
        </span>

        <div className="flex items-center gap-3">
          {filtered.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
            >
              {showAll ? (
                <>
                  <span>Show less</span>
                  <ChevronUp className="size-3.5" />
                </>
              ) : (
                <>
                  <span>Show all {filtered.length}</span>
                  <ChevronDown className="size-3.5" />
                </>
              )}
            </button>
          )}

          <a
            href="/dashboard/requisitions"
            className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 transition"
          >
            <span>Open in Portal</span>
            <ExternalLink className="size-3 text-slate-400" />
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Single Draft Card for a single newly created or updated requisition
 */
function SingleDraftCard({ req }) {
  const skills = Array.isArray(req.primary_skills)
    ? req.primary_skills
    : Array.isArray(req.skills)
    ? req.skills
    : [];

  return (
    <div className="my-2.5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 uppercase">
            {req.department || req.company_name || "Engineering"}
          </span>
          <h4 className="mt-1 text-sm font-bold text-slate-900">
            {req.title || "Untitled Requisition"}
          </h4>
        </div>
        <StatusPill status={req.status || "DRAFT"} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
        <div className="flex items-center gap-1.5">
          <Users className="size-3.5 text-slate-400" />
          <span>{req.headcount || 1} Openings</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="size-3.5 text-slate-400" />
          <span>{req.work_mode || "Remote"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <DollarSign className="size-3.5 text-slate-400" />
          <span>Max ${req.budget_max || "N/A"}/hr</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Briefcase className="size-3.5 text-slate-400" />
          <span>{req.min_experience_years || 0}+ yrs exp</span>
        </div>
      </div>

      {skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {skills.slice(0, 6).map((skill, idx) => (
            <span
              key={idx}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
        <span className="text-slate-400 font-mono text-[11px]">
          ID: {req.requisition_id || req.id || "Pending"}
        </span>
        <a
          href="/dashboard/requisitions"
          className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800"
        >
          <span>View in Portal</span>
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}

/**
 * Main Card Component supporting Requisition List and Single Drafts
 */
export function RequisitionDraftCard({ data }) {
  if (!data) return null;

  const reqList = Array.isArray(data?.requisitions)
    ? data.requisitions
    : Array.isArray(data?.data?.requisitions)
    ? data.data.requisitions
    : null;

  if (reqList) {
    return <RequisitionListView requisitions={reqList} />;
  }

  const req = data?.requisition || data?.data || data || {};
  return <SingleDraftCard req={req} />;
}

export default RequisitionDraftCard;
