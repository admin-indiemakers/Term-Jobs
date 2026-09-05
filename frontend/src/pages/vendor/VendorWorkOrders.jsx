import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import {
  FileText, Sparkles, CheckCircle2, AlertCircle, Clock, Send, Upload,
  DollarSign, Calendar, MapPin, Building2, User, ChevronRight, X, ArrowLeft, RefreshCw
} from 'lucide-react';

export default function VendorWorkOrders() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [activeWorkOrder, setActiveWorkOrder] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    job_title: '',
    work_location: 'Remote',
    start_date: '',
    end_date: '',
    contract_duration_months: 6,
    billing_rate: 150000,
    rate_type: 'monthly',
    currency: 'INR',
    vendor_visible_floor: 120000,
    vendor_visible_cap: 180000,
    billing_cycle: 'Monthly',
    payment_terms: 'NET 30',
    scope_of_work: '',
    special_terms: '',
    ai_generated: false,
    ai_reasoning: '',
  });

  const [selectedFile, setSelectedFile] = useState(null);

  // Load Accepted Candidates & Active Work Orders for Vendor
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [candData, woData] = await Promise.all([
        request('/candidates?status=Accepted', { token }).catch(() => []),
        request('/api/work-orders', { token }).catch(() => []),
      ]);

      const candList = Array.isArray(candData) ? candData : candData?.candidates || [];
      const woList = Array.isArray(woData) ? woData : woData?.work_orders || [];

      // Filter candidates for this vendor
      const vendorName = (user?.tenant_name || user?.name || '').toLowerCase();
      const vendorCands = candList.filter((c) => {
        if (!vendorName) return true;
        return (c.vendor_name || '').toLowerCase().includes(vendorName) || user?.role === 'Super Admin';
      });

      setCandidates(vendorCands);
      setWorkOrders(woList);
    } catch (err) {
      console.error('Failed to load vendor MSA data:', err);
      setError(err.message || 'Unable to load candidates or Master Services Agreements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Map work orders by candidate id
  const woMap = useMemo(() => {
    const map = {};
    workOrders.forEach((wo) => {
      if (wo.candidate_id) map[wo.candidate_id] = wo;
    });
    return map;
  }, [workOrders]);

  // Open Modal & Run AI Agent Autofill
  const handleOpenWorkOrder = async (cand) => {
    setSelectedCandidate(cand);
    const existingWo = woMap[cand.id || cand.candidate_id];

    if (existingWo) {
      setActiveWorkOrder(existingWo);
      setFormData({
        job_title: existingWo.job_title || cand.requisition_title || 'Contract Role',
        work_location: existingWo.work_location || 'Remote',
        start_date: existingWo.start_date || '',
        end_date: existingWo.end_date || '',
        contract_duration_months: existingWo.contract_duration_months || 6,
        billing_rate: existingWo.billing_rate || 150000,
        rate_type: existingWo.rate_type || 'monthly',
        currency: existingWo.currency || 'INR',
        vendor_visible_floor: existingWo.vendor_visible_floor || 120000,
        vendor_visible_cap: existingWo.vendor_visible_cap || 180000,
        billing_cycle: existingWo.billing_cycle || 'Monthly',
        payment_terms: existingWo.payment_terms || 'NET 30',
        scope_of_work: existingWo.scope_of_work || '',
        special_terms: existingWo.special_terms || '',
        ai_generated: existingWo.ai_generated || false,
        ai_reasoning: existingWo.ai_reasoning || '',
      });
    } else {
      setActiveWorkOrder(null);
      // Run AI Autofill Agent automatically
      await handleRunAiAutofill(cand);
    }
  };

  const handleRunAiAutofill = async (cand) => {
    const candidateObj = cand || selectedCandidate;
    if (!candidateObj) return;

    setAiGenerating(true);
    setError('');
    try {
      const res = await request('/api/work-orders/autofill-generate', {
        token,
        method: 'POST',
        body: JSON.stringify({
          candidate_id: candidateObj.id || candidateObj.candidate_id,
          requisition_id: candidateObj.requisition_id,
          candidate_name: candidateObj.candidate_name || candidateObj.name,
        }),
      });

      if (res) {
        setFormData({
          job_title: res.job_title || candidateObj.requisition_title || 'Contract Role',
          work_location: res.work_location || 'Remote',
          start_date: res.start_date || '',
          end_date: res.end_date || '',
          contract_duration_months: res.contract_duration_months || 6,
          billing_rate: res.billing_rate || 150000,
          rate_type: res.rate_type || 'monthly',
          currency: res.currency || 'INR',
          vendor_visible_floor: res.vendor_visible_floor || 120000,
          vendor_visible_cap: res.vendor_visible_cap || 180000,
          billing_cycle: res.billing_cycle || 'Monthly',
          payment_terms: res.payment_terms || 'NET 30',
          scope_of_work: res.scope_of_work || '',
          special_terms: res.special_terms || '',
          ai_generated: true,
          ai_reasoning: res.ai_reasoning || 'AI MSA Agent successfully calculated commercial terms from Requisition & Candidate Profile.',
        });
        setSuccess('AI MSA Agent prefilled terms bounded by Vendor Rate Floor & Cap!');
      }
    } catch (err) {
      console.error('AI MSA Agent failed:', err);
      setError('AI Agent failed to prefill. Please enter terms manually.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSaveOrSubmit = async (shouldSubmit = false) => {
    if (!selectedCandidate) return;
    setSubmitting(true);
    setError('');

    const candId = selectedCandidate.id || selectedCandidate.candidate_id;

    try {
      const payload = {
        requisition_id: selectedCandidate.requisition_id || 'REQ-001',
        candidate_id: candId,
        candidate_name: selectedCandidate.candidate_name || selectedCandidate.name,
        candidate_email: selectedCandidate.candidate_email || '',
        candidate_phone: selectedCandidate.candidate_phone || '',
        vendor_name: selectedCandidate.vendor_name || user?.tenant_name || 'Vendor',
        job_title: formData.job_title,
        work_location: formData.work_location,
        start_date: formData.start_date,
        end_date: formData.end_date,
        contract_duration_months: Number(formData.contract_duration_months),
        billing_rate: Number(formData.billing_rate),
        rate_type: formData.rate_type,
        currency: formData.currency,
        vendor_visible_floor: Number(formData.vendor_visible_floor),
        vendor_visible_cap: Number(formData.vendor_visible_cap),
        billing_cycle: formData.billing_cycle,
        payment_terms: formData.payment_terms,
        scope_of_work: formData.scope_of_work,
        special_terms: formData.special_terms,
        ai_generated: formData.ai_generated,
        ai_reasoning: formData.ai_reasoning,
      };

      const savedWo = await request('/api/work-orders', {
        token,
        method: 'POST',
        body: JSON.stringify(payload),
      });

      let finalWo = savedWo;
      if (shouldSubmit && savedWo?.id) {
        finalWo = await request(`/api/work-orders/${savedWo.id}/submit`, {
          token,
          method: 'POST',
        });
      }

      // Handle optional E-signature document upload
      if (selectedFile && finalWo?.id) {
        setUploadingFile(true);
        const fileForm = new FormData();
        fileForm.append('file', selectedFile);
        
        await fetch(`/api/work-orders/${finalWo.id}/upload-esign`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fileForm,
        });
      }

      setSuccess(shouldSubmit ? 'Master Services Agreement (MSA) submitted to Company Director for approval!' : 'MSA draft saved!');
      setSelectedCandidate(null);
      loadData();
    } catch (err) {
      console.error('Failed to save Master Services Agreement:', err);
      setError(err.message || 'Unable to save Master Services Agreement.');
    } finally {
      setSubmitting(false);
      setUploadingFile(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
            <Building2 className="w-4 h-4" /> Vendor Workspace
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Master Services Agreements (MSA)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Generate, customize, and submit Master Services Agreements (MSA) to the Company Director for executive approval.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" /> {success}
        </div>
      )}

      {/* Selected Candidates Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Selected Candidates & MSA Lifecycle</h3>
            <p className="text-xs text-slate-500">Candidates accepted by Hiring Managers ready for Director MSA approval.</p>
          </div>
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-full border border-indigo-100">
            {candidates.length} Selected Candidates
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading selected candidates...</div>
        ) : candidates.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No accepted candidates found for your vendor account.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="py-3.5 px-6">Candidate</th>
                  <th className="py-3.5 px-6">Role & Requisition</th>
                  <th className="py-3.5 px-6">Vendor Name</th>
                  <th className="py-3.5 px-6">MSA Status</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidates.map((cand) => {
                  const id = cand.id || cand.candidate_id;
                  const wo = woMap[id];
                  
                  let badge = (
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-bold text-xs rounded-full border border-amber-200 inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Pending MSA Creation
                    </span>
                  );

                  if (wo?.status === 'Submitted') {
                    badge = (
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-full border border-blue-200 inline-flex items-center gap-1">
                        <Send className="w-3.5 h-3.5" /> Pending Director Approval
                      </span>
                    );
                  } else if (wo?.status === 'Approved') {
                    badge = (
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full border border-emerald-200 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved by Director ({wo.approved_by || 'Director'})
                      </span>
                    );
                  } else if (wo?.status === 'Revision Requested') {
                    badge = (
                      <span className="px-2.5 py-1 bg-rose-50 text-rose-700 font-bold text-xs rounded-full border border-rose-200 inline-flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Revision Requested by Director
                      </span>
                    );
                  }

                  return (
                    <tr key={id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">{cand.candidate_name || cand.name}</div>
                        <div className="text-xs text-slate-400">{cand.candidate_email}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-800">{cand.requisition_title || 'Contract Role'}</div>
                        <div className="text-xs font-mono text-indigo-600">{cand.requisition_ref || 'REQ-ACTIVE'}</div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-medium">
                        {cand.vendor_name || user?.tenant_name || 'Vendor'}
                      </td>
                      <td className="py-4 px-6">{badge}</td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleOpenWorkOrder(cand)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer border-none"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {wo?.status === 'Revision Requested' ? 'Update & Resubmit MSA' : wo ? 'View / Edit MSA' : '✨ Generate MSA'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Master Services Agreement (MSA) Builder Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-8 shadow-2xl border border-slate-200 relative my-8 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setSelectedCandidate(null)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors border-none cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-extrabold text-xl">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Master Services Agreement (MSA) Builder</h2>
                <p className="text-xs text-slate-500">
                  Candidate: <strong className="text-slate-800">{selectedCandidate.candidate_name || selectedCandidate.name}</strong> ({selectedCandidate.requisition_title})
                </p>
              </div>
            </div>

            {/* AI Agent Autofill Header Banner */}
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" /> AI MSA Agent
                </div>
                <div className="text-sm font-medium text-slate-200">
                  Calculates billing rate bounded by Requisition Vendor Rate Floor & Cap.
                </div>
              </div>
              <button
                onClick={() => handleRunAiAutofill()}
                disabled={aiGenerating}
                className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs rounded-xl shadow-xs transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer border-none disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${aiGenerating ? 'animate-spin' : ''}`} />
                {aiGenerating ? 'AI Agent Processing...' : '✨ Run AI Autofill'}
              </button>
            </div>

            {/* AI Reasoning Summary */}
            {formData.ai_reasoning && (
              <div className="mb-6 p-4 rounded-xl bg-indigo-50/80 border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
                <strong className="font-bold text-indigo-950 block mb-1">🤖 AI Derivation Reasoning:</strong>
                {formData.ai_reasoning}
              </div>
            )}

            {/* Revision Notes Alert from Director if any */}
            {activeWorkOrder?.status === 'Revision Requested' && activeWorkOrder.revision_notes && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-relaxed shadow-2xs">
                <strong className="font-bold text-rose-950 block mb-1 text-sm flex items-center gap-1.5">
                  <AlertCircle size={16} className="text-rose-600" /> Director Revision Request & Rejection Reason:
                </strong>
                <p className="mt-1 font-medium bg-white/70 p-2.5 rounded-lg border border-rose-100 text-rose-950">
                  "{activeWorkOrder.revision_notes}"
                </p>
                <div className="mt-2 text-[11px] font-semibold text-rose-700">
                  Please adjust the rates, contract timeline, or scope of services below and click <strong>"Resubmit MSA to Director for Approval →"</strong>.
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Job Title</label>
                <input
                  type="text"
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-sans text-sm text-slate-900 outline-none focus:border-indigo-600 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Work Location</label>
                <select
                  value={formData.work_location}
                  onChange={(e) => setFormData({ ...formData, work_location: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-sans text-sm text-slate-900 outline-none focus:border-indigo-600 transition-colors bg-white"
                >
                  <option value="Remote">Remote</option>
                  <option value="Onsite">Onsite</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Vendor Rate Floor (₹) & Cap (₹)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Floor ₹"
                    value={formData.vendor_visible_floor}
                    onChange={(e) => setFormData({ ...formData, vendor_visible_floor: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                  />
                  <input
                    type="number"
                    placeholder="Cap ₹"
                    value={formData.vendor_visible_cap}
                    onChange={(e) => setFormData({ ...formData, vendor_visible_cap: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Agreed Billing Rate (₹ / month)
                </label>
                <input
                  type="number"
                  value={formData.billing_rate}
                  onChange={(e) => setFormData({ ...formData, billing_rate: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 font-bold text-base text-slate-900 outline-none focus:border-indigo-600 bg-indigo-50/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Contract Start Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-sans text-sm text-slate-900 outline-none focus:border-indigo-600 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Contract End Date</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-sans text-sm text-slate-900 outline-none focus:border-indigo-600 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Billing Cycle</label>
                <select
                  value={formData.billing_cycle}
                  onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-sans text-sm text-slate-900 outline-none focus:border-indigo-600 bg-white"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Bi-weekly">Bi-weekly</option>
                  <option value="Hourly">Hourly</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Payment Terms</label>
                <input
                  type="text"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-sans text-sm text-slate-900 outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Scope of Services & Deliverables (Manual Edit Enabled) */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Scope of Services & Deliverables
                </label>
                <span className="text-[11px] font-semibold text-indigo-600">✏️ Editable Manual Text</span>
              </div>
              <textarea
                rows="4"
                value={formData.scope_of_work}
                onChange={(e) => setFormData({ ...formData, scope_of_work: e.target.value })}
                placeholder="Specify key deliverables, responsibilities, and technical scope..."
                className="w-full p-3.5 rounded-xl border border-slate-200 font-sans text-sm text-slate-900 outline-none focus:border-indigo-600 transition-colors resize-y"
              ></textarea>
            </div>

            {/* Special Terms & Clauses (Manual Edit Enabled) */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Special Master Services Terms & Clauses
                </label>
                <span className="text-[11px] font-semibold text-indigo-600">✏️ Editable Manual Text</span>
              </div>
              <textarea
                rows="4"
                value={formData.special_terms}
                onChange={(e) => setFormData({ ...formData, special_terms: e.target.value })}
                placeholder="Enter confidentiality, NDA, IP ownership, and notice period clauses..."
                className="w-full p-3.5 rounded-xl border border-slate-200 font-sans text-sm text-slate-900 outline-none focus:border-indigo-600 transition-colors resize-y"
              ></textarea>
            </div>

            {/* Optional E-Signature File Upload */}
            <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-indigo-600" /> Optional E-Signature Agreement Document (PDF)
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Upload optional signed PDF agreement file, or use default digital approval signature flow.
                </div>
              </div>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
              />
            </div>

            {/* Footer Action Buttons */}
            <div className="flex flex-col md:flex-row items-center justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="w-full md:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer border-none bg-transparent"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSaveOrSubmit(false)}
                disabled={submitting}
                className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors cursor-pointer border-none disabled:opacity-50"
              >
                Save Draft
              </button>

              <button
                type="button"
                onClick={() => handleSaveOrSubmit(true)}
                disabled={submitting}
                className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer border-none disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Submitting...' : activeWorkOrder?.status === 'Revision Requested' ? 'Resubmit MSA to Director for Approval →' : 'Submit MSA to Director for Approval →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
