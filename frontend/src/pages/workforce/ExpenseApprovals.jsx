import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import {
  RefreshCw, CheckCircle, XCircle, AlertTriangle, Receipt, DollarSign,
  Clock, Filter, ChevronDown, ChevronUp, FileText,
} from 'lucide-react';

export default function ExpenseApprovals() {
  const { token } = useAuth();

  const [expenses, setExpenses] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalPendingAmount, setTotalPendingAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadExpenses = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('/api/workforce/expenses', { token });
      setExpenses(data?.expenses || []);
      setPendingCount(data?.pending_count || 0);
      setTotalPendingAmount(data?.total_amount || 0);
    } catch (err) {
      console.error('Failed to load expenses:', err);
      setError(err.message || 'Failed to load expense data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadExpenses(); }, [token]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return expenses;
    return expenses.filter((e) => e.status === filter);
  }, [expenses, filter]);

  const approvedCount = expenses.filter((e) => e.status === 'Approved').length;
  const rejectedCount = expenses.filter((e) => e.status === 'Rejected').length;
  const totalCount = expenses.length;

  const handleApprove = async (expId) => {
    setActionLoading(expId);
    try {
      await request(`/api/workforce/expenses/${expId}/approve`, {
        method: 'POST',
        token,
        body: { notes: '' },
      });
      await loadExpenses();
    } catch (err) {
      console.error('Approve failed:', err);
      alert(err.message || 'Failed to approve expense');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal);
    try {
      await request(`/api/workforce/expenses/${rejectModal}/reject`, {
        method: 'POST',
        token,
        body: { notes: rejectReason },
      });
      setRejectModal(null);
      setRejectReason('');
      await loadExpenses();
    } catch (err) {
      console.error('Reject failed:', err);
      alert(err.message || 'Failed to reject expense');
    } finally {
      setActionLoading(null);
    }
  };

  const statusColor = (s) => {
    if (s === 'Approved') return { bg: '#dcfce7', text: '#166534', icon: <CheckCircle size={13} /> };
    if (s === 'Pending' || s === 'Submitted') return { bg: '#fef3c7', text: '#92400e', icon: <Clock size={13} /> };
    if (s === 'Rejected') return { bg: '#fee2e2', text: '#991b1b', icon: <XCircle size={13} /> };
    return { bg: '#f3f4f6', text: '#6b7280', icon: null };
  };

  const categoryIcon = (cat) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('travel')) return '✈️';
    if (c.includes('meal') || c.includes('food')) return '🍽️';
    if (c.includes('equipment') || c.includes('hardware')) return '💻';
    if (c.includes('internet') || c.includes('connectivity')) return '🌐';
    if (c.includes('office') || c.includes('supplies')) return '🏢';
    return '📋';
  };

  const filterTabs = [
    { key: 'ALL', label: 'All', count: totalCount },
    { key: 'Pending', label: 'Pending', count: expenses.filter((e) => e.status === 'Pending' || e.status === 'Submitted').length },
    { key: 'Approved', label: 'Approved', count: approvedCount },
    { key: 'Rejected', label: 'Rejected', count: rejectedCount },
  ];

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      {/* Hero */}
      <div className="bg-[#1a1a1a] text-white px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] tracking-[0.18em] text-[#a0a09a] mb-1">
              <span>WORKFORCE</span>
              <span>›</span>
              <span className="text-white">Expenses</span>
            </div>
            <h1 className="text-[1.35rem] font-bold tracking-tight">Expense Approvals</h1>
            <p className="text-[0.82rem] text-[#a0a09a] mt-0.5">
              Review and approve expense claims submitted by your team
            </p>
          </div>
          <button onClick={loadExpenses} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-[0.82rem] font-medium hover:bg-white/15 transition">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-[#eaeae6] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#f59e0b] flex items-center justify-center">
                <Clock size={17} className="text-white" />
              </div>
              <span className="text-[0.72rem] tracking-[0.14em] text-[#8a8a85] font-semibold uppercase">Pending</span>
            </div>
            <div className="text-[1.8rem] font-bold text-[#1a1a1a]">{pendingCount}</div>
          </div>
          <div className="bg-white rounded-xl border border-[#eaeae6] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#8b5cf6] flex items-center justify-center">
                <DollarSign size={17} className="text-white" />
              </div>
              <span className="text-[0.72rem] tracking-[0.14em] text-[#8a8a85] font-semibold uppercase">Pending Amount</span>
            </div>
            <div className="text-[1.8rem] font-bold text-[#1a1a1a]">₹{totalPendingAmount.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl border border-[#eaeae6] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#16a34a] flex items-center justify-center">
                <CheckCircle size={17} className="text-white" />
              </div>
              <span className="text-[0.72rem] tracking-[0.14em] text-[#8a8a85] font-semibold uppercase">Approved</span>
            </div>
            <div className="text-[1.8rem] font-bold text-[#1a1a1a]">{approvedCount}</div>
          </div>
          <div className="bg-white rounded-xl border border-[#eaeae6] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#2563eb] flex items-center justify-center">
                <Receipt size={17} className="text-white" />
              </div>
              <span className="text-[0.72rem] tracking-[0.14em] text-[#8a8a85] font-semibold uppercase">Total Claims</span>
            </div>
            <div className="text-[1.8rem] font-bold text-[#1a1a1a]">{totalCount}</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-full text-[0.82rem] font-semibold transition ${
                filter === tab.key
                  ? 'bg-[#1a1a1a] text-white'
                  : 'bg-white border border-[#eaeae6] text-[#4a4a45] hover:bg-[#f0f0ec]'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 text-[0.72rem] ${filter === tab.key ? 'text-white/70' : 'text-[#8a8a85]'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Expense Cards */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-xl border border-[#eaeae6] p-12 text-center text-[0.88rem] text-[#8a8a85]">
              Loading expenses...
            </div>
          ) : error ? (
            <div className="bg-white rounded-xl border border-[#eaeae6] p-12 text-center">
              <AlertTriangle size={28} className="mx-auto mb-2 text-[#dc2626]" />
              <div className="text-[0.92rem] text-[#dc2626] font-medium">{error}</div>
              <button onClick={loadExpenses} className="mt-2 px-3 py-1.5 bg-[#1a1a1a] text-white text-[0.82rem] rounded-lg">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#eaeae6] p-12 text-center">
              <CheckCircle size={32} className="mx-auto mb-3 text-[#16a34a]" />
              <div className="text-[0.92rem] text-[#4a4a45] font-medium">
                {filter === 'Pending' ? 'No pending expenses to review' : 'No expenses found'}
              </div>
              <div className="text-[0.78rem] text-[#8a8a85] mt-1">
                {filter === 'Pending' ? 'All caught up! Expense claims will appear here when submitted.' : 'Expense claims will appear here once candidates submit them.'}
              </div>
            </div>
          ) : (
            filtered.map((exp) => {
              const isExpanded = expandedId === exp.id;
              const sc = statusColor(exp.status);
              const isPending = exp.status === 'Pending' || exp.status === 'Submitted';

              return (
                <div key={exp.id} className="bg-white rounded-xl border border-[#eaeae6] overflow-hidden">
                  {/* Header */}
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[#f5f5f3] flex items-center justify-center text-[1.2rem]">
                        {categoryIcon(exp.category)}
                      </div>
                      <div>
                        <div className="text-[0.92rem] font-semibold text-[#1a1a1a]">
                          {exp.candidate_name || 'Unknown'}
                        </div>
                        <div className="text-[0.72rem] text-[#8a8a85] font-mono">{exp.candidate_id}</div>
                      </div>
                      <div className="text-[0.82rem] text-[#4a4a45]">
                        <span className="font-medium">{exp.category}</span>
                      </div>
                      <div className="text-[0.78rem] text-[#8a8a85]">
                        {exp.date_label || exp.date}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Amount */}
                      <div className="text-right">
                        <div className="text-[1.1rem] font-bold text-[#1a1a1a]">₹{Number(exp.amount || 0).toLocaleString()}</div>
                        <div className="text-[0.68rem] text-[#8a8a85]">₹{Number(exp.amount || 0).toLocaleString()}</div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.72rem] font-semibold" style={{ backgroundColor: sc.bg, color: sc.text }}>
                        {sc.icon}
                        {exp.status}
                      </div>

                      {/* Expand */}
                      <button onClick={() => setExpandedId(isExpanded ? null : exp.id)} className="p-1.5 rounded-lg hover:bg-[#f0f0ec] transition">
                        {isExpanded ? <ChevronUp size={16} className="text-[#8a8a85]" /> : <ChevronDown size={16} className="text-[#8a8a85]" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-[#eaeae6] px-5 py-4 bg-[#fafaf8]">
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <div className="text-[0.68rem] tracking-[0.12em] text-[#8a8a85] font-semibold uppercase mb-1">Candidate</div>
                          <div className="text-[0.85rem] font-medium text-[#1a1a1a]">{exp.candidate_name}</div>
                          <div className="text-[0.72rem] text-[#8a8a85]">{exp.candidate_id}</div>
                        </div>
                        <div>
                          <div className="text-[0.68rem] tracking-[0.12em] text-[#8a8a85] font-semibold uppercase mb-1">Work Order</div>
                          <div className="text-[0.85rem] font-medium text-[#1a1a1a]">{exp.work_order_number || '—'}</div>
                        </div>
                        <div>
                          <div className="text-[0.68rem] tracking-[0.12em] text-[#8a8a85] font-semibold uppercase mb-1">Date</div>
                          <div className="text-[0.85rem] font-medium text-[#1a1a1a]">{exp.date_label || exp.date}</div>
                        </div>
                      </div>

                      {exp.description && (
                        <div className="mb-4">
                          <div className="text-[0.68rem] tracking-[0.12em] text-[#8a8a85] font-semibold uppercase mb-1">Description</div>
                          <div className="text-[0.85rem] text-[#4a4a45]">{exp.description}</div>
                        </div>
                      )}

                      {exp.receipt_name && (
                        <div className="mb-4">
                          <div className="text-[0.68rem] tracking-[0.12em] text-[#8a8a85] font-semibold uppercase mb-1">Receipt</div>
                          <div className="flex items-center gap-2 text-[0.85rem] text-[#2563eb]">
                            <FileText size={14} />
                            {exp.receipt_name}
                          </div>
                        </div>
                      )}

                      {exp.notes && (
                        <div className="mb-4">
                          <div className="text-[0.68rem] tracking-[0.12em] text-[#8a8a85] font-semibold uppercase mb-1">Notes</div>
                          <div className="text-[0.85rem] text-[#4a4a45]">{exp.notes}</div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      {isPending && (
                        <div className="flex gap-3 pt-3 border-t border-[#eaeae6]">
                          <button
                            onClick={() => handleApprove(exp.id)}
                            disabled={actionLoading === exp.id}
                            className="flex items-center gap-2 px-4 py-2 bg-[#16a34a] text-white rounded-lg text-[0.82rem] font-semibold hover:bg-[#15803d] transition disabled:opacity-50"
                          >
                            <CheckCircle size={14} />
                            {actionLoading === exp.id ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => setRejectModal(exp.id)}
                            disabled={actionLoading === exp.id}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#dc2626] text-[#dc2626] rounded-lg text-[0.82rem] font-semibold hover:bg-[#fef2f2] transition disabled:opacity-50"
                          >
                            <XCircle size={14} />
                            Reject
                          </button>
                        </div>
                      )}

                      {/* Approval/Rejection Info */}
                      {exp.status === 'Approved' && exp.approved_by && (
                        <div className="pt-3 border-t border-[#eaeae6] text-[0.78rem] text-[#16a34a]">
                          Approved by {exp.approved_by} on {exp.approved_at ? new Date(exp.approved_at).toLocaleDateString() : '—'}
                        </div>
                      )}
                      {exp.status === 'Rejected' && exp.rejected_by && (
                        <div className="pt-3 border-t border-[#eaeae6]">
                          <div className="text-[0.78rem] text-[#dc2626]">
                            Rejected by {exp.rejected_by} on {exp.rejected_at ? new Date(exp.rejected_at).toLocaleDateString() : '—'}
                          </div>
                          {exp.rejection_reason && (
                            <div className="text-[0.78rem] text-[#8a8a85] mt-1">Reason: {exp.rejection_reason}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[1.05rem] font-bold text-[#1a1a1a] mb-1">Reject Expense</h3>
            <p className="text-[0.82rem] text-[#8a8a85] mb-4">Provide a reason for rejecting this expense claim.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full border border-[#eaeae6] rounded-lg px-3 py-2.5 text-[0.85rem] resize-none h-24 focus:outline-none focus:ring-2 focus:ring-[#dc2626]/30 focus:border-[#dc2626]"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="px-4 py-2 text-[0.82rem] text-[#4a4a45] hover:bg-[#f0f0ec] rounded-lg transition">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === rejectModal}
                className="px-4 py-2 bg-[#dc2626] text-white rounded-lg text-[0.82rem] font-semibold hover:bg-[#b91c1c] transition disabled:opacity-50"
              >
                {actionLoading === rejectModal ? 'Rejecting...' : 'Reject Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
