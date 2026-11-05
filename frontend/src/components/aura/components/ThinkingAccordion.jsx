import React, { useState } from "react";
import { ChevronDown, ChevronRight, Wrench, CheckCircle2, Loader2, Sparkles } from "lucide-react";

export function ThinkingAccordion({ toolCalls = [], toolResults = [] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!toolCalls || toolCalls.length === 0) return null;

  const isExecuting = toolCalls.length > toolResults.length;

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-2xs transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2 text-left hover:bg-slate-50/80 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            {isExecuting ? (
              <Loader2 className="size-3.5 animate-spin text-emerald-600" />
            ) : (
              <Wrench className="size-3.5 text-emerald-600" />
            )}
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-xs text-slate-800">
              {isExecuting ? "Executing operational tools..." : "Tool execution"}
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              {toolCalls.map((tc, idx) => (
                <span
                  key={idx}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-700 border border-slate-200/60"
                >
                  {tc.tool}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400 shrink-0 ml-2">
          {!isExecuting && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <CheckCircle2 className="size-3" />
              {toolCalls.length} completed
            </span>
          )}
          {isOpen ? (
            <ChevronDown className="size-4 text-slate-500" />
          ) : (
            <ChevronRight className="size-4 text-slate-500" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-3 space-y-2.5 animate-in fade-in duration-150">
          {toolCalls.map((tc, idx) => {
            const correspondingResult = toolResults.find((tr) => tr.callId === tc.callId);
            return (
              <div
                key={idx}
                className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-900">
                    <span className="text-slate-400 font-normal">action:</span>
                    <span>{tc.tool}</span>
                  </div>
                  {correspondingResult ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 text-[11px] font-medium">
                      <CheckCircle2 className="size-3.5" /> Successful
                    </span>
                  ) : (
                    <span className="text-amber-600 text-[11px] font-medium animate-pulse">
                      Running...
                    </span>
                  )}
                </div>

                <div className="font-mono text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 overflow-x-auto space-y-1">
                  <div>
                    <span className="text-slate-400 select-none">parameters: </span>
                    <span>{JSON.stringify(tc.arguments)}</span>
                  </div>
                  {correspondingResult && (
                    <div className="pt-1 border-t border-slate-200/50 text-slate-800">
                      <span className="text-slate-400 select-none">result_summary: </span>
                      <span>
                        {correspondingResult.result?.message ||
                          JSON.stringify(correspondingResult.result?.data || correspondingResult.result)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ThinkingAccordion;
