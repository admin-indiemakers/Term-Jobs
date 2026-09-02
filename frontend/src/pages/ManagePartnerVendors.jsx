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
  Sparkles
} from 'lucide-react';

export default function ManagePartnerVendors() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'engaged' | 'available'
  const [search, setSearch] = useState('');

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

  const toggleVendor = (id) => {
    setVendors((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;
        const willEngage = !v.engaged;
        return {
          ...v,
          engaged: willEngage,
          candidate_limit: willEngage ? (v.candidate_limit ?? 3) : null,
        };
      })
    );
  };

  const setVendorCandidateLimit = (id, val) => {
    const num = val === '' ? null : Math.max(1, Math.min(100, parseInt(val, 10) || 1));
    setVendors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, candidate_limit: num } : v))
    );
  };

  const saveVendors = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = vendors.map((v) => ({
        vendor_tenant_id: v.id,
        engaged: !!v.engaged,
        candidate_limit: v.engaged ? (v.candidate_limit ?? 3) : null,
      }));
      await request('/api/auth/vendors', {
        method: 'POST',
        token,
        body: payload,
      });
      setSuccess('Vendor partnerships and candidate limits updated successfully.');
      load();
    } catch (err) {
      setError(err.message || 'Failed to save vendor partnerships');
    } finally {
      setSaving(false);
    }
  };

  const allEngaged = useMemo(() => {
    return vendors.length > 0 && vendors.every((v) => v.engaged);
  }, [vendors]);

  const toggleEngageAll = () => {
    if (allEngaged) {
      // Unengage all
      setVendors((prev) =>
        prev.map((v) => ({ ...v, engaged: false, candidate_limit: null }))
      );
    } else {
      // Engage all
      setVendors((prev) =>
        prev.map((v) => ({
          ...v,
          engaged: true,
          candidate_limit: v.candidate_limit ?? 3,
        }))
      );
    }
  };

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
      className="w-full min-w-0 pb-12 space-y-5 text-left"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Header Banner Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <button
              type="button"
              onClick={() => navigate('/dashboard/admin')}
              className="text-xs font-semibold text-gray-500 hover:text-black flex items-center gap-1 transition-colors"
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
        {/* Controls Row: Filter Tabs & Search */}
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

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Engage All / Unengage All Toggle Button */}
            <button
              type="button"
              onClick={toggleEngageAll}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                allEngaged
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                  : 'bg-black hover:bg-gray-900 text-white shadow-2xs'
              }`}
            >
              {allEngaged ? (
                <>
                  <X size={12} />
                  <span>Unengage All</span>
                </>
              ) : (
                <>
                  <Check size={12} className="stroke-[3]" />
                  <span>Engage All ({vendors.length})</span>
                </>
              )}
            </button>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, location, skills..."
                className="w-full pl-8 pr-7 py-1.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Vendors Grid */}
        {loading ? (
          <div className="py-16 text-center text-xs text-gray-400">Loading vendor ecosystem...</div>
        ) : filteredVendors.length === 0 ? (
          <div className="py-16 text-center text-xs text-gray-400 space-y-1">
            <div className="font-semibold text-gray-600">No consultancies found matching your filter.</div>
            <div>Try searching with a different term or toggling tabs.</div>
          </div>
        ) : (
          <div
            className="overflow-y-auto pr-1 pb-1"
            style={{ maxHeight: '380px', minHeight: '220px' }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredVendors.map((v) => {
              const isEngaged = !!v.engaged;
              return (
                <div
                  key={v.id}
                  onClick={() => toggleVendor(v.id)}
                  className={`rounded-2xl p-4 border transition-all cursor-pointer relative flex flex-col justify-between ${
                    isEngaged
                      ? 'bg-white border-black shadow-sm ring-1 ring-black/5'
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

                      {/* Engagement Pill Toggle */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 transition-colors ${
                          isEngaged
                            ? 'bg-black text-white'
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
                          onChange={(e) => setVendorCandidateLimit(v.id, e.target.value)}
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

        {/* Bottom Save Action Bar */}
        <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            Changes to vendor partnerships and candidate limits take effect immediately across all published requisitions.
          </p>
          <button
            type="button"
            onClick={saveVendors}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {saving && <Loader2 size={13} className="animate-spin text-white" />}
            <span>Save Vendor Partnerships</span>
          </button>
        </div>
      </div>
    </div>
  );
}
