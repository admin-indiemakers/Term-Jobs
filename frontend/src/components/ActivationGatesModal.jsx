import React, { useEffect, useState } from 'react';
import { request } from '../api/client';
import { Shield, Check, Lock, CheckCircle2, RefreshCw, X, AlertTriangle, Sparkles } from 'lucide-react';

export default function ActivationGatesModal({ candidate, token, onClose, onSuccess }) {
  const candidateId = candidate.candidate_id || candidate.id;
  const candidateName = candidate.candidate_name || candidate.name || 'Candidate';
  const reqTitle = candidate.requisition_title || candidate.role || 'Contractor Role';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onboardingData, setOnboardingData] = useState(null);
  const [gates, setGates] = useState([]);
  const [clearingGateId, setClearingGateId] = useState(null);
  const [activating, setActivating] = useState(false);

  // Fetch onboarding details & activation gates
  const loadGates = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request(`/api/onboarding/${encodeURIComponent(candidateId)}`, { token });
      setOnboardingData(data);
      setGates(data?.activation_gates || []);
    } catch (err) {
      console.error('Failed to load activation gates:', err);
      setError(err.message || 'Unable to load verification checklist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (candidateId) loadGates();
  }, [candidateId]);

  // Clear a single gate
  const handleClearGate = async (gateId) => {
    setClearingGateId(gateId);
    setError('');
    try {
      const res = await request(`/api/onboarding/${encodeURIComponent(candidateId)}/clear-gate`, {
        method: 'POST',
        token,
        body: { gate_id: gateId },
      });
      if (res?.activation_gates) {
        setGates(res.activation_gates);
      } else {
        await loadGates();
      }
    } catch (err) {
      console.error('Failed to clear gate:', err);
      setError(err.message || 'Failed to clear verification gate.');
    } finally {
      setClearingGateId(null);
    }
  };

  // Clear all blocking gates at once
  const handleClearAllGates = async () => {
    setClearingGateId('all');
    setError('');
    try {
      const unclearedGates = gates.filter((g) => g.status !== 'cleared');
      for (const g of unclearedGates) {
        await request(`/api/onboarding/${encodeURIComponent(candidateId)}/clear-gate`, {
          method: 'POST',
          token,
          body: { gate_id: g.id },
        });
      }
      await loadGates();
    } catch (err) {
      console.error('Failed to clear all gates:', err);
      setError(err.message || 'Failed to clear all verification gates.');
    } finally {
      setClearingGateId(null);
    }
  };

  // Activate work order
  const handleActivateWorkOrder = async () => {
    setActivating(true);
    setError('');
    try {
      // Step 1: Ensure Work Order document exists
      await request('/api/workforce/work-orders', {
        method: 'POST',
        token,
        body: {
          candidate_id: candidateId,
          candidate_name: candidateName,
          requisition_title: reqTitle,
          vendor_name: candidate.vendor_name || '',
          company_name: candidate.company_name || '',
        },
      });

      // Step 2: Activate Work Order after gates are cleared
      const activateRes = await request(`/api/onboarding/${encodeURIComponent(candidateId)}/activate-work-order`, {
        method: 'POST',
        token,
      });

      const woNum =
        activateRes?.work_order_number ||
        onboardingData?.work_order_number ||
        candidate.work_order_number ||
        `WO-2026-${candidateId.replace('SDC-', '').replace('SDC -', '').slice(0, 4).toUpperCase()}`;

      if (onSuccess) onSuccess({ ...activateRes, work_order_number: woNum, candidate_id: candidateId });
      onClose();
    } catch (err) {
      console.error('Failed to activate work order:', err);
      setError(err.message || 'Failed to activate work order.');
    } finally {
      setActivating(false);
    }
  };

  // Derived metrics
  const blockingGates = gates.filter((g) => g.type === 'blocking');
  const blockingUncleared = blockingGates.filter((g) => g.status !== 'cleared');
  const blockingOpenCount = blockingUncleared.length;
  const isReadyToActivate = blockingOpenCount === 0;
  const isActivated = onboardingData?.activation_status === 'activated' || candidate?.work_order_status === 'ACTIVE';
  const effectiveWoNumber =
    onboardingData?.work_order_number ||
    candidate?.work_order_number ||
    `WO-2026-${candidateId.replace('SDC-', '').replace('SDC -', '').slice(0, 4).toUpperCase()}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#eaeae6] flex items-start justify-between bg-white">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-[1.3rem] font-bold text-[#1a1a1a]">Activation gates</h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  isActivated ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fef3c7] text-[#d97706]'
                }`}
              >
                {isActivated ? 'Work Order Activated' : 'Pending onboarding'}
              </span>
            </div>
            <div className="text-[0.82rem] font-medium text-[#70706b] flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-[#166534] bg-[#dcfce7] px-2 py-0.5 rounded-md border border-[#bbf7d0]">
                Work Order: {effectiveWoNumber}
              </span>
              <span>•</span>
              <span>{candidateName}</span>
              <span>•</span>
              <span>{reqTitle}</span>
              {onboardingData?.bill_rate && (
                <>
                  <span>•</span>
                  <span>₹{onboardingData.bill_rate}/hr</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f7f7f5] hover:bg-[#eaeae6] flex items-center justify-center text-[#70706b] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-[#fafaf8]">
          {error && error !== 'Not Found' && error !== 'Onboarding not found' && (
            <div className="p-3.5 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-[0.85rem] text-[#991b1b] font-medium flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Red Alert Banner when blocking gates are open */}
          {blockingOpenCount > 0 && !loading && (
            <div className="p-4 bg-[#fef2f2] border border-[#fee2e2] rounded-xl space-y-1">
              <div className="text-[0.92rem] font-bold text-[#991b1b] flex items-center justify-between">
                <span>{blockingOpenCount} blocking gate{blockingOpenCount > 1 ? 's' : ''} open</span>
                {clearingGateId === 'all' ? (
                  <span className="text-[0.78rem] font-normal text-[#991b1b]">Clearing all...</span>
                ) : (
                  <button
                    onClick={handleClearAllGates}
                    className="text-[0.78rem] font-semibold text-[#991b1b] underline hover:text-[#7f1d1d] flex items-center gap-1"
                  >
                    <Sparkles size={12} /> Clear all gates
                  </button>
                )}
              </div>
              <p className="text-[0.8rem] text-[#b91c1c]">
                No billable hour can be logged until these close. A timesheet arriving before activation raises a pre-onboarding work alert.
              </p>
            </div>
          )}

          {/* Checklist Card */}
          <div className="bg-white border border-[#eaeae6] rounded-xl overflow-hidden shadow-2xs">
            {loading ? (
              <div className="p-12 text-center text-[0.88rem] text-[#8a8a85] flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin" /> Loading verification checklist...
              </div>
            ) : gates.length === 0 ? (
              <div className="p-8 text-center text-[0.88rem] text-[#8a8a85]">
                No verification gates configured for this candidate.
              </div>
            ) : (
              <div className="divide-y divide-[#f0f0ec]">
                {gates.map((gate) => {
                  const isCleared = gate.status === 'cleared';
                  const isBlocking = gate.type === 'blocking';

                  return (
                    <div key={gate.id} className="p-3.5 flex items-center justify-between hover:bg-[#fafaf8] transition">
                      <div className="flex items-center gap-3">
                        {/* Dot indicator */}
                        <div className="w-2.5 h-2.5 rounded-full shrink-0 flex items-center justify-center">
                          {isCleared ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a]" />
                          ) : isBlocking ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" />
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-[#9ca3af]" />
                          )}
                        </div>

                        <div>
                          <div className="text-[0.88rem] font-bold text-[#1a1a1a]">{gate.label}</div>
                          <div className="text-[0.75rem] text-[#8a8a85]">{gate.responsible}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {isCleared ? (
                          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide bg-[#dcfce7] text-[#166534]">
                            cleared
                          </span>
                        ) : (
                          <>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                                isBlocking ? 'bg-[#fee2e2] text-[#991b1b]' : 'bg-[#f3f4f6] text-[#4b5563]'
                              }`}
                            >
                              {isBlocking ? 'blocking' : 'warn only'}
                            </span>
                            <button
                              onClick={() => handleClearGate(gate.id)}
                              disabled={clearingGateId === gate.id}
                              className="px-3 py-1 bg-white border border-[#eaeae6] hover:bg-[#f7f7f5] text-[0.78rem] font-medium text-[#1a1a1a] rounded-lg transition shadow-2xs disabled:opacity-50"
                            >
                              {clearingGateId === gate.id ? 'Clearing...' : 'Clear'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#eaeae6] bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleActivateWorkOrder}
              disabled={!isReadyToActivate || activating}
              className={`px-5 py-2.5 rounded-xl text-[0.85rem] font-bold transition flex items-center gap-2 ${
                isReadyToActivate
                  ? 'bg-[#1a1a1a] text-white hover:bg-[#262626] cursor-pointer shadow-md'
                  : 'bg-[#9ca3af] text-white cursor-not-allowed opacity-80'
              }`}
            >
              {activating ? (
                <>
                  <RefreshCw size={15} className="animate-spin" /> Activating...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Activate work order
                </>
              )}
            </button>
            {!isReadyToActivate && (
              <span className="text-[0.82rem] font-medium text-[#70706b]">
                Locked until blocking gates close
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-[0.82rem] font-medium text-[#70706b] hover:text-[#1a1a1a] transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
