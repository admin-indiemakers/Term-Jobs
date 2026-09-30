import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { request, API_BASE_URL } from '../api/client';
import { marked } from 'marked';
import { useMicVAD, utils } from '@ricky0123/vad-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  Shield,
  Table
} from 'lucide-react';

/* ── REQUISITIONS MOCK DATA FOR RIGHT SIDEBAR OVERVIEW ─────────────────────── */
const REQUISITIONS_DATA = [
  {
    id: 'req-1',
    title: 'Senior Cloud Architect',
    dept: 'Cloud Ops',
    stage: 'Stage: Offer',
    stageStyle: 'bg-black text-white border border-black',
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
    stageStyle: 'bg-gray-100 text-gray-800 border border-gray-200',
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

/* Configure marked for GitHub Flavored Markdown and line breaks */
marked.setOptions({
  gfm: true,
  breaks: true
});

/* Helper to convert space-aligned pseudo-tables into standard GitHub Markdown tables */
const formatMarkdownContent = (text) => {
  if (!text) return '';
  const lines = String(text).split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if line looks like a multi-column header (at least 3 columns separated by 2+ spaces or tabs, not starting with markdown chars)
    if (
      trimmed &&
      !trimmed.startsWith('|') &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('-') &&
      !trimmed.startsWith('•') &&
      !trimmed.startsWith('*') &&
      !trimmed.startsWith('>')
    ) {
      const parts = trimmed.split(/\s{2,}|\t+/).filter(Boolean);
      if (parts.length >= 3) {
        // Collect subsequent rows that have 2+ columns
        const tableRows = [parts];
        let j = i + 1;
        while (j < lines.length) {
          const nextTrim = lines[j].trim();
          if (
            !nextTrim ||
            nextTrim.startsWith('#') ||
            nextTrim.startsWith('-') ||
            nextTrim.startsWith('•') ||
            nextTrim.startsWith('*') ||
            nextTrim.startsWith('|')
          ) {
            break;
          }
          const nextParts = nextTrim.split(/\s{2,}|\t+/).filter(Boolean);
          if (nextParts.length >= 2) {
            tableRows.push(nextParts);
            j++;
          } else {
            break;
          }
        }

        if (tableRows.length >= 2) {
          const maxCols = Math.max(...tableRows.map((r) => r.length));
          const headerRow = [...tableRows[0]];
          while (headerRow.length < maxCols) headerRow.push('');
          result.push('');
          result.push('| ' + headerRow.join(' | ') + ' |');
          result.push('| ' + Array(maxCols).fill(':---').join(' | ') + ' |');
          for (let r = 1; r < tableRows.length; r++) {
            const row = [...tableRows[r]];
            while (row.length < maxCols) row.push('');
            result.push('| ' + row.join(' | ') + ' |');
          }
          result.push('');
          i = j;
          continue;
        }
      }
    }

    result.push(line);
    i++;
  }

  return result.join('\n');
};

/* Multi-View Comparative Prompt Detector: detects if the user wants to keep current data and view additional data side-by-side */
const isComparativeMultiViewPrompt = (promptText) => {
  if (!promptText || typeof promptText !== 'string') return false;
  // Normalize punctuation and extra spaces
  const clean = promptText.toLowerCase().replace(/[,.!?;:]/g, ' ').replace(/\s+/g, ' ').trim();

  // High-confidence regex patterns for split, other tab, right tab, side-by-side, comparative requests
  const patterns = [
    // Matches "in other tab", "in another tab", "on other tab", "to other tab", "into other tab", "open in other tab", "open in right tab", etc.
    /\b(?:in|on|at|into|as|to|open(?:\s+in)?)\s+(?:an?|the)?\s*(?:other|another|second|2nd|new|separate|next|right|additional|side|dual|split)\s*tab\b/i,
    // Direct mention of "other tab", "another tab", "second tab", "2nd tab", "right tab", "side tab", "separate tab", "dual tab", "split tab"
    /\b(?:other|another|second|2nd|right|side|separate|dual|split)\s*tab\b/i,
    // "in a tab", "open in tab", "into a tab"
    /\b(?:open|show|list|display|put|view|add|see|fetch)\s+(?:in|into|as)\s+(?:a|another|the|an)?\s*tab\b/i,
    // "open on right", "show to the right", "display on the right", "open right panel"
    /\b(?:open|show|list|display|put|view|add|see|fetch)\s+(?:on|to|in)\s+(?:the\s+)?right\b/i,
    /\b(?:right|second|2nd)\s+(?:panel|window|column|side|view)\b/i,
    // Split and side-by-side phrasing
    /\bside\s*[-–—]?\s*by\s*[-–—]?\s*side\b/i,
    /\bsplit\s*(?:view|screen|panel|tab|window)?\b/i,
    /\bdual\s*(?:view|screen|panel|tab|window)\b/i,
    // Comparative phrasing with current/existing item
    /\b(?:along\s+with|with\s+(?:this|that|current|existing)|keep\s+(?:this|current)|next\s+to\s+(?:this|that))\b/i,
    // "also show", "also list", "also view", "also get", "show also", "list also"
    /\b(?:also\s+(?:show|list|view|get|display|see|fetch|compare)|show\s+also|list\s+also|view\s+also|and\s+also)\b/i,
    // Comparison verbs
    /\bcompare\s+(?:with|to|this|that|both)\b/i,
    /\bboth\s+(?:data|records|views|tabs|tables)\b/i
  ];

  if (patterns.some((re) => re.test(clean))) {
    return true;
  }

  // Exact substring fallback keywords
  const keywords = [
    'other tab',
    'in other tab',
    'another tab',
    'in another tab',
    'new tab',
    'in a new tab',
    'right tab',
    'in right tab',
    'second tab',
    '2nd tab',
    'side tab',
    'separate tab',
    'with this data',
    'with this',
    'along with this',
    'along with that',
    'compare with',
    'compare to',
    'compare this',
    'compare both',
    'side by side',
    'side-by-side',
    'keep this',
    'and also',
    'additionally',
    'at the same time',
    'show both',
    'next to this',
    'as well as',
    'both data',
    'split view',
    'split screen'
  ];

  return keywords.some((k) => clean.includes(k));
};

/* Helper to extract markdown tables from AI messages for the popup modal tab */
const extractTableFromText = (text) => {
  if (!text) return { cleanText: '', tableInfo: null };

  const formatted = formatMarkdownContent(text);
  const lines = formatted.split('\n');

  let tableStart = -1;
  let tableEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (tableStart === -1) tableStart = i;
      tableEnd = i;
    } else if (tableStart !== -1 && tableEnd !== -1) {
      if (!trimmed) {
        break;
      }
    }
  }

  if (tableStart === -1 || tableEnd === -1 || tableEnd <= tableStart) {
    return { cleanText: text, tableInfo: null };
  }

  const tableLines = lines
    .slice(tableStart, tableEnd + 1)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.endsWith('|'));

  if (tableLines.length < 2) {
    return { cleanText: text, tableInfo: null };
  }

  // Parse headers
  const headers = tableLines[0]
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim());

  let startIdx = 1;
  if (tableLines[1].replace(/[\s\:\-\|]/g, '') === '') {
    startIdx = 2;
  }

  const rows = [];
  for (let i = startIdx; i < tableLines.length; i++) {
    const cells = tableLines[i]
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim());
    if (cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
  }

  // Find title preceding the table
  let title = '';
  for (let i = tableStart - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (l) {
      title = l.replace(/^#+\s*/, '').replace(/\*+/g, '').trim();
      break;
    }
  }

  // If table is a candidate roster or applicant list, ensure title distinguishes candidates
  const isCandidateTable = headers.some((h) => /candidate|applicant/i.test(h));
  if (isCandidateTable && title && !/candidate|applicant/i.test(title)) {
    title = title.includes('—')
      ? title.replace('—', 'Candidates —')
      : `${title} — Candidates`;
  }

  // Filter out the table lines and immediately preceding markdown heading if it was the table title
  const nonTableLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (i >= tableStart && i <= tableEnd) continue;
    if (i === tableStart - 1 && lines[i].trim().startsWith('#')) continue;
    nonTableLines.push(lines[i]);
  }

  let cleanText = nonTableLines.join('\n').trim();
  if (!cleanText) {
    cleanText = title ? `I have compiled the **${title}** below.` : 'I have retrieved the requested records.';
  }

  return {
    cleanText,
    tableInfo: {
      title: title || 'Data Table Records',
      headers,
      rows,
      rawMarkdown: tableLines.join('\n')
    }
  };
};

