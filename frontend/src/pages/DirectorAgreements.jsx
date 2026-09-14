import React, { useState, useEffect, useMemo } from 'react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Check,
  X,
  Eye,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  UserCheck,
  DollarSign,
  ShieldCheck,
  Send,
  Filter,
  ChevronRight
} from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return iso;
  }
}

export default function DirectorAgreements() {
  const { token, user } = useAuth();
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION'
  
  // Modals & Action states
  const [selectedAgreement, setSelectedAgreement] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  
  // Rejection modal
  const [rejectModalTarget, setRejectModalTarget] = useState(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  
  // Revision modal
  const [revisionModalTarget, setRevisionModalTarget] = useState(null);
  const [revisionNotes, setRevisionNotes] = useState('');

  const loadAgreements = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('/api/work-orders/director-agreements', { token });
      setAgreements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load agreements:', err);
      setError(err?.message || 'Failed to load vendor agreements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadAgreements();
    }
  }, [token]);

  const handleApprove = async (item) => {
    const id = item.workorder_id || item.id;
    setActionLoadingId(id);
    setError('');
    setSuccessMsg('');
    try {
      const res = await request(`/api/work-orders/${encodeURIComponent(id)}/director-approve`, {
        method: 'POST',
        token
      });
      const approverName = res?.approved_by || `${user?.name || 'Director'} (Director)`;
      const approvedAtTime = res?.approved_at || new Date().toISOString();
      
      setSuccessMsg(res?.message || `Agreement for ${item.candidate_name} approved successfully!`);
      setAgreements((prev) =>
        prev.map((a) =>
          (a.workorder_id === id || a.id === id)
            ? {
                ...a,
                status: 'Approved',
                approved_by: approverName,
                approved_at: approvedAtTime,
                rejection_reason: '',
                rejected_by: '',
                rejected_at: '',
                revision_notes: ''
              }
            : a
        )
      );

      if (selectedAgreement && (selectedAgreement.workorder_id === id || selectedAgreement.id === id)) {
        setSelectedAgreement((prev) => ({
          ...prev,
          status: 'Approved',
          approved_by: approverName,
          approved_at: approvedAtTime,
          rejection_reason: '',
          rejected_by: '',
          rejected_at: '',
          revision_notes: ''
        }));
      }
    } catch (err) {
      setError(err?.message || 'Failed to approve agreement.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModalTarget) return;
    const id = rejectModalTarget.workorder_id || rejectModalTarget.id;
    const reason = rejectionNotes.trim() || 'Agreement terms not approved by Company Director.';
    setActionLoadingId(id);
    setError('');
    setSuccessMsg('');
    try {
      const res = await request(`/api/work-orders/${encodeURIComponent(id)}/director-reject`, {
        method: 'POST',
        token,
        body: { notes: reason }
      });
      const rejectorName = res?.rejected_by || `${user?.name || 'Director'} (Director)`;
      const rejectedAtTime = res?.rejected_at || new Date().toISOString();

      setSuccessMsg(res?.message || `Agreement for ${rejectModalTarget.candidate_name} rejected.`);
      setAgreements((prev) =>
        prev.map((a) =>
          (a.workorder_id === id || a.id === id)
            ? {
                ...a,
                status: 'Rejected',
                rejection_reason: reason,
                rejected_by: rejectorName,
                rejected_at: rejectedAtTime
              }
            : a
        )
      );

      if (selectedAgreement && (selectedAgreement.workorder_id === id || selectedAgreement.id === id)) {
        setSelectedAgreement((prev) => ({
          ...prev,
          status: 'Rejected',
          rejection_reason: reason,
          rejected_by: rejectorName,
          rejected_at: rejectedAtTime
        }));
      }

      setRejectModalTarget(null);
      setRejectionNotes('');
    } catch (err) {
      setError(err?.message || 'Failed to reject agreement.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevisionSubmit = async () => {
    if (!revisionModalTarget) return;
    const id = revisionModalTarget.workorder_id || revisionModalTarget.id;
    const notes = revisionNotes.trim() || 'Director requested adjustment to commercial terms or duration.';
    setActionLoadingId(id);
    setError('');
    setSuccessMsg('');
    try {
      const res = await request(`/api/work-orders/${encodeURIComponent(id)}/director-request-revision`, {
        method: 'POST',
        token,
        body: { notes }
      });

      setSuccessMsg(res?.message || `Revision requested for ${revisionModalTarget.candidate_name}. Vendor notified.`);
      setAgreements((prev) =>
        prev.map((a) =>
          (a.workorder_id === id || a.id === id)
            ? {
                ...a,
                status: 'Revision Requested',
                revision_notes: notes
              }
            : a
        )
      );

      if (selectedAgreement && (selectedAgreement.workorder_id === id || selectedAgreement.id === id)) {
        setSelectedAgreement((prev) => ({
          ...prev,
          status: 'Revision Requested',
          revision_notes: notes
        }));
      }

      setRevisionModalTarget(null);
      setRevisionNotes('');
    } catch (err) {
      setError(err?.message || 'Failed to request revision.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Stats calculation
  const totalCount = agreements.length;
  const pendingCount = agreements.filter(
    (a) => a.status === 'Pending Director Approval' || a.status === 'Submitted'
  ).length;
  const approvedCount = agreements.filter((a) => a.status === 'Approved').length;
  const rejectedCount = agreements.filter((a) => a.status === 'Rejected').length;
  const revisionCount = agreements.filter((a) => a.status === 'Revision Requested').length;

  // Filtered agreements
  const filteredAgreements = useMemo(() => {
    return agreements.filter((a) => {
      // Status filter
      if (statusFilter === 'PENDING') {
        if (a.status !== 'Pending Director Approval' && a.status !== 'Submitted') return false;
      } else if (statusFilter === 'APPROVED') {
        if (a.status !== 'Approved') return false;
      } else if (statusFilter === 'REJECTED') {
        if (a.status !== 'Rejected') return false;
      } else if (statusFilter === 'REVISION') {
        if (a.status !== 'Revision Requested') return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const candName = (a.candidate_name || '').toLowerCase();
        const role = (a.role || '').toLowerCase();
        const vendor = (a.vendor_name || '').toLowerCase();
        const woId = (a.workorder_id || a.id || '').toLowerCase();
        return candName.includes(q) || role.includes(q) || vendor.includes(q) || woId.includes(q);
      }

      return true;
    });
  }, [agreements, statusFilter, searchQuery]);

  return (
    <div className="page font-sans text-[#0A0A0A]" style={{ paddingBottom: 60 }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%)',
          color: '#FFFFFF',
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 24,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                background: 'rgba(255,255,255,0.15)',
                padding: '4px 10px',
                borderRadius: 6,
                textTransform: 'uppercase'
              }}
            >
              {user?.tenant_name || 'Client Company'} • Executive Governance
            </span>
            {pendingCount > 0 && (
              <span
                style={{
                  background: '#F59E0B',
                  color: '#000000',
                  fontWeight: 800,
                  fontSize: '0.72rem',
                  padding: '3px 10px',
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Clock size={12} /> {pendingCount} Pending Sign-Off
              </span>
            )}
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
            Vendor Agreements & Work Statements
          </h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#A3A3A3', maxWidth: 680, lineHeight: 1.5 }}>
            Authorized portal for Company Directors to inspect Master Service Agreements (MSAs), review commercial rate schedules, and grant formal executive approval or rejection for vendor engagements.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAgreements}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Refreshing...' : 'Refresh Agreements'}</span>
        </button>
      </div>

      {/* Metric Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E5E0',
            borderRadius: 12,
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Agreements
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0A0A0A', marginTop: 4 }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: 2 }}>
            Across all consultancies
          </div>
        </div>

        <div
          style={{
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: 12,
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending Sign-Off
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#D97706', marginTop: 4 }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#B45309', marginTop: 2 }}>
            Requires Director action
          </div>
        </div>

        <div
          style={{
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 12,
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Approved Agreements
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', marginTop: 4 }}>
            {approvedCount}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#047857', marginTop: 2 }}>
            Live & locked in database
          </div>
        </div>

        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 12,
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Rejected / Revisions
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#DC2626', marginTop: 4 }}>
            {rejectedCount + revisionCount}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#B91C1C', marginTop: 2 }}>
            {rejectedCount} Rejected • {revisionCount} Revisions
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #F87171',
            color: '#B91C1C',
            padding: '12px 16px',
            borderRadius: 10,
            marginBottom: 20,
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} /> {error}
          </span>
          <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            background: '#ECFDF5',
            border: '1px solid #6EE7B7',
            color: '#065F46',
            padding: '12px 16px',
            borderRadius: 10,
            marginBottom: 20,
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} /> {successMsg}
          </span>
          <button type="button" onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Search & Filter Tabs */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E5E0',
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        {/* Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'All Agreements', count: totalCount },
            { id: 'PENDING', label: 'Pending Approval', count: pendingCount, highlight: true },
            { id: 'APPROVED', label: 'Approved', count: approvedCount },
            { id: 'REJECTED', label: 'Rejected', count: rejectedCount },
            { id: 'REVISION', label: 'Revisions', count: revisionCount },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 20,
                  fontSize: '0.82rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  border: isActive ? '1px solid #0A0A0A' : '1px solid #E2E8F0',
                  background: isActive ? '#0A0A0A' : '#F8FAFC',
                  color: isActive ? '#FFFFFF' : '#475569',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 999,
                    background: isActive ? 'rgba(255,255,255,0.2)' : '#E2E8F0',
                    color: isActive ? '#FFFFFF' : '#64748B'
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: 260 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate, role, vendor, or ID..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              fontSize: '0.84rem',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              outline: 'none',
              background: '#F8FAFC'
            }}
          />
        </div>
      </div>

      {/* Agreements Table */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E5E0',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}
      >
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748B' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <div>Loading vendor agreements...</div>
          </div>
        ) : filteredAgreements.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center' }}>
            <FileText size={38} style={{ color: '#CBD5E1', margin: '0 auto 12px auto' }} />
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1E293B', marginBottom: 4 }}>
              No Master Service Agreements Found
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748B', maxWidth: 450, margin: '0 auto' }}>
              {searchQuery || statusFilter !== 'ALL'
                ? 'No agreements match your current search or filter criteria.'
                : 'No vendor agreements have been submitted for your company yet. Agreements created by partner recruiters will appear here for Director approval.'}
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ textAlign: 'left', padding: '14px 18px', fontWeight: 700, color: '#475569' }}>
                  Candidate & Role
                </th>
                <th style={{ textAlign: 'left', padding: '14px 18px', fontWeight: 700, color: '#475569' }}>
                  Agreement / Work Order ID
                </th>
                <th style={{ textAlign: 'left', padding: '14px 18px', fontWeight: 700, color: '#475569' }}>
                  Vendor Partner
                </th>
                <th style={{ textAlign: 'left', padding: '14px 18px', fontWeight: 700, color: '#475569' }}>
                  Commercial Terms
                </th>
                <th style={{ textAlign: 'left', padding: '14px 18px', fontWeight: 700, color: '#475569' }}>
                  Duration
                </th>
                <th style={{ textAlign: 'left', padding: '14px 18px', fontWeight: 700, color: '#475569' }}>
                  Approval Status
                </th>
                <th style={{ textAlign: 'right', padding: '14px 18px', fontWeight: 700, color: '#475569' }}>
                  Director Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAgreements.map((item) => {
                const id = item.workorder_id || item.id;
                const isPending = item.status === 'Pending Director Approval' || item.status === 'Submitted';
                const isApproved = item.status === 'Approved';
                const isRejected = item.status === 'Rejected';
                const isRevision = item.status === 'Revision Requested';
                const isProcessing = actionLoadingId === id;

                return (
                  <tr
                    key={id}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Candidate & Role */}
                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.92rem' }}>
                        {item.candidate_name || 'Contract Specialist'}
                      </div>
                      <div style={{ color: '#64748B', fontSize: '0.8rem', marginTop: 2 }}>
                        {item.role || 'Designated Role'}
                      </div>
                      {item.candidate_email && (
                        <div style={{ color: '#94A3B8', fontSize: '0.74rem', marginTop: 1 }}>
                          {item.candidate_email}
                        </div>
                      )}
                    </td>

                    {/* Work Order ID */}
                    <td style={{ padding: '16px 18px' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          background: '#F1F5F9',
                          color: '#334155',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontWeight: 700,
                          border: '1px solid #CBD5E1'
                        }}
                      >
                        {id}
                      </span>
                    </td>

                    {/* Vendor */}
                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#1E293B' }}>
                        <Building2 size={13} style={{ color: '#64748B' }} />
                        <span>{item.vendor_name || 'Partner Consultancy'}</span>
                      </div>
                      {item.submitted_at && (
                        <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 3 }}>
                          Submitted: {formatDate(item.submitted_at)}
                        </div>
                      )}
                    </td>

                    {/* Commercial Terms */}
                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ fontWeight: 800, color: '#0F172A' }}>
                        {item.charge_rate || '₹1,500/day'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 2 }}>
                        Net 30 payment terms
                      </div>
                    </td>

                    {/* Duration */}
                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ fontWeight: 700, color: '#334155' }}>
                        {item.duration || '3 Months'}
                      </div>
                      {item.start_date && (
                        <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 2 }}>
                          Starts: {formatDate(item.start_date)}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '16px 18px' }}>
                      {isApproved ? (
                        <div>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#ECFDF5',
                              color: '#065F46',
                              border: '1px solid #A7F3D0',
                              padding: '3px 10px',
                              borderRadius: 999,
                              fontSize: '0.76rem',
                              fontWeight: 700
                            }}
                          >
                            <Check size={12} /> Approved
                          </span>
                          {item.approved_by && (
                            <div style={{ fontSize: '0.7rem', color: '#047857', marginTop: 4 }}>
                              By {item.approved_by}
                            </div>
                          )}
                        </div>
                      ) : isPending ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#FFFBEB',
                            color: '#92400E',
                            border: '1px solid #FDE68A',
                            padding: '3px 10px',
                            borderRadius: 999,
                            fontSize: '0.76rem',
                            fontWeight: 700
                          }}
                        >
                          <Clock size={12} /> Pending Approval
                        </span>
                      ) : isRejected ? (
                        <div>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#FEF2F2',
                              color: '#991B1B',
                              border: '1px solid #FECACA',
                              padding: '3px 10px',
                              borderRadius: 999,
                              fontSize: '0.76rem',
                              fontWeight: 700
                            }}
                          >
                            <XCircle size={12} /> Rejected
                          </span>
                          {item.rejection_reason && (
                            <div style={{ fontSize: '0.72rem', color: '#DC2626', marginTop: 4, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.rejection_reason}>
                              "{item.rejection_reason}"
                            </div>
                          )}
                        </div>
                      ) : isRevision ? (
                        <div>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#EFF6FF',
                              color: '#1E40AF',
                              border: '1px solid #BFDBFE',
                              padding: '3px 10px',
                              borderRadius: 999,
                              fontSize: '0.76rem',
                              fontWeight: 700
                            }}
                          >
                            <AlertCircle size={12} /> Revision Requested
                          </span>
                          {item.revision_notes && (
                            <div style={{ fontSize: '0.72rem', color: '#2563EB', marginTop: 4, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.revision_notes}>
                              "{item.revision_notes}"
                            </div>
                          )}
                        </div>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#F1F5F9',
                            color: '#475569',
                            border: '1px solid #E2E8F0',
                            padding: '3px 10px',
                            borderRadius: 999,
                            fontSize: '0.76rem',
                            fontWeight: 600
                          }}
                        >
                          {item.status}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                        {/* Review Agreement Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedAgreement(item)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#F8FAFC',
                            border: '1px solid #CBD5E1',
                            color: '#334155',
                            padding: '6px 12px',
                            borderRadius: 8,
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#EDEFE9'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                          title="View Full Master Service Agreement Schedule"
                        >
                          <Eye size={13} />
                          <span>Review Terms</span>
                        </button>

                        {/* Approve Button */}
                        {!isApproved && (
                          <button
                            type="button"
                            onClick={() => handleApprove(item)}
                            disabled={isProcessing}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#0A0A0A',
                              border: '1px solid #0A0A0A',
                              color: '#FFFFFF',
                              padding: '6px 14px',
                              borderRadius: 8,
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                              transition: 'all 0.15s ease',
                              opacity: isProcessing ? 0.6 : 1
                            }}
                            onMouseEnter={(e) => { if (!isProcessing) e.currentTarget.style.background = '#262626'; }}
                            onMouseLeave={(e) => { if (!isProcessing) e.currentTarget.style.background = '#0A0A0A'; }}
                            title="Approve agreement and confirm candidate engagement"
                          >
                            <Check size={13} />
                            <span>{isProcessing ? 'Saving...' : 'Approve'}</span>
                          </button>
                        )}

                        {/* Reject Button */}
                        {!isApproved && !isRejected && (
                          <button
                            type="button"
                            onClick={() => {
                              setRejectModalTarget(item);
                              setRejectionNotes('');
                            }}
                            disabled={isProcessing}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#FEF2F2',
                              border: '1px solid #FECACA',
                              color: '#DC2626',
                              padding: '6px 10px',
                              borderRadius: 8,
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#FEE2E2'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#FEF2F2'; }}
                            title="Reject agreement"
                          >
                            <X size={13} />
                            <span>Reject</span>
                          </button>
                        )}

                        {/* Request Revision Button */}
                        {!isApproved && (
                          <button
                            type="button"
                            onClick={() => {
                              setRevisionModalTarget(item);
                              setRevisionNotes('');
                            }}
                            disabled={isProcessing}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#FFFBEB',
                              border: '1px solid #FDE68A',
                              color: '#B45309',
                              padding: '6px 10px',
                              borderRadius: 8,
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF3C7'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFBEB'; }}
                            title="Request modifications from vendor recruiter"
                          >
                            <span>Revise</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* FULL AGREEMENT CONTRACT PREVIEW MODAL */}
      {selectedAgreement && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20
          }}
          onClick={() => setSelectedAgreement(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              width: '100%',
              maxWidth: 820,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#F8FAFC',
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      background: '#0A0A0A',
                      color: '#FFFFFF',
                      padding: '2px 8px',
                      borderRadius: 4
                    }}
                  >
                    {selectedAgreement.workorder_id || selectedAgreement.id}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Master Services Agreement</span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                  Work Schedule & Agreement Terms
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAgreement(null)}
                style={{
                  background: '#EDEFE9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              {/* Status Banner */}
              {selectedAgreement.status === 'Approved' ? (
                <div
                  style={{
                    background: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    color: '#065F46',
                    padding: '12px 16px',
                    borderRadius: 10,
                    marginBottom: 20,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                  }}
                >
                  <CheckCircle2 size={18} className="shrink-0" />
                  <div>
                    <strong>Approved by Director</strong>: This agreement was formally signed and approved by{' '}
                    <strong>{selectedAgreement.approved_by || 'Director'}</strong>
                    {selectedAgreement.approved_at ? ` on ${formatDate(selectedAgreement.approved_at)}` : ''}.
                  </div>
                </div>
              ) : selectedAgreement.status === 'Rejected' ? (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#991B1B',
                    padding: '12px 16px',
                    borderRadius: 10,
                    marginBottom: 20,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                  }}
                >
                  <XCircle size={18} className="shrink-0" />
                  <div>
                    <strong>Agreement Rejected</strong>: {selectedAgreement.rejection_reason || 'Terms not accepted by Director.'}
                    {selectedAgreement.rejected_by && ` (By ${selectedAgreement.rejected_by})`}
                  </div>
                </div>
              ) : selectedAgreement.status === 'Revision Requested' ? (
                <div
                  style={{
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    color: '#92400E',
                    padding: '12px 16px',
                    borderRadius: 10,
                    marginBottom: 20,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                  }}
                >
                  <AlertCircle size={18} className="shrink-0" />
                  <div>
                    <strong>Revision Requested</strong>: "{selectedAgreement.revision_notes}"
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    color: '#92400E',
                    padding: '12px 16px',
                    borderRadius: 10,
                    marginBottom: 20,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                  }}
                >
                  <Clock size={18} className="shrink-0" />
                  <div>
                    <strong>Awaiting Executive Sign-Off</strong>: Please review the commercial terms, engaged specialist role, and billing details below before granting authorization.
                  </div>
                </div>
              )}

              {/* Grid of details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
                {/* Engaged Personnel Card */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <UserCheck size={13} /> Engaged Personnel
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                    {selectedAgreement.candidate_name || 'Contract Specialist'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: 2 }}>
                    Role: <strong>{selectedAgreement.role || 'Designated Role'}</strong>
                  </div>
                  {selectedAgreement.candidate_email && (
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 2 }}>
                      {selectedAgreement.candidate_email}
                    </div>
                  )}
                </div>

                {/* Vendor Partner Card */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Building2 size={13} /> Supplier / Vendor
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                    {selectedAgreement.vendor_name || 'Partner Consultancy'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: 2 }}>
                    Client: <strong>{selectedAgreement.company_name || user?.tenant_name || 'SDC limited'}</strong>
                  </div>
                  {selectedAgreement.submitted_by && (
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 2 }}>
                      Representative: {selectedAgreement.submitted_by}
                    </div>
                  )}
                </div>

                {/* Commercial Rate Card */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <DollarSign size={13} /> Commercials
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A0A0A' }}>
                    {selectedAgreement.charge_rate || '₹1,500/day'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>
                    Payment Terms: <strong>Net 30 days</strong>
                  </div>
                </div>

                {/* Term & Notice Card */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Calendar size={13} /> Term & Duration
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                    {selectedAgreement.duration || '3 Months'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>
                    Commencement: {formatDate(selectedAgreement.start_date)}
                  </div>
                </div>
              </div>

              {/* Commercial Terms & Clauses */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 12, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} /> Agreement Clauses & Specifications
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ color: '#64748B' }}>Standard Workday:</span>{' '}
                    <strong style={{ color: '#1E293B' }}>8.0 Hours / Day</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Notice Period:</span>{' '}
                    <strong style={{ color: '#1E293B' }}>30 Days</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Place of Work:</span>{' '}
                    <strong style={{ color: '#1E293B' }}>Client Site & Remote Authorized</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Overtime Terms:</span>{' '}
                    <strong style={{ color: '#1E293B' }}>Pro-rata subject to Line Manager authorization</strong>
                  </div>
                </div>
              </div>

              {/* Signatories */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, background: '#FAFAFA' }}>
                <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 10, fontSize: '0.85rem' }}>
                  Execution & Signatories
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: '0.8rem' }}>
                  <div style={{ borderRight: '1px solid #E2E8F0', paddingRight: 12 }}>
                    <div style={{ color: '#64748B', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Company Director Sign-Off</div>
                    <div style={{ fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
                      {selectedAgreement.approved_by || `${user?.name || 'Company Director'} (Director)`}
                    </div>
                    <div style={{ color: '#64748B', fontSize: '0.75rem', marginTop: 2 }}>
                      Status:{' '}
                      <strong style={{ color: selectedAgreement.status === 'Approved' ? '#059669' : selectedAgreement.status === 'Rejected' ? '#DC2626' : '#D97706' }}>
                        {selectedAgreement.status}
                      </strong>
                    </div>
                  </div>

                  <div>
                    <div style={{ color: '#64748B', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Vendor Signatory</div>
                    <div style={{ fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
                      {selectedAgreement.submitted_by || selectedAgreement.vendor_name || 'Vendor Authorized Signatory'}
                    </div>
                    <div style={{ color: '#64748B', fontSize: '0.75rem', marginTop: 2 }}>
                      Signed & Submitted for Approval
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#F8FAFC',
                position: 'sticky',
                bottom: 0,
                zIndex: 10
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedAgreement(null)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {selectedAgreement.status !== 'Approved' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectModalTarget(selectedAgreement);
                        setRejectionNotes('');
                      }}
                      style={{
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        color: '#DC2626',
                        padding: '8px 16px',
                        borderRadius: 8,
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Reject Agreement
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRevisionModalTarget(selectedAgreement);
                        setRevisionNotes('');
                      }}
                      style={{
                        background: '#FFFBEB',
                        border: '1px solid #FDE68A',
                        color: '#B45309',
                        padding: '8px 16px',
                        borderRadius: 8,
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Request Revision
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApprove(selectedAgreement)}
                      disabled={actionLoadingId === (selectedAgreement.workorder_id || selectedAgreement.id)}
                      style={{
                        background: '#0A0A0A',
                        border: '1px solid #0A0A0A',
                        color: '#FFFFFF',
                        padding: '8px 20px',
                        borderRadius: 8,
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      Approve Agreement ✓
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT NOTES MODAL */}
      {rejectModalTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 20
          }}
          onClick={() => setRejectModalTarget(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              width: '100%',
              maxWidth: 500,
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#DC2626', marginBottom: 12 }}>
              <XCircle size={24} />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                Reject Master Service Agreement
              </h3>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748B', lineHeight: 1.5 }}>
              Provide a reason for rejecting the agreement for{' '}
              <strong>{rejectModalTarget.candidate_name}</strong> ({rejectModalTarget.workorder_id || rejectModalTarget.id}). The vendor recruiter will be notified and the agreement status will be marked as Rejected.
            </p>

            <textarea
              rows={4}
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              placeholder="e.g., Commercial billing rate exceeds role budget ceiling, candidate commencement date is too late, etc."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: '0.86rem',
                outline: 'none',
                marginBottom: 18,
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setRejectModalTarget(null)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={actionLoadingId === (rejectModalTarget.workorder_id || rejectModalTarget.id)}
                style={{
                  background: '#DC2626',
                  border: '1px solid #DC2626',
                  color: '#FFFFFF',
                  padding: '8px 18px',
                  borderRadius: 8,
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(220,38,38,0.2)'
                }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVISION NOTES MODAL */}
      {revisionModalTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 20
          }}
          onClick={() => setRevisionModalTarget(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              width: '100%',
              maxWidth: 500,
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#D97706', marginBottom: 12 }}>
              <AlertCircle size={24} />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                Request Agreement Revision
              </h3>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748B', lineHeight: 1.5 }}>
              Specify the revisions required for{' '}
              <strong>{revisionModalTarget.candidate_name}</strong>'s agreement terms. The vendor recruiter will be alerted to update the work schedule.
            </p>

            <textarea
              rows={4}
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="e.g., Please adjust the daily rate to ₹2,200/day and update the start date to 1st of next month."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: '0.86rem',
                outline: 'none',
                marginBottom: 18,
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setRevisionModalTarget(null)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevisionSubmit}
                disabled={actionLoadingId === (revisionModalTarget.workorder_id || revisionModalTarget.id)}
                style={{
                  background: '#D97706',
                  border: '1px solid #D97706',
                  color: '#FFFFFF',
                  padding: '8px 18px',
                  borderRadius: 8,
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(217,119,6,0.2)'
                }}
              >
                Send Revision Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
