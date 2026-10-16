import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { request } from '../api/client';
import { currentBillingMonth, billingCycle } from '../utils/billingPeriod';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const date = (value) => value ? new Date(value).toLocaleDateString('en-IN') : '—';

export default function FinanceApprovals() {
  const { token } = useAuth();
  const [month, setMonth] = useState(() => currentBillingMonth());
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState('All');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    request(`/api/workforce/finance/work-orders?period=${month}`, { token, noCache: true })
      .then((data) => { if (active) setRows(data.work_orders || []); })
      .catch((err) => { if (active) { setRows([]); setError(err.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, month, refresh]);
  const paid = (row) => row.status === 'Paid' || row.payment_status === 'Paid';
  const ready = (row) => !paid(row) && row.ready_for_payment;
  const visible = rows.filter((row) => filter === 'All' || (filter === 'Paid' ? paid(row) : ready(row)));
  return (
    <div className="space-y-6 text-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Finance Approvals</h1>
          <p className="text-sm text-gray-600 mt-1">Track Procurement authorization, Director sign-off and Finance payments for {billingCycle(month).label}.</p></div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold">Billing month <input type="month" aria-label="Billing month" value={month}
            onChange={(e) => { if (e.target.value) setMonth(e.target.value); }} className="border border-gray-300 rounded-xl px-3 py-2 bg-white !text-gray-900" /></label>
          <button type="button" disabled={loading} onClick={() => setRefresh((n) => n + 1)} className="bg-black text-white rounded-xl px-4 py-2 disabled:opacity-50">Refresh</button>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          ['Submitted bills', rows.length],
          ['Awaiting Finance payment', rows.filter(ready).length],
          ['Paid', money(rows.filter(paid).reduce((sum, row) => sum + Number(row.payment_amount ?? row.total_amount ?? 0), 0))],
        ].map(([label, value]) => <div key={label} className="bg-white border border-gray-200 rounded-2xl p-5"><p className="text-sm text-gray-600">{label}</p><p className="text-2xl font-bold mt-2">{loading ? '…' : value}</p></div>)}
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex gap-2">{['All', 'Awaiting Finance', 'Paid'].map((value) => <button type="button" key={value} onClick={() => setFilter(value)} aria-pressed={filter === value}
        className={`rounded-xl px-4 py-2 text-sm font-semibold ${filter === value ? 'bg-black text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>{value}</button>)}</div>
      <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm text-left"><thead className="bg-gray-50 text-gray-600"><tr>{['Candidate / Work order', 'Company / Supplier', 'Amount', 'Procurement', 'Director', 'Finance / Payment'].map((label) => <th key={label} className="p-4 font-semibold">{label}</th>)}</tr></thead>
          <tbody>{!loading && visible.map((row) => <tr key={`${row.candidate_id}-${row.period}`} className="border-t border-gray-100">
            <td className="p-4"><strong>{row.candidate_name}</strong><div className="text-gray-500">{row.work_order_number} · {row.period}</div></td>
            <td className="p-4">{row.company_name || 'Not provided'}<div className="text-gray-500">{row.vendor_name || 'Not provided'}</div></td>
            <td className="p-4 font-semibold">{money(row.total_amount)}</td>
            <td className="p-4">{row.procurement_approved_by || 'Pending'}<div className="text-gray-500">{date(row.procurement_approved_at)}</div></td>
            <td className="p-4">{row.director_approved_by || row.sow_data?.director_approved_by || 'Pending'}<div className="text-gray-500">{date(row.director_approved_at || row.sow_data?.director_approved_at)}</div></td>
            <td className="p-4"><strong>{paid(row) ? 'Paid' : ready(row) ? 'Awaiting payment' : row.status}</strong><div>{row.payment_processed_by || ''}</div><div className="text-gray-500">{date(row.payment_processed_at)}</div><div className="break-all">{row.transaction_ref || ''}</div></td>
          </tr>)}</tbody></table>
        {loading && <p role="status" className="p-8 text-center text-gray-500">Loading billing approvals…</p>}
        {!loading && !error && visible.length === 0 && <p className="p-8 text-center text-gray-500">No matching billing submissions for {billingCycle(month).label}.</p>}
      </div>
    </div>
  );
}
