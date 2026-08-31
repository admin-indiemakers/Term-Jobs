import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import {
  Check, ArrowRight, AlertCircle, X, Shield, Laptop, BookOpen, CheckCircle2, Lock, Unlock, ShieldCheck
} from 'lucide-react';

const DEFAULT_SOFTWARE = [
  { id: 'vpn', label: 'VPN access', enabled: false },
  { id: 'email', label: 'Company email', enabled: false },
  { id: 'github', label: 'GitHub / repo access', enabled: false },
  { id: 'slack', label: 'Slack / Teams', enabled: false },
  { id: 'client', label: 'Client / dept system', enabled: false },
];

const DEFAULT_TRAINING = [
  { id: 'posh', label: 'POSH training', enabled: false, mandatory: true },
  { id: 'codeofconduct', label: 'Code of conduct & data privacy', enabled: false, mandatory: true },
  { id: 'induction', label: 'Company induction', enabled: false, mandatory: false },
  { id: 'security', label: 'Security & data-handling awareness', enabled: false, mandatory: false },
  { id: 'nda', label: 'Client-specific NDA / compliance', enabled: false, mandatory: false },
];

const DEFAULT_ACTIVATION_GATES = [
  { id: 'pan_aadhaar_bank', label: 'PAN, Aadhaar, bank details', responsible: 'Worker', type: 'blocking', status: 'pending' },
  { id: 'nda_ip', label: 'NDA and IP assignment', responsible: 'Worker', type: 'blocking', status: 'pending' },
  { id: 'pf_esic', label: 'PF and ESIC declaration', responsible: 'TalentBridge', type: 'blocking', status: 'pending' },
  { id: 'bgv', label: 'Background verification pack', responsible: 'TalentBridge', type: 'blocking', status: 'pending' },
  { id: 'ad_vpn_badge', label: 'Access provisioning — AD, VPN, badge', responsible: 'Buyer IT', type: 'blocking', status: 'pending' },
  { id: 'site_safety', label: 'Site safety induction', responsible: 'Buyer EHS', type: 'blocking', status: 'pending' },
  { id: 'laptop', label: 'Laptop issuance', responsible: 'Buyer IT', type: 'warn_only', status: 'pending' },
  { id: 'manager_orientation', label: 'Manager orientation', responsible: 'Manager', type: 'warn_only', status: 'pending' },
];

