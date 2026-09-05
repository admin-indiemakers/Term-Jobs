import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import {
  Check, ArrowRight, AlertCircle, X, Shield, Laptop, BookOpen, CheckCircle2,
  FileText, Sparkles, Send, Upload, DollarSign, Calendar, MessageSquare
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

export default function AcceptedCandidates() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState([]);
  const [onboardingDocs, setOnboardingDocs] = useState({});
  const [workOrders, setWorkOrders] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  // Setup Modal State
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [setupSoftware, setSetupSoftware] = useState(DEFAULT_SOFTWARE);
  const [setupTraining, setSetupTraining] = useState(DEFAULT_TRAINING);
  const [savingSetup, setSavingSetup] = useState(false);

  // Work Order Review Modal State
  const [reviewingWo, setReviewingWo] = useState(null);
  const [reviewCandidate, setReviewCandidate] = useState(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [esignFile, setEsignFile] = useState(null);

  // Time-aware greeting
  const greetingText = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'GOOD MORNING';
    if (hr < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  }, []);

  const tenantName = user?.tenant_name || 'Bearitt';
  const userName = user?.name || 'HR';

  // Load Real Accepted Candidates, Onboarding Data & Work Orders
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [candData, obData, issuesData, woData] = await Promise.all([
        request('/candidates?status=Accepted', { token }).catch(() => []),
        request('/api/onboarding', { token }).catch(() => []),
        request('/api/onboarding/issues', { token }).catch(() => []),
        request('/api/work-orders', { token }).catch(() => []),
      ]);

      const candList = Array.isArray(candData) ? candData : candData?.candidates || [];
      const obList = Array.isArray(obData) ? obData : obData?.candidates || [];
      const issueList = Array.isArray(issuesData) ? issuesData : issuesData?.issues || [];
      const woList = Array.isArray(woData) ? woData : woData?.work_orders || [];

      // Create mapping by candidate id
      const obMap = {};
      obList.forEach((item) => {
        const id = item.candidate_id || item.id;
        if (id) obMap[id] = item;
      });

      setCandidates(candList);
      setOnboardingDocs(obMap);
      setWorkOrders(woList);
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

  const woMap = useMemo(() => {
    const map = {};
    workOrders.forEach((wo) => {
      if (wo.candidate_id) map[wo.candidate_id] = wo;
    });
    return map;
  }, [workOrders]);

  // Derived Real KPI Metrics
  const metrics = useMemo(() => {
    const totalAccepted = candidates.length;
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

  // Display Table Rows
  const displayRows = useMemo(() => {
    return candidates;
  }, [candidates]);

  // Open Onboarding Setup Modal
  const handleOpenSetup = (cand) => {
    const id = cand.id || cand.candidate_id;
    const existing = onboardingDocs[id];

    setEditingCandidate(cand);
    if (existing?.software_access?.length) {
      setSetupSoftware(existing.software_access);
    } else {
      setSetupSoftware(DEFAULT_SOFTWARE.map((s) => ({ ...s, enabled: false })));
    }

    if (existing?.training_modules?.length) {
      setSetupTraining(existing.training_modules);
    } else {
      setSetupTraining(DEFAULT_TRAINING.map((t) => ({ ...t, enabled: t.mandatory || false })));
    }
  };

  // Save Onboarding Setup
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
        software_access: setupSoftware,
        training_modules: setupTraining,
        status: setupSoftware.some((s) => s.enabled) || setupTraining.some((t) => t.enabled) ? 'completed' : 'in_progress',
      };

      await request(`/api/onboarding/${id}`, {
        token,
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSuccessInfo(`Onboarding setup saved for ${payload.candidate_name}!`);
      setEditingCandidate(null);
      loadData();
    } catch (err) {
      console.error('Failed to save onboarding setup:', err);
      setError(err.message || 'Failed to save setup.');
    } finally {
      setSavingSetup(false);
    }
  };

  // Open Work Order Review Modal for Client HM/HR
  const handleOpenReviewWo = (cand) => {
    const id = cand.id || cand.candidate_id;
    const wo = woMap[id];
    setReviewCandidate(cand);
    setReviewingWo(wo || null);
    setShowRevisionInput(false);
    setRevisionNotes('');
    setEsignFile(null);
  };

  // Approve Work Order (Click-to-Approve or Optional E-sign PDF upload)
  const handleApproveWo = async () => {
    if (!reviewingWo) return;
    setActionLoading(true);
    setError('');

    try {
      // Optional E-sign upload if provided
      if (esignFile) {
        const fileForm = new FormData();
        fileForm.append('file', esignFile);
        await fetch(`/api/work-orders/${reviewingWo.id}/upload-esign`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fileForm,
        });
      }

      await request(`/api/work-orders/${reviewingWo.id}/approve`, {
        token,
        method: 'POST',
        body: JSON.stringify({
          approved_by: user?.name || 'Hiring Manager',
          approval_type: esignFile ? 'esign_upload' : 'click_to_approve',
        }),
      });

      setSuccessInfo(`Work Order approved for ${reviewingWo.candidate_name}!`);
      setReviewingWo(null);
      setReviewCandidate(null);
      loadData();
    } catch (err) {
      console.error('Failed to approve Work Order:', err);
      setError(err.message || 'Failed to approve Work Order.');
    } finally {
      setActionLoading(false);
    }
  };

  // Request Revision for Work Order
  const handleRequestRevision = async () => {
    if (!reviewingWo || !revisionNotes.trim()) return;
    setActionLoading(true);
    setError('');

    try {
      await request(`/api/work-orders/${reviewingWo.id}/request-revision`, {
        token,
        method: 'POST',
        body: JSON.stringify({
          reviewer: user?.name || 'Hiring Manager',
          revision_notes: revisionNotes.trim(),
        }),
      });

      setSuccessInfo('Revision feedback sent back to vendor!');
      setReviewingWo(null);
      setReviewCandidate(null);
      loadData();
    } catch (err) {
      console.error('Failed to request revision:', err);
      setError(err.message || 'Failed to submit revision feedback.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto space-y-6 font-sans">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
            {greetingText}, {userName.toUpperCase()} • {tenantName.toUpperCase()}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0A0A0A] tracking-tight">
            Accepted Candidates & Work Orders
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard/candidates/onboarding')}
          className="px-4 py-2 bg-[#0A0A0A] hover:bg-[#262626] text-white text-[12.5px] font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs self-start sm:self-auto border-none"
        >
          <span>Onboarding Hub</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* 2. KPI METRICS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-[#E2E2DC] p-4 space-y-1 shadow-2xs">
          <div className="text-2xl font-extrabold text-[#0A0A0A]">{metrics.accepted}</div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">ACCEPTED</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2E2DC] p-4 space-y-1 shadow-2xs">
          <div className="text-2xl font-extrabold text-[#0A0A0A]">{metrics.started}</div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">ONBOARDING STARTED</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2E2DC] p-4 space-y-1 shadow-2xs">
          <div className="text-2xl font-extrabold text-[#0A0A0A]">{metrics.completed}</div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">ONBOARDING COMPLETE</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2E2DC] p-4 space-y-1 shadow-2xs">
          <div className="text-2xl font-extrabold text-[#0A0A0A]">{metrics.openIssues}</div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">OPEN ISSUES</div>
        </div>
      </div>

      {/* 3. NAVIGATION PILL TABS */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => navigate('/dashboard/candidates')}
          className="px-4 py-1.5 bg-white text-[#0A0A0A] border border-[#E2E2DC] rounded-full text-[12.5px] font-bold hover:border-[#0A0A0A] cursor-pointer transition-colors shadow-2xs"
        >
          Shortlisted
        </button>
        <button
          type="button"
          onClick={() => navigate('/dashboard/candidates/accepted')}
          className="px-4 py-1.5 bg-[#0A0A0A] text-white rounded-full text-[12.5px] font-bold cursor-pointer transition-colors shadow-2xs border-none"
        >
          Accepted
        </button>
        <button
          type="button"
          onClick={() => navigate('/dashboard/candidates/onboarding')}
          className="px-4 py-1.5 bg-white text-[#0A0A0A] border border-[#E2E2DC] rounded-full text-[12.5px] font-bold hover:border-[#0A0A0A] cursor-pointer transition-colors shadow-2xs"
        >
          Onboarding
        </button>
      </div>

      {/* 4. MAIN DATA TABLE */}
      <div className="bg-white rounded-2xl border border-[#E2E2DC] shadow-2xs p-4 sm:p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-[#0A0A0A]">Accepted Candidates & Work Orders</h2>
        </div>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
            <AlertCircle size={15} /> <span>{error}</span>
          </div>
        )}
        {successInfo && (
          <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium flex items-center gap-2">
            <Check size={15} /> <span>{successInfo}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-[#F2F2EE] text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
                <th className="py-3.5 pl-4 pr-3">CANDIDATE</th>
                <th className="py-3.5 px-3">VENDOR</th>
                <th className="py-3.5 px-3">REQUISITION</th>
                <th className="py-3.5 px-3 text-center">MATCH</th>
                <th className="py-3.5 px-3 text-center">WORK ORDER</th>
                <th className="py-3.5 px-3 text-center">ONBOARDING</th>
                <th className="py-3.5 pr-4 pl-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F2EE]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#8A8A85] text-xs font-medium">
                    Loading accepted candidates...
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#8A8A85] text-xs font-medium">
                    No accepted candidates found.
                  </td>
                </tr>
              ) : (
                displayRows.map((cand, idx) => {
                  const id = cand.id || cand.candidate_id || `cand-${idx}`;
                  const rawId = cand.candidate_id || cand.id || `${idx}7fa08`;
                  const candCode = String(rawId).startsWith('BEAR-') ? String(rawId) : `BEAR-${String(rawId).slice(0, 6)}`;
                  const candName = cand.candidate_name || cand.full_name || cand.name || 'Candidate';
                  const vendorName = cand.vendor_name || 'Vendor';
                  const reqRef = cand.requisition_ref || 'REQ-ACTIVE';
                  const reqTitle = cand.requisition_title || 'Contract Role';

                  const score = cand.match_score != null ? Math.round(cand.match_score) : null;
                  const obDoc = onboardingDocs[id];
                  const isCompleted = obDoc?.status === 'completed';
                  const isInProgress = obDoc?.status === 'in_progress';

                  const wo = woMap[id];
                  let woBadge = (
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold">
                      Pending Vendor MSA
                    </span>
                  );
                  if (wo?.status === 'Submitted') {
                    woBadge = (
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[11px] font-bold border border-blue-200">
                        Pending Director Approval
                      </span>
                    );
                  } else if (wo?.status === 'Approved') {
                    woBadge = (
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-bold border border-emerald-200">
                        MSA Approved by Director ({wo.approved_by || 'Director'}) ✓
                      </span>
                    );
                  } else if (wo?.status === 'Revision Requested') {
                    woBadge = (
                      <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 rounded-full text-[11px] font-bold border border-rose-200">
                        Revision Requested by Director
                      </span>
                    );
                  }

                  return (
                    <tr key={id} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="py-3.5 pl-4 pr-3 align-middle">
                        <div className="text-[13px] font-extrabold text-[#0A0A0A]">{candName}</div>
                        <div className="text-[11px] text-[#8A8A85] font-medium">{candCode}</div>
                      </td>
                      <td className="py-3.5 px-3 align-middle text-[12.5px] font-medium text-[#0A0A0A]">
                        {vendorName}
                      </td>
                      <td className="py-3.5 px-3 align-middle">
                        <div className="text-[12px] font-extrabold text-[#0A0A0A]">{reqRef}</div>
                        <div className="text-[11px] text-[#8A8A85] font-medium">{reqTitle}</div>
                      </td>
                      <td className="py-3.5 px-3 align-middle text-center font-bold text-[#D97706] text-xs">
                        {score != null ? `${score}%` : '?%'}
                      </td>
                      <td className="py-3.5 px-3 align-middle text-center">{woBadge}</td>
                      <td className="py-3.5 px-3 align-middle text-center">
                        <span
                          className={`inline-block px-3 py-0.5 text-[11px] font-bold rounded-full ${
                            isCompleted ? 'bg-emerald-50 text-emerald-700' : isInProgress ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isCompleted ? 'Completed' : isInProgress ? 'In progress' : 'Not set up'}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 pl-3 align-middle text-right space-x-2">
                        {wo ? (
                          <button
                            type="button"
                            onClick={() => handleOpenReviewWo(cand)}
                            className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11.5px] rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                          >
                            View MSA Approval Status
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenSetup(cand)}
                            className="px-3 py-1 bg-white hover:bg-[#F5F5F2] text-[#0A0A0A] font-bold text-[11.5px] rounded-lg border border-[#E2E2DC] transition-colors cursor-pointer"
                          >
                            {isCompleted ? 'Edit Setup' : 'Setup Onboarding'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MASTER SERVICES AGREEMENT (MSA) APPROVAL STATUS REVIEW MODAL */}
      {reviewCandidate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 animate-in fade-in duration-200 relative text-left">
            <button
              onClick={() => setReviewCandidate(null)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 bg-slate-100 p-2 rounded-full border-none cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <FileText size={24} />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Master Services Agreement (MSA) Status</h2>
                <p className="text-xs text-slate-500">
                  Candidate: <strong className="text-slate-800">{reviewCandidate.candidate_name || reviewCandidate.name}</strong> ({reviewCandidate.requisition_title})
                </p>
              </div>
            </div>

            {reviewingWo ? (
              <div className="space-y-5">
                {/* Executive Approval Badge Summary Banner */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                  reviewingWo.status === 'Approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                  reviewingWo.status === 'Revision Requested' ? 'bg-rose-50 border-rose-200 text-rose-900' :
                  'bg-blue-50 border-blue-200 text-blue-900'
                }`}>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider">Director Governance Approval Status</div>
                    <div className="text-base font-extrabold mt-0.5">
                      {reviewingWo.status === 'Approved' ? `Approved by Director (${reviewingWo.approved_by || 'Executive'}) ✓` :
                       reviewingWo.status === 'Revision Requested' ? 'Revision Requested by Director ⚠️' :
                       'Pending Director Review & Approval ⏳'}
                    </div>
                  </div>
                  {reviewingWo.approved_at && (
                    <div className="text-right text-xs font-semibold shrink-0">
                      Approved: {new Date(reviewingWo.approved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                </div>

                {/* Director Revision Feedback if any */}
                {reviewingWo.status === 'Revision Requested' && reviewingWo.revision_notes && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-relaxed">
                    <strong className="font-bold text-rose-950 block mb-1">⚠️ Director Revision Feedback:</strong>
                    "{reviewingWo.revision_notes}"
                  </div>
                )}

                {/* AI Reasoning Banner if available */}
                {reviewingWo.ai_reasoning && (
                  <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
                    <strong className="font-bold text-indigo-950 block mb-1">🤖 AI Derivation Reasoning:</strong>
                    {reviewingWo.ai_reasoning}
                  </div>
                )}

                {/* Key Commercial Metrics Card */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <div className="text-[10.5px] font-bold uppercase text-slate-400">Agreed Billing Rate</div>
                    <div className="text-base font-extrabold text-indigo-600">
                      ₹{Number(reviewingWo.billing_rate || 0).toLocaleString()}/{reviewingWo.rate_type || 'month'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] font-bold uppercase text-slate-400">Vendor Rate Floor / Cap</div>
                    <div className="text-xs font-semibold text-slate-700">
                      ₹{Number(reviewingWo.vendor_visible_floor || 0).toLocaleString()} - ₹{Number(reviewingWo.vendor_visible_cap || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] font-bold uppercase text-slate-400">Contract Timeline</div>
                    <div className="text-xs font-semibold text-slate-700">
                      {reviewingWo.start_date || 'TBD'} to {reviewingWo.end_date || 'TBD'}
                    </div>
                  </div>
                </div>

                {/* Scope of Services */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-500 mb-1">Scope of Services & Deliverables</h4>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap">
                    {reviewingWo.scope_of_work || 'Standard deliverables as per role JD.'}
                  </div>
                </div>

                {/* Special Terms */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-500 mb-1">Special Master Services Terms & Clauses</h4>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap">
                    {reviewingWo.special_terms || 'Standard NET 30 payment terms.'}
                  </div>
                </div>

                {/* Optional E-Sign File Attachment */}
                {reviewingWo.esign_document_url && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                    <span className="font-semibold">📎 Signed MSA Document: {reviewingWo.esign_filename || 'MSA_Signed.pdf'}</span>
                    <a href={reviewingWo.esign_document_url} target="_blank" rel="noreferrer" className="text-emerald-700 font-bold underline">
                      View Signed PDF
                    </a>
                  </div>
                )}

                {/* Close button */}
                <div className="flex justify-end pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setReviewCandidate(null)}
                    className="px-5 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl cursor-pointer border-none"
                  >
                    Close Status View
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-sm">
                No Master Services Agreement submitted by vendor yet for this candidate.
              </div>
            )}
          </div>
        </div>
      )}

      {/* INTERACTIVE ONBOARDING SETUP MODAL */}
      {editingCandidate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-[#F2F2EE] pb-4">
              <div>
                <h3 className="text-base font-extrabold text-[#0A0A0A]">Setup Candidate Onboarding</h3>
                <p className="text-[11.5px] text-[#8A8A85] font-medium">
                  {editingCandidate.candidate_name || editingCandidate.name} ({editingCandidate.requisition_title || 'Role'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCandidate(null)}
                className="p-1 rounded-full text-[#8A8A85] hover:text-[#0A0A0A] hover:bg-[#F5F5F2] cursor-pointer border-none bg-transparent"
              >
                <X size={18} />
              </button>
            </div>

            {/* Software Access */}
            <div className="space-y-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                <Laptop size={14} className="text-[#0A0A0A]" />
                <span>Software & System Access</span>
              </div>
              <div className="space-y-1.5">
                {setupSoftware.map((item, idx) => (
                  <label key={item.id} className="flex items-center justify-between p-2.5 rounded-xl border border-[#E2E2DC] bg-[#FFFFFF] hover:bg-[#FAFAFA] cursor-pointer text-xs">
                    <span className="font-semibold text-[#0A0A0A]">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => {
                        const copy = [...setupSoftware];
                        copy[idx].enabled = e.target.checked;
                        setSetupSoftware(copy);
                      }}
                      className="w-4 h-4 accent-[#0A0A0A] cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Training Modules */}
            <div className="space-y-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                <BookOpen size={14} className="text-[#0A0A0A]" />
                <span>Training & Compliance Modules</span>
              </div>
              <div className="space-y-1.5">
                {setupTraining.map((item, idx) => (
                  <label key={item.id} className="flex items-center justify-between p-2.5 rounded-xl border border-[#E2E2DC] bg-[#FFFFFF] hover:bg-[#FAFAFA] cursor-pointer text-xs">
                    <span className="font-semibold text-[#0A0A0A]">
                      {item.label} {item.mandatory && <span className="text-[#DC2626] font-bold">*</span>}
                    </span>
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => {
                        const copy = [...setupTraining];
                        copy[idx].enabled = e.target.checked;
                        setSetupTraining(copy);
                      }}
                      className="w-4 h-4 accent-[#0A0A0A] cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Save Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-[#F2F2EE] pt-4">
              <button
                type="button"
                onClick={() => setEditingCandidate(null)}
                className="px-4 py-2 text-[12px] font-bold text-[#0A0A0A] bg-white border border-[#E2E2DC] rounded-xl hover:bg-[#F5F5F2] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSetup}
                disabled={savingSetup}
                className="px-5 py-2 text-[12px] font-bold text-white bg-[#0A0A0A] hover:bg-[#262626] rounded-xl cursor-pointer border-none disabled:opacity-50"
              >
                {savingSetup ? 'Saving...' : 'Save & Publish Setup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
