import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import {
  Flag, Check, ArrowRight, AlertCircle, Laptop, BookOpen, CheckCircle2, RefreshCw,
  FileText, Plus, ExternalLink, Shield, Lock, Unlock, X, LogOut, Clock, Mail, Key, Search
} from 'lucide-react';
import ActivationGatesModal from '../../components/ActivationGatesModal';

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

export default function OnboardingManagement() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState([]);
  const [onboardingDocs, setOnboardingDocs] = useState({});
  const [workOrders, setWorkOrders] = useState({});
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');
  const [creatingWO, setCreatingWO] = useState('');
  const [sendingCredsId, setSendingCredsId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Setup Modal State
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [setupSoftware, setSetupSoftware] = useState(DEFAULT_SOFTWARE);
  const [setupTraining, setSetupTraining] = useState(DEFAULT_TRAINING);
  const [savingSetup, setSavingSetup] = useState(false);

  // Issues Hub Modal State
  const [showIssuesModal, setShowIssuesModal] = useState(false);
  const [resolvingId, setResolvingId] = useState('');

  // Activation Gates Modal State
  const [showGatesModal, setShowGatesModal] = useState(null);
  const [clearingGate, setClearingGate] = useState('');

  // Offboarding Modal State
  const [offboardingCandidate, setOffboardingCandidate] = useState(null);
  const [offboardingData, setOffboardingData] = useState(null);
  const [loadingOffboarding, setLoadingOffboarding] = useState(false);
  const [savingOffboarding, setSavingOffboarding] = useState(false);
  const [offboardingDocs, setOffboardingDocs] = useState({});

  // Time-aware greeting
  const greetingText = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'GOOD MORNING';
    if (hr < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  }, []);

  const tenantName = user?.tenant_name || 'Bearitt';
  const userName = user?.name || 'HR';

  // Load Real Data from Backend
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [candData, obData, issuesData, woData] = await Promise.all([
        request('/candidates?status=Accepted', { token }).catch(() => []),
        request('/api/onboarding', { token }).catch(() => []),
        request('/api/onboarding/issues', { token }).catch(() => []),
        request('/api/work-orders', { token }).catch(() => request('/api/workforce/work-orders', { token })).catch(() => []),
      ]);

      const candList = Array.isArray(candData) ? candData : candData?.candidates || [];
      const obList = Array.isArray(obData) ? obData : obData?.candidates || [];
      const issueList = Array.isArray(issuesData) ? issuesData : issuesData?.issues || [];
      const woList = Array.isArray(woData) ? woData : woData?.work_orders || [];

      const obMap = {};
      obList.forEach((item) => {
        const id = item.candidate_id || item.id || item.workorder_id;
        if (id) {
          obMap[id] = item;
          const clean = String(id).replace('SDC-', '').replace('SDC -', '').replace('BEAR-', '').replace('BEAR -', '').trim();
          obMap[clean] = item;
          obMap[`SDC-${clean}`] = item;
          obMap[`SDC -${clean}`] = item;
          obMap[`BEAR-${clean}`] = item;
        }
        if (item.candidate_name) {
          obMap[item.candidate_name.trim().toLowerCase()] = item;
        }
      });

      // Build work order map from actual work orders and onboarding activation status
      const woMap = {};
      woList.forEach((wo) => {
        const id = wo.candidate_id || wo.workorder_id || wo.id;
        if (id) {
          woMap[id] = wo;
          const clean = String(id).replace('SDC-', '').replace('SDC -', '').replace('BEAR-', '').replace('BEAR -', '').trim();
          woMap[clean] = wo;
          woMap[`SDC-${clean}`] = wo;
          woMap[`SDC -${clean}`] = wo;
          woMap[`BEAR-${clean}`] = wo;
        }
        if (wo.candidate_name) {
          woMap[wo.candidate_name.trim().toLowerCase()] = wo;
        }
      });

      setCandidates(candList);
      setOnboardingDocs(obMap);
      setWorkOrders(woMap);
      setIssues(issueList);
    } catch (err) {
      console.error('Failed to load onboarding data:', err);
      setError(err.message || 'Unable to load candidate onboarding management data.');
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
    const obValues = Object.values(onboardingDocs);
    const inProgress = obValues.filter((o) => o.status === 'in_progress').length;
    const completed = obValues.filter((o) => o.status === 'completed' || o.setup_status === 'completed').length;
    const openIssues = issues.filter((i) => i.status === 'open').length;

    return {
      accepted: totalAccepted,
      inProgress,
      completed,
      openIssues,
    };
  }, [candidates, onboardingDocs, issues]);

  // Handle creating a work order for a candidate
  const handleCreateWorkOrder = async (cand) => {
    const id = cand.candidate_id || cand.id;
    setCreatingWO(id);
    setError('');
    try {
      await request('/api/workforce/work-orders', {
        method: 'POST',
        token,
        body: {
          candidate_id: id,
          candidate_name: cand.candidate_name || cand.name || '',
          requisition_id: cand.requisition_id || '',
          company_name: cand.company_name || '',
          vendor_name: cand.vendor_name || '',
          requisition_title: cand.requisition_title || '',
        },
      });
      setSuccessInfo(`Work order created for ${cand.candidate_name || cand.name || 'candidate'}.`);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to create work order.');
    } finally {
      setCreatingWO('');
    }
  };

  // Handle clearing an activation gate
  const handleClearGate = async (candidateId, gateId) => {
    setClearingGate(gateId);
    setError('');
    try {
      const res = await request(`/api/onboarding/${candidateId}/clear-gate`, {
        method: 'POST',
        token,
        body: { gate_id: gateId },
      });
      setSuccessInfo('Gate cleared successfully.');
      // Update the modal data
      if (showGatesModal && res?.activation_gates) {
        setShowGatesModal({ ...showGatesModal, activation_gates: res.activation_gates });
      }
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to clear gate.');
    } finally {
      setClearingGate('');
    }
  };

  // Open gates modal for a candidate
  const handleViewGates = (cand) => {
    const id = cand.candidate_id || cand.id;
    const candName = cand.candidate_name || cand.full_name || cand.name || '';
    const obDoc = onboardingDocs[id] || onboardingDocs[candName.trim().toLowerCase()];
    const gates = obDoc?.activation_gates || [];
    setShowGatesModal({
      candidate_id: id,
      candidate_name: candName,
      requisition_title: cand.requisition_title || '',
      activation_gates: gates,
    });
  };

  // Display Table Rows (strictly real candidates from DB, filtered by search query)
  const displayRows = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase();
    return candidates.filter((c) => {
      const name = (c.candidate_name || c.full_name || c.name || '').toLowerCase();
      const code = (c.candidate_id || c.id || '').toLowerCase();
      const vendor = (c.vendor_name || '').toLowerCase();
      const req = (c.requisition_ref || c.requisition_title || '').toLowerCase();
      return name.includes(q) || code.includes(q) || vendor.includes(q) || req.includes(q);
    });
  }, [candidates, searchQuery]);

  // Open Onboarding Setup Modal
  const handleOpenSetup = (cand) => {
    const id = cand.id || cand.candidate_id;
    const candName = cand.candidate_name || cand.full_name || cand.name || '';
    const existing = onboardingDocs[id] || onboardingDocs[candName.trim().toLowerCase()];

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
  };

  // Save Onboarding Setup to Live Backend
  const handleSaveSetup = async () => {
    if (!editingCandidate) return;
    setSavingSetup(true);
    setError('');
    const id = editingCandidate.id || editingCandidate.candidate_id;
    const candName = editingCandidate.candidate_name || editingCandidate.name || 'candidate';

    try {
      const payload = {
        candidate_id: id,
        candidate_name: candName,
        company_name: editingCandidate.company_name || '',
        requisition_id: editingCandidate.requisition_id || '',
        vendor_name: editingCandidate.vendor_name || '',
        requisition_ref: editingCandidate.requisition_ref || '',
        requisition_title: editingCandidate.requisition_title || '',
        software: setupSoftware,
        training: setupTraining,
        status: 'completed',
        setup_status: 'completed',
      };

      await request(`/api/onboarding/${id}`, {
        method: 'PUT',
        token,
        body: payload,
      }).catch(async () => {
        await request(`/api/onboarding/${id}`, {
          method: 'POST',
          token,
          body: payload,
        });
      });

      // Update local state immediately so button turns to 'Edit Setup' without waiting
      const updatedDoc = {
        ...payload,
        status: 'completed',
        setup_status: 'completed',
      };
      setOnboardingDocs((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || {}), ...updatedDoc },
        [candName.trim().toLowerCase()]: { ...(prev[candName.trim().toLowerCase()] || {}), ...updatedDoc },
      }));

      setSuccessInfo(`Onboarding setup saved for ${candName}.`);
      setEditingCandidate(null);
      await loadData();
    } catch (err) {
      console.error('Failed to save onboarding checklist:', err);
      setError(err.message || 'Failed to save onboarding checklist.');
    } finally {
      setSavingSetup(false);
    }
  };

  // Dispatch or Resend Candidate Login Credentials
  const handleSendCredentials = async (cand) => {
    const id = cand.candidate_id || cand.id;
    const candName = cand.candidate_name || cand.full_name || cand.name || 'Candidate';
    setSendingCredsId(id);
    setError('');
    setSuccessInfo('');
    try {
      const res = await request(`/api/onboarding/${encodeURIComponent(id)}/send-credentials`, {
        method: 'POST',
        token,
        body: {
          email: cand.candidate_email || cand.email,
          name: candName,
        },
      });
      setSuccessInfo(`Login credentials successfully emailed to ${candName} (${res.email || cand.email || 'candidate email'}).`);
      await loadData();
    } catch (err) {
      console.error('Failed to dispatch candidate credentials:', err);
      setError(err.message || 'Failed to dispatch credentials email.');
    } finally {
      setSendingCredsId(null);
    }
  };

  // Open Offboarding Modal (prepopulates from onboarding)
  const handleOpenOffboarding = async (cand) => {
    const id = cand.id || cand.candidate_id;
    const candName = cand.candidate_name || cand.full_name || cand.name || 'Candidate';
    setOffboardingCandidate(cand);
    setLoadingOffboarding(true);
    setError('');
    try {
      const res = await request(`/api/offboarding/${id}`, { token });
      setOffboardingData(res);
    } catch (err) {
      console.warn('Offboarding fetch fallback:', err);
      const existing = onboardingDocs[id] || onboardingDocs[candName.trim().toLowerCase()];
      setOffboardingData({
        candidate_id: id,
        candidate_name: candName,
        laptop_return_required: Boolean(existing?.laptop_required),
        laptop_spec: existing?.laptop_spec || 'Standard build',
        badge_return_required: Boolean(existing?.badge_required),
        software_items: (existing?.software || DEFAULT_SOFTWARE).map((s) => ({
          id: s.id,
          label: `Revoke / Handover: ${s.label || s.name}`,
          enabled: Boolean(s.enabled),
        })),
        handover_items: (existing?.training || DEFAULT_TRAINING).map((t) => ({
          id: t.id,
          label: `Knowledge Transfer: ${t.label || t.name}`,
          enabled: true,
        })),
        custom_items: [
          { id: 'ci_nda', label: 'Sign Final NDA & Exit Clearance Agreement', enabled: true },
          { id: 'ci_files', label: 'Handover all code, documents, & credentials to team', enabled: true },
        ],
        notes: '',
        status: 'not_started',
      });
    } finally {
      setLoadingOffboarding(false);
    }
  };

  // Initiate Offboarding & Send to Candidate
  const handleInitiateOffboarding = async () => {
    if (!offboardingCandidate || !offboardingData) return;
    setSavingOffboarding(true);
    const id = offboardingCandidate.id || offboardingCandidate.candidate_id;
    try {
      const payload = {
        laptop_return_required: Boolean(offboardingData.laptop_return_required),
        laptop_spec: offboardingData.laptop_spec || 'Standard build',
        badge_return_required: Boolean(offboardingData.badge_return_required),
        software_items: offboardingData.software_items || [],
        handover_items: offboardingData.handover_items || [],
        custom_items: offboardingData.custom_items || [],
        notes: offboardingData.notes || '',
      };
      await request(`/api/offboarding/${id}/initiate`, {
        method: 'POST',
        token,
        body: payload,
      });
      setSuccessInfo(`Offboarding initiated for ${offboardingCandidate.candidate_name || 'Candidate'}. Clearance checklist sent to candidate portal.`);
      setOffboardingDocs((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || {}), status: 'in_progress' },
      }));
      setOffboardingCandidate(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to initiate offboarding.');
    } finally {
      setSavingOffboarding(false);
    }
  };

  // Generate Work Order for candidate
  const handleGenerateWorkOrder = async (cand) => {
    const candId = cand.candidate_id || cand.id;
    setError('');
    setSuccessInfo('');
    try {
      const res = await request(`/api/onboarding/${candId}/generate-work-order`, {
        method: 'POST',
        token,
      });
      setSuccessInfo(res.message || `Work order generated and activated for ${cand.candidate_name || 'candidate'}.`);
      loadData();
    } catch (err) {
      console.error('Work order generation error:', err);
      setError(err.message || 'Failed to generate work order.');
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

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0066FF] bg-blue-50/80 px-2.5 py-0.5 rounded-full border border-blue-100/60 shadow-2xs">
              TERM JOBS • ONBOARDING
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            Candidate Onboarding Management
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Configure provisioning checklists, clearance gates, and candidate resolution workflows
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowIssuesModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/70 hover:bg-white text-gray-700 text-xs font-semibold border border-white/90 shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <Flag size={13} className="text-rose-500" />
            <span>Reported Issues</span>
            {metrics.openIssues > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-600 text-white text-[10px] font-extrabold rounded-full">
                {metrics.openIssues}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/70 hover:bg-white text-gray-700 text-xs font-semibold border border-white/90 shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 4 Bento Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 flex-shrink-0">
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Accepted Hires</div>
            <div className="text-xl font-black text-gray-900 mt-0.5">{metrics.accepted}</div>
            <div className="text-[10px] text-gray-400">Ready to onboard</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/80 flex items-center justify-center text-[#0066FF] shadow-2xs">
            <CheckCircle2 size={19} />
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">In Progress</div>
            <div className="text-xl font-black text-amber-600 mt-0.5">{metrics.inProgress}</div>
            <div className="text-[10px] text-gray-400">Checklist pending</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100/80 flex items-center justify-center text-amber-600 shadow-2xs">
            <Clock size={19} />
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Completed</div>
            <div className="text-xl font-black text-emerald-600 mt-0.5">{metrics.completed}</div>
            <div className="text-[10px] text-gray-400">Ready for workforce</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-emerald-600 shadow-2xs">
            <Shield size={19} />
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Open Issues</div>
            <div className="text-xl font-black text-rose-600 mt-0.5">{metrics.openIssues}</div>
            <div className="text-[10px] text-gray-400">Candidate escalations</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100/80 flex items-center justify-center text-rose-600 shadow-2xs">
            <Flag size={19} />
          </div>
        </div>
      </div>

      {/* Navigation Pills & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 flex-shrink-0">
        <div className="flex items-center gap-1.5 p-1 bg-white/40 backdrop-blur-xl border border-white/70 rounded-2xl shadow-2xs">
          <button
            type="button"
            onClick={() => navigate('/dashboard/candidates')}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-gray-600 hover:text-black hover:bg-white/60 transition cursor-pointer"
          >
            Shortlisted
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/candidates/accepted')}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-gray-600 hover:text-black hover:bg-white/60 transition cursor-pointer"
          >
            Accepted
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/candidates/onboarding')}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-black text-white shadow-xs transition cursor-pointer"
          >
            Onboarding
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search candidate, requisition, vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 bg-white/50 backdrop-blur-xl border border-white/80 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-black shadow-2xs transition"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col overflow-hidden">
        {error && (
          <div className="m-3 p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}
        {successInfo && (
          <div className="m-3 p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-700 font-medium flex items-center gap-2">
            <Check size={15} />
            <span>{successInfo}</span>
          </div>
        )}

        {/* Data Table */}
        <div className="flex-1 overflow-x-auto overflow-y-auto custom-cand-scroll">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-gray-100">
              <tr className="text-[10.5px] font-extrabold uppercase tracking-wider text-gray-400">
                <th className="py-3 pl-4 pr-3">Candidate</th>
                <th className="py-3 px-3">Vendor</th>
                <th className="py-3 px-3">Requisition</th>
                <th className="py-3 px-3 text-center">Match</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Work Order</th>
                <th className="py-3 pr-4 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/70 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-400">
                    <div className="w-8 h-8 border-2 border-black/20 border-t-black rounded-full animate-spin mx-auto mb-2" />
                    <div className="font-medium text-xs">Loading onboarding records...</div>
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-400">
                    <CheckCircle2 size={32} className="mx-auto mb-2 text-gray-300" />
                    <div className="font-bold text-gray-700">No onboarding records found</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {searchQuery ? 'Try adjusting your search criteria' : 'Accepted candidates ready for onboarding will appear here'}
                    </div>
                  </td>
                </tr>
              ) : (
                displayRows.map((cand, idx) => {
                  const id = cand.id || cand.candidate_id || `cand-${idx}`;
                  const rawId = cand.candidate_id || cand.id || `${idx}7fa08`;
                  const candCode = String(rawId).startsWith('BEAR-') ? String(rawId) : `BEAR-${String(rawId).slice(0, 6)}`;
                  const candName = cand.candidate_name || cand.full_name || cand.name || 'Candidate';
                  const vendorName = cand.vendor_name || 'Direct';
                  const reqRef = cand.requisition_ref || '';
                  const reqTitle = cand.requisition_title || '';

                  const score = cand.match_score != null ? Math.round(cand.match_score) : null;
                  const obDoc = onboardingDocs[id] || onboardingDocs[rawId] || onboardingDocs[candName.trim().toLowerCase()];
                  const isCompleted = cand.forceStatus === 'completed' || obDoc?.status === 'completed' || obDoc?.setup_status === 'completed';
                  const isInProgress = cand.forceStatus === 'in_progress' || obDoc?.status === 'in_progress' || obDoc?.setup_status === 'in_progress';

                  const woDoc =
                    workOrders[id] ||
                    workOrders[rawId] ||
                    (obDoc?.workorder_id && workOrders[obDoc.workorder_id]) ||
                    (cand.workorder_id && workOrders[cand.workorder_id]) ||
                    workOrders[candName.trim().toLowerCase()];

                  const hasWO = Boolean(woDoc && (woDoc.status || woDoc.work_order_number)) || Boolean(obDoc?.workorder_id) || Boolean(cand.workorder_id);
                  const woStatus = (woDoc?.status || woDoc?.agreement_status || obDoc?.activation_status || '').toUpperCase();
                  const woActivated =
                    woStatus === 'ACTIVE' ||
                    woStatus === 'ACTIVATED' ||
                    woStatus === 'APPROVED' ||
                    obDoc?.activation_status === 'activated';

                  const rawWoId = woDoc?.workorder_id || woDoc?.candidate_id || obDoc?.workorder_id || cand.workorder_id || id;
                  const cleanWoCode = String(rawWoId).replace('SDC-', '').replace('SDC -', '').replace('BEAR-', '').replace('BEAR -', '').trim();
                  const woNumber =
                    woDoc?.work_order_number ||
                    obDoc?.work_order_number ||
                    (rawWoId && String(rawWoId).startsWith('WO-')
                      ? rawWoId
                      : `WO-2026-${cleanWoCode.slice(0, 4).toUpperCase()}`);

                  return (
                    <tr
                      key={id}
                      className="hover:bg-white/60 transition-colors group"
                    >
                      {/* Candidate */}
                      <td className="py-3 pl-4 pr-3 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gray-100 border border-gray-200/60 flex items-center justify-center font-extrabold text-xs text-gray-700">
                            {candName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-extrabold text-gray-900 tracking-tight">
                              {candName}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono">
                              {candCode}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Vendor */}
                      <td className="py-3 px-3 align-middle">
                        <span className="text-xs font-semibold text-gray-700">
                          {vendorName}
                        </span>
                      </td>

                      {/* Requisition */}
                      <td className="py-3 px-3 align-middle">
                        <div>
                          <div className="text-xs font-bold text-gray-900">
                            {reqRef}
                          </div>
                          <div className="text-[10.5px] text-gray-500 truncate max-w-[170px]">
                            {reqTitle}
                          </div>
                        </div>
                      </td>

                      {/* Match */}
                      <td className="py-3 px-3 align-middle text-center">
                        {score != null ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200/60">
                            {score}%
                          </span>
                        ) : (
                          <span className="text-gray-400 font-medium">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 align-middle text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : isInProgress
                              ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {isCompleted ? 'Completed' : isInProgress ? 'In Progress' : 'Not Set Up'}
                        </span>
                      </td>

                      {/* Work Order */}
                      <td className="py-3 px-3 align-middle text-center">
                        {woActivated ? (
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <span
                              onClick={() => handleViewGates(cand)}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 cursor-pointer hover:bg-emerald-100 transition"
                              title="Click to view activation gates"
                            >
                              <FileText size={11} />
                              Active
                            </span>
                            {woNumber && (
                              <span
                                onClick={() => handleViewGates(cand)}
                                className="text-[10px] font-mono text-gray-600 font-semibold bg-gray-100/80 px-2 py-0.5 rounded-md border border-gray-200/70 cursor-pointer hover:bg-gray-200 transition"
                              >
                                {woNumber}
                              </span>
                            )}
                          </div>
                        ) : hasWO ? (
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <span
                              onClick={() => handleViewGates(cand)}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 cursor-pointer hover:bg-amber-100 transition"
                              title="Click to view activation gates"
                            >
                              <FileText size={11} />
                              Pending
                            </span>
                            {woNumber && (
                              <span
                                onClick={() => handleViewGates(cand)}
                                className="text-[10px] font-mono text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 cursor-pointer hover:bg-amber-100 transition"
                              >
                                {woNumber}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 font-medium">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 pr-4 pl-3 align-middle text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenSetup(cand)}
                            className="px-2.5 py-1 rounded-xl bg-white/80 hover:bg-white text-gray-800 text-xs font-bold border border-gray-200/80 hover:border-black transition cursor-pointer shadow-2xs"
                          >
                            {isCompleted ? 'Edit Setup' : 'Setup Onboarding'}
                          </button>

                          {hasWO || woActivated ? (
                            <button
                              type="button"
                              onClick={() => handleViewGates(cand)}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer shadow-2xs flex items-center gap-1 ${
                                woActivated
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100'
                                  : 'bg-white/80 hover:bg-white text-gray-700 border-gray-200/80'
                              }`}
                            >
                              <FileText size={11} className={woActivated ? 'text-emerald-600' : 'text-gray-400'} />
                              <span>View WO</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleGenerateWorkOrder(cand)}
                              className="px-2.5 py-1 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold transition cursor-pointer shadow-2xs flex items-center gap-1"
                            >
                              <span>Generate WO</span>
                              <ArrowRight size={11} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSendCredentials(cand)}
                            disabled={sendingCredsId === id}
                            className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 text-xs font-bold transition cursor-pointer shadow-2xs flex items-center gap-1 disabled:opacity-50"
                            title="Dispatch or resend portal login credentials"
                          >
                            {sendingCredsId === id ? (
                              <RefreshCw size={11} className="animate-spin text-indigo-600" />
                            ) : (
                              <Mail size={11} className="text-indigo-600" />
                            )}
                            <span>{obDoc?.credentials_sent_at ? 'Resend Creds' : 'Send Creds'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenOffboarding(cand)}
                            className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/70 text-xs font-bold transition cursor-pointer shadow-2xs flex items-center gap-1"
                            title="Initiate candidate exit clearance"
                          >
                            <LogOut size={11} />
                            <span>Offboard</span>
                          </button>
                        </div>
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
          5. CANDIDATE REPORTED ISSUES MODAL
         ======================================================== */}
      {showIssuesModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 22,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
              maxWidth: 600,
              width: '100%',
            }}
            className="p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-start justify-between border-b border-[#F2F2EE] pb-3">
              <div>
                <h3 className="text-[1.2rem] font-extrabold text-[#0A0A0A] tracking-tight flex items-center gap-2">
                  <Flag size={16} />
                  <span>Candidate Reported Issues</span>
                </h3>
                <p className="text-[12px] text-[#737373] font-medium mt-0.5">
                  Review and resolve issues raised by onboarding hires
                </p>
              </div>
              <button
                onClick={() => setShowIssuesModal(false)}
                className="text-[#8A8A85] hover:text-[#0A0A0A] p-1 text-lg font-bold"
              >
                âœ•
              </button>
            </div>

            <div className="space-y-3 max-h-[55vh] overflow-y-auto custom-cand-scroll pr-1">
              {issues.length === 0 ? (
                <div className="py-12 text-center text-[#8A8A85] text-[13px] font-medium space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-[#10B981]" />
                  <div>All candidate onboarding issues are resolved!</div>
                </div>
              ) : (
                issues.map((issue, idx) => (
                  <div
                    key={issue.id || idx}
                    className="p-4 rounded-xl border border-[#EAEAE6] space-y-2 bg-[#FBFBFA]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="text-[13px] font-extrabold text-[#0A0A0A]">
                          {issue.category || 'System Access Issue'}
                        </div>
                        <div className="text-[11.5px] text-[#737373] font-medium">
                          Candidate: {issue.candidate_name || issue.candidate_id || 'Hired Candidate'}
                        </div>
                      </div>
                      <span
                        style={{
                          backgroundColor: issue.status === 'open' ? '#FEF2F2' : '#F0FDF4',
                          color: issue.status === 'open' ? '#DC2626' : '#16A34A',
                        }}
                        className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase"
                      >
                        {issue.status || 'open'}
                      </span>
                    </div>

                    <p className="text-[12px] text-[#52524E] bg-white p-2.5 rounded-lg border border-[#F2F2EE]">
                      {issue.description || 'Candidate reported an issue accessing provisioned services.'}
                    </p>

                    {issue.status === 'open' && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          disabled={resolvingId === issue.id}
                          onClick={() => handleResolveIssue(issue.id)}
                          className="px-3.5 py-1 text-[11.5px] font-bold bg-[#0A0A0A] text-white rounded-lg hover:bg-[#262626] transition-colors cursor-pointer"
                        >
                          {resolvingId === issue.id ? 'Resolving...' : 'Mark as Resolved'}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#F2F2EE]">
              <button
                type="button"
                onClick={() => setShowIssuesModal(false)}
                className="px-4 py-1.5 text-[12px] font-bold text-[#0A0A0A] bg-[#F5F5F2] hover:bg-[#EAEAE6] rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          6. INTERACTIVE ONBOARDING SETUP MODAL (REAL BACKEND SYNC)
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
                  {editingCandidate.candidate_name || editingCandidate.name} â€¢ {editingCandidate.requisition_title || 'â€”'}
                </p>
              </div>
              <button
                onClick={() => setEditingCandidate(null)}
                className="text-[#8A8A85] hover:text-[#0A0A0A] p-1 text-lg font-bold"
              >
                âœ•
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

      {/* ========================================================
          7. ACTIVATION GATES MODAL
         ======================================================== */}
      {showGatesModal && (
        <ActivationGatesModal
          candidate={showGatesModal}
          token={token}
          onClose={() => setShowGatesModal(null)}
          onSuccess={loadData}
        />
      )}

      {/* ========================================================
          8. OFFBOARDING SETUP & CLEARANCE MODAL
         ======================================================== */}
      {offboardingCandidate && offboardingData && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 22,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.18)',
              maxWidth: 620,
              width: '100%',
            }}
            className="p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#F2F2EE] pb-3.5 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#FEF2F2] text-[#DC2626] text-[10.5px] font-extrabold rounded-md uppercase tracking-wider">
                    Exit Clearance
                  </span>
                  <h3 className="text-[1.2rem] font-extrabold text-[#0A0A0A] tracking-tight">
                    Candidate Offboarding Setup
                  </h3>
                </div>
                <p className="text-[12px] text-[#737373] font-medium mt-1">
                  {offboardingCandidate.candidate_name || offboardingCandidate.name} • {offboardingCandidate.requisition_title || 'Contract Role'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOffboardingCandidate(null)}
                className="text-[#8A8A85] hover:text-[#0A0A0A] p-1 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Explanatory banner */}
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[12px] text-[#991B1B] font-medium flex items-start gap-2.5 shrink-0">
              <Clock size={16} className="shrink-0 mt-0.5 text-[#DC2626]" />
              <div>
                <span className="font-bold">Workflow Guarantee: </span>
                All onboarding fields are mirrored here for handover. When the candidate checks off all clearance items in their portal, their <strong>timesheet freezes immediately</strong>, followed by a <strong>48-hour access grace period</strong> before permanent deactivation and releasing the email.
              </div>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 space-y-4 overflow-y-auto custom-cand-scroll pr-1">
              {/* 1. Equipment Return */}
              <div className="space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                  <Laptop size={13} />
                  <span>1. HARDWARE & BADGE RETURN</span>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 rounded-xl border border-[#EAEAE6] hover:bg-[#F8F8F6] cursor-pointer transition-colors">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={offboardingData.laptop_return_required}
                        onChange={(e) =>
                          setOffboardingData({ ...offboardingData, laptop_return_required: e.target.checked })
                        }
                        className="rounded text-[#DC2626] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-[12.5px] font-semibold text-[#0A0A0A]">
                        Laptop Return ({offboardingData.laptop_spec || 'Standard build'})
                      </span>
                    </div>
                    <span className="text-[11px] text-[#8A8A85] font-medium">Physical asset</span>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border border-[#EAEAE6] hover:bg-[#F8F8F6] cursor-pointer transition-colors">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={offboardingData.badge_return_required}
                        onChange={(e) =>
                          setOffboardingData({ ...offboardingData, badge_return_required: e.target.checked })
                        }
                        className="rounded text-[#DC2626] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-[12.5px] font-semibold text-[#0A0A0A]">
                        Access Badge & Keycard Return
                      </span>
                    </div>
                    <span className="text-[11px] text-[#8A8A85] font-medium">Facility access</span>
                  </label>
                </div>
              </div>

              {/* 2. IT & Software Access Revocation */}
              <div className="space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                  <Shield size={13} />
                  <span>2. SOFTWARE & SYSTEM ACCESS REVOCATION</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(offboardingData.software_items || []).map((item, idx) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[#EAEAE6] hover:bg-[#F8F8F6] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={(e) => {
                          const updated = [...(offboardingData.software_items || [])];
                          updated[idx] = { ...item, enabled: e.target.checked };
                          setOffboardingData({ ...offboardingData, software_items: updated });
                        }}
                        className="rounded text-[#DC2626] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-[12px] font-semibold text-[#0A0A0A]">
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 3. Knowledge Transfer & Handover */}
              <div className="space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                  <BookOpen size={13} />
                  <span>3. KNOWLEDGE TRANSFER & HANDOVER</span>
                </div>
                <div className="space-y-2">
                  {(offboardingData.handover_items || []).map((item, idx) => (
                    <label
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-[#EAEAE6] hover:bg-[#F8F8F6] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => {
                            const updated = [...(offboardingData.handover_items || [])];
                            updated[idx] = { ...item, enabled: e.target.checked };
                            setOffboardingData({ ...offboardingData, handover_items: updated });
                          }}
                          className="rounded text-[#DC2626] focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-[12.5px] font-semibold text-[#0A0A0A]">
                          {item.label}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 bg-[#F1F5F9] text-[#475569] text-[10px] font-bold rounded">
                        Handover
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 4. Custom Exit Criteria */}
              <div className="space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                  <CheckCircle2 size={13} />
                  <span>4. EXIT CLEARANCE TASKS</span>
                </div>
                <div className="space-y-2">
                  {(offboardingData.custom_items || []).map((item, idx) => (
                    <label
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-[#EAEAE6] hover:bg-[#F8F8F6] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => {
                            const updated = [...(offboardingData.custom_items || [])];
                            updated[idx] = { ...item, enabled: e.target.checked };
                            setOffboardingData({ ...offboardingData, custom_items: updated });
                          }}
                          className="rounded text-[#DC2626] focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-[12.5px] font-semibold text-[#0A0A0A]">
                          {item.label}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 5. Exit Notes / Instructions */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
                  EXIT INSTRUCTIONS & NOTES (SENT TO CANDIDATE)
                </label>
                <textarea
                  rows={2}
                  value={offboardingData.notes || ''}
                  onChange={(e) => setOffboardingData({ ...offboardingData, notes: e.target.value })}
                  placeholder="e.g. Please handover building pass to reception and ensure final commits are pushed to main branch before Friday."
                  className="w-full text-[12.5px] p-3 rounded-xl border border-[#EAEAE6] focus:outline-none focus:border-[#0A0A0A] bg-[#FAFAFA]"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[#F2F2EE] shrink-0">
              <span className="text-[11.5px] text-[#8A8A85]">
                Initiating sends checklist to candidate portal
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setOffboardingCandidate(null)}
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
                  disabled={savingOffboarding}
                  onClick={handleInitiateOffboarding}
                  style={{
                    borderRadius: 12,
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                  }}
                  className="px-5 py-2 text-[12px] font-bold hover:bg-[#B91C1C] cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                >
                  {savingOffboarding ? 'Initiating...' : 'Initiate Offboarding'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
