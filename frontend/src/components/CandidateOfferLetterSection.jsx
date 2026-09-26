import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  Printer,
  Edit3,
  Eye,
  Save,
  Send,
  RefreshCw,
  Building2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  Zap,
} from 'lucide-react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';

// Helper inline-editable field component
function InlineField({
  value,
  onChange,
  placeholder = '',
  isEditing = true,
  type = 'text',
  multiline = false,
  rows = 2,
  style = {},
  className = '',
}) {
  if (!isEditing) {
    return (
      <span style={{ fontWeight: 'inherit', color: 'inherit', ...style }}>
        {value || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>&lt;{placeholder}&gt;</span>}
      </span>
    );
  }

  if (multiline) {
    return (
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ? `<${placeholder}>` : ''}
        rows={rows}
        className={`inline-field-multiline ${className}`}
        style={{
          width: '100%',
          background: 'rgba(59, 130, 246, 0.05)',
          border: '1.5px dashed #93C5FD',
          borderRadius: '6px',
          padding: '6px 10px',
          color: 'inherit',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          fontWeight: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
          resize: 'vertical',
          transition: 'all 0.15s ease',
          ...style,
        }}
      />
    );
  }

  const displayVal = value !== undefined && value !== null ? String(value) : '';
  const ph = placeholder ? String(placeholder) : '';
  // Ensure generous width so full name, email, and titles never truncate
  const charLen = Math.max(displayVal.length, ph.length, 3);
  const autoWidth = `${charLen + 3}ch`;

  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ? `<${placeholder}>` : ''}
      className={`inline-field ${className}`}
      style={{
        background: 'rgba(59, 130, 246, 0.06)',
        border: 'none',
        borderBottom: '1.5px dashed #60A5FA',
        borderRadius: '4px',
        padding: '2px 8px',
        color: 'inherit',
        fontFamily: 'inherit',
        fontSize: 'inherit',
        fontWeight: 'inherit',
        textAlign: style.textAlign || 'inherit',
        outline: 'none',
        display: 'inline-block',
        width: style.width || autoWidth,
        minWidth: style.minWidth || `${Math.max(6, ph.length + 2)}ch`,
        maxWidth: style.maxWidth || '100%',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s ease, background 0.15s ease',
        ...style,
      }}
    />
  );
}

