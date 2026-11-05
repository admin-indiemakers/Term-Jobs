import React from "react";
import { Users, ExternalLink, ChevronRight, Sparkles } from "lucide-react";

/**
 * Status Pill for Candidate Pipeline status
 */
function CandidateStatusPill({ status = "SUBMITTED" }) {
  const clean = (status || "").toLowerCase();
  const isHired = ["hired", "offer extended", "accepted", "signed"].some((s) =>
    clean.includes(s)
  );
  const isShortlisted =
    clean.includes("shortlisted") ||
    clean.includes("interview") ||
    clean.includes("interested");
  const isRejected = clean.includes("rejected") || clean.includes("declined");

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
        isHired
          ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-2xs"
          : isShortlisted
          ? "bg-amber-50 text-amber-800 border-amber-200/80 shadow-2xs"
          : isRejected
          ? "bg-rose-50 text-rose-700 border-rose-200/80"
          : "bg-slate-50 text-slate-700 border-slate-200/80"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          isHired
            ? "bg-emerald-500 animate-pulse"
            : isShortlisted
            ? "bg-amber-500"
            : isRejected
            ? "bg-rose-500"
            : "bg-slate-400"
        }`}
      />
      {status}
    </span>
  );
}

/**
 * Compact, sleek List UI response for candidates matching NEXUS list design.
 */
export function CandidateComparisonCard({ data }) {
  if (!data) return null;

  // Unwrap candidates list or single candidate
  const rawList =
    data?.candidates ||
    data?.data?.candidates ||
    data?.comparison ||
    data?.data?.comparison ||
    (data?.candidate ? [data.candidate] : null) ||
    (data?.data?.candidate ? [data.data.candidate] : null) ||
    (Array.isArray(data) ? data : []);

  if (!rawList || rawList.length === 0) return null;

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-[#E8E4DC] bg-white shadow-2xs divide-y divide-[#F0ECE4]">
      {/* Header */}
      <div className="bg-[#FAF8F5] px-3.5 py-2 flex items-center justify-between border-b border-[#E8E4DC]">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-[#111111] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Users className="size-3.5 text-[#E8E4DC]" />
          </div>
          <span className="text-xs font-bold text-[#111111]">
            Candidate Pipeline
          </span>
          <span className="bg-[#EBE7DF] text-[#48433C] text-[10px] font-semibold px-2 py-0.2 rounded-full">
            {rawList.length} total
          </span>
        </div>

        <a
          href="/dashboard/candidates"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#7A7369] hover:text-[#111111] transition"
        >
          <span>Candidates Portal</span>
          <ExternalLink className="size-3 text-[#9E978C]" />
        </a>
      </div>

      {/* Compact List Rows */}
      {rawList.map((cand, idx) => {
        const name =
          cand.candidate_name || cand.name || `Candidate ${cand.id || idx + 1}`;
        const role = cand.role || cand.target_role || cand.position || "";
        const email = cand.email || cand.candidate_email || "";
        const phone = cand.phone || "";
        const score =
          cand.match_score !== undefined && cand.match_score !== null
            ? Math.round(Number(cand.match_score))
            : null;

        const matchedSkills = Array.isArray(cand.matched_skills)
          ? cand.matched_skills
          : Array.isArray(cand.skills)
          ? cand.skills
          : [];

        const status =
          cand.offer_status || cand.status || cand.recommendation || "SUBMITTED";

        const initials =
          name
            .split(" ")
            .map((w) => w[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase() || "C";

        return (
          <div
            key={cand.id || cand.submission_id || idx}
            className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-[#FAF8F5] transition-colors"
          >
            {/* Left: Avatar + Name + Role + Email */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="size-7.5 rounded-lg bg-[#1C1A17] text-[#FAF8F5] flex items-center justify-center text-[10px] font-bold font-mono shrink-0 shadow-2xs">
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-xs font-bold text-[#111111] truncate">
                    {name}
                  </span>
                  {cand.candidate_id && (
                    <span className="font-mono text-[10px] text-[#71717A] bg-[#F4F4F5] border border-[#E4E4E7] px-1.5 py-0.2 rounded shrink-0">
                      {cand.candidate_id}
                    </span>
                  )}
                  {role && (
                    <span className="text-[11px] text-[#7A7369] font-normal truncate hidden xs:inline">
                      · {role}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[10.5px] text-[#8C8478] truncate mt-0.2">
                  {email && <span className="truncate">{email}</span>}
                  {phone && <span className="hidden sm:inline">· {phone}</span>}
                </div>
              </div>
            </div>

            {/* Center: Status Badge + Matched Skills */}
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              <CandidateStatusPill status={status} />
              {matchedSkills.length > 0 && (
                <div className="hidden md:flex items-center gap-1">
                  {matchedSkills.slice(0, 2).map((s, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-[#F4F1EA] border border-[#E8E4DC] px-1.5 py-0.2 text-[10px] font-medium text-[#48433C]"
                    >
                      {s}
                    </span>
                  ))}
                  {matchedSkills.length > 2 && (
                    <span className="text-[10px] text-[#8C8478]">
                      +{matchedSkills.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right: AI Match Score & Portal Arrow Link */}
            <div className="flex items-center gap-2 shrink-0">
              {score !== null && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                  <Sparkles className="size-3 text-emerald-600" />
                  <span>{score}% Match</span>
                </span>
              )}

              <a
                href="/dashboard/candidates"
                className="p-1 rounded-md text-[#8C8478] hover:text-[#111111] hover:bg-[#EBE7DF] transition cursor-pointer"
                title="View candidate details in portal"
              >
                <ChevronRight className="size-4" />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CandidateComparisonCard;
