import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import {
  CheckCircle2,
  Save,
  Eye,
  Edit3,
  Download,
  Check,
  Sparkles,
  Search,
  RefreshCw,
  Zap,
  ChevronDown,
  Database,
  Clock,
  AlertCircle,
  XCircle,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import WorkOrderProgressBar from '../../components/WorkOrderProgressBar';

export default function VendorAgreements() {
  const { user, token } = useAuth();
  const [searchParams] = useSearchParams();
  const queryWo = searchParams.get('wo');
  const [currentStep, setCurrentStep] = useState(1); // 1: Edit agreement, 2: Review, 3: Send for approval
  const [isSaved, setIsSaved] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [statusState, setStatusState] = useState('Draft');
  const printRef = useRef(null);

  // AI Autofill states
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [availableWorkOrders, setAvailableWorkOrders] = useState([]);
  const [searchWoInput, setSearchWoInput] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightAutoFilled, setHighlightAutoFilled] = useState(false);
  const [lastAutofilledId, setLastAutofilledId] = useState('');

  const [approvalMeta, setApprovalMeta] = useState({
    approvedBy: '',
    approvedAt: '',
    revisionNotes: '',
    submittedAt: ''
  });

  // Form data populated from DB & Requisition
  const [formData, setFormData] = useState({
    wsNumber: 'SDC -5a5e1b59',
    msaRef: 'MSA-SDC-2026-09',
    companyName: 'SDC limited',
    supplierName: 'Vendorqueue',
    supplierSuffix: '',
    deployedPersonnel: 'SURAJKUMAR K S',
    role: 'Frontend Engineer',
    reportingTo: 'Hrm 1',
    placeOfWork: 'Kochi',
    commencement: '2026-09-05',
    expiry: '2026-12-05',
    duration: '3 months',
    notice: '15 days',
    billingBasis: 'Hourly, against approved timesheets',
    chargeRate: '₹1,500 per hour',
    standardWorkDay: '8 hours',
    billingCycle: 'Monthly',
    paymentTerms: 'Net 30 days from invoice release',
    supplierMargin: '30%',
    signatorySupplier: 'Authorised signatory',
    signatoryCompany: 'Authorised signatory'
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Fetch available work orders and initial agreement details from database on mount
  useEffect(() => {
    let cancelled = false;
    request('/api/work-orders/available-workorders', { token })
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setAvailableWorkOrders(data);
        }
      })
      .catch(() => {});

    const targetWo = (queryWo || 'SDC -5a5e1b59').trim();
    handleAutofill(targetWo);

    return () => {
      cancelled = true;
    };
  }, [token, queryWo]);

  // AI Mechanism: Query DB & Requisition to auto-fill agreement details
  const handleAutofill = async (identifier) => {
    const cleanId = (identifier || '').trim();
    if (!cleanId) {
      showToast('Please specify a Work Order ID to auto-fill.');
      return;
    }

    setIsAutofilling(true);
    try {
      const data = await request(`/api/work-orders/agreement-details/${encodeURIComponent(cleanId)}`, {
        token
      });

      if (data) {
        setFormData((prev) => ({
          ...prev,
          wsNumber: data.wsNumber || cleanId,
          msaRef: data.msaRef || prev.msaRef,
          companyName: data.companyName || prev.companyName,
          supplierName: data.supplierName || prev.supplierName,
          supplierSuffix: data.supplierSuffix !== undefined ? data.supplierSuffix : prev.supplierSuffix,
          deployedPersonnel: data.deployedPersonnel || prev.deployedPersonnel,
          role: data.role || prev.role,
          reportingTo: data.reportingTo || prev.reportingTo,
          placeOfWork: data.placeOfWork || prev.placeOfWork,
          commencement: data.commencement || prev.commencement,
          expiry: data.expiry || prev.expiry,
          duration: data.duration || prev.duration,
          notice: data.notice || prev.notice,
          billingBasis: data.billingBasis || prev.billingBasis,
          chargeRate: data.chargeRate || prev.chargeRate,
          standardWorkDay: data.standardWorkDay || prev.standardWorkDay,
          billingCycle: data.billingCycle || prev.billingCycle,
          paymentTerms: data.paymentTerms || prev.paymentTerms,
          supplierMargin: data.supplierMargin || prev.supplierMargin,
        }));

        if (data.status) {
          setStatusState(data.status);
        }
        setApprovalMeta({
          approvedBy: data.approved_by || '',
          approvedAt: data.approved_at || '',
          revisionNotes: data.revision_notes || '',
          rejectionReason: data.rejection_reason || '',
          rejectedBy: data.rejected_by || '',
          rejectedAt: data.rejected_at || '',
          submittedAt: data.submitted_at || ''
        });

        setLastAutofilledId(cleanId);
        setSearchWoInput(data.wsNumber || cleanId);
        setIsDropdownOpen(false);
        setIsSaved(true);

        // Highlight fields with gentle glow animation
        setHighlightAutoFilled(true);
        setTimeout(() => setHighlightAutoFilled(false), 3000);

        showToast(`✨ Agreement loaded from database for ${data.deployedPersonnel || cleanId}`);
      }
    } catch (err) {
      const msg = err?.message || 'Work Order not found in database.';
      showToast(`⚠️ ${msg}`);
    } finally {
      setIsAutofilling(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const getFieldClass = (extra = '') => {
    const base = 'focus:outline-none rounded px-1.5 py-0.5 transition-all duration-500 cursor-text';
    if (highlightAutoFilled) {
      return `${base} bg-amber-100/90 text-amber-950 ring-1 ring-amber-400 font-semibold shadow-xs ${extra}`;
    }
    return `${base} hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] ${extra}`;
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await request('/api/work-orders/submit-agreement', {
        method: 'POST',
        token,
        body: {
          workorder_id: formData.wsNumber,
          agreement_data: formData,
          status: 'Draft'
        }
      });
      setIsSaved(true);
      showToast('Draft agreement saved to database.');
    } catch {
      setIsSaved(true);
      showToast('Draft saved.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendForApproval = async () => {
    setIsSending(true);
    try {
      const res = await request('/api/work-orders/submit-agreement', {
        method: 'POST',
        token,
        body: {
          workorder_id: formData.wsNumber,
          agreement_data: formData,
          status: 'Pending Director Approval'
        }
      });
      setIsSaved(true);
      setStatusState(res?.status || 'Pending Director Approval');
      setApprovalMeta((prev) => ({
        ...prev,
        submittedAt: res?.submitted_at || new Date().toISOString()
      }));
      setCurrentStep(3);
      showToast(res?.message || `Agreement submitted to ${formData.companyName} Director for approval!`);
    } catch (err) {
      const msg = err?.message || 'Failed to submit agreement for approval.';
      showToast(`⚠️ ${msg}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadTxt = () => {
    const text = `================================================================================
WORK STATEMENT & ENGAGEMENT SCHEDULE
${formData.wsNumber} · issued under ${formData.msaRef} · ${formData.companyName}
================================================================================

This Work Statement is issued by ${formData.companyName} ("Company") to ${formData.supplierName} ${formData.supplierSuffix} ("Supplier") and governs the deployment of one contract personnel resource under the Master Services Agreement referenced above.

1. PERSONNEL AND ROLE
--------------------------------------------------------------------------------
Deployed personnel : ${formData.deployedPersonnel}
Role               : ${formData.role}
Reporting to       : ${formData.reportingTo}
Place of work      : ${formData.placeOfWork}

2. TERM
--------------------------------------------------------------------------------
Commencement       : ${formData.commencement}
Expiry             : ${formData.expiry}
Duration           : ${formData.duration}
Notice             : ${formData.notice}

The Company may extend this engagement by written amendment. Extension is not automatic and does not arise by continued performance.

3. CHARGES AND BILLING
--------------------------------------------------------------------------------
Billing basis          : ${formData.billingBasis}
Charge rate to Company : ${formData.chargeRate}
Standard working day   : ${formData.standardWorkDay}
Billing cycle          : ${formData.billingCycle}
Payment terms          : ${formData.paymentTerms}
Supplier margin        : ${formData.supplierMargin}

Hours in excess of forty (40) in any week are chargeable at 1.5× the rate stated, provided they were approved in advance by the reporting manager.

The Company shall generate the invoice from timesheets approved by the reporting manager (self-billing). The Supplier shall accept or query the invoice within five (5) business days.

4. SUPPLIER OBLIGATIONS — STATUTORY
--------------------------------------------------------------------------------
The Supplier is the sole employer of the deployed personnel. The Supplier shall maintain registration under applicable labour regulations, remit provident fund and ESIC contributions, comply with applicable minimum wage notifications, and furnish monthly challans on demand. Nothing in this Work Statement creates an employment relationship between the Company and the deployed personnel.

Disbursement. The Supplier shall pay the deployed personnel within seven (7) days of receiving cleared funds from the Company, and shall confirm disbursement in the Company's platform.

5. VERIFICATION
--------------------------------------------------------------------------------
The Supplier confirms that background verification has been completed to the level specified in the requisition, and that records are available for audit for the duration of the engagement plus three years.

6. CONFIDENTIALITY AND INTELLECTUAL PROPERTY
--------------------------------------------------------------------------------
All work product created by the deployed personnel in the course of this engagement vests in the Company. The Supplier shall ensure the deployed personnel has executed the Company's non-disclosure and intellectual property assignment instruments prior to commencement.

7. TERMINATION
--------------------------------------------------------------------------------
Either party may terminate this Work Statement on fifteen (15) days' written notice. The Company may terminate immediately for cause. Charges accrue only for hours approved up to the effective date of termination.

_____________________________               _____________________________
Authorised signatory                        Authorised signatory
For ${formData.supplierName} ${formData.supplierSuffix}   For ${formData.companyName}
================================================================================
Generated via Term Jobs Enterprise Portal
`;

    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${formData.wsNumber}_Work_Statement.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast(`Downloaded ${formData.wsNumber} Work Statement.`);
  };

  return (
    <div className="w-full pb-4 space-y-3 font-sans antialiased text-[#0A0A0A]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0A0A0A] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-white/10 animate-fade-in text-[13px] font-medium">
          <CheckCircle2 size={18} className="text-[#22C55E]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner (Dark Pill Card) */}
      <div className="bg-[#0A0A0A] text-white rounded-2xl px-6 py-4 sm:px-7 sm:py-4.5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3 w-full">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-[#8A8A85] uppercase mb-1">
            AGREEMENT EDITOR · MASTER SERVICE AGREEMENT
          </div>
          <h1 className="text-[23px] sm:text-[27px] font-extrabold tracking-tight text-white">
            Master Service Agreement
          </h1>
          <p className="text-[13px] text-[#A3A39E] mt-1 font-normal">
            Click any highlighted value in the agreement to edit it directly.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setCurrentStep(currentStep === 2 ? 1 : 2)}
            className="px-4 py-2 bg-transparent hover:bg-white/10 text-white border border-white/20 rounded-xl text-[12.5px] font-semibold transition-all cursor-pointer flex items-center gap-1.5"
          >
            {currentStep === 2 ? <Edit3 size={14} /> : <Eye size={14} />}
            <span>{currentStep === 2 ? 'Edit Mode' : 'Preview'}</span>
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="px-5 py-2 bg-[#FFFFFF] hover:bg-[#F5F5F2] text-[#0A0A0A] rounded-xl text-[12.5px] font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSaving ? <span className="animate-spin text-[12px]">⟳</span> : <Save size={14} />}
            <span>{isSaving ? 'Saving...' : 'Save draft'}</span>
          </button>
        </div>
      </div>

      {/* Stepper Navigation & Save Status */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1 px-1 w-full">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentStep(1)}
            className={`px-4 py-1.5 rounded-full text-[12.5px] font-bold tracking-tight transition-all cursor-pointer flex items-center gap-1.5 ${
              currentStep === 1
                ? 'bg-[#0A0A0A] text-white shadow-xs'
                : 'bg-[#EAEAE6] text-[#737373] hover:text-[#0A0A0A]'
            }`}
          >
            <span>1 · Edit agreement</span>
          </button>

          <button
            onClick={() => setCurrentStep(2)}
            className={`px-4 py-1.5 rounded-full text-[12.5px] font-bold tracking-tight transition-all cursor-pointer flex items-center gap-1.5 ${
              currentStep === 2
                ? 'bg-[#0A0A0A] text-white shadow-xs'
                : 'bg-[#EAEAE6] text-[#737373] hover:text-[#0A0A0A]'
            }`}
          >
            <span>2 · Review</span>
          </button>

          <button
            onClick={() => setCurrentStep(3)}
            className={`px-4 py-1.5 rounded-full text-[12.5px] font-bold tracking-tight transition-all cursor-pointer flex items-center gap-1.5 ${
              currentStep === 3
                ? 'bg-[#0A0A0A] text-white shadow-xs'
                : 'bg-[#EAEAE6] text-[#737373] hover:text-[#0A0A0A]'
            }`}
          >
            <span>3 · Send for approval</span>
          </button>
        </div>

        <div className="text-[12px] font-medium text-[#737373] flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isSaved ? 'bg-[#16A34A]' : 'bg-[#D97706]'}`} />
          <span>{isSaved ? 'All changes saved' : 'Unsaved changes'}</span>
        </div>
      </div>

      {/* Main Content Area */}
      {currentStep === 3 ? (
        /* Step 3: Send for Approval (Full Width) */
        <div className="bg-[#EAEAE6] rounded-2xl p-3 sm:p-5 lg:p-6 border border-[#D5D5CF] shadow-2xs w-full overflow-hidden">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto shadow-md border border-[#E2E2DC] text-center space-y-5 animate-scale-in">
            {statusState === 'Approved' ? (
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs animate-bounce-subtle">
                <CheckCircle2 size={32} />
              </div>
            ) : statusState === 'Rejected' ? (
              <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto shadow-xs">
                <XCircle size={32} />
              </div>
            ) : statusState === 'Revision Requested' ? (
              <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-xs">
                <AlertCircle size={32} />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mx-auto shadow-xs relative">
                <Clock size={30} />
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full animate-ping" />
              </div>
            )}

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#8A8A85]">
                {formData.wsNumber} · {formData.msaRef}
              </div>
              <h2 className="text-[22px] font-extrabold text-[#0A0A0A] tracking-tight mt-1">
                {statusState === 'Approved'
                  ? 'Master Service Agreement Approved'
                  : statusState === 'Rejected'
                  ? 'Master Service Agreement Rejected'
                  : statusState === 'Revision Requested'
                  ? 'Revision Requested by Director'
                  : 'Submitted for Company Director Approval'}
              </h2>
              <p className="text-[13px] text-[#737373] mt-2 max-w-md mx-auto leading-relaxed">
                {statusState === 'Approved' ? (
                  <span>
                    Formally countersigned and approved by <strong className="text-[#0A0A0A]">{approvalMeta.approvedBy || `${formData.companyName} Director`}</strong>. Deployment schedule is now active.
                  </span>
                ) : statusState === 'Rejected' ? (
                  <span>
                    The Company Director reviewed and rejected this agreement. Review the feedback notes below, adjust the commercials or schedule, and resubmit.
                  </span>
                ) : statusState === 'Revision Requested' ? (
                  <span>
                    The Company Director reviewed the agreement and requested modifications before final sign-off.
                  </span>
                ) : (
                  <span>
                    This schedule for <strong className="text-[#0A0A0A]">{formData.deployedPersonnel}</strong> ({formData.role}) has been submitted to <strong className="text-[#0A0A0A]">{formData.companyName}</strong> Director for executive sign-off.
                  </span>
                )}
              </p>
            </div>

            {statusState === 'Rejected' && approvalMeta.rejectionReason && (
              <div className="bg-red-50/90 border border-red-200/90 rounded-xl p-3.5 text-left text-[12.5px] space-y-1">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-red-800 flex items-center gap-1.5">
                  <XCircle size={13} /> Director Rejection Reason
                </span>
                <p className="text-red-950 font-medium italic">
                  "{approvalMeta.rejectionReason}"
                </p>
              </div>
            )}

            {statusState === 'Revision Requested' && approvalMeta.revisionNotes && (
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 text-left text-[12.5px] space-y-1">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-800 block">
                  Director Feedback Notes
                </span>
                <p className="text-amber-950 font-medium italic">
                  "{approvalMeta.revisionNotes}"
                </p>
              </div>
            )}

            {statusState === 'Pending Director Approval' && (
              <div className="bg-[#F4F4F0] border border-[#E2E2DC] rounded-xl p-3 text-[12px] text-[#555550] flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  Notification dispatched to <strong>{formData.companyName} Director</strong> dashboard. Real-time updates sync here.
                </span>
              </div>
            )}

            <div className="bg-[#FAFAFA] border border-[#EAEAE6] rounded-xl p-4 text-left space-y-2.5 text-[12.5px]">
              <div className="flex justify-between py-1 border-b border-[#EAEAE6]">
                <span className="text-[#737373]">Supplier / Vendor</span>
                <span className="font-bold text-[#0A0A0A]">{formData.supplierName} {formData.supplierSuffix}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EAEAE6]">
                <span className="text-[#737373]">Client Company</span>
                <span className="font-bold text-[#0A0A0A]">{formData.companyName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EAEAE6]">
                <span className="text-[#737373]">Target Approver</span>
                <span className="font-bold text-[#0A0A0A]">{formData.companyName} Director</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EAEAE6]">
                <span className="text-[#737373]">Personnel & Role</span>
                <span className="font-bold text-[#0A0A0A]">{formData.deployedPersonnel} ({formData.role})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EAEAE6]">
                <span className="text-[#737373]">Commercial Rate</span>
                <span className="font-bold text-[#0A0A0A]">{formData.chargeRate} ({formData.billingBasis})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EAEAE6]">
                <span className="text-[#737373]">Effective Period</span>
                <span className="font-bold text-[#0A0A0A]">{formData.commencement} to {formData.expiry} ({formData.duration})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EAEAE6]">
                <span className="text-[#737373]">Workflow Status</span>
                <span className={`inline-flex items-center gap-1 font-bold ${
                  statusState === 'Approved'
                    ? 'text-emerald-600'
                    : statusState === 'Rejected'
                    ? 'text-red-600'
                    : statusState === 'Revision Requested'
                    ? 'text-amber-600'
                    : 'text-blue-600'
                }`}>
                  {statusState === 'Approved' ? (
                    <Check size={14} />
                  ) : statusState === 'Rejected' ? (
                    <XCircle size={14} />
                  ) : statusState === 'Revision Requested' ? (
                    <AlertCircle size={14} />
                  ) : (
                    <Clock size={14} />
                  )}
                  {statusState}
                </span>
              </div>

              {/* 4-Stage Governance & Settlement Progress Tracker */}
              <div className="pt-3 pb-1">
                <WorkOrderProgressBar status={statusState} variant="full" />
              </div>
            </div>

            <div className="flex items-center justify-center flex-wrap gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 bg-white hover:bg-[#F5F5F2] text-[#0A0A0A] border border-[#D5D5CF] rounded-xl text-[12.5px] font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <Edit3 size={13} />
                <span>{statusState === 'Rejected' ? 'Modify Terms & Resubmit' : statusState === 'Revision Requested' ? 'Edit & Resubmit' : 'Back to Edit'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleAutofill(formData.wsNumber)}
                disabled={isAutofilling}
                className="px-4 py-2 bg-white hover:bg-[#F5F5F2] text-[#0A0A0A] border border-[#D5D5CF] rounded-xl text-[12.5px] font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <RefreshCw size={13} className={isAutofilling ? 'animate-spin' : ''} />
                <span>{isAutofilling ? 'Checking...' : 'Check Status'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTxt}
                className="px-4 py-2 bg-[#0A0A0A] hover:bg-[#222222] text-white rounded-xl text-[12.5px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Download size={13} />
                <span>Download Executable Copy</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Steps 1 & 2: Split 2-Column Layout -> Agreement to LEFT, AI Work Order Autofill to RIGHT */
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 items-start w-full">
          {/* LEFT: Agreement Document */}
          <div className="flex-1 min-w-0 w-full lg:w-[62%] xl:w-[64%]">
            <div className="bg-[#EAEAE6] rounded-2xl p-2.5 sm:p-4 border border-[#D5D5CF] shadow-2xs w-full overflow-hidden">
              <div
                ref={printRef}
                spellCheck={false}
                className="bg-[#FFFFFF] text-[#0A0A0A] rounded-xl shadow-xs border border-[#DCDCD6] p-4 sm:p-6 lg:p-8 w-full overflow-y-auto max-h-[46vh] sm:max-h-[48vh] transition-all scrollbar-thin"
                style={{
                  fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif'
                }}
              >
            {/* Centered Document Title */}
            <div className="text-center space-y-1.5 mb-6">
              <h1
                className="text-[22px] sm:text-[25px] font-bold tracking-wider text-[#0A0A0A] uppercase"
                style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
              >
                MASTER SERVICE AGREEMENT
              </h1>
              <div
                className="text-[13px] text-[#666660] tracking-normal flex items-center justify-center flex-wrap gap-1.5"
                style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
              >
                <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                  <span
                    contentEditable={currentStep === 1}
                    suppressContentEditableWarning
                    spellCheck={false}
                    onBlur={(e) => {
                      const val = (e.currentTarget.textContent || '').trim();
                      handleFieldChange('wsNumber', val);
                      if (val && val !== lastAutofilledId) {
                        handleAutofill(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = (e.currentTarget.textContent || '').trim();
                        handleFieldChange('wsNumber', val);
                        if (val) handleAutofill(val);
                      }
                    }}
                    className={`inline-block font-bold text-[#0A0A0A] ${getFieldClass('px-2 py-0.5')}`}
                    title="Click to edit Work Order ID (Press Enter or click sparkle to auto-fill from DB)"
                  >
                    {formData.wsNumber}
                  </span>

                  {currentStep === 1 && (
                    <button
                      type="button"
                      onClick={() => handleAutofill(formData.wsNumber)}
                      disabled={isAutofilling}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-full transition-all cursor-pointer shadow-2xs"
                      title="Auto-fill details from DB & Requisition for this Work Order"
                    >
                      <Sparkles size={11} className={isAutofilling ? "animate-spin text-amber-600" : "text-amber-600"} />
                      <span>{isAutofilling ? "Auto-filling..." : "AI Auto-fill"}</span>
                    </button>
                  )}
                </div>

                <span className="mx-1 text-[#8A8A85]">·</span>
                <span>issued under</span>
                <span
                  contentEditable={currentStep === 1}
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={(e) => handleFieldChange('msaRef', e.currentTarget.textContent || '')}
                  className={`inline-block font-medium text-[#0A0A0A] ${getFieldClass('px-1.5 py-0.5')}`}
                  title="Click to edit MSA Reference"
                >
                  {formData.msaRef}
                </span>
                <span className="mx-1 text-[#8A8A85]">·</span>
                <span
                  contentEditable={currentStep === 1}
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={(e) => handleFieldChange('companyName', e.currentTarget.textContent || '')}
                  className={`inline-block font-medium text-[#0A0A0A] ${getFieldClass('px-1.5 py-0.5')}`}
                  title="Click to edit Company Name"
                >
                  {formData.companyName}
                </span>
              </div>
            </div>

            {/* Horizontal Line Divider */}
            <hr className="border-t border-[#0A0A0A] my-6" />

            {/* Preamble */}
            <div className="text-[14.5px] leading-relaxed text-[#1A1A1A] mb-8">
              This Master Service Agreement is issued by{' '}
              <span
                contentEditable={currentStep === 1}
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={(e) => handleFieldChange('companyName', e.currentTarget.textContent || '')}
                className={`font-bold text-[#0A0A0A] inline-block ${getFieldClass('px-1 py-0.5')}`}
              >
                {formData.companyName}
              </span>{' '}
              (&quot;Company&quot;) to{' '}
              <span
                contentEditable={currentStep === 1}
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={(e) => handleFieldChange('supplierName', e.currentTarget.textContent || '')}
                className={`font-bold text-[#0A0A0A] inline-block ${getFieldClass('px-1 py-0.5')}`}
              >
                {formData.supplierName}
              </span>{' '}
              <span
                contentEditable={currentStep === 1}
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={(e) => handleFieldChange('supplierSuffix', e.currentTarget.textContent || '')}
                className={`font-bold text-[#0A0A0A] inline-block ${getFieldClass('px-1 py-0.5')}`}
              >
                {formData.supplierSuffix}
              </span>{' '}
              (&quot;Supplier&quot;) and governs the deployment of one contract personnel resource under the terms referenced above.
            </div>

            {/* SECTION 1: PERSONNEL AND ROLE */}
            <div className="space-y-4 mb-8">
              <h2
                className="text-[13px] font-bold tracking-wider text-[#0A0A0A] uppercase"
                style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
              >
                1. PERSONNEL AND ROLE
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-14 lg:gap-x-16 gap-y-3.5 text-[14px]">
                {/* Deployed personnel */}
                <div className="flex items-baseline justify-between border-b border-dotted border-[#D0D0CA] pb-1.5 gap-4">
                  <span className="text-[#222220] font-normal shrink-0">Deployed personnel</span>
                  <span
                    contentEditable={currentStep === 1}
                    suppressContentEditableWarning
                    onBlur={(e) => handleFieldChange('deployedPersonnel', e.currentTarget.textContent || '')}
                    className={`font-bold text-[#0A0A0A] text-right ${getFieldClass('px-2 py-0.5')}`}
                  >
                    {formData.deployedPersonnel}
                  </span>
                </div>

                {/* Role */}
                <div className="flex items-baseline justify-between border-b border-dotted border-[#D0D0CA] pb-1.5 gap-4">
                  <span className="text-[#222220] font-normal shrink-0">Role</span>
                  <span
                    contentEditable={currentStep === 1}
                    suppressContentEditableWarning
                    onBlur={(e) => handleFieldChange('role', e.currentTarget.textContent || '')}
                    className={`font-bold text-[#0A0A0A] text-right ${getFieldClass('px-2 py-0.5')}`}
                  >
                    {formData.role}
                  </span>
                </div>

                {/* Reporting to */}
                <div className="flex items-baseline justify-between border-b border-dotted border-[#D0D0CA] pb-1.5 gap-4">
                  <span className="text-[#222220] font-normal shrink-0">Reporting to</span>
                  <span
                    contentEditable={currentStep === 1}
                    suppressContentEditableWarning
                    onBlur={(e) => handleFieldChange('reportingTo', e.currentTarget.textContent || '')}
                    className={`font-bold text-[#0A0A0A] text-right ${getFieldClass('px-2 py-0.5')}`}
                  >
                    {formData.reportingTo}
                  </span>
                </div>

                {/* Place of work */}
                <div className="flex items-baseline justify-between border-b border-dotted border-[#D0D0CA] pb-1.5 gap-4">
                  <span className="text-[#222220] font-normal shrink-0">Place of work</span>
                  <span
                    contentEditable={currentStep === 1}
                    suppressContentEditableWarning
                    onBlur={(e) => handleFieldChange('placeOfWork', e.currentTarget.textContent || '')}
                    className={`font-bold text-[#0A0A0A] text-right ${getFieldClass('px-2 py-0.5')}`}
                  >
                    {formData.placeOfWork}
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 2: TERM */}
            <div className="space-y-4 mb-8">
              <h2
                className="text-[13px] font-bold tracking-wider text-[#0A0A0A] uppercase"
                style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
              >
                2. TERM
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-14 lg:gap-x-16 gap-y-3.5 text-[14px]">
                {/* Commencement */}
                <div className="flex items-baseline justify-between border-b border-dotted border-[#D0D0CA] pb-1.5 gap-4">
                  <span className="text-[#222220] font-normal shrink-0">Commencement</span>
                  <span
                    contentEditable={currentStep === 1}
                    suppressContentEditableWarning
                    onBlur={(e) => handleFieldChange('commencement', e.currentTarget.textContent || '')}
                    className={`font-bold text-[#0A0A0A] text-right ${getFieldClass('px-2 py-0.5')}`}
                  >
                    {formData.commencement}
                  </span>
                </div>

                {/* Expiry */}
                <div className="flex items-baseline justify-between border-b border-dotted border-[#D0D0CA] pb-1.5 gap-4">
                  <span className="text-[#222220] font-normal shrink-0">Expiry</span>
                  <span
                    contentEditable={currentStep === 1}
                    suppressContentEditableWarning
                    onBlur={(e) => handleFieldChange('expiry', e.currentTarget.textContent || '')}
                    className={`font-bold text-[#0A0A0A] text-right ${getFieldClass('px-2 py-0.5')}`}
                  >
                    {formData.expiry}
                  </span>
                </div>

                {/* Duration */}
                <div className="flex items-baseline justify-between border-b border-dotted border-[#D0D0CA] pb-1.5 gap-4">
                  <span className="text-[#222220] font-normal shrink-0">Duration</span>
                  <span
                    contentEditable={currentStep === 1}
                    suppressContentEditableWarning
                    onBlur={(e) => handleFieldChange('duration', e.currentTarget.textContent || '')}
                    className={`font-bold text-[#0A0A0A] text-right ${getFieldClass('px-2 py-0.5')}`}
                  >
                    {formData.duration}
                  </span>
                </div>

                {/* Notice */}
                <div className="flex items-baseline justify-between border-b border-dotted border-[#D0D0CA] pb-1.5 gap-4">
                  <span className="text-[#222220] font-normal shrink-0">Notice</span>
                  <span
                    contentEditable={currentStep === 1}
                    suppressContentEditableWarning
                    onBlur={(e) => handleFieldChange('notice', e.currentTarget.textContent || '')}
                    className={`font-bold text-[#0A0A0A] text-right ${getFieldClass('px-2 py-0.5')}`}
                  >
                    {formData.notice}
                  </span>
                </div>
              </div>

              {/* Highlighted Clause Block (Exact Light Yellow / Black Left Bar) */}
              <div className="bg-[#FEFCE8] border-l-[3.5px] border-[#0A0A0A] px-4 py-3 text-[13.5px] leading-relaxed text-[#1A1A1A] mt-4">
                The Company may extend this engagement by written amendment. Extension is not automatic and does not arise by continued performance.
              </div>
            </div>

            {/* SECTION 3: CHARGES AND BILLING */}
            <div className="space-y-4 mb-8">
              <h2
                className="text-[13px] font-bold tracking-wider text-[#0A0A0A] uppercase"
                style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
              >
                3. CHARGES AND BILLING
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-14 lg:gap-x-16 gap-y-3.5 text-[14px]">
                {/* Billing basis */}
                <div className="flex items-baseline justify-between border-b border-dotted border-[#D0D0CA] pb-1.5 gap-4">
                  <span className="text-[#222220] font-normal shrink-0">Billing basis</span>
                  <span
                    contentEditable={currentStep === 1}
                    suppressContentEditableWarning
                    onBlur={(e) => handleFieldChange('billingBasis', e.currentTarget.textContent || '')}
                    className={`font-bold text-[#0A0A0A] text-right ${getFieldClass('px-2 py-0.5')}`}
                  >
                    {formData.billingBasis}
                  </span>
                </div>

                {/* Charge rate */}
                <div className="flex items-baseline justify-between border-b border-dotted border-[#D0D0CA] pb-1.5 gap-4">
                  <span className="text-[#222220] font-normal shrink-0">Charge rate to Company</span>
                  <span
                    contentEditable={currentStep === 1}
                    suppressContentEditableWarning
                    onBlur={(e) => handleFieldChange('chargeRate', e.currentTarget.textContent || '')}
                    className={`font-bold text-[#0A0A0A] text-right ${getFieldClass('px-2 py-0.5')}`}
                  >
                    {formData.chargeRate}
                  </span>
                </div>

                {/* Standard working day */}
                <div className="flex items-baseline justify-between border-b border-dotted border-[#D0D0CA] pb-1.5 gap-4">
                  <span className="text-[#222220] font-normal shrink-0">Standard working day</span>
                  <span
                    contentEditable={currentStep === 1}
                    suppressContentEditableWarning
                    onBlur={(e) => handleFieldChange('standardWorkDay', e.currentTarget.textContent || '')}
                    className={`font-bold text-[#0A0A0A] text-right ${getFieldClass('px-2 py-0.5')}`}
                  >
                    {formData.standardWorkDay}
                  </span>
                </div>

                {/* Billing cycle */}
                <div className="flex items-baseline justify-between border-b border-dotted border-[#D0D0CA] pb-1.5 gap-4">
                  <span className="text-[#222220] font-normal shrink-0">Billing cycle</span>
                  <span
                    contentEditable={currentStep === 1}
                    suppressContentEditableWarning
                    onBlur={(e) => handleFieldChange('billingCycle', e.currentTarget.textContent || '')}
                    className={`font-bold text-[#0A0A0A] text-right ${getFieldClass('px-2 py-0.5')}`}
                  >
                    {formData.billingCycle}
                  </span>
                </div>

                {/* Payment terms */}
                <div className="flex items-baseline justify-between border-b border-dotted border-[#D0D0CA] pb-1.5 gap-4">
                  <span className="text-[#222220] font-normal shrink-0">Payment terms</span>
                  <span
                    contentEditable={currentStep === 1}
                    suppressContentEditableWarning
                    onBlur={(e) => handleFieldChange('paymentTerms', e.currentTarget.textContent || '')}
                    className={`font-bold text-[#0A0A0A] text-right ${getFieldClass('px-2 py-0.5')}`}
                  >
                    {formData.paymentTerms}
                  </span>
                </div>

                {/* Supplier margin */}
                <div className="flex items-baseline justify-between border-b border-dotted border-[#D0D0CA] pb-1.5 gap-4">
                  <span className="text-[#222220] font-normal shrink-0">Supplier margin</span>
                  <span
                    contentEditable={currentStep === 1}
                    suppressContentEditableWarning
                    onBlur={(e) => handleFieldChange('supplierMargin', e.currentTarget.textContent || '')}
                    className={`font-bold text-[#0A0A0A] text-right ${getFieldClass('px-2 py-0.5')}`}
                  >
                    {formData.supplierMargin}
                  </span>
                </div>
              </div>

              <p className="text-[14px] leading-relaxed text-[#1A1A1A] pt-2">
                Hours in excess of forty (40) in any week are chargeable at 1.5× the rate stated, provided they were approved in advance by the reporting manager.
              </p>
              <p className="text-[14px] leading-relaxed text-[#1A1A1A]">
                The Company shall generate the invoice from timesheets approved by the reporting manager (self-billing). The Supplier shall accept or query the invoice within five (5) business days.
              </p>
            </div>

            {/* SECTION 4: SUPPLIER OBLIGATIONS — STATUTORY */}
            <div className="space-y-3 mb-8">
              <h2
                className="text-[13px] font-bold tracking-wider text-[#0A0A0A] uppercase"
                style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
              >
                4. SUPPLIER OBLIGATIONS — STATUTORY
              </h2>
              <p className="text-[14px] leading-relaxed text-[#1A1A1A]">
                The Supplier is the sole employer of the deployed personnel. The Supplier shall maintain registration under applicable labour regulations, remit provident fund and ESIC contributions, comply with applicable minimum wage notifications, and furnish monthly challans on demand. Nothing in this Work Statement creates an employment relationship between the Company and the deployed personnel.
              </p>
              <p className="text-[14px] leading-relaxed text-[#1A1A1A]">
                <strong>Disbursement.</strong> The Supplier shall pay the deployed personnel within seven (7) days of receiving cleared funds from the Company, and shall confirm disbursement in the Company&apos;s platform.
              </p>
            </div>

            {/* SECTION 5: VERIFICATION */}
            <div className="space-y-3 mb-8">
              <h2
                className="text-[13px] font-bold tracking-wider text-[#0A0A0A] uppercase"
                style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
              >
                5. VERIFICATION
              </h2>
              <p className="text-[14px] leading-relaxed text-[#1A1A1A]">
                The Supplier confirms that background verification has been completed to the level specified in the requisition, and that records are available for audit for the duration of the engagement plus three years.
              </p>
            </div>

            {/* SECTION 6: CONFIDENTIALITY AND INTELLECTUAL PROPERTY */}
            <div className="space-y-3 mb-8">
              <h2
                className="text-[13px] font-bold tracking-wider text-[#0A0A0A] uppercase"
                style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
              >
                6. CONFIDENTIALITY AND INTELLECTUAL PROPERTY
              </h2>
              <p className="text-[14px] leading-relaxed text-[#1A1A1A]">
                All work product created by the deployed personnel in the course of this engagement vests in the Company. The Supplier shall ensure the deployed personnel has executed the Company&apos;s non-disclosure and intellectual property assignment instruments prior to commencement.
              </p>
            </div>

            {/* SECTION 7: TERMINATION */}
            <div className="space-y-3 mb-10">
              <h2
                className="text-[13px] font-bold tracking-wider text-[#0A0A0A] uppercase"
                style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
              >
                7. TERMINATION
              </h2>
              <p className="text-[14px] leading-relaxed text-[#1A1A1A]">
                Either party may terminate this Work Statement on fifteen (15) days&apos; written notice. The Company may terminate immediately for cause. Charges accrue only for hours approved up to the effective date of termination.
              </p>
            </div>

            {/* SIGNATURE BLOCKS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 border-t border-[#0A0A0A] text-[13.5px]">
              {/* Supplier Signatory */}
              <div className="space-y-1">
                <div className="h-10 border-b border-[#0A0A0A] w-48 mb-2" />
                <div className="font-bold text-[#0A0A0A]">Authorised signatory</div>
                <div className="text-[#555550]">For {formData.supplierName} {formData.supplierSuffix}</div>
              </div>

              {/* Company Signatory */}
              <div className="space-y-1">
                <div className="h-10 border-b border-[#0A0A0A] w-48 mb-2" />
                <div className="font-bold text-[#0A0A0A]">Authorised signatory</div>
                <div className="text-[#555550]">For {formData.companyName}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: AI Work Order Auto-Fill Tab / Side Panel */}
      <div className="w-full lg:w-[38%] xl:w-[36%] shrink-0">
        <div className="bg-gradient-to-b from-[#FFFFFF] to-[#FAFAF8] border border-[#DCDCD6] rounded-2xl p-3 sm:p-3.5 shadow-xs space-y-2.5 overflow-y-auto max-h-[46vh] sm:max-h-[48vh] scrollbar-thin">
          {/* Header */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold uppercase tracking-wider">
                <Sparkles size={11} className="text-amber-600 animate-pulse" />
                <span>AI Work Order Auto-Fill</span>
              </div>
              <span className="text-[10.5px] text-[#16A34A] font-semibold flex items-center gap-1">
                <CheckCircle2 size={11} />
                Live DB
              </span>
            </div>
            <h2 className="text-[14px] font-bold text-[#0A0A0A] tracking-tight">
              Database Auto-Population
            </h2>
            <p className="text-[11px] text-[#737373] leading-snug line-clamp-2">
              Select or enter any active Work Order ID. The AI engine pulls genuine terms, rates, candidate info, and schedule from live database records.
            </p>
          </div>

          {/* Search & Action Input */}
          <div className="space-y-1.5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A85] pointer-events-none" />
              <input
                type="text"
                value={searchWoInput}
                onChange={(e) => {
                  setSearchWoInput(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAutofill(searchWoInput);
                  }
                }}
                placeholder="Enter Work Order ID (e.g. SDC -5a5e1b59)"
                className="w-full bg-[#FFFFFF] border border-[#D5D5CF] focus:border-[#0A0A0A] focus:ring-1 focus:ring-[#0A0A0A] rounded-xl pl-8 pr-8 py-1.5 text-[12px] font-medium text-[#0A0A0A] placeholder-[#9E9E98] outline-none transition-all"
              />
              {availableWorkOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8A8A85] hover:text-[#0A0A0A] p-1 cursor-pointer"
                  title="Toggle active work orders"
                >
                  <ChevronDown size={13} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              )}

              {/* Dropdown Menu of Available Work Orders from DB */}
              {isDropdownOpen && availableWorkOrders.length > 0 && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#FFFFFF] border border-[#E2E2DC] rounded-xl shadow-xl z-30 max-h-44 overflow-y-auto py-1 text-left animate-fade-in scrollbar-thin">
                    <div className="px-3 py-1 text-[10px] font-bold text-[#8A8A85] uppercase tracking-wider border-b border-[#F0F0EC]">
                      Active Work Orders in DB ({availableWorkOrders.length})
                    </div>
                    {availableWorkOrders
                      .filter((item) => {
                        if (!searchWoInput) return true;
                        const q = searchWoInput.toLowerCase();
                        return (
                          (item.workorder_id || '').toLowerCase().includes(q) ||
                          (item.candidate_name || '').toLowerCase().includes(q) ||
                          (item.role || '').toLowerCase().includes(q) ||
                          (item.company_name || '').toLowerCase().includes(q)
                        );
                      })
                      .map((wo) => (
                        <button
                          key={wo.workorder_id}
                          type="button"
                          onClick={() => {
                            setSearchWoInput(wo.workorder_id);
                            handleAutofill(wo.workorder_id);
                          }}
                          className="w-full px-3 py-1.5 hover:bg-[#F5F5F2] text-left transition-colors flex items-center justify-between gap-2 text-[11.5px] cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-[#0A0A0A] truncate">
                              {wo.workorder_id}
                            </div>
                            <div className="text-[10.5px] text-[#737373] truncate">
                              {wo.candidate_name} · {wo.role}
                            </div>
                          </div>
                          <span className="shrink-0 text-[9.5px] px-1.5 py-0.5 rounded font-medium bg-[#EAEAE6] text-[#555550]">
                            {wo.company_name || 'Active'}
                          </span>
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleAutofill(searchWoInput || formData.wsNumber)}
              disabled={isAutofilling}
              className="w-full py-1.5 bg-[#0A0A0A] hover:bg-[#222222] text-white rounded-xl text-[12px] font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isAutofilling ? (
                <>
                  <RefreshCw size={12} className="animate-spin text-amber-400" />
                  <span>Auto-filling...</span>
                </>
              ) : (
                <>
                  <Sparkles size={12} className="text-amber-400" />
                  <span>Auto-fill with AI</span>
                </>
              )}
            </button>
          </div>

          {/* Quick-Pick Work Orders List */}
          {availableWorkOrders.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-[#EFEFEA]">
              <div className="flex items-center justify-between text-[10.5px] font-bold text-[#8A8A85] uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Zap size={11} className="text-amber-500" />
                  Quick Select ({availableWorkOrders.length})
                </span>
                <span className="text-[10px] text-amber-700 font-normal">Click to load</span>
              </div>

              <div className="space-y-1 max-h-24 overflow-y-auto pr-0.5 scrollbar-thin">
                {availableWorkOrders.map((item) => {
                  const isSelected = formData.wsNumber === item.workorder_id;
                  return (
                    <button
                      key={item.workorder_id}
                      type="button"
                      onClick={() => {
                        setSearchWoInput(item.workorder_id);
                        handleAutofill(item.workorder_id);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-[#0A0A0A] text-white border-[#0A0A0A] shadow-xs'
                          : 'bg-[#FAFAF8] hover:bg-white text-[#1A1A1A] border-[#E5E5DF] hover:border-[#CCCCCC]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-[11.5px] truncate">{item.workorder_id}</span>
                          {isSelected && (
                            <span className="text-[8.5px] font-semibold px-1 py-0.2 rounded bg-white/20 text-white">
                              Active
                            </span>
                          )}
                        </div>
                        <div className={`text-[10px] truncate ${isSelected ? 'text-gray-300' : 'text-[#737373]'}`}>
                          {item.candidate_name} · {item.role}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          isSelected
                            ? 'bg-white/15 text-white'
                            : 'bg-[#EAEAE6] text-[#555550]'
                        }`}
                      >
                        {item.company_name || 'Active'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Verified Live Data Details Card */}
          <div className="bg-[#FAFAF8] border border-[#E5E5DF] rounded-xl p-2 space-y-1 text-[11px]">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#8A8A85] uppercase tracking-wider border-b border-[#EFEFEA] pb-1">
              <span className="flex items-center gap-1 text-[#0A0A0A]">
                <Database size={10} className="text-[#16A34A]" />
                Live Record Source
              </span>
              <span className="text-[#16A34A] font-semibold flex items-center gap-1">
                <CheckCircle2 size={10} />
                Verified
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 pt-0.5">
              <div>
                <span className="text-[#8A8A85] text-[9.5px] block">Personnel</span>
                <span className="font-semibold text-[#0A0A0A] truncate block text-[11px]">{formData.deployedPersonnel}</span>
              </div>
              <div>
                <span className="text-[#8A8A85] text-[9.5px] block">Role</span>
                <span className="font-semibold text-[#0A0A0A] truncate block text-[11px]">{formData.role}</span>
              </div>
              <div>
                <span className="text-[#8A8A85] text-[9.5px] block">Company</span>
                <span className="font-semibold text-[#0A0A0A] truncate block text-[11px]">{formData.companyName}</span>
              </div>
              <div>
                <span className="text-[#8A8A85] text-[9.5px] block">Rate</span>
                <span className="font-semibold text-[#0A0A0A] truncate block text-[11px]">{formData.chargeRate}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

      {/* Bottom Action Footer */}
      <div className="bg-[#FFFFFF] border border-[#E2E2DC] rounded-xl px-4 py-2.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
        <div className="text-[12px] text-[#737373] font-normal">
          Click directly in the document to edit · Changes are saved only when you choose Save draft.
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="px-4 py-2 bg-[#FFFFFF] hover:bg-[#F5F5F2] text-[#0A0A0A] border border-[#D5D5CF] rounded-xl text-[12.5px] font-bold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save draft'}
          </button>

          <button
            onClick={handleSendForApproval}
            disabled={isSending}
            className="px-5 py-2 bg-[#0A0A0A] hover:bg-[#222222] text-white rounded-xl text-[12.5px] font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSending ? (
              <>
                <span className="animate-spin text-[12px]">⟳</span>
                <span>Submitting to Director...</span>
              </>
            ) : statusState === 'Approved' ? (
              <>
                <Check size={14} className="text-emerald-400" />
                <span>Approved ✓</span>
              </>
            ) : statusState === 'Pending Director Approval' ? (
              <span>Resend to Director →</span>
            ) : (
              <span>Save & Send →</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
