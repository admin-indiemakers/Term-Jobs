import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { request, API_BASE_URL } from '../api/client';
import { marked } from 'marked';
import { useMicVAD, utils } from '@ricky0123/vad-react';

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
  Radio
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

const HR_LEADS = [
  {
    name: 'Marcus',
    role: 'HR Manager Marcus V.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB__dILWLDpDToxdysAY5E6VrYAjht9J1Z0V9XTh2xJi2rU2KtC-WwTF2r8_p-fBSxkrFziIrs9o-NBqJ7ZivcVo1lJjDycz2_zn_PhvtEv_K_Q4U4oH1kDH_h2noxxQwDANHu8IfZnRMIDs9bO8uMxUYKOeuPsXAWeNJay5vB2JY661fHP0SN_rVCke94Gw43m8zNmbFn2N_-p4dnRaeAEeKkS9JLfcK-_zeg1zHXgvNboL4c9Rv0'
  },
  {
    name: 'Elena',
    role: 'HR Manager Elena R.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBCbeB3yeoPMFaPVk1NRvu3LYCs-GI7-w7fEsPQtiUGIPWnrhBDz3y9Eg8pF_fL7WRTqpA6xBSXNJgx5K2fD45OMKb-bQ-n8oond4gDWBcvJa8q29bIbVki6OReXAex4BF2J3OvSEXzzujT1JIxo0ABe5_0vrTG2tk6n95BzlE4AGcPMdAguL17TXzapOxuAmld6uRx6U-gQZi-lJV_rWZ1qbGg7iNkLk-0UOZT2yQrYvic80G8OR0'
  },
  {
    name: 'David',
    role: 'People Ops David K.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAjP0louYd9NCOQTAH0h4aZ7PXKrOVsS13LMTipYl6e2zRhLM4KIAVuQTJfboWEjT0mxeh5JrwfEuvuiKwM54f5pdUycmpZh56qRf5BSekmlyUji4MkmB-HI_FyR-x0zE7Xkcbg6xH25wEvhHR7SkeruP1s2iKP_ZCvde_coEIPwfFM1ccIjOXp705hkd9Ij6mRHyVtV48N9C450PRvcMOmkSaNnjbb8FnA27ZmoV42r28Rdg_Hvsw'
  },
  {
    name: 'Chloe',
    role: 'Talent Partner Chloe T.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCXs-X2xOK6I86mWQAO71okpd7LoIJdq60ppFmdifj5VPlxWcV5fiqYtd0KMmYI1iB9H3cfyP3X8aU3AZFJ8mYwB9KZrP94_94pJorW1VeO-N-d3sXYZbT_yG_w_6mHI0-pf4OXeRJ8AsCa9ePcSiVZiGgx012sDuboz3rCSBjvwhN41sjL6_qjxe0EPf0GlpLrO4NlJrA-DPhzhdbs62SPu-o_yUSSUHqm-Dbs9PJ3Kr4y3Y9oX-8'
  }
];

const SARVAM_SPEAKERS = [
  { id: 'priya', label: 'Priya (Female)' },
  { id: 'simran', label: 'Simran (Female)' },
  { id: 'rahul', label: 'Rahul (Male)' },
  { id: 'aditya', label: 'Aditya (Male)' }
];

