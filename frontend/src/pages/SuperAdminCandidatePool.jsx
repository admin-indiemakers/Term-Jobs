import { useEffect, useState, useMemo } from 'react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Search,
  Filter,
  FileText,
  Download,
  Eye,
  Building2,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  Sparkles,
  Phone,
  Mail,
  Globe,
  X,
  UserCheck,
  Briefcase,
  GraduationCap
} from 'lucide-react';

const getSkillsArray = (skills) => {
  if (Array.isArray(skills)) {
    return skills
      .flatMap((s) => (typeof s === 'string' ? s.split(',').map((x) => x.trim()).filter(Boolean) : [String(s).trim()]))
      .filter(Boolean);
  }
  if (typeof skills === 'string') {
    return skills.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

export default function SuperAdminCandidatePool() {
  const { token } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [vendorsList, setVendorsList] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    portal_applicants: 0,
    vendor_candidates: 0,
    resumes_count: 0,
    contributing_vendors: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState('all'); // 'all', 'portal', 'vendor'
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [selectedSkill, setSelectedSkill] = useState('all');

  // Modals and Inspector
  const [selectedCandidateForModal, setSelectedCandidateForModal] = useState(null);
  const [inspectCandidate, setInspectCandidate] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteCandidateTarget, setDeleteCandidateTarget] = useState(null);

  // Resume PDF preview state
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');

  // Add Candidate Form
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    vendor_name: 'Direct Applicant',
    skills: '',
    summary: '',
    resumeFile: null,
  });
  const [addSubmitting, setAddSubmitting] = useState(false);

  const fetchPoolData = () => {
    setLoading(true);
    request('/api/superadmin/candidate-pool', { token })
      .then((res) => {
        setCandidates(res.candidates || []);
        setVendorsList(res.vendors || []);
        if (res.stats) {
          setStats(res.stats);
        }
        setError('');
      })
      .catch((err) => setError(err.message || 'Failed to load Candidate Pool'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPoolData();
  }, [token]);

  // Clean up PDF blob URL when modal closes
  useEffect(() => {
    if (!selectedCandidateForModal && pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
  }, [selectedCandidateForModal]);

  // Auto-dismiss success notification
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // Handle viewing resume in modal
  const handleViewResume = async (cand) => {
    setSelectedCandidateForModal(cand);
    setPdfLoading(true);
    setPdfError('');
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }

    try {
      const res = await fetch(`/api/candidates/${cand.id}/resume`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Unable to fetch resume (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch (err) {
      setPdfError(err.message || 'Error loading PDF resume preview');
    } finally {
      setPdfLoading(false);
    }
  };

  // Handle direct resume download
  const handleDownloadResume = async (cand) => {
    try {
      const res = await fetch(`/api/candidates/${cand.id}/resume`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cand.candidate_name.replace(/\s+/g, '_')}_Resume.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Could not download resume: ${err.message}`);
    }
  };

  // Handle candidate deletion
  const handleDeleteCandidate = async () => {
    if (!deleteCandidateTarget) return;
    try {
      await request(`/api/superadmin/candidate-pool/${deleteCandidateTarget.id}`, {
        token,
        method: 'DELETE',
      });
      setSuccess(`Candidate ${deleteCandidateTarget.candidate_name} removed from pool.`);
      setDeleteCandidateTarget(null);
      if (inspectCandidate?.id === deleteCandidateTarget.id) {
        setInspectCandidate(null);
      }
      fetchPoolData();
    } catch (err) {
      setError(err.message || 'Failed to remove candidate');
    }
  };

  // Handle manual addition
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.email) {
      alert('Name and email are required.');
      return;
    }

    setAddSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', addForm.name);
      formData.append('email', addForm.email);
      formData.append('phone', addForm.phone);
      formData.append('title', addForm.title);
      formData.append('vendor_name', addForm.vendor_name);
      formData.append('skills', addForm.skills);
      formData.append('summary', addForm.summary);
      if (addForm.resumeFile) {
        formData.append('resume', addForm.resumeFile);
      }

      const res = await fetch('/api/superadmin/candidate-pool', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to add candidate');
      }

      setSuccess('Candidate successfully added to the pool!');
      setShowAddModal(false);
      setAddForm({
        name: '',
        email: '',
        phone: '',
        title: '',
        vendor_name: 'Direct Applicant',
        skills: '',
        summary: '',
        resumeFile: null,
      });
      fetchPoolData();
    } catch (err) {
      alert(err.message);
    } finally {
      setAddSubmitting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!filteredCandidates.length) return;
    const headers = ['Candidate ID', 'Name', 'Email', 'Phone', 'Title', 'Source', 'Vendor', 'Skills', 'Applied Jobs Count', 'Date Added'];
    const rows = filteredCandidates.map((c) => [
      c.id,
      `"${(c.candidate_name || '').replace(/"/g, '""')}"`,
      c.candidate_email || '',
      c.candidate_phone || '',
      `"${(c.candidate_title || '').replace(/"/g, '""')}"`,
      c.source_type,
      `"${(c.vendor_name || '').replace(/"/g, '""')}"`,
      `"${getSkillsArray(c.skills).join(', ').replace(/"/g, '""')}"`,
      (c.applications || []).length,
      c.created_at || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `termjobs_candidate_pool_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Extract all distinct skills across pool for skill filter dropdown
  const allSkills = useMemo(() => {
    const set = new Set();
    candidates.forEach((c) => {
      getSkillsArray(c.skills).forEach((s) => {
        if (s) set.add(s);
      });
    });
    return Array.from(set).sort();
  }, [candidates]);

  // Client-side filtering
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Source filter
      if (selectedSource === 'portal' && !c.is_direct_applicant) return false;
      if (selectedSource === 'vendor' && c.is_direct_applicant) return false;

      // Vendor filter
      if (selectedVendor !== 'all' && c.vendor_name?.toLowerCase() !== selectedVendor.toLowerCase()) {
        return false;
      }

      // Skill filter
      if (selectedSkill !== 'all') {
        const skillsList = getSkillsArray(c.skills);
        const hasSkill = skillsList.some(
          (sk) => sk.toLowerCase() === selectedSkill.toLowerCase()
        );
        if (!hasSkill) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const text = [
          c.candidate_name,
          c.candidate_email,
          c.candidate_phone,
          c.candidate_title,
          c.vendor_name,
          getSkillsArray(c.skills).join(' '),
          c.summary,
          ...(c.applications || []).map((a) => `${a.requisition_title} ${a.company_name}`),
        ]
          .join(' ')
          .toLowerCase();

        return query.split(/\s+/).every((term) => text.includes(term));
      }

      return true;
    });
  }, [candidates, selectedSource, selectedVendor, selectedSkill, searchTerm]);

  return (
    <div className="w-full min-w-0 pb-16 space-y-6 text-left" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Top Banner Header */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase">
              TERM JOBS • GLOBAL TALENT REPOSITORY
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              Live Synchronized
            </span>
          </div>
          <h1 className="text-2xl sm:text-[1.75rem] font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            Platform Candidate Pool
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1 max-w-2xl">
            Centralized talent intelligence aggregating every candidate registered via public job portal and submitted across all vendor partner agencies.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={fetchPoolData}
            title="Refresh candidate roster"
            className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            + Add Candidate
          </button>
        </div>
      </div>

      {/* 5 Core Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Candidates */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">TOTAL POOL</span>
              <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 flex items-center justify-center">
                <Users size={14} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
              {stats.total}
            </div>
            <div className="text-[11px] text-gray-500 font-medium">All registered candidates</div>
          </div>
        </div>

        {/* Direct Portal Applicants */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PORTAL DIRECT</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                <UserCheck size={14} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight my-0.5">
              {stats.portal_applicants}
            </div>
            <div className="text-[11px] text-gray-500 font-medium">Public job board & portal</div>
          </div>
        </div>

        {/* Vendor Sourced */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">VENDOR SOURCED</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
                <Layers size={14} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 tracking-tight my-0.5">
              {stats.vendor_candidates}
            </div>
            <div className="text-[11px] text-gray-500 font-medium">From staffing agencies</div>
          </div>
        </div>

        {/* Resumes on File */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">VERIFIED RESUMES</span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center">
                <FileText size={14} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 tracking-tight my-0.5">
              {stats.resumes_count}
            </div>
            <div className="text-[11px] text-gray-500 font-medium">100% PDF coverage</div>
          </div>
        </div>

        {/* Contributing Vendors */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">ACTIVE AGENCIES</span>
              <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 flex items-center justify-center">
                <Building2 size={14} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
              {stats.contributing_vendors}
            </div>
            <div className="text-[11px] text-gray-500 font-medium">Partner consultancies</div>
          </div>
        </div>
      </div>

      {/* Error & Success Toasts */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2 shadow-2xs">
          <CheckCircle2 size={15} />
          <span>{success}</span>
        </div>
      )}

      {/* Control Bar: Search & Filter Controls */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[260px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search candidates by name, email, phone, skill, role, vendor..."
            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-black transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Source Tabs */}
          <div className="flex items-center p-1 bg-gray-100 rounded-xl text-[11px] font-bold text-gray-600">
            <button
              type="button"
              onClick={() => setSelectedSource('all')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                selectedSource === 'all' ? 'bg-white text-black shadow-xs font-extrabold' : 'hover:text-black'
              }`}
            >
              All Sources
            </button>
            <button
              type="button"
              onClick={() => setSelectedSource('portal')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                selectedSource === 'portal' ? 'bg-white text-emerald-700 shadow-xs font-extrabold' : 'hover:text-black'
              }`}
            >
              Portal Direct
            </button>
            <button
              type="button"
              onClick={() => setSelectedSource('vendor')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                selectedSource === 'vendor' ? 'bg-white text-blue-700 shadow-xs font-extrabold' : 'hover:text-black'
              }`}
            >
              Vendors
            </button>
          </div>

          {/* Vendor Dropdown */}
          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:bg-white focus:border-black cursor-pointer"
          >
            <option value="all">All Vendors ({vendorsList.length})</option>
            {vendorsList.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          {/* Skill Filter Dropdown */}
          {allSkills.length > 0 && (
            <select
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:bg-white focus:border-black cursor-pointer max-w-[180px]"
            >
              <option value="all">All Skills ({allSkills.length})</option>
              {allSkills.map((sk) => (
                <option key={sk} value={sk}>
                  {sk}
                </option>
              ))}
            </select>
          )}

          {(searchTerm || selectedSource !== 'all' || selectedVendor !== 'all' || selectedSkill !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedSource('all');
                setSelectedVendor('all');
                setSelectedSkill('all');
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-black hover:bg-gray-100 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Candidate Table */}
      <div className="bg-white border border-gray-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="text-xs font-bold text-gray-900">
            Showing <span className="font-extrabold text-black">{filteredCandidates.length}</span> candidates
          </div>
          <div className="text-[11px] text-gray-400 font-medium">
            Click any resume button for instant in-app PDF preview
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            <div className="text-xs font-medium">Loading candidate talent pool...</div>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="py-16 text-center text-gray-500 space-y-2">
            <Users size={36} className="mx-auto text-gray-300 stroke-[1.5]" />
            <div className="text-sm font-bold text-gray-800">No candidates found</div>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              {searchTerm || selectedSource !== 'all' || selectedVendor !== 'all'
                ? 'Try broadening your search or resetting the active filters.'
                : 'No candidates registered or submitted yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-400 uppercase text-[10px] font-extrabold tracking-wider">
                  <th className="py-3 px-4">Candidate Profile</th>
                  <th className="py-3 px-4">Channel / Vendor</th>
                  <th className="py-3 px-4">Target Role & Applications</th>
                  <th className="py-3 px-4">Core Competencies</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredCandidates.map((cand) => {
                  const apps = cand.applications || [];
                  const latestApp = apps[0];
                  const hasMultiple = apps.length > 1;

                  return (
                    <tr key={cand.id} className="hover:bg-gray-50/70 transition-colors group">
                      {/* Candidate Column */}
                      <td className="py-3.5 px-4 min-w-[220px]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gray-900 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {(cand.candidate_name || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-gray-900 hover:text-black cursor-pointer flex items-center gap-1.5">
                              <span onClick={() => setInspectCandidate(cand)}>{cand.candidate_name}</span>
                            </div>
                            <div className="text-[11px] text-gray-500 font-medium truncate mt-0.5">
                              {cand.candidate_title || 'Candidate'}
                            </div>
                            <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-1">
                              {cand.candidate_email && (
                                <a
                                  href={`mailto:${cand.candidate_email}`}
                                  className="hover:text-gray-700 flex items-center gap-1"
                                  title={cand.candidate_email}
                                >
                                  <Mail size={11} />
                                  <span className="truncate max-w-[140px]">{cand.candidate_email}</span>
                                </a>
                              )}
                              {cand.candidate_phone && (
                                <span className="flex items-center gap-0.5 text-gray-400" title={cand.candidate_phone}>
                                  <Phone size={10} />
                                  <span className="truncate">{cand.candidate_phone}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Channel / Vendor Column */}
                      <td className="py-3.5 px-4 min-w-[170px]">
                        <div>
                          {cand.is_direct_applicant ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <UserCheck size={11} />
                              Portal Direct
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Layers size={11} />
                              Vendor Partner
                            </span>
                          )}
                          <div className="text-[11px] font-semibold text-gray-800 mt-1.5 flex items-center gap-1">
                            <Building2 size={12} className="text-gray-400 shrink-0" />
                            <span className="truncate">{cand.vendor_name}</span>
                          </div>
                          {cand.created_at && (
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              Added {new Date(cand.created_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Applications Column */}
                      <td className="py-3.5 px-4 min-w-[220px]">
                        {apps.length === 0 ? (
                          <div className="text-gray-400 text-[11px] italic">
                            General Talent Pool (No active requisition)
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="font-bold text-gray-900 text-xs truncate max-w-[220px]">
                              {latestApp.requisition_title}
                            </div>
                            <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5">
                              <span>{latestApp.company_name}</span>
                              {latestApp.match_score !== null && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800">
                                  {latestApp.match_score}%
                                </span>
                              )}
                            </div>
                            {hasMultiple && (
                              <div className="text-[10px] text-gray-400 font-medium">
                                + {apps.length - 1} other application{apps.length > 2 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Skills Column */}
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {getSkillsArray(cand.skills).slice(0, 3).map((sk, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10.5px] font-medium border border-gray-200/60"
                            >
                              {sk}
                            </span>
                          ))}
                          {getSkillsArray(cand.skills).length > 3 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-400 text-[10px] font-bold">
                              +{getSkillsArray(cand.skills).length - 3}
                            </span>
                          )}
                          {getSkillsArray(cand.skills).length === 0 && (
                            <span className="text-gray-400 text-[11px] italic">General Profile</span>
                          )}
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="py-3.5 px-4 text-right min-w-[160px]">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewResume(cand)}
                            className="px-2.5 py-1.5 rounded-lg bg-black hover:bg-gray-800 text-white text-[11px] font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                            title="View Resume PDF in modal"
                          >
                            <FileText size={12} />
                            Resume
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadResume(cand)}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs transition-colors cursor-pointer"
                            title="Download PDF"
                          >
                            <Download size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setInspectCandidate(cand)}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs transition-colors cursor-pointer"
                            title="Candidate Profile Inspector"
                          >
                            <Eye size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteCandidateTarget(cand)}
                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs transition-colors cursor-pointer"
                            title="Remove Candidate"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resume PDF Viewer Modal */}
      {selectedCandidateForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-black text-white font-extrabold flex items-center justify-center">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-gray-900">
                      {selectedCandidateForModal.candidate_name}&apos;s Resume
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Verified
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                    <span>{selectedCandidateForModal.candidate_title || 'Candidate'}</span>
                    <span>•</span>
                    <span>{selectedCandidateForModal.vendor_name}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadResume(selectedCandidateForModal)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={13} />
                  Download
                </button>
                {pdfBlobUrl && (
                  <a
                    href={pdfBlobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink size={13} />
                    New Tab
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedCandidateForModal(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-black transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body: PDF Viewer */}
            <div className="flex-1 min-h-0 bg-gray-100 relative">
              {pdfLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 z-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                  <div className="text-xs font-bold text-gray-700">Loading resume PDF...</div>
                </div>
              )}

              {pdfError ? (
                <div className="p-8 text-center text-red-600 space-y-2">
                  <AlertCircle size={32} className="mx-auto" />
                  <div className="font-bold text-sm">Failed to display resume preview</div>
                  <div className="text-xs text-gray-500">{pdfError}</div>
                  <button
                    type="button"
                    onClick={() => handleDownloadResume(selectedCandidateForModal)}
                    className="mt-3 px-4 py-2 rounded-xl bg-black text-white text-xs font-bold"
                  >
                    Try Direct Download
                  </button>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  src={`${pdfBlobUrl}#toolbar=1&navpanes=0`}
                  title="Candidate Resume"
                  className="w-full h-full border-0"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Candidate Inspector Slide-Over / Modal */}
      {inspectCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-2xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Inspector Header */}
            <div className="p-6 border-b border-gray-200 flex items-start justify-between bg-gray-50/50">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-black text-white font-extrabold text-base flex items-center justify-center shrink-0 shadow-xs">
                  {(inspectCandidate.candidate_name || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">
                    {inspectCandidate.candidate_name}
                  </h2>
                  <div className="text-xs font-medium text-gray-600 mt-0.5">
                    {inspectCandidate.candidate_title || 'Candidate'}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {inspectCandidate.is_direct_applicant ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Portal Direct Applicant
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {inspectCandidate.vendor_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectCandidate(null)}
                className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-black transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Inspector Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Contact Information Bar */}
              <div className="p-4 bg-gray-50 border border-gray-200/80 rounded-xl space-y-2 text-xs">
                <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">
                  CONTACT DETAILS
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Email:</span>
                  <a
                    href={`mailto:${inspectCandidate.candidate_email}`}
                    className="font-bold text-gray-900 hover:underline flex items-center gap-1"
                  >
                    <Mail size={12} />
                    {inspectCandidate.candidate_email || 'Not provided'}
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Phone:</span>
                  <span className="font-bold text-gray-900 flex items-center gap-1">
                    <Phone size={12} />
                    {inspectCandidate.candidate_phone || 'Not provided'}
                  </span>
                </div>
                {inspectCandidate.details?.linkedin_url && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">LinkedIn:</span>
                    <a
                      href={inspectCandidate.details.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Globe size={12} />
                      Profile Link
                    </a>
                  </div>
                )}
                {inspectCandidate.details?.github_url && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">GitHub:</span>
                    <a
                      href={inspectCandidate.details.github_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-gray-900 hover:underline flex items-center gap-1"
                    >
                      <Globe size={12} />
                      Code Repository
                    </a>
                  </div>
                )}
              </div>

              {/* Summary / Cover Note */}
              {inspectCandidate.summary && (
                <div>
                  <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">
                    CANDIDATE SUMMARY & NOTE
                  </div>
                  <div className="p-4 bg-white border border-gray-200 rounded-xl text-xs text-gray-700 leading-relaxed">
                    {inspectCandidate.summary}
                  </div>
                </div>
              )}

              {/* Skills Cloud */}
              <div>
                <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">
                  TECHNICAL SKILLS & COMPETENCIES
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {getSkillsArray(inspectCandidate.skills).map((sk, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg bg-gray-100 text-gray-800 text-xs font-semibold border border-gray-200"
                    >
                      {sk}
                    </span>
                  ))}
                  {getSkillsArray(inspectCandidate.skills).length === 0 && (
                    <div className="text-xs text-gray-400 italic">No explicit skills listed.</div>
                  )}
                </div>
              </div>

              {/* Applied Requisitions History */}
              <div>
                <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">
                  APPLIED REQUISITIONS ({inspectCandidate.applications?.length || 0})
                </div>
                {(inspectCandidate.applications || []).length === 0 ? (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 italic">
                    Registered directly into general pool. Has not applied to a specific requisition.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {inspectCandidate.applications.map((app, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-gray-900 truncate">
                            {app.requisition_title}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                            <span>{app.company_name}</span>
                            <span>•</span>
                            <span className="text-gray-400">
                              {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : 'Active'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {app.match_score !== null && (
                            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-gray-100 text-gray-800">
                              {app.match_score}% Match
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {app.status || 'Screened'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Inspector Footer Actions */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setDeleteCandidateTarget(inspectCandidate)}
                className="px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                Delete
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadResume(inspectCandidate)}
                  className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-800 text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={13} />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleViewResume(inspectCandidate);
                  }}
                  className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText size={13} />
                  View Resume
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Candidate Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white">
              <div>
                <h2 className="text-base font-extrabold text-gray-900">Add Candidate to Pool</h2>
                <p className="text-xs text-gray-500 mt-0.5">Provision candidate profile and upload resume</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Candidate Name *</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. Priya Sharma"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="priya@example.com"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Phone</label>
                  <input
                    type="tel"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Title / Headline</label>
                  <input
                    type="text"
                    value={addForm.title}
                    onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                    placeholder="Senior Backend Engineer"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Channel / Vendor</label>
                  <input
                    type="text"
                    value={addForm.vendor_name}
                    onChange={(e) => setAddForm({ ...addForm, vendor_name: e.target.value })}
                    placeholder="Direct Applicant or Vendor Name"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Skills (comma-separated)</label>
                <input
                  type="text"
                  value={addForm.skills}
                  onChange={(e) => setAddForm({ ...addForm, skills: e.target.value })}
                  placeholder="Python, React, FastAPI, Docker, PostgreSQL"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Resume File (PDF / DOCX)</label>
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => setAddForm({ ...addForm, resumeFile: e.target.files[0] })}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-black file:text-white"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Professional Summary</label>
                <textarea
                  rows={2}
                  value={addForm.summary}
                  onChange={(e) => setAddForm({ ...addForm, summary: e.target.value })}
                  placeholder="Brief overview of the candidate's background and achievements..."
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-black"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {addSubmitting ? 'Adding...' : 'Add to Pool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCandidateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-2xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center">
              <Trash2 size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-gray-900">Remove Candidate</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to remove{' '}
                <span className="font-bold text-gray-900">{deleteCandidateTarget.candidate_name}</span> from the platform candidate pool?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCandidateTarget(null)}
                className="px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCandidate}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-2xs"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
