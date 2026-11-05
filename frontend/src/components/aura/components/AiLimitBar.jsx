import React from "react";
import { Sliders, AlertTriangle } from "lucide-react";
import { useUserAiConfig, openAiConfigDialog } from "../hooks/useUserAiConfig";

export function AiLimitBar({ className = "" }) {
  const { isConnected, stats } = useUserAiConfig();

  const rpmRatio = stats.rpmCount / Math.max(1, stats.rpmLimit);
  const dailyRatio = stats.dailyCount / Math.max(1, stats.dailyLimit);
  const highestRatio = Math.max(rpmRatio, dailyRatio);

  const statusColor =
    highestRatio >= 0.85
      ? "bg-rose-500"
      : highestRatio >= 0.6
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <div
      className={`flex flex-col gap-1.5 border-b border-[#E8E4DC] bg-white/75 px-4 py-2 text-xs backdrop-blur-md ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`size-2 shrink-0 rounded-full ${
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          <span className="truncate font-medium text-slate-800">
            {isConnected ? stats.model.name : "Not Configured"}
          </span>
          {isConnected ? (
            <span className="inline-flex items-center rounded border border-emerald-500/30 bg-emerald-50 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-700">
              Connected
            </span>
          ) : (
            <button
              onClick={openAiConfigDialog}
              className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 hover:bg-amber-500/20"
            >
              Connect API Key
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 text-slate-500">
          {isConnected ? (
            <>
              <span className="text-[11px]">
                <span className="font-semibold text-slate-900">{stats.rpmCount}</span>/
                {stats.rpmLimit} RPM
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-[11px]">
                <span className="font-semibold text-slate-900">{stats.dailyCount}</span>/
                {stats.dailyLimit} Day
              </span>
            </>
          ) : (
            <span className="text-[11px] text-amber-600 font-medium">
              API key required
            </span>
          )}
          <button
            onClick={openAiConfigDialog}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            title="Configure API key and limits"
            aria-label="Configure API Key"
          >
            <Sliders className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Visual Limit progress bar */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full transition-all duration-300 rounded-full ${statusColor}`}
          style={{ width: `${Math.min(100, Math.max(4, highestRatio * 100))}%` }}
        />
      </div>

      {/* Warning message if close to rate limit */}
      {stats.isNearRpmLimit && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          <AlertTriangle className="size-3 shrink-0" />
          <span className="truncate">
            Pacing limit: wait a few seconds between prompts to prevent 429 errors.
          </span>
        </div>
      )}
    </div>
  );
}

export default AiLimitBar;
