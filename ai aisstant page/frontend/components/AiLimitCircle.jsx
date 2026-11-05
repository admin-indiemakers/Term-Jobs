import React, { useState } from "react";
import { useUserAiConfig, openAiConfigDialog } from "../hooks/useUserAiConfig";

/**
 * AI Limit Circular Gauge Indicator with Dual-Limit Tooltip on Hover.
 * Exact 1:1 match to NEXUS AiLimitCircle component.
 */
export function AiLimitCircle({ className = "" }) {
  const { stats, isConnected } = useUserAiConfig();
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const rpmRatio = stats.rpmCount / Math.max(1, stats.rpmLimit);
  const dailyRatio = stats.dailyCount / Math.max(1, stats.dailyLimit);
  const highestRatio = Math.max(rpmRatio, dailyRatio);

  const statusStroke =
    highestRatio >= 0.85
      ? "stroke-rose-500"
      : highestRatio >= 0.6
      ? "stroke-amber-500"
      : "stroke-emerald-500";

  const statusBg =
    highestRatio >= 0.85
      ? "bg-rose-500"
      : highestRatio >= 0.6
      ? "bg-amber-500"
      : "bg-emerald-500";

  // Radius 6.5 -> Circumference ~40.84
  const radius = 6.5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - Math.min(1, Math.max(0, dailyRatio)) * circumference;

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setTooltipOpen(true)}
      onMouseLeave={() => setTooltipOpen(false)}
    >
      <button
        type="button"
        onClick={openAiConfigDialog}
        className="group relative size-7 rounded-full flex items-center justify-center hover:bg-[#F0F0F0]/80 transition-all cursor-pointer focus:outline-none"
        aria-label="View AI usage and limits"
        title="View AI usage and limits"
      >
        {/* SVG Circular Ring Gauge */}
        <svg className="size-5 -rotate-90" viewBox="0 0 18 18">
          <circle
            cx="9"
            cy="9"
            r={radius}
            className="stroke-[#E2E4E8] fill-none"
            strokeWidth="1.8"
          />
          <circle
            cx="9"
            cy="9"
            r={radius}
            className={`fill-none transition-all duration-300 ${statusStroke}`}
            strokeWidth="1.8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>

        {/* Inner Center Status Dot */}
        <span
          className={`absolute size-1.5 rounded-full transition-transform duration-200 group-hover:scale-125 ${statusBg}`}
        />
      </button>

      {/* Floating Tooltip matching NEXUS design */}
      {tooltipOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-white text-[#111111] border border-[#EAEAEA] shadow-xl rounded-xl z-50 text-left select-none animate-in fade-in duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F0F0F0]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`size-2 rounded-full shrink-0 ${statusBg}`} />
              <span className="font-semibold text-xs text-[#111111] truncate">
                {stats.model.name}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#777777] bg-[#F5F5F5] px-1.5 py-0.5 rounded">
              Limits
            </span>
          </div>

          {/* Both Limits */}
          <div className="space-y-2.5">
            {/* 1. Rate Limit (Rolling 60s / RPM) */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-[#666666] font-medium">Rate Limit (60s)</span>
                <span className="font-semibold text-[#111111]">
                  {stats.rpmCount}{" "}
                  <span className="font-normal text-[#888888]">
                    / {stats.rpmLimit} RPM
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#F0F0F0] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    rpmRatio >= 0.85
                      ? "bg-rose-500"
                      : rpmRatio >= 0.6
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(rpmRatio > 0 ? 6 : 0, rpmRatio * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* 2. Daily Limit / Quota */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-[#666666] font-medium">Daily Limit</span>
                <span className="font-semibold text-[#111111]">
                  {stats.dailyCount}{" "}
                  <span className="font-normal text-[#888888]">
                    / {stats.dailyLimit} Day
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#F0F0F0] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    dailyRatio >= 0.85
                      ? "bg-rose-500"
                      : dailyRatio >= 0.6
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(dailyRatio > 0 ? 6 : 0, dailyRatio * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            onClick={openAiConfigDialog}
            className="mt-2.5 pt-2 border-t border-[#F0F0F0] flex items-center justify-between text-[10px] text-[#888888] cursor-pointer hover:text-[#111111]"
          >
            <span>Click to configure limits</span>
            <span className="text-emerald-600 font-medium">Configure →</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default AiLimitCircle;