/* Clean text helper: transform debug logs into friendly copilot responses without stripping legitimate markdown tables */
const cleanReplyText = (text) => {
  if (!text) return '';
  let str = String(text);

  // Only strip legacy debug database queries that start with "Super Admin King DB Query:"
  if (str.startsWith('Super Admin King DB Query:') && str.includes('| Tenant ID |')) {
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
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center border border-gray-200 bg-black/5 text-gray-900 shadow-2xs shrink-0">
            {isConsultancyOnly ? <Layers size={19} /> : <Building2 size={19} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-gray-950 tracking-tight leading-tight">
                {widgetTitle}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-black tracking-wider uppercase bg-gray-100 text-gray-800 border border-gray-200">
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
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer text-[11px] ${filterTab === 'all' ? 'bg-black text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-black'
                }`}
            >
              All ({tenants.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('client')}
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer text-[11px] ${filterTab === 'client' ? 'bg-black text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-black'
                }`}
            >
              Buyers ({clientCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('consultancy')}
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer text-[11px] ${filterTab === 'consultancy' ? 'bg-black text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-black'
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
                      className="px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider flex items-center gap-1.5 bg-gray-100 text-gray-900 border border-gray-200"
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
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shadow-xs shrink-0 bg-gray-100 text-gray-950 border border-gray-200">
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
                      className="p-1.5 rounded-xl bg-gray-100 hover:bg-black hover:text-white text-gray-700 border border-gray-200 transition-colors shadow-2xs cursor-pointer"
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
        <div className="p-3.5 rounded-2xl bg-white border border-gray-200 text-center shadow-2xs">
          <div className="text-[10px] font-black text-gray-400 uppercase">Buyers</div>
          <div className="text-2xl font-black text-gray-950 mt-1">{clients}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white border border-gray-200 text-center shadow-2xs">
          <div className="text-[10px] font-black text-gray-400 uppercase">Vendors</div>
          <div className="text-2xl font-black text-gray-950 mt-1">{vendors}</div>
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
            className="px-3 py-1.5 rounded-xl bg-black hover:bg-gray-800 text-white text-[11px] font-extrabold shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Click to AI auto-fill company description & profile blurb"
          >
            <Sparkles size={13} className={isGenerating ? 'animate-spin' : ''} />
            <span>{isGenerating ? 'AI Generating...' : 'AI Auto-Fill Profile'}</span>
          </button>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-900 border border-gray-200">
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
            <label className="block text-[10.5px] font-bold text-gray-700 mb-1">Initial Password *</label>
            <input
              type="text"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-950 focus:outline-none focus:bg-white focus:border-black"
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
            <span className="text-[10px] font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200 flex items-center gap-1">
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
      <div className="p-4 rounded-3xl bg-black text-white shadow-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 text-white border border-white/20 flex items-center justify-center font-black text-lg">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-white tracking-tight">Organization Onboarding Confirmed</h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-white text-black uppercase">
                LIVE DB ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-medium">Tenant database record & admin user account provisioned</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSendMessage && onSendMessage('List all platform tenants')}
          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/30 text-xs font-extrabold transition cursor-pointer shrink-0"
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
          <span className="px-3 py-1 rounded-full text-[10.5px] font-extrabold bg-gray-100 text-gray-900 border border-gray-200">
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
              className="text-[10.5px] font-extrabold text-gray-900 hover:text-black flex items-center gap-1 cursor-pointer"
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
              <span className="font-extrabold text-gray-900 text-xs mt-0.5 block truncate">{adminEmail}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-gray-200/70">
              <span className="text-[9.5px] font-bold text-gray-400 uppercase block">System Tenant ID</span>
              <span className="font-mono font-bold text-gray-800 text-xs mt-0.5 block">{tenantId}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-gray-200/70">
              <span className="text-[9.5px] font-bold text-gray-400 uppercase block">Password</span>
              <span className="font-mono font-black text-gray-900 text-xs mt-0.5 block">{password}</span>
            </div>
          </div>
        </div>

        {/* Integration Checklist */}
        <div className="space-y-1.5 text-xs font-semibold text-gray-700 pt-1">
          <div className="flex items-center gap-2 text-gray-800">
            <CheckCircle2 size={14} className="text-gray-950" />
            <span>SQL & MongoDB Tenant Record Created (`{tenantId}`)</span>
          </div>
          <div className="flex items-center gap-2 text-gray-800">
            <CheckCircle2 size={14} className="text-gray-950" />
            <span>Admin User Account & Auth Password Hash Configured</span>
          </div>
          <div className="flex items-center gap-2 text-gray-800">
            <CheckCircle2 size={14} className="text-gray-950" />
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
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-gray-900 animate-pulse" />
          <h3 className="text-sm font-extrabold text-gray-950">Credential & Password Change Confirmation</h3>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-900 border border-gray-200 uppercase">
          Confirmation Required
        </span>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Target User Account</span>
            <h4 className="text-base font-black text-gray-950 mt-0.5">{formData.user_name}</h4>
          </div>
          <span className="font-mono text-xs font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-xl border border-gray-200">
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
              className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 font-bold focus:outline-none focus:border-black"
            />
          </div>
          <div>
            <label className="block text-[10.5px] font-bold text-gray-600 mb-1">User Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 font-bold focus:outline-none focus:border-black"
            />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white border border-gray-200 space-y-2 text-xs">
          <label className="block text-[10.5px] font-bold text-gray-700">New Target Password *</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-950 focus:outline-none focus:border-black"
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
          <ShieldCheck size={15} className="text-white" />
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
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-white flex items-center justify-center border border-white/20">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-white">Password Successfully Updated</h4>
              <p className="text-[11px] text-gray-400">Account credentials synchronized across platform authentication nodes</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-white/10 text-white border border-white/20 uppercase">
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
            <span className="font-mono font-bold text-white">{new_password || '1234'}</span>
          </div>
          <div className="flex items-center justify-between text-gray-300">
            <span className="font-medium">Status:</span>
            <span className="text-white font-bold">Password Hash Updated & Committed</span>
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
          <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center shadow-md shrink-0">
            <Briefcase size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-gray-950 tracking-tight">
                {vendorName ? `Requisitions for ${vendorName}` : 'Job Requisitions Directory'}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-900 border border-gray-200 uppercase">
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
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${filterStatus === 'open' ? 'bg-black text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-black'
                }`}
            >
              Open ({openCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('draft')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${filterStatus === 'draft' ? 'bg-black text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-black'
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredReqs.map((r, i) => {
          const isOpen = ['open', 'published', 'active'].includes((r.status || '').toLowerCase());
          return (
            <div
              key={r.requisition_id || r.id || i}
              className="p-3.5 sm:p-4 rounded-xl bg-white border border-gray-200 hover:border-black/50 transition-all shadow-xs flex flex-col justify-between text-xs"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${isOpen
                      ? 'bg-black text-white border border-black'
                      : 'bg-gray-100 text-gray-800 border border-gray-200'
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
                  <div className="text-[11px] font-bold text-gray-700 mt-1">
                    Company: <span className="text-gray-950">{r.client_name}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-gray-500 font-bold">{r.salary_range || '$120k-$150k'}</span>
                <button
                  type="button"
                  onClick={() => onSendMessage(`Show candidates under vendor ${r.vendor_name || 'all'}`)}
                  className="px-2.5 py-1 rounded-lg bg-gray-950 hover:bg-black text-white text-[10px] font-bold cursor-pointer transition shadow-xs hover:scale-102 active:scale-95"
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
          <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center shadow-md shrink-0">
            <Users size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-gray-950 tracking-tight">
                {vendorName ? `Candidates Submitted by ${vendorName}` : 'Candidate Submissions Directory'}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-900 border border-gray-200 uppercase">
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
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${filterStatus === 'shortlisted' ? 'bg-black text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-black'
                }`}
            >
              Shortlisted
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('interviewing')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer text-[11px] transition ${filterStatus === 'interviewing' ? 'bg-black text-white shadow-xs font-extrabold' : 'text-gray-500 hover:text-black'
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredCands.map((c, i) => (
          <div key={c.candidate_id || c.id || i} className="p-2.5 rounded-xl bg-white border border-gray-200 hover:border-black transition-all shadow-2xs flex flex-col justify-between text-xs">
            <div>
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <span className="px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase bg-gray-100 text-gray-900 border border-gray-200">
                  {c.status || 'Shortlisted'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-black text-white border border-black">
                  {c.match_score || '94% Match'}
                </span>
              </div>

              <h4 className="text-xs font-extrabold text-gray-950 leading-tight truncate">{c.name}</h4>
              <div className="text-[10px] text-gray-500 font-medium truncate mt-0.5">{c.email}</div>
              <div className="text-[9.5px] font-bold text-gray-800 mt-0.5 truncate">
                Req: {c.requisition_title || 'Senior Full Stack Engineer'}
              </div>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-gray-100 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onCopy(c.email, c.email)}
                  className="p-1 rounded-lg bg-gray-100 hover:bg-black hover:text-white text-gray-600 transition cursor-pointer"
                  title="Copy Candidate Email"
                >
                  <Copy size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => onSendMessage(`I WOULD LIKE TO SEE THE RESUME OF ${c.name}`)}
                  className="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-black hover:text-white text-gray-900 border border-gray-200 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                  title="View full candidate resume and evaluation profile"
                >
                  <FileText size={11} />
                  <span>Resume</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => onSendMessage(`Schedule interview for ${c.name}`)}
                className="px-2 py-0.5 rounded-lg bg-black hover:bg-gray-800 text-white text-[10px] font-bold transition shadow-2xs cursor-pointer"
              >
                Schedule
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
      <div className="w-full text-left font-sans p-6 rounded-3xl bg-gray-50 border border-gray-200 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-700 flex items-center justify-center mx-auto">
          <FileText size={24} />
        </div>
        <h4 className="text-sm font-extrabold text-gray-950">Candidate Resume Not Found</h4>
        <p className="text-xs text-gray-600 font-medium max-w-md mx-auto">
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
          <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-md shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-gray-950 tracking-tight">{candidate_name}</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-black text-white border border-black">
                {match_score} Match
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium">
              {title} • <span className="text-gray-900 font-bold">Vendor: {vendor_name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-gray-100 text-gray-900 border border-gray-200 uppercase">
            {candidate_status}
          </span>
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="px-3.5 py-1.5 rounded-xl bg-black hover:bg-gray-800 text-white text-[11px] font-extrabold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
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
              ? 'bg-black text-white shadow-xs'
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
              ? 'bg-black text-white shadow-xs'
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
              ? 'bg-black text-white shadow-xs'
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
            className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-black hover:text-white text-gray-900 border border-gray-200 text-xs font-extrabold transition flex items-center gap-1 cursor-pointer"
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
                  <FileText size={16} className="text-white" />
                  <span className="text-xs font-black text-white tracking-wide">
                    Live PDF Document ({filename || `${candidate_name.replace(/\s+/g, '_')}_Resume.pdf`})
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-white/10 text-white border border-white/20 uppercase">
                    Interactive Viewer Active
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={pdfDataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition flex items-center gap-1.5"
                  >
                    <ExternalLink size={13} />
                    <span>Open Full Tab</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-gray-200 text-black text-[11px] font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm"
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
            <div className="p-6 rounded-3xl bg-gray-50 border border-gray-200 text-center space-y-2">
              <AlertTriangle size={24} className="text-gray-900 mx-auto" />
              <h4 className="text-sm font-extrabold text-gray-950">PDF Document Stream Unavailable</h4>
              <p className="text-xs text-gray-600">
                Raw PDF binary file is not attached for this record. Showing parsed text document instead:
              </p>
              <div className="max-h-64 overflow-y-auto font-mono text-[11px] text-gray-800 text-left leading-relaxed whitespace-pre-wrap p-3 bg-white rounded-2xl border border-gray-200 mt-2">
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
              <span className="font-extrabold text-gray-900 block mt-0.5">{recommendation}</span>
            </div>
          </div>

          {/* AI Executive Summary Card */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-gray-950 font-extrabold text-xs">
                <Sparkles size={14} className="text-gray-900" />
                <span>AI Executive Evaluation Summary</span>
              </div>
              <span className="text-[10px] font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
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
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-gray-100 text-gray-900 border border-gray-200 shadow-2xs"
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
              <FileText size={15} className="text-white" />
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
          <Calendar size={14} className="text-white" />
          <span>Schedule Interview</span>
        </button>
      </div>
    </div>
  );
}

/* ── 10.7 Company Admin Widgets (Hiring Managers, Invites, Interviews) ─────── */
function HiringManagersConsoleWidget({ managers = [], companyName = 'Company', onSendMessage, onCopy }) {
  const [searchTerm, setSearchTerm] = useState('');
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return managers;
    const q = searchTerm.toLowerCase();
    return managers.filter(m => (m.name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q) || (m.department || '').toLowerCase().includes(q));
  }, [managers, searchTerm]);

  return (
    <div className="w-full text-left font-sans space-y-3">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-gray-950" />
          <div>
            <h3 className="text-sm font-extrabold text-gray-950">{companyName} Hiring Managers & Leads</h3>
            <p className="text-[11px] text-gray-500">Departmental managers authorized to review candidates</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-900 border border-gray-200">
            {managers.length} Active Leads
          </span>
          <button
            type="button"
            onClick={() => onSendMessage && onSendMessage('Invite a new hiring manager to our company')}
            className="px-2.5 py-1 rounded-xl bg-black text-white hover:bg-gray-900 font-bold text-[10px] shadow-2xs cursor-pointer transition hover:scale-102 flex items-center gap-1"
          >
            <Plus size={10} />
            Invite Lead
          </button>
        </div>
      </div>

      {/* Quick Search */}
      <div className="relative">
        <Search size={12} className="absolute left-3 top-2.5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter by name, department, or email..."
          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/80 border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((m, i) => (
          <div key={m.id || i} className="p-3 rounded-2xl bg-white border border-gray-200 flex flex-col justify-between text-xs shadow-2xs hover:border-black transition-all group">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-extrabold text-gray-950 truncate group-hover:text-black">{m.name}</div>
                <div className="text-[11px] text-gray-500 truncate">{m.email}</div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[9.5px] font-semibold">
                    {m.department || 'Engineering'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-800 border border-gray-200 text-[9px] font-bold">
                    {m.status || 'Active'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCopy && onCopy(m.email, m.email)}
                className="p-1.5 rounded-xl bg-gray-100 hover:bg-black hover:text-white text-gray-600 transition-colors cursor-pointer shrink-0"
                title="Copy Email"
              >
                <Copy size={12} />
              </button>
            </div>
            <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-mono">Role: {m.role || 'Hiring Manager'}</span>
              <button
                type="button"
                onClick={() => onSendMessage && onSendMessage(`Show active requisitions and candidate pipeline for ${m.name}`)}
                className="text-[10.5px] font-bold text-gray-900 hover:text-black transition flex items-center gap-0.5 cursor-pointer"
              >
                Pipeline <ChevronRight size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanyProfileWidget({ profile = {}, companyName = 'Company', onSendMessage }) {
  const stack = Array.isArray(profile.tech_stack)
    ? profile.tech_stack
    : (typeof profile.tech_stack === 'string' ? profile.tech_stack.split(',').map((s) => s.trim()) : ['React', 'Python', 'AWS', 'Kubernetes']);

  return (
    <div className="w-full text-left font-sans space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-gray-950" />
          <div>
            <h3 className="text-sm font-extrabold text-gray-950">{profile.name || companyName} Organization Profile</h3>
            <p className="text-[11px] text-gray-500">Verified enterprise details & technical infrastructure</p>
          </div>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-800 border border-gray-200 uppercase">
          Verified Enterprise
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 rounded-2xl bg-white/70 border border-white/90 shadow-2xs">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Industry</div>
          <div className="text-xs font-black text-gray-900 mt-1 truncate">{profile.industry || 'Technology Services'}</div>
        </div>
        <div className="p-3 rounded-2xl bg-white/70 border border-white/90 shadow-2xs">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Location</div>
          <div className="text-xs font-black text-gray-900 mt-1 truncate">{profile.location || 'Bengaluru / Global'}</div>
        </div>
        <div className="p-3 rounded-2xl bg-white/70 border border-white/90 shadow-2xs">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Enterprise Size</div>
          <div className="text-xs font-black text-gray-900 mt-1 truncate">{profile.company_size || '1,000+ employees'}</div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white/80 border border-white/95 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-gray-950">About Organization</h4>
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-bold text-gray-900 hover:text-black flex items-center gap-1"
            >
              <span>{profile.website.replace(/^https?:\/\//, '')}</span>
              <ExternalLink size={11} />
            </a>
          )}
        </div>
        <p className="text-xs text-gray-700 leading-relaxed font-medium">
          {profile.about || `${companyName} is an enterprise organization managing digital transformations and specialized engineering pipelines.`}
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-white/80 border border-white/95 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-gray-950">Technology Stack & Platforms</h4>
          <span className="text-[10px] text-gray-400 font-semibold">{stack.length} Core Technologies</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {stack.map((tech, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white border border-gray-200 text-gray-800 shadow-3xs"
            >
              ⚡ {tech}
            </span>
          ))}
        </div>
      </div>

      <div className="p-2.5 rounded-xl bg-white/60 border border-white/80 shadow-3xs flex items-center justify-between gap-2">
        <span className="text-[11px] text-gray-600 font-medium">Want to explore our active roles or team?</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSendMessage && onSendMessage('Show our active job requisitions')}
            className="px-2.5 py-1 rounded-lg bg-black text-white hover:bg-gray-800 font-bold text-[10px] transition cursor-pointer"
          >
            Requisitions
          </button>
          <button
            type="button"
            onClick={() => onSendMessage && onSendMessage('List all hiring managers in our company')}
            className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-800 hover:text-black font-bold text-[10px] transition cursor-pointer"
          >
            Hiring Managers
          </button>
        </div>
      </div>
    </div>
  );
}

function DraftInviteHiringManagerWidget({ draft = {}, onSendMessage }) {
  const [formData, setFormData] = useState({
    name: draft.name || 'Marcus Vance',
    email: draft.email || 'm.vance@company.com',
    department: draft.department || 'Cloud & Infra Engineering',
  });

  useEffect(() => {
    if (draft) {
      setFormData({
        name: draft.name || '',
        email: draft.email || '',
        department: draft.department || 'Engineering'
      });
    }
  }, [draft]);

  const handleExecute = () => {
    if (!formData.name.trim() || !formData.email.trim()) return;
    onSendMessage(`CONFIRM_EXECUTE_INVITE: name="${formData.name.trim()}", email="${formData.email.trim()}", department="${formData.department.trim()}"`);
  };

  return (
    <div className="w-full text-left font-sans space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-gray-950" />
          <div>
            <h3 className="text-sm font-extrabold text-gray-950">Invite Hiring Manager</h3>
            <p className="text-[11px] text-gray-500">Provision portal access and departmental requisition privileges</p>
          </div>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-900 border border-gray-200">
          Invitation Draft
        </span>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-3 text-xs">
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">Full Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Marcus Vance"
            className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold focus:outline-none focus:border-black"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">Corporate Email Address</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="e.g. m.vance@company.com"
            className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold focus:outline-none focus:border-black"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">Department</label>
          <input
            type="text"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            placeholder="e.g. Cloud & Infra Engineering"
            className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold focus:outline-none focus:border-black"
          />
        </div>

        <div className="pt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleExecute}
            className="flex-1 py-2 rounded-xl bg-black text-white hover:bg-gray-800 font-extrabold text-xs shadow-md cursor-pointer transition hover:scale-101 flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 size={13} />
            Confirm & Send Invitation
          </button>
          <button
            type="button"
            onClick={() => onSendMessage('Cancel hiring manager invitation')}
            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteHiringManagerSuccessWidget({ data = {}, onSendMessage, onCopy }) {
  return (
    <div className="w-full text-left font-sans space-y-4 animate-in fade-in duration-300">
      <div className="p-4 rounded-3xl bg-gray-50 border border-gray-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shrink-0 shadow-sm">
          <CheckCircle2 size={20} />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-gray-950">Hiring Manager Provisioned</h3>
          <p className="text-[11px] text-gray-600 font-medium">Access credentials generated and invitation ready</p>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2.5 text-xs">
        <div className="flex justify-between items-center py-1 border-b border-gray-100">
          <span className="text-gray-400 font-medium">Name:</span>
          <span className="font-extrabold text-gray-900">{data.name}</span>
        </div>
        <div className="flex justify-between items-center py-1 border-b border-gray-100">
          <span className="text-gray-400 font-medium">Email:</span>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-gray-900">{data.email}</span>
            <button
              type="button"
              onClick={() => onCopy && onCopy(data.email, data.email)}
              className="p-1 rounded-lg bg-gray-100 hover:bg-black hover:text-white transition text-gray-600"
            >
              <Copy size={11} />
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center py-1 border-b border-gray-100">
          <span className="text-gray-400 font-medium">Department:</span>
          <span className="font-semibold text-gray-700">{data.department || 'Engineering'}</span>
        </div>
        <div className="flex justify-between items-center py-1">
          <span className="text-gray-400 font-medium">Role:</span>
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 font-bold text-[10px]">Hiring Manager</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSendMessage && onSendMessage('List all hiring managers')}
        className="w-full py-2 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
      >
        <Users size={12} />
        View All Hiring Managers
      </button>
    </div>
  );
}

function InterviewScheduledWidget({ data = {}, onSendMessage, onCopy }) {
  return (
    <div className="w-full text-left font-sans space-y-4 animate-in fade-in duration-300">
      <div className="p-4 rounded-3xl bg-gray-50 border border-gray-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shrink-0 shadow-sm">
          <Calendar size={20} />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-gray-950">Interview Scheduled</h3>
          <p className="text-[11px] text-gray-600 font-medium">Candidate calendar invite and virtual room ready</p>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2.5 text-xs">
        <div className="flex justify-between items-center py-1 border-b border-gray-100">
          <span className="text-gray-400 font-medium">Candidate:</span>
          <span className="font-extrabold text-gray-900">{data.candidate_name}</span>
        </div>
        <div className="flex justify-between items-center py-1 border-b border-gray-100">
          <span className="text-gray-400 font-medium">Interview Round:</span>
          <span className="font-bold text-gray-900">{data.round || 'Technical Round'}</span>
        </div>
        <div className="flex justify-between items-center py-1 border-b border-gray-100">
          <span className="text-gray-400 font-medium">Scheduled Time:</span>
          <span className="font-bold text-gray-900">{data.scheduled_time}</span>
        </div>
        <div className="flex justify-between items-center py-1 border-b border-gray-100">
          <span className="text-gray-400 font-medium">Interviewer:</span>
          <span className="font-semibold text-gray-700">{data.interviewer || 'Hiring Manager'}</span>
        </div>
        {data.meeting_link && (
          <div className="flex justify-between items-center py-1">
            <span className="text-gray-400 font-medium">Meeting Room:</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-gray-500 truncate max-w-[160px]">{data.meeting_link}</span>
              <button
                type="button"
                onClick={() => onCopy && onCopy(data.meeting_link, data.meeting_link)}
                className="p-1 rounded-lg bg-gray-100 hover:bg-black hover:text-white transition text-gray-600"
                title="Copy Link"
              >
                <Copy size={11} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSendMessage && onSendMessage(`Show profile dossier for ${data.candidate_name}`)}
          className="flex-1 py-2 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
        >
          <UserCheck size={12} />
          Candidate Profile
        </button>
        <button
          type="button"
          onClick={() => onSendMessage && onSendMessage('Show shortlisted candidates')}
          className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs cursor-pointer transition"
        >
          Candidate Pool
        </button>
      </div>
    </div>
  );
}

/* ── 10.8 Statistical Analytics Dashboard Widget (SuperAdmin & CompanyAdmin) ── */
function StatisticalDashboardWidget({ isCompanyAdmin = false, companyName = 'Company', onSendMessage, onClose }) {
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
    platform_activities: [],
    total_hiring_managers: 0,
    total_directors: 0,
    total_requisitions: 0,
    live_requisitions: 0,
    draft_requisitions: 0,
    shortlisted_candidates: 0,
    hiring_managers: [],
    requisitions: []
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchLiveStats = async () => {
    try {
      setIsLoading(true);
      const endpoint = isCompanyAdmin ? '/api/company-admin/agent/stats' : '/api/superadmin/agent/stats';
      const res = await request(endpoint);
      if (res && (res.status === 'success' || res.total_hiring_managers !== undefined || res.total_companies !== undefined)) {
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
  }, [isCompanyAdmin]);

  if (isCompanyAdmin) {
    const managersList = stats.hiring_managers || [];
    return (
      <div className="w-full text-left font-sans space-y-2.5 animate-in fade-in duration-200">
        {/* Live DB Status Bar */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-900 animate-pulse"></span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              {companyName} Admin Management Console
            </span>
            <span className="text-[9.5px] text-gray-400 font-mono">
              ({stats.total_hiring_managers || managersList.length} Leads · {stats.live_requisitions || 0} Live Requisitions)
            </span>
          </div>
          <button
            type="button"
            onClick={fetchLiveStats}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold text-gray-600 hover:text-gray-950 bg-white/70 hover:bg-white border border-white/90 shadow-2xs transition cursor-pointer active:scale-95"
            title="Refresh Live Data"
          >
            <RefreshCw size={9} className={isLoading ? 'animate-spin text-black' : ''} />
            <span>{isLoading ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>

        {/* Company Admin Key Metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-white/50 backdrop-blur-md border border-white/70 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-black/5 text-gray-950 flex items-center justify-center shrink-0">
                <Users size={14} />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black text-gray-950 leading-none">{stats.total_hiring_managers || managersList.length || 0}</div>
                <div className="text-[10px] font-bold text-gray-500 mt-0.5 truncate">Hiring Leads</div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/50 backdrop-blur-md border border-white/70 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-black/5 text-gray-950 flex items-center justify-center shrink-0">
                <Briefcase size={14} />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black text-gray-950 leading-none">{stats.live_requisitions || stats.total_requisitions || 0}</div>
                <div className="text-[10px] font-bold text-gray-500 mt-0.5 truncate">Active Roles</div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/50 backdrop-blur-md border border-white/70 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-black/5 text-gray-950 flex items-center justify-center shrink-0">
                <UserCheck size={14} />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black text-gray-950 leading-none">{stats.shortlisted_candidates || 0}</div>
                <div className="text-[10px] font-bold text-gray-500 mt-0.5 truncate">Shortlisted</div>
              </div>
            </div>
          </div>
        </div>

        {/* Directory & Quick Lists */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Hiring Managers Card */}
          <div className="p-3 rounded-xl bg-white/50 backdrop-blur-md border border-white/70 shadow-2xs space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-black/[0.04]">
              <div className="flex items-center gap-1.5">
                <Users size={12} className="text-gray-950" />
                <h4 className="text-[11.5px] font-extrabold text-gray-950">Hiring Managers</h4>
              </div>
              <button
                type="button"
                onClick={() => onSendMessage && onSendMessage('Invite a new hiring manager to our company')}
                className="text-[9.5px] font-bold text-gray-900 hover:text-black transition"
              >
                + Invite
              </button>
            </div>

            <div className="space-y-1.5">
              {managersList.length > 0 ? (
                managersList.slice(0, 4).map((m, i) => (
                  <div
                    key={m.id || i}
                    onClick={() => onSendMessage && onSendMessage(`Show requisitions and pipeline for ${m.name}`)}
                    className="p-2 rounded-lg bg-white/60 hover:bg-white/90 border border-white/80 shadow-3xs transition cursor-pointer group"
                  >
                    <div className="font-bold text-gray-900 text-xs group-hover:text-black truncate">{m.name}</div>
                    <div className="text-[9.5px] text-gray-400 mt-0.5 truncate">{m.department || 'Engineering'}</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-2 text-xs text-gray-400 font-medium">No managers listed</div>
              )}
            </div>
          </div>

          {/* Hiring Operations Card */}
          <div className="p-3 rounded-xl bg-white/50 backdrop-blur-md border border-white/70 shadow-2xs space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-black/[0.04]">
              <div className="flex items-center gap-1.5">
                <Briefcase size={12} className="text-gray-950" />
                <h4 className="text-[11.5px] font-extrabold text-gray-950">Quick Navigation</h4>
              </div>
            </div>

            <div className="space-y-1.5">
              <div
                onClick={() => onSendMessage && onSendMessage('Show our active job requisitions')}
                className="p-2 rounded-lg bg-white/60 hover:bg-white/90 border border-white/80 shadow-3xs transition cursor-pointer group flex items-center justify-between"
              >
                <div className="font-bold text-gray-900 text-xs group-hover:text-black">Job Requisitions</div>
                <ChevronRight size={12} className="text-gray-400 group-hover:text-black" />
              </div>

              <div
                onClick={() => onSendMessage && onSendMessage('List shortlisted candidates across open positions')}
                className="p-2 rounded-lg bg-white/60 hover:bg-white/90 border border-white/80 shadow-3xs transition cursor-pointer group flex items-center justify-between"
              >
                <div className="font-bold text-gray-900 text-xs group-hover:text-black">Candidate Pool</div>
                <ChevronRight size={12} className="text-gray-400 group-hover:text-black" />
              </div>

              <div
                onClick={() => onSendMessage && onSendMessage('Show company profile and verified details')}
                className="p-2 rounded-lg bg-white/60 hover:bg-white/90 border border-white/80 shadow-3xs transition cursor-pointer group flex items-center justify-between"
              >
                <div className="font-bold text-gray-900 text-xs group-hover:text-black">Company Profile</div>
                <ChevronRight size={12} className="text-gray-400 group-hover:text-black" />
              </div>
            </div>
          </div>
        </div>

        {/* Company Admin Quick Actions & Controls */}
        <div className="p-2.5 rounded-xl bg-white/50 backdrop-blur-md border border-white/70 shadow-2xs flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-gray-950" />
            <span className="text-[11px] font-bold text-gray-900">Admin Actions</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => onSendMessage && onSendMessage('Invite a new hiring manager to our company')}
              className="px-2.5 py-1 rounded-full bg-white/70 hover:bg-white border border-white/90 text-gray-800 font-bold text-[10px] shadow-3xs cursor-pointer transition hover:scale-102 flex items-center gap-1"
            >
              <Plus size={10} />
              Invite Manager
            </button>
            <button
              type="button"
              onClick={() => onSendMessage && onSendMessage('Draft a new job requisition')}
              className="px-2.5 py-1 rounded-full bg-white/70 hover:bg-white border border-white/90 text-gray-800 font-bold text-[10px] shadow-3xs cursor-pointer transition hover:scale-102 flex items-center gap-1"
            >
              <Plus size={10} />
              New Requisition
            </button>
            <button
              type="button"
              onClick={() => onSendMessage && onSendMessage('List all hiring managers in our company')}
              className="px-2.5 py-1 rounded-full bg-black text-white hover:bg-gray-800 font-bold text-[10px] shadow-3xs cursor-pointer transition hover:scale-102 flex items-center gap-1"
            >
              👥 Managers
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full text-left font-sans space-y-2.5 animate-in fade-in duration-200">
      {/* Live DB Status Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-900 animate-pulse"></span>
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
          <RefreshCw size={9} className={isLoading ? 'animate-spin text-black' : ''} />
          <span>{isLoading ? 'Syncing...' : 'Sync'}</span>
        </button>
      </div>

      {/* Super Admin Metric - Total Companies Only */}
      <div className="p-3.5 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/95 shadow-2xs hover:shadow-xs transition flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-black/5 text-gray-950 flex items-center justify-center border border-gray-200 shrink-0">
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
            <Building2 size={12} className="text-gray-950" />
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
            <Layers size={12} className="text-gray-950" />
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
                      <Building2 size={11} className="text-gray-950" />
                    ) : act.type === 'vendor' ? (
                      <Layers size={11} className="text-gray-950" />
                    ) : act.type === 'admin' ? (
                      <ShieldCheck size={11} className="text-gray-950" />
                    ) : (
                      <Users size={11} className="text-gray-950" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 text-xs truncate group-hover:text-black">{act.title}</div>
                    <div className="text-[9.5px] text-gray-400 truncate">{act.desc}</div>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 bg-gray-100 text-gray-900 border-gray-200">
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
          <Sparkles size={13} className="text-gray-950" />
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
            className="px-2.5 py-1 rounded-xl bg-black text-white hover:bg-gray-800 font-bold text-[10px] shadow-2xs cursor-pointer transition hover:scale-102 flex items-center gap-1"
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
          <ShieldCheck size={18} className="text-gray-950" />
          <div>
            <h3 className="text-sm font-extrabold text-gray-950">Super Admin King DB Overview</h3>
            <p className="text-[11px] text-gray-500">Unrestricted full database controller inspection</p>
          </div>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-900 border border-gray-200 uppercase">
          FULL ACCESS
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-2xl glass-card text-center">
          <div className="text-[9.5px] font-black text-gray-400 uppercase">Tenants</div>
          <div className="text-xl font-black text-gray-950 mt-0.5">{summary.total_tenants || tenants.length || 0}</div>
        </div>
        <div className="p-3 rounded-2xl glass-card text-center">
          <div className="text-[9.5px] font-black text-gray-400 uppercase">Users</div>
          <div className="text-xl font-black text-gray-950 mt-0.5">{summary.total_user_accounts || 34}</div>
        </div>
        <div className="p-3 rounded-2xl glass-card text-center">
          <div className="text-[9.5px] font-black text-gray-400 uppercase">Requisitions</div>
          <div className="text-xl font-black text-gray-950 mt-0.5">{summary.sql_requisitions || summary.mongo_requisitions || 26}</div>
        </div>
        <div className="p-3 rounded-2xl glass-card text-center">
          <div className="text-[9.5px] font-black text-gray-400 uppercase">Candidates</div>
          <div className="text-xl font-black text-gray-950 mt-0.5">{summary.candidate_submissions || 24}</div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-extrabold text-gray-950">Active Platform Tenants ({tenants.length})</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

/* ── 11.5 POPUP MODAL TAB COMPONENT & INTERACTIVE WIDGET CONTAINER ────────────── */

function InteractiveWidgetContainer({ activeWidget, companyName, isCompanyAdmin, onSendMessage, copyToClipboard, onClose }) {
  if (!activeWidget) return null;

  return (
    <div className="space-y-4">
      {activeWidget.type === 'hiring_managers_console' && (
        <HiringManagersConsoleWidget
          managers={Array.isArray(activeWidget.data) ? activeWidget.data : (activeWidget.data?.hiring_managers || activeWidget.data?.managers || [])}
          companyName={companyName}
          onSendMessage={onSendMessage}
          onCopy={copyToClipboard}
        />
      )}

      {activeWidget.type === 'company_admin_stats' && (
        <StatisticalDashboardWidget
          isCompanyAdmin={isCompanyAdmin}
          companyName={companyName}
          onSendMessage={onSendMessage}
          onClose={onClose}
        />
      )}

      {activeWidget.type === 'company_profile' && (
        <CompanyProfileWidget
          profile={activeWidget.data}
          companyName={companyName}
          onSendMessage={onSendMessage}
        />
      )}

      {activeWidget.type === 'draft_invite_hm' && (
        <DraftInviteHiringManagerWidget
          draft={activeWidget.data}
          onSendMessage={onSendMessage}
        />
      )}

      {activeWidget.type === 'invite_hm_success' && (
        <InviteHiringManagerSuccessWidget
          data={activeWidget.data}
          onSendMessage={onSendMessage}
          onCopy={copyToClipboard}
        />
      )}

      {activeWidget.type === 'interview_scheduled' && (
        <InterviewScheduledWidget
          data={activeWidget.data}
          onSendMessage={onSendMessage}
          onCopy={copyToClipboard}
        />
      )}

      {activeWidget.type === 'password_change_confirm' && (
        <PasswordChangeConfirmWidget data={activeWidget.data} onSendMessage={onSendMessage} />
      )}

      {activeWidget.type === 'password_updated_success' && (
        <PasswordUpdatedSuccessWidget data={activeWidget.data} onSendMessage={onSendMessage} />
      )}

      {activeWidget.type === 'tenant_delete_confirm' && (
        <TenantDeleteConfirmWidget data={activeWidget.data} onSendMessage={onSendMessage} />
      )}

      {activeWidget.type === 'tenant_deleted_success' && (
        <TenantDeletedSuccessWidget data={activeWidget.data} onSendMessage={onSendMessage} />
      )}

      {activeWidget.type === 'tenant_console' && (
        <TenantConsoleWidget
          tenants={activeWidget.data}
          onSendMessage={onSendMessage}
          onCopy={copyToClipboard}
        />
      )}

      {activeWidget.type === 'admin_accounts' && (
        <AdminAccountsWidget users={activeWidget.data} onCopy={copyToClipboard} />
      )}

      {activeWidget.type === 'platform_metrics' && (
        <PlatformMetricsWidget stats={activeWidget.data} onSendMessage={onSendMessage} />
      )}

      {activeWidget.type === 'onboard_draft' && (
        <OnboardingDraftPreviewWidget draft={activeWidget.data} onSendMessage={onSendMessage} />
      )}

      {activeWidget.type === 'onboard_success' && (
        <OnboardingSuccessWidget
          data={activeWidget.data}
          onSendMessage={onSendMessage}
          onCopy={copyToClipboard}
        />
      )}

      {activeWidget.type === 'requisitions_console' && (
        <RequisitionsConsoleWidget
          requisitions={activeWidget.data}
          vendorName={activeWidget.vendorName}
          onSendMessage={onSendMessage}
        />
      )}

      {activeWidget.type === 'candidates_console' && (
        <CandidatesConsoleWidget
          candidates={activeWidget.data}
          vendorName={activeWidget.vendorName}
          onSendMessage={onSendMessage}
          onCopy={copyToClipboard}
        />
      )}

      {activeWidget.type === 'candidate_resume' && (
        <CandidateResumeWidget
          data={activeWidget.data}
          onSendMessage={onSendMessage}
          onCopy={copyToClipboard}
        />
      )}

      {activeWidget.type === 'database_controller' && (
        <DatabaseControllerWidget
          dbData={activeWidget.data}
          onSendMessage={onSendMessage}
          onCopy={copyToClipboard}
        />
      )}

      {(![
        'hiring_managers_console', 'draft_invite_hm', 'invite_hm_success',
        'interview_scheduled', 'password_change_confirm', 'password_updated_success',
        'tenant_delete_confirm', 'tenant_deleted_success', 'tenant_console',
        'admin_accounts', 'platform_metrics', 'onboard_draft', 'onboard_success',
        'requisitions_console', 'candidates_console', 'candidate_resume', 'database_controller',
        'company_admin_stats', 'company_profile'
      ].includes(activeWidget.type)) && (
        <StatisticalDashboardWidget
          isCompanyAdmin={isCompanyAdmin}
          companyName={companyName}
          onSendMessage={onSendMessage}
          onClose={onClose}
        />
      )}
    </div>
  );
}

function TableModalTab({ modalData, onClose, onSendMessage, copyToClipboard, isCompanyAdmin, companyName, splitIndex = 0, totalTabs = 1 }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!modalData) return null;

  const { title, headers = [], rows = [], rawMarkdown, widget } = modalData;
  const hasTableData = rows && rows.length > 0;
  const hasWidgetData = Boolean(widget);

  const filteredRows = hasTableData ? rows : [];

  return (
    <div className="w-full flex flex-col overflow-hidden rounded-2xl border border-white/80 shadow-[0_8px_32px_0_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] bg-white/50 backdrop-blur-2xl text-gray-900 font-sans max-h-full">
      {/* Top Header Bar - Seamlessly joined into the top of the card */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-black/[0.04] bg-white/30 backdrop-blur-md shrink-0 gap-3">
        <h3 className="font-extrabold text-xs sm:text-[13.5px] text-gray-950 tracking-tight flex-1 truncate">
          {title || 'Enterprise Data View'}
        </h3>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-white/60 hover:bg-white/90 border border-white/80 backdrop-blur-md flex items-center justify-center text-gray-600 hover:text-black transition cursor-pointer shadow-3xs active:scale-95 shrink-0"
          title={totalTabs > 1 ? `Close Tab ${splitIndex + 1}` : 'Close Popup Tab (ESC)'}
        >
          <X size={14} />
        </button>
      </div>

      {/* Content Body - Contained directly inside the single unified card */}
      <div className="flex-1 overflow-auto scrollbar-thin min-h-0">
        {!hasTableData && hasWidgetData ? (
          <div className="p-4 sm:p-5 animate-in fade-in duration-150">
            <InteractiveWidgetContainer
              activeWidget={widget}
              companyName={companyName}
              isCompanyAdmin={isCompanyAdmin}
              onSendMessage={(txt) => onSendMessage(txt)}
              copyToClipboard={copyToClipboard}
              onClose={onClose}
            />
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-xs sm:text-[13px]">
              <thead>
                <tr className="bg-white/60 backdrop-blur-md border-b border-black/[0.04] sticky top-0 z-10">
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      className="py-3 px-4 font-extrabold text-gray-700 uppercase tracking-wider text-[11px] whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03]">
                {filteredRows.length > 0 ? (
                  filteredRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-white/50 transition-colors">
                      {row.map((cell, cIdx) => {
                        const val = String(cell || '').trim();
                        const valLower = val.toLowerCase();
                        const isStatus = ['active', 'shortlisted', 'accepted', 'screened', 'rejected', 'pending', 'published'].includes(valLower);
                        const isEmail = val.includes('@') && !val.includes(' ');

                        return (
                          <td key={cIdx} className="py-3.5 px-4 font-medium text-gray-800 align-middle">
                            {isStatus ? (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  valLower === 'active' || valLower === 'accepted' || valLower === 'published'
                                    ? 'bg-black text-white border border-black shadow-xs'
                                    : 'bg-white/60 backdrop-blur-md text-gray-800 border border-white/80 shadow-3xs'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  valLower === 'active' || valLower === 'accepted' || valLower === 'published'
                                    ? 'bg-white'
                                    : 'bg-gray-400'
                                }`} />
                                {val}
                              </span>
                            ) : isEmail ? (
                              <a
                                href={`mailto:${val}`}
                                className="text-gray-900 hover:text-black hover:underline font-mono text-xs"
                              >
                                {val}
                              </a>
                            ) : (
                              <span>{val || '—'}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={headers.length || 1} className="py-8 text-center text-gray-400 font-medium text-xs">
                      No matching records found{searchQuery ? ` for "${searchQuery}"` : ''}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
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

export const getInitialWelcomeMessage = (userName, isCompanyAdmin = false, companyName = 'Company') => {
  const name = (() => {
    if (!userName || typeof userName !== 'string') return isCompanyAdmin ? 'Admin' : 'Alex';
    const trimmed = userName.trim();
    if (trimmed.toLowerCase().includes('super') || trimmed.toLowerCase() === 'admin') {
      return isCompanyAdmin ? 'Admin' : 'Alex';
    }
    return trimmed.split(' ')[0];
  })();

  return {
    id: 'welcome-init',
    role: 'assistant',
    isWelcome: true,
    userName: name,
    isCompanyAdmin,
    companyName,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
};

export default function AiChat() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isCompanyAdmin = user?.role === 'Admin' || location.pathname.includes('/admin/chat');
  const companyName = user?.tenant_name || user?.company_name || 'TCS';

  // Initial focused state: Full-width Chat, popup tab modal supporting dual/split multi-view comparison
  const [modalTabs, setModalTabs] = useState([]);
  const modalTabsRef = useRef(modalTabs);
  useEffect(() => {
    modalTabsRef.current = modalTabs;
  }, [modalTabs]);
  const tableModal = modalTabs.length > 0 ? modalTabs[0] : null;

  const setTableModal = (val) => {
    if (!val) {
      setModalTabs([]);
    } else if (Array.isArray(val)) {
      setModalTabs(val);
    } else {
      setModalTabs([val]);
    }
  };

  const handleCloseTab = (indexToClose) => {
    setModalTabs((prev) => prev.filter((_, idx) => idx !== indexToClose));
  };
  const [isAnalyticsVisible, setIsAnalyticsVisible] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsMenuRef = useRef(null);
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);
  const sessionDropdownRef = useRef(null);

  const [messages, setMessages] = useState(() => [getInitialWelcomeMessage(user?.name, isCompanyAdmin, companyName)]);
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'review'

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNewChat = () => {
    setActiveTab('new');
    setMessages([getInitialWelcomeMessage(user?.name, isCompanyAdmin, companyName)]);
    setIsAnalyticsVisible(false);
    setActiveWidget(null);
    setTableModal(null);
    setInput('');
  };

  const handleLoadQ3Review = () => {
    setActiveTab('review');
    setMessages(Q3_REVIEW_CONVERSATION);
    setIsAnalyticsVisible(true);
  };

  // Sync initial welcome message if user profile loads asynchronously
  useEffect(() => {
    if (user?.name || user?.role) {
      setMessages((prev) => {
        if (prev.length === 1 && prev[0]?.id === 'welcome-init') {
          return [getInitialWelcomeMessage(user.name, isCompanyAdmin, companyName)];
        }
        return prev;
      });
    }
  }, [user?.name, user?.role, isCompanyAdmin, companyName]);

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
  const projectedEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const ttsPlaybackIdRef = useRef(0);
  const vadStartupTimeRef = useRef(0);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      showToast(`Attached: ${file.name}`);
      setInput((prev) => (prev ? `${prev} [Attached: ${file.name}]` : `Analyze file: ${file.name}`));
    }
  };

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
    const reqAction = executedActions.find((a) => a.tool === 'list_hiring_requisitions' || a.tool === 'list_requisitions_by_vendor' || a.tool === 'list_company_requisitions' || a.tool === 'create_hiring_requisition');
    const candidateAction = executedActions.find((a) => a.tool === 'list_shortlisted_candidates' || a.tool === 'list_candidates_by_vendor');
    const candidateResumeAction = executedActions.find((a) => a.tool === 'get_candidate_resume' || a.tool === 'get_candidate_profile_details');
    const dbQueryAction = executedActions.find((a) => a.tool === 'query_database_all_entities');
    const hmAction = executedActions.find((a) => a.tool === 'list_company_hiring_managers');
    const hmDirectorsAction = executedActions.find((a) => a.tool === 'list_company_directors');
    const draftInviteHmAction = executedActions.find((a) => a.tool === 'draft_invite_hiring_manager');
    const createHmAction = executedActions.find((a) => a.tool === 'create_company_hiring_manager');
    const scheduleInterviewAction = executedActions.find((a) => a.tool === 'schedule_candidate_interview');
    const companyStatsAction = executedActions.find((a) => a.tool === 'get_company_admin_stats');
    const companyProfileAction = executedActions.find((a) => a.tool === 'get_company_profile');

    let widgetObj = null;
    let textNotice = cleanReplyText(replyContent) || 'Action executed successfully.';

    if (draftInviteHmAction) {
      widgetObj = { type: 'draft_invite_hm', title: 'Hiring Manager Invitation Preview', data: draftInviteHmAction.result || {} };
      textNotice = cleanReplyText(replyContent) || `I have prepared the hiring manager invitation card on your right Output Display panel.`;
    } else if (createHmAction) {
      widgetObj = { type: 'invite_hm_success', title: 'Hiring Manager Provisioned', data: createHmAction.result || {} };
      textNotice = cleanReplyText(replyContent) || `Hiring Manager has been provisioned successfully.`;
    } else if (scheduleInterviewAction) {
      widgetObj = { type: 'interview_scheduled', title: 'Candidate Interview Scheduled', data: scheduleInterviewAction.result || {} };
      textNotice = cleanReplyText(replyContent) || `Candidate interview has been scheduled.`;
    } else if (hmAction) {
      widgetObj = { type: 'hiring_managers_console', title: `${companyName} Hiring Managers Directory`, data: hmAction.result || [] };
      textNotice = cleanReplyText(replyContent) || `All registered hiring managers are now displayed on the right Output Display panel.`;
    } else if (hmDirectorsAction) {
      widgetObj = { type: 'hiring_managers_console', title: `${companyName} Leadership & Directors`, data: hmDirectorsAction.result || [] };
      textNotice = cleanReplyText(replyContent) || `Company directors are now displayed on the right Output Display panel.`;
    } else if (companyProfileAction) {
      widgetObj = { type: 'company_profile', title: `${companyName} Organization Profile`, data: companyProfileAction.result || {} };
      textNotice = cleanReplyText(replyContent) || `Organization profile and details are now displayed on the right Output Display panel.`;
    } else if (companyStatsAction) {
      widgetObj = { type: 'company_admin_stats', title: `${companyName} Real-Time Hiring Metrics`, data: companyStatsAction.result || {} };
      textNotice = cleanReplyText(replyContent) || `Real-time hiring metrics are now displayed on the right panel.`;
    } else if (passwordDraftAction) {
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
      // Connect to real backend Agent API (SuperAdmin or Company Admin)
      const chatEndpoint = isCompanyAdmin ? '/api/company-admin/agent/chat' : '/api/superadmin/agent/chat';
      const userRole = isCompanyAdmin ? 'Admin' : (user?.role || 'Super Admin');
      const userName = user?.name || (isCompanyAdmin ? `${companyName} Admin` : 'Super Admin');

      const res = await request(chatEndpoint, {
        method: 'POST',
        token,
        body: {
          prompt: textToSend,
          history: newMessages.map((m) => ({ role: m.role, content: m.content || m.heading || '' })),
          user_role: userRole,
          user_name: userName,
          tenant_id: user?.tenant_id || ''
        }
      });

      const replyContent = res?.reply || res?.response || res?.message;
      const executedActions = res?.executed_actions || [];

      // Update right-hand Output Display widgets using shared dispatcher
      const { widgetObj, textNotice } = dispatchExecutedActionWidgets(executedActions, replyContent);

      // Check if user input is a greeting or general pleasantry
      const isGreeting = /^(hi|hello|hey|good\s*(morning|afternoon|evening|day)|greetings|howdy|yo|hi\s*there|hello\s*there|sup|thanks|thank\s*you|ok|okay)[\s!.,?]*$/i.test(textToSend.trim());

      // Separate structured table data from natural language text for the popup modal tab
      const { cleanText, tableInfo } = extractTableFromText(textNotice);
      let modalPayload = null;

      if (!isGreeting) {
        modalPayload = tableInfo
          ? { ...tableInfo, widget: widgetObj }
          : widgetObj
          ? { title: widgetObj.title || 'Interactive Management Console', widget: widgetObj }
          : null;
      }

      const isComparative = isComparativeMultiViewPrompt(textToSend);

      // If comparative prompt was requested and we don't have a structured table yet, extract key data points from the reply
      if (!isGreeting && !modalPayload && isComparative && cleanReplyText(textNotice).trim().length > 10) {
        modalPayload = {
          title: cleanReplyText(textNotice).split('\n')[0].replace(/^#+\s*/, '').replace(/\*+/g, '').slice(0, 110) || 'Requested Comparison Data',
          headers: ['DATA POINT', 'DETAILS'],
          rows: [
            ['**Information**', cleanReplyText(textNotice)]
          ],
          rawMarkdown: textNotice
        };
      }

      // Automatically open or compare tabs side-by-side (NEVER for greetings or casual remarks)
      if (modalPayload && !isGreeting) {
        setModalTabs((currentTabs) => {
          const prevTabs = (currentTabs && currentTabs.length > 0)
            ? currentTabs
            : (modalTabsRef.current && modalTabsRef.current.length > 0 ? modalTabsRef.current : []);

          if (isComparative && prevTabs.length > 0) {
            // Minimize current tab to left, open new tab on right!
            return [prevTabs[0], modalPayload];
          } else {
            // Standard single tab view
            return [modalPayload];
          }
        });

        const hadExisting = modalTabs.length > 0 || (modalTabsRef.current && modalTabsRef.current.length > 0);
        if (isComparative && hadExisting) {
          showToast('⚡ Dual Split View: Current tab minimized to left, new data opened at right');
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          title: isCompanyAdmin ? `${companyName} Admin AI` : 'Enterprise Business AI',
          badge: 'Synced',
          heading: widgetObj && widgetObj.type.includes('draft') ? 'Action Preview Required:' : '',
          points: [
            {
              label: '',
              text: cleanText || textNotice
            }
          ],
          tableInfo: isGreeting ? null : modalPayload,
          executedActions: isGreeting ? [] : executedActions,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      // Automatically synthesize Sarvam AI voice output ONLY when using speech or hands-free options!
      const speechToPlay = cleanText || textNotice;
      if (voiceEnabled && (isContinuousVAD || isVoiceInput)) {
        if (continuousModeRef.current) {
          setVadStatus('ai_speaking');
        }
        playSarvamAudio(speechToPlay, () => {
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

  // Auto-scroll chat conversation when messages change or popup modal opens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (tableModal) {
      projectedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, tableModal]);

  // Render message stream shared between the fixed background chat and foreground projected chatting card
  const renderMessagesContent = (scrollRef, isProjected = false) => {
    const visibleMsgs = messages.filter((msg) => !msg.isWelcome && msg.id !== 'welcome-init');

    if (visibleMsgs.length === 0 && isProjected) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-3 text-gray-500 my-auto">
          <div className="w-8 h-8 rounded-full bg-black/5 text-gray-950 flex items-center justify-center mb-1.5 shadow-2xs">
            <Sparkles size={16} />
          </div>
          <p className="text-xs font-bold text-gray-800">Ask questions about the data above</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Type below or speak to filter, inspect, or analyze records continuously</p>
        </div>
      );
    }

    return (
      <>
        {visibleMsgs.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end items-start py-1 px-1 my-1 mt-1.5 animate-in fade-in duration-200">
                <div className="bg-[#111417] text-white text-[12.5px] sm:text-[13px] font-medium leading-relaxed max-w-[80%] px-3.5 py-2 rounded-2xl rounded-tr-xs shadow-2xs">
                  {msg.content}
                </div>
              </div>
            );
          }

          const rawText = cleanReplyText(msg.points?.[0]?.text || msg.content || '');
          const { cleanText, tableInfo: dynamicTableInfo } = extractTableFromText(rawText);
          const effectiveTable = msg.tableInfo || dynamicTableInfo;
          const displayText = cleanText || rawText;

          return (
            <div key={msg.id} className="flex items-start gap-2.5 py-1 px-1 my-1 animate-in fade-in duration-200">
              {/* Assistant Avatar */}
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mt-0.5">
                <Sparkles size={14} />
              </div>

              {/* Message Bubble */}
              <div className="flex-1 min-w-0 bg-white/80 hover:bg-white/95 backdrop-blur-md border border-black/[0.06] rounded-2xl rounded-tl-xs p-3 sm:p-3.5 shadow-2xs space-y-2">
                {msg.heading && (
                  <div className="font-extrabold text-gray-950 text-xs sm:text-[13px] tracking-tight">
                    {msg.heading}
                  </div>
                )}

                {displayText && (
                  <div
                    className="chat-markdown-body prose prose-sm max-w-none text-gray-800 font-sans text-xs sm:text-[12.5px] leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: marked.parse(formatMarkdownContent(displayText))
                    }}
                  />
                )}

                {/* Embedded Preview Summary Card */}
                {effectiveTable && (
                  <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-black/[0.08] shadow-3xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition hover:border-black/20">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 font-extrabold text-xs text-gray-900">
                        <Table size={13} className="text-gray-900 shrink-0" />
                        <span className="truncate">{effectiveTable.title || 'Data Records'}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-black text-white border border-black shrink-0">
                          {tableModal ? 'Active in Top Tab' : 'Popup Tab'}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-gray-500 font-medium">
                        {effectiveTable.rows ? `${effectiveTable.rows.length} records available · Click to inspect` : 'Interactive live management console ready'}
                      </div>
                    </div>

                    {!isProjected && (
                      <button
                        type="button"
                        onClick={() => setTableModal(effectiveTable)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                          tableModal?.title === effectiveTable?.title
                            ? 'bg-black text-white shadow-xs'
                            : 'bg-black/5 hover:bg-black text-gray-800 hover:text-white'
                        }`}
                      >
                        <Table size={12} />
                        <span>{tableModal?.title === effectiveTable?.title ? 'View in Top Tab ↗' : 'View Table ↗'}</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="text-[10px] text-gray-400 font-mono text-right pt-0.5">
                  {msg.timestamp || 'Just now'}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2.5 py-1.5 px-2 text-xs font-semibold text-gray-700 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping"></span>
            <span>Reviewing enterprise platform data...</span>
          </div>
        )}
        <div ref={scrollRef} />
      </>
    );
  };

  // Render bottom floating capsule dock shared between background and projected chatting card
  const renderInputDockPill = (isProjected = false) => {
    return (
      <div className={`flex-shrink-0 w-full max-w-3xl lg:max-w-4xl xl:max-w-[960px] mx-auto px-2 sm:px-4 ${isProjected ? 'pb-1 pt-1.5' : 'pb-2 pt-2'} relative z-20 mt-auto`}>
        {/* Sleek Floating Status Pill when Voice Mode or STT is active */}
        {continuousMode ? (
          <div className="mb-2 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-gray-950/90 text-white border border-gray-800/80 shadow-lg backdrop-blur-md">
              {vadStatus === 'listening' && (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  <span className="text-white font-bold text-[11px]">Listening naturally...</span>
                  <span className="text-gray-400 text-[10px] hidden sm:inline">(Speak anytime or click mic to stop)</span>
                </>
              )}
              {vadStatus === 'user_speaking' && (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  <span className="text-white font-bold text-[11px]">Hearing your voice...</span>
                  <span className="text-gray-400 text-[10px] hidden sm:inline">(Silero VAD active)</span>
                </>
              )}
              {vadStatus === 'transcribing' && (
                <>
                  <RefreshCw size={11} className="animate-spin text-white" />
                  <span className="text-white font-bold text-[11px]">Processing speech...</span>
                </>
              )}
              {vadStatus === 'ai_speaking' && (
                <>
                  <Volume2 size={12} className="animate-bounce text-white" />
                  <span className="text-white font-bold text-[11px]">Assistant speaking...</span>
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-bold bg-black text-white shadow-md">
              {isRecording && (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                  <span>Recording audio... speak now</span>
                </>
              )}
              {isTranscribing && (
                <>
                  <RefreshCw size={11} className="animate-spin text-white" />
                  <span>Transcribing spoken audio...</span>
                </>
              )}
              {!isRecording && !isTranscribing && lastSttText && (
                <>
                  <span className="text-white">🎙️</span>
                  <span className="truncate max-w-[260px]">"{lastSttText}"</span>
                </>
              )}
            </span>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept=".pdf,.doc,.docx,.csv,.xlsx,.txt"
        />

        {/* Floating Pill Capsule Dock */}
        <div className={`rounded-full pl-2 sm:pl-2.5 pr-1.5 py-1.5 flex items-center gap-2.5 transition-all duration-200 ${
          isProjected
            ? 'bg-white shadow-[0_16px_45px_rgba(0,0,0,0.20),0_2px_8px_rgba(0,0,0,0.06)] border border-gray-200/90 ring-1 ring-black/5'
            : 'bg-white/60 hover:bg-white/80 focus-within:bg-white/95 backdrop-blur-xl border border-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
        }`}>
          {/* Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-black/5 transition cursor-pointer shrink-0"
            title="Attach file / document"
          >
            <Paperclip size={17} />
          </button>

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
                    : isProjected
                      ? modalTabs.length > 1
                        ? "Ask a question about data above or compare continuously..."
                        : "Ask a question about data above or chat continuously..."
                      : isCompanyAdmin
                        ? `Ask ${companyName} Admin AI...`
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
                className="relative w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition shadow-md cursor-pointer hover:scale-105 active:scale-95 group bg-black hover:bg-gray-800 text-white"
                title="Voice Active — Click to stop conversation"
              >
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
                className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-black hover:bg-gray-800 text-white transition shadow-sm animate-pulse flex items-center justify-center cursor-pointer"
                title="Click to stop recording"
              >
                <MicOff size={15} />
              </button>
            ) : isTranscribing ? (
              <button
                type="button"
                disabled
                className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-black text-white flex items-center justify-center shadow-sm"
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
              className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-black hover:bg-gray-800 text-white transition shadow-md disabled:opacity-35 cursor-pointer flex items-center justify-center shrink-0 hover:scale-105 active:scale-95"
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
    );
  };

  return (
    <div className="w-full h-full flex-1 flex flex-col text-[13px] font-sans text-[#1A1D20] antialiased select-none overflow-hidden" style={{ minHeight: 'calc(100vh - 84px)' }}>
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-black text-white border border-gray-800 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 size={16} className="text-white" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="w-full h-full flex-1 flex justify-center items-stretch overflow-hidden relative" data-purpose="main-dashboard-wrapper" style={{ minHeight: 'calc(100vh - 84px)' }}>

        {/* ================================================================= */}
        {/* BEGIN: Main Focused Chat Layout (Right Panel moved to Popup Tab Modal) */}
        {/* ================================================================= */}
        <main className={`flex-1 flex flex-col justify-start items-stretch h-full min-h-0 overflow-hidden w-full relative max-w-[96%] xl:max-w-[94%] 2xl:max-w-[1620px] mx-auto transition-all duration-200 ${
          modalTabs.length > 0 ? 'z-50' : 'z-10'
        }`} data-purpose="main-content-layout" style={{ minHeight: 'calc(100vh - 84px)' }}>

          {/* Background Chat Workspace (Hidden when Table Modal is Open) */}
          <motion.section
            layout={false}
            className={`w-full h-full min-h-0 border rounded-2xl flex flex-col justify-between relative overflow-hidden transition-all duration-300 p-4 sm:p-5 bg-white/40 backdrop-blur-2xl border-white/70 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] ${
              modalTabs.length > 0 ? 'hidden' : 'flex'
            }`}
            style={{ height: '100%', minHeight: 'calc(100vh - 84px)' }}
            data-purpose="pure-chat-workspace"
          >
            <div className="relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Top Header Bar matching Image 2 */}
              <div className="flex-shrink-0 flex items-center justify-between gap-3 mb-2 px-1">
                {/* Left: Frosted Capsule Pill with Dropdown */}
                <div className="relative" ref={sessionDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsSessionDropdownOpen((prev) => !prev)}
                    className="flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold text-gray-800 bg-white/60 hover:bg-white/90 backdrop-blur-md border border-white/80 shadow-2xs transition cursor-pointer active:scale-95"
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
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition text-left cursor-pointer ${activeTab === 'review' ? 'bg-black text-white' : 'hover:bg-black/5 text-gray-800'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={activeTab === 'review' ? 'text-white' : 'text-gray-500'}>✦</span>
                          <span>Q3 Talent & Operations Review</span>
                        </div>
                        {activeTab === 'review' && <Check size={14} className="text-white" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleNewChat();
                          setIsSessionDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition text-left cursor-pointer mt-1 ${activeTab === 'new' ? 'bg-black text-white' : 'hover:bg-black/5 text-gray-800'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <Plus size={14} />
                          <span>New Conversation</span>
                        </div>
                        {activeTab === 'new' && <Check size={14} className="text-white" />}
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
                      className={`w-8.5 h-8.5 bg-white/60 hover:bg-white/90 backdrop-blur-md border border-white/80 shadow-2xs rounded-full flex items-center justify-center transition cursor-pointer hover:bg-white hover:scale-105 active:scale-95 ${isSettingsOpen ? 'bg-white shadow-sm text-gray-950 ring-2 ring-black/5' : 'text-gray-700'
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
                            <SlidersHorizontal size={14} className="text-gray-950" />
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
                                ? 'bg-black text-white'
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
                                <Radio size={12} className={continuousMode ? 'text-gray-950 animate-pulse' : 'text-gray-400'} />
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
                                ? 'bg-black text-white'
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
                                {voiceEnabled ? <Volume2 size={13} className="text-gray-950" /> : <VolumeX size={13} className="text-gray-400" />}
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
                                ? 'bg-black text-white shadow-xs'
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
                              className="w-full bg-white/90 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
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
                                    ? 'bg-black text-white'
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
                              <RefreshCw size={12} className={isSyncing ? 'animate-spin text-black' : ''} />
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
                    className={`w-8.5 h-8.5 bg-white/60 hover:bg-white/90 backdrop-blur-md border border-white/80 shadow-2xs rounded-full flex items-center justify-center transition cursor-pointer hover:bg-white hover:scale-105 active:scale-95 ${voiceEnabled ? 'text-gray-900 bg-white/95' : 'text-gray-400'
                      }`}
                    title={voiceEnabled ? 'Mute AI Audio Speech' : 'Enable AI Audio Speech'}
                  >
                    <AudioLines size={16} className={isPlayingAudio ? 'animate-pulse text-black' : ''} />
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
                    {isCompanyAdmin ? `I’m your ${companyName} Admin AI Copilot.` : "I’m your Enterprise HR Copilot."}
                  </p>

                  {/* Suggestion Prompts */}
                  {isCompanyAdmin ? (
                    <p className="text-xs sm:text-sm text-gray-400 mt-3 max-w-lg mx-auto leading-relaxed">
                      Ask anything about{' '}
                      <span
                        onClick={() => handleSend('List all hiring managers and HR leads in our company')}
                        className="text-gray-700 font-medium hover:underline cursor-pointer transition-colors"
                        title="Click to list hiring managers"
                      >
                        hiring managers
                      </span>
                      ,{' '}
                      <span
                        onClick={() => handleSend('Show our active job requisitions and candidate counts')}
                        className="text-gray-700 font-medium hover:underline cursor-pointer transition-colors"
                        title="Click to inspect requisitions"
                      >
                        open requisitions
                      </span>
                      , or{' '}
                      <span
                        onClick={() => handleSend('Show all shortlisted candidates across open positions')}
                        className="text-gray-700 font-medium hover:underline cursor-pointer transition-colors"
                        title="Click to view shortlisted candidates"
                      >
                        shortlisted candidates
                      </span>
                      .
                    </p>
                  ) : (
                    <p className="text-xs sm:text-sm text-gray-400 mt-3 max-w-lg mx-auto leading-relaxed">
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
                  )}
                </div>
              ) : (
                <div
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto min-h-0 pt-8 pb-4 pr-1 space-y-4 scrollbar-thin overscroll-contain"
                >
                  {renderMessagesContent(messagesEndRef, false)}
                </div>
              )}
            </div>

            {/* Bottom Floating Glass Capsule Input Dock */}
            {renderInputDockPill(false)}
          </motion.section>

          {/* ================================================================= */}
          {/* FOREGROUND OVERLAY: Top Tab Modal & Bottom Floating Input Dock */}
          {/* ================================================================= */}
          <AnimatePresence>
            {modalTabs.length > 0 && (
              <div className="absolute inset-0 z-50 flex flex-col justify-between gap-3 p-1 sm:p-2 pointer-events-none">
                {/* Background Click Scrim to dismiss modal */}
                <div
                  className="absolute inset-0 z-0 pointer-events-auto"
                  onClick={() => setModalTabs([])}
                />

                {/* Center Tab Modal Section: Single Card or Side-by-Side Dual Tabs */}
                <div className="flex-1 flex flex-col justify-center items-center w-full min-h-0 pointer-events-none z-10 my-auto">
                  {modalTabs.length === 1 ? (
                    <motion.div
                      key="top-tab-panel-single"
                      layout
                      initial={{ opacity: 0, y: 12, scale: 0.99 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.99 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full max-h-[calc(100vh-170px)] flex flex-col overflow-hidden bg-transparent pointer-events-auto z-10 my-auto"
                    >
                      <TableModalTab
                        modalData={modalTabs[0]}
                        onClose={() => handleCloseTab(0)}
                        onSendMessage={(txt) => handleSend(txt)}
                        copyToClipboard={copyToClipboard}
                        isCompanyAdmin={isCompanyAdmin}
                        companyName={companyName}
                        splitIndex={0}
                        totalTabs={1}
                      />
                    </motion.div>
                  ) : (
                    <div className="w-full max-h-[calc(100vh-170px)] grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0 pointer-events-none z-10 my-auto items-start">
                      {/* Left Tab: Minimized to the left */}
                      <motion.div
                        key="top-tab-panel-left"
                        layout
                        initial={{ opacity: 0.8, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full max-h-[calc(100vh-170px)] flex flex-col overflow-hidden bg-transparent pointer-events-auto z-10 min-h-0"
                      >
                        <TableModalTab
                          modalData={modalTabs[0]}
                          onClose={() => handleCloseTab(0)}
                          onSendMessage={(txt) => handleSend(txt)}
                          copyToClipboard={copyToClipboard}
                          isCompanyAdmin={isCompanyAdmin}
                          companyName={companyName}
                          splitIndex={0}
                          totalTabs={2}
                        />
                      </motion.div>

                      {/* Right Tab: Opened at the right */}
                      <motion.div
                        key="top-tab-panel-right"
                        layout
                        initial={{ opacity: 0, x: 24, scale: 0.98 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24, scale: 0.96 }}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full max-h-[calc(100vh-170px)] flex flex-col overflow-hidden bg-transparent pointer-events-auto z-10 min-h-0"
                      >
                        <TableModalTab
                          modalData={modalTabs[1]}
                          onClose={() => handleCloseTab(1)}
                          onSendMessage={(txt) => handleSend(txt)}
                          copyToClipboard={copyToClipboard}
                          isCompanyAdmin={isCompanyAdmin}
                          companyName={companyName}
                          splitIndex={1}
                          totalTabs={2}
                        />
                      </motion.div>
                    </div>
                  )}
                </div>

                {/* Bottom Floating Compact Chat Typing Card / Input Dock */}
                <motion.div
                  key="bottom-compact-input-dock"
                  initial={{ opacity: 0, y: 16, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.99 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full shrink-0 pointer-events-auto z-10 pb-1 mt-auto"
                  data-purpose="compact-typing-dock"
                >
                  {renderInputDockPill(true)}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </main>
      </div>

      {/* Dimmed Faded Backdrop for Background (Header, Margins, Wallpaper) */}
      <AnimatePresence>
        {modalTabs.length > 0 && (
          <motion.div
            key="table-modal-dimmed-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] pointer-events-auto cursor-pointer"
            onClick={() => setModalTabs([])}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
