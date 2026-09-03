import { useEffect, useMemo, useState, useRef } from 'react';
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
  HelpCircle,
  UserPlus
} from 'lucide-react';

const EMPTY_GUEST_FORM = {
  vendor_name: '',
  industry: '',
  location: '',
  specializations: '',
  notes: '',
  name: '',
  email: '',
  password: '',
  candidate_limit: 3,
};

export default function ManagePartnerVendors() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'engaged' | 'available' | 'guest'
  const [search, setSearch] = useState('');

  // Confirmation Modals State
  const [confirmModal, setConfirmModal] = useState(null); // { vendor, willEngage, candidateLimit }
  const [confirmAllModal, setConfirmAllModal] = useState(false); // boolean
  const [actionLoading, setActionLoading] = useState(false);

  // Guest Vendor Creation Modal State
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestForm, setGuestForm] = useState(EMPTY_GUEST_FORM);
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [guestAiLoading, setGuestAiLoading] = useState(false);
  const [guestShowPassword, setGuestShowPassword] = useState(false);
  const [guestNameStatus, setGuestNameStatus] = useState(''); // '' | 'checking' | 'ok' | 'taken'
  const [guestFieldErrors, setGuestFieldErrors] = useState({});
  const nameCheckTimer = useRef(null);

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

  // Real-time vendor name availability check
  const handleVendorNameChange = (val) => {
    setGuestForm((prev) => ({ ...prev, vendor_name: val }));
    if (guestFieldErrors.vendor_name) {
      setGuestFieldErrors((prev) => ({ ...prev, vendor_name: undefined }));
    }
    if (nameCheckTimer.current) clearTimeout(nameCheckTimer.current);

    if (!val || val.trim().length < 2) {
      setGuestNameStatus('');
      return;
    }

    setGuestNameStatus('checking');
    nameCheckTimer.current = setTimeout(async () => {
      try {
        const res = await request(
          `/api/auth/tenants/check-name?name=${encodeURIComponent(val.trim())}`,
          { token }
        );
        setGuestNameStatus(res.taken ? 'taken' : 'ok');
      } catch {
        setGuestNameStatus('');
      }
    }, 400);
  };

  // AI Auto-Fill with Groq LLM
  const handleAiAutoFill = async () => {
    const vName = guestForm.vendor_name.trim();
    if (!vName) {
      setGuestFieldErrors((prev) => ({ ...prev, vendor_name: 'Enter vendor name first' }));
      return;
    }
    setGuestAiLoading(true);
    try {
      const res = await request('/api/auth/tenants/ai-describe', {
        method: 'POST',
        token,
        body: { name: vName },
      });
      setGuestForm((prev) => ({
        ...prev,
        industry: res.industry || prev.industry,
        location: res.location || prev.location,
        specializations: res.tech_stack || prev.specializations,
        notes: res.notes || prev.notes,
      }));
    } catch {
      // silent fallback
    } finally {
      setGuestAiLoading(false);
    }
  };

  const handleCreateGuestVendor = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!guestForm.vendor_name.trim() || guestForm.vendor_name.trim().length < 2) {
      errs.vendor_name = 'Vendor name must be at least 2 characters';
    }
    if (guestNameStatus === 'taken') {
      errs.vendor_name = 'This vendor name is already registered';
    }
    if (!guestForm.name.trim()) {
      errs.name = 'Recruiter full name is required';
    }
    if (!guestForm.email.trim() || !guestForm.email.includes('@')) {
      errs.email = 'Valid recruiter email is required';
    }
    if (!guestForm.password || guestForm.password.length < 4) {
      errs.password = 'Password must be at least 4 characters';
    }

    if (Object.keys(errs).length > 0) {
      setGuestFieldErrors(errs);
      return;
    }

    setGuestSubmitting(true);
    setError('');
    try {
      await request('/api/auth/vendors/guest', {
        method: 'POST',
        token,
        body: {
          vendor_name: guestForm.vendor_name.trim(),
          industry: guestForm.industry.trim(),
          location: guestForm.location.trim(),
          specializations: guestForm.specializations.trim(),
          notes: guestForm.notes.trim(),
          name: guestForm.name.trim(),
          email: guestForm.email.trim().toLowerCase(),
          password: guestForm.password,
          candidate_limit: parseInt(guestForm.candidate_limit, 10) || 3,
        },
      });

      setSuccess(`"${guestForm.vendor_name.trim()}" onboarded successfully as a partner guest vendor.`);
      setShowGuestModal(false);
      setGuestForm(EMPTY_GUEST_FORM);
      setGuestNameStatus('');
      setGuestFieldErrors({});
      load();
    } catch (err) {
      setError(err.message || 'Failed to create guest vendor');
    } finally {
      setGuestSubmitting(false);
    }
  };

  // Open confirmation modal when clicking a vendor or its Engage button
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
  const guestCount = useMemo(() => vendors.filter((v) => v.is_guest || v.vendor_type === 'guest').length, [vendors]);

  const filteredVendors = useMemo(() => {
    let list = vendors;
    if (activeTab === 'engaged') {
      list = list.filter((v) => v.engaged);
    } else if (activeTab === 'available') {
      list = list.filter((v) => !v.engaged);
    } else if (activeTab === 'guest') {
      list = list.filter((v) => v.is_guest || v.vendor_type === 'guest');
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
      className="space-y-3.5 w-full h-[calc(100vh-5.5rem)] flex flex-col pb-1"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <style>{`
        .custom-vendor-scroller::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-vendor-scroller::-webkit-scrollbar-track {
          background: #F4F4F2;
          border-radius: 8px;
        }
        .custom-vendor-scroller::-webkit-scrollbar-thumb {
          background: #D1D1CB;
          border-radius: 8px;
        }
        .custom-vendor-scroller::-webkit-scrollbar-thumb:hover {
          background: #9CA3AF;
        }
      `}</style>

      {/* Top Banner Header Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
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

          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            Partner Vendors Management
          </h1>
          <p className="text-xs text-gray-500 font-normal mt-0.5 max-w-2xl">
            Manage active consultancy vendor partnerships. Only engaged vendors can view your company's published requisitions and submit candidates.
          </p>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-black text-white text-[11px] font-bold shadow-2xs">
              ● Admin
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-800 text-[11px] font-semibold shadow-2xs">
              {user?.tenant_name || 'Client'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-800 text-[11px] font-semibold shadow-2xs">
              {engagedCount} engaged
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-800 text-[11px] font-semibold shadow-2xs">
              {guestCount} guest vendors
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-800 text-[11px] font-semibold shadow-2xs">
              {vendors.length} total consultancies
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Link
            to="/dashboard/admin"
            className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-2xs transition-colors inline-flex items-center gap-1.5"
          >
            Back to Dashboard
          </Link>

          <button
            type="button"
            onClick={() => setShowGuestModal(true)}
            className="px-3.5 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus size={14} />
            <span>+ Onboard Guest Vendor</span>
          </button>
        </div>
      </div>

      {/* 3 Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
        <div className="bg-white border border-gray-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            ENGAGED PARTNERS
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            {engagedCount}
          </div>
          <div className="text-[11px] text-gray-500 font-medium mt-0.5">
            Active candidate sourcing channels
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            AVAILABLE CONSULTANCIES
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            {vendors.length - engagedCount}
          </div>
          <div className="text-[11px] text-gray-500 font-medium mt-0.5">
            Unengaged vendor network
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            SOURCING STATUS
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            {engagedCount > 0 ? 'Active' : 'Standby'}
          </div>
          <div className="text-[11px] text-gray-500 font-medium mt-0.5">
            Candidate submission access
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 shrink-0">
          <AlertCircle size={14} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2 shadow-2xs shrink-0 animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Vendor Management Hub: Viewport Height Aligned with Inbuilt Scroller */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Controls Row: Filter Tabs, Search & Bulk Engage */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 shrink-0">
          {/* Tabs: All, Engaged, Unengaged, Guest */}
          <div className="flex items-center gap-1 bg-gray-100/90 p-1 rounded-xl flex-wrap">
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
            <button
              type="button"
              onClick={() => setActiveTab('guest')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'guest'
                  ? 'bg-white text-black shadow-2xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Guest ({guestCount})</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Engage / Disengage All Button */}
            {vendors.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmAllModal(true)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
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
            <div className="relative w-full sm:w-60">
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

        {/* Inbuilt Custom Scroller Container */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto pr-1 pt-1 custom-vendor-scroller">
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
            <table className="w-full text-left text-xs border-collapse relative">
              <thead className="sticky top-0 bg-white z-10 shadow-2xs">
                <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white">
                  <th className="py-2.5 px-3">VENDOR CONSULTANCY</th>
                  <th className="py-2.5 px-3">LOCATION & INDUSTRY</th>
                  <th className="py-2.5 px-3">SPECIALIZATIONS</th>
                  <th className="py-2.5 px-3">SUBMISSION LIMIT</th>
                  <th className="py-2.5 px-3">PARTNERSHIP STATUS</th>
                  <th className="py-2.5 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVendors.map((v) => {
                  const isEngaged = !!v.engaged;
                  const isGuest = !!v.is_guest || v.vendor_type === 'guest';

                  return (
                    <tr
                      key={v.id}
                      className="hover:bg-gray-50/70 transition-colors group"
                    >
                      {/* Vendor Consultancy Name & Avatar */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-black text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {(v.name || '?').slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-gray-900 text-sm">{v.name}</span>
                            </div>
                            <div className="text-[10px] font-medium capitalize mt-0.5">
                              {isGuest ? (
                                <span className="inline-block font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded text-[9px]">
                                  Guest Consultancy
                                </span>
                              ) : (
                                <span className="text-gray-400">
                                  {v.tenant_type || 'Consultancy'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Location & Industry */}
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          {v.location && (
                            <div className="flex items-center gap-1.5 text-gray-700 font-medium text-xs">
                              <MapPin size={12} className="text-gray-400 shrink-0" />
                              <span>{v.location}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
                            {v.industry && (
                              <span className="inline-flex items-center gap-1">
                                <Building2 size={11} className="text-gray-400 shrink-0" />
                                <span>{v.industry}</span>
                              </span>
                            )}
                            {v.size && <span className="text-gray-400">• {v.size}</span>}
                          </div>
                        </div>
                      </td>

                      {/* Specializations Tags */}
                      <td className="py-3 px-3">
                        {v.specializations && v.specializations.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap max-w-xs">
                            {v.specializations.slice(0, 4).map((s) => (
                              <span
                                key={s}
                                className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10px] font-medium"
                              >
                                {s}
                              </span>
                            ))}
                            {v.specializations.length > 4 && (
                              <span className="text-[10px] text-gray-400 font-semibold">
                                +{v.specializations.length - 4}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">General Sourcing</span>
                        )}
                      </td>

                      {/* Candidate Limit */}
                      <td className="py-3 px-3">
                        {isEngaged ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={v.candidate_limit ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setVendors((prev) =>
                                  prev.map((item) =>
                                    item.id === v.id
                                      ? { ...item, candidate_limit: val === '' ? null : parseInt(val, 10) }
                                      : item
                                  )
                                );
                              }}
                              onBlur={(e) => handleUpdateLimitDirectly(v.id, e.target.value)}
                              placeholder="3"
                              className="w-14 px-2 py-1 text-xs text-center font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black focus:bg-white transition-all font-mono"
                            />
                            <span className="text-[11px] text-gray-500 font-medium">/ req</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Default (3/req)</span>
                        )}
                      </td>

                      {/* Partnership Status Pill */}
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => handleVendorClick(v)}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            isEngaged
                              ? 'bg-black text-white shadow-2xs hover:bg-gray-800'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {isEngaged ? (
                            <>
                              <Check size={12} className="stroke-[3]" />
                              <span>Engaged</span>
                            </>
                          ) : (
                            <>
                              <Plus size={12} />
                              <span>Engage</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Action Links */}
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleVendorClick(v)}
                          className={`text-xs font-bold transition-colors cursor-pointer underline-offset-2 hover:underline ${
                            isEngaged
                              ? 'text-gray-500 hover:text-red-600'
                              : 'text-gray-900 hover:text-black'
                          }`}
                        >
                          {isEngaged ? 'Disengage' : 'Engage Partner'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Popup: Onboard Guest Vendor */}
      {showGuestModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => !guestSubmitting && setShowGuestModal(false)}
        >
          <div
            className="relative w-full max-w-[540px] bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 sm:p-8 text-left max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-2xs shrink-0">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">Onboard Guest Vendor</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Register a partner consultancy directly for {user?.tenant_name || 'your company'}.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !guestSubmitting && setShowGuestModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateGuestVendor} className="space-y-4">
              {/* Vendor Name & AI Describe */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-900">
                    Vendor Consultancy Name <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAiAutoFill}
                    disabled={guestAiLoading || !guestForm.vendor_name.trim()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {guestAiLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    <span>Auto-fill with AI</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={guestForm.vendor_name}
                    onChange={(e) => handleVendorNameChange(e.target.value)}
                    placeholder="e.g. Apex Staffing Partners"
                    className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black font-medium transition-all ${
                      guestFieldErrors.vendor_name ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
                    }`}
                  />
                  {guestNameStatus === 'checking' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 flex items-center gap-1">
                      <Loader2 size={11} className="animate-spin" /> Checking
                    </span>
                  )}
                  {guestNameStatus === 'ok' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                      <Check size={12} /> Available
                    </span>
                  )}
                  {guestNameStatus === 'taken' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-red-500 font-bold">
                      Name taken
                    </span>
                  )}
                </div>
                {guestFieldErrors.vendor_name && (
                  <p className="text-[11px] text-red-500 mt-1">{guestFieldErrors.vendor_name}</p>
                )}
              </div>

              {/* Industry & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">Industry</label>
                  <input
                    type="text"
                    value={guestForm.industry}
                    onChange={(e) => setGuestForm({ ...guestForm, industry: e.target.value })}
                    placeholder="Staffing & Recruitment"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black font-medium transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">Location / HQ</label>
                  <input
                    type="text"
                    value={guestForm.location}
                    onChange={(e) => setGuestForm({ ...guestForm, location: e.target.value })}
                    placeholder="Bangalore, India"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black font-medium transition-all"
                  />
                </div>
              </div>

              {/* Specializations */}
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-1.5">Hiring Specializations</label>
                <input
                  type="text"
                  value={guestForm.specializations}
                  onChange={(e) => setGuestForm({ ...guestForm, specializations: e.target.value })}
                  placeholder="React, Python, AWS, Fullstack"
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black font-medium transition-all"
                />
              </div>

              <div className="pt-2 border-t border-gray-100">
                <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2.5">
                  RECRUITER LOGIN CREDENTIALS
                </div>
              </div>

              {/* Recruiter Full Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    Recruiter Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={guestForm.name}
                    onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black font-medium transition-all ${
                      guestFieldErrors.name ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
                    }`}
                  />
                  {guestFieldErrors.name && (
                    <p className="text-[11px] text-red-500 mt-1">{guestFieldErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    Recruiter Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={guestForm.email}
                    onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                    placeholder="recruiter@apex.com"
                    className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black font-medium transition-all ${
                      guestFieldErrors.email ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
                    }`}
                  />
                  {guestFieldErrors.email && (
                    <p className="text-[11px] text-red-500 mt-1">{guestFieldErrors.email}</p>
                  )}
                </div>
              </div>

              {/* Recruiter Password & Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    Recruiter Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={guestShowPassword ? 'text' : 'password'}
                      required
                      value={guestForm.password}
                      onChange={(e) => setGuestForm({ ...guestForm, password: e.target.value })}
                      placeholder="Min 4 characters"
                      className={`w-full bg-white border rounded-xl px-3.5 py-2.5 pr-14 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black font-medium transition-all ${
                        guestFieldErrors.password ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setGuestShowPassword(!guestShowPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 hover:text-black cursor-pointer select-none"
                    >
                      {guestShowPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {guestFieldErrors.password && (
                    <p className="text-[11px] text-red-500 mt-1">{guestFieldErrors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    Candidate Limit / Req
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={guestForm.candidate_limit}
                    onChange={(e) => setGuestForm({ ...guestForm, candidate_limit: e.target.value })}
                    placeholder="3"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black font-medium transition-all font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  disabled={guestSubmitting}
                  onClick={() => setShowGuestModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={guestSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {guestSubmitting && <Loader2 size={13} className="animate-spin text-white" />}
                  <span>{guestSubmitting ? 'Onboarding...' : '+ Onboard Guest Vendor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
