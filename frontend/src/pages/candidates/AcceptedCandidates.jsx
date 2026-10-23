import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import {
  Check, ArrowRight, AlertCircle, X, Shield, Laptop, BookOpen, CheckCircle2,
  FileText, Sparkles, Send, Upload, DollarSign, Calendar, MessageSquare, RefreshCw, Search
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

let acceptedCandidatesMemoryCache = null;

export default function AcceptedCandidates() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState(() => acceptedCandidatesMemoryCache?.candidates || []);
  const [onboardingDocs, setOnboardingDocs] = useState(() => acceptedCandidatesMemoryCache?.onboardingDocs || {});
  const [workOrders, setWorkOrders] = useState(() => acceptedCandidatesMemoryCache?.workOrders || []);
  const [issues, setIssues] = useState(() => acceptedCandidatesMemoryCache?.issues || []);
  const [loading, setLoading] = useState(() => !acceptedCandidatesMemoryCache);
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
  const loadData = async (force = false) => {
    if (!acceptedCandidatesMemoryCache || force) {
      setLoading(true);
    }
    setError('');
    try {
      const [candData, obData, issuesData, woData] = await Promise.all([
        request('/candidates?status=Accepted', { token, forceRefresh: force }),
        request('/api/onboarding', { token, forceRefresh: force }).catch(() => []),
        request('/api/onboarding/issues', { token, forceRefresh: force }).catch(() => []),
        request('/api/work-orders', { token, forceRefresh: force }).catch(() => []),
      ]);

      const candList = Array.isArray(candData) ? candData : candData?.candidates || [];
      const obList = Array.isArray(obData) ? obData : obData?.candidates || [];
      const issueList = Array.isArray(issuesData) ? issuesData : issuesData?.issues || [];
      const woList = Array.isArray(woData) ? woData : woData?.work_orders || [];

      // Create mapping by candidate id
      const obMap = {};
      obList.forEach((item) => {
        for (const value of [item.candidate_id, item.id, item.workorder_id, item.candidate_submission_id]) {
          if (!value) continue;
          const clean = String(value).replace(/^(?:SDC|BEAR)\s*-\s*/, '').trim();
          for (const alias of [String(value), clean, `SDC-${clean}`, `SDC -${clean}`, `BEAR-${clean}`]) obMap[alias] = item;
        }
      });

      const openIssues = issueList.filter((i) => i.status === 'open');

      setCandidates(candList);
      setOnboardingDocs(obMap);
      setWorkOrders(woList);
      setIssues(openIssues);

      acceptedCandidatesMemoryCache = {
        candidates: candList,
        onboardingDocs: obMap,
        workOrders: woList,
        issues: openIssues,
        token,
      };
    } catch (err) {
      console.error('Failed to load accepted candidates:', err);
      if (!acceptedCandidatesMemoryCache) {
        setError(err.message || 'Unable to load accepted candidates.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);

    const handleRefresh = () => {
      loadData(true);
    };

    window.addEventListener('refresh-hm-data', handleRefresh);
    return () => {
      window.removeEventListener('refresh-hm-data', handleRefresh);
    };
  }, [token]);

  const woMap = useMemo(() => {
    const map = {};
    workOrders.forEach((wo) => {
      const id = wo.candidate_id || wo.workorder_id || wo.id;
      if (id) {
        map[id] = wo;
        const clean = String(id).replace('SDC-', '').replace('SDC -', '').replace('BEAR-', '').replace('BEAR -', '').trim();
        map[clean] = wo;
        map[`SDC-${clean}`] = wo;
        map[`SDC -${clean}`] = wo;
        map[`BEAR-${clean}`] = wo;
      }
      if (wo.candidate_name) {
        map[wo.candidate_name.trim().toLowerCase()] = wo;
      }
    });
    return map;
  }, [workOrders]);

  const [searchQuery, setSearchQuery] = useState('');

  // Derived Real KPI Metrics
  const metrics = useMemo(() => {
    const totalAccepted = candidates.length;
    let started = 0;
    let completed = 0;
    candidates.forEach((cand) => {
      const id = cand.id || cand.candidate_id;
      const ob = id ? onboardingDocs[id] : null;
      if (ob) {
        if (ob.status === 'completed' || ob.setup_status === 'completed') {
          completed += 1;
        } else if (ob.status === 'in_progress' || ob.status === 'started') {
          started += 1;
        }
      }
    });

    return {
      accepted: totalAccepted,
      started: started,
      completed: completed,
      openIssues: issues.length,
    };
  }, [candidates, onboardingDocs, issues]);

  // Display Table Rows
  const displayRows = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase().trim();
    return candidates.filter((c) => {
      const name = (c.candidate_name || c.full_name || c.name || '').toLowerCase();
      const vendor = (c.vendor_name || '').toLowerCase();
      const role = (c.requisition_title || '').toLowerCase();
      const ref = (c.requisition_ref || '').toLowerCase();
      return name.includes(q) || vendor.includes(q) || role.includes(q) || ref.includes(q);
    });
  }, [candidates, searchQuery]);

  // Open Onboarding Setup Modal
  const handleOpenSetup = (candidate) => {
    const identifier = candidate.candidate_id || candidate.id;
    navigate(`/dashboard/candidates/onboarding?candidate=${encodeURIComponent(identifier)}`);
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
    <div
      className="w-full min-w-0 h-full flex-1 flex flex-col justify-between gap-3 text-left overflow-hidden pb-1 font-sans"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <style>{`
        .custom-cand-scroll::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-cand-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-cand-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.12);
          border-radius: 4px;
        }
        .custom-cand-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.25);
        }
      `}</style>

      {/* ── 1. MODERN TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • TALENT ACQUISITION
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Accepted Candidates & Work Orders
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1">
            Manage contract offers, review Master Services Agreements (MSAs), and track hire onboarding.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadData}
            className="px-3.5 py-1.5 rounded-xl bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 text-xs font-semibold shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/candidates/onboarding')}
            className="px-4 py-2 bg-black hover:bg-gray-900 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>Onboarding Hub</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* ── 2. TOP 4 GLASSMORHPIC METRIC CARDS ── */}
      <div className="shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">ACCEPTED</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">{metrics.accepted}</div>
        </div>
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">ONBOARDING STARTED</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight mt-1">{metrics.started}</div>
        </div>
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">ONBOARDING COMPLETE</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight mt-1">{metrics.completed}</div>
        </div>
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">OPEN ISSUES</div>
          <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 ${metrics.openIssues > 0 ? 'text-red-600' : 'text-gray-900'}`}>{metrics.openIssues}</div>
        </div>
      </div>

      {/* ── 3. NAVIGATION PILL TABS ── */}
      <div className="shrink-0 flex items-center gap-2">

        <button
          type="button"
          onClick={() => navigate('/dashboard/candidates/accepted')}
          className="px-4 py-1.5 rounded-full text-xs font-bold bg-black text-white shadow-xs transition-all cursor-pointer"
        >
          Accepted
        </button>
        <button
          type="button"
          onClick={() => navigate('/dashboard/candidates/onboarding')}
          className="px-4 py-1.5 rounded-full text-xs font-semibold bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 backdrop-blur-md shadow-3xs transition-all cursor-pointer"
        >
          Onboarding
        </button>
      </div>

      {/* ── 4. MAIN GLASSMORHPIC DATA TABLE CONTAINER ── */}
      <div className="flex-1 min-h-[360px] md:min-h-0 bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
        {/* Top Controls: Search + Count */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-black/[0.04]">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate, vendor, or role..."
              className="w-full pl-9 pr-4 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs placeholder:text-gray-400 transition-all"
            />
          </div>

          <div className="text-xs text-gray-500 font-medium">
            Showing <span className="font-bold text-gray-900">{displayRows.length}</span> accepted hires
          </div>
        </div>

        {error && (
          <div className="shrink-0 my-2.5 p-3 bg-red-50/90 border border-red-200/80 rounded-2xl text-xs text-red-700 flex items-center gap-2 shadow-2xs">
            <AlertCircle size={15} className="text-red-500 shrink-0" /> <span>{error}</span>
          </div>
        )}
        {successInfo && (
          <div className="shrink-0 my-2.5 p-3 bg-emerald-50/90 border border-emerald-200/80 rounded-2xl text-xs text-emerald-700 font-medium flex items-center gap-2 shadow-2xs">
            <Check size={15} className="text-emerald-600 shrink-0" /> <span>{successInfo}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-cand-scroll pt-2">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-black/[0.04] text-[10.5px] font-extrabold uppercase tracking-wider text-gray-400">
                <th className="py-3 pl-3 pr-3">CANDIDATE</th>
                <th className="py-3 px-3">VENDOR</th>
                <th className="py-3 px-3">REQUISITION</th>
                <th className="py-3 px-3 text-center">MATCH</th>
                <th className="py-3 px-3 text-center">WORK ORDER</th>
                <th className="py-3 px-3 text-center">ONBOARDING</th>
                <th className="py-3 pr-3 pl-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
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
                  const candCode = (String(rawId).startsWith('BEAR-') || String(rawId).startsWith('CND-'))
                    ? String(rawId)
                    : (rawId.includes('-') ? String(rawId) : `CND-${String(rawId).slice(0, 8)}`);
                  const candName = cand.candidate_name || cand.full_name || cand.name || 'Candidate';
                  const vendorName = cand.vendor_name || 'Vendor';
                  const reqRef = cand.requisition_ref || 'REQ-ACTIVE';
                  const reqTitle = cand.requisition_title || 'Contract Role';

                  const score = cand.match_score != null ? Math.round(cand.match_score) : null;
                  const obDoc = onboardingDocs[id];
                  const isCompleted = obDoc?.status === 'completed' || obDoc?.setup_status === 'completed';
                  const isConfigured = Boolean(obDoc?.software_access?.length || obDoc?.training_modules?.length);
                  const isInProgress = obDoc?.status === 'in_progress' || obDoc?.setup_status === 'in_progress' || isConfigured;

                  const wo =
                    woMap[id] ||
                    woMap[rawId] ||
                    (obDoc?.workorder_id && woMap[obDoc.workorder_id]) ||
                    (cand.workorder_id && woMap[cand.workorder_id]) ||
                    woMap[candName.trim().toLowerCase()];
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
                    <tr key={id} className="hover:bg-white/60 transition-colors">
                      <td className="py-3 pl-3 pr-3 align-middle">
                        <div className="text-xs sm:text-[13px] font-extrabold text-gray-900">{candName}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{candCode}</div>
                      </td>
                      <td className="py-3 px-3 align-middle text-xs font-medium text-gray-700">
                        {vendorName}
                      </td>
                      <td className="py-3 px-3 align-middle">
                        <div className="text-xs font-bold text-gray-900">{reqRef}</div>
                        <div className="text-[10.5px] text-gray-500 font-normal">{reqTitle}</div>
                      </td>
                      <td className="py-3 px-3 align-middle text-center font-bold text-amber-600 text-xs">
                        {score != null ? `${score}%` : '—'}
                      </td>
                      <td className="py-3 px-3 align-middle text-center">{woBadge}</td>
                      <td className="py-3 px-3 align-middle text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                            isCompleted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : isInProgress ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {isCompleted ? 'Completed' : isInProgress ? 'In progress' : 'Not set up'}
                        </span>
                      </td>
                      <td className="py-3 pr-3 pl-3 align-middle text-right space-x-1.5">
                        {wo ? (
                          <button
                            type="button"
                            onClick={() => handleOpenReviewWo(cand)}
                            className="px-2.5 py-1.5 bg-white/70 hover:bg-white text-indigo-700 hover:text-indigo-900 font-bold text-xs rounded-xl border border-indigo-200/80 shadow-3xs transition-all cursor-pointer"
                          >
                            View MSA Status
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenSetup(cand)}
                            className="px-2.5 py-1.5 bg-white/70 hover:bg-white text-gray-800 hover:text-black font-bold text-xs rounded-xl border border-white/90 shadow-3xs transition-all cursor-pointer"
                          >
                            {isCompleted || isConfigured ? 'View Onboarding' : 'Start Onboarding'}
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
