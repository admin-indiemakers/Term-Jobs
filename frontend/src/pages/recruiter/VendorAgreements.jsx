import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle2,
  Save,
  Eye,
  Edit3,
  Download,
  Check
} from 'lucide-react';

export default function VendorAgreements() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1); // 1: Edit agreement, 2: Review, 3: Send for approval
  const [isSaved, setIsSaved] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [statusState, setStatusState] = useState('Draft');
  const printRef = useRef(null);

  // Exact data matching user screenshot
  const [formData, setFormData] = useState({
    wsNumber: 'WSOW-2026-0412',
    msaRef: 'MSA-TB-2026-09',
    companyName: 'PepsiCo India Holdings Pvt Ltd',
    supplierName: 'TalentBridge',
    supplierSuffix: 'Staffing Pvt Ltd',
    deployedPersonnel: 'Sandeep Rao',
    role: 'DevOps Engineer',
    reportingTo: 'Arun Deshpande, Engineering',
    placeOfWork: 'Gurgaon',
    commencement: '2026-09-15',
    expiry: '2027-03-15',
    duration: '6 months',
    notice: '15 days',
    billingBasis: 'Hourly, against approved timesheets',
    chargeRate: '₹1,450 per hour',
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

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const handleSaveDraft = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setIsSaved(true);
      showToast('Draft saved successfully.');
    }, 450);
  };

  const handleSendForApproval = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setIsSaved(true);
      setStatusState('Sent for Approval');
      setCurrentStep(3);
      showToast('Work Statement submitted for client approval!');
    }, 600);
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
    <div className="w-full pb-16 space-y-4 font-sans antialiased text-[#0A0A0A]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0A0A0A] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-white/10 animate-fade-in text-[13px] font-medium">
          <CheckCircle2 size={18} className="text-[#22C55E]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner (Dark Pill Card) */}
      <div className="bg-[#0A0A0A] text-white rounded-2xl px-6 py-5 sm:px-8 sm:py-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-[#8A8A85] uppercase mb-1">
            AGREEMENT EDITOR · WORK STATEMENT
          </div>
          <h1 className="text-[23px] sm:text-[27px] font-extrabold tracking-tight text-white">
            Work Statement & Engagement Schedule
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

      {/* Outer Container with Internal Scroll */}
      <div className="bg-[#EAEAE6] rounded-2xl p-4 sm:p-7 lg:p-9 border border-[#D5D5CF] shadow-2xs w-full overflow-hidden">
        {currentStep === 3 ? (
          /* Step 3: Send for Approval */
          <div className="bg-white rounded-2xl p-8 max-w-2xl mx-auto shadow-md border border-[#E2E2DC] text-center space-y-5 animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-[#F0FDF4] text-[#16A34A] flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#8A8A85]">
                {formData.wsNumber}
              </div>
              <h2 className="text-[22px] font-extrabold text-[#0A0A0A] tracking-tight mt-1">
                Work Statement Prepared for Approval
              </h2>
              <p className="text-[13px] text-[#737373] mt-2 max-w-md mx-auto leading-relaxed">
                This schedule governs the deployment of <strong>{formData.deployedPersonnel}</strong> ({formData.role}) to <strong>{formData.companyName}</strong> at <strong>{formData.chargeRate}</strong>.
              </p>
            </div>

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
                <span className="text-[#737373]">Effective Period</span>
                <span className="font-bold text-[#0A0A0A]">{formData.commencement} to {formData.expiry} ({formData.duration})</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#737373]">Workflow Status</span>
                <span className="inline-flex items-center gap-1 font-bold text-[#16A34A]">
                  <Check size={14} /> {statusState}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 bg-white hover:bg-[#F5F5F2] text-[#0A0A0A] border border-[#D5D5CF] rounded-xl text-[12.5px] font-bold transition-all cursor-pointer shadow-2xs"
              >
                Back to Edit
              </button>
              <button
                onClick={handleDownloadTxt}
                className="px-4 py-2 bg-[#0A0A0A] hover:bg-[#222222] text-white rounded-xl text-[12.5px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Download size={14} />
                <span>Download Executable Copy</span>
              </button>
            </div>
          </div>
        ) : (
          /* Step 1 & 2: Large White Document Card with Exact Typography & Grey Hover/Touch Effect */
          <div
            ref={printRef}
            className="bg-[#FFFFFF] text-[#0A0A0A] rounded-xl shadow-xs border border-[#DCDCD6] p-8 sm:p-12 lg:p-16 max-w-[960px] mx-auto w-full overflow-y-auto max-h-[75vh] transition-all"
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
                WORK STATEMENT &amp; ENGAGEMENT SCHEDULE
              </h1>
              <div
                className="text-[13px] text-[#666660] tracking-normal"
                style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
              >
                <span>{formData.wsNumber}</span>
                <span className="mx-2">·</span>
                <span>issued under {formData.msaRef}</span>
                <span className="mx-2">·</span>
                <span>{formData.companyName}</span>
              </div>
            </div>

            {/* Horizontal Line Divider */}
            <hr className="border-t border-[#0A0A0A] my-6" />

            {/* Preamble */}
            <div className="text-[14.5px] leading-relaxed text-[#1A1A1A] mb-8">
              This Work Statement is issued by{' '}
              <span
                contentEditable={currentStep === 1}
                suppressContentEditableWarning
                onBlur={(e) => handleFieldChange('companyName', e.currentTarget.textContent || '')}
                className="font-bold text-[#0A0A0A] hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-1 py-0.5 transition-colors cursor-text inline-block"
              >
                {formData.companyName}
              </span>{' '}
              (&quot;Company&quot;) to{' '}
              <span
                contentEditable={currentStep === 1}
                suppressContentEditableWarning
                onBlur={(e) => handleFieldChange('supplierName', e.currentTarget.textContent || '')}
                className="font-bold text-[#0A0A0A] underline decoration-wavy decoration-red-500 underline-offset-4 hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-1 py-0.5 transition-colors cursor-text inline-block"
              >
                {formData.supplierName}
              </span>{' '}
              <span
                contentEditable={currentStep === 1}
                suppressContentEditableWarning
                onBlur={(e) => handleFieldChange('supplierSuffix', e.currentTarget.textContent || '')}
                className="font-bold text-[#0A0A0A] hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-1 py-0.5 transition-colors cursor-text inline-block"
              >
                {formData.supplierSuffix}
              </span>{' '}
              (&quot;Supplier&quot;) and governs the deployment of one contract personnel resource under the Master Services Agreement referenced above.
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
                    className="font-bold text-[#0A0A0A] text-right hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-2 py-0.5 transition-colors cursor-text"
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
                    className="font-bold text-[#0A0A0A] text-right hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-2 py-0.5 transition-colors cursor-text"
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
                    className="font-bold text-[#0A0A0A] text-right hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-2 py-0.5 transition-colors cursor-text"
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
                    className="font-bold text-[#0A0A0A] text-right hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-2 py-0.5 transition-colors cursor-text"
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
                    className="font-bold text-[#0A0A0A] text-right hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-2 py-0.5 transition-colors cursor-text"
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
                    className="font-bold text-[#0A0A0A] text-right hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-2 py-0.5 transition-colors cursor-text"
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
                    className="font-bold text-[#0A0A0A] text-right hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-2 py-0.5 transition-colors cursor-text"
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
                    className="font-bold text-[#0A0A0A] text-right hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-2 py-0.5 transition-colors cursor-text"
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
                    className="font-bold text-[#0A0A0A] text-right hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-2 py-0.5 transition-colors cursor-text"
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
                    className="font-bold text-[#0A0A0A] text-right hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-2 py-0.5 transition-colors cursor-text"
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
                    className="font-bold text-[#0A0A0A] text-right hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-2 py-0.5 transition-colors cursor-text"
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
                    className="font-bold text-[#0A0A0A] text-right hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-2 py-0.5 transition-colors cursor-text"
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
                    className="font-bold text-[#0A0A0A] text-right hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-2 py-0.5 transition-colors cursor-text"
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
                    className="font-bold text-[#0A0A0A] text-right hover:bg-[#EAEAEA] focus:bg-[#EAEAEA] focus:outline-none rounded px-2 py-0.5 transition-colors cursor-text"
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
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="bg-[#FFFFFF] border border-[#E2E2DC] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
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
            <span>{isSending ? 'Sending...' : 'Save & Send →'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
