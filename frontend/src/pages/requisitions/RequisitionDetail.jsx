import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  ChevronLeft,
  MoreHorizontal,
  FileText,
  Layers,
  Activity,
  Info,
  Check,
  Sparkles,
  Send,
  Trash2,
  Users,
  ArrowRight,
  ShieldCheck,
  Clock,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Edit3,
  Building,
  Calendar,
  XCircle,
  Plus
} from 'lucide-react';

const STATE_STEPS = [
  { id: 'Draft', label: 'Draft', num: '1' },
  { id: 'Intake', label: 'AI Intake', num: '2' },
  { id: 'Structuring', label: 'Structuring', num: '3' },
  { id: 'PendingApproval', label: 'Approval', num: '4' },
  { id: 'Published', label: 'Published', num: '5' },
];

const NORMALIZED = {
  Draft: 'Draft',
  Intake: 'Intake',
  Structuring: 'Structuring',
  PendingApproval: 'PendingApproval',
  Pending_Approval: 'PendingApproval',
  Published: 'Published',
  Closed: 'Closed',
};

function formatCustomDate(iso, defaultText = '25 Sept 2026, 6:19 am') {
  if (!iso) return defaultText;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
  } catch {
    return defaultText;
  }
}

function StatusPill({ status }) {
  const s = (status || '').toLowerCase().replace(/[\s_]+/g, '');
  if (s === 'published' || s === 'active' || s === 'open') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Published
      </span>
    );
  }
  if (s === 'pendingapproval' || s === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Pending Approval
      </span>
    );
  }
  if (s === 'draft' || s === 'drafted' || s === 'intake' || s === 'structuring') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
        {status || 'Draft'}
      </span>
    );
  }
  if (s === 'closed' || s === 'completed' || s === 'filled') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      {status || 'Draft'}
    </span>
  );
}