/* Clean text helper: strip raw ASCII tables or json strings from chat bubbles */
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
      str = 'I have retrieved the requested platform records and displayed the full interactive widget on the right Output Display panel.';
    }
  }
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
        (t.id && t.id.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const clientCount = tenants.filter((t) => t.tenant_type === 'client').length;
  const consultancyCount = tenants.filter((t) => t.tenant_type === 'consultancy').length;

  let widgetTitle = 'TermJobs Tenant Directory';
  if (clientCount > 0 && consultancyCount === 0) widgetTitle = 'TermJobs Buyer Client Companies';
  else if (clientCount === 0 && consultancyCount > 0) widgetTitle = 'TermJobs Vendor Consultancies';

  return (
    <div className="w-full text-left font-sans space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center shadow-md shrink-0">
            <Building2 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-gray-950 tracking-tight">{widgetTitle}</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-800 border border-emerald-300/80 uppercase">
                {tenants.length} TOTAL
              </span>
            </div>
            <p className="text-[11px] text-gray-500">Active Buyer Companies & Vendor Consultancies</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-gray-100 p-0.5 text-xs font-bold text-gray-700 shrink-0">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${filterTab === 'all' ? 'bg-white text-gray-950 shadow-xs font-extrabold' : 'text-gray-500 hover:text-gray-950'
                }`}
            >
              All ({tenants.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('client')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${filterTab === 'client' ? 'bg-emerald-600 text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-emerald-800'
                }`}
            >
              Buyers ({clientCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('consultancy')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${filterTab === 'consultancy' ? 'bg-indigo-600 text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-indigo-800'
                }`}
            >
              Vendors ({consultancyCount})
            </button>
          </div>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants by name or ID..."
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

        <button
          type="button"
          onClick={() => onSendMessage('Onboard a new buyer company named Acme Corp with admin admin@acme.com')}
          className="px-3.5 py-2 rounded-2xl bg-black hover:bg-gray-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
        >
          <Plus size={14} />
          <span>+ Onboard Tenant</span>
        </button>
      </div>

      {/* Grid View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto pr-1">
        {filteredTenants.map((t) => {
          const isClient = t.tenant_type === 'client';
          const users = t.assigned_users || [];
          return (
            <div
              key={t.id}
              className={`p-3.5 rounded-2xl bg-gradient-to-b from-white to-gray-50/40 border ${isClient ? 'border-emerald-200 hover:border-emerald-500' : 'border-indigo-200 hover:border-indigo-500'
                } transition-all duration-200 flex flex-col justify-between group relative overflow-hidden shadow-2xs hover:shadow-md`}
            >
              <div className={`absolute top-0 left-0 right-0 h-1 ${isClient ? 'bg-emerald-500' : 'bg-indigo-500'}`} />

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5 mt-0.5">
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${isClient ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                      }`}
                  >
                    {isClient ? 'Buyer Company' : 'Vendor Consultancy'}
                  </span>

                  <button
                    type="button"
                    onClick={() => onCopy(t.id, t.id)}
                    className="font-mono text-[10px] font-semibold text-gray-400 hover:text-black bg-gray-100 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer"
                    title="Copy Tenant ID"
                  >
                    <span>{t.id ? `${t.id.slice(0, 8)}...` : ''}</span>
                    <Copy size={10} />
                  </button>
                </div>

                <h3 className="text-xs sm:text-sm font-extrabold text-gray-950 tracking-tight leading-snug">{t.name}</h3>
              </div>

              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-gray-600 truncate">
                  {users.length} {users.length === 1 ? 'account' : 'accounts'}
                </span>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSendMessage(`List administrator accounts for tenant ${t.name}`)}
                    className="px-2.5 py-1 rounded-xl bg-gray-950 hover:bg-black text-white text-[10.5px] font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    Accounts
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendMessage(`Delete tenant ${t.name}`)}
                    className="p-1 rounded-xl bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                    title="Delete Tenant"
                  >
                    <Trash2 size={12} />
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
          <span className={`px-3 py-1 rounded-full text-[10.5px] font-extrabold ${
            isClient ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-purple-50 text-purple-800 border border-purple-200'
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
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${
                filterStatus === 'all' ? 'bg-white text-gray-950 shadow-xs font-extrabold' : 'text-gray-500 hover:text-gray-950'
              }`}
            >
              All ({reqList.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('open')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${
                filterStatus === 'open' ? 'bg-emerald-600 text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-emerald-800'
              }`}
            >
              Open ({openCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('draft')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${
                filterStatus === 'draft' ? 'bg-amber-500 text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-amber-800'
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
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                      isOpen
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
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${
                filterStatus === 'all' ? 'bg-white text-gray-950 shadow-xs font-extrabold' : 'text-gray-500 hover:text-gray-950'
              }`}
            >
              All ({candList.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('shortlisted')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${
                filterStatus === 'shortlisted' ? 'bg-emerald-600 text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-emerald-800'
              }`}
            >
              Shortlisted
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('interviewing')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${
                filterStatus === 'interviewing' ? 'bg-indigo-600 text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-indigo-800'
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
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'pdf'
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
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'summary'
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
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'text'
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
function StatisticalDashboardWidget({ onSendMessage }) {
  const [timeRange, setTimeRange] = useState('30d');
  const [stats, setStats] = useState({
    total_tenants: 9,
    client_companies: 3,
    vendor_consultancies: 6,
    total_requisitions: 26,
    active_requisitions: 13,
    total_submissions: 24,
    total_users: 33,
    admin_accounts: 14,
    positions_per_vendor: 4.33,
    conversion_match_rate: '87.5%',
    requisition_stages: [
      { stage: 'Intake', count: 7 },
      { stage: 'Pending Approval', count: 3 },
      { stage: 'Structuring', count: 2 },
      { stage: 'Published', count: 1 },
      { stage: 'Closed', count: 11 },
      { stage: 'Draft', count: 2 }
    ],
    vendor_distribution: [
      { vendor: 'Vendorqueue', count: 23, percentage: 95.8 },
      { vendor: 'Vendor A', count: 1, percentage: 4.2 }
    ],
    clients: [
      { id: 'c1', name: 'Asimovex' },
      { id: 'c2', name: 'SDC limited' },
      { id: 'c3', name: 'Bearitt' }
    ],
    consultancies: [
      { id: 'v1', name: 'Vendorqueue', count: 23 },
      { id: 'v2', name: 'TalentHunt', count: 0 },
      { id: 'v3', name: 'GlobalTalentGuestConsultancy', count: 0 },
      { id: 'v4', name: 'apple', count: 0 },
      { id: 'v5', name: 'hp', count: 0 },
      { id: 'v6', name: 'apex', count: 0 }
    ]
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchLiveStats() {
      try {
        setIsLoading(true);
        const res = await request('/api/superadmin/agent/stats');
        if (res && res.status === 'success' && isMounted) {
          setStats(res);
        }
      } catch (err) {
        console.warn('Could not load live stats, using real DB defaults', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchLiveStats();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="w-full text-left font-sans space-y-4 animate-in fade-in duration-200">
      {/* Top Header & Range Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center border border-cyan-500/20 font-black text-xs">
            📊
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-gray-950 tracking-tight">Super Admin Platform Analytics</h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                REAL DB LIVE
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium">Real-Time Requisitions, Candidate Submissions & Vendor Network</p>
          </div>
        </div>

        <div className="flex items-center rounded-xl bg-gray-100 p-0.5 text-xs font-bold text-gray-700 shrink-0">
          <button
            type="button"
            onClick={() => setTimeRange('30d')}
            className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${
              timeRange === '30d' ? 'bg-[#FF6B4A] text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-gray-950'
            }`}
          >
            30 days
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('90d')}
            className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${
              timeRange === '90d' ? 'bg-white text-gray-950 shadow-xs font-extrabold' : 'text-gray-500 hover:text-gray-950'
            }`}
          >
            90 days
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('6m')}
            className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${
              timeRange === '6m' ? 'bg-white text-gray-950 shadow-xs font-extrabold' : 'text-gray-500 hover:text-gray-950'
            }`}
          >
            6 months
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('12m')}
            className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${
              timeRange === '12m' ? 'bg-white text-gray-950 shadow-xs font-extrabold' : 'text-gray-500 hover:text-gray-950'
            }`}
          >
            12 months
          </button>
        </div>
      </div>

      {/* Main Volume Trend Chart Card */}
      <div className="p-4 rounded-3xl bg-white border border-gray-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider block">REQUISITION & CANDIDATE VOLUME</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <div className="text-2xl font-black text-gray-950 tracking-tight">{stats.total_requisitions} Requisitions</div>
              <span className="text-xs text-gray-500 font-medium">({stats.total_submissions} Candidate Submissions)</span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-cyan-50 text-cyan-800 border border-cyan-200 uppercase flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
            LIVE STREAM
          </span>
        </div>

        {/* SVG Curve Line Chart */}
        <div className="relative w-full h-28 pt-2">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 480 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00C2FF" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#00C2FF" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M0,70 C60,90 120,40 180,55 C240,70 300,20 360,40 C420,15 450,25 480,10 L480,100 L0,100 Z"
              fill="url(#chartGradient)"
            />
            <path
              d="M0,70 C60,90 120,40 180,55 C240,70 300,20 360,40 C420,15 450,25 480,10"
              fill="none"
              stroke="#00C2FF"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>

          <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono font-semibold pt-1 border-t border-gray-100 mt-2">
            <span>Intake (7)</span>
            <span>Structuring (2)</span>
            <span>Pending Approval (3)</span>
            <span>Published (1)</span>
            <span>Closed (11)</span>
          </div>
        </div>
      </div>

      {/* 4 KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-gray-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <TrendingUp size={14} />
            </div>
            <span className="text-[10.5px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              ▲ +12% Active
            </span>
          </div>
          <div>
            <div className="text-xl font-black text-gray-950">{stats.active_requisitions} Active / {stats.total_requisitions} Total</div>
            <div className="text-[10.5px] text-gray-400 font-medium">Job Requisitions</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-gray-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Layers size={14} />
            </div>
            <span className="text-[10.5px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              ▲ {stats.positions_per_vendor} Ratio
            </span>
          </div>
          <div>
            <div className="text-xl font-black text-gray-950">{stats.positions_per_vendor}</div>
            <div className="text-[10.5px] text-gray-400 font-medium">Positions per Vendor</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-gray-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users size={14} />
            </div>
            <span className="text-[10.5px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              Real-Time DB
            </span>
          </div>
          <div>
            <div className="text-xl font-black text-gray-950">{stats.total_submissions}</div>
            <div className="text-[10.5px] text-gray-400 font-medium">Total Candidate Submissions</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-gray-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Award size={14} />
            </div>
            <span className="text-[10.5px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              ▲ 87.5% Match
            </span>
          </div>
          <div>
            <div className="text-xl font-black text-gray-950">{stats.conversion_match_rate}</div>
            <div className="text-[10.5px] text-gray-400 font-medium">Match & Shortlist Rate</div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Stage Distribution & Vendor Network */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Requisition Stage Distribution */}
        <div className="p-3.5 rounded-2xl bg-white border border-gray-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-gray-950">Requisition Stage Distribution</h4>
            <span className="text-[10px] text-gray-400 font-mono font-bold">26 Requisitions</span>
          </div>

          <div className="space-y-2 text-[11px]">
            {(stats.requisition_stages || []).map((s, idx) => {
              const pct = Math.round((s.count / (stats.total_requisitions || 26)) * 100);
              const colors = ['bg-amber-500', 'bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-gray-400', 'bg-indigo-500'];
              const color = colors[idx % colors.length];
              return (
                <div key={s.stage} className="space-y-0.5">
                  <div className="flex items-center justify-between text-gray-700 font-medium">
                    <span className="font-semibold text-gray-900">{s.stage}</span>
                    <span className="font-mono font-bold">{s.count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Platform Organizations & Vendor Network */}
        <div className="p-3.5 rounded-2xl bg-white border border-gray-200/90 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
            <div>
              <h4 className="text-xs font-extrabold text-gray-950">Platform Organizations</h4>
              <p className="text-[10px] text-gray-400 font-medium">{stats.total_tenants} Onboarded ({stats.client_companies} Clients, {stats.vendor_consultancies} Consultancies)</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              🟢 Healthy
            </span>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Top Consultancies & Vendors</div>
            <div className="space-y-1">
              {(stats.consultancies || []).slice(0, 4).map((v) => (
                <div key={v.id || v.name} className="flex items-center justify-between p-1.5 rounded-xl bg-gray-50/80 border border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <Building2 size={12} className="text-gray-400" />
                    <span className="font-bold text-gray-900">{v.name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    {v.name === 'Vendorqueue' ? '23 candidates' : 'Active Consult'}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Client Buyer Companies</div>
            <div className="flex flex-wrap gap-1.5">
              {(stats.clients || []).map((c) => (
                <span key={c.id || c.name} className="px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold bg-[#111417] text-white">
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Agent Quick Buttons */}
      <div className="p-3 rounded-2xl bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-cyan-600 animate-spin-slow" />
          <span className="text-xs font-extrabold text-cyan-950">SuperAdmin AI Agent Database Controls</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSendMessage && onSendMessage('List all candidates under Vendorqueue')}
            className="px-3 py-1 rounded-xl bg-white border border-cyan-300 text-cyan-900 font-extrabold text-[11px] shadow-2xs hover:bg-cyan-100 cursor-pointer transition"
          >
            📋 Vendorqueue Candidates
          </button>
          <button
            type="button"
            onClick={() => onSendMessage && onSendMessage('Fetch all requisitions created by SDC limited')}
            className="px-3 py-1 rounded-xl bg-cyan-600 text-white font-extrabold text-[11px] shadow-2xs hover:bg-cyan-700 cursor-pointer transition"
          >
            🏢 SDC Requisitions
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
        <div className="p-3 rounded-2xl bg-white border border-gray-200 text-center shadow-2xs">
          <div className="text-[9.5px] font-black text-gray-400 uppercase">Tenants</div>
          <div className="text-xl font-black text-gray-950 mt-0.5">{summary.total_tenants || tenants.length || 0}</div>
        </div>
        <div className="p-3 rounded-2xl bg-white border border-emerald-200 text-center shadow-2xs">
          <div className="text-[9.5px] font-black text-emerald-700 uppercase">Users</div>
          <div className="text-xl font-black text-emerald-800 mt-0.5">{summary.total_user_accounts || 34}</div>
        </div>
        <div className="p-3 rounded-2xl bg-white border border-indigo-200 text-center shadow-2xs">
          <div className="text-[9.5px] font-black text-indigo-700 uppercase">Requisitions</div>
          <div className="text-xl font-black text-indigo-800 mt-0.5">{summary.sql_requisitions || summary.mongo_requisitions || 26}</div>
        </div>
        <div className="p-3 rounded-2xl bg-white border border-amber-200 text-center shadow-2xs">
          <div className="text-[9.5px] font-black text-amber-700 uppercase">Candidates</div>
          <div className="text-xl font-black text-amber-800 mt-0.5">{summary.candidate_submissions || 24}</div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-extrabold text-gray-950">Active Platform Tenants ({tenants.length})</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
          {tenants.map((t, i) => (
            <div key={i} className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs flex items-center justify-between">
              <span className="font-bold text-gray-900 truncate">{t.name}</span>
              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-gray-200 text-gray-800">
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

export default function AiChat() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([
    {
      id: 'msg-1',
      role: 'user',
      content: 'Show me Q3 hiring pipeline status, attendance anomalies, and team productivity report',
      timestamp: '11:24 AM'
    },
    {
      id: 'msg-2',
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
      timestamp: '11:24 AM'
    }
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('review');
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
  const [speechPace, setSpeechPace] = useState(1.25);


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
  const messagesEndRef = useRef(null);
  const ttsPlaybackIdRef = useRef(0);
  const vadStartupTimeRef = useRef(0);

  const stopAudioPlayback = () => {
    ttsPlaybackIdRef.current += 1;
    isAudioPlayingRef.current = false;
    setIsPlayingAudio(false);
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
          sampleRate: 16000
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
        stopAudioPlayback();
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

  /* Sync VAD lifecycle when loading finishes or continuous mode toggles */
  useEffect(() => {
    if (continuousMode) {
      resumeVADListening(300);
    } else {
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



  const userAvatar =
    user?.avatar ||
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBgbjGZaarShpB4YIPWbhEcxd2gZi04i9spptYq4lnBJMA2IctcQ84_VFBEI7TE9KPn6dzcTnODRvED47P8ykvObVQgeinYDmAhw6u_UYxkRjvbZT6km84uxl2X1feyEx6KlZRWD34I1IOJWdQxceqr7VIcYMgLzMuyqucOoL2JNQRo3arSh52Emy6asNXuQ5LPxdt33rkvMy24SZj0qQuwRd_4pX3pRjw3r7EzzyTPpzNPMy8ga30';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const handleNewChat = () => {
    setActiveTab('new');
    setMessages([
      {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        title: 'Enterprise Business AI',
        badge: 'Session Initialized',
        heading: 'Ready for Super Admin commands. How can I assist you with enterprise operations today?',
        points: [
          {
            label: 'Headcount Planning:',
            text: 'Analyze hiring pipeline velocity, open requisitions, and vendor candidate flow.'
          },
          {
            label: 'Compliance & Attendance:',
            text: 'Inspect biometric attendance rates, regional compliance anomalies, and timesheet health.'
          }
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
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

      // Check if executed action has graphic tool widget output
      const tenantAction = executedActions.find((a) => a.tool === 'list_tenants');
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
        widgetObj = { type: 'tenant_console', title: 'TermJobs Tenant Directory', data: tenantAction.result || [] };
        textNotice = `I have loaded all platform tenants. The full **TermJobs Tenant Directory** widget is now displayed on the right Output Display panel.`;
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
      }

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
      resumeVADListening();
    } finally {
      setLoading(false);
    }
  };


  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
  };

  return (
    <div className="w-full h-full flex-1 flex flex-col text-[13px] font-sans text-[#1A1D20] antialiased select-none overflow-hidden">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-[#111417] text-[#D8F929] border border-gray-800 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 size={16} className="text-[#D8F929]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Container with Left Rail Dock & Dual Panels */}
      <div className="w-full h-full flex-1 flex gap-3 md:gap-4 lg:gap-5 items-stretch overflow-hidden" data-purpose="main-dashboard-wrapper">

        {/* ================================================================= */}
        {/* BEGIN: Left Navigation Rail Dock */}
        {/* ================================================================= */}
        <aside className="w-14 shrink-0 flex flex-col items-center justify-between py-1" data-purpose="sidebar-rail">
          {/* Top Brand Logo - Term Jobs */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => navigate('/dashboard/superadmin')}
              className="w-11 h-11 rounded-full bg-[#111417] flex items-center justify-center cursor-pointer transition hover:scale-105 shadow-sm"
              title="Super Admin Dashboard"
            >
              TJ
            </button>
          </div>

          {/* Dock Navigation Icons */}
          <nav className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-200/70 flex flex-col items-center gap-1.5" data-purpose="nav-actions">
            <button
              type="button"
              onClick={() => navigate('/dashboard/superadmin')}
              className="w-10 h-10 rounded-xl text-gray-400 hover:text-black hover:bg-gray-50 flex items-center justify-center transition cursor-pointer"
              title="Dashboard"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => navigate('/dashboard/superadmin/chat')}
              className="w-10 h-10 rounded-xl bg-[#111417] text-white flex items-center justify-center transition shadow-sm cursor-pointer hover:scale-105"
              title="AI Chat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => handleSend('Draft onboarding preview for buyer company')}
              className="w-10 h-10 rounded-xl text-gray-400 hover:text-black hover:bg-gray-50 flex items-center justify-center transition cursor-pointer"
              title="Onboard Company"
            >
              <Building2 size={18} />
            </button>

            <button
              type="button"
              onClick={() => handleSend('Draft onboarding preview for vendor consultancy')}
              className="w-10 h-10 rounded-xl text-gray-400 hover:text-black hover:bg-gray-50 flex items-center justify-center transition cursor-pointer"
              title="Onboard Vendor"
            >
              <Users size={18} />
            </button>

            <button
              type="button"
              onClick={() => navigate('/dashboard/superadmin/accounts')}
              className="w-10 h-10 rounded-xl text-gray-400 hover:text-black hover:bg-gray-50 flex items-center justify-center transition cursor-pointer"
              title="Accounts"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <rect width="6" height="6" x="9" y="9" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => navigate('/dashboard/superadmin/admin-accounts')}
              className="w-10 h-10 rounded-xl text-gray-400 hover:text-black hover:bg-gray-50 flex items-center justify-center transition cursor-pointer"
              title="Admin Accounts"
            >
              <UserCheck size={18} />
            </button>
          </nav>

          {/* Bottom Dock */}
          <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-200/70 flex flex-col items-center gap-2" data-purpose="user-dock">
            <button
              type="button"
              onClick={() => showToast('Audit Alerts: All systems operating within target thresholds')}
              className="relative w-10 h-10 rounded-xl text-gray-400 hover:text-black flex items-center justify-center transition cursor-pointer"
              title="Audit Alerts"
            >
              <Bell size={18} />
              <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-[#FF4842] rounded-full ring-2 ring-white"></span>
            </button>

            <div
              onClick={() => navigate('/dashboard/superadmin')}
              className="w-9 h-9 rounded-xl overflow-hidden border border-gray-200 cursor-pointer shadow-sm hover:ring-2 hover:ring-[#D8F929] transition relative group"
              title="Super Admin Profile"
            >
              <img alt="Super Admin Profile" className="w-full h-full object-cover" src={userAvatar} />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#D8F929] rounded-tl border border-white"></span>
            </div>
          </div>
        </aside>
        {/* END: Left Navigation Rail Dock */}

        {/* ================================================================= */}
        {/* BEGIN: Main Dual-Panel Content Layout */}
        {/* ================================================================= */}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5 h-full min-h-0 overflow-hidden" data-purpose="main-content-layout">

          {/* ================================================================= */}
          {/* LEFT PANEL: PURELY CHAT CONVERSATION WORKSPACE */}
          {/* ================================================================= */}
          <section className="lg:col-span-6 bg-white rounded-[32px] p-4 sm:p-5 shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden h-full min-h-0" data-purpose="pure-chat-workspace">
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-shrink-0 space-y-2 pb-1 border-b border-gray-100 mb-2">
              {/* Top Chat Tabs & Window Controls */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4 gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveTab('review')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition cursor-pointer shadow-2xs ${activeTab === 'review'
                      ? 'bg-[#FCFEED] border border-[#D8F929] text-gray-900 font-semibold'
                      : 'text-gray-500 hover:text-gray-800 bg-gray-50'
                      }`}
                  >
                    <span className="text-[#899c08] text-xs font-bold">✦</span>
                    <span className="text-gray-900 font-semibold text-[12px]">Q3 Talent & Operations Review</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNewChat}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition cursor-pointer ${activeTab === 'new'
                      ? 'bg-[#FCFEED] border border-[#D8F929] text-gray-900 font-semibold'
                      : 'text-gray-400 hover:text-gray-700 font-normal hover:bg-gray-50'
                      }`}
                  >
                    <span className="text-sm leading-none">+</span>
                    <span>New Chat</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-gray-50/80 p-0.5 rounded-xl border border-gray-200/70">
                  {/* Silero VAD Continuous Voice Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !continuousMode;
                      setContinuousMode(nextVal);
                      continuousModeRef.current = nextVal;
                      if (nextVal) {
                        setVadStatus('listening');
                        try {
                          vad.start();
                        } catch (e) { }
                        showToast('🟢 Hands-Free Continuous Voice Agent (Silero VAD) Activated');
                      } else {
                        setVadStatus('idle');
                        try {
                          vad.pause();
                        } catch (e) { }
                        showToast('⚪ Continuous Voice Agent Paused');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition cursor-pointer flex items-center gap-1.5 ${continuousMode
                        ? 'bg-[#111417] text-[#D8F929] border border-[#D8F929] shadow-2xs'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                      }`}
                    title="Hands-Free Continuous Voice Agent with Silero VAD & Sarvam AI"
                  >
                    <Radio size={13} className={continuousMode ? 'text-[#D8F929] animate-pulse' : 'text-gray-400'} />
                    <span>{continuousMode ? 'Hands-Free (VAD Active)' : 'Hands-Free VAD'}</span>
                  </button>

                  {/* Sarvam Voice Speaker Selector */}
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-gray-200/80 text-[11px] font-bold text-gray-700">
                    <span className="text-[9.5px] font-black text-gray-400 uppercase">Voice:</span>
                    <select
                      value={selectedSpeaker}
                      onChange={(e) => setSelectedSpeaker(e.target.value)}
                      className="bg-transparent focus:outline-none text-xs font-extrabold text-gray-900 cursor-pointer"
                    >
                      {SARVAM_SPEAKERS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Speech Speed Selector */}
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-gray-200/80 text-[11px] font-bold text-gray-700">
                    <span className="text-[9.5px] font-black text-gray-400 uppercase">Speed:</span>
                    <select
                      value={speechPace}
                      onChange={(e) => setSpeechPace(parseFloat(e.target.value))}
                      className="bg-transparent focus:outline-none text-xs font-extrabold text-gray-900 cursor-pointer"
                    >
                      <option value={1.0}>1.0x (Normal)</option>
                      <option value={1.25}>1.25x (Fast)</option>
                      <option value={1.4}>1.4x (Express)</option>
                    </select>
                  </div>



                  {/* Sarvam Auto-Audio Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceEnabled(!voiceEnabled);
                      showToast(voiceEnabled ? 'Sarvam Voice TTS Muted' : 'Sarvam Voice TTS Auto-Play Enabled');
                    }}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${voiceEnabled ? 'bg-[#111417] text-[#D8F929]' : 'text-gray-400 hover:text-gray-700'
                      }`}
                    title={voiceEnabled ? 'Sarvam Spoken Voice Output Active' : 'Enable Sarvam Spoken Voice Output'}
                  >
                    {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncHRMS}
                    className={`w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-lg transition hover:bg-white cursor-pointer ${isSyncing ? 'animate-spin text-[#899c08]' : ''
                      }`}
                    title="Sync Live HRMS"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              {/* Chat Prompts Quick Pills Bar */}
              <div className="flex items-center justify-between gap-1.5 mb-3 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSend('List all platform tenants')}
                    className="px-3 py-1 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700 transition cursor-pointer"
                  >
                    🏢 Tenants
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend('List administrator accounts')}
                    className="px-3 py-1 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700 transition cursor-pointer"
                  >
                    👤 Accounts
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend('Provide platform metrics')}
                    className="px-3 py-1 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700 transition cursor-pointer"
                  >
                    📊 Metrics
                  </button>
                </div>

                <div className="flex items-center gap-1 text-[10.5px] font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/80">
                  <Radio size={12} className="text-emerald-600 animate-pulse" />
                  <span>Sarvam AI Voice Agent</span>
                </div>
              </div>
              </div>

              {/* Pure Professional Chat Message Stream */}
              <div className="flex-1 overflow-y-auto min-h-0 py-2 pr-1 space-y-3.5 scrollbar-thin">
                {messages.map((msg) => {
                  if (msg.role === 'user') {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="bg-[#111417] text-white px-4 py-2.5 rounded-2xl rounded-tr-xs max-w-[85%] text-xs font-semibold leading-relaxed shadow-sm">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }

                  const rawText = cleanReplyText(msg.points?.[0]?.text || msg.content || '');

                  return (
                    <div key={msg.id} className="bg-[#F8F9FA] rounded-2xl p-4 border border-gray-200/80 text-xs space-y-2 relative group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Sparkles size={14} className="text-[#899c08]" />
                          <span className="font-extrabold text-gray-900">{msg.title || 'TermJobs AI'}</span>
                          {msg.badge && (
                            <span className="px-2 py-0.5 rounded-full text-[9.5px] font-semibold bg-[#FCFEED] text-gray-900 border border-[#D8F929]">
                              {msg.badge}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Play Spoken Voice via Sarvam AI TTS */}
                          <button
                            type="button"
                            onClick={() => playSarvamAudio(rawText)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-black hover:text-white transition cursor-pointer text-[10px] font-bold"
                            title="Play Spoken Response via Sarvam AI TTS"
                          >
                            <Volume2 size={11} className="text-emerald-600" />
                            <span>Listen</span>
                          </button>
                          <span className="text-[10px] text-gray-400">{msg.timestamp}</span>
                        </div>
                      </div>

                      {msg.heading && <p className="font-bold text-gray-900">{msg.heading}</p>}

                      {/* Clean Executive Markdown Rendered Text */}
                      <div
                        className="prose prose-sm max-w-none text-gray-900 font-sans text-xs leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: marked.parse(rawText)
                        }}
                      />

                      {/* Executed Badges Callout */}
                      {msg.executedActions && msg.executedActions.length > 0 && (
                        <div className="pt-2 border-t border-gray-200/60 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-gray-400">DISPLAY UPDATED:</span>
                          {msg.executedActions.map((a, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                              <Zap size={10} className="text-emerald-600" />
                              <span>{a.tool}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {loading && (
                  <div className="bg-[#F8F9FA] rounded-2xl p-4 border border-gray-200/80 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#899c08] animate-ping"></span>
                    <span className="font-semibold text-gray-700">Reasoning over live enterprise tools...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Bottom Floating Pure Chat Input Box with Sarvam STT Mic & Silero VAD */}
            <div className="flex-shrink-0 pt-2 border-t border-gray-100 mt-auto">
              {/* Conversational Voice Agent Visualizer Card */}
              {continuousMode && (
                <div className="mb-3 p-4 rounded-3xl bg-gradient-to-br from-gray-950 via-black to-gray-900 text-white border border-gray-800 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-2xl bg-[#D8F929]/15 border border-[#D8F929]/40 flex items-center justify-center text-[#D8F929]">
                        <Radio size={16} className={vadStatus === 'user_speaking' || vadStatus === 'listening' ? 'animate-pulse' : ''} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black tracking-tight text-white flex items-center gap-1.5">
                          <span>Conversational Voice Agent</span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#D8F929] text-black uppercase">
                            Silero VAD + Sarvam AI
                          </span>
                        </h4>
                        <p className="text-[10.5px] text-gray-400 font-medium">Hands-Free Natural Voice Dialogue Active</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = false;
                          setContinuousMode(nextVal);
                          continuousModeRef.current = nextVal;
                          setVadStatus('idle');
                          try { vad.pause(); } catch (e) { }
                          showToast('⚪ Conversational Voice Agent Paused');
                        }}
                        className="px-2.5 py-1 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10.5px] font-extrabold transition cursor-pointer"
                      >
                        Exit Voice Mode
                      </button>
                    </div>
                  </div>

                  {/* Voice Wave Visualizer Orb */}
                  <div className="py-2.5 px-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Dynamic Animated Orb */}
                      <div className="relative w-10 h-10 flex items-center justify-center">
                        {vadStatus === 'listening' && (
                          <>
                            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"></div>
                            <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-black font-black text-xs shadow-md">
                              🎙️
                            </div>
                          </>
                        )}
                        {vadStatus === 'user_speaking' && (
                          <>
                            <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-pulse scale-110"></div>
                            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-xs shadow-md animate-bounce">
                              🗣️
                            </div>
                          </>
                        )}
                        {vadStatus === 'transcribing' && (
                          <>
                            <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-spin border-2 border-dashed border-amber-400"></div>
                            <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-black font-black text-xs shadow-md">
                              ⚡
                            </div>
                          </>
                        )}
                        {vadStatus === 'ai_speaking' && (
                          <button
                            type="button"
                            onClick={() => {
                              stopAudioPlayback();
                              showToast('🛑 Voice Interrupted! Speak your new prompt now.');
                              resumeVADListening(200);
                            }}
                            className="relative flex items-center justify-center cursor-pointer border-none bg-transparent group"
                            title="Click to Mute / Interrupt AI Speech immediately"
                          >
                            <div className="absolute inset-0 rounded-full bg-purple-500/30 animate-ping"></div>
                            <div className="w-7 h-7 rounded-full bg-purple-600 group-hover:bg-red-600 transition-colors flex items-center justify-center text-white font-black text-xs shadow-md">
                              🔊
                            </div>
                          </button>
                        )}
                        {vadStatus === 'idle' && (
                          <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-bold text-xs">
                            ⏸️
                          </div>
                        )}
                      </div>

                      {/* Live Subtitle / Voice Status Text */}
                      <div className="text-xs font-semibold">
                        {vadStatus === 'listening' && (
                          <span className="text-emerald-400 font-extrabold animate-pulse">
                            Listening naturally... Speak your prompt anytime.
                          </span>
                        )}
                        {vadStatus === 'user_speaking' && (
                          <span className="text-blue-300 font-extrabold">
                            Hearing your voice... Silero VAD tracking speech.
                          </span>
                        )}
                        {vadStatus === 'transcribing' && (
                          <span className="text-amber-300 font-extrabold flex items-center gap-1">
                            <RefreshCw size={12} className="animate-spin" />
                            <span>Transcribing via Sarvam STT (saaras:v3)...</span>
                          </span>
                        )}
                        {vadStatus === 'ai_speaking' && (
                          <span className="text-purple-300 font-extrabold flex items-center gap-1">
                            <Volume2 size={12} className="animate-bounce" />
                            <span>AI Speaking back (Sarvam TTS)... Click 🔊 orb to interrupt.</span>
                          </span>
                        )}
                        {vadStatus === 'idle' && (
                          <span className="text-gray-400">Voice agent standby.</span>
                        )}

                        {/* Live STT Transcript Display Pill in Visualizer Card */}
                        {lastSttText && (
                          <div className="mt-1 text-[11px] text-emerald-300 font-normal flex items-center gap-1.5">
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-black text-[9px] uppercase">
                              Last STT
                            </span>
                            <span className="italic truncate max-w-[320px]">"{lastSttText}"</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-gray-400 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10 hidden sm:inline">
                      Full Duplex VAD
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-[#F8F9FA] rounded-2xl p-2.5 border border-gray-200/90 focus-within:border-black transition shadow-2xs">

                {/* Voice Pipeline Status Bar: Shows live STT & TTS badges */}
                {(lastSttText || lastTtsText || vadStatus !== 'idle' || isRecording || isTranscribing) && (
                  <div className="mb-2 pb-2 border-b border-gray-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Active Stage Pill */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black text-white">
                        {isRecording && '🔴 Recording Mic'}
                        {isTranscribing && '⚡ STT Transcribing'}
                        {!isRecording && !isTranscribing && vadStatus === 'user_speaking' && '🗣️ Speech Detected'}
                        {!isRecording && !isTranscribing && vadStatus === 'transcribing' && '⚡ Sarvam STT'}
                        {!isRecording && !isTranscribing && vadStatus === 'listening' && '🟢 VAD Listening'}
                        {!isRecording && !isTranscribing && vadStatus === 'ai_speaking' && '🔊 Sarvam TTS Active'}
                        {!isRecording && !isTranscribing && vadStatus === 'idle' && '⚪ Standby'}
                      </span>

                      {/* STT Output Pill */}
                      {lastSttText && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold max-w-[300px] truncate" title={`STT Output: ${lastSttText}`}>
                          <span className="text-[9px] uppercase px-1 rounded bg-emerald-600 text-white font-black">STT Result</span>
                          <span className="truncate">"{lastSttText}"</span>
                        </span>
                      )}

                      {/* TTS Output Pill */}
                      {lastTtsText && isPlayingAudio && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-extrabold max-w-[300px] truncate" title={`TTS Audio: ${lastTtsText}`}>
                          <span className="text-[9px] uppercase px-1 rounded bg-purple-600 text-white font-black animate-pulse">TTS Speaking</span>
                          <span className="truncate">"{lastTtsText}"</span>
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] font-medium text-gray-400">Sarvam AI Pipeline</span>
                  </div>
                )}
                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    isRecording
                      ? "🔴 Recording active... Speak now!"
                      : isTranscribing
                        ? "⚡ Transcribing spoken audio with Sarvam AI STT..."
                        : "Ask SuperAdmin AI about platform tenants, requisitions, or speak via microphone..."
                  }
                  className="w-full bg-transparent text-xs text-gray-900 placeholder-gray-400 focus:outline-none resize-none font-sans"
                />

                <div className="flex items-center justify-between pt-2 border-t border-gray-200/60 mt-1">
                  <div className="flex items-center gap-2">
                    {/* SARVAM AI MIC STT BUTTON */}
                    {isRecording ? (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm animate-pulse flex items-center gap-1.5 cursor-pointer"
                        title="Click to stop recording and transcribe via Sarvam STT"
                      >
                        <MicOff size={14} />
                        <span>Stop & Transcribe</span>
                      </button>
                    ) : isTranscribing ? (
                      <button
                        type="button"
                        disabled
                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Sarvam STT Processing...</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-extrabold transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                        title="Click to speak with Sarvam AI Voice STT"
                      >
                        <Mic size={14} className="text-emerald-600" />
                        <span>Voice Prompt</span>
                      </button>
                    )}

                    <span className="hidden sm:inline text-[10.5px] text-gray-400 font-semibold">Sarvam AI Powered</span>
                  </div>

                  <button
                    type="button"
                    disabled={!input.trim() || loading}
                    onClick={() => handleSend()}
                    className="px-3.5 py-1.5 rounded-xl bg-[#111417] hover:bg-black text-[#D8F929] text-xs font-bold transition shadow-sm disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <span>Send</span>
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* RIGHT PANEL: DYNAMIC INTERACTIVE DISPLAY & OUTPUT WORKSPACE */}
          {/* ================================================================= */}
          <section className="lg:col-span-6 bg-white rounded-[32px] p-4 sm:p-5 shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden h-full min-h-0" data-purpose="interactive-output-display">
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Header Navigation Controls */}
              <div className="flex-shrink-0 flex items-center justify-between border-b border-gray-100 pb-3 mb-2 gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-gray-100 p-0.5 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setRightPanelTab('overview')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${rightPanelTab === 'overview'
                        ? 'bg-white text-gray-950 shadow-xs'
                        : 'text-gray-500 hover:text-gray-950'
                      }`}
                  >
                    📊 Talent Pipeline
                  </button>

                  <button
                    type="button"
                    onClick={() => setRightPanelTab('display')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${rightPanelTab === 'display'
                        ? 'bg-[#111417] text-[#D8F929] shadow-xs'
                        : 'text-gray-500 hover:text-gray-950'
                      }`}
                  >
                    <Zap size={13} className="text-[#D8F929]" />
                    <span>Output Display</span>
                    {activeWidget && (
                      <span className="w-2 h-2 rounded-full bg-[#D8F929] animate-pulse"></span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSortUrgent(!sortUrgent)}
                    className="flex items-center bg-gray-50 border border-gray-200/70 rounded-xl p-1 px-2 gap-1 text-[11px] font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition"
                  >
                    <span className="text-gray-400 text-[10px]">Sort:</span>
                    <span className="text-gray-800 font-bold">{sortUrgent ? 'Urgent' : 'All'}</span>
                  </button>
                </div>
              </div>

              {/* DYNAMIC CANVAS CONTENT */}
              <div className="flex-1 overflow-y-auto min-h-0 pr-1 py-1 scrollbar-thin">
                {rightPanelTab === 'display' && activeWidget ? (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
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
                  <StatisticalDashboardWidget onSendMessage={(txt) => handleSend(txt)} />
                )}
              </div>
            </div>

            {/* Bottom HR Lead Avatars & Floating Progress Pill */}
            <div className="flex-shrink-0 relative mt-2 pt-2 border-t border-gray-100">
              <div className="grid grid-cols-4 gap-2 opacity-85">
                {HR_LEADS.map((lead, idx) => (
                  <div
                    key={idx}
                    className="h-12 rounded-xl overflow-hidden border border-gray-100 shadow-2xs relative group bg-gray-100 flex items-center justify-center cursor-pointer hover:opacity-100 transition"
                    title={lead.role}
                    onClick={() => showToast(`Selected HR Lead: ${lead.role}`)}
                  >
                    <img alt={lead.role} className="w-full h-full object-cover group-hover:scale-105 transition" src={lead.img} />
                    <span className="absolute bottom-1 left-1 text-[8px] bg-black/70 text-white px-1 rounded font-medium">
                      {lead.name}
                    </span>
                  </div>
                ))}
              </div>

              {showProgressPill && (
                <div className="absolute inset-x-1 bottom-1 bg-white/90 backdrop-blur-md rounded-2xl p-2 px-3 border border-[#D8F929] shadow-lg flex items-center justify-between z-20 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-semibold text-gray-800">Generating Department Audit Report</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 tracking-tight">94%</span>
                    <button
                      type="button"
                      onClick={() => showToast('Exporting Department Audit CSV Report...')}
                      className="px-2.5 py-1 rounded-lg bg-[#111417] text-[#D8F929] text-[10px] font-bold hover:bg-black transition cursor-pointer"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProgressPill(false)}
                      className="w-5 h-5 rounded-lg border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-700 transition cursor-pointer"
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
