import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Layers,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Building2,
  MapPin,
  Users,
  Check,
  Plus,
  Briefcase,
  ShieldCheck,
  Sparkles,
  HelpCircle
} from 'lucide-react';

export default function ManagePartnerVendors() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'engaged' | 'available'
  const [search, setSearch] = useState('');

  // Confirmation Modals State
  const [confirmModal, setConfirmModal] = useState(null); // { vendor, willEngage, candidateLimit }
  const [confirmAllModal, setConfirmAllModal] = useState(false); // boolean
  const [actionLoading, setActionLoading] = useState(false);

  const load = () => {
    setLoading(true);
    request('/api/auth/vendors', { token })
      .then((data) => {
        setVendors(Array.isArray(data) ? data : []);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  // 2-second auto-dismiss timer for success notifications
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Open confirmation modal when clicking a vendor card or its Engage pill
  const handleVendorClick = (vendor) => {
    const willEngage = !vendor.engaged;
    setConfirmModal({
      vendor,
      willEngage,
      candidateLimit: vendor.candidate_limit ?? 3,
    });
  };

  // Confirm Single Vendor Engagement / Disengagement
  const handleConfirmAction = async () => {
    if (!confirmModal) return;
    const { vendor, willEngage, candidateLimit } = confirmModal;

    setActionLoading(true);
    setError('');
    setSuccess('');

    // Construct updated vendors payload
    const updatedVendors = vendors.map((v) => {
      if (v.id === vendor.id) {
        return {
          ...v,
          engaged: willEngage,
          candidate_limit: willEngage ? (candidateLimit || 3) : null,
        };
      }
      return v;
    });

    const engagedList = updatedVendors.filter((v) => v.engaged);

    try {
      const payload = {
        engagements: engagedList.map((v) => ({
          vendor_tenant_id: v.id,
          candidate_limit: v.candidate_limit ?? 3,
        })),
        vendor_tenant_ids: engagedList.map((v) => v.id),
      };

      await request('/api/auth/vendors', {
        method: 'PUT',
        token,
        body: payload,
      });

      setVendors(updatedVendors);
      setSuccess(
        willEngage
          ? `"${vendor.name}" engaged successfully as a partner vendor.`
          : `"${vendor.name}" disengaged successfully.`
      );
      setConfirmModal(null);
    } catch (err) {
      setError(err.message || 'Failed to update vendor engagement status');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Engage All / Disengage All
  const handleConfirmAll = async () => {
    const willEngageAll = !allEngaged;
    setActionLoading(true);
    setError('');
    setSuccess('');

    const updatedVendors = vendors.map((v) => ({
      ...v,
      engaged: willEngageAll,
      candidate_limit: willEngageAll ? (v.candidate_limit ?? 3) : null,
    }));

    const engagedList = willEngageAll ? updatedVendors : [];

    try {
      const payload = {
        engagements: engagedList.map((v) => ({
          vendor_tenant_id: v.id,
          candidate_limit: v.candidate_limit ?? 3,
        })),
        vendor_tenant_ids: engagedList.map((v) => v.id),
      };

      await request('/api/auth/vendors', {
        method: 'PUT',
        token,
        body: payload,
      });

      setVendors(updatedVendors);
      setSuccess(
        willEngageAll
          ? `All ${vendors.length} partner vendors have been engaged successfully.`
          : 'All partner vendors have been disengaged.'
      );
      setConfirmAllModal(false);
    } catch (err) {
      setError(err.message || 'Failed to update vendor partnerships');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateLimitDirectly = async (id, val) => {
    const num = val === '' ? 3 : Math.max(1, Math.min(100, parseInt(val, 10) || 1));
    const updatedVendors = vendors.map((v) => (v.id === id ? { ...v, candidate_limit: num } : v));
    setVendors(updatedVendors);

    const engagedList = updatedVendors.filter((v) => v.engaged);

    try {
      const payload = {
        engagements: engagedList.map((v) => ({
          vendor_tenant_id: v.id,
          candidate_limit: v.candidate_limit ?? 3,
        })),
        vendor_tenant_ids: engagedList.map((v) => v.id),
      };
      await request('/api/auth/vendors', {
        method: 'PUT',
        token,
        body: payload,
      });
    } catch {
      // silent fallback
    }
  };

  const allEngaged = useMemo(() => {
    return vendors.length > 0 && vendors.every((v) => v.engaged);
  }, [vendors]);

  const engagedCount = useMemo(() => vendors.filter((v) => v.engaged).length, [vendors]);

  const filteredVendors = useMemo(() => {
    let list = vendors;
    if (activeTab === 'engaged') {
      list = list.filter((v) => v.engaged);
    } else if (activeTab === 'available') {
      list = list.filter((v) => !v.engaged);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          (v.name || '').toLowerCase().includes(q) ||
          (v.location || '').toLowerCase().includes(q) ||
          (v.industry || '').toLowerCase().includes(q) ||
          (Array.isArray(v.specializations) &&
            v.specializations.some((s) => s.toLowerCase().includes(q)))
      );
    }
    return list;
  }, [vendors, activeTab, search]);

  return (
    <div
      className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto min-h-screen"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Banner Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <button
              type="button"
              onClick={() => navigate('/dashboard/admin')}
              className="text-xs font-semibold text-gray-500 hover:text-black flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft size={13} />
              Dashboard
            </button>
            <span className="text-gray-300">•</span>
            <span className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase">
              SOURCING ECOSYSTEM
            </span>
          </div>

          <h1 className="text-2xl sm:text-[1.75rem] font-extrabold text-gray-900 tracking-tight">
            Partner Vendors Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1 max-w-2xl">
            Manage active consultancy vendor partnerships. Only engaged vendors can view your company's published requisitions and submit candidates.
          </p>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-bold shadow-2xs">
              ● Admin
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {user?.tenant_name || 'Client'}
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {engagedCount} engaged
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {vendors.length} total consultancies
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/dashboard/admin"
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-2xs transition-colors inline-flex items-center gap-1.5"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* 3 Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            ENGAGED PARTNERS
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {engagedCount}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Active candidate sourcing channels
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            AVAILABLE CONSULTANCIES
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {vendors.length - engagedCount}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Unengaged vendor network
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            SOURCING STATUS
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {engagedCount > 0 ? 'Active' : 'Standby'}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Candidate submission access
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Vendor Management Hub */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        {/* Controls Row: Filter Tabs, Search & Bulk Engage */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-gray-100/90 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-black shadow-2xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              All Vendors ({vendors.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('engaged')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'engaged'
                  ? 'bg-white text-black shadow-2xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Engaged ({engagedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('available')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'available'
                  ? 'bg-white text-black shadow-2xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Unengaged ({vendors.length - engagedCount})
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Engage / Disengage All Button */}
            {vendors.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmAllModal(true)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                  allEngaged
                    ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    : 'bg-black text-white border-black hover:bg-gray-900'
                }`}
              >
                {allEngaged ? (
                  <>
                    <X size={13} />
                    <span>Disengage All</span>
                  </>
                ) : (
                  <>
                    <Check size={13} />
                    <span>Engage All ({vendors.length})</span>
                  </>
                )}
              </button>
            )}

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, location, skills..."
                className="w-full pl-8 pr-3 py-1.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
              />
            </div>
          </div>
        </div>

        {/* Vendors Grid */}
        {loading ? (
          <div className="py-16 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
            <Loader2 size={20} className="animate-spin text-gray-400" />
            <span>Loading partner vendor network...</span>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="py-16 text-center text-xs text-gray-400 space-y-1">
            <div className="font-bold text-gray-600 text-sm">No vendors found</div>
            <div>Try searching with a different term or toggling tabs.</div>
          </div>
        ) : (
          <div
            className="overflow-y-auto pr-1 pb-1"
            style={{ maxHeight: '480px', minHeight: '260px' }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredVendors.map((v) => {
                const isEngaged = !!v.engaged;
                return (
                  <div
                    key={v.id}
                    onClick={() => handleVendorClick(v)}
                    className={`rounded-2xl p-4 sm:p-4.5 border transition-all cursor-pointer relative flex flex-col justify-between select-none ${
                      isEngaged
                        ? 'bg-white border-black shadow-sm ring-1 ring-black/5 hover:border-black'
                        : 'bg-white border-gray-200/90 hover:border-gray-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Card Top */}
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-black text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {(v.name || '?').slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-gray-900 truncate">{v.name}</h3>
                            <div className="text-[10px] text-gray-400 font-medium capitalize">
                              {v.tenant_type || 'Consultancy'}
                            </div>
                          </div>
                        </div>

                        {/* Engagement Pill */}
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 transition-all ${
                            isEngaged
                              ? 'bg-black text-white shadow-2xs'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {isEngaged ? (
                            <>
                              <Check size={11} className="stroke-[3]" />
                              <span>Engaged</span>
                            </>
                          ) : (
                            <>
                              <Plus size={11} />
                              <span>Engage</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Metadata Chips */}
                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-500 mb-3">
                        {v.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} className="text-gray-400" />
                            <span>{v.location}</span>
                          </span>
                        )}
                        {v.industry && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 size={11} className="text-gray-400" />
                            <span>{v.industry}</span>
                          </span>
                        )}
                        {v.size && (
                          <span className="inline-flex items-center gap-1">
                            <Users size={11} className="text-gray-400" />
                            <span>{v.size}</span>
                          </span>
                        )}
                      </div>

                      {/* Specializations */}
                      {v.specializations && v.specializations.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-3">
                          {v.specializations.slice(0, 4).map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10px] font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card Bottom: Candidate Limit config for Engaged Vendors */}
                    {isEngaged && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 pt-3 border-t border-gray-100"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[11px] font-bold text-gray-700">
                            Candidate Limit / Req
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={v.candidate_limit ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setVendors((prev) =>
                                prev.map((item) => (item.id === v.id ? { ...item, candidate_limit: val === '' ? null : parseInt(val, 10) } : item))
                              );
                            }}
                            onBlur={(e) => handleUpdateLimitDirectly(v.id, e.target.value)}
                            placeholder="3"
                            className="w-20 px-2.5 py-1 text-xs text-right font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black focus:bg-white transition-all font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal Popup for Single Vendor Engagement */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => !actionLoading && setConfirmModal(null)}
        >
          <div
            className="relative w-full max-w-[440px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-black text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {confirmModal.vendor.name?.slice(0, 1).toUpperCase() || 'V'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 tracking-tight">
                    {confirmModal.willEngage ? 'Engage Partner Vendor' : 'Disengage Partner Vendor'}
                  </h3>
                  <p className="text-xs text-gray-500">{confirmModal.vendor.name}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !actionLoading && setConfirmModal(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 mb-6">
              <p className="text-xs text-gray-600 leading-relaxed">
                {confirmModal.willEngage ? (
                  <>
                    Are you sure you want to engage <strong className="text-black font-semibold">{confirmModal.vendor.name}</strong> as an active partner vendor? They will be authorized to view published requisitions and submit matching candidates.
                  </>
                ) : (
                  <>
                    Are you sure you want to disengage <strong className="text-black font-semibold">{confirmModal.vendor.name}</strong>? They will no longer be able to submit candidates for active requisitions.
                  </>
                )}
              </p>

              {confirmModal.willEngage && (
                <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-800">
                      Candidate Submission Limit
                    </label>
                    <span className="text-[11px] text-gray-500">Maximum candidates per requisition</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={confirmModal.candidateLimit}
                    onChange={(e) =>
                      setConfirmModal((prev) => ({
                        ...prev,
                        candidateLimit: Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)),
                      }))
                    }
                    className="w-16 px-2.5 py-1 text-xs text-right font-bold text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black font-mono"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmAction}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  confirmModal.willEngage ? 'bg-black hover:bg-gray-900' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionLoading && <Loader2 size={13} className="animate-spin text-white" />}
                <span>{confirmModal.willEngage ? 'Engage' : 'Disengage'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Engage All / Disengage All */}
      {confirmAllModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => !actionLoading && setConfirmAllModal(false)}
        >
          <div
            className="relative w-full max-w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-base font-bold text-gray-900 tracking-tight">
                {allEngaged ? 'Disengage All Vendors' : 'Engage All Partner Vendors'}
              </h3>
              <button
                type="button"
                onClick={() => !actionLoading && setConfirmAllModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed mb-6">
              {allEngaged
                ? `Are you sure you want to disengage all ${vendors.length} partner consultancies?`
                : `Are you sure you want to engage all ${vendors.length} partner consultancies? All vendors will immediately gain access to submit candidates for active requisitions.`}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmAllModal(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmAll}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  allEngaged ? 'bg-red-600 hover:bg-red-700' : 'bg-black hover:bg-gray-900'
                }`}
              >
                {actionLoading && <Loader2 size={13} className="animate-spin text-white" />}
                <span>{allEngaged ? 'Disengage All' : 'Engage All'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
