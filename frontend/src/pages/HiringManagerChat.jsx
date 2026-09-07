import { useState, useRef, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { request } from '../api/client';
import { marked } from 'marked';
import {
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Check,
  Building2,
  Users,
  Activity,
  ShieldCheck,
  Search,
  Menu,
  ChevronDown,
  Code2,
  FolderKanban,
  Box,
  Wrench,
  ArrowUp,
  LogOut,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Grid,
  List,
  X,
  CheckCircle2,
  UserCheck,
  RefreshCw,
  Edit3,
  Zap,
  Briefcase,
  Calendar,
  AlertTriangle,
  FileText,
  Clock,
  ArrowRight,
  TrendingUp
} from 'lucide-react';

const ACTION_PILLS = [
  { label: 'Draft Requisition', icon: Plus, prompt: 'Draft a new job requisition for Senior Full Stack Engineer.' },
  { label: 'Review Shortlist', icon: Users, prompt: 'Show me shortlisted candidates for my open requisitions.' },
  { label: 'Schedule Interview', icon: Calendar, prompt: 'Schedule an interview proposal for candidate Alex Johnson.' },
  { label: 'Check Onboarding', icon: AlertTriangle, prompt: 'Are there any open onboarding issues or pending candidate setups?' },
  { label: 'Pipeline Health', icon: Activity, prompt: 'Provide a health summary of my active hiring metrics.' },
];

/* ── 1. Interactive Requisition Console Widget ──────────────────────────────── */
function RequisitionConsoleWidget({ requisitions, onSendMessage, onNavigate }) {
  const [filterTab, setFilterTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = requisitions.filter((r) => {
    const s = (r.status || '').toLowerCase();
    const matchesTab =
      filterTab === 'all'
        ? true
        : filterTab === 'published'
        ? s === 'published' || s === 'open' || s === 'active'
        : s === 'draft' || s === 'drafted' || s === 'pending_approval';
    const matchesSearch =
      searchQuery === ''
        ? true
        : r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.department?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 text-left font-sans space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shadow-md shrink-0">
            <Briefcase size={16} />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-gray-950 tracking-tight">
              My Job Requisitions Directory
            </h4>
            <p className="text-[11px] text-gray-500 font-medium">
              {requisitions.length} Total Department Requisitions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-gray-100/90 p-0.5 text-xs font-bold text-gray-700 shrink-0">
            {['all', 'published', 'draft'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterTab(tab)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer text-[11px] capitalize ${
                  filterTab === tab ? 'bg-white text-gray-950 shadow-xs font-extrabold' : 'text-gray-500 hover:text-black'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search requisitions by title or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-gray-50/80 border border-gray-200/90 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-black transition-all"
          />
        </div>

        <button
          type="button"
          onClick={() => onSendMessage('Draft a new job requisition for Senior Full Stack Engineer')}
          className="px-3.5 py-2 rounded-2xl bg-black hover:bg-gray-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
        >
          <Plus size={14} />
          <span>+ Draft Requisition</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {filtered.map((r) => {
          const isPublished = (r.status || '').toLowerCase() === 'published' || (r.status || '').toLowerCase() === 'open';
          return (
            <div
              key={r.id}
              className="p-4 rounded-2xl bg-white border border-gray-200/90 hover:border-black hover:shadow-md transition-all flex flex-col justify-between group space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[9.5px] font-black uppercase tracking-wider ${
                      isPublished
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {r.status || 'Draft'}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">{r.department}</span>
                </div>

                <h3 className="text-sm font-extrabold text-gray-950 tracking-tight">
                  {r.title}
                </h3>
                <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                  {r.location} • {r.salary_range}
                </p>
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                <span className="text-[10px] text-gray-400 font-medium">
                  ID: {r.id.slice(0, 8)}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/dashboard/requisitions/${r.id}`)}
                    className="px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Inspect
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendMessage(`Show shortlisted candidates for requisition ${r.title}`)}
                    className="px-2.5 py-1 rounded-xl bg-black hover:bg-gray-800 text-white text-[11px] font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    Candidates
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 2. Interactive Requisition Draft Form Preview Widget ────────────────────── */
function RequisitionDraftPreviewWidget({ draft, onSendMessage }) {
  const [formData, setFormData] = useState({
    title: draft.title || '',
    department: draft.department || 'Engineering & Product',
    location: draft.location || 'Bangalore / Hybrid Remote',
    employment_type: draft.employment_type || 'Full-Time',
    experience_level: draft.experience_level || 'Senior (4-7 years)',
    salary_range: draft.salary_range || '$120,000 - $150,000 / year',
    skills: draft.skills || 'React, Node.js, Python, PostgreSQL, AWS',
    job_description: draft.job_description || `We are seeking a high-caliber ${draft.title || 'Engineer'} to lead software delivery and scaling.`
  });

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const isReady = formData.title.trim() !== '';

  const handleConfirmExecute = () => {
    if (!isReady) return;
    const actionText = `CONFIRM_EXECUTE_REQUISITION: title="${formData.title}", department="${formData.department}", location="${formData.location}", employment_type="${formData.employment_type}", experience_level="${formData.experience_level}", salary_range="${formData.salary_range}", skills="${formData.skills}", job_description="${formData.job_description}"`;
    onSendMessage(actionText);
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 text-left font-sans">
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-gray-200/90 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-gray-950 tracking-tight">
                Job Requisition Draft Preview
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                Ready for Publication
              </span>
            </div>
            <p className="text-[11.5px] text-gray-500 mt-0.5">
              Review and confirm job requirements before publishing to vendors & candidate portal.
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-[10.5px] font-black text-gray-700 uppercase tracking-wider mb-1">
              Job Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-black font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-black text-gray-700 uppercase tracking-wider mb-1">
                Department
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-black"
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-black text-gray-700 uppercase tracking-wider mb-1">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-black text-gray-700 uppercase tracking-wider mb-1">
                Target Salary Budget
              </label>
              <input
                type="text"
                value={formData.salary_range}
                onChange={(e) => handleChange('salary_range', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-black"
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-black text-gray-700 uppercase tracking-wider mb-1">
                Required Tech Stack / Skills
              </label>
              <input
                type="text"
                value={formData.skills}
                onChange={(e) => handleChange('skills', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-black text-gray-700 uppercase tracking-wider mb-1">
              Job Description Preview
            </label>
            <textarea
              rows={3}
              value={formData.job_description}
              onChange={(e) => handleChange('job_description', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-black resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => onSendMessage('Cancel requisition draft')}
            className="px-4 py-2 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-all cursor-pointer"
          >
            Cancel Draft
          </button>

          <button
            type="button"
            disabled={!isReady}
            onClick={handleConfirmExecute}
            className="px-5 py-2 rounded-2xl bg-black hover:bg-gray-800 disabled:bg-gray-200 text-white text-xs font-black transition-all shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 size={15} />
            <span>Confirm & Publish Requisition</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 3. Interactive Candidate Shortlist Widget ──────────────────────────────── */
function CandidateShortlistWidget({ candidates, onSendMessage }) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-100 text-left font-sans space-y-3">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shadow-md shrink-0">
            <Users size={16} />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-gray-950 tracking-tight">
              Shortlisted Candidate Profiles
            </h4>
            <p className="text-[11px] text-gray-500 font-medium">
              {candidates.length} AI-screened candidates matching your requisitions
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {candidates.map((c) => (
          <div
            key={c.id}
            className="p-4 rounded-2xl bg-white border border-gray-200/90 hover:border-black hover:shadow-md transition-all flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-lg text-[9.5px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                  {c.match_score || '94% Match'}
                </span>
                <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-gray-100 text-gray-700">
                  {c.status}
                </span>
              </div>

              <h4 className="text-sm font-extrabold text-gray-950 tracking-tight">{c.name}</h4>
              <p className="text-[11px] text-gray-500 font-medium">{c.email}</p>
              <p className="text-[10.5px] text-gray-400 font-mono mt-1 truncate">Role: {c.requisition_title}</p>
              {c.notes && <p className="text-[11px] text-gray-700 font-normal mt-1.5 italic bg-gray-50 p-2 rounded-xl border border-gray-100">{c.notes}</p>}
            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onSendMessage(`Schedule an interview proposal for candidate ${c.name}`)}
                className="px-3 py-1.5 rounded-xl bg-black hover:bg-gray-800 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Calendar size={13} />
                <span>Schedule Interview</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 4. Interactive Interview Proposal Widget ───────────────────────────────── */
function InterviewProposalWidget({ proposal, onSendMessage }) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-100 text-left font-sans">
      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-50 via-white to-white border border-gray-200/90 shadow-lg space-y-4">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
          <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-md shrink-0">
            <Calendar size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-extrabold text-gray-950 tracking-tight">
                Candidate Interview Proposal
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase bg-indigo-50 text-indigo-800 border border-indigo-200">
                {proposal.interview_type}
              </span>
            </div>
            <p className="text-[11.5px] text-gray-500 font-medium">
              Review details and confirm proposal to notify candidate & interview panel.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-200/90 space-y-2 text-xs font-sans shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 font-bold">Candidate:</span>
            <span className="font-extrabold text-gray-950">{proposal.candidate}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 font-bold">Requisition:</span>
            <span className="font-bold text-gray-800">{proposal.requisition_title}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 font-bold">Date & Slot:</span>
            <span className="font-mono font-bold text-emerald-800">{proposal.proposed_date} at {proposal.proposed_time}</span>
          </div>
          {proposal.meeting_notes && (
            <div className="pt-2 border-t border-gray-100">
              <span className="text-gray-500 font-bold block mb-1">Notes:</span>
              <p className="text-gray-700 bg-gray-50 p-2.5 rounded-xl border border-gray-100">{proposal.meeting_notes}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => onSendMessage('List shortlisted candidates')}
            className="px-3.5 py-2 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSendMessage(`Confirm interview proposal for ${proposal.candidate} on ${proposal.proposed_date}`)}
            className="px-4 py-2 rounded-2xl bg-black hover:bg-gray-800 text-white text-xs font-black transition-all shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 size={15} />
            <span>Confirm Proposal</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 5. Interactive Onboarding Issues Widget ────────────────────────────────── */
function OnboardingIssuesWidget({ issues, onSendMessage }) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-100 text-left font-sans space-y-3">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shrink-0">
            <AlertTriangle size={16} />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-gray-950 tracking-tight">
              Onboarding Candidate Issues
            </h4>
            <p className="text-[11px] text-gray-500 font-medium">
              {issues.length} active reported candidate setup issues
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {issues.map((i) => (
          <div
            key={i.id}
            className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/90 shadow-2xs space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-0.5 rounded-lg text-[9.5px] font-black uppercase bg-rose-100 text-rose-800">
                {i.severity} Severity
              </span>
              <span className="text-[10px] text-gray-400 font-mono">{i.reported_date}</span>
            </div>

            <h4 className="text-xs font-extrabold text-gray-950">{i.issue_title}</h4>
            <p className="text-[11px] text-gray-700 font-medium">
              Candidate: <strong>{i.candidate_name}</strong> ({i.email})
            </p>
            <p className="text-[11px] text-rose-900 bg-white p-2.5 rounded-xl border border-rose-200/80 font-semibold">
              Action Required: {i.action_required}
            </p>

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={() => onSendMessage(`Rectify onboarding issue for candidate ${i.candidate_name}`)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer"
              >
                Rectify Issue
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HiringManagerChat({ onOpenNavMenu: propsOnOpenNavMenu }) {
  const { token, user, logout } = useAuth();
  const outletContext = useOutletContext();
  const navigate = useNavigate();
  const onOpenNavMenu = propsOnOpenNavMenu || outletContext?.onOpenNavMenu;

  const [threads, setThreads] = useState([
    {
      id: 'thread-1',
      title: 'Hiring Assistant Session',
      createdAt: 'Just now',
      messages: [],
    },
  ]);
  const [activeThreadId, setActiveThreadId] = useState('thread-1');
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];
  const userName = user?.name || 'Hiring Manager';
  const companyName = user?.tenant_name || 'Client Workspace';
  const firstName = userName.split(' ')[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages, isGenerating]);

  const handleNewThread = () => {
    const newId = `thread-${Date.now()}`;
    const newThread = {
      id: newId,
      title: 'New Hiring Session',
      createdAt: 'Just now',
      messages: [],
    };
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newId);
  };

  const sendMessage = async (textToSend) => {
    const query = textToSend || input.trim();
    if (!query || isGenerating) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === activeThreadId) {
          const isFirstUserMsg = t.messages.length === 0;
          return {
            ...t,
            title: isFirstUserMsg ? (query.length > 26 ? `${query.slice(0, 26)}...` : query) : t.title,
            messages: [...t.messages, userMsg],
          };
        }
        return t;
      })
    );

    if (!textToSend) setInput('');
    setIsGenerating(true);

    const chatHistory = activeThread?.messages ? activeThread.messages.map((m) => ({ sender: m.sender, text: m.text })) : [];

    try {
      let replyText = '';
      let executedActions = [];
      try {
        const res = await request('/api/hiring-manager/agent/chat', {
          method: 'POST',
          token,
          body: {
            prompt: query,
            history: chatHistory,
            user_role: 'Hiring Manager',
            user_name: userName,
          },
        });
        replyText = res.reply;
        executedActions = res.executed_actions || [];
      } catch (err) {
        replyText = `I am your Hiring Manager AI Assistant. How can I help you draft job requisitions, review candidate shortlists, or schedule candidate interviews today?`;
      }

      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: replyText,
        executedActions: executedActions,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setThreads((prev) =>
        prev.map((t) => {
          if (t.id === activeThreadId) {
            return {
              ...t,
              messages: [...t.messages, aiMsg],
            };
          }
          return t;
        })
      );
    } catch (err) {
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id === activeThreadId) {
            return {
              ...t,
              messages: [
                ...t.messages,
                {
                  id: `err-${Date.now()}`,
                  sender: 'ai',
                  text: `⚠️ System Notice: ${err.message || 'Unable to complete request.'}`,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ],
            };
          }
          return t;
        })
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasMessages = activeThread?.messages && activeThread.messages.length > 0;

  const renderFormattedMessageText = (text, hasGraphicWidget) => {
    if (!text) return '';
    let processedText = text;
    if (hasGraphicWidget) {
      const firstLine = text.split(/\n\n|\n1\.|\n•|\n-/)[0];
      processedText = firstLine.trim();
    }
    return marked.parse(processedText);
  };

  return (
    <div
      className="fixed inset-0 w-screen h-screen bg-[#fafafa] text-gray-900 flex overflow-hidden z-30 font-sans"
      style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif" }}
    >
      {/* Sleek Off-White Sidebar */}
      <div
        className={`${
          isSidebarOpen ? 'w-64 min-w-[256px]' : 'w-0 min-w-0 overflow-hidden'
        } bg-[#f7f7f5] border-r border-gray-200/80 flex flex-col justify-between transition-all duration-200 shrink-0 relative z-20 shadow-[1px_0_10px_rgba(0,0,0,0.02)]`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Header */}
          <div className="p-4 flex items-center justify-between gap-2 border-b border-gray-200/60">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenNavMenu}
                className="p-1.5 rounded-xl hover:bg-gray-200/80 text-gray-700 hover:text-black transition-colors cursor-pointer"
              >
                <Menu size={18} />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-black text-white flex items-center justify-center font-black text-xs shadow-2xs">
                  HM
                </div>
                <span className="font-extrabold text-base text-gray-950 tracking-tight">Hiring AI</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-xl hover:bg-gray-200/80 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <PanelLeftClose size={17} />
            </button>
          </div>

          <div className="px-3 pt-3.5 pb-1">
            <button
              type="button"
              onClick={handleNewThread}
              className="w-full py-2.5 px-3.5 rounded-2xl bg-white hover:bg-gray-100 border border-gray-200/90 text-gray-950 text-xs font-bold flex items-center gap-2.5 shadow-2xs cursor-pointer"
            >
              <Plus size={16} className="text-gray-700" />
              <span>New Hiring Session</span>
            </button>
          </div>

          <div className="px-3 pt-3 pb-1 space-y-0.5 text-xs text-gray-600 font-bold">
            <div onClick={() => navigate('/dashboard/hiring-manager')} className="px-3 py-2 rounded-xl hover:bg-white hover:text-gray-950 cursor-pointer flex items-center gap-2.5 transition-colors">
              <Briefcase size={15} className="text-gray-500" />
              <span>Hiring Dashboard</span>
            </div>
            <div onClick={() => navigate('/dashboard/requisitions')} className="px-3 py-2 rounded-xl hover:bg-white hover:text-gray-950 cursor-pointer flex items-center gap-2.5 transition-colors">
              <Box size={15} className="text-gray-500" />
              <span>Requisitions</span>
            </div>
            <div onClick={() => navigate('/dashboard/candidates')} className="px-3 py-2 rounded-xl hover:bg-white hover:text-gray-950 cursor-pointer flex items-center gap-2.5 transition-colors">
              <Users size={15} className="text-gray-500" />
              <span>Shortlisted Candidates</span>
            </div>
          </div>

          <div className="px-3 pt-4 pb-2 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-3 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">
              <span>Chat Sessions</span>
            </div>

            <div className="space-y-1">
              {threads.map((t) => {
                const isActive = t.id === activeThreadId;
                return (
                  <div
                    key={t.id}
                    onClick={() => setActiveThreadId(t.id)}
                    className={`group px-3 py-2 rounded-xl text-xs cursor-pointer transition-all flex items-center justify-between relative ${
                      isActive
                        ? 'bg-white text-gray-950 font-extrabold shadow-2xs border border-gray-200/90 pl-3.5 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-1 before:bg-black before:rounded-full'
                        : 'text-gray-600 hover:bg-white/80 hover:text-gray-950 font-semibold'
                    }`}
                  >
                    <span className="truncate pr-2">{t.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-gray-200/90 bg-white/70 backdrop-blur-md flex items-center justify-between text-xs text-gray-900">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
              {firstName[0]}
            </div>
            <div className="truncate min-w-0">
              <div className="truncate font-extrabold text-xs leading-tight text-gray-950">{userName}</div>
              <div className="text-[10px] text-gray-500 font-semibold">{companyName}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="p-1.5 text-gray-400 hover:text-gray-950 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full bg-[#fafafa] relative min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <div className="px-4 py-3 flex items-center justify-between gap-4 z-20 shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0">
          <div className="flex items-center gap-2">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-600 hover:text-gray-950 transition-colors cursor-pointer"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}

            <button
              type="button"
              onClick={onOpenNavMenu}
              className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-700 hover:text-black transition-colors cursor-pointer flex items-center gap-2 text-xs font-bold"
            >
              <Menu size={17} />
              <span className="hidden sm:inline text-gray-700">Hiring Menu</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[11px] font-extrabold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Hiring Manager AI Assistant
            </span>
          </div>
        </div>

        {/* Center Section: Initial Greeting OR Active Messages */}
        <div className="flex-1 overflow-y-auto px-4 flex flex-col relative z-10">
          {!hasMessages ? (
            /* Claude 3.5 Style Hero Welcome Screen */
            <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full py-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md animate-pulse">
                  <Sparkles size={22} />
                </div>
                <h1 className="font-serif text-3xl sm:text-4xl text-gray-950 font-normal tracking-tight">
                  Welcome back, {firstName}
                </h1>
              </div>

              <div className="w-full bg-white border border-gray-200/90 focus-within:border-black rounded-3xl p-5 shadow-[0_10px_35px_-10px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between min-h-[160px]">
                <textarea
                  rows={3}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Hiring AI to draft requisitions, review shortlists, or schedule interviews..."
                  className="w-full bg-transparent text-sm sm:text-base text-gray-950 placeholder-gray-400 focus:outline-none resize-none font-sans"
                />

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                    <span className="text-xs font-semibold text-gray-500">{companyName}</span>
                  </div>

                  <button
                    type="button"
                    disabled={!input.trim() || isGenerating}
                    onClick={() => sendMessage()}
                    className="p-2.5 rounded-2xl bg-gradient-to-r from-gray-950 to-black hover:from-black hover:to-gray-900 disabled:bg-gray-200 disabled:text-gray-400 text-white transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <ArrowUp size={17} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 flex-wrap mt-6">
                {ACTION_PILLS.map((p) => {
                  const IconComp = p.icon;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => sendMessage(p.prompt)}
                      className="px-4 py-2 rounded-full bg-white/90 border border-gray-200/90 hover:border-gray-400 text-xs text-gray-800 hover:text-gray-950 font-bold flex items-center gap-2 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md hover:-translate-y-0.5"
                    >
                      <IconComp size={14} className="text-gray-500" />
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Active Message Stream */
            <div className="flex-1 flex flex-col justify-between max-w-2xl mx-auto w-full py-4">
              <div className="space-y-6 pb-48 sm:pb-56">
                {activeThread?.messages.map((msg) => {
                  const isUser = msg.sender === 'user';

                  const hasReqWidget = !isUser && msg.executedActions?.some((a) => a.tool === 'list_hiring_requisitions');
                  const reqAction = msg.executedActions?.find((a) => a.tool === 'list_hiring_requisitions');
                  const reqsData = Array.isArray(reqAction?.result) ? reqAction.result : [];

                  const hasDraftWidget = !isUser && msg.executedActions?.some((a) => a.tool === 'draft_hiring_requisition');
                  const draftAction = msg.executedActions?.find((a) => a.tool === 'draft_hiring_requisition');
                  const draftData = draftAction?.result || {};

                  const hasCandWidget = !isUser && msg.executedActions?.some((a) => a.tool === 'list_shortlisted_candidates');
                  const candAction = msg.executedActions?.find((a) => a.tool === 'list_shortlisted_candidates');
                  const candData = Array.isArray(candAction?.result) ? candAction.result : [];

                  const hasInterviewWidget = !isUser && msg.executedActions?.some((a) => a.tool === 'schedule_candidate_interview');
                  const interviewAction = msg.executedActions?.find((a) => a.tool === 'schedule_candidate_interview');
                  const interviewData = interviewAction?.result || {};

                  const hasIssueWidget = !isUser && msg.executedActions?.some((a) => a.tool === 'list_onboarding_issues');
                  const issueAction = msg.executedActions?.find((a) => a.tool === 'list_onboarding_issues');
                  const issueData = Array.isArray(issueAction?.result) ? issueAction.result : [];

                  const hasGraphicWidget = hasReqWidget || hasDraftWidget || hasCandWidget || hasInterviewWidget || hasIssueWidget;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-1 flex items-center gap-1.5">
                        {isUser ? (
                          <span>{userName}</span>
                        ) : (
                          <>
                            <Sparkles size={11} className="text-emerald-600" />
                            <span>Hiring AI</span>
                          </>
                        )}
                      </div>

                      <div
                        className={`p-4 sm:p-5 rounded-3xl text-xs sm:text-sm leading-relaxed ${
                          isUser
                            ? 'bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white rounded-tr-md max-w-[85%] sm:max-w-[78%] font-medium shadow-md border border-gray-800/80'
                            : 'bg-white border border-gray-200/90 text-gray-950 rounded-tl-md w-full shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]'
                        }`}
                      >
                        {isUser ? (
                          <div className="whitespace-pre-wrap font-sans text-white text-xs sm:text-sm font-medium">
                            {msg.text}
                          </div>
                        ) : (
                          <div
                            className="prose prose-sm max-w-none text-gray-950 font-sans"
                            dangerouslySetInnerHTML={{
                              __html: renderFormattedMessageText(msg.text, hasGraphicWidget),
                            }}
                          />
                        )}

                        {hasReqWidget && (
                          <RequisitionConsoleWidget
                            requisitions={reqsData}
                            onSendMessage={(txt) => sendMessage(txt)}
                            onNavigate={(path) => navigate(path)}
                          />
                        )}

                        {hasDraftWidget && (
                          <RequisitionDraftPreviewWidget
                            draft={draftData}
                            onSendMessage={(txt) => sendMessage(txt)}
                          />
                        )}

                        {hasCandWidget && (
                          <CandidateShortlistWidget
                            candidates={candData}
                            onSendMessage={(txt) => sendMessage(txt)}
                          />
                        )}

                        {hasInterviewWidget && (
                          <InterviewProposalWidget
                            proposal={interviewData}
                            onSendMessage={(txt) => sendMessage(txt)}
                          />
                        )}

                        {hasIssueWidget && (
                          <OnboardingIssuesWidget
                            issues={issueData}
                            onSendMessage={(txt) => sendMessage(txt)}
                          />
                        )}

                        {!isUser && msg.executedActions && msg.executedActions.length > 0 && (
                          <div className="mt-3.5 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">EXECUTED ACTIONS:</span>
                            {Array.from(new Set(msg.executedActions.map((a) => a.tool))).map((toolName, idx) => (
                              <span key={idx} className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[10.5px] font-black flex items-center gap-1">
                                <Zap size={11} className="text-emerald-600" />
                                <span>{toolName}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isGenerating && (
                  <div className="flex flex-col items-start space-y-1.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-1 flex items-center gap-1.5">
                      <Sparkles size={11} className="text-emerald-600 animate-spin" />
                      <span>Hiring AI</span>
                    </div>
                    <div className="p-4 rounded-3xl bg-white border border-gray-200/90 rounded-tl-md text-xs text-gray-600 font-semibold flex items-center gap-2.5 shadow-sm">
                      <span>Analyzing candidate records & requisitions</span>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-black animate-bounce"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-black animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-black animate-bounce [animation-delay:0.4s]"></div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Floating Bottom Input Bar */}
              <div className="sticky bottom-4 left-0 right-0 w-full max-w-2xl mx-auto bg-white/95 backdrop-blur-xl border border-gray-200/90 focus-within:border-black rounded-3xl p-3.5 sm:p-4 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.12)] transition-all">
                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Reply to Hiring AI..."
                  className="w-full bg-transparent text-xs sm:text-sm text-gray-950 placeholder-gray-400 focus:outline-none resize-none font-sans"
                />

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="p-1.5 rounded-xl text-gray-400 hover:text-gray-900 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                    <span className="text-[10.5px] text-gray-400 font-semibold">Press Enter to send</span>
                  </div>

                  <button
                    type="button"
                    disabled={!input.trim() || isGenerating}
                    onClick={() => sendMessage()}
                    className="p-2 rounded-xl bg-gradient-to-r from-gray-950 to-black hover:from-black hover:to-gray-900 disabled:bg-gray-200 disabled:text-gray-400 text-white transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <ArrowUp size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