export default function RequisitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState('');

  // Dropdowns & Modals state
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRefineBox, setShowRefineBox] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [answer, setAnswer] = useState('');

  // Editable fields form state
  const [editForm, setEditForm] = useState({
    title: '',
    department: '',
    experience: '',
    work_mode: '',
    duration: '',
    headcount: 1,
    skills: '',
    description: '',
    deadline: '28 Sept 2026, 6:00 pm',
  });

  const load = () => {
    setLoading(true);
    request(`/requisitions/${id}`, { token })
      .then((data) => {
        setReq(data);
        const structured = data.structured_role || {};
        
        let skillsStr = '';
        if (Array.isArray(structured.primary_skills)) {
          skillsStr = structured.primary_skills.join(', ');
        } else if (Array.isArray(structured.required_skills)) {
          skillsStr = structured.required_skills.join(', ');
        } else if (Array.isArray(data.skills)) {
          skillsStr = data.skills.join(', ');
        } else if (typeof structured.primary_skills === 'string') {
          skillsStr = structured.primary_skills;
        } else {
          skillsStr = 'Kubernetes, Terraform, AWS, CI/CD, Docker, Vault';
        }

        setEditForm({
          title: data.title || structured.title || 'DevSecOps Engineer',
          department: data.department || structured.department || 'Engineering',
          experience: structured.experience_level || structured.experience_years || '5–8 years',
          work_mode: structured.work_mode || data.work_mode || 'Hybrid',
          duration: structured.duration || data.duration || '6 Months',
          headcount: structured.headcount || data.headcount || 1,
          skills: skillsStr,
          deadline:
            structured.submission_deadline ||
            data.submission_deadline ||
            structured.shortlist_deadline ||
            data.shortlist_deadline ||
            '28 Sept 2026, 6:00 pm',
          description:
            structured.summary ||
            structured.role_overview ||
            data.description ||
            'We are looking for a DevSecOps Engineer to build and maintain secure, scalable infrastructure and deployment pipelines. You will work closely with engineering teams to improve release velocity, security, and reliability across our platforms.',
        });

        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id, token]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutside = () => setShowActionMenu(false);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, []);

  const rawStatus = req?.status || 'Draft';
  const status = NORMALIZED[rawStatus] || rawStatus;
  const structuredRole = req?.structured_role || {};

  const currentStepIndex = Math.max(
    0,
    STATE_STEPS.findIndex((s) => s.id === status)
  );

  // Parse skill tags list
  const skillsList = useMemo(() => {
    if (editForm.skills) {
      return editForm.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const raw =
      structuredRole?.primary_skills ||
      structuredRole?.required_skills ||
      req?.skills ||
      [];
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return ['Kubernetes', 'Terraform', 'AWS', 'CI/CD', 'Docker', 'Vault'];
  }, [editForm.skills, structuredRole, req]);

  // Handle Save Edit Form
  const handleSaveEdit = async (e) => {
    if (e) e.preventDefault();
    setBusy('saving');
    setError('');
    setInfo('');
    try {
      const skillsArr = editForm.skills.split(',').map((s) => s.trim()).filter(Boolean);
      const updatedRole = {
        ...(req?.structured_role || {}),
        title: editForm.title,
        department: editForm.department,
        experience_level: editForm.experience,
        work_mode: editForm.work_mode,
        duration: editForm.duration,
        headcount: parseInt(editForm.headcount, 10) || 1,
        submission_deadline: editForm.deadline,
        primary_skills: skillsArr,
        summary: editForm.description,
        role_overview: editForm.description,
      };

      await request(`/requisitions/${id}/approve`, {
        method: 'POST',
        body: { edited_role: updatedRole, reviewer: user?.email || user?.name },
        token,
      });

      setInfo('Requisition updated successfully.');
      setShowEditModal(false);
      load();
    } catch (err) {
      setError(err.message || 'Failed to update requisition.');
    } finally {

      setBusy('');
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    setBusy('deleting');
    try {
      await request(`/requisitions/${id}`, { method: 'DELETE', token });
      navigate('/dashboard/requisitions');
    } catch (err) {
      setError(err.message || 'Failed to delete requisition.');
    } finally {
      setBusy('');
    }
  };

  // Handle Workflow Actions
  const handlePublish = async () => {
    setBusy('publish');
    setError('');
    setInfo('');
    try {
      await request(`/requisitions/${id}/publish`, { method: 'POST', token });
      setInfo('Requisition published successfully!');
      load();
    } catch (err) {
      setError(err.message || 'Failed to publish requisition');
    } finally {
      setBusy('');
    }
  };

  const handleStartIntake = async () => {
    setBusy('start');
    try {
      await request(`/requisitions/${id}/start`, { method: 'POST', token });
      setInfo('AI Intake started.');
      load();
    } catch (err) {
      setError(err.message || 'Failed to start AI intake');
    } finally {
      setBusy('');
    }
  };

  const handleApprove = async () => {
    setBusy('approve');
    try {
      await request(`/requisitions/${id}/approve`, {
        method: 'POST',
        body: { reviewer: user?.email || user?.name },
        token,
      });
      setInfo('Submitted for approval.');
      load();
    } catch (err) {
      setError(err.message || 'Failed to approve');
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <div className="w-full py-24 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
        <Loader2 size={16} className="animate-spin text-gray-500" />
        <span>Loading requisition details...</span>
      </div>
    );
  }

  if (!req) {
    return (
      <div className="w-full py-16 text-center space-y-3">
        <AlertCircle size={28} className="mx-auto text-red-500" />
        <div className="text-sm font-bold text-gray-900">Requisition Not Found</div>
        <p className="text-xs text-gray-400">{error || 'This requisition may have been removed.'}</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard/requisitions')}
          className="px-4 py-2 rounded-xl bg-black text-white text-xs font-bold shadow-xs hover:bg-gray-900 cursor-pointer"
        >
          Back to Requisitions
        </button>
      </div>
    );
  }

  const reqIdShort = (req.id || id || '').replace(/[^0-9]/g, '').slice(0, 8) || id.slice(0, 8);
  const titleDisplay = editForm.title || req.title || structuredRole?.title || 'DevSecOps Engineer';
  const deptDisplay = editForm.department || req.department || structuredRole?.department || 'Engineering';
  const createdDateDisplay = formatCustomDate(req.created_at, '25 Sept 2026, 6:19 am');

  return (
    <div
      className="w-full min-w-0 h-full flex flex-col justify-start gap-3.5 text-left overflow-hidden pb-1"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Header Card (Requisitions • REQ #...) */}
      <div className="bg-transparent space-y-3 pt-1 px-0.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            {/* Breadcrumb Kicker */}
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 tracking-tight mb-1.5">
              <Link to="/dashboard/requisitions" className="hover:text-black transition-colors font-medium">
                Requisitions
              </Link>
              <span>•</span>
              <span className="font-mono text-gray-500">REQ #{reqIdShort}</span>
            </div>

            {/* Title + Status Badge */}
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                {titleDisplay}
              </h1>
              <StatusPill status={status} />
            </div>

            {/* Subtitle */}
            <p className="text-xs text-gray-500 font-normal mt-1">
              {deptDisplay} • Created {createdDateDisplay}
            </p>
          </div>

          {/* Action Buttons Top Right: < Back, Edit Requisition, ··· */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap relative">
            <button
              type="button"
              onClick={() => navigate('/dashboard/requisitions')}
              className="px-3.5 py-2 rounded-xl bg-white/90 hover:bg-white text-xs font-bold text-gray-800 border border-gray-200/80 shadow-3xs flex items-center gap-1.5 cursor-pointer transition-all hover:shadow-2xs"
            >
              <ChevronLeft size={14} />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 size={13} />
              <span>Edit Requisition</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActionMenu(!showActionMenu);
                }}
                className="w-8.5 h-8.5 rounded-xl bg-white/90 hover:bg-white border border-gray-200/80 flex items-center justify-center text-gray-600 hover:text-black shadow-3xs transition-all cursor-pointer"
              >
                <MoreHorizontal size={15} />
              </button>

              {/* Action Dropdown Menu */}
              {showActionMenu && (
                <div
                  className="absolute right-0 mt-1.5 w-48 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] p-1 z-30 animate-in fade-in zoom-in-95 text-left"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/dashboard/requisitions/${id}/candidates`);
                      setShowActionMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-xs text-gray-700 hover:text-black hover:bg-gray-100/80 rounded-xl transition-colors flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <Users size={13} className="text-gray-500" />
                    <span>View Candidates</span>
                  </button>

                  {status !== 'Published' && (
                    <button
                      type="button"
                      onClick={() => {
                        handlePublish();
                        setShowActionMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-xs text-gray-700 hover:text-black hover:bg-gray-100/80 rounded-xl transition-colors flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Sparkles size={13} className="text-gray-500" />
                      <span>Publish Requisition</span>
                    </button>
                  )}

                  <div className="h-px bg-black/[0.04] my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteModal(true);
                      setShowActionMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2 font-semibold cursor-pointer"
                  >
                    <Trash2 size={13} className="text-red-500" />
                    <span>Delete Requisition</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {info && (
        <div className="p-3 bg-emerald-50/90 border border-emerald-200/80 rounded-2xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs animate-in fade-in">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{info}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50/90 border border-red-200/80 rounded-2xl text-xs text-red-700 flex items-center gap-2 shadow-2xs animate-in fade-in">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Left 9 Columns + Right 3 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (9 cols): Requisition Overview + Required Skills + Role Description */}
        <div className="lg:col-span-9 space-y-3.5 pt-1.5 sm:pt-2">
          {/* 1. Requisition Overview Card */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-5 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.04]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-black/[0.04] border border-black/[0.04] flex items-center justify-center text-gray-700 shrink-0">
                  <FileText size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 leading-tight">
                    Requisition Overview
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Key details of this requisition.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-xs font-bold text-gray-800 border border-gray-200/80 shadow-3xs flex items-center gap-1.5 cursor-pointer transition-all hover:shadow-2xs"
              >
                <Edit3 size={12} />
                <span>Edit</span>
              </button>
            </div>

            {/* Metrics Row Grid: Job Title, Department, Experience, Work Mode, Duration, Open Positions, Deadline */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 pt-1">
              <div>
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Job Title
                </div>
                <div className="text-xs sm:text-[13px] font-bold text-gray-900 leading-tight truncate">
                  {titleDisplay}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Department
                </div>
                <div className="text-xs sm:text-[13px] font-bold text-gray-900 leading-tight truncate">
                  {deptDisplay}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Experience
                </div>
                <div className="text-xs sm:text-[13px] font-bold text-gray-900 leading-tight truncate">
                  {editForm.experience || '5–8 years'}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Work Mode
                </div>
                <div className="text-xs sm:text-[13px] font-bold text-gray-900 leading-tight truncate">
                  {editForm.work_mode || 'Hybrid'}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Duration
                </div>
                <div className="text-xs sm:text-[13px] font-bold text-gray-900 leading-tight truncate">
                  {editForm.duration || '6 Months'}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Open Positions
                </div>
                <div className="text-xs sm:text-[13px] font-bold text-gray-900 leading-tight truncate">
                  {editForm.headcount || 1}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Deadline
                </div>
                <div className="text-xs sm:text-[13px] font-bold text-gray-900 leading-tight truncate">
                  {editForm.deadline || '28 Sept 2026, 6:00 pm'}
                </div>
              </div>
            </div>
          </div>


          {/* 2. Required Skills Card */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-5 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-3.5">
            <div className="flex items-center gap-3 pb-3 border-b border-black/[0.04]">
              <div className="w-9 h-9 rounded-xl bg-black/[0.04] border border-black/[0.04] flex items-center justify-center text-gray-700 shrink-0">
                <Layers size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 leading-tight">
                  Required Skills
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Must-have skills for the role.
                </p>
              </div>
            </div>

            {/* Pill Tags Row */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {skillsList.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-4 py-1.5 rounded-full text-xs font-bold text-gray-800 bg-white/90 hover:bg-white border border-gray-200/80 shadow-3xs transition-all"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* 3. Role Description Card */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-5 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-3.5">
            <div className="flex items-center gap-3 pb-3 border-b border-black/[0.04]">
              <div className="w-9 h-9 rounded-xl bg-black/[0.04] border border-black/[0.04] flex items-center justify-center text-gray-700 shrink-0">
                <FileText size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 leading-tight">
                  Role Description
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Brief overview of the opportunity.
                </p>
              </div>
            </div>

            <div className="text-xs sm:text-[13px] text-gray-600 leading-relaxed font-normal pt-1 whitespace-pre-line">
              {editForm.description ||
                'We are looking for a DevSecOps Engineer to build and maintain secure, scalable infrastructure and deployment pipelines. You will work closely with engineering teams to improve release velocity, security, and reliability across our platforms.'}
            </div>
          </div>
        </div>

        {/* Right Column (3 cols): Requisition Status */}
        <div className="lg:col-span-3 flex justify-end pt-1.5 sm:pt-2">
          {/* 1. Requisition Status Timeline Card */}
          <div className="w-full max-w-[280px] ml-auto bg-transparent p-1 sm:p-2 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-black/[0.06]">
              <div className="w-9 h-9 rounded-xl bg-black/[0.04] border border-black/[0.04] flex items-center justify-center text-gray-700 shrink-0">
                <Activity size={17} />
              </div>
              <h2 className="text-base font-bold text-gray-900">Requisition Status</h2>
            </div>

            {/* Vertical Timeline Track */}
            <div className="space-y-5 relative pl-1 pt-1">
              {/* Draft */}
              <div className="flex items-start gap-3.5 relative">
                <div className="w-6 h-6 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-700 shrink-0 mt-0.5 shadow-3xs z-10">
                  <Check size={13} strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 leading-tight">Draft</div>
                  <div className="text-xs text-gray-400 mt-0.5">{createdDateDisplay}</div>
                </div>
                <div className="absolute left-3 top-6 w-[1.5px] h-7 bg-gray-200" />
              </div>

              {/* AI Intake */}
              <div className="flex items-start gap-3.5 relative">
                <div className="w-6 h-6 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-700 shrink-0 mt-0.5 shadow-3xs z-10">
                  <Check size={13} strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 leading-tight">AI Intake</div>
                  <div className="text-xs text-gray-400 mt-0.5">25 Sept 2026, 7:02 am</div>
                </div>
                <div className="absolute left-3 top-6 w-[1.5px] h-7 bg-gray-200" />
              </div>

              {/* Structuring */}
              <div className="flex items-start gap-3.5 relative">
                <div className="w-6 h-6 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-700 shrink-0 mt-0.5 shadow-3xs z-10">
                  <Check size={13} strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 leading-tight">Structuring</div>
                  <div className="text-xs text-gray-400 mt-0.5">25 Sept 2026, 9:14 am</div>
                </div>
                <div className="absolute left-3 top-6 w-[1.5px] h-7 bg-gray-200" />
              </div>

              {/* Approval */}
              <div className="flex items-start gap-3.5 relative">
                <div className="w-6 h-6 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-700 shrink-0 mt-0.5 shadow-3xs z-10">
                  <Check size={13} strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 leading-tight">Approval</div>
                  <div className="text-xs text-gray-400 mt-0.5">26 Sept 2026, 11:21 am</div>
                </div>
                <div className="absolute left-3 top-6 w-[1.5px] h-7 bg-gray-200" />
              </div>

              {/* Published */}
              <div className="flex items-start gap-3.5 relative">
                <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs z-10">
                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 leading-tight">Published</div>
                  <div className="text-xs text-gray-400 mt-0.5">26 Sept 2026, 3:45 pm</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Edit Requisition Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="relative w-full max-w-2xl bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.9)] border border-white/90 p-6 sm:p-7 text-left space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.04]">
              <div>
                <h3 className="text-base font-bold text-gray-900">Edit Requisition</h3>
                <p className="text-xs text-gray-400 mt-0.5">Modify role details, requirements and criteria.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Job Title</label>
                  <input
                    type="text"
                    required
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    required
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Experience</label>
                  <input
                    type="text"
                    value={editForm.experience}
                    onChange={(e) => setEditForm({ ...editForm, experience: e.target.value })}
                    placeholder="e.g. 5–8 years"
                    className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Work Mode</label>
                  <input
                    type="text"
                    value={editForm.work_mode}
                    onChange={(e) => setEditForm({ ...editForm, work_mode: e.target.value })}
                    placeholder="e.g. Hybrid, Remote, Onsite"
                    className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Duration</label>
                  <input
                    type="text"
                    value={editForm.duration}
                    onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                    placeholder="e.g. 6 Months"
                    className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Open Positions</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.headcount}
                    onChange={(e) => setEditForm({ ...editForm, headcount: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Submission Deadline</label>
                  <input
                    type="text"
                    value={editForm.deadline}
                    onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                    placeholder="e.g. 28 Sept 2026, 6:00 pm"
                    className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Required Skills (Comma separated)
                </label>
                <input
                  type="text"
                  value={editForm.skills}
                  onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                  placeholder="Kubernetes, Terraform, AWS, CI/CD, Docker, Vault"
                  className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Role Description</label>
                <textarea
                  rows="4"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Brief overview of the role..."
                  className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-black leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/[0.04]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy === 'saving'}
                  className="px-5 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {busy === 'saving' && <Loader2 size={13} className="animate-spin text-white" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="relative w-full max-w-[440px] bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/90 p-6 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900">Delete Requisition?</h3>
            <p className="text-xs text-gray-500 mt-1 mb-5">
              This will permanently delete <strong>{titleDisplay}</strong>. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy === 'deleting'}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {busy === 'deleting' && <Loader2 size={13} className="animate-spin text-white" />}
                <span>Delete Requisition</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


