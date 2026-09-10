import React from 'react';
import {
  FileText,
  ShieldCheck,
  Crown,
  Wallet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Check
} from 'lucide-react';

export function getWorkOrderStageInfo(status, paymentStatus) {
  const raw = (status || '').trim().toLowerCase();
  const isPaid = raw === 'paid' || (paymentStatus || '').toLowerCase() === 'paid';

  if (isPaid) {
    return {
      currentStep: 4,
      isCompleted: true,
      stageLabel: 'Payment Disbursed',
      stageBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
      activeStepName: 'Finance Paid',
      isRevision: false
    };
  }

  if (raw === 'approved by director' || raw === 'approved' || raw === 'active' || raw.includes('director approved')) {
    return {
      currentStep: 3, // Director complete, Finance active
      isCompleted: false,
      stageLabel: 'Ready for Finance Payment',
      stageBadgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
      activeStepName: 'Finance Disbursal',
      isRevision: false
    };
  }

  if (
    raw === 'pending director approval' ||
    raw === 'approved by procurement' ||
    raw.includes('director') ||
    raw.includes('procurement authorized')
  ) {
    return {
      currentStep: 2, // Procurement complete, Director active
      isCompleted: false,
      stageLabel: 'Awaiting Director Signoff',
      stageBadgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-300',
      activeStepName: 'Director Approval',
      isRevision: false
    };
  }

  if (raw.includes('revision')) {
    return {
      currentStep: 1,
      isCompleted: false,
      stageLabel: 'Revision Requested by Procurement',
      stageBadgeClass: 'bg-rose-50 text-rose-800 border-rose-300',
      activeStepName: 'Revisions Needed',
      isRevision: true
    };
  }

  if (raw === 'sent to procurement' || raw === 'submitted' || raw.includes('procurement')) {
    return {
      currentStep: 1, // SOW issued, Procurement active
      isCompleted: false,
      stageLabel: 'Under Procurement Review',
      stageBadgeClass: 'bg-blue-50 text-blue-800 border-blue-300',
      activeStepName: 'Procurement Verification',
      isRevision: false
    };
  }

  // Default Draft
  return {
    currentStep: 0, // Recruiter drafting
    isCompleted: false,
    stageLabel: 'Draft Work Order',
    stageBadgeClass: 'bg-gray-100 text-gray-700 border-gray-300',
    activeStepName: 'Recruiter Dispatch',
    isRevision: false
  };
}

export default function WorkOrderProgressBar({
  status = 'Draft',
  paymentStatus = '',
  variant = 'compact',
  showLabels = true,
  className = ''
}) {
  const stageInfo = getWorkOrderStageInfo(status, paymentStatus);

  const steps = [
    {
      id: 0,
      label: 'SOW Issued',
      shortLabel: 'SOW',
      actor: 'Recruiter',
      desc: 'Work Order Generated & Sent',
      icon: FileText
    },
    {
      id: 1,
      label: 'Procurement',
      shortLabel: 'Procurement',
      actor: 'Procurement Team',
      desc: 'Verified & Authorized',
      icon: ShieldCheck
    },
    {
      id: 2,
      label: 'Director',
      shortLabel: 'Director',
      actor: 'Company Director',
      desc: 'Executive Signoff',
      icon: Crown
    },
    {
      id: 3,
      label: 'Finance',
      shortLabel: 'Finance',
      actor: 'Financial AP',
      desc: 'Disbursement & Payment',
      icon: Wallet
    }
  ];

  if (variant === 'compact') {
    return (
      <div className={`w-full ${className}`}>
        {/* Header Pill & Stage indicator */}
        <div className="flex items-center justify-between gap-2 mb-2 text-[11px]">
          <span className="font-bold text-[#4B5563] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Governance Status:
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold border ${stageInfo.stageBadgeClass}`}>
            {stageInfo.stageLabel}
          </span>
        </div>

        {/* 4-Step Progress Bar Line */}
        <div className="relative flex items-center justify-between w-full pt-1 pb-1">
          {/* Background Rail */}
          <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-1 bg-[#E5E7EB] rounded-full z-0" />

          {/* Active Filled Rail */}
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 rounded-full transition-all duration-500 z-0"
            style={{
              width:
                stageInfo.currentStep === 4
                  ? 'calc(100% - 24px)'
                  : stageInfo.currentStep === 3
                  ? 'calc(75% - 12px)'
                  : stageInfo.currentStep === 2
                  ? 'calc(50% - 8px)'
                  : stageInfo.currentStep === 1
                  ? 'calc(25% - 4px)'
                  : '0%'
            }}
          />

          {/* Steps Nodes */}
          {steps.map((step, idx) => {
            const isCompleted = stageInfo.currentStep > idx || (stageInfo.currentStep === 4);
            const isCurrent = stageInfo.currentStep === idx && !stageInfo.isCompleted;
            const isUpcoming = stageInfo.currentStep < idx;

            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center group">
                <div
                  className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-black transition-all shadow-2xs ${
                    isCompleted
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-100'
                      : isCurrent
                      ? stageInfo.isRevision
                        ? 'bg-rose-500 text-white ring-4 ring-rose-100 animate-bounce'
                        : 'bg-amber-500 text-white ring-4 ring-amber-100 shadow-md'
                      : 'bg-white text-gray-400 border border-[#D1D5DB]'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-3 h-3 stroke-[3]" />
                  ) : isCurrent ? (
                    idx + 1
                  ) : (
                    idx + 1
                  )}
                </div>

                {showLabels && (
                  <span
                    className={`text-[9.5px] mt-1 font-extrabold tracking-tight transition-all ${
                      isCompleted
                        ? 'text-emerald-700'
                        : isCurrent
                        ? stageInfo.isRevision
                          ? 'text-rose-700 font-black'
                          : 'text-[#0A0A0A] font-black'
                        : 'text-gray-400'
                    }`}
                  >
                    {step.shortLabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Full / Rich Mode
  return (
    <div className={`p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs ${className}`}>
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F3F4F6]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">
            3-Stage Governance & Settlement Flow
          </div>
          <div className="text-sm font-extrabold text-[#0A0A0A] mt-0.5 flex items-center gap-2">
            <span>Current Stage:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-black border ${stageInfo.stageBadgeClass}`}>
              {stageInfo.stageLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        {steps.map((step, idx) => {
          const isCompleted = stageInfo.currentStep > idx || stageInfo.currentStep === 4;
          const isCurrent = stageInfo.currentStep === idx && !stageInfo.isCompleted;
          const StepIcon = step.icon;

          return (
            <div
              key={step.id}
              className={`p-3 rounded-xl border text-left transition-all ${
                isCompleted
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                  : isCurrent
                  ? stageInfo.isRevision
                    ? 'bg-rose-50 border-rose-300 text-rose-950 ring-2 ring-rose-200'
                    : 'bg-amber-50 border-amber-300 text-amber-950 ring-2 ring-amber-200 shadow-xs'
                  : 'bg-[#F9FAFB] border-[#E5E7EB] text-gray-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`p-1 rounded-lg ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-700'
                        : isCurrent
                        ? stageInfo.isRevision
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <StepIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-extrabold">{step.label}</span>
                </div>

                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                ) : null}
              </div>

              <div className="text-[10.5px] font-semibold opacity-90 truncate">
                {step.desc}
              </div>
              <div className="text-[9.5px] opacity-70 mt-0.5 truncate">
                {step.actor}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
