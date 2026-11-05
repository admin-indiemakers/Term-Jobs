import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle, ShieldAlert, Clock, ArrowRight } from "lucide-react";

export function ProposalConfirmationGate({
  card,
  onConfirm,
  onReject
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectPromptOpen, setRejectPromptOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const isPending = card.status === "PENDING";
  const isExecuted = card.status === "EXECUTED";
  const isRejected = card.status === "REJECTED";

  const handleConfirm = async () => {
    setIsSubmitting(true);
    await onConfirm(card.proposalId);
    setIsSubmitting(false);
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    await onReject(card.proposalId, rejectionReason || "Cancelled by user");
    setIsSubmitting(false);
    setRejectPromptOpen(false);
  };

  return (
    <div className="my-3 rounded-xl border border-amber-300 bg-amber-50/70 p-4 shadow-sm transition-all duration-200">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-amber-900">
              Confirmation Required: {formatActionName(card.tool)}
            </h4>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              isPending ? "bg-amber-200 text-amber-800" :
              isExecuted ? "bg-emerald-100 text-emerald-800" :
              "bg-rose-100 text-rose-800"
            }`}>
              {isPending && <Clock className="h-3 w-3" />}
              {isExecuted && <CheckCircle2 className="h-3 w-3" />}
              {isRejected && <XCircle className="h-3 w-3" />}
              {card.status}
            </span>
          </div>

          <p className="mt-1 text-xs text-amber-800">
            This is a state-changing operation that impacts production records or external parties. Please verify parameters before executing:
          </p>

          {/* Parameters Inspection */}
          <div className="mt-3 rounded-lg border border-amber-200/80 bg-white/90 p-3 font-mono text-xs text-slate-800">
            {Object.entries(card.parameters || {}).map(([key, val]) => (
              <div key={key} className="flex justify-between py-0.5 border-b border-slate-100 last:border-none">
                <span className="font-semibold text-slate-500">{key}:</span>
                <span className="font-medium text-slate-900 truncate max-w-[280px]">
                  {typeof val === "object" ? JSON.stringify(val) : String(val)}
                </span>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          {isPending && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isSubmitting ? "Executing..." : "Confirm & Execute"}
              </button>

              <button
                onClick={() => setRejectPromptOpen(true)}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 active:scale-95 disabled:opacity-50 transition"
              >
                <XCircle className="h-4 w-4 text-rose-500" />
                Cancel Action
              </button>
            </div>
          )}

          {/* Rejection Input Modal / Expansion */}
          {rejectPromptOpen && isPending && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/50 p-2.5">
              <label className="block text-xs font-medium text-rose-900">
                Mandatory Reason for Cancellation:
              </label>
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Schedule conflict, incorrect rate, etc."
                className="mt-1 w-full rounded border border-rose-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => setRejectPromptOpen(false)}
                  className="rounded px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-white"
                >
                  Back
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectionReason.trim() || isSubmitting}
                  className="rounded bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          )}

          {/* Executed Success Message */}
          {isExecuted && (
            <div className="mt-2 text-xs font-medium text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Operation executed and verified in database audit trail.
            </div>
          )}

          {/* Rejected Message */}
          {isRejected && (
            <div className="mt-2 text-xs font-medium text-rose-800 flex items-center gap-1">
              <XCircle className="h-4 w-4 text-rose-600" />
              Operation aborted: {card.rejectionReason || "Cancelled by user"}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatActionName(action) {
  if (!action) return "Operation";
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
