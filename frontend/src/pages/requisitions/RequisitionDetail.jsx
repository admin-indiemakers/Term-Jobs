import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import RequisitionEditor from '../../components/RequisitionEditor';
import JdPreview from '../../components/JdPreview';
import {
  ArrowLeft,
  Sparkles,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Send,
  RefreshCw,
  XCircle,
  FileCheck,
  Users,
  Eye,
  Check,
  Layers,
  Clock,
  ArrowRight,
  FileText,
  ChevronRight,
  Building,
  ShieldCheck,
  DollarSign,
  Edit3
} from 'lucide-react';

const STATE_STEPS = [
  { id: 'Draft', label: 'Draft', num: '1' },
  { id: 'Intake', label: 'AI Intake', num: '2' },
  { id: 'Structuring', label: 'Structuring', num: '3' },
  { id: 'PendingApproval', label: 'Approval', num: '4' },
  { id: 'Published', label: 'Published', num: '5' },
];

const NORMALIZED = {
  Draft: 'Draft',
  Intake: 'Intake',
  Structuring: 'Structuring',
  PendingApproval: 'PendingApproval',
  Pending_Approval: 'PendingApproval',
  Published: 'Published',
  Closed: 'Closed',
};

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function RequisitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [answer, setAnswer] = useState('');
  const [instruction, setInstruction] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftRole, setDraftRole] = useState(null);
  const [busy, setBusy] = useState('');
  const [info, setInfo] = useState('');
  const [shortlisted, setShortlisted] = useState([]);
  const [shortlistLoading, setShortlistLoading] = useState(false);
  const [activeReviewTab, setActiveReviewTab] = useState('structured'); // 'structured' | 'jd'
  const [showRefineBox, setShowRefineBox] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    setLoading(true);
    request(`/requisitions/${id}`, { token })
      .then((data) => {
        setReq(data);
        const vLimit = data.vendor_candidate_limit || data.structured_role?.vendor_candidate_limit || (data.intake_meta?.prefill?.vendor_candidate_limit) || (data.intake_meta?.prefill?.candidate_limit) || 1;
        const role = data.structured_role ? { ...data.structured_role, vendor_candidate_limit: vLimit } : { vendor_candidate_limit: vLimit };
        if (role && !role.hiring_manager && user?.name) role.hiring_manager = user.name;
        setDraftRole(role);
        setEditing(false);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id, token, user?.name]);

  useEffect(() => {
    setShortlistLoading(true);
    request(`/api/candidates/shortlisted?requisition_id=${encodeURIComponent(id)}`, { token })
      .then((data) => setShortlisted(data?.shortlisted_candidates || data || []))
      .catch(() => setShortlisted([]))
      .finally(() => setShortlistLoading(false));
  }, [id, token]);

  // Auto-dismiss notification alerts after 2 seconds
  useEffect(() => {
    if (!info) return;
    const timer = setTimeout(() => {
      setInfo('');
    }, 2000);
    return () => clearTimeout(timer);
  }, [info]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError('');
    }, 2000);
    return () => clearTimeout(timer);
  }, [error]);

  const rawStatus = req?.status || 'Draft';
  const status = NORMALIZED[rawStatus] || rawStatus;
  const structuredRole = draftRole || req?.structured_role;

  const isDirectorOrAdmin = user?.role === 'Director' || user?.role === 'Admin' || user?.role === 'Super Admin';
  const isDirectorApproved = Boolean(req?.director_approved);

  const currentStepIndex = Math.max(
    0,
    STATE_STEPS.findIndex((s) => s.id === status)
  );

  const currentQuestion = req?.pending_question || req?.current_question;

  // API Action Handlers
  const handleStart = async () => {
    setBusy('start');
    setError('');
    setInfo('');
    try {
      const data = await request(`/requisitions/${id}/start`, { method: 'POST', token });
      setReq((prev) => ({ ...prev, ...data }));
      if (data.structured_role) {
        setDraftRole(data.structured_role);
      }
      setInfo('AI intake initialized. Check the question below.');
      load();
    } catch (err) {
      setError(err.message || 'Failed to start AI intake');
    } finally {
      setBusy('');
    }
  };

  const handleAnswer = async (e) => {
    if (e) e.preventDefault();
    if (!answer.trim()) return;
    setBusy('answer');
    setError('');
    setInfo('');
    try {
      const data = await request(`/requisitions/${id}/answer`, {
        method: 'POST',
        body: { answer: answer.trim() },
        token,
      });
      setAnswer('');
      setInfo('Answer submitted. Requisition criteria updated by AI.');
      load();
    } catch (err) {
      setError(err.message || 'Failed to submit answer');
    } finally {
      setBusy('');
    }
  };

  const handleRefine = async (e) => {
    if (e) e.preventDefault();
    if (!instruction.trim()) return;
    setBusy('refine');
    setError('');
    setInfo('');
    try {
      const data = await request(`/requisitions/${id}/refine`, {
        method: 'POST',
        body: { instruction: instruction.trim() },
        token,
      });
      setInstruction('');
      setShowRefineBox(false);
      setInfo('Requisition refined successfully.');
      load();
    } catch (err) {
      setError(err.message || 'Failed to refine requisition');
    } finally {
      setBusy('');
    }
  };

  const handleApprove = async () => {
    setBusy('approve');
    setError('');
    setInfo('');
    try {
      const payload = draftRole ? { edited_role: draftRole, reviewer: user?.email || user?.name } : {};
      await request(`/requisitions/${id}/approve`, {
        method: 'POST',
        body: payload,
        token,
      });
      setInfo(req?.rejection_reason ? 'Requisition resubmitted for Director approval.' : 'Requisition submitted for Director approval.');
      load();
    } catch (err) {
      setError(err.message || 'Failed to approve requisition');
    } finally {
      setBusy('');
    }
  };

  const handleDirectorApprove = async () => {
    setBusy('director-approve');
    setError('');
    setInfo('');
    try {
      const data = await request(`/requisitions/${id}/director-approve`, {
        method: 'POST',
        token,
      });
      setReq((prev) => ({ ...prev, ...data }));
      setInfo('Requisition approved by Director! Ready to publish.');
      load();
    } catch (err) {
      setError(err.message || 'Failed to approve requisition');
    } finally {
      setBusy('');
    }
  };

  const handleOpenRejectModal = () => {
    setShowRejectModal(true);
    setRejectReason('');
    setError('');
  };

  const handleConfirmReject = async (e) => {
    if (e) e.preventDefault();
    if (!rejectReason.trim()) {
      setError('Please provide a reason for rejecting this requisition.');
      return;
    }
    setBusy('reject');
    setError('');
    setInfo('');
    try {
      await request(`/requisitions/${id}/reject`, {
        method: 'POST',
        body: {
          reviewer: user?.name || user?.email,
          reason: rejectReason.trim(),
        },
        token,
      });
      setShowRejectModal(false);
      setRejectReason('');
      setInfo('Requisition rejected and returned for Hiring Manager revision with feedback.');
      load();
    } catch (err) {
      setError(err.message || 'Failed to reject requisition');
    } finally {
      setBusy('');
    }
  };

  const handlePublish = async () => {
    setBusy('publish');
    setError('');
    setInfo('');
    try {
      await request(`/requisitions/${id}/publish`, { method: 'POST', token });
      setInfo('Requisition published! Partner vendors can now submit candidates.');
      load();
    } catch (err) {
      setError(err.message || 'Failed to publish requisition');
    } finally {
      setBusy('');
    }
  };

  const handleClose = async () => {
    if (!window.confirm('Are you sure you want to close this requisition?')) return;
    setBusy('close');
    setError('');
    setInfo('');
    try {
      await request(`/requisitions/${id}/close`, { method: 'POST', token });
      setInfo('Requisition marked as closed.');
      load();
    } catch (err) {
      setError(err.message || 'Failed to close requisition');
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <div className="w-full py-20 text-center text-xs text-gray-400">
        Loading requisition details...
      </div>
    );
  }

  if (!req) {
    return (
      <div className="w-full py-16 text-center space-y-3">
        <AlertCircle size={28} className="mx-auto text-red-500" />
        <div className="text-sm font-bold text-gray-900">Requisition Not Found</div>
        <p className="text-xs text-gray-400">{error || 'This requisition may have been removed.'}</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard/requisitions')}
          className="px-4 py-2 rounded-xl bg-black text-white text-xs font-bold shadow-xs hover:bg-gray-900"
        >
          Back to Requisitions
        </button>
      </div>
    );
  }

  return (
    <div
      className="w-full min-w-0 pb-16 space-y-4 text-left"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Header Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            <Link to="/dashboard/requisitions" className="hover:text-black transition-colors">
              Requisitions
            </Link>
            <span>•</span>
            <span>REQ #{id.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-[1.65rem] font-extrabold text-gray-900 tracking-tight">
              {req.title || structuredRole?.title || 'Untitled Requisition'}
            </h1>
            <StatusBadge status={req.status} />
          </div>
          <p className="text-xs text-gray-500 font-normal mt-0.5">
            {req.department || structuredRole?.department || 'Engineering'} • Created {formatDate(req.created_at)}
          </p>

          {/* Workflow Stepper Bar */}
          <div className="flex items-center gap-1.5 mt-3.5 flex-wrap">
            {STATE_STEPS.map((st, i) => {
              const isPastOrCurrent = i <= currentStepIndex;
              const isCurrent = st.id === status;
              return (
                <div key={st.id} className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      isCurrent
                        ? 'bg-black text-white shadow-2xs'
                        : isPastOrCurrent
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-white border border-gray-200 text-gray-400'
                    }`}
                  >
                    <span className="text-[10px]">{st.num}.</span>
                    <span>{st.label}</span>
                  </span>
                  {i < STATE_STEPS.length - 1 && (
                    <ChevronRight size={12} className="text-gray-300 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons Header */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/dashboard/requisitions')}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Back
          </button>

          {status === 'Draft' && (
            <button
              type="button"
              onClick={handleStart}
              disabled={Boolean(busy)}
              className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={13} />
              <span>{busy === 'start' ? 'Starting AI...' : 'Start AI Intake →'}</span>
            </button>
          )}

          {(status === 'Intake' || status === 'Structuring') && (
            <>
              <button
                type="button"
                onClick={() => setShowRefineBox(!showRefineBox)}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles size={13} />
                <span>Refine with AI</span>
              </button>

              <button
                type="button"
                onClick={handleApprove}
                disabled={Boolean(busy)}
                className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check size={13} />
                <span>{busy === 'approve' ? 'Approving...' : 'Proceed to Approval →'}</span>
              </button>
            </>
          )}

          {status === 'PendingApproval' && (
            isDirectorApproved ? (
              <button
                type="button"
                onClick={handlePublish}
                disabled={Boolean(busy)}
                className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={13} />
                <span>{busy === 'publish' ? 'Publishing...' : 'Publish to Vendors →'}</span>
              </button>
            ) : isDirectorOrAdmin ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenRejectModal}
                  disabled={Boolean(busy)}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-red-50 border border-red-200 text-red-600 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <XCircle size={13} />
                  <span>Reject ✕</span>
                </button>
                <button
                  type="button"
                  onClick={handleDirectorApprove}
                  disabled={Boolean(busy)}
                  className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check size={13} />
                  <span>{busy === 'director-approve' ? 'Approving...' : 'Approve Requisition (Director) ✓'}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-400 text-xs font-bold border border-gray-200 cursor-not-allowed flex items-center gap-1.5"
                title="Awaiting Director approval before publishing"
              >
                <Clock size={13} />
                <span>Awaiting Director Approval</span>
              </button>
            )
          )}

          {status === 'Published' && (
            <button
              type="button"
              onClick={handleClose}
              disabled={Boolean(busy)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-red-50 border border-red-200 text-red-600 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              Close Requisition
            </button>
          )}
        </div>
      </div>

      {/* Director Rejection Alert Banner for Hiring Manager */}
      {req?.rejection_reason && (
        <div className="p-5 bg-gradient-to-r from-red-50 via-amber-50 to-red-50 border-2 border-red-200 rounded-2xl flex flex-col sm:flex-row items-start justify-between gap-4 text-red-950 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">
              <AlertCircle size={22} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-red-700 bg-red-100 border border-red-300 px-2.5 py-0.5 rounded-md">
                  ❌ Director Requested Revision
                </span>
                {req.rejected_by && (
                  <span className="text-[11px] font-semibold text-gray-600">
                    Reviewed by <strong className="text-gray-900">{req.rejected_by}</strong> {req.rejected_at ? `on ${formatDate(req.rejected_at)}` : ''}
                  </span>
                )}
              </div>
              <div className="text-sm font-extrabold text-gray-900 pt-1">
                Reason: "{req.rejection_reason}"
              </div>
              <p className="text-xs text-gray-700 font-medium leading-relaxed">
                Please edit the structured role criteria or job parameters below to address the Director's feedback, then click <strong className="text-black font-extrabold">"Proceed to Approval →"</strong> to resubmit for Director approval.
              </p>
            </div>
          </div>
          {status !== 'PendingApproval' && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={Boolean(busy)}
              className="px-4 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 self-start sm:self-center"
            >
              <Check size={14} />
              <span>{busy === 'approve' ? 'Resubmitting...' : 'Resubmit for Approval →'}</span>
            </button>
          )}
        </div>
      )}

      {/* Workflow Status Banner for Pending Approval */}
      {status === 'PendingApproval' && (
        isDirectorApproved ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200/90 rounded-2xl flex items-center gap-3 text-emerald-900 shadow-2xs">
            <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
            <div>
              <div className="text-xs font-bold text-emerald-950">
                ✓ Approved by Director {req.director_approved_by ? `(${req.director_approved_by})` : ''}
              </div>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                This requisition has been formally approved by the Director and is ready to be published to partner vendors.
              </p>
            </div>
          </div>
        ) : isDirectorOrAdmin ? (
          <div className="p-4 bg-amber-50 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-2xs">
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} className="shrink-0 text-amber-700" />
              <div>
                <div className="text-xs font-bold text-amber-950">Director Approval Required</div>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Submitted by Hiring Manager. As Director/Admin, approve publication or reject back for revision with reason.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenRejectModal}
                disabled={Boolean(busy)}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-red-50 border border-red-200 text-red-600 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                <XCircle size={14} />
                <span>Reject ✕</span>
              </button>
              <button
                type="button"
                onClick={handleDirectorApprove}
                disabled={Boolean(busy)}
                className="px-4 py-2 rounded-xl bg-amber-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check size={14} />
                <span>{busy === 'director-approve' ? 'Approving...' : 'Approve Requisition (Director) ✓'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-blue-50 border border-blue-200/90 rounded-2xl flex items-center gap-3 text-blue-900 shadow-2xs">
            <Clock size={20} className="shrink-0 text-blue-600" />
            <div>
              <div className="text-xs font-bold text-blue-950">⏳ Pending Director Approval</div>
              <p className="text-[11px] text-blue-800 mt-0.5">
                Submitted to the company Director for approval. Once approved, you will be able to publish this requisition to partner vendors.
              </p>
            </div>
          </div>
        )
      )}

      {info && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
          <span>{info}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Refine with AI Modal Box */}
      {showRefineBox && (
        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-gray-900" />
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Refine Requisition with AI Instruction
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowRefineBox(false)}
              className="text-gray-400 hover:text-black text-xs font-bold"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleRefine} className="space-y-2.5">
            <textarea
              rows="3"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Change experience requirement to 4+ years, add PostgreSQL and GraphQL to must-haves, and adjust duration to 12 months."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:border-black focus:bg-white transition-all"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRefineBox(false)}
                className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={!instruction.trim() || Boolean(busy)}
                className="px-4 py-1.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles size={12} />
                <span>{busy === 'refine' ? 'Refining...' : 'Apply Refinements'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Content (8 cols) + Copilot Guide (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 8 Cols: AI Intake Q&A & Structured Requisition Data */}
        <div className="lg:col-span-8 space-y-4">
          {/* AI Intake Q&A Card (When in Intake or Draft state) - Ultra Compact & Modern */}
          {(status === 'Intake' || status === 'Draft' || currentQuestion) && (
            <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-4.5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-black text-white flex items-center justify-center shrink-0">
                    <Sparkles size={11} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      AI Intake Assistant
                    </h3>
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 font-medium">Targeted Gap Question</span>
              </div>

              {currentQuestion ? (
                <div className="space-y-2">
                  <div className="px-3.5 py-2.5 rounded-xl bg-gray-50/90 border border-gray-200/80 text-xs text-gray-900 leading-relaxed font-semibold">
                    {currentQuestion}
                  </div>

                  <form onSubmit={handleAnswer} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Type your answer (e.g. 2-4 years with production experience)..."
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-black focus:bg-white transition-all font-medium"
                    />
                    <button
                      type="submit"
                      disabled={!answer.trim() || Boolean(busy)}
                      className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <Send size={12} />
                      <span>{busy === 'answer' ? 'Submitting...' : 'Submit'}</span>
                    </button>
                  </form>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-600 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>All intake questions answered. Ready to proceed to approval.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={Boolean(busy)}
                    className="px-3 py-1.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    Proceed to Approval →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Published Vendor Distribution Status Card */}
          <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs mb-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#eff6ff] text-[#2563eb] flex items-center justify-center font-bold">
                  <Building size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Engaged Vendor Consultancies ({req.published_vendors?.length || 0})
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {req.published_vendors?.length || 0} partner consultancies receiving this live requisition • Max {req.vendor_candidate_limit || req.structured_role?.vendor_candidate_limit || (req.intake_meta?.prefill?.vendor_candidate_limit) || 1} candidate per consultancy
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-[11.5px] font-black uppercase tracking-wide bg-red-100 text-red-700 border-2 border-red-300 flex items-center gap-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                <span>IMPORTANT LIMIT: {req.vendor_candidate_limit || req.structured_role?.vendor_candidate_limit || (req.intake_meta?.prefill?.vendor_candidate_limit) || 1} CAND / VENDOR</span>
              </span>
            </div>

            {req.published_vendors && req.published_vendors.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                {req.published_vendors.map((v) => (
                  <div key={v.id} className="p-3 rounded-xl bg-gray-50/80 border border-gray-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-black text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                        {v.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-gray-900">{v.name}</div>
                        <div className="text-[10px] text-gray-400 font-medium capitalize">{v.tenant_type || 'Vendor Consultancy'}</div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Live
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500">
                No active partner vendor consultancies linked to this buyer account yet.
              </div>
            )}
          </div>

          {/* Structured Role & JD Preview Tabs */}
          <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveReviewTab('structured')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeReviewTab === 'structured'
                      ? 'bg-black text-white shadow-xs'
                      : 'text-gray-600 hover:text-black'
                  }`}
                >
                  Structured Role Data
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReviewTab('jd')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeReviewTab === 'jd'
                      ? 'bg-black text-white shadow-xs'
                      : 'text-gray-600 hover:text-black'
                  }`}
                >
                  Generated JD Preview
                </button>
              </div>

              {status === 'Published' && (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Live to Vendors
                </span>
              )}
            </div>

            {/* Structured Role (Fixed Tabs + Scrollable Fields) or JD Preview */}
            <div>
              {activeReviewTab === 'structured' ? (
                <RequisitionEditor
                  role={structuredRole}
                  editable={editing || status === 'Draft' || status === 'Structuring' || status === 'Intake'}
                  onChange={(updated) => setDraftRole(updated)}
                />
              ) : (
                <div
                  className="overflow-y-auto pr-1.5 custom-scrollbar"
                  style={{ maxHeight: '380px' }}
                >
                  <JdPreview
                    markdown={req.generated_jd_markdown}
                    role={structuredRole}
                    rawJd={req.raw_jd}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Copilot & Assistant Side Tab */}
        <div className="lg:col-span-4 space-y-3.5">
          <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs space-y-3.5 sticky top-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                  <Sparkles size={13} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Workflow Assistant
                  </h3>
                  <p className="text-[10px] text-gray-400">Current state guidance</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-900 text-[10px] font-extrabold">
                {status}
              </span>
            </div>

            {/* Stage Guidance */}
            <div className="space-y-2 text-xs">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Stage Instructions
              </div>

              {status === 'Draft' && (
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1 text-gray-700">
                  <div className="font-bold text-gray-900">Drafting Phase</div>
                  <p className="text-[11px] text-gray-500">
                    Review basic job criteria. When ready, click "Start AI Intake" to allow AI to generate targeted gap questions.
                  </p>
                </div>
              )}

              {status === 'Intake' && (
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1 text-gray-700">
                  <div className="font-bold text-gray-900">Answering Intake / Structuring</div>
                  <p className="text-[11px] text-gray-500">
                    Once intake questions are answered, click "Proceed to Approval →" to lock the criteria.
                  </p>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={Boolean(busy)}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-black text-white text-xs font-bold hover:bg-gray-900 transition-colors cursor-pointer"
                  >
                    Proceed to Approval →
                  </button>
                </div>
              )}

              {status === 'Structuring' && (
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1 text-gray-700">
                  <div className="font-bold text-gray-900">Review & Approve</div>
                  <p className="text-[11px] text-gray-500">
                    Verify the structured criteria and JD preview. Click "Approve Requisition" once you're satisfied.
                  </p>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={Boolean(busy)}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-black text-white text-xs font-bold hover:bg-gray-900 transition-colors cursor-pointer"
                  >
                    Approve Requisition →
                  </button>
                </div>
              )}

              {status === 'PendingApproval' && (
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1 text-gray-700">
                  <div className="font-bold text-gray-900">
                    {isDirectorApproved ? 'Publish to Partners' : 'Director Approval Required'}
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {isDirectorApproved
                      ? 'Click "Publish to Vendors" to broadcast this requirement to your engaged consultancies.'
                      : 'Director approval is required before this requisition can be published to partner vendors.'}
                  </p>
                  {isDirectorApproved ? (
                    <button
                      type="button"
                      onClick={handlePublish}
                      disabled={Boolean(busy)}
                      className="w-full mt-2 py-2 px-3 rounded-xl bg-black text-white text-xs font-bold hover:bg-gray-900 transition-colors cursor-pointer"
                    >
                      Publish to Vendors →
                    </button>
                  ) : isDirectorOrAdmin ? (
                    <button
                      type="button"
                      onClick={handleDirectorApprove}
                      disabled={Boolean(busy)}
                      className="w-full mt-2 py-2 px-3 rounded-xl bg-black text-white text-xs font-bold hover:bg-gray-900 transition-colors cursor-pointer"
                    >
                      Approve Requisition (Director) ✓
                    </button>
                  ) : (
                    <div className="mt-2 text-[11px] font-semibold text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      ⏳ Awaiting Director approval before publication.
                    </div>
                  )}
                </div>
              )}

              {status === 'Published' && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 space-y-1 text-emerald-900">
                  <div className="font-bold text-emerald-900">Live Sourcing</div>
                  <p className="text-[11px] text-emerald-700">
                    Engaged partner vendors are submitting matched candidate profiles. Review submissions under Candidates.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Stats Widget */}
            <div className="space-y-2 pt-2 border-t border-gray-100 text-xs">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Key Parameters
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50 text-gray-700">
                  <span className="text-gray-500">Duration</span>
                  <span className="font-bold text-gray-900">{structuredRole?.duration || '6 months'}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50 text-gray-700">
                  <span className="text-gray-500">Work Mode</span>
                  <span className="font-bold text-gray-900">{structuredRole?.work_mode || 'Remote'}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50 text-gray-700">
                  <span className="text-gray-500">Ceiling Rate</span>
                  <span className="font-bold text-gray-900">
                    {structuredRole?.ceiling_internal ? `₹${structuredRole.ceiling_internal}` : 'Not set'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Director Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-gray-100 text-left animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-red-600 font-extrabold text-sm">
                <AlertCircle size={18} />
                <span>Reject Requisition & Request Changes</span>
              </div>
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="text-gray-400 hover:text-black font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <h3 className="font-extrabold text-base text-gray-900">
                {req.title || structuredRole?.title || 'Untitled Requisition'}
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                REQ #{req.id.slice(0, 8)} • Provide specific feedback on what the Hiring Manager needs to revise.
              </p>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  Rejection Reason / Required Modifications <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows="4"
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Rate ceiling of ₹1200 is above budget. Please reduce internal ceiling to ₹900/hr or adjust required seniority level."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:border-red-500 focus:bg-white transition-all font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!rejectReason.trim() || busy === 'reject'}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>{busy === 'reject' ? 'Rejecting...' : 'Confirm Rejection & Send Reason ✕'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
