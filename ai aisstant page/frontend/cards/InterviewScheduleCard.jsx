import React from "react";
import { Calendar, Video, Clock, User, Link as LinkIcon } from "lucide-react";

export function InterviewScheduleCard({ data }) {
  const item = data?.interview || data || {};

  return (
    <div className="my-3 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-600 p-2 text-white">
            <Video className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              {item.round_name || "Technical Screen"}
            </h4>
            <div className="text-xs text-slate-500">
              Candidate: <span className="font-semibold text-slate-700">{item.candidate_name || item.candidate_id || "Candidate"}</span>
            </div>
          </div>
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
          CONFIRMED
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-600 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-indigo-500" />
          <span>{item.scheduled_time || "Tomorrow 15:00 UTC"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-indigo-500" />
          <span>{item.duration_minutes || 45} mins</span>
        </div>
      </div>

      {item.meeting_link && (
        <div className="mt-3">
          <a
            href={item.meeting_link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
          >
            <Video className="h-3.5 w-3.5" /> Join LiveKit Interview Room
          </a>
        </div>
      )}
    </div>
  );
}
