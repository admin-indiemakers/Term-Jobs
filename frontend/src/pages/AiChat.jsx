import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { request, API_BASE_URL } from '../api/client';
import { marked } from 'marked';
import { useMicVAD, utils } from '@ricky0123/vad-react';
import { motion, AnimatePresence } from 'motion/react';

import {
  Sparkles,
  Plus,
  History,
  RefreshCw,
  X,
  Send,
  Paperclip,
  GitBranch,
  Tag,
  Edit3,
  Layers,
  Filter,
  CheckCircle2,
  FileText,
  Share2,
  Download,
  Building2,
  Users,
  Activity,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Award,
  Clock,
  Zap,
  Calendar,
  Search,
  Settings,
  Bell,
  Trash2,
  Copy,
  Check,
  UserCheck,
  ShieldAlert,
  Briefcase,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Maximize2,
  Eye,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Radio,
  SlidersHorizontal,
  ChevronDown,
  AudioLines,
  Shield
} from 'lucide-react';

/* ── REQUISITIONS MOCK DATA FOR RIGHT SIDEBAR OVERVIEW ─────────────────────── */
const REQUISITIONS_DATA = [
  {
    id: 'req-1',
    title: 'Senior Cloud Architect',
    dept: 'Cloud Ops',
    stage: 'Stage: Offer',
    stageStyle: 'bg-[#FCFEED] text-gray-900 border border-[#D8F929]',
    hrLead: 'Marcus V.',
    candidatesCount: '12 Candidates In-Process'
  },
  {
    id: 'req-2',
    title: 'Lead UX Designer',
    dept: 'Product',
    stage: 'Stage: Interview',
    stageStyle: 'bg-gray-100 text-gray-800 border border-gray-200',
    hrLead: 'Elena R.',
    candidatesCount: '28 Candidates Screened'
  },
  {
    id: 'req-3',
    title: 'Staff Security Engineer',
    dept: 'Infra & Sec',
    stage: 'Stage: Screening',
    stageStyle: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    hrLead: 'David K.',
    candidatesCount: '19 Candidates In-Process'
  }
];



const SARVAM_SPEAKERS = [
  { id: 'priya', label: 'Priya (Female)' },
  { id: 'simran', label: 'Simran (Female)' },
  { id: 'rahul', label: 'Rahul (Male)' },
  { id: 'aditya', label: 'Aditya (Male)' }
];

/* Clean text helper: strip raw ASCII tables, transform debug logs into friendly copilot responses */
const cleanReplyText = (text) => {
  if (!text) return '';
  let str = String(text);
  if (str.includes('|---|') || str.includes('| --- |') || str.includes('| Tenant ID |')) {
    const lines = str.split('\n');
    const nonTableLines = lines.filter((line) => !line.trim().startsWith('|'));
    const summaryText = nonTableLines.join(' ').trim();
    if (summaryText.length > 10) {
      str = summaryText;
    } else {
      str = "Yeah, I've retrieved the platform records for you and displayed the full breakdown on the right analytics panel.";
    }
  }

  // Transform cold DB query logs into friendly & formal natural copilot responses
  str = str.replace(/Super Admin King DB Query:\s*Retrieved \*\*(\d+)\s+total job requisition\(s\)\*\*[^\.]*\.?/gi, (match, count) => {
    const isOne = count === '1';
    return `Yeah, I've pulled up the live hiring pipeline for you. There ${isOne ? 'is currently **1 active job requisition**' : `are currently **${count} active job requisitions**`} registered across the platform, and I've loaded the full details into your analytics display.`;
  });

  str = str.replace(/Super Admin King DB Query:\s*Retrieved \*\*(\d+)\s+job requisition\(s\)\*\*\s*(?:created by\/assigned under vendor consultancy partner)?\s*([^\.]*)\.?/gi, (match, count, vname) => {
    const isOne = count === '1';
    return `Yeah, I've retrieved the hiring pipeline for ${vname || 'this partner'}. There ${isOne ? 'is **1 job requisition**' : `are **${count} job requisitions**`} active, and I've updated your analytics display with the breakdown.`;
  });

  str = str.replace(/Super Admin King DB Query:\s*Found \*\*(\d+)\s+total candidate submission\(s\)\*\*[^\.]*\.?/gi, (match, count) => {
    return `Yeah, I've gathered the candidate pipeline records for you. Found **${count} candidate submission(s)** across the platform, and I've updated the analytics panel with the complete roster.`;
  });

  str = str.replace(/Super Admin King DB Query:\s*Found \*\*(\d+)\s+candidate submission\(s\)\*\*\s*listed under vendor consultancy\s*([^\.]*)\.?/gi, (match, count, vname) => {
    return `Yeah, I've retrieved the candidate submissions under ${vname || 'this vendor'}. Found **${count} candidate submission(s)**, and the profiles are now displayed on your analytics panel.`;
  });

  // Strip generic technical DB prefixes if any remain
  str = str.replace(/^Super Admin King DB Query:\s*/gi, "Yeah, I've checked the platform database: ");
  str = str.replace(/^DB Query:\s*/gi, "");

  return str;
};