export default function CandidateOfferLetterSection({
  candidateId,
  candidateName,
  candidateEmail,
  jobTitle,
  companyName,
  location,
  onOfferSent,
}) {
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Mode: inline editing enabled (true) vs clean read-only preview (false)
  const [isEditing, setIsEditing] = useState(true);
  const [isSectionOpen, setIsSectionOpen] = useState(true);

  // Offer Letter Data model matching all 5 pages of the PDF
  const [offer, setOffer] = useState({
    candidate_id: candidateId,
    candidate_name: candidateName || 'Arjun M',
    candidate_email: candidateEmail || '',
    job_title: jobTitle || 'DevSecOps Engineer',
    company_name: companyName || user?.tenant_name || 'TCS',
    company_address: 'Corporate Technology Park, Outer Ring Road, Bengaluru, Karnataka 560103',
    offer_date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    joining_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    mobility_clause:
      'You should be aware that you might be subject to transfer to another city or location where the Company operates a business or will operate a business in the future, to carry on similar responsibilities whenever the requirement arises.',
    contract_period: 'Unlimited / Full Time',
    leave_policy: {
      earned_leave: 18,
      casual_leave: 12,
      sick_leave: 12,
      restricted_holidays: 3,
    },
    termination_company_notice_days: 30,
    termination_employee_notice_days: 30,
    probation_period_months: 3,
    non_compete_period: '12 months',
    annexure: {
      grade: 'Band L4 / Senior Specialist',
      department: 'Cloud & Platform Engineering',
      reporting_to: 'Engineering Director / Hiring Lead',
      work_location: location || 'Bengaluru / Hybrid',
      contract_type: 'Full Time',
      currency: 'INR (₹)',
      basic_salary_annual: 900000,
      basic_salary_monthly: 75000,
      hra_annual: 450000,
      hra_monthly: 37500,
      other_allowance_annual: 270000,
      other_allowance_monthly: 22500,
      pf_annual: 180000,
      pf_monthly: 15000,
      total_fixed_annual: 1800000,
      total_fixed_monthly: 150000,
      meal_voucher_monthly: 3000,
      annual_bonus_percentage: 10,
      medical_insurance_coverage: '₹5,00,000 for employee, spouse, children & parents',
      life_insurance_coverage: 'Group Life Insurance policy up to 3x Annual CTC',
      gratuity_terms: 'As per Payment of Gratuity Act, 1972',
    },
    hr_signatory_name: user?.name || 'Rakesh Sharma',
    hr_signatory_title: 'VP – Human Resources',
    status: 'Draft',
  });

  // Load existing or default offer letter
  const loadOfferLetter = async () => {
    if (!candidateId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await request(`/api/candidates/${encodeURIComponent(candidateId)}/offer-letter`, { token });
      if (res && res.offer) {
        const fetched = res.offer;
        const resolvedName = (fetched.candidate_name && fetched.candidate_name !== 'Candidate Name')
          ? fetched.candidate_name
          : (candidateName || 'Arjun M');
        const resolvedEmail = fetched.candidate_email || candidateEmail || '';

        setOffer((prev) => ({
          ...prev,
          ...fetched,
          candidate_name: resolvedName,
          candidate_email: resolvedEmail,
          job_title: fetched.job_title || jobTitle || prev.job_title,
          company_name: fetched.company_name || companyName || prev.company_name,
          annexure: {
            ...prev.annexure,
            ...(fetched.annexure || {}),
          },
          leave_policy: {
            ...prev.leave_policy,
            ...(fetched.leave_policy || {}),
          },
        }));
      }
    } catch {
      // Keep defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOfferLetter();
  }, [candidateId, token]);

  // Synchronize when parent finishes loading candidate details asynchronously
  useEffect(() => {
    setOffer((prev) => {
      let changed = false;
      const next = { ...prev };
      if (candidateName && (!prev.candidate_name || prev.candidate_name === 'Candidate Name')) {
        next.candidate_name = candidateName;
        changed = true;
      }
      if (candidateEmail && !prev.candidate_email) {
        next.candidate_email = candidateEmail;
        changed = true;
      }
      if (jobTitle && (!prev.job_title || prev.job_title === 'DevSecOps Engineer')) {
        next.job_title = jobTitle;
        changed = true;
      }
      if (companyName && (!prev.company_name || prev.company_name === 'TCS')) {
        next.company_name = companyName;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [candidateName, candidateEmail, jobTitle, companyName]);

  // Live Auto-Calculate CTC Split
  const handleRecalculateCtc = (customTotal = null) => {
    const total = customTotal != null ? Math.max(0, parseInt(customTotal, 10) || 0) : offer.annexure.total_fixed_annual;
    const monthlyTotal = Math.round(total / 12);
    const basicA = Math.round(total * 0.5);
    const basicM = Math.round(basicA / 12);
    const hraA = Math.round(total * 0.25);
    const hraM = Math.round(hraA / 12);
    const otherA = Math.round(total * 0.15);
    const otherM = Math.round(otherA / 12);
    const pfA = Math.round(total * 0.1);
    const pfM = Math.round(pfA / 12);

    setOffer((prev) => ({
      ...prev,
      annexure: {
        ...prev.annexure,
        total_fixed_annual: total,
        total_fixed_monthly: monthlyTotal,
        basic_salary_annual: basicA,
        basic_salary_monthly: basicM,
        hra_annual: hraA,
        hra_monthly: hraM,
        other_allowance_annual: otherA,
        other_allowance_monthly: otherM,
        pf_annual: pfA,
        pf_monthly: pfM,
      },
    }));
  };

  // Save Offer Draft
  const handleSaveOffer = async () => {
    setSaving(true);
    setSaveSuccess('');
    setErrorMsg('');
    try {
      const res = await request(`/api/candidates/${encodeURIComponent(candidateId)}/offer-letter`, {
        method: 'POST',
        token,
        body: { offer },
      });
      setSaveSuccess(res?.message || 'Offer letter saved successfully.');
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to save offer letter.');
    } finally {
      setSaving(false);
    }
  };

  // Formally Send Offer to Candidate
  const handleSendOffer = async () => {
    if (!window.confirm(`Formally dispatch employment offer letter to ${offer.candidate_name}?`)) {
      return;
    }
    setSending(true);
    setSendSuccess('');
    setErrorMsg('');
    try {
      await request(`/api/candidates/${encodeURIComponent(candidateId)}/offer-letter`, {
        method: 'POST',
        token,
        body: { offer },
      });

      const res = await request(`/api/candidates/${encodeURIComponent(candidateId)}/offer-letter/send`, {
        method: 'POST',
        token,
      });

      setSendSuccess(res?.message || 'Offer letter formally dispatched to candidate!');
      setOffer((prev) => ({ ...prev, status: 'Offer Extended' }));
      if (onOfferSent) onOfferSent();
      setTimeout(() => setSendSuccess(''), 5000);
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to dispatch offer letter.');
    } finally {
      setSending(false);
    }
  };

  // Browser Print / Save as PDF
  const handlePrint = () => {
    const prevEditing = isEditing;
    setIsEditing(false);
    setTimeout(() => {
      window.print();
      setIsEditing(prevEditing);
    }, 150);
  };

  const currencySymbol = offer.annexure.currency?.includes('USD') ? '$' : '₹';

  return (
    <div className="offer-letter-section" style={{ marginTop: '24px' }}>
      {/* Print-specific Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .printable-offer-document, .printable-offer-document * {
            visibility: visible !important;
          }
          .printable-offer-document {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 28px !important;
            background: #ffffff !important;
            color: #111827 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-before: always;
            break-before: page;
            padding-top: 40px !important;
          }
          .inline-field, .inline-field-multiline {
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Main Container Card */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '20px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Top Control Bar */}
        <div
          className="no-print"
          style={{
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
              }}
            >
              <FileText size={20} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#34D399' }}>
                  Interactive PDF Offer Letter
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: offer.status === 'Offer Extended' ? '#065F46' : 'rgba(255, 255, 255, 0.15)',
                    color: offer.status === 'Offer Extended' ? '#6EE7B7' : '#E2E8F0',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  {offer.status === 'Offer Extended' ? '✓ Offer Extended' : '● Live Fillable Document'}
                </span>
              </div>
              <h3 style={{ margin: '2px 0 0 0', fontSize: '1.15rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                Employment Offer & Annexure A — Click Any Text to Edit
              </h3>
            </div>
          </div>

          {/* Action Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Inline Editing Toggle */}
            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '10px',
                border: isEditing ? '1.5px solid #10B981' : '1px solid rgba(255, 255, 255, 0.2)',
                background: isEditing ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                color: isEditing ? '#6EE7B7' : '#E2E8F0',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
              title="Toggle inline interactive editing inside the PDF"
            >
              {isEditing ? <Edit3 size={14} /> : <Eye size={14} />}
              <span>{isEditing ? '✏️ Fill Mode Active' : '👁 Clean Read View'}</span>
            </button>

            {/* Quick Auto-Distribute CTC Button */}
            {isEditing && (
              <button
                type="button"
                onClick={() => handleRecalculateCtc()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '7px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#CBD5E1',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Recalculate 50% Basic, 25% HRA, 15% Other, 10% PF based on Total CTC"
              >
                <RefreshCw size={13} />
                <span>Auto-Split CTC</span>
              </button>
            )}

            {/* Print / Save PDF */}
            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Print or Save as PDF"
            >
              <Printer size={14} />
              <span>Print / PDF</span>
            </button>

            {/* Save Draft */}
            <button
              type="button"
              onClick={handleSaveOffer}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 15px',
                borderRadius: '10px',
                background: '#334155',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Save size={14} />
              <span>{saving ? 'Saving…' : 'Save Changes'}</span>
            </button>

            {/* Send Offer to Candidate */}
            <button
              type="button"
              onClick={handleSendOffer}
              disabled={sending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 18px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                color: '#FFFFFF',
                border: 0,
                fontSize: '0.78rem',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
              }}
            >
              <Send size={14} />
              <span>{sending ? 'Dispatching…' : 'Send Offer Letter'}</span>
            </button>

            {/* Toggle Collapse */}
            <button
              type="button"
              onClick={() => setIsSectionOpen((v) => !v)}
              style={{
                background: 'transparent',
                border: 0,
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              {isSectionOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
        </div>

        {/* Feedback Banners */}
        {saveSuccess && (
          <div className="no-print" style={{ padding: '12px 24px', background: '#ECFDF5', borderBottom: '1px solid #A7F3D0', color: '#065F46', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="#059669" />
            <span>{saveSuccess}</span>
          </div>
        )}
        {sendSuccess && (
          <div className="no-print" style={{ padding: '14px 24px', background: '#ECFDF5', borderBottom: '1px solid #10B981', color: '#065F46', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#059669" />
            <span>{sendSuccess}</span>
          </div>
        )}
        {errorMsg && (
          <div className="no-print" style={{ padding: '12px 24px', background: '#FFF1F2', borderBottom: '1px solid #FECDD3', color: '#BE123C', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} color="#E11D48" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isEditing && isSectionOpen && (
          <div
            className="no-print"
            style={{
              padding: '10px 24px',
              background: '#F0FDF4',
              borderBottom: '1px solid #BBF7D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.78rem',
              color: '#065F46',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color="#059669" />
              <span>
                <strong>WYSIWYG Mode Active:</strong> Click directly into any highlighted text, date, name, or salary number in the PDF below to edit and fill in real time.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#047857',
                fontWeight: 800,
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              Hide Highlights
            </button>
          </div>
        )}

        {isSectionOpen && (
          <div style={{ padding: '30px 24px', background: '#F8FAFC' }}>
            {/* ======================================================== */}
            {/* INLINE-EDITABLE PDF DOCUMENT CANVAS                       */}
            {/* Exactly structured matching all 5 pages from the sample   */}
            {/* ======================================================== */}
            <div
              className="printable-offer-document"
              style={{
                maxWidth: '850px',
                margin: '0 auto',
                background: '#FFFFFF',
                padding: '48px 56px',
                borderRadius: '16px',
                border: '1px solid #CBD5E1',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.06)',
                color: '#1E293B',
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                lineHeight: 1.6,
                fontSize: '0.88rem',
              }}
            >
              {/* ======================================================== */}
              {/* PAGE 1: EMPLOYMENT OFFER & KEY TERMS                      */}
              {/* ======================================================== */}
              <div>
                {/* Letterhead Header */}
                <div style={{ borderBottom: '2.5px solid #0F172A', paddingBottom: '16px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#0F172A' }}>
                        <InlineField
                          value={offer.company_name}
                          onChange={(v) => setOffer({ ...offer, company_name: v })}
                          placeholder="Company Name"
                          isEditing={isEditing}
                          style={{ fontWeight: 900, fontSize: '1.45rem', color: '#0F172A' }}
                        />
                      </h1>
                      <div style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: '#64748B' }}>
                        <InlineField
                          value={offer.company_address}
                          onChange={(v) => setOffer({ ...offer, company_address: v })}
                          placeholder="Registered Office Address"
                          isEditing={isEditing}
                          multiline={true}
                          rows={2}
                          style={{ fontSize: '0.74rem', color: '#64748B' }}
                        />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#E11D48', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block' }}>
                        Strictly Private & Confidential
                      </span>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginTop: '4px' }}>
                        Date:{' '}
                        <InlineField
                          value={offer.offer_date}
                          onChange={(v) => setOffer({ ...offer, offer_date: v })}
                          placeholder="DD Month YYYY"
                          isEditing={isEditing}
                          style={{ fontWeight: 700 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Candidate Addressee */}
                <div style={{ marginBottom: '22px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Name:</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', marginTop: '2px', display: 'flex', alignItems: 'center' }}>
                    <InlineField
                      value={offer.candidate_name}
                      onChange={(v) => setOffer({ ...offer, candidate_name: v })}
                      placeholder="Candidate Full Name"
                      isEditing={isEditing}
                      style={{ fontWeight: 900, fontSize: '1.25rem', color: '#0F172A', minWidth: '320px' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.86rem', color: '#475569', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: '#64748B' }}>Email:</span>
                    <InlineField
                      value={offer.candidate_email}
                      onChange={(v) => setOffer({ ...offer, candidate_email: v })}
                      placeholder="Candidate Email Address"
                      isEditing={isEditing}
                      style={{ minWidth: '320px', fontSize: '0.86rem', fontWeight: 500 }}
                    />
                  </div>
                </div>

                {/* Title */}
                <div style={{ textAlign: 'center', margin: '26px 0 20px 0' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, letterSpacing: '0.04em', color: '#0F172A', textTransform: 'uppercase', textDecoration: 'underline' }}>
                    EMPLOYMENT OFFER
                  </h2>
                </div>

                {/* Introductory paragraph */}
                <p style={{ marginBottom: '18px', color: '#334155' }}>
                  We are pleased to present you with an offer of employment with{' '}
                  <strong>{offer.company_name}</strong> as{' '}
                  <strong>
                    <InlineField
                      value={offer.job_title}
                      onChange={(v) => setOffer({ ...offer, job_title: v })}
                      placeholder="Job Title"
                      isEditing={isEditing}
                      style={{ fontWeight: 800, color: '#0F172A' }}
                    />
                  </strong>
                  . Your terms and conditions of employment will be as follows:
                </p>

                {/* Terms Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', border: '1px solid #CBD5E1' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ width: '28%', padding: '10px 14px', background: '#F8FAFC', fontWeight: 800, color: '#1E293B', fontSize: '0.82rem', verticalAlign: 'top' }}>
                        Joining Date
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155', verticalAlign: 'top' }}>
                        <InlineField
                          value={offer.joining_date}
                          onChange={(v) => setOffer({ ...offer, joining_date: v })}
                          placeholder="DD Month YYYY"
                          isEditing={isEditing}
                          style={{ fontWeight: 800, color: '#0F172A' }}
                        />
                        <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px' }}>
                          The date of joining is subject to timely submission by the employee of the signed offer and necessary documents.
                        </div>
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '10px 14px', background: '#F8FAFC', fontWeight: 800, color: '#1E293B', fontSize: '0.82rem', verticalAlign: 'top' }}>
                        Mobility
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155', fontSize: '0.82rem', verticalAlign: 'top' }}>
                        <InlineField
                          value={offer.mobility_clause}
                          onChange={(v) => setOffer({ ...offer, mobility_clause: v })}
                          placeholder="Mobility terms"
                          isEditing={isEditing}
                          multiline={true}
                          rows={2}
                        />
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '10px 14px', background: '#F8FAFC', fontWeight: 800, color: '#1E293B', fontSize: '0.82rem', verticalAlign: 'top' }}>
                        Period of Contract
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155', verticalAlign: 'top' }}>
                        <InlineField
                          value={offer.contract_period}
                          onChange={(v) => setOffer({ ...offer, contract_period: v })}
                          placeholder="Unlimited / <As applicable>"
                          isEditing={isEditing}
                          style={{ fontWeight: 700 }}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Annual Leave Policy Table */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0F172A', marginBottom: '6px' }}>
                    Annual Leave Policy
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1' }}>
                    <thead>
                      <tr style={{ background: '#0F172A', color: '#FFFFFF' }}>
                        <th style={{ width: '10%', padding: '8px 12px', fontSize: '0.74rem', textAlign: 'left', fontWeight: 800 }}>No.</th>
                        <th style={{ width: '45%', padding: '8px 12px', fontSize: '0.74rem', textAlign: 'left', fontWeight: 800 }}>Particulars</th>
                        <th style={{ width: '45%', padding: '8px 12px', fontSize: '0.74rem', textAlign: 'left', fontWeight: 800 }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '7px 12px', fontSize: '0.8rem' }}>1</td>
                        <td style={{ padding: '7px 12px', fontSize: '0.8rem', fontWeight: 600 }}>Earn Leave</td>
                        <td style={{ padding: '7px 12px', fontSize: '0.8rem' }}>
                          <InlineField
                            type="number"
                            value={offer.leave_policy.earned_leave}
                            onChange={(v) =>
                              setOffer({
                                ...offer,
                                leave_policy: { ...offer.leave_policy, earned_leave: parseInt(v, 10) || 0 },
                              })
                            }
                            placeholder="18"
                            isEditing={isEditing}
                            style={{ width: '50px', fontWeight: 700 }}
                          />{' '}
                          working days annual leave
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '7px 12px', fontSize: '0.8rem' }}>2</td>
                        <td style={{ padding: '7px 12px', fontSize: '0.8rem', fontWeight: 600 }}>Casual Leave</td>
                        <td style={{ padding: '7px 12px', fontSize: '0.8rem' }}>
                          <InlineField
                            type="number"
                            value={offer.leave_policy.casual_leave}
                            onChange={(v) =>
                              setOffer({
                                ...offer,
                                leave_policy: { ...offer.leave_policy, casual_leave: parseInt(v, 10) || 0 },
                              })
                            }
                            placeholder="12"
                            isEditing={isEditing}
                            style={{ width: '50px', fontWeight: 700 }}
                          />{' '}
                          days
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '7px 12px', fontSize: '0.8rem' }}>3</td>
                        <td style={{ padding: '7px 12px', fontSize: '0.8rem', fontWeight: 600 }}>Sick Leave</td>
                        <td style={{ padding: '7px 12px', fontSize: '0.8rem' }}>
                          <InlineField
                            type="number"
                            value={offer.leave_policy.sick_leave}
                            onChange={(v) =>
                              setOffer({
                                ...offer,
                                leave_policy: { ...offer.leave_policy, sick_leave: parseInt(v, 10) || 0 },
                              })
                            }
                            placeholder="12"
                            isEditing={isEditing}
                            style={{ width: '50px', fontWeight: 700 }}
                          />{' '}
                          days
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '7px 12px', fontSize: '0.8rem' }}>4</td>
                        <td style={{ padding: '7px 12px', fontSize: '0.8rem', fontWeight: 600 }}>Restricted Holidays</td>
                        <td style={{ padding: '7px 12px', fontSize: '0.8rem' }}>
                          <InlineField
                            type="number"
                            value={offer.leave_policy.restricted_holidays}
                            onChange={(v) =>
                              setOffer({
                                ...offer,
                                leave_policy: { ...offer.leave_policy, restricted_holidays: parseInt(v, 10) || 0 },
                              })
                            }
                            placeholder="3"
                            isEditing={isEditing}
                            style={{ width: '50px', fontWeight: 700 }}
                          />{' '}
                          days (must be chosen from the festivals list)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Termination of Employment */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '22px', border: '1px solid #CBD5E1' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ width: '28%', padding: '10px 14px', background: '#F8FAFC', fontWeight: 800, color: '#1E293B', fontSize: '0.82rem', verticalAlign: 'top' }}>
                        Termination of Employment
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155', fontSize: '0.8rem', verticalAlign: 'top' }}>
                        <p style={{ margin: '0 0 8px 0' }}>
                          <strong>Termination by the Company:</strong> The Company may terminate this Agreement at any time during the Term by providing the Employee with{' '}
                          <InlineField
                            type="number"
                            value={offer.termination_company_notice_days}
                            onChange={(v) => setOffer({ ...offer, termination_company_notice_days: parseInt(v, 10) || 0 })}
                            placeholder="30"
                            isEditing={isEditing}
                            style={{ width: '50px', fontWeight: 800 }}
                          />{' '}
                          days' written notice of its intention to terminate the Agreement, with or without reasons for such termination. The Company shall also have the right to terminate this Agreement by paying the Employee pay in lieu of notice.
                        </p>
                        <p style={{ margin: 0 }}>
                          <strong>Termination by the Employee:</strong> The Employee may terminate this Agreement at any time during the Term by providing the Company with{' '}
                          <InlineField
                            type="number"
                            value={offer.termination_employee_notice_days}
                            onChange={(v) => setOffer({ ...offer, termination_employee_notice_days: parseInt(v, 10) || 0 })}
                            placeholder="30"
                            isEditing={isEditing}
                            style={{ width: '50px', fontWeight: 800 }}
                          />{' '}
                          days' written notice of the intention to terminate the Agreement, along with the reasons for such termination.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 14px', background: '#F8FAFC', fontWeight: 800, color: '#1E293B', fontSize: '0.82rem', verticalAlign: 'top' }}>
                        Probation Period
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155', fontSize: '0.8rem', verticalAlign: 'top' }}>
                        <InlineField
                          type="number"
                          value={offer.probation_period_months}
                          onChange={(v) => setOffer({ ...offer, probation_period_months: parseInt(v, 10) || 0 })}
                          placeholder="3"
                          isEditing={isEditing}
                          style={{ width: '50px', fontWeight: 800 }}
                        />{' '}
                        months. During this period, either party may terminate the contract of employment with immediate effect.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ======================================================== */}
              {/* PAGE 2: EMPLOYMENT RESTRICTION, PRE-CONDITIONS & SIGNS    */}
              {/* ======================================================== */}
              <div className="page-break" style={{ paddingTop: '20px', borderTop: '1px dashed #CBD5E1', marginTop: '30px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '22px', border: '1px solid #CBD5E1' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ width: '28%', padding: '10px 14px', background: '#F8FAFC', fontWeight: 800, color: '#1E293B', fontSize: '0.82rem', verticalAlign: 'top' }}>
                        Employment Restriction
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155', fontSize: '0.8rem', verticalAlign: 'top' }}>
                        <p style={{ margin: '0 0 6px 0' }}>
                          By accepting this offer, the Employee agrees not to undertake any competing activities during the course of employment with the Company.
                        </p>
                        <p style={{ margin: 0 }}>
                          After joining the Company, the Employee will not undertake employment with, or provide professional services to, a competitor of the Company for a period of{' '}
                          <InlineField
                            value={offer.non_compete_period}
                            onChange={(v) => setOffer({ ...offer, non_compete_period: v })}
                            placeholder="12 months"
                            isEditing={isEditing}
                            style={{ fontWeight: 800 }}
                          />{' '}
                          from the date of termination, resignation, or completion of this employment agreement, without prior written approval of the Company.
                        </p>
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '10px 14px', background: '#F8FAFC', fontWeight: 800, color: '#1E293B', fontSize: '0.82rem', verticalAlign: 'top' }}>
                        Conflict of Interest
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155', fontSize: '0.8rem', verticalAlign: 'top' }}>
                        You will be required to disclose existing and potential conflicts of interest and to sign the required form provided by the Company every year. This form will become part of your personnel file. (See Attachment 1)
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '10px 14px', background: '#F8FAFC', fontWeight: 800, color: '#1E293B', fontSize: '0.82rem', verticalAlign: 'top' }}>
                        Pre-conditions
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155', fontSize: '0.8rem', verticalAlign: 'top' }}>
                        This offer of employment is subject to the following conditions being met:
                        <ol style={{ margin: '6px 0 0 0', paddingLeft: '20px' }}>
                          <li>Provision of attested copies of original educational certificates by the Employee</li>
                          <li>Successful background verification</li>
                          <li>The Employee joining the Company on the commencement date specified in this contract, or such other date as agreed by both parties in writing prior to the anticipated date of joining</li>
                          <li>The Company being confirmed as the Employee's sole employer</li>
                        </ol>
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '10px 14px', background: '#F8FAFC', fontWeight: 800, color: '#1E293B', fontSize: '0.82rem', verticalAlign: 'top' }}>
                        Allowance Changes
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155', fontSize: '0.8rem', verticalAlign: 'top' }}>
                        Allowances are subject to change depending on market conditions. Any changes occurring between the date of signing this contract and the date of joining will apply to the Employee at the time of joining. Thereafter, the Employee will be notified of any policy changes through Company communication.
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 14px', background: '#F8FAFC', fontWeight: 800, color: '#1E293B', fontSize: '0.82rem', verticalAlign: 'top' }}>
                        Repayment of Advance Allowances
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155', fontSize: '0.8rem', verticalAlign: 'top' }}>
                        The Employee will be required to repay the Company any un-written-off portion of any advance allowance granted, should the Employee leave the Company for any reason before the advance has been fully written off.
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p style={{ margin: '20px 0 28px 0', fontSize: '0.82rem', color: '#334155' }}>
                  Please sign and return the enclosed duplicate copy of this letter to signify your acceptance of these terms and conditions of employment.
                  We are pleased that you will be joining us and look forward to working with you.
                </p>

                {/* Signatures */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '24px' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '36px' }}>Yours sincerely,</div>
                    <div style={{ borderTop: '1.5px solid #0F172A', paddingTop: '6px', maxWidth: '240px' }}>
                      <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '0.88rem' }}>
                        <InlineField
                          value={offer.hr_signatory_name}
                          onChange={(v) => setOffer({ ...offer, hr_signatory_name: v })}
                          placeholder="HR Signatory Name"
                          isEditing={isEditing}
                          style={{ fontWeight: 900 }}
                        />
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                        <InlineField
                          value={offer.hr_signatory_title}
                          onChange={(v) => setOffer({ ...offer, hr_signatory_title: v })}
                          placeholder="VP – Human Resources"
                          isEditing={isEditing}
                        />
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B' }}>{offer.company_name}</div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '36px' }}>Agreed & accepted:</div>
                    <div style={{ borderTop: '1.5px solid #0F172A', paddingTop: '6px', maxWidth: '240px' }}>
                      <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '0.88rem' }}>{offer.candidate_name}</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B' }}>Candidate / Employee Signature</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B' }}>Date: ___________________</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* PAGE 3: ANNEXURE A — COMPENSATION DETAILS                 */}
              {/* ======================================================== */}
              <div className="page-break" style={{ paddingTop: '24px', borderTop: '1px dashed #CBD5E1', marginTop: '36px' }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0F172A' }}>
                    ANNEXURE A
                  </h3>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginTop: '2px' }}>
                    Compensation Details
                  </div>
                </div>

                {/* Metadata Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', border: '1px solid #CBD5E1' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ width: '25%', padding: '8px 12px', background: '#F8FAFC', fontWeight: 800, fontSize: '0.8rem' }}>Name</td>
                      <td style={{ width: '25%', padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700 }}>{offer.candidate_name}</td>
                      <td style={{ width: '25%', padding: '8px 12px', background: '#F8FAFC', fontWeight: 800, fontSize: '0.8rem' }}>Grade</td>
                      <td style={{ width: '25%', padding: '8px 12px', fontSize: '0.8rem' }}>
                        <InlineField
                          value={offer.annexure.grade}
                          onChange={(v) => setOffer({ ...offer, annexure: { ...offer.annexure, grade: v } })}
                          placeholder="Grade Code"
                          isEditing={isEditing}
                        />
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '8px 12px', background: '#F8FAFC', fontWeight: 800, fontSize: '0.8rem' }}>Title</td>
                      <td style={{ padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700 }}>{offer.job_title}</td>
                      <td style={{ padding: '8px 12px', background: '#F8FAFC', fontWeight: 800, fontSize: '0.8rem' }}>Department</td>
                      <td style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                        <InlineField
                          value={offer.annexure.department}
                          onChange={(v) => setOffer({ ...offer, annexure: { ...offer.annexure, department: v } })}
                          placeholder="Department Name"
                          isEditing={isEditing}
                        />
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '8px 12px', background: '#F8FAFC', fontWeight: 800, fontSize: '0.8rem' }}>Date of Joining</td>
                      <td style={{ padding: '8px 12px', fontSize: '0.8rem' }}>{offer.joining_date}</td>
                      <td style={{ padding: '8px 12px', background: '#F8FAFC', fontWeight: 800, fontSize: '0.8rem' }}>Reporting to</td>
                      <td style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                        <InlineField
                          value={offer.annexure.reporting_to}
                          onChange={(v) => setOffer({ ...offer, annexure: { ...offer.annexure, reporting_to: v } })}
                          placeholder="Manager Title"
                          isEditing={isEditing}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 12px', background: '#F8FAFC', fontWeight: 800, fontSize: '0.8rem' }}>Work Location</td>
                      <td style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                        <InlineField
                          value={offer.annexure.work_location}
                          onChange={(v) => setOffer({ ...offer, annexure: { ...offer.annexure, work_location: v } })}
                          placeholder="City / Remote"
                          isEditing={isEditing}
                        />
                      </td>
                      <td style={{ padding: '8px 12px', background: '#F8FAFC', fontWeight: 800, fontSize: '0.8rem' }}>Type of Contract</td>
                      <td style={{ padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700, color: '#059669' }}>
                        <InlineField
                          value={offer.annexure.contract_type}
                          onChange={(v) => setOffer({ ...offer, annexure: { ...offer.annexure, contract_type: v } })}
                          placeholder="Full Time"
                          isEditing={isEditing}
                          style={{ fontWeight: 700 }}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Compensation Table */}
                <div style={{ marginBottom: '22px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
                    Your Total Gross Compensation is comprised of the following illustrative components:
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1' }}>
                    <thead>
                      <tr style={{ background: '#0F172A', color: '#FFFFFF' }}>
                        <th style={{ width: '46%', padding: '9px 12px', fontSize: '0.78rem', textAlign: 'left', fontWeight: 800 }}>Component</th>
                        <th style={{ width: '27%', padding: '9px 12px', fontSize: '0.78rem', textAlign: 'right', fontWeight: 800 }}>
                          Annual ({currencySymbol})
                        </th>
                        <th style={{ width: '27%', padding: '9px 12px', fontSize: '0.78rem', textAlign: 'right', fontWeight: 800 }}>
                          Monthly ({currencySymbol})
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '8px 12px', fontSize: '0.82rem', fontWeight: 600 }}>Basic Salary</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.82rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                          <InlineField
                            type="number"
                            value={offer.annexure.basic_salary_annual}
                            onChange={(v) => {
                              const num = parseInt(v, 10) || 0;
                              setOffer({
                                ...offer,
                                annexure: { ...offer.annexure, basic_salary_annual: num, basic_salary_monthly: Math.round(num / 12) },
                              });
                            }}
                            placeholder="Amount"
                            isEditing={isEditing}
                            style={{ textAlign: 'right', width: '100px', fontWeight: 700 }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '0.82rem', textAlign: 'right', fontFamily: 'monospace' }}>
                          <InlineField
                            type="number"
                            value={offer.annexure.basic_salary_monthly}
                            onChange={(v) => {
                              const num = parseInt(v, 10) || 0;
                              setOffer({
                                ...offer,
                                annexure: { ...offer.annexure, basic_salary_monthly: num, basic_salary_annual: num * 12 },
                              });
                            }}
                            placeholder="Amount"
                            isEditing={isEditing}
                            style={{ textAlign: 'right', width: '90px' }}
                          />
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '8px 12px', fontSize: '0.82rem', fontWeight: 600 }}>House Rent Allowance</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.82rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                          <InlineField
                            type="number"
                            value={offer.annexure.hra_annual}
                            onChange={(v) => {
                              const num = parseInt(v, 10) || 0;
                              setOffer({
                                ...offer,
                                annexure: { ...offer.annexure, hra_annual: num, hra_monthly: Math.round(num / 12) },
                              });
                            }}
                            placeholder="Amount"
                            isEditing={isEditing}
                            style={{ textAlign: 'right', width: '100px', fontWeight: 700 }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '0.82rem', textAlign: 'right', fontFamily: 'monospace' }}>
                          <InlineField
                            type="number"
                            value={offer.annexure.hra_monthly}
                            onChange={(v) => {
                              const num = parseInt(v, 10) || 0;
                              setOffer({
                                ...offer,
                                annexure: { ...offer.annexure, hra_monthly: num, hra_annual: num * 12 },
                              });
                            }}
                            placeholder="Amount"
                            isEditing={isEditing}
                            style={{ textAlign: 'right', width: '90px' }}
                          />
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '8px 12px', fontSize: '0.82rem', fontWeight: 600 }}>Other Allowance</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.82rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                          <InlineField
                            type="number"
                            value={offer.annexure.other_allowance_annual}
                            onChange={(v) => {
                              const num = parseInt(v, 10) || 0;
                              setOffer({
                                ...offer,
                                annexure: { ...offer.annexure, other_allowance_annual: num, other_allowance_monthly: Math.round(num / 12) },
                              });
                            }}
                            placeholder="Amount"
                            isEditing={isEditing}
                            style={{ textAlign: 'right', width: '100px', fontWeight: 700 }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '0.82rem', textAlign: 'right', fontFamily: 'monospace' }}>
                          <InlineField
                            type="number"
                            value={offer.annexure.other_allowance_monthly}
                            onChange={(v) => {
                              const num = parseInt(v, 10) || 0;
                              setOffer({
                                ...offer,
                                annexure: { ...offer.annexure, other_allowance_monthly: num, other_allowance_annual: num * 12 },
                              });
                            }}
                            placeholder="Amount"
                            isEditing={isEditing}
                            style={{ textAlign: 'right', width: '90px' }}
                          />
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #CBD5E1' }}>
                        <td style={{ padding: '8px 12px', fontSize: '0.82rem', fontWeight: 600 }}>Provident Fund – Employer Contribution</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.82rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                          <InlineField
                            type="number"
                            value={offer.annexure.pf_annual}
                            onChange={(v) => {
                              const num = parseInt(v, 10) || 0;
                              setOffer({
                                ...offer,
                                annexure: { ...offer.annexure, pf_annual: num, pf_monthly: Math.round(num / 12) },
                              });
                            }}
                            placeholder="Amount"
                            isEditing={isEditing}
                            style={{ textAlign: 'right', width: '100px', fontWeight: 700 }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '0.82rem', textAlign: 'right', fontFamily: 'monospace' }}>
                          <InlineField
                            type="number"
                            value={offer.annexure.pf_monthly}
                            onChange={(v) => {
                              const num = parseInt(v, 10) || 0;
                              setOffer({
                                ...offer,
                                annexure: { ...offer.annexure, pf_monthly: num, pf_annual: num * 12 },
                              });
                            }}
                            placeholder="Amount"
                            isEditing={isEditing}
                            style={{ textAlign: 'right', width: '90px' }}
                          />
                        </td>
                      </tr>
                      {/* Highlighted Total Fixed Compensation */}
                      <tr style={{ background: '#ECFDF5', borderTop: '2px solid #059669' }}>
                        <td style={{ padding: '10px 12px', fontSize: '0.88rem', fontWeight: 900, color: '#065F46' }}>
                          Total Fixed Compensation
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.95rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, color: '#065F46' }}>
                          <span style={{ marginRight: '4px' }}>{currencySymbol}</span>
                          <InlineField
                            type="number"
                            value={offer.annexure.total_fixed_annual}
                            onChange={(v) => handleRecalculateCtc(v)}
                            placeholder="Total"
                            isEditing={isEditing}
                            style={{ textAlign: 'right', width: '120px', fontWeight: 900, color: '#065F46' }}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.95rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, color: '#065F46' }}>
                          <span style={{ marginRight: '4px' }}>{currencySymbol}</span>
                          <InlineField
                            type="number"
                            value={offer.annexure.total_fixed_monthly}
                            onChange={(v) => {
                              const num = parseInt(v, 10) || 0;
                              setOffer({
                                ...offer,
                                annexure: { ...offer.annexure, total_fixed_monthly: num, total_fixed_annual: num * 12 },
                              });
                            }}
                            placeholder="Total"
                            isEditing={isEditing}
                            style={{ textAlign: 'right', width: '100px', fontWeight: 900, color: '#065F46' }}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontStyle: 'italic', marginTop: '6px' }}>
                    Note: Figures above state exact agreed currency amounts for the role.
                  </div>
                </div>

                {/* Supplementary Benefits Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1', fontSize: '0.78rem' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ width: '28%', padding: '7px 10px', background: '#F8FAFC', fontWeight: 800 }}>Provident Fund</td>
                      <td style={{ padding: '7px 10px', color: '#334155' }}>Contribution basis as per applicable statutory rules and Company policy (e.g., fixed minimum, or a percentage of Basic Salary with employer matching).</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '7px 10px', background: '#F8FAFC', fontWeight: 800 }}>Meal Voucher</td>
                      <td style={{ padding: '7px 10px', color: '#334155' }}>
                        Eligible for a meal card / allowance of {currencySymbol}{' '}
                        <InlineField
                          type="number"
                          value={offer.annexure.meal_voucher_monthly}
                          onChange={(v) => setOffer({ ...offer, annexure: { ...offer.annexure, meal_voucher_monthly: parseInt(v, 10) || 0 } })}
                          placeholder="3000"
                          isEditing={isEditing}
                          style={{ width: '60px', fontWeight: 700 }}
                        />{' '}
                        per month, where applicable.
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '7px 10px', background: '#F8FAFC', fontWeight: 800 }}>Relocation Assistance</td>
                      <td style={{ padding: '7px 10px', color: '#334155' }}>As per Company Relocation Policy, if applicable.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '7px 10px', background: '#F8FAFC', fontWeight: 800 }}>Annual Performance Bonus</td>
                      <td style={{ padding: '7px 10px', color: '#334155' }}>
                        At the Company's discretion, an employee may be awarded a performance bonus (target{' '}
                        <InlineField
                          type="number"
                          value={offer.annexure.annual_bonus_percentage}
                          onChange={(v) => setOffer({ ...offer, annexure: { ...offer.annexure, annual_bonus_percentage: parseInt(v, 10) || 0 } })}
                          placeholder="10"
                          isEditing={isEditing}
                          style={{ width: '45px', fontWeight: 700 }}
                        />
                        %), subject to organizational performance and the bonus policy.
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '7px 10px', background: '#F8FAFC', fontWeight: 800 }}>Medical Insurance</td>
                      <td style={{ padding: '7px 10px', color: '#334155' }}>
                        Employee and eligible dependents (Spouse, up to 2 Children and Parents) covered under Company group medical insurance scheme (
                        <InlineField
                          value={offer.annexure.medical_insurance_coverage}
                          onChange={(v) => setOffer({ ...offer, annexure: { ...offer.annexure, medical_insurance_coverage: v } })}
                          placeholder="₹5,00,000"
                          isEditing={isEditing}
                        />
                        ).
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '7px 10px', background: '#F8FAFC', fontWeight: 800 }}>Life Insurance</td>
                      <td style={{ padding: '7px 10px', color: '#334155' }}>
                        <InlineField
                          value={offer.annexure.life_insurance_coverage}
                          onChange={(v) => setOffer({ ...offer, annexure: { ...offer.annexure, life_insurance_coverage: v } })}
                          placeholder="Covered under Company group life insurance policy."
                          isEditing={isEditing}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '7px 10px', background: '#F8FAFC', fontWeight: 800 }}>Gratuity</td>
                      <td style={{ padding: '7px 10px', color: '#334155' }}>{offer.annexure.gratuity_terms}.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ======================================================== */}
              {/* PAGE 4: LEAVE POLICY STATEMENT                            */}
              {/* ======================================================== */}
              <div className="page-break" style={{ paddingTop: '20px', borderTop: '1px dashed #CBD5E1', marginTop: '28px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '28%', padding: '10px 14px', background: '#F8FAFC', fontWeight: 800, color: '#1E293B' }}>
                        Leave
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155' }}>
                        As per Company Leave Policy (see Annual Leave Policy above).
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ======================================================== */}
              {/* PAGE 5: ATTACHMENT 1 — CONFLICT OF INTERESTS              */}
              {/* ======================================================== */}
              <div className="page-break" style={{ paddingTop: '24px', borderTop: '1px dashed #CBD5E1', marginTop: '36px' }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                    Attachment 1
                  </span>
                  <h3 style={{ margin: '2px 0 0 0', fontSize: '1.15rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0F172A' }}>
                    CONFLICT OF INTERESTS
                  </h3>
                </div>

                <p style={{ fontSize: '0.82rem', marginBottom: '14px', color: '#334155' }}>
                  While employed by the Company, the Employee shall not, directly or indirectly:
                </p>

                <ol style={{ paddingLeft: '22px', fontSize: '0.8rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  <li>
                    Participate in any transaction with any of the Company's suppliers, advisors, consultants, contractors, or other business associates, including having a financial interest in such associates, or making loans to or receiving loans from them;
                  </li>
                  <li>
                    Realize a personal gain or advantage from a transaction in which the Company has an interest, or use information obtained through employment for personal advantage, or accept any monetary reward, gift, or item of value in connection with Company business;
                  </li>
                  <li>
                    Accept any offer to serve as an officer, director, partner, consultant, or manager of, or be employed in a technical capacity by, any of the Company's business associates.
                  </li>
                </ol>

                <p style={{ fontSize: '0.8rem', color: '#334155', marginBottom: '30px' }}>
                  I understand and agree that I have disclosed all existing conflicts of interest and shall disclose any potential conflict of interest immediately as it arises, to the Human Resources Department. Failure to properly disclose such information will be subject to disciplinary action in accordance with Company policy.
                </p>

                {/* Signatures */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '36px' }}>Signed by:</div>
                    <div style={{ borderTop: '1.5px solid #0F172A', paddingTop: '6px', maxWidth: '240px' }}>
                      <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '0.85rem' }}>{offer.hr_signatory_name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{offer.hr_signatory_title}</div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '36px' }}>Agreed & accepted:</div>
                    <div style={{ borderTop: '1.5px solid #0F172A', paddingTop: '6px', maxWidth: '240px' }}>
                      <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '0.85rem' }}>{offer.candidate_name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Employee's Signature</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