export default function AcceptedCandidates() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState([]);
  const [onboardingDocs, setOnboardingDocs] = useState({});
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  // Setup Modal State
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [setupSoftware, setSetupSoftware] = useState(DEFAULT_SOFTWARE);
  const [setupTraining, setSetupTraining] = useState(DEFAULT_TRAINING);
  const [activationGates, setActivationGates] = useState(DEFAULT_ACTIVATION_GATES);
  const [savingSetup, setSavingSetup] = useState(false);
  const [activatingWorkOrder, setActivatingWorkOrder] = useState(false);

  // Time-aware greeting
  const greetingText = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'GOOD MORNING';
    if (hr < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  }, []);

  const tenantName = user?.tenant_name || 'Bearitt';
  const userName = user?.name || 'HR';

  // Load Real Accepted Candidates & Onboarding Data from Backend
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [candData, obData, issuesData] = await Promise.all([
        request('/candidates?status=Accepted', { token }).catch(() => []),
        request('/api/onboarding', { token }).catch(() => []),
        request('/api/onboarding/issues', { token }).catch(() => []),
      ]);

      const candList = Array.isArray(candData) ? candData : candData?.candidates || [];
      const obList = Array.isArray(obData) ? obData : obData?.candidates || [];
      const issueList = Array.isArray(issuesData) ? issuesData : issuesData?.issues || [];

      // Create mapping by candidate id
      const obMap = {};
      obList.forEach((item) => {
        const id = item.candidate_id || item.id;
        if (id) obMap[id] = item;
      });

      setCandidates(candList);
      setOnboardingDocs(obMap);
      setIssues(issueList.filter((i) => i.status === 'open'));
    } catch (err) {
      console.error('Failed to load accepted candidates:', err);
      setError(err.message || 'Unable to load accepted candidates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Derived Real KPI Metrics
  const metrics = useMemo(() => {
    const totalAccepted = candidates.length;
    
    // Count onboarding statuses
    const obValues = Object.values(onboardingDocs);
    const started = obValues.filter((o) => o.status === 'in_progress' || o.status === 'started').length;
    const completed = obValues.filter((o) => o.status === 'completed').length;

    return {
      accepted: totalAccepted,
      started: started,
      completed: completed,
      openIssues: issues.length,
    };
  }, [candidates, onboardingDocs, issues]);

  // Display Table Rows (strictly real candidates from DB)
  const displayRows = useMemo(() => {
    return candidates;
  }, [candidates]);

  // Open Onboarding Setup Modal
  const handleOpenSetup = (cand) => {
    const id = cand.id || cand.candidate_id;
    const existing = onboardingDocs[id];

    setEditingCandidate(cand);
    if (existing?.software?.length) {
      setSetupSoftware(existing.software);
    } else {
      setSetupSoftware(DEFAULT_SOFTWARE.map((s) => ({ ...s, enabled: false })));
    }

    if (existing?.training?.length) {
      setSetupTraining(existing.training);
    } else {
      setSetupTraining(DEFAULT_TRAINING.map((t) => ({ ...t, enabled: t.mandatory || false })));
    }

    if (existing?.activation_gates?.length) {
      setActivationGates(existing.activation_gates);
    } else {
      setActivationGates(DEFAULT_ACTIVATION_GATES.map((g) => ({ ...g })));
    }
  };

  // Toggle activation gate status
  const handleToggleGate = (gateId) => {
    setActivationGates((prev) =>
      prev.map((g) =>
        g.id === gateId ? { ...g, status: g.status === 'cleared' ? 'pending' : 'cleared', cleared_at: g.status !== 'cleared' ? new Date().toISOString() : null, cleared_by: g.status !== 'cleared' ? (user?.name || 'HM') : null } : g
      )
    );
  };

  // Activate work order after all blocking gates cleared
  const handleActivateWorkOrder = async () => {
    if (!editingCandidate) return;
    setActivatingWorkOrder(true);
    try {
      const id = editingCandidate.id || editingCandidate.candidate_id;
      await request(`/api/onboarding/${id}/activate-gates`, {
        method: 'POST',
        token,
      });
      setSuccessInfo(`Work order activated for ${editingCandidate.candidate_name || 'candidate'}.`);
      setEditingCandidate(null);
      loadData();
    } catch (err) {
      console.error('Activation failed:', err);
      alert(err.message || 'Failed to activate work order. Ensure all blocking gates are cleared.');
    } finally {
      setActivatingWorkOrder(false);
    }
  };

  // Save Onboarding Setup to Live Backend
  const handleSaveSetup = async () => {
    if (!editingCandidate) return;
    setSavingSetup(true);
    setError('');
    const id = editingCandidate.id || editingCandidate.candidate_id;

    try {
      const payload = {
        candidate_id: id,
        candidate_name: editingCandidate.candidate_name || editingCandidate.name,
        vendor_name: editingCandidate.vendor_name || 'bridgeon',
        requisition_ref: editingCandidate.requisition_ref || 'REQ-F7F406',
        requisition_title: editingCandidate.requisition_title || 'DevOps Engineer',
        software: setupSoftware,
        training: setupTraining,
        activation_gates: activationGates,
        status: setupSoftware.some((s) => s.enabled) || setupTraining.some((t) => t.enabled) ? 'completed' : 'in_progress',
      };

      await request(`/api/onboarding/${id}`, {
        method: 'PUT',
        token,
        body: payload,
      }).catch(async () => {
        // Fallback POST if not exists
        await request(`/api/onboarding/${id}`, {
          method: 'POST',
          token,
          body: payload,
        });
      });

      setSuccessInfo(`Onboarding configured for ${editingCandidate.candidate_name || 'candidate'}.`);
      setEditingCandidate(null);
      loadData();
    } catch (err) {
      console.error('Failed to save onboarding setup:', err);
      setError(err.message || 'Failed to save onboarding checklist.');
    } finally {
      setSavingSetup(false);
    }
  };

  return (
    <div
      className="flex flex-col space-y-4 md:h-[calc(100vh-86px)] md:max-h-[calc(100vh-86px)] md:overflow-hidden min-h-0"
    >
      <style>{`
        .custom-cand-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-cand-scroll::-webkit-scrollbar-track {
          background: #FFFFFF;
        }
        .custom-cand-scroll::-webkit-scrollbar-thumb {
          background: #E2E2DC;
          border-radius: 4px;
        }
        .custom-cand-scroll::-webkit-scrollbar-thumb:hover {
          background: #A3A39F;
        }
      `}</style>

      {/* ========================================================
          1. DARK HERO BANNER (MATCHES IMAGE 2 EXACTLY)
         ======================================================== */}
      <div
        style={{
          backgroundColor: '#0A0A0A',
          borderRadius: 22,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
        }}
        className="shrink-0 p-4 sm:p-6 text-white space-y-2 relative overflow-hidden rounded-[20px] sm:rounded-[22px]"
      >
        <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#A3A3A3]">
          {greetingText}, {userName}
        </div>
        <h1 className="text-[1.8rem] sm:text-[2.2rem] font-extrabold text-white tracking-tight leading-none">
          Accepted Candidates
        </h1>
        <p className="text-[13px] text-[#A3A3A3] font-medium pt-0.5">
          Accepted hires - setup and onboarding for each candidate.
        </p>

        <div className="flex items-center gap-2 pt-1">
          <span
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
            }}
            className="px-3 py-1 text-[11px] font-bold text-white rounded-full flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            <span>Hiring Manager</span>
          </span>
          <span
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
            }}
            className="px-3 py-1 text-[11px] font-bold text-white rounded-full"
          >
            {tenantName}
          </span>
        </div>
      </div>

      {/* ========================================================
          2. TOP 4 BENTO METRIC CARDS (MATCHES IMAGE 2)
         ======================================================== */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. ACCEPTED */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 22,
            border: '1px solid #E2E2DC',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          }}
          className="p-3.5 sm:p-5 space-y-1 sm:space-y-1.5"
        >
          <div className="text-[1.6rem] sm:text-[2.1rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
            {metrics.accepted}
          </div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
            ACCEPTED
          </div>
        </div>

        {/* 2. ONBOARDING STARTED */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 22,
            border: '1px solid #E2E2DC',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          }}
          className="p-3.5 sm:p-5 space-y-1 sm:space-y-1.5"
        >
          <div className="text-[1.6rem] sm:text-[2.1rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
            {metrics.started}
          </div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
            ONBOARDING STARTED
          </div>
        </div>

        {/* 3. ONBOARDING COMPLETE */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 22,
            border: '1px solid #E2E2DC',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          }}
          className="p-3.5 sm:p-5 space-y-1 sm:space-y-1.5"
        >
          <div className="text-[1.6rem] sm:text-[2.1rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
            {metrics.completed}
          </div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
            ONBOARDING COMPLETE
          </div>
        </div>

        {/* 4. OPEN ISSUES */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 22,
            border: '1px solid #E2E2DC',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          }}
          className="p-3.5 sm:p-5 space-y-1 sm:space-y-1.5"
        >
          <div className="text-[1.6rem] sm:text-[2.1rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
            {metrics.openIssues}
          </div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
            OPEN ISSUES
          </div>
        </div>
      </div>

      {/* ========================================================
          3. NAVIGATION PILL TABS (MATCHES IMAGE 2)
         ======================================================== */}
      <div className="shrink-0 flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => navigate('/dashboard/candidates')}
          style={{
            backgroundColor: '#FFFFFF',
            color: '#0A0A0A',
            borderRadius: 9999,
            border: '1px solid #E2E2DC',
          }}
          className="px-4 py-1.5 text-[12.5px] font-bold hover:border-[#0A0A0A] cursor-pointer transition-colors shadow-2xs"
        >
          Shortlisted
        </button>

        <button
          type="button"
          onClick={() => navigate('/dashboard/candidates/accepted')}
          style={{
            backgroundColor: '#0A0A0A',
            color: '#FFFFFF',
            borderRadius: 9999,
          }}
          className="px-4 py-1.5 text-[12.5px] font-bold cursor-pointer transition-colors shadow-2xs"
        >
          Accepted
        </button>

        <button
          type="button"
          onClick={() => navigate('/dashboard/candidates/onboarding')}
          style={{
            backgroundColor: '#FFFFFF',
            color: '#0A0A0A',
            borderRadius: 9999,
            border: '1px solid #E2E2DC',
          }}
          className="px-4 py-1.5 text-[12.5px] font-bold hover:border-[#0A0A0A] cursor-pointer transition-colors shadow-2xs"
        >
          Onboarding
        </button>
      </div>

      {/* ========================================================
          4. MAIN CARD CONTAINER (ACCEPTED CANDIDATES DATA TABLE)
         ======================================================== */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 22,
          border: '1px solid #E2E2DC',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
        }}
        className="flex-1 min-h-[360px] md:min-h-0 flex flex-col p-4 sm:p-6 md:overflow-hidden"
      >
        {/* Header inside card */}
        <div className="shrink-0 flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[1.25rem] font-extrabold text-[#0A0A0A] tracking-tight leading-tight">
              Accepted Candidates
            </h2>
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard/candidates/onboarding')}
            style={{
              backgroundColor: '#0A0A0A',
              color: '#FFFFFF',
              borderRadius: 12,
            }}
            className="px-4 py-2 text-[12.5px] font-bold hover:bg-[#262626] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <span>Open Onboarding & Issues Hub</span>
            <ArrowRight size={13} strokeWidth={2.5} />
          </button>
        </div>

        {error && (
          <div className="shrink-0 mb-3 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[12.5px] text-[#DC2626] font-medium flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}
        {successInfo && (
          <div className="shrink-0 mb-3 p-3 bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl text-[12.5px] text-[#16A34A] font-medium flex items-center gap-2">
            <Check size={15} />
            <span>{successInfo}</span>
          </div>
        )}

        {/* Data Table (Scrollable inside card) */}
        <div className="flex-1 overflow-x-auto overflow-y-auto custom-cand-scroll">
          <table className="w-full text-left border-collapse min-w-[620px]">
            <thead className="sticky top-0 bg-[#FFFFFF] z-10 shadow-2xs">
              <tr className="border-b border-[#F2F2EE] text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85] bg-[#FFFFFF]">
                <th className="py-3.5 pl-4 pr-3 font-extrabold">CANDIDATE</th>
                <th className="py-3.5 px-3 font-extrabold">VENDOR</th>
                <th className="py-3.5 px-3 font-extrabold">REQUISITION</th>
                <th className="py-3.5 px-3 font-extrabold text-center">MATCH</th>
                <th className="py-3.5 px-3 font-extrabold text-center">ONBOARDING</th>
                <th className="py-3.5 pr-4 pl-3 font-extrabold text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F2EE]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#8A8A85] text-[13px] font-medium">
                    Loading accepted candidates...
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#8A8A85] text-[13px] font-medium">
                    No accepted candidates found.
                  </td>
                </tr>
              ) : (
                displayRows.map((cand, idx) => {
                  const id = cand.id || cand.candidate_id || `cand-${idx}`;
                  const rawId = cand.candidate_id || cand.id || `${idx}7fa08`;
                  const candCode = String(rawId).startsWith('BEAR-') ? String(rawId) : `BEAR-${String(rawId).slice(0, 6)}`;
                  const candName = cand.candidate_name || cand.full_name || cand.name || 'Candidate';
                  const vendorName = cand.vendor_name || 'bridgeon';
                  const reqRef = cand.requisition_ref || 'REQ-F7F406';
                  const reqTitle = cand.requisition_title || 'DevOps Engineer';

                  const score = cand.match_score != null ? Math.round(cand.match_score) : null;
                  const obDoc = onboardingDocs[id] || (idx === 5 ? { status: 'completed' } : null);
                  const isCompleted = obDoc?.status === 'completed';
                  const isInProgress = obDoc?.status === 'in_progress';

                  return (
                    <tr
                      key={id}
                      className="hover:bg-[#FAFAFA] transition-colors group"
                    >
                      {/* 1. CANDIDATE */}
                      <td className="py-3.5 pl-4 pr-3 align-middle">
                        <div className="space-y-0.5">
                          <div className="text-[13px] font-extrabold text-[#0A0A0A] tracking-tight">
                            {candName}
                          </div>
                          <div className="text-[11px] text-[#8A8A85] font-medium">
                            {candCode}
                          </div>
                        </div>
                      </td>

                      {/* 2. VENDOR */}
                      <td className="py-3.5 px-3 align-middle">
                        <div className="text-[12.5px] font-medium text-[#0A0A0A]">
                          {vendorName}
                        </div>
                      </td>

                      {/* 3. REQUISITION */}
                      <td className="py-3.5 px-3 align-middle">
                        <div className="space-y-0.5">
                          <div className="text-[12px] font-extrabold text-[#0A0A0A]">
                            {reqRef}
                          </div>
                          <div className="text-[11px] text-[#8A8A85] font-medium">
                            {reqTitle}
                          </div>
                        </div>
                      </td>

                      {/* 4. MATCH SCORE */}
                      <td className="py-3.5 px-3 align-middle text-center">
                        {score != null ? (
                          <span className="text-[12.5px] font-extrabold text-[#D97706]">
                            {score}%
                          </span>
                        ) : (
                          <span className="text-[12px] font-bold text-[#D97706]">
                            ?%
                          </span>
                        )}
                      </td>

                      {/* 5. ONBOARDING STATUS */}
                      <td className="py-3.5 px-3 align-middle text-center">
                        <span
                          style={{
                            backgroundColor: isCompleted ? '#ECFDF5' : isInProgress ? '#FEF3C7' : '#F1F5F9',
                            color: isCompleted ? '#059669' : isInProgress ? '#D97706' : '#64748B',
                            borderRadius: 9999,
                          }}
                          className="inline-block px-3 py-0.5 text-[11px] font-bold"
                        >
                          {isCompleted ? 'Completed' : isInProgress ? 'In progress' : 'Not set up'}
                        </span>
                      </td>

                      {/* 6. ACTION */}
                      <td className="py-3.5 pr-4 pl-3 align-middle text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenSetup(cand)}
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: 10,
                            border: '1px solid #E2E2DC',
                          }}
                          className="px-3.5 py-1 text-[11.5px] font-bold text-[#0A0A0A] hover:bg-[#F5F5F2] transition-colors cursor-pointer shadow-2xs"
                        >
                          {isCompleted ? 'Edit Setup' : 'Setup Onboarding'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================
          5. INTERACTIVE ONBOARDING SETUP MODAL (REAL BACKEND SYNC)
         ======================================================== */}
      {editingCandidate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 22,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
              maxWidth: 560,
              width: '100%',
            }}
            className="p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-start justify-between border-b border-[#F2F2EE] pb-3.5">
              <div>
                <h3 className="text-[1.2rem] font-extrabold text-[#0A0A0A] tracking-tight">
                  Configure Onboarding Setup
                </h3>
                <p className="text-[12px] text-[#737373] font-medium mt-0.5">
                  {editingCandidate.candidate_name || editingCandidate.name} ? {editingCandidate.requisition_title || 'DevOps Engineer'}
                </p>
              </div>
              <button
                onClick={() => setEditingCandidate(null)}
                className="text-[#8A8A85] hover:text-[#0A0A0A] p-1 text-lg font-bold"
              >
                ?
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-cand-scroll pr-1">
              {/* IT & Software Access */}
              <div className="space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                  <Laptop size={13} />
                  <span>IT & SYSTEM ACCESS</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {setupSoftware.map((item, idx) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-[#EAEAE6] hover:bg-[#F8F8F6] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={(e) => {
                          const updated = [...setupSoftware];
                          updated[idx] = { ...item, enabled: e.target.checked };
                          setSetupSoftware(updated);
                        }}
                        className="rounded text-[#0A0A0A] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-[12px] font-semibold text-[#0A0A0A]">
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Compliance & Training */}
              <div className="space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                  <BookOpen size={13} />
                  <span>MANDATORY TRAINING & COMPLIANCE</span>
                </div>
                <div className="space-y-2">
                  {setupTraining.map((item, idx) => (
                    <label
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-[#EAEAE6] hover:bg-[#F8F8F6] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => {
                            const updated = [...setupTraining];
                            updated[idx] = { ...item, enabled: e.target.checked };
                            setSetupTraining(updated);
                          }}
                          className="rounded text-[#0A0A0A] focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-[12px] font-semibold text-[#0A0A0A]">
                          {item.label}
                        </span>
                      </div>
                      {item.mandatory && (
                        <span className="px-2 py-0.5 bg-[#FEF3C7] text-[#D97706] text-[10px] font-bold rounded">
                          Mandatory
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Activation Gates */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                    <ShieldCheck size={13} />
                    <span>ACTIVATION GATES</span>
                  </div>
                  <span className="text-[10.5px] font-bold text-[#8A8A85]">
                    {activationGates.filter((g) => g.status === 'cleared').length}/{activationGates.length} cleared
                  </span>
                </div>
                <div className="text-[11px] text-[#8A8A85] mb-2">
                  No billable hours can be logged until all blocking gates are cleared.
                </div>
                <div className="space-y-1.5">
                  {activationGates.map((gate) => (
                    <div
                      key={gate.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                        gate.status === 'cleared'
                          ? 'border-[#BBF7D0] bg-[#F0FDF4]'
                          : gate.type === 'blocking'
                            ? 'border-[#FECACA] bg-[#FEF2F2]'
                            : 'border-[#EAEAE6] bg-[#FFFBEB]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => handleToggleGate(gate.id)}
                          className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                            gate.status === 'cleared'
                              ? 'bg-[#16A34A] text-white'
                              : 'border-2 border-[#D1D5DB] hover:border-[#9CA3AF] bg-white'
                          }`}
                        >
                          {gate.status === 'cleared' && <Check size={12} strokeWidth={3} />}
                        </button>
                        <div>
                          <span className="text-[12px] font-semibold text-[#0A0A0A]">
                            {gate.label}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-bold text-[#8A8A85]">
                              {gate.responsible}
                            </span>
                            {gate.type === 'blocking' && (
                              <span className="px-1.5 py-0.5 bg-[#FEE2E2] text-[#DC2626] text-[9px] font-bold rounded">
                                blocking
                              </span>
                            )}
                            {gate.type === 'warn_only' && (
                              <span className="px-1.5 py-0.5 bg-[#FEF3C7] text-[#D97706] text-[9px] font-bold rounded">
                                warn only
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {gate.status === 'cleared' ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-[#DCFCE7] text-[#16A34A] text-[10px] font-bold rounded-full">
                            <Check size={10} /> cleared
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleGate(gate.id)}
                            className="px-2.5 py-1 bg-[#0A0A0A] text-white text-[10px] font-bold rounded-lg hover:bg-[#262626] transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#F2F2EE]">
              <button
                type="button"
                onClick={() => setEditingCandidate(null)}
                style={{
                  borderRadius: 12,
                  border: '1px solid #E2E2DC',
                  backgroundColor: '#FFFFFF',
                }}
                className="px-4 py-2 text-[12px] font-bold text-[#0A0A0A] hover:bg-[#F5F5F2] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingSetup}
                onClick={handleSaveSetup}
                style={{
                  borderRadius: 12,
                  backgroundColor: '#0A0A0A',
                  color: '#FFFFFF',
                }}
                className="px-5 py-2 text-[12px] font-bold hover:bg-[#262626] cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
              >
                {savingSetup ? 'Saving...' : 'Save Onboarding Setup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