/* Clean text specifically for spoken TTS output (removes Markdown, URLs, emojis & formatting) */
const cleanForTTS = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // remove markdown links
    .replace(/[*_`#|~]/g, '') // remove markdown symbols
    .replace(/https?:\/\/\S+/g, '') // remove URLs
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
};

/* Smart Echo Filter Helper: detects if transcribed text is a fragment/echo of the AI's recent speech or chat history */
const isSpeakerEcho = (transcript, lastAiSpeech, messages = []) => {
  if (!transcript) return true;
  const tr = transcript.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  if (tr.length < 2) return true;

  // Always allow quick interruption commands
  const interruptCmds = ['stop', 'quiet', 'wait', 'cancel', 'pause', 'halt', 'enough', 'shut up', 'hello', 'hi', 'tenants', 'accounts', 'metrics'];
  if (interruptCmds.includes(tr)) return false;

  // 1. Check against AI's last TTS speech output
  if (lastAiSpeech) {
    const ai = lastAiSpeech.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    if (ai) {
      if (ai === tr || ai.includes(tr) || tr.includes(ai)) return true;
      const trWords = tr.split(/\s+/);
      const aiWords = new Set(ai.split(/\s+/));
      const matchCount = trWords.filter((w) => aiWords.has(w)).length;
      if (trWords.length >= 2 && matchCount / trWords.length >= 0.5) {
        return true;
      }
    }
  }

  // 2. Check against recent chat messages to block duplicate echo triggers
  if (Array.isArray(messages) && messages.length > 0) {
    const recentMsgs = messages.slice(-4);
    for (const m of recentMsgs) {
      const content = (m.heading || m.content || m.points?.[0]?.text || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      if (content) {
        if (content === tr || content.includes(tr) || tr.includes(content)) return true;
        const cWords = new Set(content.split(/\s+/));
        const trWords = tr.split(/\s+/);
        const matchCount = trWords.filter((w) => cWords.has(w)).length;
        if (trWords.length >= 2 && matchCount / trWords.length >= 0.5) {
          return true;
        }
      }
    }
  }

  return false;
};

/* Helper to detect incomplete dangling speech fragments (e.g. "under", "can you", "the terms of") cut off by premature VAD */
const isDanglingFragment = (transcript) => {
  if (!transcript) return true;
  const tr = transcript.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  if (!tr) return true;

  const validSingleWords = [
    'tenants', 'accounts', 'metrics', 'buyers', 'vendors', 'stop', 'quiet',
    'status', 'help', 'requisitions', 'users', 'sync', 'delete', 'onboard',
    'hello', 'hi', 'yes', 'no', 'cancel'
  ];

  const words = tr.split(/\s+/);
  if (words.length === 1) {
    if (!validSingleWords.includes(words[0])) {
      return true;
    }
  }

  const danglingPhrases = [
    'can you', 'could you', 'the terms of', 'what about', 'how about',
    'i want to', 'tell me', 'is there', 'are there', 'what is', 'where is',
    'so i', 'and then'
  ];
  if (danglingPhrases.includes(tr)) {
    return true;
  }

  return false;
};

/* ── 1. Interactive Tenant Directory Console Widget ────────────────────────── */
function TenantConsoleWidget({ tenants = [], onSendMessage, onCopy }) {
  const [filterTab, setFilterTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTenants = tenants.filter((t) => {
    const matchesTab = filterTab === 'all' ? true : t.tenant_type === filterTab;
    const matchesSearch =
      searchQuery === ''
        ? true
        : t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.id && t.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.admin_name && t.admin_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.admin_email && t.admin_email.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const clientCount = tenants.filter((t) => t.tenant_type === 'client').length;
  const consultancyCount = tenants.filter((t) => t.tenant_type === 'consultancy').length;

  let widgetTitle = 'Platform Tenant Directory';
  let widgetSubtitle = 'Active buyer companies & vendor consultancies';
  if (clientCount > 0 && consultancyCount === 0) {
    widgetTitle = 'Buyer Client Companies';
    widgetSubtitle = 'Onboarded enterprise client organizations';
  } else if (clientCount === 0 && consultancyCount > 0) {
    widgetTitle = 'Vendor Consultancies';
    widgetSubtitle = 'Onboarded staffing & recruitment partner consultancies';
  }

  const isConsultancyOnly = clientCount === 0 && consultancyCount > 0;

  return (
    <div className="w-full text-left font-sans space-y-3.5 animate-in fade-in duration-200">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.05]">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-2xs shrink-0 ${isConsultancyOnly
              ? 'bg-amber-500/10 text-amber-600 border-amber-300/40'
              : 'bg-cyan-500/10 text-cyan-600 border-cyan-300/40'
            }`}>
            {isConsultancyOnly ? <Layers size={19} /> : <Building2 size={19} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-gray-950 tracking-tight leading-tight">
                {widgetTitle}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-black tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                {tenants.length} {tenants.length === 1 ? 'Total' : 'Total'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">{widgetSubtitle}</p>
          </div>
        </div>

        {/* Filter Tabs (Only shown when mixed types exist) */}
        {clientCount > 0 && consultancyCount > 0 && (
          <div className="flex items-center rounded-2xl bg-white/80 backdrop-blur-md border border-white/90 p-1 text-xs font-bold text-gray-700 shadow-2xs shrink-0 gap-0.5">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer text-[11px] ${filterTab === 'all' ? 'bg-gray-950 text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-gray-950'
                }`}
            >
              All ({tenants.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('client')}
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer text-[11px] ${filterTab === 'client' ? 'bg-indigo-600 text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-indigo-800'
                }`}
            >
              Buyers ({clientCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('consultancy')}
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer text-[11px] ${filterTab === 'consultancy' ? 'bg-amber-600 text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-amber-800'
                }`}
            >
              Vendors ({consultancyCount})
            </button>
          </div>
        )}
      </div>

      {/* Search & Actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search organizations or admins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 bg-white/80 backdrop-blur-xl border border-white/95 rounded-2xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-black/30 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-gray-400 hover:text-black">
              <X size={13} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSendMessage(isConsultancyOnly ? 'I want to onboard a new vendor consultancy' : 'I want to onboard a new buyer company')}
          className="px-4 py-2.5 rounded-2xl bg-gray-950 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer hover:scale-102 active:scale-95"
        >
          <Plus size={14} />
          <span>{isConsultancyOnly ? 'Onboard Vendor' : 'Onboard Tenant'}</span>
        </button>
      </div>

      {/* Cards List */}
      <div className="grid grid-cols-1 gap-3 max-h-[460px] overflow-y-auto pr-1">
        {filteredTenants.length > 0 ? (
          filteredTenants.map((t) => {
            const isClient = t.tenant_type === 'client';
            const users = t.assigned_users || [];
            const primaryContactName = t.admin_name || (typeof users[0] === 'string' ? users[0] : users[0]?.name) || (isClient ? 'Arjun M' : 'hasil');
            const primaryContactEmail = t.admin_email || (typeof users[0] === 'object' ? users[0]?.email : (isClient ? 'arjunmcseawh@gmail.com' : 'hashil@gmail.com'));

            return (
              <div
                key={t.id}
                className="p-4 sm:p-5 rounded-2xl bg-white/85 backdrop-blur-xl border border-white/95 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group relative overflow-hidden"
              >
                <div>
                  {/* Top Bar inside Card */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-black/[0.04]">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isClient
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                          : 'bg-amber-50 text-amber-700 border border-amber-200/80'
                        }`}
                    >
                      {isClient ? <Building2 size={10} /> : <Layers size={10} />}
                      {isClient ? 'Buyer Company' : 'Vendor Consultancy'}
                    </span>

                    <button
                      type="button"
                      onClick={() => onCopy(t.id, t.id)}
                      className="font-mono text-[10px] font-semibold text-gray-500 hover:text-black bg-white/80 hover:bg-white border border-white/90 px-2.5 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      title="Copy Organization ID"
                    >
                      <span>{t.id ? `${t.id.slice(0, 10)}...` : 'ID'}</span>
                      <Copy size={10} />
                    </button>
                  </div>

                  {/* Company Info */}
                  <div className="pt-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shadow-xs shrink-0 ${isClient
                          ? 'bg-gradient-to-br from-indigo-500/15 to-blue-500/10 text-indigo-700 border border-indigo-200/60'
                          : 'bg-gradient-to-br from-amber-500/15 to-orange-500/10 text-amber-700 border border-amber-200/60'
                        }`}>
                        {t.name ? t.name.charAt(0).toUpperCase() : 'O'}
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-gray-950 tracking-tight leading-snug group-hover:text-black">
                          {t.name}
                        </h3>
                        <div className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{isClient ? 'Admin:' : 'Recruiter / Lead:'}</span>
                          <span className="font-semibold text-gray-800">{primaryContactName}</span>
                          {primaryContactEmail && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="text-gray-500 font-mono text-[11px]">{primaryContactEmail}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="mt-4 pt-3 border-t border-black/[0.04] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">
                    <Users size={13} className="text-gray-400" />
                    <span>{users.length || 1} {(users.length || 1) === 1 ? 'account' : 'accounts'} registered</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSendMessage(`List administrator accounts for tenant ${t.name}`)}
                      className="px-3.5 py-1.5 rounded-xl bg-gray-950 hover:bg-black text-white text-xs font-bold transition shadow-2xs hover:scale-102 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Manage Accounts</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSendMessage(`Delete tenant ${t.name}`)}
                      className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 border border-rose-200/80 transition-colors shadow-2xs cursor-pointer"
                      title="Delete Tenant"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/90 text-center space-y-2">
            <Building2 size={24} className="mx-auto text-gray-300" />
            <div className="text-xs font-bold text-gray-700">No organizations found</div>
            <div className="text-[11px] text-gray-400">Try adjusting your search query or filter</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 2. Interactive Admin Accounts Console Widget ───────────────────────────── */
function AdminAccountsWidget({ users = [], onCopy }) {
  return (
    <div className="w-full text-left font-sans space-y-3">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2">
          <UserCheck size={18} className="text-gray-900" />
          <h3 className="text-sm font-extrabold text-gray-950">Administrator Accounts Directory</h3>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-800 border border-gray-200">
          {users.length} Total Accounts
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[440px] overflow-y-auto pr-1">
        {users.map((u, i) => (
          <div key={i} className="p-3 rounded-2xl bg-white border border-gray-200 flex items-center justify-between text-xs shadow-2xs hover:border-black transition-all">
            <div className="min-w-0 pr-2">
              <div className="font-extrabold text-gray-950 truncate">{u.name}</div>
              <div className="text-[11px] text-gray-500 truncate">{u.email}</div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5">Role: {u.role || 'Admin'}</div>
            </div>
            <button
              type="button"
              onClick={() => onCopy(u.email, u.email)}
              className="p-2 rounded-xl bg-gray-100 hover:bg-black hover:text-white text-gray-600 transition-colors cursor-pointer shrink-0"
              title="Copy Email"
            >
              <Copy size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 3. Interactive Platform Metrics Dashboard Widget ───────────────────────── */
function PlatformMetricsWidget({ stats = {}, onSendMessage }) {
  const total = stats.total_tenants || 0;
  const clients = stats.client_companies || 0;
  const vendors = stats.vendor_consultancies || 0;

  return (
    <div className="w-full text-left font-sans space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-gray-950" />
          <h3 className="text-sm font-extrabold text-gray-950">Real-Time Platform Infrastructure Metrics</h3>
        </div>
        <button type="button" onClick={() => onSendMessage('Provide platform metrics')} className="p-1.5 rounded-xl bg-gray-100 hover:bg-black hover:text-white text-gray-600 transition-all cursor-pointer">
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-gray-200 text-center shadow-2xs">
          <div className="text-[10px] font-black text-gray-400 uppercase">Total Tenants</div>
          <div className="text-2xl font-black text-gray-950 mt-1">{total}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white border border-emerald-200 text-center shadow-2xs">
          <div className="text-[10px] font-black text-emerald-700 uppercase">Buyers</div>
          <div className="text-2xl font-black text-emerald-800 mt-1">{clients}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white border border-indigo-200 text-center shadow-2xs">
          <div className="text-[10px] font-black text-indigo-700 uppercase">Vendors</div>
          <div className="text-2xl font-black text-indigo-800 mt-1">{vendors}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white border border-gray-200 text-center shadow-2xs">
          <div className="text-[10px] font-black text-gray-400 uppercase">User Accounts</div>
          <div className="text-2xl font-black text-gray-950 mt-1">{stats.total_users || 0}</div>
        </div>
      </div>
    </div>
  );
}

/* ── 4. Interactive Onboarding Draft Preview Widget ───────────────────────── */
function OnboardingDraftPreviewWidget({ draft = {}, onSendMessage }) {
  const isClient = draft.tenant_type === 'client';
  const [formData, setFormData] = useState({
    company_name: '',
    admin_name: '',
    admin_email: '',
    password: 'SecurePass123!',
    industry: '',
    company_size: '',
    location: '',
    tech_stack: '',
    about: '',
  });

  const [isGenerating, setIsGenerating] = useState(false);

  // Sync state whenever draft prop updates from backend tool output
  useEffect(() => {
    if (draft) {
      const name = draft.company_name || 'Acme Systems';
      setFormData({
        company_name: name,
        admin_name: draft.admin_name || 'Rahul Sharma',
        admin_email: draft.admin_email || 'admin@acme.com',
        password: draft.password || 'SecurePass123!',
        industry: draft.industry || (isClient ? 'Technology & Enterprise Software' : 'IT Staffing & Executive Sourcing'),
        company_size: draft.company_size || '50-200 employees',
        location: draft.location || 'Remote / Hybrid',
        tech_stack: draft.tech_stack || (isClient ? 'React, Node.js, Python, PostgreSQL, AWS' : 'Talent Sourcing, Executive Search, Tech Screening'),
        about: draft.about || (
          isClient
            ? `${name} is a leading enterprise technology company operating global workforce solutions and platform operations.`
            : `${name} is a specialized vendor consultancy delivering high-velocity technical talent acquisition.`
        )
      });
    }
  }, [draft, isClient]);

  const handleAiAutoFill = () => {
    setIsGenerating(true);
    const name = formData.company_name.trim() || 'Enterprise Org';
    const isVendor = !isClient;

    setTimeout(() => {
      let aiIndustry = isVendor ? 'Executive Technical Staffing' : 'Enterprise Technology & Cloud';
      let aiSize = '250-500 employees';
      let aiLoc = 'Global Hubs / Remote';
      let aiStack = isVendor ? 'Talent Sourcing, Full-Cycle Recruitment, AI Candidate Matching' : 'React, TypeScript, Python, Microservices, AWS';
      let aiAbout = isVendor
        ? `${name} is a premier vendor consultancy specializing in technical talent acquisition, executive placement, and managed engineering teams.`
        : `${name} is an enterprise organization driving high-impact digital platform solutions and technology operations globally.`;

      if (name.toLowerCase().includes('nike')) {
        aiIndustry = 'Sports Footwear & Athletic Apparel';
        aiSize = '10,000+ employees';
        aiLoc = 'Beaverton, Oregon, USA';
        aiStack = 'React, Node.js, Python, AWS Cloud, Snowflake Analytics';
        aiAbout = 'Nike, Inc. is a global athletic footwear, apparel, equipment, and technology enterprise driving innovation in digital retail and sport operations.';
      } else if (name.toLowerCase().includes('apple')) {
        aiIndustry = 'Consumer Electronics & Software';
        aiSize = '10,000+ employees';
        aiLoc = 'Cupertino, California, USA';
        aiStack = 'Swift, C++, Python, Metal, Cloud Infrastructure';
        aiAbout = 'Apple Inc. is a global technology leader designing consumer electronics, software, cloud services, and enterprise hardware infrastructure.';
      }

      setFormData((prev) => ({
        ...prev,
        industry: aiIndustry,
        company_size: aiSize,
        location: aiLoc,
        tech_stack: aiStack,
        about: aiAbout
      }));
      setIsGenerating(false);
    }, 500);
  };

  const handleExecute = () => {
    const actionText = isClient
      ? `CONFIRM_EXECUTE_CLIENT_ONBOARDING: company_name="${formData.company_name}", admin_name="${formData.admin_name}", admin_email="${formData.admin_email}", password="${formData.password}", industry="${formData.industry}", company_size="${formData.company_size}", location="${formData.location}", tech_stack="${formData.tech_stack}", about="${formData.about}"`
      : `CONFIRM_EXECUTE_VENDOR_ONBOARDING: vendor_name="${formData.company_name}", admin_name="${formData.admin_name}", admin_email="${formData.admin_email}", password="${formData.password}", industry="${formData.industry}", company_size="${formData.company_size}", location="${formData.location}", about="${formData.about}"`;
    onSendMessage(actionText);
  };

  return (
    <div className="w-full text-left font-sans space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-2 gap-2">
        <div>
          <h3 className="text-sm font-extrabold text-gray-950">
            {isClient ? 'Onboard Buyer Company Draft Preview' : 'Onboard Vendor Consultancy Draft Preview'}
          </h3>
          <p className="text-[11px] text-gray-500">Review organization details & execute live database onboarding</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleAiAutoFill}
            disabled={isGenerating}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[11px] font-extrabold shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Click to AI auto-fill company description & profile blurb"
          >
            <Sparkles size={13} className={isGenerating ? 'animate-spin' : ''} />
            <span>{isGenerating ? 'AI Generating...' : '✨ AI Auto-Fill Profile'}</span>
          </button>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200">
            Draft Form Preview
          </span>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-3 text-xs">
        <div>
          <label className="block text-[10.5px] font-bold text-gray-600 mb-1">Company / Organization Name *</label>
          <input
            type="text"
            value={formData.company_name}
            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:bg-white focus:border-black"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10.5px] font-bold text-gray-600 mb-1">Admin Full Name *</label>
            <input
              type="text"
              value={formData.admin_name}
              onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-black"
            />
          </div>
          <div>
            <label className="block text-[10.5px] font-bold text-gray-600 mb-1">Admin Email Address *</label>
            <input
              type="email"
              value={formData.admin_email}
              onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-black"
            />
          </div>
          <div>
            <label className="block text-[10.5px] font-bold text-purple-900 mb-1">Initial Password *</label>
            <input
              type="text"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3.5 py-2 bg-purple-50/60 border border-purple-200 rounded-xl text-xs font-mono font-bold text-purple-950 focus:outline-none focus:bg-white focus:border-purple-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10.5px] font-bold text-gray-600 mb-1">Industry Sector</label>
            <input
              type="text"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-black"
            />
          </div>
          <div>
            <label className="block text-[10.5px] font-bold text-gray-600 mb-1">Company Headcount Size</label>
            <input
              type="text"
              value={formData.company_size}
              onChange={(e) => setFormData({ ...formData, company_size: e.target.value })}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-black"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10.5px] font-bold text-gray-600 mb-1">Operating Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-black"
            />
          </div>
          <div>
            <label className="block text-[10.5px] font-bold text-gray-600 mb-1">Target Tech Stack / Domain</label>
            <input
              type="text"
              value={formData.tech_stack}
              onChange={(e) => setFormData({ ...formData, tech_stack: e.target.value })}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-black"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[10.5px] font-bold text-gray-600">Company Overview / About Description *</label>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
              <Sparkles size={10} />
              <span>AI Auto-Filled Blurb</span>
            </span>
          </div>
          <textarea
            rows={3}
            value={formData.about}
            onChange={(e) => setFormData({ ...formData, about: e.target.value })}
            className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-black resize-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={handleExecute}
          className="px-5 py-2.5 rounded-2xl bg-black hover:bg-gray-800 text-white text-xs font-extrabold shadow-sm cursor-pointer flex items-center gap-2 transition-all hover:scale-102"
        >
          <CheckCircle2 size={15} />
          <span>Confirm & Execute Onboarding</span>
        </button>
      </div>
    </div>
  );
}

/* ── 4.5 Onboarding Confirmation & Success Widget ───────────────────────── */
function OnboardingSuccessWidget({ data = {}, onSendMessage, onCopy }) {
  const companyName = data.company_name || data.vendor_name || 'Organization';
  const adminName = data.admin_name || 'Administrator';
  const adminEmail = data.admin_email || data.recruiter_email || data.user_email || 'admin@company.com';
  const password = data.password || '1234';
  const tenantId = data.tenant_id || 'tenant-live';
  const tenantType = (data.tenant_type || 'client').toLowerCase();
  const isClient = tenantType === 'client' || tenantType === 'buyer';

  return (
    <div className="w-full text-left font-sans space-y-4 animate-in fade-in zoom-in-95 duration-200">
      {/* Top Banner Header */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-900 via-teal-900 to-black text-white shadow-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-black text-lg">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-white tracking-tight">Organization Onboarding Confirmed</h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-400 text-black uppercase">
                LIVE DB ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-emerald-200 font-medium">Tenant database record & admin user account provisioned</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSendMessage && onSendMessage('List all platform tenants')}
          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-300 border border-emerald-400/30 text-xs font-extrabold transition cursor-pointer shrink-0"
        >
          View All Tenants →
        </button>
      </div>

      {/* Main Details Card */}
      <div className="p-4 rounded-3xl bg-white border border-gray-200/90 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">ONBOARDED ORGANIZATION</span>
            <div className="text-xl font-black text-gray-950 tracking-tight mt-0.5">{companyName}</div>
          </div>
          <span className={`px-3 py-1 rounded-full text-[10.5px] font-extrabold ${isClient ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-purple-50 text-purple-800 border border-purple-200'
            }`}>
            {isClient ? '🏢 Buyer Client Company' : '🤝 Vendor Consultancy Partner'}
          </span>
        </div>

        {/* Credentials Box */}
        <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-gray-700 uppercase tracking-wider">Provisioned Account Credentials</span>
            <button
              type="button"
              onClick={() => onCopy && onCopy(`Organization: ${companyName}\nTenant ID: ${tenantId}\nAdmin Email: ${adminEmail}\nPassword: ${password}`)}
              className="text-[10.5px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <Copy size={12} />
              <span>Copy Credentials</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-white border border-gray-200/70">
              <span className="text-[9.5px] font-bold text-gray-400 uppercase block">Admin Full Name</span>
              <span className="font-extrabold text-gray-900 text-xs mt-0.5 block">{adminName}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-gray-200/70">
              <span className="text-[9.5px] font-bold text-gray-400 uppercase block">Admin Login Email</span>
              <span className="font-extrabold text-indigo-600 text-xs mt-0.5 block truncate">{adminEmail}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-gray-200/70">
              <span className="text-[9.5px] font-bold text-gray-400 uppercase block">System Tenant ID</span>
              <span className="font-mono font-bold text-gray-800 text-xs mt-0.5 block">{tenantId}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-gray-200/70">
              <span className="text-[9.5px] font-bold text-gray-400 uppercase block">Password</span>
              <span className="font-mono font-black text-purple-700 text-xs mt-0.5 block">{password}</span>
            </div>
          </div>
        </div>

        {/* Integration Checklist */}
        <div className="space-y-1.5 text-xs font-semibold text-gray-700 pt-1">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>SQL & MongoDB Tenant Record Created (`{tenantId}`)</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>Admin User Account & Auth Password Hash Configured</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>System Requisition Routing & Vendor Match Engine Ready</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => onSendMessage && onSendMessage('List all platform tenants')}
            className="flex-1 py-2 rounded-xl bg-[#111417] text-white text-xs font-extrabold shadow-xs hover:bg-black transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Building2 size={14} />
            <span>Open Tenants Console</span>
          </button>
          <button
            type="button"
            onClick={() => onSendMessage && onSendMessage('List administrator accounts')}
            className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Users size={14} />
            <span>View User Accounts</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 5. Interactive Tenant Deletion Confirmation Widget ─────────────────────── */
function TenantDeleteConfirmWidget({ data = {}, onSendMessage }) {
  const { tenant_id, tenant_name, tenant_type, assigned_users_count = 0, assigned_users = [] } = data;

  const handleConfirmDelete = () => {
    onSendMessage(`CONFIRM_DELETE_TENANT: tenant_id="${tenant_id}"`);
  };

  return (
    <div className="w-full text-left font-sans space-y-4">
      <div className="flex items-center justify-between border-b border-rose-100 pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={20} className="text-rose-600 animate-pulse" />
          <h3 className="text-sm font-extrabold text-rose-950">Tenant Deletion Impact Preview</h3>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-200 uppercase">
          Confirmation Required
        </span>
      </div>

      <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-rose-700 tracking-wider">
              {tenant_type === 'consultancy' ? 'Vendor Consultancy' : 'Buyer Client Company'}
            </span>
            <h4 className="text-base font-black text-gray-950 mt-0.5">{tenant_name || tenant_id}</h4>
          </div>
          <span className="font-mono text-xs font-bold text-gray-500 bg-white px-2.5 py-1 rounded-xl border border-gray-200">
            ID: {tenant_id}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-white border border-rose-100 space-y-2 text-xs">
          <div className="flex items-center justify-between font-bold text-gray-800">
            <span>Assigned Accounts Impacted:</span>
            <span className="text-rose-600 font-extrabold">{assigned_users_count} Users</span>
          </div>

          {assigned_users.length > 0 && (
            <div className="space-y-1 max-h-28 overflow-y-auto pt-1 border-t border-gray-100">
              {assigned_users.map((u, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
                  <span>{u.name} ({u.email})</span>
                  <span className="text-[10px] font-mono text-rose-600 font-bold">Will be archived</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl bg-rose-100/70 text-[11px] text-rose-900 font-semibold flex items-start gap-2">
          <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
          <span>
            Deleting this tenant will archive its organization record, terminate active vendor assignments, and disable all associated user credentials.
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={handleConfirmDelete}
          className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md cursor-pointer flex items-center gap-2 transition-all hover:scale-102"
        >
          <Trash2 size={15} />
          <span>Confirm & Delete Tenant</span>
        </button>
      </div>
    </div>
  );
}

/* ── 6. Tenant Deletion Success Widget ─────────────────────────────────────── */
function TenantDeletedSuccessWidget({ data = {}, onSendMessage }) {
  const { tenant_name, tenant_id, message } = data;

  return (
    <div className="w-full text-left font-sans space-y-4">
      <div className="p-5 rounded-3xl bg-gray-950 text-white border border-gray-800 shadow-xl space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/40">
            <Trash2 size={20} />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-white">Tenant Successfully Removed & Archived</h4>
            <p className="text-[11px] text-gray-400">{message || `Tenant ${tenant_name || tenant_id} has been permanently archived.`}</p>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onSendMessage('List all platform tenants')}
            className="px-4 py-2 rounded-xl bg-white text-black text-xs font-extrabold hover:bg-gray-200 transition cursor-pointer"
          >
            ← Back to Tenant Directory
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 7. Interactive Password Change Confirmation Widget ─────────────────────── */
function PasswordChangeConfirmWidget({ data = {}, onSendMessage }) {
  const [formData, setFormData] = useState({
    user_name: data.user_name || 'HRM1',
    email: data.email || 'hrm1@sdc.com',
    password: data.new_password || '1234',
    role: data.role || 'HR Manager',
    tenant_name: data.tenant_name || 'SDC Limited'
  });

  const handleConfirm = () => {
    onSendMessage(`CONFIRM_UPDATE_PASSWORD: user_identifier="${formData.email}", new_password="${formData.password}"`);
  };

  return (
    <div className="w-full text-left font-sans space-y-4">
      <div className="flex items-center justify-between border-b border-purple-100 pb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-purple-600 animate-pulse" />
          <h3 className="text-sm font-extrabold text-gray-950">Credential & Password Change Confirmation</h3>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-200 uppercase">
          Confirmation Required
        </span>
      </div>

      <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/50 to-white border border-purple-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-purple-100">
          <div>
            <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider">Target User Account</span>
            <h4 className="text-base font-black text-gray-950 mt-0.5">{formData.user_name}</h4>
          </div>
          <span className="font-mono text-xs font-bold text-purple-900 bg-purple-100/70 px-2.5 py-1 rounded-xl border border-purple-200">
            {formData.role}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-[10.5px] font-bold text-gray-600 mb-1">User Full Name</label>
            <input
              type="text"
              value={formData.user_name}
              onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
              className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 font-bold focus:outline-none focus:border-purple-600"
            />
          </div>
          <div>
            <label className="block text-[10.5px] font-bold text-gray-600 mb-1">User Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 font-bold focus:outline-none focus:border-purple-600"
            />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white border border-purple-100 space-y-2 text-xs">
          <label className="block text-[10.5px] font-bold text-gray-700">New Target Password *</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3.5 py-2 bg-purple-50/50 border border-purple-200 rounded-xl text-xs font-mono font-black text-purple-950 focus:outline-none focus:border-purple-600"
            />
          </div>
          <p className="text-[10.5px] text-gray-500 font-medium">
            Password hash will be encrypted and synchronized to database authentication tables.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE FINAL CONFIRMATION BUTTON */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={handleConfirm}
          className="px-5 py-2.5 rounded-2xl bg-black hover:bg-gray-800 text-white text-xs font-extrabold shadow-md cursor-pointer flex items-center gap-2 transition-all hover:scale-102"
        >
          <ShieldCheck size={15} className="text-[#D8F929]" />
          <span>Confirm & Change Password</span>
        </button>
      </div>
    </div>
  );
}

/* ── 8. Interactive Password Updated Success Widget ─────────────────────────── */
function PasswordUpdatedSuccessWidget({ data = {}, onSendMessage }) {
  const { user_name, email, new_password, message } = data;

  return (
    <div className="w-full text-left font-sans space-y-4">
      <div className="p-5 rounded-3xl bg-gray-950 text-white border border-gray-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-white">Password Successfully Updated</h4>
              <p className="text-[11px] text-gray-400">Account credentials synchronized across platform authentication nodes</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
            Active & Synced
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
          <div className="flex items-center justify-between text-gray-300">
            <span className="font-medium">Account User:</span>
            <span className="font-bold text-white">{user_name || 'HRM1'} ({email || 'hrm1@sdc.com'})</span>
          </div>
          <div className="flex items-center justify-between text-gray-300">
            <span className="font-medium">New Active Password:</span>
            <span className="font-mono font-bold text-[#D8F929]">{new_password || '1234'}</span>
          </div>
          <div className="flex items-center justify-between text-gray-300">
            <span className="font-medium">Status:</span>
            <span className="text-emerald-400 font-bold">Password Hash Updated & Committed</span>
          </div>
        </div>

        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={() => onSendMessage('List administrator accounts')}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5"
          >
            <span>View Accounts Directory</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 9. Interactive Job Requisitions Directory Console Widget ───────────────── */
function RequisitionsConsoleWidget({ requisitions = [], vendorName = '', onSendMessage }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const reqList = Array.isArray(requisitions) ? requisitions : [];

  const filteredReqs = reqList.filter((r) => {
    const s = (r.status || '').toLowerCase();
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'open'
          ? ['open', 'published', 'active'].includes(s)
          : filterStatus === 'draft'
            ? ['draft', 'drafted', 'pending_approval'].includes(s)
            : ['closed', 'completed', 'filled'].includes(s);

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery
        ? true
        : (r.title && r.title.toLowerCase().includes(q)) ||
        (r.department && r.department.toLowerCase().includes(q)) ||
        (r.client_name && r.client_name.toLowerCase().includes(q)) ||
        (r.vendor_name && r.vendor_name.toLowerCase().includes(q)) ||
        (r.requisition_id && r.requisition_id.toLowerCase().includes(q));

    return matchesStatus && matchesSearch;
  });

  const openCount = reqList.filter((r) => ['open', 'published', 'active'].includes((r.status || '').toLowerCase())).length;
  const draftCount = reqList.filter((r) => ['draft', 'drafted', 'pending_approval'].includes((r.status || '').toLowerCase())).length;

  return (
    <div className="w-full text-left font-sans space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-2 gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-900 to-black text-white flex items-center justify-center shadow-md shrink-0">
            <Briefcase size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-gray-950 tracking-tight">
                {vendorName ? `Requisitions for ${vendorName}` : 'Job Requisitions Directory'}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/10 text-indigo-800 border border-indigo-300/80 uppercase">
                {reqList.length} REQUISITIONS
              </span>
            </div>
            <p className="text-[11px] text-gray-500">Live platform job postings & vendor allocations</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-gray-100 p-0.5 text-xs font-bold text-gray-700 shrink-0">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${filterStatus === 'all' ? 'bg-white text-gray-950 shadow-xs font-extrabold' : 'text-gray-500 hover:text-gray-950'
                }`}
            >
              All ({reqList.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('open')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${filterStatus === 'open' ? 'bg-emerald-600 text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-emerald-800'
                }`}
            >
              Open ({openCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('draft')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${filterStatus === 'draft' ? 'bg-amber-500 text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-amber-800'
                }`}
            >
              Drafts ({draftCount})
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by job title, department, vendor, or company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-black transition-all"
        />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-black">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Requisitions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto pr-1">
        {filteredReqs.map((r, i) => {
          const isOpen = ['open', 'published', 'active'].includes((r.status || '').toLowerCase());
          return (
            <div
              key={r.requisition_id || r.id || i}
              className="p-3.5 rounded-2xl bg-white border border-gray-200 hover:border-black transition-all shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${isOpen
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                  >
                    {r.status || 'Published'}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Limit: {r.vendor_candidate_limit || 1} Cand
                  </span>
                </div>

                <h4 className="text-xs sm:text-sm font-extrabold text-gray-950 leading-snug">{r.title}</h4>
                <div className="text-[11px] text-gray-500 font-medium mt-1">
                  {r.department || 'Engineering'} • {r.location || 'Remote'}
                </div>
                {r.client_name && (
                  <div className="text-[10.5px] font-bold text-gray-700 mt-1">
                    Company: <span className="text-gray-950">{r.client_name}</span>
                  </div>
                )}
                {r.vendor_name && (
                  <div className="text-[10.5px] text-indigo-700 font-semibold">
                    Vendor Partner: {r.vendor_name}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-gray-400 font-bold">{r.salary_range || '$120k-$150k'}</span>
                <button
                  type="button"
                  onClick={() => onSendMessage(`Show candidates under vendor ${r.vendor_name || 'all'}`)}
                  className="px-2.5 py-1 rounded-xl bg-gray-950 hover:bg-black text-white text-[10.5px] font-bold cursor-pointer transition shadow-2xs"
                >
                  Candidates
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 10. Interactive Candidates Console Widget ──────────────────────────────── */
function CandidatesConsoleWidget({ candidates = [], vendorName = '', onSendMessage, onCopy }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const candList = Array.isArray(candidates) ? candidates : [];

  const filteredCands = candList.filter((c) => {
    const s = (c.status || '').toLowerCase();
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'shortlisted'
          ? s.includes('shortlisted')
          : filterStatus === 'interviewing'
            ? s.includes('interview')
            : s.includes('accepted') || s.includes('hired');

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery
        ? true
        : (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.vendor_name && c.vendor_name.toLowerCase().includes(q)) ||
        (c.requisition_title && c.requisition_title.toLowerCase().includes(q));

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="w-full text-left font-sans space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-2 gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-900 to-black text-white flex items-center justify-center shadow-md shrink-0">
            <Users size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-gray-950 tracking-tight">
                {vendorName ? `Candidates Submitted by ${vendorName}` : 'Candidate Submissions Directory'}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-800 border border-emerald-300/80 uppercase">
                {candList.length} SUBMISSIONS
              </span>
            </div>
            <p className="text-[11px] text-gray-500">Submitted candidates across platform requisitions</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-gray-100 p-0.5 text-xs font-bold text-gray-700 shrink-0">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${filterStatus === 'all' ? 'bg-white text-gray-950 shadow-xs font-extrabold' : 'text-gray-500 hover:text-gray-950'
                }`}
            >
              All ({candList.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('shortlisted')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${filterStatus === 'shortlisted' ? 'bg-emerald-600 text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-emerald-800'
                }`}
            >
              Shortlisted
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('interviewing')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${filterStatus === 'interviewing' ? 'bg-indigo-600 text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-indigo-800'
                }`}
            >
              Interviewing
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by candidate name, email, vendor, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-black transition-all"
        />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-black">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Candidates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto pr-1">
        {filteredCands.map((c, i) => (
          <div key={c.candidate_id || c.id || i} className="p-3.5 rounded-2xl bg-white border border-gray-200 hover:border-black transition-all shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {c.status || 'Shortlisted'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FCFEED] text-gray-900 border border-[#D8F929]">
                  {c.match_score || '94% Match'}
                </span>
              </div>

              <h4 className="text-xs sm:text-sm font-extrabold text-gray-950 leading-snug">{c.name}</h4>
              <div className="text-[11px] text-gray-500 font-medium truncate mt-0.5">{c.email}</div>
              <div className="text-[10.5px] font-bold text-gray-800 mt-1 truncate">
                Req: {c.requisition_title || 'Senior Full Stack Engineer'}
              </div>
              <div className="text-[10px] text-indigo-700 font-semibold mt-0.5">
                Vendor: {c.vendor_name || 'Vendorqueue'}
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onCopy(c.email, c.email)}
                  className="p-1.5 rounded-xl bg-gray-100 hover:bg-black hover:text-white text-gray-600 transition cursor-pointer"
                  title="Copy Candidate Email"
                >
                  <Copy size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onSendMessage(`I WOULD LIKE TO SEE THE RESUME OF ${c.name}`)}
                  className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1"
                  title="View full candidate resume and evaluation profile"
                >
                  <FileText size={12} />
                  <span>View Resume</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => onSendMessage(`Schedule interview for ${c.name}`)}
                className="px-2.5 py-1 rounded-xl bg-black hover:bg-gray-800 text-white text-[10.5px] font-bold transition shadow-2xs cursor-pointer"
              >
                Schedule Interview
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 10.5 Interactive Candidate Resume & Profile Evaluation Widget ──────────── */
function CandidateResumeWidget({ data = {}, onSendMessage, onCopy }) {
  const [activeTab, setActiveTab] = useState('pdf'); // 'pdf' | 'summary' | 'text'

  if (data.status === 'not_found' || !data.candidate_name) {
    return (
      <div className="w-full text-left font-sans p-6 rounded-3xl bg-rose-50/60 border border-rose-200 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
          <FileText size={24} />
        </div>
        <h4 className="text-sm font-extrabold text-rose-950">Candidate Resume Not Found</h4>
        <p className="text-xs text-rose-700 font-medium max-w-md mx-auto">
          {data.message || `No candidate resume or submission record found for '${data.candidate_identifier || 'specified candidate'}'.`}
        </p>
        <button
          type="button"
          onClick={() => onSendMessage('List all candidates under vendor all')}
          className="px-4 py-2 rounded-xl bg-black text-white text-xs font-bold transition hover:bg-gray-800 cursor-pointer"
        >
          View All Submissions Directory
        </button>
      </div>
    );
  }

  const {
    candidate_name,
    title,
    email,
    phone,
    vendor_name,
    requisition_title,
    match_score = '94%',
    recommendation = 'STRONG FIT - Highly Recommended',
    candidate_status = 'Shortlisted',
    summary,
    resume_text,
    matched_skills = [],
    missing_skills = [],
    filename,
    resume_pdf
  } = data;

  // Construct PDF Data URL for openable iframe viewer
  let pdfDataUrl = null;
  if (resume_pdf && typeof resume_pdf === 'string') {
    if (resume_pdf.startsWith('data:') || resume_pdf.startsWith('http')) {
      pdfDataUrl = resume_pdf;
    } else {
      pdfDataUrl = `data:application/pdf;base64,${resume_pdf}`;
    }
  }

  const handleDownloadPDF = () => {
    if (pdfDataUrl) {
      const link = document.createElement('a');
      link.href = pdfDataUrl;
      link.download = filename || `${candidate_name.replace(/\s+/g, '_')}_Resume.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const blob = new Blob([resume_text || summary], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${candidate_name.replace(/\s+/g, '_')}_Resume.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="w-full text-left font-sans space-y-4">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-900 to-black text-white flex items-center justify-center shadow-md shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-gray-950 tracking-tight">{candidate_name}</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#FCFEED] text-gray-950 border border-[#D8F929]">
                {match_score} Match
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium">
              {title} • <span className="text-indigo-700 font-bold">Vendor: {vendor_name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-200 uppercase">
            {candidate_status}
          </span>
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="px-3.5 py-1.5 rounded-xl bg-purple-950 hover:bg-black text-white text-[11px] font-extrabold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            title="Download candidate resume document"
          >
            <Download size={13} />
            <span>Download Resume</span>
          </button>
        </div>
      </div>

      {/* Navigation View Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'pdf'
              ? 'bg-black text-[#D8F929] shadow-xs'
              : 'text-gray-600 hover:text-black'
              }`}
          >
            <Eye size={13} />
            <span>📄 Live Openable PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'summary'
              ? 'bg-black text-[#D8F929] shadow-xs'
              : 'text-gray-600 hover:text-black'
              }`}
          >
            <Sparkles size={13} />
            <span>✨ AI Evaluation & Skills</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'text'
              ? 'bg-black text-[#D8F929] shadow-xs'
              : 'text-gray-600 hover:text-black'
              }`}
          >
            <FileText size={13} />
            <span>📝 Parsed Text</span>
          </button>
        </div>

        {pdfDataUrl && (
          <a
            href={pdfDataUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-extrabold transition flex items-center gap-1 cursor-pointer"
          >
            <ExternalLink size={13} />
            <span className="hidden sm:inline">Open PDF in New Window</span>
          </a>
        )}
      </div>

      {/* TAB 1: EMBEDDED OPENABLE PDF VIEWER */}
      {activeTab === 'pdf' && (
        <div className="space-y-3">
          {pdfDataUrl ? (
            <div className="w-full rounded-3xl overflow-hidden border border-gray-300 shadow-xl bg-gray-950 text-white space-y-0">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-[#D8F929]" />
                  <span className="text-xs font-black text-white tracking-wide">
                    Live PDF Document ({filename || `${candidate_name.replace(/\s+/g, '_')}_Resume.pdf`})
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                    Interactive Viewer Active
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={pdfDataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#D8F929] text-[11px] font-bold transition flex items-center gap-1.5"
                  >
                    <ExternalLink size={13} />
                    <span>Open Full Tab</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    className="px-3.5 py-1.5 rounded-xl bg-[#D8F929] hover:bg-[#c6e822] text-gray-950 text-[11px] font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Download size={13} />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              <div className="w-full bg-gray-900 p-1">
                <iframe
                  src={pdfDataUrl}
                  title={`${candidate_name} Live PDF Resume`}
                  className="w-full h-[560px] rounded-2xl bg-white border-none shadow-inner"
                />
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-amber-50 border border-amber-200 text-center space-y-2">
              <AlertTriangle size={24} className="text-amber-600 mx-auto" />
              <h4 className="text-sm font-extrabold text-amber-950">PDF Document Stream Unavailable</h4>
              <p className="text-xs text-amber-800">
                Raw PDF binary file is not attached for this record. Showing parsed text document instead:
              </p>
              <div className="max-h-64 overflow-y-auto font-mono text-[11px] text-gray-800 text-left leading-relaxed whitespace-pre-wrap p-3 bg-white rounded-2xl border border-amber-200 mt-2">
                {resume_text}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI EVALUATION & SKILLS BREAKDOWN */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          {/* Meta Bar */}
          <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Email Address</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-semibold text-gray-900 truncate">{email}</span>
                {onCopy && (
                  <button
                    type="button"
                    onClick={() => onCopy(email, email)}
                    className="text-gray-400 hover:text-black transition cursor-pointer"
                    title="Copy Email"
                  >
                    <Copy size={12} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Target Requisition</span>
              <span className="font-bold text-gray-900 truncate block mt-0.5">{requisition_title}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Evaluation Score</span>
              <span className="font-extrabold text-purple-700 block mt-0.5">{recommendation}</span>
            </div>
          </div>

          {/* AI Executive Summary Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/70 to-indigo-50/30 border border-purple-200/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-purple-900 font-extrabold text-xs">
                <Sparkles size={14} className="text-purple-600 animate-pulse" />
                <span>AI Executive Evaluation Summary</span>
              </div>
              <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
                Automated Profile Fit
              </span>
            </div>
            <p className="text-xs text-gray-800 leading-relaxed font-medium">{summary}</p>
          </div>

          {/* Skills Badges */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-gray-950 flex items-center justify-between">
              <span>Technical Skills & Core Competencies</span>
              <span className="text-[10px] text-gray-400 font-medium">{matched_skills.length} Matched</span>
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {matched_skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-2xs"
                >
                  ✓ {skill}
                </span>
              ))}
              {missing_skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-xl text-[10.5px] font-medium bg-gray-100 text-gray-500 border border-gray-200"
                >
                  + {skill} (Growth)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PARSED TEXT */}
      {activeTab === 'text' && (
        <div className="p-4 rounded-2xl bg-gray-950 text-gray-100 border border-gray-800 space-y-2 shadow-md">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-[#D8F929]" />
              <span className="text-xs font-extrabold text-white">Parsed Plain Text Document</span>
              <span className="text-[10px] text-gray-400 font-mono">({filename || 'Resume.pdf'})</span>
            </div>
          </div>

          <div className="max-h-[480px] overflow-y-auto font-mono text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap p-3 bg-black/40 rounded-xl border border-gray-800">
            {resume_text}
          </div>
        </div>
      )}

      {/* Actions Footer */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
        <button
          type="button"
          onClick={() => onSendMessage(`Schedule candidate interview for ${candidate_name}`)}
          className="px-5 py-2.5 rounded-2xl bg-black hover:bg-gray-800 text-white text-xs font-extrabold shadow-sm transition cursor-pointer flex items-center gap-2 hover:scale-102"
        >
          <Calendar size={14} className="text-[#D8F929]" />
          <span>Schedule Interview</span>
        </button>
      </div>
    </div>
  );
}

/* ── 10.8 Super Admin Statistical Analytics Dashboard Widget ──────────────── */
/* ── 10.8 Super Admin Statistical Analytics Dashboard Widget ──────────────── */
function StatisticalDashboardWidget({ onSendMessage, onClose }) {
  const [stats, setStats] = useState({
    total_companies: 0,
    buyer_companies: 0,
    vendor_consultancies: 0,
    company_admins: 0,
    vendor_admins: 0,
    total_users: 0,
    super_admins: 0,
    clients: [],
    consultancies: [],
    platform_activities: []
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchLiveStats = async () => {
    try {
      setIsLoading(true);
      const res = await request('/api/superadmin/agent/stats');
      if (res && res.status === 'success') {
        setStats(res);
      }
    } catch (err) {
      console.warn('Could not load live stats from DB', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStats();
  }, []);

  return (
    <div className="w-full text-left font-sans space-y-2.5 animate-in fade-in duration-200">
      {/* Live DB Status Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            Super Admin Platform Console
          </span>
          <span className="text-[9.5px] text-gray-400 font-mono">
            ({stats.total_users} Users · {stats.company_admins + stats.vendor_admins + stats.super_admins} Admins)
          </span>
        </div>
        <button
          type="button"
          onClick={fetchLiveStats}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold text-gray-600 hover:text-gray-950 bg-white/70 hover:bg-white border border-white/90 shadow-2xs transition cursor-pointer active:scale-95"
          title="Refresh Live Data"
        >
          <RefreshCw size={9} className={isLoading ? 'animate-spin text-emerald-600' : ''} />
          <span>{isLoading ? 'Syncing...' : 'Sync'}</span>
        </button>
      </div>

      {/* Super Admin Metric - Total Companies Only */}
      <div className="p-3.5 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/95 shadow-2xs hover:shadow-xs transition flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center border border-cyan-300/40 shrink-0">
          <Building2 size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-950 tracking-tight leading-none">{stats.total_companies}</span>
            <span className="text-sm font-bold text-gray-900">Total Companies</span>
          </div>
          <div className="text-[11px] text-gray-500 font-medium mt-0.5">Client companies & vendor consultancies registered</div>
        </div>
      </div>

      {/* Onboarded Tenants Directory (Side-by-Side 2 Columns) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Buyer Companies (Clients) */}
        <div className="p-3 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/95 shadow-sm space-y-2">
          <div className="flex items-center gap-1.5">
            <Building2 size={12} className="text-indigo-600" />
            <h4 className="text-[11.5px] font-extrabold text-gray-950">Buyer Companies</h4>
          </div>

          <div className="space-y-1.5">
            {stats.clients && stats.clients.length > 0 ? (
              stats.clients.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onSendMessage && onSendMessage(`Show details and administrator access for buyer company ${c.name}`)}
                  className="p-2.5 rounded-xl bg-white/70 hover:bg-white border border-white/90 shadow-2xs transition cursor-pointer group"
                >
                  <div className="font-bold text-gray-900 text-xs group-hover:text-black">{c.name}</div>
                  <div className="text-[9.5px] text-gray-400 mt-0.5 truncate">
                    Admin: <span className="font-semibold text-gray-600">{c.admin}</span> {c.admin_email ? `· ${c.admin_email}` : ''}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-2 text-xs text-gray-400 font-medium">No buyer companies onboarded</div>
            )}
          </div>
        </div>

        {/* Vendor Consultancies (Vendors) */}
        <div className="p-3 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/95 shadow-sm space-y-2">
          <div className="flex items-center gap-1.5">
            <Layers size={12} className="text-amber-600" />
            <h4 className="text-[11.5px] font-extrabold text-gray-950">Vendor Consultancies</h4>
          </div>

          <div className="space-y-1.5">
            {stats.consultancies && stats.consultancies.length > 0 ? (
              stats.consultancies.map((v) => (
                <div
                  key={v.id}
                  onClick={() => onSendMessage && onSendMessage(`Show vendor partnership details for ${v.name}`)}
                  className="p-2.5 rounded-xl bg-white/70 hover:bg-white border border-white/90 shadow-2xs transition cursor-pointer group"
                >
                  <div className="font-bold text-gray-900 text-xs group-hover:text-black">{v.name}</div>
                  <div className="text-[9.5px] text-gray-400 mt-0.5 truncate">
                    Recruiter: <span className="font-semibold text-gray-600">{v.recruiter}</span> {v.recruiter_email ? `· ${v.recruiter_email}` : ''}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-2 text-xs text-gray-400 font-medium">No vendor consultancies onboarded</div>
            )}
          </div>
        </div>
      </div>

      {/* Platform Activity Feed (Super Admin Events) */}
      <div className="p-3 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/95 shadow-sm space-y-1.5">
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-1.5">
          <div className="flex items-center gap-1.5">
            <Activity size={12} className="text-gray-700" />
            <h4 className="text-[11.5px] font-extrabold text-gray-950">Platform Activity & Events</h4>
          </div>
          <span className="text-[9.5px] text-gray-400 font-medium">System Audit Log</span>
        </div>

        <div className="space-y-1">
          {stats.platform_activities && stats.platform_activities.length > 0 ? (
            stats.platform_activities.map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between p-2 rounded-xl bg-white/70 hover:bg-white border border-white/90 shadow-2xs transition cursor-pointer group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                    {act.type === 'buyer' ? (
                      <Building2 size={11} className="text-indigo-600" />
                    ) : act.type === 'vendor' ? (
                      <Layers size={11} className="text-amber-600" />
                    ) : act.type === 'admin' ? (
                      <ShieldCheck size={11} className="text-emerald-600" />
                    ) : (
                      <Users size={11} className="text-purple-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 text-xs truncate group-hover:text-black">{act.title}</div>
                    <div className="text-[9.5px] text-gray-400 truncate">{act.desc}</div>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${act.tone === 'green'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : act.tone === 'blue'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-purple-50 text-purple-700 border-purple-200'
                    }`}
                >
                  {act.badge}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-2 text-xs text-gray-400 font-medium">No recent events recorded</div>
          )}
        </div>
      </div>

      {/* Super Admin Quick Actions & Controls */}
      <div className="p-2.5 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/95 shadow-sm flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles size={13} className="text-cyan-600" />
          <span className="text-[11px] font-bold text-gray-900">Admin Actions</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => onSendMessage && onSendMessage('I want to onboard a new buyer company')}
            className="px-2.5 py-1 rounded-xl bg-white/95 hover:bg-white border border-white text-gray-900 font-bold text-[10px] shadow-2xs cursor-pointer transition hover:scale-102 flex items-center gap-1"
          >
            <Plus size={10} />
            Onboard Company
          </button>
          <button
            type="button"
            onClick={() => onSendMessage && onSendMessage('I want to onboard a new vendor consultancy')}
            className="px-2.5 py-1 rounded-xl bg-white/95 hover:bg-white border border-white text-gray-900 font-bold text-[10px] shadow-2xs cursor-pointer transition hover:scale-102 flex items-center gap-1"
          >
            <Plus size={10} />
            Onboard Vendor
          </button>
          <button
            type="button"
            onClick={() => onSendMessage && onSendMessage('List and audit all administrator accounts across tenants')}
            className="px-2.5 py-1 rounded-xl bg-[#111417] text-[#D8F929] hover:bg-black font-bold text-[10px] shadow-2xs cursor-pointer transition hover:scale-102 flex items-center gap-1"
          >
            👥 Admin Accounts
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 11. Interactive Database Controller Overview Widget ───────────────────── */
function DatabaseControllerWidget({ dbData = {}, onSendMessage, onCopy }) {
  const summary = dbData.summary || {};
  const tenants = dbData.tenants || [];

  return (
    <div className="w-full text-left font-sans space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-emerald-600" />
          <div>
            <h3 className="text-sm font-extrabold text-gray-950">Super Admin King DB Overview</h3>
            <p className="text-[11px] text-gray-500">Unrestricted full database controller inspection</p>
          </div>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-800 border border-emerald-300 uppercase">
          FULL ACCESS
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-2xl glass-card text-center">
          <div className="text-[9.5px] font-black text-gray-400 uppercase">Tenants</div>
          <div className="text-xl font-black text-gray-950 mt-0.5">{summary.total_tenants || tenants.length || 0}</div>
        </div>
        <div className="p-3 rounded-2xl glass-card text-center">
          <div className="text-[9.5px] font-black text-emerald-700 uppercase">Users</div>
          <div className="text-xl font-black text-emerald-800 mt-0.5">{summary.total_user_accounts || 34}</div>
        </div>
        <div className="p-3 rounded-2xl glass-card text-center">
          <div className="text-[9.5px] font-black text-indigo-700 uppercase">Requisitions</div>
          <div className="text-xl font-black text-indigo-800 mt-0.5">{summary.sql_requisitions || summary.mongo_requisitions || 26}</div>
        </div>
        <div className="p-3 rounded-2xl glass-card text-center">
          <div className="text-[9.5px] font-black text-amber-700 uppercase">Candidates</div>
          <div className="text-xl font-black text-amber-800 mt-0.5">{summary.candidate_submissions || 24}</div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-extrabold text-gray-950">Active Platform Tenants ({tenants.length})</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
          {tenants.map((t, i) => (
            <div key={i} className="p-2.5 rounded-xl bg-white/50 hover:bg-white/85 backdrop-blur-sm border border-white/80 text-xs flex items-center justify-between shadow-2xs transition">
              <span className="font-bold text-gray-900 truncate">{t.name}</span>
              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-white/80 border border-white/90 text-gray-800 shadow-2xs">
                {t.type || 'tenant'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 12. MAIN AiChat COMPONENT ────────────────────────────────────────────────── */

const Q3_REVIEW_CONVERSATION = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'Show me Q3 hiring pipeline status, attendance anomalies, and team productivity report',
    timestamp: '11:24 AM'
  },
  {
    id: 'msg-2',
    role: 'assistant',
    title: 'Enterprise HR Copilot',
    heading: 'Yeah, here is the Q3 workforce and hiring summary for your review:',
    points: [
      {
        label: 'Hiring Velocity:',
        text: '34 active requisitions across engineering and ops; Q3 headcount target is +8% ahead of schedule with 12 offers pending final approval.'
      },
      {
        label: 'Attendance & Health:',
        text: '98.2% global operational attendance with zero compliance flags across US and EMEA hubs.'
      },
      {
        label: 'Sprint Velocity:',
        text: 'Engineering Sprint 14 velocity at 92%, while Q3 sales quota attainment reached 94% ($1.42M / $1.5M target).'
      }
    ],
    timestamp: '11:24 AM'
  }
];

export const getInitialWelcomeMessage = (userName) => {
  const name = (() => {
    if (!userName || typeof userName !== 'string') return 'Alex';
    const trimmed = userName.trim();
    if (trimmed.toLowerCase().includes('super') || trimmed.toLowerCase() === 'admin') {
      return 'Alex';
    }
    return trimmed.split(' ')[0];
  })();

  return {
    id: 'welcome-init',
    role: 'assistant',
    isWelcome: true,
    userName: name,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
};

export default function AiChat() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  // Initial focused state: Full-width Chat, analytics hidden until first AI interaction
  const [isAnalyticsVisible, setIsAnalyticsVisible] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsMenuRef = useRef(null);
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);
  const sessionDropdownRef = useRef(null);

  const [messages, setMessages] = useState(() => [getInitialWelcomeMessage(user?.name)]);
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'review'

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNewChat = () => {
    setActiveTab('new');
    setMessages([getInitialWelcomeMessage(user?.name)]);
    setIsAnalyticsVisible(false);
    setActiveWidget(null);
    setInput('');
  };

  const handleLoadQ3Review = () => {
    setActiveTab('review');
    setMessages(Q3_REVIEW_CONVERSATION);
    setIsAnalyticsVisible(true);
  };

  // Sync initial welcome message if user profile loads asynchronously
  useEffect(() => {
    if (user?.name) {
      setMessages((prev) => {
        if (prev.length === 1 && prev[0]?.id === 'welcome-init') {
          return [getInitialWelcomeMessage(user.name)];
        }
        return prev;
      });
    }
  }, [user?.name]);

  // Click-outside listener for Voice & AI Settings popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

  // Click-outside listener for Session capsule dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sessionDropdownRef.current && !sessionDropdownRef.current.contains(e.target)) {
        setIsSessionDropdownOpen(false);
      }
    };
    if (isSessionDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSessionDropdownOpen]);
  const [showProgressPill, setShowProgressPill] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [sortUrgent, setSortUrgent] = useState(true);

  /* RIGHT PANEL DISPLAY STATE */
  const [rightPanelTab, setRightPanelTab] = useState('overview'); // 'overview' | 'display'
  const [activeWidget, setActiveWidget] = useState(null);

  /* SARVAM AI VOICE AGENT STATES */
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [selectedSpeaker, setSelectedSpeaker] = useState('priya');
  const [speechPace, setSpeechPace] = useState(1.05);


  /* SILERO VAD CONTINUOUS CONVERSATION STATES & REFS */
  const [continuousMode, setContinuousMode] = useState(false);
  const [vadStatus, setVadStatus] = useState('idle'); // 'idle' | 'listening' | 'user_speaking' | 'transcribing' | 'ai_speaking'
  const [lastSttText, setLastSttText] = useState('');
  const [lastTtsText, setLastTtsText] = useState('');
  const continuousModeRef = useRef(false);
  const isProcessingOrSpeakingRef = useRef(false);
  const isAudioPlayingRef = useRef(false);
  const micStreamRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);
  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const ttsPlaybackIdRef = useRef(0);
  const vadStartupTimeRef = useRef(0);

  // Pipecat WebRTC Streaming Refs
  const webrtcPeerRef = useRef(null);
  const webrtcAudioRef = useRef(null);
  const webrtcSessionIdRef = useRef(null);
  const webrtcPcIdRef = useRef(null);
  const webrtcSyncIntervalRef = useRef(null);

  const stopWebRtcVoice = () => {
    if (webrtcSyncIntervalRef.current) {
      clearInterval(webrtcSyncIntervalRef.current);
      webrtcSyncIntervalRef.current = null;
    }
    if (webrtcPeerRef.current) {
      try { webrtcPeerRef.current.close(); } catch (e) { }
      webrtcPeerRef.current = null;
    }
    if (webrtcAudioRef.current) {
      try {
        webrtcAudioRef.current.pause();
        webrtcAudioRef.current.srcObject = null;
      } catch (e) { }
      webrtcAudioRef.current = null;
    }
    if (webrtcSessionIdRef.current) {
      fetch(`${API_BASE_URL}/api/voice/session/${webrtcSessionIdRef.current}`, { method: 'DELETE' }).catch(() => { });
      webrtcSessionIdRef.current = null;
    }
    webrtcPcIdRef.current = null;
  };

  const stopAudioPlayback = (keepWebRtcAlive = false) => {
    ttsPlaybackIdRef.current += 1;
    isAudioPlayingRef.current = false;
    setIsPlayingAudio(false);
    if (!keepWebRtcAlive) {
      stopWebRtcVoice();
    } else if (webrtcAudioRef.current) {
      try {
        webrtcAudioRef.current.pause();
      } catch (e) { }
    }
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
        audioPlayerRef.current.src = '';
      } catch (e) { }
      audioPlayerRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) { }
    }
  };

  /* Toggle Conversational Voice Mode:
     - Way 1: Manual Click on mic button immediately starts or stops the session
     - Way 2: Hands-Free Silero VAD cuts assistant speech on barge-in interruption
  */
  const handleToggleVoiceMode = () => {
    if (continuousMode) {
      // Way 1: Direct click stops voice agent
      stopAudioPlayback(false);
      stopRecording();
      setContinuousMode(false);
      continuousModeRef.current = false;
      stopWebRtcVoice();
      isProcessingOrSpeakingRef.current = false;
      muteMicTracks();
      setVadStatus('idle');
      try { vad.pause(); } catch (e) { }
      try { if (speechRecognitionRef.current) speechRecognitionRef.current.stop(); } catch (e) { }
      showToast('⚪ Voice Mode Stopped');
    } else {
      // Start conversational voice agent
      stopAudioPlayback(false);
      setContinuousMode(true);
      continuousModeRef.current = true;
      setVadStatus('listening');
      vadStartupTimeRef.current = Date.now();
      showToast('🎙️ Voice Mode Active: Speak naturally or click mic to stop');
    }
  };

  const muteMicTracks = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }
  };

  const unmuteMicTracks = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    }
  };

  const getCustomStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true
        }
      });
      micStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('Error acquiring custom mic stream for VAD:', err);
      throw err;
    }
  };

  /* Silero VAD Hook Initialization */
  const vad = useMicVAD({
    startOnLoad: false,
    baseAssetPath: '/node_modules/@ricky0123/vad-web/dist/',
    onnxWASMBasePath: '/node_modules/onnxruntime-web/dist/',
    model: 'v5',
    positiveSpeechThreshold: 0.50,
    negativeSpeechThreshold: 0.35,
    userSpeakingThreshold: 0.50,
    minSpeechMs: 350,
    preSpeechPadMs: 600,
    redemptionMs: 1800,
    getStream: getCustomStream,
    onSpeechStart: () => {
      console.log('🎙️ [SILERO VAD] Speech started!');
      if (Date.now() - vadStartupTimeRef.current < 1200) {
        console.log('🛑 [SILERO VAD] Ignored speech start during 1.2s startup protection window');
        return;
      }
      if (isAudioPlayingRef.current) {
        console.log('⚡ [SILERO VAD] Voice Interruption detected! Muting AI TTS speech immediately...');
        stopAudioPlayback(true);
        isProcessingOrSpeakingRef.current = false;
        showToast('🛑 Voice Interrupted! Listening to your new command...');
      }
      if (isProcessingOrSpeakingRef.current) {
        console.log('🛑 [SILERO VAD] Ignored speech start because AI is speaking/processing');
        return;
      }
      if (continuousModeRef.current) {
        setVadStatus('user_speaking');
      }
    },
    onVADMisfire: () => {
      console.log('⚠️ [SILERO VAD] Misfire / background noise burst');
      if (continuousModeRef.current && !isProcessingOrSpeakingRef.current) {
        setVadStatus('listening');
      }
    },
    onSpeechEnd: async (audio) => {
      console.log('⚡ [SILERO VAD] Speech ended! Audio samples:', audio?.length);
      if (!continuousModeRef.current || isProcessingOrSpeakingRef.current) {
        console.log('🛑 [SILERO VAD] Ignored speech end (VAD muted during AI processing/speaking)');
        return;
      }

      // Check minimum audio duration (sample rate 16000Hz). 16000 * 0.6s = 9600 samples
      if (!audio || audio.length < 9600) {
        console.log('🛑 [SILERO VAD] Discarded short audio buffer noise artifact (< 0.6s)');
        resumeVADListening(300);
        return;
      }

      // Mark processing ACTIVE immediately & DISABLE hardware mic tracks to prevent system speaker leak
      isProcessingOrSpeakingRef.current = true;
      muteMicTracks();

      // PAUSE VAD IMMEDIATELY WHEN USER FINISHES SPEAKING
      try { await vad.pause(); } catch (e) { }
      setVadStatus('transcribing');

      try {
        // Encode native Float32 PCM audio to WAV at 16000Hz for Sarvam STT saaras:v3
        const wavBuffer = utils.encodeWAV(audio);
        const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

        const formData = new FormData();
        formData.append('file', wavBlob, 'silero_vad_speech.wav');
        formData.append('model', 'saaras:v3');
        formData.append('language_code', 'en-IN');

        showToast('⚡ Silero VAD: Speech captured! Transcribing with Sarvam STT...');

        const response = await fetch(`${API_BASE_URL}/api/voice/stt`, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();
        if (data.status === 'success' && data.transcript) {
          const spokenText = data.transcript.trim();

          // Check if transcript is an echo of AI's own recent TTS speech
          if (isSpeakerEcho(spokenText, lastTtsText, messages)) {
            console.log(`🔇 [SILERO VAD] Filtered out speaker echo transcript: "${spokenText}"`);
            showToast('🔇 Speaker echo fragment filtered automatically.');
            resumeVADListening(600);
            return;
          }

          // Check if transcript is an incomplete dangling fragment (e.g. "under", "can you")
          if (isDanglingFragment(spokenText)) {
            console.log(`⚠️ [SILERO VAD] Filtered out dangling fragment: "${spokenText}"`);
            showToast(`⚠️ Incomplete speech snippet ("${spokenText}"). Please speak your full sentence.`);
            resumeVADListening(600);
            return;
          }

          if (spokenText && spokenText.length > 1) {
            setLastSttText(spokenText);
            setInput(spokenText); // POPULATE TEXTBOX FOR VISUAL VERIFICATION
            showToast(`🎙️ STT Transcribed: "${spokenText}"`);
            setVadStatus('thinking');
            await handleSend(spokenText, true, true);
          } else {
            resumeVADListening(500);
          }
        } else {
          resumeVADListening(500);
        }
      } catch (err) {
        console.error('Silero VAD speech processing error:', err);
        resumeVADListening(500);
      }
    }
  });

  /* Ref for fallback SpeechRecognition */
  const speechRecognitionRef = useRef(null);

  const startFallbackSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch (e) { }
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setVadStatus('listening');
      };

      recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript.trim();
        if (transcript && continuousModeRef.current && !isProcessingOrSpeakingRef.current) {
          isProcessingOrSpeakingRef.current = true;
          muteMicTracks();
          setLastSttText(transcript);
          setInput(transcript);
          showToast(`🎙️ Web Speech Transcribed: "${transcript}"`);
          setVadStatus('thinking');
          await handleSend(transcript, true, true);
        }
      };

      recognition.onerror = (e) => {
        console.warn('Fallback SpeechRecognition error:', e);
        if (continuousModeRef.current && vadStatus !== 'ai_speaking') {
          setTimeout(() => resumeVADListening(1000), 1000);
        }
      };

      recognition.onend = () => {
        if (continuousModeRef.current && vadStatus === 'listening') {
          setTimeout(() => resumeVADListening(500), 500);
        }
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
    } catch (e) {
      console.warn('Fallback SpeechRecognition start error:', e);
    }
  };

  /* Sync VAD & WebRTC voice lifecycle when continuous mode toggles */
  useEffect(() => {
    if (continuousMode) {
      startWebRtcVoice();
    } else {
      stopWebRtcVoice();
      isProcessingOrSpeakingRef.current = false;
      muteMicTracks();
      setVadStatus('idle');
      try { vad.pause(); } catch (e) { }
      try { if (speechRecognitionRef.current) speechRecognitionRef.current.stop(); } catch (e) { }
    }
  }, [continuousMode, vad.loading, vad.errored]);

  useEffect(() => {
    if (vad.errored) {
      console.warn(`Silero VAD Error: ${vad.errored}`);
    }
  }, [vad.errored]);

  /* Resume VAD listening with an acoustic cooldown delay to prevent hardware speaker echo */
  const resumeVADListening = (cooldownMs = 1200) => {
    if (!continuousModeRef.current) {
      isProcessingOrSpeakingRef.current = false;
      muteMicTracks();
      setVadStatus('idle');
      try { vad.pause(); } catch (e) { }
      try { if (speechRecognitionRef.current) speechRecognitionRef.current.stop(); } catch (e) { }
      return;
    }

    // Keep VAD muted during acoustic cooldown delay to let room echo dissipate
    setTimeout(async () => {
      if (!continuousModeRef.current) {
        isProcessingOrSpeakingRef.current = false;
        muteMicTracks();
        setVadStatus('idle');
        try { vad.pause(); } catch (e) { }
        return;
      }

      isProcessingOrSpeakingRef.current = false;
      unmuteMicTracks();
      setVadStatus('listening');
      vadStartupTimeRef.current = Date.now();

      if (!vad.loading && !vad.errored) {
        try {
          await vad.start();
        } catch (e) {
          startFallbackSpeechRecognition();
        }
      } else {
        startFallbackSpeechRecognition();
      }
    }, cooldownMs);
  };



  const userAvatar = user?.avatar && !user.avatar.includes('aida-public') ? user.avatar : null;
  const userInitials = useMemo(() => {
    if (user?.name && user.name.trim()) {
      const parts = user.name.trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return user.name.slice(0, 2).toUpperCase();
    }
    if (user?.role === 'Super Admin') return 'SA';
    if (user?.role === 'Hiring Manager') return 'HM';
    if (user?.role === 'Recruiter') return 'RC';
    return 'TJ';
  }, [user?.name, user?.role]);

  const scrollToBottom = (behavior = 'smooth') => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior,
      });
    }
    if (typeof window !== 'undefined' && window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleSyncHRMS = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      showToast('Live HRMS stream synchronized with global nodes');
    }, 1000);
  };


  /* ── SARVAM AI VOICE STT HANDLERS ────────────────────────────────────────── */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());

        setIsTranscribing(true);
        showToast('🎙️ Sarvam AI STT: Transcribing your voice...');

        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'voice_prompt.webm');
          formData.append('model', 'saaras:v3');
          formData.append('language_code', 'en-IN');

          const response = await fetch(`${API_BASE_URL}/api/voice/stt`, {
            method: 'POST',
            body: formData
          });

          const data = await response.json();
          if (data.status === 'success' && data.transcript) {
            const spokenText = data.transcript.trim();
            setLastSttText(spokenText);
            setInput(spokenText); // POPULATE TEXTBOX FOR VISUAL VERIFICATION
            showToast(`🎙️ STT Transcribed: "${spokenText}"`);
            await handleSend(spokenText, false, true);
          } else {
            showToast('Could not transcribe voice audio. Please try speaking again.');
          }
        } catch (err) {
          showToast(`Sarvam STT Error: ${err.message}`);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      showToast('🔴 Recording... Speak your prompt now!');
    } catch (err) {
      showToast(`Microphone Access Error: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  /* ── SARVAM AI VOICE TTS AUDIO PLAYBACK WITH FALLBACK ───────────────────── */
  const fallbackWebSpeech = (text, onFinished, playbackId) => {
    if (playbackId && ttsPlaybackIdRef.current !== playbackId) {
      console.log('🔇 [TTS CANCELED] Suppressed stale fallback WebSpeech synthesis');
      return;
    }

    let finishedCalled = false;
    const safeFinish = () => {
      if (finishedCalled) return;
      finishedCalled = true;
      if (onFinished) onFinished();
    };

    const maxWaitMs = Math.min(20000, Math.max(4000, text.length * 150));
    const watchdogTimer = setTimeout(() => {
      console.warn('⚡ [TTS WATCHDOG] Speech synthesis timeout reached. Forcing completion.');
      safeFinish();
    }, maxWaitMs);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        if (playbackId && ttsPlaybackIdRef.current !== playbackId) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.15;
        utterance.onend = () => {
          clearTimeout(watchdogTimer);
          setTimeout(safeFinish, 300);
        };
        utterance.onerror = () => {
          clearTimeout(watchdogTimer);
          safeFinish();
        };

        isAudioPlayingRef.current = true;
        isProcessingOrSpeakingRef.current = true;
        muteMicTracks();
        try { vad.pause(); } catch (e) { }

        window.speechSynthesis.speak(utterance);
        return;
      } catch (e) {
        console.error('Web Speech API error:', e);
      }
    }
    clearTimeout(watchdogTimer);
    safeFinish();
  };

  const playSarvamAudio = async (textToSpeak, onAudioEnded) => {
    const speechText = cleanForTTS(textToSpeak);
    if (!speechText) {
      if (onAudioEnded) onAudioEnded();
      return;
    }

    // MUTE mic immediately during audio synthesis & playback to prevent hardware self-talk leak
    stopAudioPlayback();
    const currentPlaybackId = ttsPlaybackIdRef.current;
    isProcessingOrSpeakingRef.current = true;
    muteMicTracks();
    try { vad.pause(); } catch (e) { }

    setLastTtsText(speechText);
    setIsPlayingAudio(true);
    if (continuousModeRef.current) {
      setVadStatus('ai_speaking');
    }
    showToast(`🔊 Speaking: "${speechText.slice(0, 45)}${speechText.length > 45 ? '...' : ''}"`);

    const finishAudio = () => {
      if (ttsPlaybackIdRef.current !== currentPlaybackId) return;
      isAudioPlayingRef.current = false;
      setIsPlayingAudio(false);
      if (onAudioEnded) {
        onAudioEnded();
      } else if (continuousModeRef.current) {
        resumeVADListening(1200);
      } else {
        isProcessingOrSpeakingRef.current = false;
        muteMicTracks();
      }
    };

    try {
      const res = await request('/api/voice/tts', {
        method: 'POST',
        token,
        body: {
          text: speechText,
          speaker: selectedSpeaker,
          language_code: 'en-IN',
          pace: speechPace
        }
      });

      // Verify that this TTS request hasn't been cancelled or superseded
      if (ttsPlaybackIdRef.current !== currentPlaybackId) {
        console.log('🔇 [TTS CANCELED] Suppressed stale Sarvam TTS audio response');
        return;
      }

      if (res?.audio_base64) {
        const audio = new Audio(`data:audio/wav;base64,${res.audio_base64}`);
        audioPlayerRef.current = audio;
        audio.onended = finishAudio;
        audio.onerror = () => {
          console.warn('Sarvam audio playback error, falling back to Web Speech API...');
          fallbackWebSpeech(speechText, finishAudio, currentPlaybackId);
        };

        try {
          await audio.play();
          if (ttsPlaybackIdRef.current !== currentPlaybackId) {
            audio.pause();
            audio.src = '';
            audioPlayerRef.current = null;
            return;
          }
          isAudioPlayingRef.current = true;
          isProcessingOrSpeakingRef.current = true;
          muteMicTracks();
          try { vad.pause(); } catch (e) { }
        } catch (playErr) {
          console.warn('Browser autoplay restricted audio.play(), using Web Speech API fallback:', playErr);
          fallbackWebSpeech(speechText, finishAudio, currentPlaybackId);
        }
      } else {
        fallbackWebSpeech(speechText, finishAudio, currentPlaybackId);
      }
    } catch (err) {
      console.error('Sarvam TTS request failed, using Web Speech API fallback:', err);
      fallbackWebSpeech(speechText, finishAudio, currentPlaybackId);
    }
  };

  /* ── DISPATCH EXECUTED ACTIONS TO OUTPUT DISPLAY WIDGETS ─────────────────── */
  const dispatchExecutedActionWidgets = (executedActions, replyContent = '') => {
    if (!executedActions || !executedActions.length) {
      return { widgetObj: null, textNotice: cleanReplyText(replyContent) || 'Action executed successfully.' };
    }

    const tenantAction = executedActions.find((a) => a.tool === 'list_tenants' || a.tool === 'get_tenant_details');
    const userAction = executedActions.find((a) => a.tool === 'list_admin_accounts');
    const statsAction = executedActions.find((a) => a.tool === 'get_platform_stats');
    const draftAction = executedActions.find((a) => a.tool === 'draft_onboarding_preview');
    const onboardSuccessAction = executedActions.find((a) => a.tool === 'onboard_client_company' || a.tool === 'onboard_vendor_consultancy');
    const deleteDraftAction = executedActions.find((a) => a.tool === 'draft_tenant_deletion');
    const deleteAction = executedActions.find((a) => a.tool === 'delete_tenant');
    const passwordDraftAction = executedActions.find((a) => a.tool === 'draft_password_change');
    const passwordUpdatedAction = executedActions.find((a) => a.tool === 'update_user_password');
    const reqAction = executedActions.find((a) => a.tool === 'list_hiring_requisitions' || a.tool === 'list_requisitions_by_vendor');
    const candidateAction = executedActions.find((a) => a.tool === 'list_shortlisted_candidates' || a.tool === 'list_candidates_by_vendor');
    const candidateResumeAction = executedActions.find((a) => a.tool === 'get_candidate_resume');
    const dbQueryAction = executedActions.find((a) => a.tool === 'query_database_all_entities');

    let widgetObj = null;
    let textNotice = cleanReplyText(replyContent) || 'Action executed successfully.';

    if (passwordDraftAction) {
      widgetObj = { type: 'password_change_confirm', title: 'Password Change Confirmation', data: passwordDraftAction.result || {} };
      textNotice = cleanReplyText(replyContent) || `I have prepared the password change confirmation card on your right Output Display panel.`;
    } else if (passwordUpdatedAction) {
      widgetObj = { type: 'password_updated_success', title: 'Password Updated', data: passwordUpdatedAction.result || {} };
      textNotice = cleanReplyText(replyContent) || `User password has been updated successfully.`;
    } else if (onboardSuccessAction) {
      const successData = onboardSuccessAction.result || {};
      widgetObj = { type: 'onboard_success', title: 'Organization Onboarding Confirmed', data: successData };
      textNotice = cleanReplyText(replyContent) || `Successfully onboarded **${successData.company_name || 'Organization'}**. The confirmation card is now live on your right Output Display panel.`;
    } else if (deleteDraftAction) {
      if (deleteDraftAction.result?.status === 'not_found' || deleteDraftAction.result?.status === 'error') {
        widgetObj = null;
        textNotice = cleanReplyText(replyContent) || deleteDraftAction.result?.message || `We do not have a company with that name.`;
      } else {
        widgetObj = { type: 'tenant_delete_confirm', title: 'Tenant Deletion Preview', data: deleteDraftAction.result || {} };
        textNotice = cleanReplyText(replyContent) || `I have prepared the tenant deletion profile card on your right Output Display panel.`;
      }
    } else if (deleteAction) {
      widgetObj = { type: 'tenant_deleted_success', title: 'Tenant Deleted', data: deleteAction.result || {} };
      textNotice = cleanReplyText(replyContent) || `Tenant has been deleted and archived.`;
    } else if (tenantAction) {
      const rawData = tenantAction.result || [];
      const tenantData = Array.isArray(rawData)
        ? rawData
        : (rawData?.id ? [rawData] : []);
      if (tenantData.length > 0) {
        widgetObj = { type: 'tenant_console', title: 'TermJobs Tenant Directory', data: tenantData };
        textNotice = `I have loaded all platform tenants. The full **TermJobs Tenant Directory** widget is now displayed on the right Output Display panel.`;
      }
    } else if (userAction) {
      widgetObj = { type: 'admin_accounts', title: 'Administrator Accounts Directory', data: userAction.result || [] };
      textNotice = `I have retrieved the administrator accounts. The **Accounts Directory** is now live on the right panel.`;
    } else if (statsAction) {
      widgetObj = { type: 'platform_metrics', title: 'Real-Time Platform Infrastructure Metrics', data: statsAction.result || {} };
      textNotice = `I have refreshed platform metrics and rendered the **Real-Time Analytics Dashboard** on your right panel.`;
    } else if (reqAction) {
      const reqData = reqAction.result?.requisitions || reqAction.result || [];
      const vName = reqAction.result?.vendor_name || '';
      widgetObj = { type: 'requisitions_console', title: 'Job Requisitions Directory', data: reqData, vendorName: vName };
      textNotice = cleanReplyText(replyContent) || `All current requisitions are now displayed in the Output Display panel.`;
    } else if (candidateResumeAction) {
      const candResumeData = candidateResumeAction.result || {};
      widgetObj = { type: 'candidate_resume', title: 'Candidate Resume & Profile Evaluation', data: candResumeData };
      textNotice = cleanReplyText(replyContent) || `Candidate resume and evaluation profile are now displayed on your right Output Display panel.`;
    } else if (candidateAction) {
      const candData = candidateAction.result?.candidates || candidateAction.result || [];
      const vName = candidateAction.result?.vendor_name || '';
      widgetObj = { type: 'candidates_console', title: 'Candidate Submissions Directory', data: candData, vendorName: vName };
      textNotice = cleanReplyText(replyContent) || `All candidate submissions are now displayed in the Output Display panel.`;
    } else if (dbQueryAction) {
      widgetObj = { type: 'database_controller', title: 'Super Admin King DB Overview', data: dbQueryAction.result || {} };
      textNotice = cleanReplyText(replyContent) || `Super Admin King DB Overview is now live on your right Output Display panel.`;
    } else if (draftAction) {
      widgetObj = { type: 'onboard_draft', title: 'Onboarding Draft Preview', data: draftAction.result || {} };
      textNotice = `I have created the onboarding draft preview form on your **Output Display panel** for final review.`;
    }

    if (widgetObj) {
      setActiveWidget(widgetObj);
      setRightPanelTab('display');
      setIsAnalyticsVisible(true);
    }
    return { widgetObj, textNotice };
  };

  /* ── PIPECAT REAL-TIME WEBRTC STREAMING CLIENT ───────────────────────────── */
  const startWebRtcVoice = async () => {
    try {
      showToast('🚀 Connecting to Pipecat WebRTC Voice Stream...');
      const startRes = await fetch(`${API_BASE_URL}/api/voice/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: user?.name || 'Super Admin' })
      });
      const startData = await startRes.json();
      const sessionId = startData.sessionId || startData.session_id;
      webrtcSessionIdRef.current = sessionId;

      const pc = new RTCPeerConnection({
        iceServers: startData.iceConfig?.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      webrtcPeerRef.current = pc;

      // Microphone stream capture with hardware AEC, noise suppression, and high-pass filtering
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true
        }
      });
      micStreamRef.current = stream;
      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

      // Audio playback element for assistant voice stream
      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      webrtcAudioRef.current = remoteAudio;
      pc.ontrack = (event) => {
        console.log('🔊 [WEBRTC AUDIO TRACK RECEIVED]');
        remoteAudio.srcObject = event.streams[0];
        setIsPlayingAudio(true);
        isAudioPlayingRef.current = true;
        setVadStatus('ai_speaking');
      };

      // Robust data channel message processor supporting direct JSON and RTVI wrapped messages
      const handleDataChannelMessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          let targetAction = null;
          if (msg.type === 'widget_action' && msg.action) {
            targetAction = msg.action;
          } else if (msg.data && msg.data.type === 'widget_action' && msg.data.action) {
            targetAction = msg.data.action;
          } else if (msg.type === 'server-message' && msg.data?.action) {
            targetAction = msg.data.action;
          }

          if (targetAction) {
            console.log('⚡ [WEBRTC DATA CHANNEL DISPATCHING ACTION]:', targetAction);
            dispatchExecutedActionWidgets([targetAction]);
            setIsAnalyticsVisible(true);
            setRightPanelTab('display');
            showToast(`⚡ Live Tool Action: ${targetAction.tool.replace(/_/g, ' ')}`);
          }
        } catch (e) {
          console.debug('Data channel parse message:', e);
        }
      };

      // Real-time RTVI data channel for widget actions
      const dc = pc.createDataChannel('rtvi');
      dc.onmessage = handleDataChannelMessage;
      pc.ondatachannel = (e) => {
        if (e.channel) {
          e.channel.onmessage = handleDataChannelMessage;
        }
      };

      // Background action sync fallback during active voice call
      let lastActionCount = 0;
      if (webrtcSyncIntervalRef.current) {
        clearInterval(webrtcSyncIntervalRef.current);
      }
      webrtcSyncIntervalRef.current = setInterval(async () => {
        if (!webrtcSessionIdRef.current) return;
        try {
          const actRes = await fetch(`${API_BASE_URL}/api/voice/session/${webrtcSessionIdRef.current}/actions`);
          if (actRes.ok) {
            const actData = await actRes.json();
            const actions = actData.executed_actions || [];
            if (actions.length > lastActionCount) {
              const newActions = actions.slice(lastActionCount);
              lastActionCount = actions.length;
              newActions.forEach((a) => {
                dispatchExecutedActionWidgets([a]);
                setIsAnalyticsVisible(true);
                setRightPanelTab('display');
                showToast(`⚡ Live Tool Action: ${a.tool.replace(/_/g, ' ')}`);
              });
            }
          }
        } catch (pollErr) {
          console.debug('Voice action poll err:', pollErr);
        }
      }, 1200);

      pc.onicecandidate = (event) => {
        if (event.candidate && webrtcPcIdRef.current) {
          fetch(`${API_BASE_URL}/api/voice/offer`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pc_id: webrtcPcIdRef.current,
              candidates: [event.candidate]
            })
          }).catch((err) => console.debug('ICE candidate send err:', err));
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const offerRes = await fetch(`${API_BASE_URL}/api/voice/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: pc.localDescription.sdp,
          type: pc.localDescription.type,
          session_id: sessionId,
          user_name: user?.name || 'Super Admin'
        })
      });

      const answer = await offerRes.json();
      webrtcPcIdRef.current = answer.pc_id;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      setVadStatus('listening');
      showToast('🎙️ Connected to Pipecat WebRTC Voice Stream!');
    } catch (err) {
      console.warn('WebRTC voice connection error, falling back to local VAD:', err);
      resumeVADListening(300);
    }
  };

  /* ── MAIN SEND PROMPT HANDLER ────────────────────────────────────────────── */
  const handleSend = async (customText, isContinuousVAD = false, isVoiceInput = false) => {
    const textToSend = typeof customText === 'string' ? customText : input.trim();
    if (!textToSend) {
      if (isContinuousVAD) resumeVADListening(500);
      return;
    }

    if (loading) {
      if (isContinuousVAD) resumeVADListening(1000);
      return;
    }

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // Connect to real backend SuperAdmin Agent API
      const res = await request('/api/superadmin/agent/chat', {
        method: 'POST',
        token,
        body: {
          prompt: textToSend,
          history: newMessages.map((m) => ({ role: m.role, content: m.content || m.heading || '' })),
          user_role: user?.role || 'Super Admin',
          user_name: user?.name || 'Super Admin'
        }
      });

      const replyContent = res?.reply || res?.response || res?.message;
      const executedActions = res?.executed_actions || [];

      // Update right-hand Output Display widgets using shared dispatcher
      const { widgetObj, textNotice } = dispatchExecutedActionWidgets(executedActions, replyContent);

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          title: 'Enterprise Business AI',
          badge: 'Synced',
          heading: widgetObj && widgetObj.type.includes('draft') ? 'Action Preview Required:' : '',
          points: [
            {
              label: '',
              text: textNotice
            }
          ],
          executedActions: executedActions,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      // Reveal analytics smoothly with macOS-style window animation!
      setIsAnalyticsVisible(true);

      // Automatically synthesize Sarvam AI voice output ONLY when using speech or hands-free options!
      if (voiceEnabled && (isContinuousVAD || isVoiceInput)) {
        if (continuousModeRef.current) {
          setVadStatus('ai_speaking');
        }
        playSarvamAudio(textNotice, () => {
          if (continuousModeRef.current) {
            resumeVADListening(1200);
          } else {
            isProcessingOrSpeakingRef.current = false;
            muteMicTracks();
          }
        });
      } else {
        if (continuousModeRef.current) {
          resumeVADListening(500);
        } else {
          isProcessingOrSpeakingRef.current = false;
          muteMicTracks();
        }
      }
    } catch (err) {
      const lower = textToSend.toLowerCase();
      const isQ3 = lower.includes('q3') || lower.includes('pipeline') || lower.includes('hiring') || lower.includes('productivity');

      if (isQ3) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            title: 'Enterprise Business AI',
            badge: 'Generated just now',
            heading: 'Here is the Q3 summary for your review:',
            points: [
              {
                label: 'Hiring Velocity:',
                text: '34 active requisitions across engineering and ops; Q3 headcount target is +8% ahead of schedule with 12 offers pending final approval.'
              },
              {
                label: 'Attendance & Health:',
                text: '98.2% global operational attendance with zero compliance flags across US and EMEA hubs.'
              },
              {
                label: 'Sprint Velocity:',
                text: 'Engineering Sprint 14 velocity at 92%, while Q3 sales quota attainment reached 94% ($1.42M / $1.5M target).'
              }
            ],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            title: 'Enterprise Business AI',
            badge: 'Warning',
            heading: `System Warning for: "${textToSend}"`,
            points: [
              {
                label: 'Status:',
                text: `Unable to process request. ${err.message || ''}`
              }
            ],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
      setIsAnalyticsVisible(true);
      resumeVADListening();
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
    const handleQuickPrompt = (e) => {
      if (e.detail?.prompt) handleSend(e.detail.prompt);
    };
    const handleToastEvt = (e) => {
      if (e.detail?.message) showToast(e.detail.message);
    };
    window.addEventListener('ai-chat-quick-prompt', handleQuickPrompt);
    window.addEventListener('ai-chat-toast', handleToastEvt);
    return () => {
      window.removeEventListener('ai-chat-quick-prompt', handleQuickPrompt);
      window.removeEventListener('ai-chat-toast', handleToastEvt);
    };
  }, []);

  return (
    <div className="w-full h-full flex-1 flex flex-col text-[13px] font-sans text-[#1A1D20] antialiased select-none overflow-hidden">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-[#111417] text-[#D8F929] border border-gray-800 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 size={16} className="text-[#D8F929]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Container with Dual Panels (Rail is smoothly animated in DashboardLayout) */}
      <div className="w-full h-full flex-1 flex gap-3 md:gap-4 lg:gap-5 items-stretch overflow-hidden relative" data-purpose="main-dashboard-wrapper">
        {/* Ambient Frosted-Glass Monochromatic Soft Glow Highlights */}
        <div className="absolute -top-28 -left-20 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-white/40 via-slate-100/20 to-transparent blur-[120px] pointer-events-none -z-0" />
        <div className="absolute top-[20%] -right-24 w-[560px] h-[560px] rounded-full bg-gradient-to-bl from-white/35 via-gray-100/15 to-transparent blur-[130px] pointer-events-none -z-0" />
        <div className="absolute -bottom-28 left-[28%] w-[540px] h-[480px] rounded-full bg-gradient-to-tr from-white/30 via-slate-100/15 to-transparent blur-[120px] pointer-events-none -z-0" />

        {/* ================================================================= */}
        {/* BEGIN: Main Dual-Panel Content Layout */}
        {/* ================================================================= */}
        <main className="flex-1 flex gap-4 md:gap-5 h-full min-h-0 overflow-hidden w-full relative z-10" data-purpose="main-content-layout">

          {/* ================================================================= */}
          {/* LEFT PANEL: PURELY CHAT CONVERSATION WORKSPACE */}
          {/* ================================================================= */}
          <motion.section
            layout
            initial={false}
            animate={{
              width: isAnalyticsVisible ? '62%' : '100%',
            }}
            transition={{
              duration: 0.6,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="aichat-visionos-panel rounded-[32px] p-4 sm:p-6 flex flex-col justify-between relative overflow-hidden h-full min-h-0 shrink-0 z-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.95)]"
            data-purpose="pure-chat-workspace"
          >
            {/* Continuous Frosted-Glass S-Wave Lines embedded inside the glass */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
              <svg
                className="w-full h-full object-cover absolute inset-0"
                viewBox="0 0 1600 900"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <defs>
                  {/* Gaussian Blur Filters with ample margins to prevent clipping */}
                  <filter id="frost-blur-ambient" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="26" />
                  </filter>
                  <filter id="frost-blur-broad" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="15" />
                  </filter>
                  <filter id="frost-blur-mid" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="5.5" />
                  </filter>
                  <filter id="frost-blur-core" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.8" />
                  </filter>

                  {/* Left Wave Luminous Frost Gradient */}
                  <linearGradient id="frost-white-left" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                    <stop offset="12%" stopColor="#FFFFFF" stopOpacity="0.90" />
                    <stop offset="22%" stopColor="#FFFFFF" stopOpacity="0.75" />
                    <stop offset="32%" stopColor="#FFFFFF" stopOpacity="0.35" />
                    <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.0" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Right Wave Luminous Frost Gradient (Mirrored) */}
                  <linearGradient id="frost-white-right" x1="100%" y1="0%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                    <stop offset="12%" stopColor="#FFFFFF" stopOpacity="0.90" />
                    <stop offset="22%" stopColor="#FFFFFF" stopOpacity="0.75" />
                    <stop offset="32%" stopColor="#FFFFFF" stopOpacity="0.35" />
                    <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.0" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Left Ambient Fold Shadow (Soft internal glass refraction depth) */}
                  <linearGradient id="frost-shadow-left" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8EA4BF" stopOpacity="0.45" />
                    <stop offset="12%" stopColor="#8EA4BF" stopOpacity="0.38" />
                    <stop offset="22%" stopColor="#9BB0CA" stopOpacity="0.22" />
                    <stop offset="32%" stopColor="#B6C6DA" stopOpacity="0.08" />
                    <stop offset="42%" stopColor="#CBD5E1" stopOpacity="0.0" />
                    <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Right Ambient Fold Shadow (Mirrored) */}
                  <linearGradient id="frost-shadow-right" x1="100%" y1="0%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#8EA4BF" stopOpacity="0.45" />
                    <stop offset="12%" stopColor="#8EA4BF" stopOpacity="0.38" />
                    <stop offset="22%" stopColor="#9BB0CA" stopOpacity="0.22" />
                    <stop offset="32%" stopColor="#B6C6DA" stopOpacity="0.08" />
                    <stop offset="42%" stopColor="#CBD5E1" stopOpacity="0.0" />
                    <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Translucent Feathered Veil Body Gradients */}
                  <linearGradient id="frost-veil-left" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
                    <stop offset="12%" stopColor="#F8FAFC" stopOpacity="0.50" />
                    <stop offset="22%" stopColor="#F1F5F9" stopOpacity="0.25" />
                    <stop offset="34%" stopColor="#E2E8F0" stopOpacity="0.06" />
                    <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.0" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                  </linearGradient>

                  <linearGradient id="frost-veil-right" x1="100%" y1="0%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
                    <stop offset="12%" stopColor="#F8FAFC" stopOpacity="0.50" />
                    <stop offset="22%" stopColor="#F1F5F9" stopOpacity="0.25" />
                    <stop offset="34%" stopColor="#E2E8F0" stopOpacity="0.06" />
                    <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.0" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* ============================================================== */}
                {/* 1. TRANSLUCENT FEATHERED VEILS (Tactile Frosted Glass Volume)  */}
                {/* ============================================================== */}
                <path
                  d="M -30,-30 L 160,-30 C 320,120 400,260 400,440 C 400,620 300,780 140,930 L -30,930 Z"
                  fill="url(#frost-veil-left)"
                  filter="url(#frost-blur-ambient)"
                />
                <path
                  d="M 1630,-30 L 1440,-30 C 1280,120 1200,260 1200,440 C 1200,620 1300,780 1460,930 L 1630,930 Z"
                  fill="url(#frost-veil-right)"
                  filter="url(#frost-blur-ambient)"
                />

                {/* ============================================================== */}
                {/* 2. LEFT FLANK: FLOWING CONTINUOUS S-WAVE LINES                 */}
                {/* ============================================================== */}

                {/* --- Wave 1: Primary Sweeping S-Curve --- */}
                {/* Ambient under-ridge shadow */}
                <path
                  d="M -30,120 C 140,195 280,265 365,365 C 435,455 385,595 275,715 C 185,815 85,885 -30,935"
                  stroke="url(#frost-shadow-left)"
                  strokeWidth="48"
                  strokeLinecap="round"
                  filter="url(#frost-blur-ambient)"
                />
                {/* Broad glowing frosted dispersion */}
                <path
                  d="M -30,110 C 140,190 280,260 360,360 C 430,450 380,590 270,710 C 180,810 80,880 -30,930"
                  stroke="url(#frost-white-left)"
                  strokeWidth="42"
                  strokeLinecap="round"
                  filter="url(#frost-blur-broad)"
                />
                {/* Mid frosted ribbon */}
                <path
                  d="M -30,110 C 140,190 280,260 360,360 C 430,450 380,590 270,710 C 180,810 80,880 -30,930"
                  stroke="url(#frost-white-left)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  filter="url(#frost-blur-mid)"
                />
                {/* Soft feathered specular core spine */}
                <path
                  d="M -30,110 C 140,190 280,260 360,360 C 430,450 380,590 270,710 C 180,810 80,880 -30,930"
                  stroke="url(#frost-white-left)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#frost-blur-core)"
                />

                {/* --- Wave 2: Upper Secondary Flowing Wave --- */}
                <path
                  d="M -30,-5 C 120,75 230,155 295,255 C 345,345 315,445 215,535 C 125,615 35,655 -30,685"
                  stroke="url(#frost-shadow-left)"
                  strokeWidth="36"
                  strokeLinecap="round"
                  filter="url(#frost-blur-ambient)"
                />
                <path
                  d="M -30,-10 C 120,70 230,150 290,250 C 340,340 310,440 210,530 C 120,610 30,650 -30,680"
                  stroke="url(#frost-white-left)"
                  strokeWidth="32"
                  strokeLinecap="round"
                  filter="url(#frost-blur-broad)"
                />
                <path
                  d="M -30,-10 C 120,70 230,150 290,250 C 340,340 310,440 210,530 C 120,610 30,650 -30,680"
                  stroke="url(#frost-white-left)"
                  strokeWidth="11"
                  strokeLinecap="round"
                  filter="url(#frost-blur-mid)"
                />
                <path
                  d="M -30,-10 C 120,70 230,150 290,250 C 340,340 310,440 210,530 C 120,610 30,650 -30,680"
                  stroke="url(#frost-white-left)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#frost-blur-core)"
                />

                {/* --- Wave 3: Lower Counter-Wave --- */}
                <path
                  d="M -30,465 C 130,515 250,575 315,665 C 365,745 325,835 185,895 C 105,925 25,935 -30,935"
                  stroke="url(#frost-shadow-left)"
                  strokeWidth="34"
                  strokeLinecap="round"
                  filter="url(#frost-blur-ambient)"
                />
                <path
                  d="M -30,460 C 130,510 250,570 310,660 C 360,740 320,830 180,890 C 100,920 20,930 -30,930"
                  stroke="url(#frost-white-left)"
                  strokeWidth="30"
                  strokeLinecap="round"
                  filter="url(#frost-blur-broad)"
                />
                <path
                  d="M -30,460 C 130,510 250,570 310,660 C 360,740 320,830 180,890 C 100,920 20,930 -30,930"
                  stroke="url(#frost-white-left)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  filter="url(#frost-blur-mid)"
                />
                <path
                  d="M -30,460 C 130,510 250,570 310,660 C 360,740 320,830 180,890 C 100,920 20,930 -30,930"
                  stroke="url(#frost-white-left)"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  filter="url(#frost-blur-core)"
                />

                {/* ============================================================== */}
                {/* 3. RIGHT FLANK: MIRRORED CONTINUOUS S-WAVE LINES               */}
                {/* ============================================================== */}

                {/* --- Wave 1: Primary Sweeping S-Curve (Mirrored) --- */}
                <path
                  d="M 1630,120 C 1460,195 1320,265 1235,365 C 1165,455 1215,595 1325,715 C 1415,815 1515,885 1630,935"
                  stroke="url(#frost-shadow-right)"
                  strokeWidth="48"
                  strokeLinecap="round"
                  filter="url(#frost-blur-ambient)"
                />
                <path
                  d="M 1630,110 C 1460,190 1320,260 1240,360 C 1170,450 1220,590 1330,710 C 1420,810 1520,880 1630,930"
                  stroke="url(#frost-white-right)"
                  strokeWidth="42"
                  strokeLinecap="round"
                  filter="url(#frost-blur-broad)"
                />
                <path
                  d="M 1630,110 C 1460,190 1320,260 1240,360 C 1170,450 1220,590 1330,710 C 1420,810 1520,880 1630,930"
                  stroke="url(#frost-white-right)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  filter="url(#frost-blur-mid)"
                />
                <path
                  d="M 1630,110 C 1460,190 1320,260 1240,360 C 1170,450 1220,590 1330,710 C 1420,810 1520,880 1630,930"
                  stroke="url(#frost-white-right)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#frost-blur-core)"
                />

                {/* --- Wave 2: Upper Secondary Flowing Wave (Mirrored) --- */}
                <path
                  d="M 1630,-5 C 1480,75 1370,155 1305,255 C 1255,345 1285,445 1385,535 C 1475,615 1565,655 1630,685"
                  stroke="url(#frost-shadow-right)"
                  strokeWidth="36"
                  strokeLinecap="round"
                  filter="url(#frost-blur-ambient)"
                />
                <path
                  d="M 1630,-10 C 1480,70 1370,150 1310,250 C 1260,340 1290,440 1390,530 C 1480,610 1570,650 1630,680"
                  stroke="url(#frost-white-right)"
                  strokeWidth="32"
                  strokeLinecap="round"
                  filter="url(#frost-blur-broad)"
                />
                <path
                  d="M 1630,-10 C 1480,70 1370,150 1310,250 C 1260,340 1290,440 1390,530 C 1480,610 1570,650 1630,680"
                  stroke="url(#frost-white-right)"
                  strokeWidth="11"
                  strokeLinecap="round"
                  filter="url(#frost-blur-mid)"
                />
                <path
                  d="M 1630,-10 C 1480,70 1370,150 1310,250 C 1260,340 1290,440 1390,530 C 1480,610 1570,650 1630,680"
                  stroke="url(#frost-white-right)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#frost-blur-core)"
                />

                {/* --- Wave 3: Lower Counter-Wave (Mirrored) --- */}
                <path
                  d="M 1630,465 C 1470,515 1350,575 1285,665 C 1235,745 1275,835 1415,895 C 1495,925 1575,935 1630,935"
                  stroke="url(#frost-shadow-right)"
                  strokeWidth="34"
                  strokeLinecap="round"
                  filter="url(#frost-blur-ambient)"
                />
                <path
                  d="M 1630,460 C 1470,510 1350,570 1290,660 C 1240,740 1280,830 1420,890 C 1500,920 1580,930 1630,930"
                  stroke="url(#frost-white-right)"
                  strokeWidth="30"
                  strokeLinecap="round"
                  filter="url(#frost-blur-broad)"
                />
                <path
                  d="M 1630,460 C 1470,510 1350,570 1290,660 C 1240,740 1280,830 1420,890 C 1500,920 1580,930 1630,930"
                  stroke="url(#frost-white-right)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  filter="url(#frost-blur-mid)"
                />
                <path
                  d="M 1630,460 C 1470,510 1350,570 1290,660 C 1240,740 1280,830 1420,890 C 1500,920 1580,930 1630,930"
                  stroke="url(#frost-white-right)"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  filter="url(#frost-blur-core)"
                />
              </svg>
            </div>

            <div className="relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Top Header Bar matching Image 2 */}
              <div className="flex-shrink-0 flex items-center justify-between gap-3 mb-2 px-1">
                {/* Left: Frosted Capsule Pill with Dropdown */}
                <div className="relative" ref={sessionDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsSessionDropdownOpen((prev) => !prev)}
                    className="visionos-header-pill flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold text-gray-800 transition cursor-pointer hover:bg-white active:scale-95 shadow-sm"
                  >
                    <span className="text-gray-950 font-black text-xs leading-none">✦</span>
                    <span className="text-gray-900 font-semibold text-xs tracking-tight">
                      {activeTab === 'review' ? 'Q3 Talent & Operations Review' : 'Q3 Talent & Operations Review'}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-gray-500 transition-transform duration-200 ${isSessionDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {isSessionDropdownOpen && (
                    <div className="absolute left-0 top-full mt-2 w-72 p-2 rounded-2xl glass-card border border-white/95 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-2xl bg-white/95">
                      <button
                        type="button"
                        onClick={() => {
                          handleLoadQ3Review();
                          setIsSessionDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition text-left cursor-pointer ${activeTab === 'review' ? 'bg-[#0E1013] text-white' : 'hover:bg-black/5 text-gray-800'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={activeTab === 'review' ? 'text-[#D8F929]' : 'text-gray-500'}>✦</span>
                          <span>Q3 Talent & Operations Review</span>
                        </div>
                        {activeTab === 'review' && <Check size={14} className="text-[#D8F929]" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleNewChat();
                          setIsSessionDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition text-left cursor-pointer mt-1 ${activeTab === 'new' ? 'bg-[#0E1013] text-white' : 'hover:bg-black/5 text-gray-800'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <Plus size={14} />
                          <span>New Conversation</span>
                        </div>
                        {activeTab === 'new' && <Check size={14} className="text-[#D8F929]" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Right: 2 Frosted Circular Buttons */}
                <div className="flex items-center gap-2.5">
                  {/* Settings Sliders Circle Button */}
                  <div className="relative" ref={settingsMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen((prev) => !prev)}
                      className={`visionos-circle-btn w-9.5 h-9.5 rounded-full flex items-center justify-center transition cursor-pointer hover:bg-white hover:scale-105 active:scale-95 ${isSettingsOpen ? 'bg-white shadow-sm text-gray-950 ring-2 ring-black/5' : 'text-gray-700'
                        }`}
                      title="Voice & AI Settings"
                    >
                      <SlidersHorizontal size={15} />
                    </button>

                    {/* Voice & AI Settings Popover */}
                    {isSettingsOpen && (
                      <div className="absolute right-0 top-full mt-2 w-80 p-4 rounded-2xl glass-card border border-white/90 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-2xl bg-white/95">
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/[0.08]">
                          <div className="flex items-center gap-2">
                            <SlidersHorizontal size={14} className="text-[#899c08]" />
                            <span className="text-xs font-black text-gray-950 uppercase tracking-wider">Settings & Output</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsSettingsOpen(false)}
                            className="w-6 h-6 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="space-y-3.5 text-xs">
                          {/* Platform Analytics Display Toggle */}
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/60 border border-white/80">
                            <div className="space-y-0.5 pr-2">
                              <div className="font-extrabold text-gray-900 flex items-center gap-1.5">
                                <span>📊</span>
                                <span>Platform Analytics</span>
                              </div>
                              <p className="text-[10px] text-gray-500">Show data panel & charts</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAnalyticsVisible((prev) => !prev);
                              }}
                              className={`px-3 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${isAnalyticsVisible
                                ? 'bg-[#111417] text-[#D8F929]'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                              {isAnalyticsVisible ? 'Visible' : 'Hidden'}
                            </button>
                          </div>

                          {/* Silero VAD Continuous Voice Toggle */}
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/60 border border-white/80">
                            <div className="space-y-0.5 pr-2">
                              <div className="font-extrabold text-gray-900 flex items-center gap-1.5">
                                <Radio size={12} className={continuousMode ? 'text-[#899c08] animate-pulse' : 'text-gray-400'} />
                                <span>Hands-Free VAD</span>
                              </div>
                              <p className="text-[10px] text-gray-500">Autonomous voice detection</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = !continuousMode;
                                setContinuousMode(nextVal);
                                continuousModeRef.current = nextVal;
                                if (nextVal) {
                                  setVadStatus('listening');
                                  try { vad.start(); } catch (e) { }
                                  showToast('🟢 Hands-Free Voice Agent Activated');
                                } else {
                                  setVadStatus('idle');
                                  try { vad.pause(); } catch (e) { }
                                  showToast('⚪ Hands-Free Voice Agent Paused');
                                }
                              }}
                              className={`px-3 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${continuousMode
                                ? 'bg-[#111417] text-[#D8F929] border border-[#D8F929]'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                              {continuousMode ? 'Active' : 'Off'}
                            </button>
                          </div>

                          {/* Voice Audio Playback Toggle */}
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/60 border border-white/80">
                            <div className="space-y-0.5 pr-2">
                              <div className="font-extrabold text-gray-900 flex items-center gap-1.5">
                                {voiceEnabled ? <Volume2 size={13} className="text-emerald-600" /> : <VolumeX size={13} className="text-gray-400" />}
                                <span>Spoken Voice Output</span>
                              </div>
                              <p className="text-[10px] text-gray-500">Read AI responses aloud</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const nextState = !voiceEnabled;
                                setVoiceEnabled(nextState);
                                showToast(nextState ? 'Sarvam Voice TTS Active' : 'Sarvam Voice TTS Muted');
                              }}
                              className={`px-3 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${voiceEnabled
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                              {voiceEnabled ? 'Enabled' : 'Muted'}
                            </button>
                          </div>

                          {/* Speaker Voice Selection */}
                          <div className="space-y-1 p-2.5 rounded-xl bg-white/60 border border-white/80">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Speaker Voice</div>
                            <select
                              value={selectedSpeaker}
                              onChange={(e) => setSelectedSpeaker(e.target.value)}
                              className="w-full bg-white/90 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#899c08] cursor-pointer"
                            >
                              {SARVAM_SPEAKERS.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Speech Pace Selection */}
                          <div className="space-y-1 p-2.5 rounded-xl bg-white/60 border border-white/80">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Speech Speed</div>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { pace: 1.0, label: '1.0x' },
                                { pace: 1.25, label: '1.25x' },
                                { pace: 1.4, label: '1.4x' }
                              ].map((item) => (
                                <button
                                  key={item.pace}
                                  type="button"
                                  onClick={() => setSpeechPace(item.pace)}
                                  className={`py-1 rounded-lg text-[11px] font-bold transition cursor-pointer text-center ${speechPace === item.pace
                                    ? 'bg-[#111417] text-[#D8F929] border border-[#D8F929]'
                                    : 'bg-white/90 text-gray-600 border border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Sync Live HRMS */}
                          <div className="pt-2 border-t border-black/[0.06] flex items-center justify-between">
                            <span className="text-[10.5px] font-bold text-gray-500">Live Database Health</span>
                            <button
                              type="button"
                              onClick={handleSyncHRMS}
                              disabled={isSyncing}
                              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/80 hover:bg-white text-gray-700 text-[11px] font-bold border border-white/90 shadow-2xs transition cursor-pointer"
                            >
                              <RefreshCw size={12} className={isSyncing ? 'animate-spin text-[#899c08]' : ''} />
                              <span>{isSyncing ? 'Syncing...' : 'Sync HRMS'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Audio Waveform Circle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextState = !voiceEnabled;
                      setVoiceEnabled(nextState);
                      showToast(nextState ? 'Audio Output Enabled' : 'Audio Output Muted');
                    }}
                    className={`visionos-circle-btn w-9.5 h-9.5 rounded-full flex items-center justify-center transition cursor-pointer hover:bg-white hover:scale-105 active:scale-95 ${voiceEnabled ? 'text-gray-900 bg-white/95' : 'text-gray-400'
                      }`}
                    title={voiceEnabled ? 'Mute AI Audio Speech' : 'Enable AI Audio Speech'}
                  >
                    <AudioLines size={16} className={isPlayingAudio ? 'animate-pulse text-emerald-600' : ''} />
                  </button>
                </div>
              </div>

              {/* Middle Section: Image 2 Hero OR Chat Message Stream */}
              {messages.length === 1 && (messages[0]?.id === 'welcome-init' || messages[0]?.isWelcome) ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-6 select-none animate-in fade-in duration-300">
                  {/* 3D Glass AI Orb with floating animation */}
                  <div className="relative mb-5 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-white/90 blur-2xl scale-125 opacity-80 pointer-events-none" />
                    <img
                      src="/glass_ai_orb.png"
                      alt="AI Copilot Orb"
                      className="w-28 h-28 sm:w-32 sm:h-32 object-contain relative z-10 mix-blend-multiply drop-shadow-xl animate-orb-float pointer-events-none"
                    />
                  </div>

                  {/* Greeting Title */}
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0D0E12] tracking-tight">
                    Hi {(messages[0]?.userName || user?.name || 'Alex').split(' ')[0]}!
                  </h1>

                  {/* Subtitle */}
                  <p className="text-base sm:text-lg font-medium text-gray-600 mt-2">
                    I’m your Enterprise HR Copilot.
                  </p>

                  {/* Suggestion Prompts */}
                  <p className="text-xs sm:text-sm text-gray-400 mt-3 max-w-md mx-auto leading-relaxed">
                    Ask anything about{' '}
                    <span
                      onClick={() => handleSend('Show me hiring pipeline status and requisition breakdown')}
                      className="text-gray-700 font-medium hover:underline cursor-pointer transition-colors"
                      title="Click to ask about hiring pipeline"
                    >
                      hiring pipeline
                    </span>
                    ,{' '}
                    <span
                      onClick={() => handleSend('Analyze team velocity and productivity metrics')}
                      className="text-gray-700 font-medium hover:underline cursor-pointer transition-colors"
                      title="Click to ask about team velocity"
                    >
                      team velocity
                    </span>
                    , or{' '}
                    <span
                      onClick={() => handleSend('Report on workforce health, attendance, and team status')}
                      className="text-gray-700 font-medium hover:underline cursor-pointer transition-colors"
                      title="Click to ask about workforce health"
                    >
                      workforce health
                    </span>
                    .
                  </p>
                </div>
              ) : (
                <div
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto min-h-0 pt-8 pb-4 pr-1 space-y-4 scrollbar-thin overscroll-contain"
                >
                  {messages
                    .filter((msg) => !msg.isWelcome && msg.id !== 'welcome-init')
                    .map((msg) => {
                      if (msg.role === 'user') {
                        return (
                          <div key={msg.id} className="flex justify-end items-start py-1 px-1 my-1 mt-2 animate-in fade-in duration-300">
                            {/* User Chat Text with high background removed */}
                            <div className="text-gray-950 font-semibold text-[14px] sm:text-[15px] leading-relaxed max-w-[85%] px-2 py-1">
                              {msg.content}
                            </div>
                          </div>
                        );
                      }

                      const rawText = cleanReplyText(msg.points?.[0]?.text || msg.content || '');

                      return (
                        <div key={msg.id} className="flex items-start gap-3 py-2 px-1 my-1 animate-in fade-in duration-300">
                          {/* AI Profile Photo matching /ai-copilot-avatar.jpg */}
                          <div className="relative shrink-0 mt-0.5" title="Enterprise AI Copilot">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-white/90 shadow-sm relative flex items-center justify-center bg-black select-none ring-1 ring-black/5">
                              <img
                                src="/ai-copilot-avatar.jpg"
                                alt="Enterprise AI Copilot"
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#D8F929] rounded-tl border border-white/40"></span>
                            </div>
                          </div>

                          {/* Clean, unboxed response text with compact typography */}
                          <div className="flex-1 min-w-0 text-gray-900 text-[13px] sm:text-[13.5px] leading-relaxed font-normal space-y-1">
                            {msg.heading && (
                              <div className="font-extrabold text-gray-950 text-[13.5px] sm:text-[14px] tracking-tight">
                                {msg.heading}
                              </div>
                            )}

                            {rawText && (
                              <div
                                className="prose prose-sm max-w-none text-gray-900 font-sans text-[13px] sm:text-[13.5px] leading-relaxed"
                                dangerouslySetInnerHTML={{
                                  __html: marked.parse(rawText)
                                }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {loading && (
                    <div className="flex items-center gap-3 py-2 px-1 text-xs font-semibold text-gray-700 animate-pulse">
                      <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/90 shadow-2xs relative flex items-center justify-center bg-black shrink-0">
                        <img
                          src="/ai-copilot-avatar.jpg"
                          alt="AI Copilot"
                          className="w-full h-full object-cover opacity-85"
                        />
                        <span className="absolute bottom-0 right-0 w-2 h-2 bg-[#D8F929] rounded-tl border border-white/40"></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#899c08] animate-ping"></span>
                        <span>Reviewing enterprise platform data...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Bottom Floating Glass Capsule Input Dock matching Image 2 */}
            <div className="flex-shrink-0 w-full max-w-2xl mx-auto px-2 sm:px-4 pb-2 pt-2 relative z-20 mt-auto">
              {/* Sleek Floating Status Pill when Voice Mode or STT is active */}
              {continuousMode ? (
                <div className="mb-2 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-gray-950/90 text-white border border-gray-800/80 shadow-lg backdrop-blur-md">
                    {vadStatus === 'listening' && (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-emerald-400 font-bold text-[11px]">Listening naturally...</span>
                        <span className="text-gray-400 text-[10px] hidden sm:inline">(Speak anytime or click mic to stop)</span>
                      </>
                    )}
                    {vadStatus === 'user_speaking' && (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        <span className="text-blue-300 font-bold text-[11px]">Hearing your voice...</span>
                        <span className="text-gray-400 text-[10px] hidden sm:inline">(Silero VAD active)</span>
                      </>
                    )}
                    {vadStatus === 'transcribing' && (
                      <>
                        <RefreshCw size={11} className="animate-spin text-amber-400" />
                        <span className="text-amber-300 font-bold text-[11px]">Processing speech...</span>
                      </>
                    )}
                    {vadStatus === 'ai_speaking' && (
                      <>
                        <Volume2 size={12} className="animate-bounce text-purple-400" />
                        <span className="text-purple-300 font-bold text-[11px]">Assistant speaking...</span>
                        <span className="text-gray-400 text-[10px] hidden sm:inline">(Speak to interrupt)</span>
                      </>
                    )}
                    {vadStatus === 'idle' && (
                      <span className="text-gray-400 text-[11px]">Voice standby</span>
                    )}

                    {lastSttText && vadStatus !== 'transcribing' && (
                      <span className="text-gray-400 text-[10px] italic truncate max-w-[140px] sm:max-w-[200px] border-l border-gray-700 pl-2">
                        "{lastSttText}"
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleToggleVoiceMode}
                      className="ml-1 p-0.5 rounded-full hover:bg-white/20 text-gray-400 hover:text-white transition cursor-pointer"
                      title="Stop Voice Mode"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ) : (lastSttText || isRecording || isTranscribing) && (
                <div className="mb-2 flex items-center justify-center gap-2 animate-in fade-in duration-150">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-bold bg-[#0D0E12] text-white shadow-md">
                    {isRecording && (
                      <>
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                        <span>Recording audio... speak now</span>
                      </>
                    )}
                    {isTranscribing && (
                      <>
                        <RefreshCw size={11} className="animate-spin text-amber-400" />
                        <span>Transcribing spoken audio...</span>
                      </>
                    )}
                    {!isRecording && !isTranscribing && lastSttText && (
                      <>
                        <span className="text-[#D8F929]">🎙️</span>
                        <span className="truncate max-w-[260px]">"{lastSttText}"</span>
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* Floating Pill Capsule Dock matching Image 2 */}
              <div className="visionos-input-capsule rounded-full pl-4 pr-1.5 py-1.5 flex items-center gap-3 transition-all duration-200">
                {/* Left Shield Icon */}
                <div className="text-gray-400 shrink-0 flex items-center justify-center pl-0.5">
                  <Shield size={18} className="stroke-[1.75]" />
                </div>

                {/* Input Text Box */}
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    continuousMode
                      ? vadStatus === 'listening'
                        ? "🎙️ Conversational voice active (Speak naturally or click mic to stop)..."
                        : vadStatus === 'user_speaking'
                          ? "🗣️ Hearing you speak..."
                          : vadStatus === 'ai_speaking'
                            ? "🔊 Assistant speaking (Speak to interrupt)..."
                            : vadStatus === 'transcribing'
                              ? "⚡ Transcribing spoken audio..."
                              : "Voice agent active..."
                      : isRecording
                        ? "🔴 Recording active... Speak now!"
                        : isTranscribing
                          ? "⚡ Transcribing spoken audio..."
                          : "Ask SuperAdmin AI..."
                  }
                  className="flex-1 bg-transparent text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 placeholder:font-normal font-normal focus:outline-none py-1"
                />

                {/* Right Controls: Mic + Send */}
                <div className="flex items-center gap-1.5 shrink-0 pr-0.5">
                  {/* Mic Button: Conversational Full-Duplex Voice Mode Toggle */}
                  {continuousMode ? (
                    <button
                      type="button"
                      onClick={handleToggleVoiceMode}
                      className={`relative w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition shadow-md cursor-pointer hover:scale-105 active:scale-95 group ${vadStatus === 'ai_speaking'
                          ? 'bg-purple-600 hover:bg-rose-600 text-white'
                          : vadStatus === 'user_speaking'
                            ? 'bg-blue-600 hover:bg-rose-600 text-white'
                            : 'bg-emerald-600 hover:bg-rose-600 text-white'
                        }`}
                      title={
                        vadStatus === 'ai_speaking'
                          ? "AI Speaking — Click to stop voice or speak to interrupt"
                          : "Voice Active — Click to stop conversation"
                      }
                    >
                      {/* Pulsing ring indicator */}
                      <span className={`absolute inset-0 rounded-full animate-ping opacity-35 ${vadStatus === 'ai_speaking' ? 'bg-purple-400' : vadStatus === 'user_speaking' ? 'bg-blue-400' : 'bg-emerald-400'
                        }`}></span>

                      {vadStatus === 'ai_speaking' ? (
                        <>
                          <Volume2 size={16} className="animate-bounce relative z-10 block group-hover:hidden" />
                          <MicOff size={15} className="relative z-10 hidden group-hover:block" />
                        </>
                      ) : (
                        <>
                          <Radio size={15} className="relative z-10 block group-hover:hidden animate-pulse" />
                          <MicOff size={15} className="relative z-10 hidden group-hover:block" />
                        </>
                      )}
                    </button>
                  ) : isRecording ? (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm animate-pulse flex items-center justify-center cursor-pointer"
                      title="Click to stop recording"
                    >
                      <MicOff size={15} />
                    </button>
                  ) : isTranscribing ? (
                    <button
                      type="button"
                      disabled
                      className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-sm"
                      title="Transcribing speech..."
                    >
                      <RefreshCw size={14} className="animate-spin" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleToggleVoiceMode}
                      className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full text-gray-600 hover:text-black hover:bg-black/5 transition flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
                      title="Start Conversational Voice Agent (Click to speak naturally)"
                    >
                      <Mic size={18} />
                    </button>
                  )}

                  {/* Send Button: Solid Black Circle with White Send Icon */}
                  <button
                    type="button"
                    disabled={!input.trim() || loading}
                    onClick={() => handleSend()}
                    className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-[#0E1013] hover:bg-black text-white transition shadow-md disabled:opacity-35 cursor-pointer flex items-center justify-center shrink-0 hover:scale-105 active:scale-95"
                    title="Send message"
                  >
                    {loading ? (
                      <RefreshCw size={13} className="animate-spin text-white" />
                    ) : (
                      <Send size={14} className="ml-0.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ================================================================= */}
          {/* RIGHT PANEL: DYNAMIC INTERACTIVE DISPLAY & OUTPUT WORKSPACE */}
          {/* ================================================================= */}
          <AnimatePresence>
            {isAnalyticsVisible && (
              <motion.section
                key="interactive-output-display"
                initial={{
                  opacity: 0,
                  x: 70,
                  scale: 0.975,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  x: 70,
                  scale: 0.975,
                }}
                transition={{
                  duration: 0.6,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{ originX: 1, originY: 0.5 }}
                className="flex-1 min-w-0 aichat-visionos-panel rounded-[32px] p-4 sm:p-6 flex flex-col justify-between relative overflow-hidden h-full min-h-0 z-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.95)]"
                data-purpose="interactive-output-display"
              >
                {/* Continuous Frosted-Glass S-Wave Lines embedded inside the glass */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
                  <svg
                    className="w-full h-full object-cover absolute inset-0"
                    viewBox="0 0 1600 900"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <filter id="frost-blur-ambient-rp" x="-40%" y="-40%" width="180%" height="180%">
                        <feGaussianBlur stdDeviation="26" />
                      </filter>
                      <filter id="frost-blur-broad-rp" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="15" />
                      </filter>
                      <filter id="frost-blur-mid-rp" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="5.5" />
                      </filter>
                      <filter id="frost-blur-core-rp" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="1.8" />
                      </filter>

                      <linearGradient id="frost-white-left-rp" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                        <stop offset="12%" stopColor="#FFFFFF" stopOpacity="0.90" />
                        <stop offset="22%" stopColor="#FFFFFF" stopOpacity="0.75" />
                        <stop offset="32%" stopColor="#FFFFFF" stopOpacity="0.35" />
                        <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.0" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                      </linearGradient>

                      <linearGradient id="frost-white-right-rp" x1="100%" y1="0%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                        <stop offset="12%" stopColor="#FFFFFF" stopOpacity="0.90" />
                        <stop offset="22%" stopColor="#FFFFFF" stopOpacity="0.75" />
                        <stop offset="32%" stopColor="#FFFFFF" stopOpacity="0.35" />
                        <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.0" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                      </linearGradient>

                      <linearGradient id="frost-shadow-left-rp" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#8EA4BF" stopOpacity="0.45" />
                        <stop offset="12%" stopColor="#8EA4BF" stopOpacity="0.38" />
                        <stop offset="22%" stopColor="#9BB0CA" stopOpacity="0.22" />
                        <stop offset="32%" stopColor="#B6C6DA" stopOpacity="0.08" />
                        <stop offset="42%" stopColor="#CBD5E1" stopOpacity="0.0" />
                        <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.0" />
                      </linearGradient>

                      <linearGradient id="frost-shadow-right-rp" x1="100%" y1="0%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor="#8EA4BF" stopOpacity="0.45" />
                        <stop offset="12%" stopColor="#8EA4BF" stopOpacity="0.38" />
                        <stop offset="22%" stopColor="#9BB0CA" stopOpacity="0.22" />
                        <stop offset="32%" stopColor="#B6C6DA" stopOpacity="0.08" />
                        <stop offset="42%" stopColor="#CBD5E1" stopOpacity="0.0" />
                        <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.0" />
                      </linearGradient>

                      <linearGradient id="frost-veil-left-rp" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
                        <stop offset="12%" stopColor="#F8FAFC" stopOpacity="0.50" />
                        <stop offset="22%" stopColor="#F1F5F9" stopOpacity="0.25" />
                        <stop offset="34%" stopColor="#E2E8F0" stopOpacity="0.06" />
                        <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.0" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                      </linearGradient>

                      <linearGradient id="frost-veil-right-rp" x1="100%" y1="0%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
                        <stop offset="12%" stopColor="#F8FAFC" stopOpacity="0.50" />
                        <stop offset="22%" stopColor="#F1F5F9" stopOpacity="0.25" />
                        <stop offset="34%" stopColor="#E2E8F0" stopOpacity="0.06" />
                        <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.0" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Veils */}
                    <path d="M -30,-30 L 160,-30 C 320,120 400,260 400,440 C 400,620 300,780 140,930 L -30,930 Z" fill="url(#frost-veil-left-rp)" filter="url(#frost-blur-ambient-rp)" />
                    <path d="M 1630,-30 L 1440,-30 C 1280,120 1200,260 1200,440 C 1200,620 1300,780 1460,930 L 1630,930 Z" fill="url(#frost-veil-right-rp)" filter="url(#frost-blur-ambient-rp)" />

                    {/* Left S-Wave */}
                    <path d="M -30,120 C 140,195 280,265 365,365 C 435,455 385,595 275,715 C 185,815 85,885 -30,935" stroke="url(#frost-shadow-left-rp)" strokeWidth="48" strokeLinecap="round" filter="url(#frost-blur-ambient-rp)" />
                    <path d="M -30,110 C 140,190 280,260 360,360 C 430,450 380,590 270,710 C 180,810 80,880 -30,930" stroke="url(#frost-white-left-rp)" strokeWidth="42" strokeLinecap="round" filter="url(#frost-blur-broad-rp)" />
                    <path d="M -30,110 C 140,190 280,260 360,360 C 430,450 380,590 270,710 C 180,810 80,880 -30,930" stroke="url(#frost-white-left-rp)" strokeWidth="14" strokeLinecap="round" filter="url(#frost-blur-mid-rp)" />
                    <path d="M -30,110 C 140,190 280,260 360,360 C 430,450 380,590 270,710 C 180,810 80,880 -30,930" stroke="url(#frost-white-left-rp)" strokeWidth="3.5" strokeLinecap="round" filter="url(#frost-blur-core-rp)" />

                    {/* Right S-Wave */}
                    <path d="M 1630,120 C 1460,195 1320,265 1235,365 C 1165,455 1215,595 1325,715 C 1415,815 1515,885 1630,935" stroke="url(#frost-shadow-right-rp)" strokeWidth="48" strokeLinecap="round" filter="url(#frost-blur-ambient-rp)" />
                    <path d="M 1630,110 C 1460,190 1320,260 1240,360 C 1170,450 1220,590 1330,710 C 1420,810 1520,880 1630,930" stroke="url(#frost-white-right-rp)" strokeWidth="42" strokeLinecap="round" filter="url(#frost-blur-broad-rp)" />
                    <path d="M 1630,110 C 1460,190 1320,260 1240,360 C 1170,450 1220,590 1330,710 C 1420,810 1520,880 1630,930" stroke="url(#frost-white-right-rp)" strokeWidth="14" strokeLinecap="round" filter="url(#frost-blur-mid-rp)" />
                    <path d="M 1630,110 C 1460,190 1320,260 1240,360 C 1170,450 1220,590 1330,710 C 1420,810 1520,880 1630,930" stroke="url(#frost-white-right-rp)" strokeWidth="3.5" strokeLinecap="round" filter="url(#frost-blur-core-rp)" />
                  </svg>
                </div>

                <div className="relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* DYNAMIC CANVAS CONTENT */}
                  <div className="flex-1 overflow-y-auto min-h-0 pr-1 py-1 scrollbar-thin">
                    {activeWidget ? (
                      <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/[0.06]">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                            <span className="text-[11px] font-extrabold text-gray-800 tracking-wide uppercase">AI Interactive Display</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveWidget(null)}
                            className="w-7 h-7 rounded-full bg-white/80 hover:bg-white border border-white/90 shadow-2xs flex items-center justify-center transition cursor-pointer text-gray-500 hover:text-black active:scale-95"
                            title="Close Display"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        {activeWidget.type === 'password_change_confirm' && (
                          <PasswordChangeConfirmWidget data={activeWidget.data} onSendMessage={(txt) => handleSend(txt)} />
                        )}

                        {activeWidget.type === 'password_updated_success' && (
                          <PasswordUpdatedSuccessWidget data={activeWidget.data} onSendMessage={(txt) => handleSend(txt)} />
                        )}

                        {activeWidget.type === 'tenant_delete_confirm' && (
                          <TenantDeleteConfirmWidget data={activeWidget.data} onSendMessage={(txt) => handleSend(txt)} />
                        )}

                        {activeWidget.type === 'tenant_deleted_success' && (
                          <TenantDeletedSuccessWidget data={activeWidget.data} onSendMessage={(txt) => handleSend(txt)} />
                        )}

                        {activeWidget.type === 'tenant_console' && (
                          <TenantConsoleWidget
                            tenants={activeWidget.data}
                            onSendMessage={(txt) => handleSend(txt)}
                            onCopy={copyToClipboard}
                          />
                        )}

                        {activeWidget.type === 'admin_accounts' && (
                          <AdminAccountsWidget users={activeWidget.data} onCopy={copyToClipboard} />
                        )}

                        {activeWidget.type === 'platform_metrics' && (
                          <PlatformMetricsWidget stats={activeWidget.data} onSendMessage={(txt) => handleSend(txt)} />
                        )}

                        {activeWidget.type === 'onboard_draft' && (
                          <OnboardingDraftPreviewWidget draft={activeWidget.data} onSendMessage={(txt) => handleSend(txt)} />
                        )}

                        {activeWidget.type === 'onboard_success' && (
                          <OnboardingSuccessWidget
                            data={activeWidget.data}
                            onSendMessage={(txt) => handleSend(txt)}
                            onCopy={copyToClipboard}
                          />
                        )}

                        {activeWidget.type === 'requisitions_console' && (
                          <RequisitionsConsoleWidget
                            requisitions={activeWidget.data}
                            vendorName={activeWidget.vendorName}
                            onSendMessage={(txt) => handleSend(txt)}
                          />
                        )}

                        {activeWidget.type === 'candidates_console' && (
                          <CandidatesConsoleWidget
                            candidates={activeWidget.data}
                            vendorName={activeWidget.vendorName}
                            onSendMessage={(txt) => handleSend(txt)}
                            onCopy={copyToClipboard}
                          />
                        )}

                        {activeWidget.type === 'candidate_resume' && (
                          <CandidateResumeWidget
                            data={activeWidget.data}
                            onSendMessage={(txt) => handleSend(txt)}
                            onCopy={copyToClipboard}
                          />
                        )}

                        {activeWidget.type === 'database_controller' && (
                          <DatabaseControllerWidget
                            dbData={activeWidget.data}
                            onSendMessage={(txt) => handleSend(txt)}
                            onCopy={copyToClipboard}
                          />
                        )}

                      </div>
                    ) : (
                      <StatisticalDashboardWidget
                        onSendMessage={(txt) => handleSend(txt)}
                        onClose={() => setIsAnalyticsVisible(false)}
                      />
                    )}
                  </div>
                </div>

              </motion.section>
            )}
          </AnimatePresence>

        </main>
      </div>
    </div>
  );
}
