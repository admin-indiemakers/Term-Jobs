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
  GitBranch,
  Tag,
  Edit3,
  Layers,
  Filter,
  CheckCircle2,
  FileText,
  Building2,
  Users,
  Activity,
  ChevronRight,
  TrendingUp,
  Award,
  Clock,
  Zap,
  Calendar,
  Search,
  Bell,
  Trash2,
  UserCheck,
  Briefcase,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Flag,
  Check,
  UserX
} from 'lucide-react';

/* Voice options for TTS */
const VOICE_OPTIONS = [
  { id: 'priya', label: 'Priya (Female)' },
  { id: 'aditya', label: 'Aditya (Male)' }
];

/* Clean text helper: strip raw ASCII tables or JSON strings from chat bubbles */
const cleanReplyText = (text) => {
  if (!text) return '';
  let str = String(text);
  if (str.includes('|---|') || str.includes('| --- |') || str.includes('| Requisition Title |')) {
    const lines = str.split('\n');
    const nonTableLines = lines.filter((line) => !line.trim().startsWith('|'));
    const summaryText = nonTableLines.join(' ').trim();
    if (summaryText.length > 10) {
      str = summaryText;
    } else {
      str = 'I have retrieved your hiring manager records and rendered the interactive widget on your right Output Display panel.';
    }
  }
  return str;
};

/* Clean text specifically for spoken TTS output */
const cleanForTTS = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#|~]/g, '')
    .replace(/http\S+/g, '')
    .replace(/DISPLAY UPDATED:.*/g, '')
    .trim();
};

export default function HiringManagerChat() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Chat conversation state
  const [messages, setMessages] = useState([
    {
      id: 'welcome-msg',
      sender: 'ai',
      text: `Hello **${user?.name || 'Hiring Manager'}**! I am your **TermJobs Hiring Manager AI Assistant**. I am connected directly to your company's requisition pipeline, shortlisted candidate pool, interview schedule, and onboarding tracker.\n\nHow can I help you manage your hiring pipeline today?`,
      timestamp: '12:00',
      actionBadge: 'get_hiring_manager_stats'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Active Output Display Widget State
  const [activeWidget, setActiveWidget] = useState({
    type: 'hiring_metrics',
    title: 'Hiring Operations Dashboard',
    data: {
      total_requisitions: 3,
      live_requisitions: 2,
      draft_requisitions: 1,
      shortlisted_candidates: 3,
      accepted_candidates: 2,
      onboarding_candidates: 2,
      system_status: 'Operational'
    }
  });

  // Requisition Filter state for widget
  const [reqFilter, setReqFilter] = useState('all');

  // Draft Requisition edit form state inside widget
  const [draftReqForm, setDraftReqForm] = useState({
    title: 'Senior Full Stack Engineer',
    department: 'Engineering & Product',
    location: 'Bangalore / Remote',
    employment_type: 'Full-Time',
    experience_level: 'Senior (4-7 yrs)',
    salary_range: '$120,000 - $150,000 / yr',
    skills: 'React, Node.js, Python, PostgreSQL, AWS',
    job_description: 'We are seeking a talented Senior Full Stack Engineer to lead component architecture and build scalable microservices.'
  });

  // Interview Schedule proposal edit form state inside widget
  const [interviewForm, setInterviewForm] = useState({
    candidate_identifier: 'Alex Johnson',
    req_title: 'Senior React & Full Stack Developer',
    proposed_date: '2026-09-12',
    proposed_time: '02:00 PM EST',
    interview_type: 'Technical Round',
    meeting_notes: 'Technical evaluation focusing on system design & backend APIs.'
  });

  // Voice & VAD Speech state
  const [isVoicePlaybackEnabled, setIsVoicePlaybackEnabled] = useState(false);
  const [vadEnabled, setVadEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('priya');
  const [voiceSpeed, setVoiceSpeed] = useState(1.25);
  const [sttInterimText, setSttInterimText] = useState('');
  const recognitionRef = useRef(null);

  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, sttInterimText]);

  // Voice Synthesis (TTS) Helper
  const speakText = (text, forcePlay = false) => {
    if (!('speechSynthesis' in window)) return;
    if (!isVoicePlaybackEnabled && !forcePlay) return;
    window.speechSynthesis.cancel();
    const cleanText = cleanForTTS(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = voiceSpeed;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      if (selectedVoice === 'priya') {
        const femaleVoice = voices.find((v) => v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('victoria') || v.lang.includes('en'));
        if (femaleVoice) utterance.voice = femaleVoice;
      } else {
        const maleVoice = voices.find((v) => v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('alex') || v.name.toLowerCase().includes('male') || v.lang.includes('en'));
        if (maleVoice) utterance.voice = maleVoice;
      }
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Web Speech STT setup
  const startSTT = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser.');
      return;
    }
    if (isListening) return;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => setIsListening(true);
    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const finalTranscript = event.results[i][0].transcript;
          setInputText(finalTranscript);
          handleSend(finalTranscript);
        } else {
          interim += event.results[i][0].transcript;
          setSttInterimText(interim);
        }
      }
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => {
      setIsListening(false);
      setSttInterimText('');
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const stopSTT = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // VAD React Hook setup
  const vad = useMicVAD({
    startOnListen: vadEnabled,
    onSpeechEnd: () => {
      if (!vadEnabled) return;
      startSTT();
    }
  });

  // Core API Send Handler
  const handleSend = async (overridePrompt = null) => {
    const promptToSend = (overridePrompt || inputText).trim();
    if (!promptToSend || isLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overridePrompt) setInputText('');
    setIsLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        sender: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      const res = await request('/api/hiring-manager/agent/chat', {
        method: 'POST',
        body: {
          prompt: promptToSend,
          history: historyPayload,
          user_name: user?.name || 'Hiring Manager',
          user_role: user?.role || 'Hiring Manager',
          current_user: {
            id: user?.id || '',
            name: user?.name || 'Hiring Manager',
            role: user?.role || 'Hiring Manager',
            tenant_id: user?.tenant_id || '',
            tenant_name: user?.tenant_name || 'Client Workspace'
          }
        }
      });

      const replyContent = res?.reply || res?.message || 'Request executed successfully.';
      const executedActions = res?.executed_actions || [];

      // Determine Widget to display on right panel based on action executed
      const statsAction = executedActions.find((a) => a.tool === 'get_hiring_manager_stats');
      const reqAction = executedActions.find((a) => a.tool === 'list_hiring_requisitions');
      const draftAction = executedActions.find((a) => a.tool === 'draft_hiring_requisition');
      const publishSuccessAction = executedActions.find((a) => a.tool === 'create_hiring_requisition');
      const shortlistedAction = executedActions.find((a) => a.tool === 'list_shortlisted_candidates');
      const interviewAction = executedActions.find((a) => a.tool === 'schedule_candidate_interview');
      const rejectAction = executedActions.find((a) => a.tool === 'reject_shortlisted_candidate');
      const issuesAction = executedActions.find((a) => a.tool === 'list_onboarding_issues');
      const profileAction = executedActions.find((a) => a.tool === 'get_candidate_profile_details');
      const pendingTimesheetsAction = executedActions.find((a) => a.tool === 'list_pending_timesheets');
      const pendingExpensesAction = executedActions.find((a) => a.tool === 'list_pending_expenses');
      const roleSelectAction = executedActions.find((a) => a.tool === 'show_role_selection_dropdown');

      let widgetObj = null;
      let textNotice = cleanReplyText(replyContent);

      if (roleSelectAction) {
        const roleData = roleSelectAction.result || {};
        widgetObj = { type: 'show_role_selection_dropdown', title: 'Select Role to 100% Autofill', data: roleData };
        textNotice = cleanReplyText(replyContent) || `Select a role from the dropdown below to 100% autofill all position details.`;
      } else if (rejectAction) {
        const rejData = rejectAction.result || {};
        widgetObj = { type: 'candidate_rejected_card', title: 'Candidate Rejection Recorded', data: rejData };
        textNotice = cleanReplyText(replyContent) || `Candidate **${rejData.candidate_name || 'Candidate'}** has been marked as Rejected.`;
      } else if (pendingTimesheetsAction) {
        const tsList = pendingTimesheetsAction.result || [];
        widgetObj = { type: 'pending_timesheets_console', title: 'Pending Timesheet Approvals', data: tsList };
        textNotice = cleanReplyText(replyContent) || `Loaded pending timesheet approvals console on your right panel.`;
      } else if (pendingExpensesAction) {
        const expList = pendingExpensesAction.result || [];
        widgetObj = { type: 'pending_expenses_console', title: 'Pending Expense Claim Approvals', data: expList };
        textNotice = cleanReplyText(replyContent) || `Loaded pending candidate expense claims on your right panel.`;
      } else if (profileAction) {
        const profData = profileAction.result || {};
        widgetObj = { type: 'candidate_profile_detail', title: `Workforce Profile: ${profData.candidate_name || 'Candidate'}`, data: profData };
        textNotice = cleanReplyText(replyContent) || `Loaded full workforce details, timesheets, and expenses for **${profData.candidate_name || 'Candidate'}**.`;
      } else if (publishSuccessAction) {
        const pubData = publishSuccessAction.result || {};
        widgetObj = { type: 'requisition_published_success', title: 'Job Requisition Published', data: pubData };
        textNotice = cleanReplyText(replyContent) || `Job Requisition **${pubData.title || 'Role'}** has been published to market successfully!`;
      } else if (draftAction) {
        const draftData = draftAction.result || {};
        setDraftReqForm((prev) => ({
          ...prev,
          title: draftData.title || prev.title,
          department: draftData.department || prev.department,
          location: draftData.location || prev.location,
          salary_range: draftData.salary_range || prev.salary_range,
          skills: draftData.skills || prev.skills,
          job_description: draftData.job_description || prev.job_description
        }));
        widgetObj = { type: 'hiring_requisition_draft', title: 'Requisition Draft Preview', data: draftData };
        textNotice = cleanReplyText(replyContent) || `I have prepared the job requisition draft on your right Output Display panel.`;
      } else if (interviewAction) {
        const intData = interviewAction.result || {};
        setInterviewForm((prev) => ({
          ...prev,
          candidate_identifier: intData.candidate || prev.candidate_identifier,
          req_title: intData.requisition_title || prev.req_title,
          proposed_date: intData.proposed_date || prev.proposed_date,
          proposed_time: intData.proposed_time || prev.proposed_time,
          interview_type: intData.interview_type || prev.interview_type,
          meeting_notes: intData.meeting_notes || prev.meeting_notes
        }));
        widgetObj = { type: 'interview_proposal_confirm', title: 'Interview Proposal Preview', data: intData };
        textNotice = cleanReplyText(replyContent) || `I have generated the interview proposal card on your right panel.`;
      } else if (issuesAction) {
        const issuesList = issuesAction.result || [];
        widgetObj = { type: 'onboarding_issues_console', title: 'Onboarding Candidates & Open Issues', data: issuesList };
        textNotice = cleanReplyText(replyContent) || `Loaded onboarding candidate records and open verification issues.`;
      } else if (shortlistedAction) {
        const candList = shortlistedAction.result || [];
        widgetObj = { type: 'hiring_candidates_console', title: 'Shortlisted Candidates Directory', data: candList };
        textNotice = cleanReplyText(replyContent) || `Loaded all shortlisted candidates for your open requisitions on your right panel.`;
      } else if (reqAction) {
        const reqList = reqAction.result || [];
        widgetObj = { type: 'hiring_requisitions_console', title: 'Company Job Requisitions', data: reqList };
        textNotice = cleanReplyText(replyContent) || `Displayed your company job requisitions on your right panel.`;
      } else if (statsAction) {
        const statsData = statsAction.result || {};
        widgetObj = { type: 'hiring_metrics', title: 'Hiring Operations Dashboard', data: statsData };
        textNotice = cleanReplyText(replyContent) || `Refreshed hiring health analytics dashboard on your right panel.`;
      }

      if (widgetObj) {
        setActiveWidget(widgetObj);
      }

      const primaryAction = executedActions[0]?.tool || 'assistant_response';
      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: textNotice,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionBadge: primaryAction
      };

      setMessages((prev) => [...prev, aiMsg]);
      speakText(textNotice);
    } catch (err) {
      console.error('Hiring Manager AI Agent Chat Error:', err);
      const errReply = 'I encountered an issue processing your request. Please try again or rephrase.';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: errReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm Publish Requisition handler from Widget
  const handleConfirmPublishRequisition = () => {
    const cmd = `CONFIRM_EXECUTE_REQUISITION: title="${draftReqForm.title}", department="${draftReqForm.department}", location="${draftReqForm.location}", employment_type="${draftReqForm.employment_type}", experience_level="${draftReqForm.experience_level}", salary_range="${draftReqForm.salary_range}", skills="${draftReqForm.skills}", job_description="${draftReqForm.job_description}"`;
    handleSend(cmd);
  };

  // Confirm Interview Schedule handler from Widget
  const handleConfirmScheduleInterview = () => {
    const cmd = `Schedule interview for ${interviewForm.candidate_identifier} on ${interviewForm.proposed_date} at ${interviewForm.proposed_time} for role ${interviewForm.req_title}`;
    handleSend(cmd);
  };

  return (
    <div className="flex h-screen bg-[#F4F6F8] font-sans overflow-hidden text-gray-900">
      {/* ── LEFT SIDEBAR: TOPIC HISTORY & NAVIGATION ─────────────────────────────── */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between shrink-0 shadow-xs">
        <div>
          {/* Header Branding */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-[#3]">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-200">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="ml-2.5">
                <h2 className="text-sm font-bold text-gray-900 tracking-tight leading-none">Hiring AI Agent</h2>
                <span className="text-[11px] font-medium text-emerald-600">Enterprise Workspace</span>
              </div>
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="p-3">
            <button
              onClick={() => {
                setMessages([
                  {
                    id: 'new-session',
                    sender: 'ai',
                    text: `New Hiring Session started for **${user?.name || 'Hiring Manager'}**. How can I help you with requisitions, candidate shortlists, or interview scheduling?`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                ]);
              }}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2.5 rounded-xl font-semibold text-xs shadow-sm shadow-emerald-200 transition-all duration-150 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              New Hiring Chat
            </button>
          </div>

          {/* Preset Hiring Topics */}
          <div className="px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 mb-2">Hiring Focus Areas</div>
            <div className="space-y-1">
              {[
                { label: 'Requisitions Directory', tool: 'list_hiring_requisitions', icon: Briefcase, prompt: 'Show all active job requisitions' },
                { label: 'Shortlisted Candidates', tool: 'list_shortlisted_candidates', icon: UserCheck, prompt: 'List shortlisted candidates for review' },
                { label: 'Pending Timesheets', tool: 'list_pending_timesheets', icon: Clock, prompt: 'can u show me if there are pending timesheets approval' },
                { label: 'Pending Expenses', tool: 'list_pending_expenses', icon: TrendingUp, prompt: 'show pending candidate expense claims' },
                { label: 'Draft New Requisition', tool: 'draft_hiring_requisition', icon: Edit3, prompt: 'Draft a new requisition for Senior Full Stack Developer' },
                { label: 'Interview Proposals', tool: 'schedule_candidate_interview', icon: Calendar, prompt: 'Schedule interview for Alex Johnson' },
                { label: 'Onboarding & Issues', tool: 'list_onboarding_issues', icon: Flag, prompt: 'Check onboarding candidates and open issues' },
                { label: 'Hiring Analytics', tool: 'get_hiring_manager_stats', icon: Activity, prompt: 'Get hiring health and platform stats' }
              ].map((item, idx) => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSend(item.prompt)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <ItemIcon className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
              {user?.name?.[0] || 'H'}
            </div>
            <div className="truncate flex-1">
              <div className="text-xs font-bold text-gray-900 truncate">{user?.name || 'Hiring Manager'}</div>
              <div className="text-[10px] text-gray-500 font-medium">Hiring Manager Console</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CENTER CHAT CONTAINER ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white border-r border-gray-200 overflow-hidden relative shadow-xs">
        {/* Chat Header Bar */}
        <div className="h-16 border-b border-gray-200 px-6 flex items-center justify-between bg-white shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Hiring Agent Live
              </span>
            </div>
            <div className="h-4 w-px bg-gray-200"></div>
            <span className="text-xs font-medium text-gray-500">Company: {user?.tenant_name || 'Client Workspace'}</span>
          </div>

          {/* Controls: Voice / Audio / VAD */}
          <div className="flex items-center gap-3">
            {/* VAD Toggle Button */}
            <button
              onClick={() => setVadEnabled(!vadEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                vadEnabled
                  ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                  : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${vadEnabled ? 'animate-pulse' : ''}`} />
              {vadEnabled ? 'Hands-Free VAD Active' : 'Hands-Free VAD'}
            </button>

            {/* Voice Audio Playback Toggle (Default: OFF) */}
            <button
              onClick={() => {
                if (isVoicePlaybackEnabled) {
                  stopSpeaking();
                  setIsVoicePlaybackEnabled(false);
                } else {
                  setIsVoicePlaybackEnabled(true);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isVoicePlaybackEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                  : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
              }`}
              title={isVoicePlaybackEnabled ? 'Voice playback enabled' : 'Voice playback muted until clicked'}
            >
              {isVoicePlaybackEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5 text-gray-500" />}
              <span>{isVoicePlaybackEnabled ? 'Voice: On' : 'Voice: Off'}</span>
            </button>

            {/* TTS Voice Select */}
            <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-lg border border-gray-200 text-xs">
              <Volume2 className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="bg-transparent text-xs font-medium text-gray-700 focus:outline-none cursor-pointer"
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* Speech Stop Button */}
            {isSpeaking && (
              <button
                onClick={stopSpeaking}
                className="p-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 text-xs font-semibold flex items-center gap-1"
              >
                <VolumeX className="w-3.5 h-3.5" /> Stop Voice
              </button>
            )}
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FAFCFD]">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={msg.id} className={`flex gap-4 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-xs ${
                    isUser ? 'bg-gray-900 text-white' : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-100'
                  }`}
                >
                  {isUser ? user?.name?.[0] || 'U' : <Sparkles className="w-4.5 h-4.5" />}
                </div>

                {/* Message Bubble */}
                <div className={`space-y-1.5 max-w-2xl ${isUser ? 'items-end text-right' : ''}`}>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs font-bold text-gray-900">{isUser ? user?.name || 'You' : 'Hiring Assistant'}</span>
                    <span className="text-[10px] font-medium text-gray-400">{msg.timestamp}</span>
                    {msg.actionBadge && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {msg.actionBadge}
                      </span>
                    )}
                    {!isUser && (
                      <button
                        onClick={() => speakText(msg.text, true)}
                        className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
                        title="Click to speak this message aloud"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        Listen
                      </button>
                    )}
                  </div>

                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-gray-900 text-white rounded-tr-none font-medium'
                        : 'bg-white text-gray-800 border border-gray-200/80 rounded-tl-none prose prose-emerald prose-sm max-w-none'
                    }`}
                  >
                    {isUser ? (
                      <div>{msg.text}</div>
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: marked.parse(msg.text || '') }} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* STT Live Interim Feedback */}
          {sttInterimText && (
            <div className="flex gap-4 max-w-3xl ml-auto flex-row-reverse animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                <Mic className="w-4 h-4 animate-bounce" />
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium">
                Listening: "{sttInterimText}"...
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-4 max-w-xl">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4.5 h-4.5 animate-spin" />
              </div>
              <div className="p-4 bg-white border border-gray-200 rounded-2xl rounded-tl-none shadow-xs flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]"></span>
                </div>
                <span className="text-xs font-semibold text-gray-600">Analyzing hiring pipeline & processing requested actions...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-6 py-2 bg-white border-t border-gray-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 shrink-0">Suggestions:</span>
          {[
            'Show live requisitions',
            'Draft requisition for Lead Full Stack Engineer',
            'Review shortlisted candidates',
            'Schedule interview for Alex Johnson',
            'Check onboarding issues'
          ].map((pill, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(pill)}
              className="px-3 py-1 rounded-full bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 border border-gray-200 hover:border-emerald-200 text-xs font-medium whitespace-nowrap transition-all"
            >
              {pill}
            </button>
          ))}
        </div>

        {/* Input Dock */}
        <div className="p-4 bg-white border-t border-gray-200 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl p-2 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 transition-all"
          >
            {/* Mic STT Button */}
            <button
              type="button"
              onClick={isListening ? stopSTT : startSTT}
              className={`p-2.5 rounded-xl transition-all ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-200'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-600" />}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask Hiring AI about requisitions, candidate shortlists, interviews, or onboarding..."
              className="flex-1 bg-transparent border-none text-sm font-medium text-gray-900 focus:outline-none px-2"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white p-2.5 rounded-xl shadow-xs shadow-emerald-200 transition-all flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* ── RIGHT SIDEBAR: INTERACTIVE OUTPUT DISPLAY WIDGET ─────────────────────── */}
      <div className="w-[520px] bg-[#FAFBFD] flex flex-col shrink-0 overflow-hidden">
        {/* Output Header */}
        <div className="h-16 border-b border-gray-200 px-6 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-gray-900 tracking-tight uppercase">Output Display</h3>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 px-3 py-1 rounded-lg">
            {activeWidget?.title || 'Interactive Workspace'}
          </div>
        </div>

        {/* Output Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* WIDGET 1: HIRING HEALTH & METRICS DASHBOARD */}
          {activeWidget.type === 'hiring_metrics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                  <div className="flex items-center justify-between text-gray-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Live Requisitions</span>
                    <Briefcase className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-3xl font-extrabold text-gray-900">{activeWidget.data?.live_requisitions ?? 2}</div>
                  <div className="text-xs font-medium text-emerald-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Out of {activeWidget.data?.total_requisitions ?? 3} total roles
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                  <div className="flex items-center justify-between text-gray-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Shortlisted Candidates</span>
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-3xl font-extrabold text-gray-900">{activeWidget.data?.shortlisted_candidates ?? 3}</div>
                  <div className="text-xs font-medium text-emerald-600 mt-1 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" /> Ready for interview evaluation
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                  <div className="flex items-center justify-between text-gray-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">In Onboarding</span>
                    <Users className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="text-3xl font-extrabold text-gray-900">{activeWidget.data?.onboarding_candidates ?? 2}</div>
                  <div className="text-xs font-medium text-teal-600 mt-1">Accepted offers in processing</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                  <div className="flex items-center justify-between text-gray-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">System Status</span>
                    <Activity className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-lg font-bold text-gray-900 flex items-center gap-2 mt-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    {activeWidget.data?.system_status || 'Operational'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Hiring Manager Console Online</div>
                </div>
              </div>

              {/* Quick Actions Card */}
              <div className="bg-gradient-to-br from-emerald-900 to-teal-900 rounded-2xl p-6 text-white shadow-lg shadow-emerald-900/20">
                <h4 className="font-bold text-base mb-1">Hiring Assistant Quick Launcher</h4>
                <p className="text-xs text-emerald-200 mb-4">Click any action to trigger immediate hiring manager tool executions.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSend('Show all active job requisitions')}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-left text-xs font-semibold text-white transition-all flex items-center justify-between"
                  >
                    <span>View Requisitions</span>
                    <ChevronRight className="w-4 h-4 text-emerald-300" />
                  </button>
                  <button
                    onClick={() => handleSend('List shortlisted candidates for review')}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-left text-xs font-semibold text-white transition-all flex items-center justify-between"
                  >
                    <span>Shortlist Review</span>
                    <ChevronRight className="w-4 h-4 text-emerald-300" />
                  </button>
                  <button
                    onClick={() => handleSend('Draft a new requisition for Senior Full Stack Developer')}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-left text-xs font-semibold text-white transition-all flex items-center justify-between"
                  >
                    <span>Draft Job Posting</span>
                    <ChevronRight className="w-4 h-4 text-emerald-300" />
                  </button>
                  <button
                    onClick={() => handleSend('Check onboarding candidates and open issues')}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-left text-xs font-semibold text-white transition-all flex items-center justify-between"
                  >
                    <span>Onboarding Tracker</span>
                    <ChevronRight className="w-4 h-4 text-emerald-300" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* WIDGET 2: REQUISITIONS DIRECTORY CONSOLE */}
          {activeWidget.type === 'hiring_requisitions_console' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900">Job Requisitions ({Array.isArray(activeWidget.data) ? activeWidget.data.length : 0})</h4>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200">
                  {['all', 'open', 'draft', 'closed'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setReqFilter(f)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                        reqFilter === f ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {(Array.isArray(activeWidget.data) ? activeWidget.data : []).map((req, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs hover:border-emerald-300 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-bold text-sm text-gray-900">{req.title}</h5>
                        <p className="text-xs text-gray-500 font-medium">{req.department} • {req.location}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        (req.status || '').toLowerCase() === 'published' || (req.status || '').toLowerCase() === 'open' || (req.status || '').toLowerCase() === 'intake'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {req.status || 'Draft'}
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                      <span className="font-bold text-emerald-700">{req.salary_range || '$120,000 / yr'}</span>
                      <button
                        onClick={() => handleSend(`Review shortlisted candidates for ${req.title}`)}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                      >
                        View Candidates <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WIDGET ROLE SELECTOR: INTERACTIVE ROLE DROPDOWN CARD */}
          {activeWidget.type === 'show_role_selection_dropdown' && (
            <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl text-white space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">Select Role to 100% Autofill</h4>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">⚡ Instant Auto-populator</span>
              </div>

              <p className="text-xs text-gray-300">
                Pick a role from the dropdown below. The AI assistant will 100% prefill all 34 position parameters (Title, Department, Location, Salary, Tech Stack, & JD) automatically!
              </p>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Role Templates Dropdown</label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleSend(`Draft requisition for ${e.target.value}`);
                    }
                  }}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-emerald-400 transition-all cursor-pointer"
                >
                  <option value="">✨ Select a role from dropdown to 100% autofill...</option>
                  {(activeWidget.data?.roles || [
                    "DevSecOps Engineer",
                    "Senior Backend Engineer",
                    "Frontend Engineer (React / Next.js)",
                    "Data Engineer",
                    "Mobile Engineer (Flutter / React Native)",
                    "UI/UX Designer",
                    "Product Manager",
                    "QA Automation Engineer",
                    "Site Reliability Engineer (SRE)",
                    "Technical Writer"
                  ]).map((rTitle) => (
                    <option key={rTitle} value={rTitle}>{rTitle}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 text-[11px] text-gray-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Zero unfilled boxes remain after selecting a role.</span>
                </span>
              </div>
            </div>
          )}

          {/* WIDGET 3: REQUISITION DRAFT PREVIEW & PUBLISH FORM */}
          {activeWidget.type === 'hiring_requisition_draft' && (
            <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h4 className="text-base font-bold text-gray-900">Job Requisition Draft</h4>
                  <p className="text-xs text-gray-500">Review & customize position details before publishing to market.</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Draft Preview</span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Job Title</label>
                  <input
                    type="text"
                    value={draftReqForm.title}
                    onChange={(e) => setDraftReqForm({ ...draftReqForm, title: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Department</label>
                    <input
                      type="text"
                      value={draftReqForm.department}
                      onChange={(e) => setDraftReqForm({ ...draftReqForm, department: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Location</label>
                    <input
                      type="text"
                      value={draftReqForm.location}
                      onChange={(e) => setDraftReqForm({ ...draftReqForm, location: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Experience Level</label>
                    <input
                      type="text"
                      value={draftReqForm.experience_level}
                      onChange={(e) => setDraftReqForm({ ...draftReqForm, experience_level: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Salary Range Budget</label>
                    <input
                      type="text"
                      value={draftReqForm.salary_range}
                      onChange={(e) => setDraftReqForm({ ...draftReqForm, salary_range: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Required Tech Stack & Skills</label>
                  <input
                    type="text"
                    value={draftReqForm.skills}
                    onChange={(e) => setDraftReqForm({ ...draftReqForm, skills: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Job Description Overview</label>
                  <textarea
                    rows={3}
                    value={draftReqForm.job_description}
                    onChange={(e) => setDraftReqForm({ ...draftReqForm, job_description: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  onClick={handleConfirmPublishRequisition}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm & Publish Requisition
                </button>
              </div>
            </div>
          )}

          {/* WIDGET 4: REQUISITION PUBLISHED SUCCESS CARD */}
          {activeWidget.type === 'requisition_published_success' && (
            <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-md text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">Requisition Published Successfully</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Job Requisition <strong>{activeWidget.data?.title || 'Role'}</strong> is now live and published to market!
                </p>
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-left text-xs space-y-1">
                <div className="font-bold text-emerald-900">{activeWidget.data?.title}</div>
                <div className="text-emerald-700">Department: {activeWidget.data?.department || 'Engineering'}</div>
                <div className="text-emerald-600 font-mono text-[10px]">Requisition ID: {activeWidget.data?.req_id}</div>
              </div>

              <button
                onClick={() => handleSend('Show all active job requisitions')}
                className="w-full py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl font-semibold text-xs transition-all"
              >
                View Live Requisitions
              </button>
            </div>
          )}

          {/* WIDGET 5: SHORTLISTED CANDIDATES DIRECTORY */}
          {activeWidget.type === 'hiring_candidates_console' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900">Shortlisted Candidates ({Array.isArray(activeWidget.data) ? activeWidget.data.length : 0})</h4>
              </div>

              <div className="space-y-3">
                {(Array.isArray(activeWidget.data) ? activeWidget.data : []).map((cand, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:border-emerald-300 transition-all space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-sm">
                          {cand.name?.[0] || 'C'}
                        </div>
                        <div>
                          <h5 className="font-bold text-sm text-gray-900">{cand.name}</h5>
                          <p className="text-xs text-gray-500 font-medium">{cand.email}</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {cand.match_score || '94% Match'}
                      </span>
                    </div>

                    {/* Requisition applied to */}
                    {cand.requisition_title && (
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full truncate">
                          {cand.requisition_title}
                        </span>
                        {cand.vendor_name && (
                          <span className="text-xs text-gray-400 font-medium truncate">· {cand.vendor_name}</span>
                        )}
                      </div>
                    )}

                    <div className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <span className="font-bold text-gray-800">Skills: </span>
                      {cand.skills || 'React, Python, PostgreSQL, AWS'}
                    </div>

                    {cand.notes && (
                      <p className="text-xs text-gray-500 italic">{cand.notes}</p>
                    )}

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleSend(`Reject shortlisted candidate ${cand.name}`)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        Reject Candidate
                      </button>
                      <button
                        onClick={() => {
                          const reqId = cand.requisition_id;
                          const candId = cand.candidate_id || cand.id;
                          if (reqId && candId) {
                            navigate(`/dashboard/requisitions/${reqId}/candidates/${candId}`);
                          } else if (reqId) {
                            navigate(`/dashboard/requisitions/${reqId}/candidates`);
                          } else {
                            handleSend(`Schedule interview for ${cand.name}`);
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        Schedule Interview
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WIDGET: CANDIDATE REJECTED CONFIRMATION CARD */}
          {activeWidget.type === 'candidate_rejected_card' && (
            <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-md text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <UserX className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">Candidate Rejection Recorded</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Candidate <strong>{activeWidget.data?.candidate_name || 'Candidate'}</strong> status updated to <strong>Rejected</strong>.
                </p>
              </div>

              <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-left text-xs space-y-1.5">
                <div className="font-bold text-red-900">{activeWidget.data?.candidate_name}</div>
                <div className="text-red-700">Requisition Role: {activeWidget.data?.requisition_title || 'Engineering Role'}</div>
                <div className="text-red-700">Vendor: {activeWidget.data?.vendor_name || 'Vendorqueue'}</div>
                <div className="text-red-600 font-medium">Rejection Reason: {activeWidget.data?.reason || 'Not aligned with requirements.'}</div>
                <div className="text-red-500 font-mono text-[10px]">Candidate ID: {activeWidget.data?.candidate_id}</div>
              </div>

              <button
                onClick={() => handleSend('List shortlisted candidates for review')}
                className="w-full py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2"
              >
                <UserCheck className="w-4 h-4 text-emerald-400" />
                View Remaining Shortlist
              </button>
            </div>
          )}

          {/* WIDGET 6: INTERVIEW PROPOSAL & CONFIRMATION CARD */}
          {activeWidget.type === 'interview_proposal_confirm' && (
            <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h4 className="text-base font-bold text-gray-900">Interview Proposal</h4>
                  <p className="text-xs text-gray-500">Review meeting slot & details before sending interview invite.</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Proposal Ready</span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Candidate Name / Email</label>
                  <input
                    type="text"
                    value={interviewForm.candidate_identifier}
                    onChange={(e) => setInterviewForm({ ...interviewForm, candidate_identifier: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Job Requisition Role</label>
                  <input
                    type="text"
                    value={interviewForm.req_title}
                    onChange={(e) => setInterviewForm({ ...interviewForm, req_title: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Proposed Date</label>
                    <input
                      type="date"
                      value={interviewForm.proposed_date}
                      onChange={(e) => setInterviewForm({ ...interviewForm, proposed_date: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Proposed Time Slot</label>
                    <input
                      type="text"
                      value={interviewForm.proposed_time}
                      onChange={(e) => setInterviewForm({ ...interviewForm, proposed_time: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Meeting & Evaluation Notes</label>
                  <textarea
                    rows={2}
                    value={interviewForm.meeting_notes}
                    onChange={(e) => setInterviewForm({ ...interviewForm, meeting_notes: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <button
                  onClick={handleConfirmScheduleInterview}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Confirm & Schedule Interview
                </button>
              </div>
            </div>
          )}

          {/* WIDGET 7: ONBOARDING CANDIDATES & ISSUES DIRECTORY */}
          {activeWidget.type === 'onboarding_issues_console' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900">Accepted Candidates Onboarding ({Array.isArray(activeWidget.data) ? activeWidget.data.length : 0})</h4>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Onboarding Tracker
                </span>
              </div>

              <div className="space-y-3">
                {(Array.isArray(activeWidget.data) ? activeWidget.data : []).map((cand, idx) => {
                  const isCompleted = cand.status === 'Completed';
                  return (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3 hover:border-emerald-300 transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-sm">
                            {(cand.candidate_name || cand.name)?.[0] || 'C'}
                          </div>
                          <div>
                            <h5 className="font-bold text-sm text-gray-900">{cand.candidate_name || cand.name}</h5>
                            <p className="text-xs text-gray-500 font-medium">
                              Requisition: <strong className="text-gray-800">{cand.requisition_title}</strong>
                            </p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {cand.status || 'In Onboarding'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        <div>
                          <span className="text-gray-400 font-medium">Vendor: </span>
                          <span className="font-bold text-gray-800">{cand.vendor_name || 'Vendorqueue'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 font-medium">Match Score: </span>
                          <span className="font-bold text-emerald-600">{cand.match_score || '92%'}</span>
                        </div>
                      </div>

                      <div className={`text-xs p-3 rounded-xl border space-y-1 ${
                        isCompleted
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : 'bg-amber-50/60 border-amber-200 text-amber-900'
                      }`}>
                        <div className="font-bold">{cand.issue_title || (isCompleted ? 'Document Verification Completed' : 'Setup Onboarding & Work Order')}</div>
                        <div className="text-xs opacity-90">Action: {cand.action_required || (isCompleted ? 'Work Order Active & Onboarding Completed' : 'Setup software access and work order')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WIDGET 8: CANDIDATE WORKFORCE PROFILE & TIMESHEETS / EXPENSES */}
          {activeWidget.type === 'candidate_profile_detail' && (
            <div className="space-y-5">
              {/* Candidate Banner Card */}
              <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-extrabold flex items-center justify-center text-lg shadow-md shadow-emerald-100">
                      {(activeWidget.data?.candidate_name || activeWidget.data?.name)?.[0] || 'C'}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-gray-900">{activeWidget.data?.candidate_name || activeWidget.data?.name}</h4>
                      <p className="text-xs text-gray-500 font-medium">{activeWidget.data?.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                          {activeWidget.data?.vendor_name || 'Vendorqueue'}
                        </span>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          Match: {activeWidget.data?.match_score || '92%'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {activeWidget.data?.status || 'Active Workforce'}
                  </span>
                </div>

                <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed">
                  <strong className="text-gray-800">Requisition Role: </strong> {activeWidget.data?.requisition_title}
                  {activeWidget.data?.notes && (
                    <p className="mt-1 text-gray-500 italic">{activeWidget.data.notes}</p>
                  )}
                </div>
              </div>

              {/* Work Order Card */}
              {activeWidget.data?.work_order && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <h5 className="font-bold text-xs text-gray-900 uppercase tracking-wider">Active Work Order</h5>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                      {activeWidget.data.work_order.id}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 font-medium block">Bill Rate Budget</span>
                      <strong className="text-gray-900 font-bold">{activeWidget.data.work_order.bill_rate}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 font-medium block">Effective Start Date</span>
                      <strong className="text-gray-900 font-bold">{activeWidget.data.work_order.start_date}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400 font-medium block">Client Workspace</span>
                      <strong className="text-gray-800 font-medium">{activeWidget.data.work_order.client}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Timesheets Dashboard Card */}
              {activeWidget.data?.timesheets && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <h5 className="font-bold text-xs text-gray-900 uppercase tracking-wider">Timesheet Hours & Billing</h5>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {activeWidget.data.timesheets.status || 'APPROVED'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="text-[10px] text-gray-400 uppercase font-bold">Hours Logged</div>
                      <div className="text-lg font-black text-gray-900 mt-0.5">{activeWidget.data.timesheets.hours_logged}h</div>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <div className="text-[10px] text-emerald-700 uppercase font-bold">Approved</div>
                      <div className="text-lg font-black text-emerald-800 mt-0.5">{activeWidget.data.timesheets.hours_approved}h</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="text-[10px] text-gray-400 uppercase font-bold">Billed Amount</div>
                      <div className="text-lg font-black text-gray-900 mt-0.5">{activeWidget.data.timesheets.total_billed}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-500 font-medium text-center pt-1">
                    Cycle Period: <strong className="text-gray-800">{activeWidget.data.timesheets.period}</strong>
                  </div>
                </div>
              )}

              {/* Expense Claims Card */}
              {activeWidget.data?.expenses && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-teal-600" />
                      <h5 className="font-bold text-xs text-gray-900 uppercase tracking-wider">Candidate Expense Claims</h5>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-700">
                      Total: {activeWidget.data.expenses.total_claimed}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(activeWidget.data.expenses.items || []).map((exp, eIdx) => (
                      <div key={eIdx} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                        <div>
                          <div className="font-bold text-gray-800">{exp.category}</div>
                          <div className="text-[10px] text-gray-400">Claim Amount</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">{exp.amount}</div>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                            exp.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {exp.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hardware / Software Provisioning Checklist */}
              {activeWidget.data?.onboarding_setup && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-600" />
                      <h5 className="font-bold text-xs text-gray-900 uppercase tracking-wider">Software & Hardware Access</h5>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {(activeWidget.data.onboarding_setup || []).map((item, iIdx) => (
                      <div key={iIdx} className="flex items-center justify-between p-2 text-xs hover:bg-gray-50 rounded-lg transition-all">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-bold text-gray-800">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 font-mono">{item.value}</span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* WIDGET 9: PENDING TIMESHEET APPROVALS CONSOLE */}
          {activeWidget.type === 'pending_timesheets_console' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Pending Timesheets ({Array.isArray(activeWidget.data) ? activeWidget.data.length : 0})</h4>
                  <p className="text-xs text-gray-500 font-medium">Timesheet submissions awaiting hiring manager approval</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Action Required
                </span>
              </div>

              <div className="space-y-3">
                {(Array.isArray(activeWidget.data) ? activeWidget.data : []).map((ts, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3 hover:border-emerald-300 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-sm">
                          {ts.candidate_name?.[0] || 'C'}
                        </div>
                        <div>
                          <h5 className="font-bold text-sm text-gray-900">{ts.candidate_name}</h5>
                          <p className="text-xs text-gray-500 font-medium">{ts.role} • <span className="text-gray-700 font-semibold">{ts.vendor_name}</span></p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        ts.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {ts.status || 'SUBMITTED'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-xs">
                      <div>
                        <span className="text-gray-400 font-medium text-[10px] uppercase block">Period</span>
                        <strong className="text-gray-800 font-bold text-[11px]">{ts.period}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 font-medium text-[10px] uppercase block">Hours Logged</span>
                        <strong className="text-gray-900 font-bold">{ts.hours_logged} hrs</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 font-medium text-[10px] uppercase block">Total Billed</span>
                        <strong className="text-emerald-700 font-extrabold">{ts.total_billed}</strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleSend(`Show workforce profile details of candidate ${ts.candidate_name}`)}
                        className="text-xs font-semibold text-gray-600 hover:text-emerald-600 flex items-center gap-1"
                      >
                        View Candidate Details <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          alert(`Timesheet ${ts.id} for ${ts.candidate_name} has been approved!`);
                          setMessages((prev) => [
                            ...prev,
                            {
                              id: `ai-ts-${Date.now()}`,
                              sender: 'ai',
                              text: `Timesheet for **${ts.candidate_name}** (${ts.hours_logged} hrs, ${ts.total_billed}) has been approved successfully!`,
                              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }
                          ]);
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-200 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve Timesheet
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WIDGET 10: PENDING CANDIDATE EXPENSE CLAIMS CONSOLE */}
          {activeWidget.type === 'pending_expenses_console' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Pending Expense Claims ({Array.isArray(activeWidget.data) ? activeWidget.data.length : 0})</h4>
                  <p className="text-xs text-gray-500 font-medium">Expense reimbursements submitted by onboarded candidate team members</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Pending Review
                </span>
              </div>

              <div className="space-y-3">
                {(Array.isArray(activeWidget.data) ? activeWidget.data : []).map((exp, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3 hover:border-emerald-300 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 font-extrabold flex items-center justify-center text-sm">
                          {exp.candidate_name?.[0] || 'C'}
                        </div>
                        <div>
                          <h5 className="font-bold text-sm text-gray-900">{exp.candidate_name}</h5>
                          <p className="text-xs text-gray-500 font-medium">Submitted: {exp.submission_date} • <span className="text-gray-700 font-semibold">{exp.vendor_name}</span></p>
                        </div>
                      </div>
                      <span className="text-base font-extrabold text-emerald-700">
                        {exp.amount}
                      </span>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                      <span className="text-gray-400 font-medium block text-[10px] uppercase">Expense Item / Category</span>
                      <strong className="text-gray-900 font-bold text-xs">{exp.category}</strong>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleSend(`Show workforce profile details of candidate ${exp.candidate_name}`)}
                        className="text-xs font-semibold text-gray-600 hover:text-emerald-600 flex items-center gap-1"
                      >
                        View Candidate Details <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          alert(`Expense claim (${exp.amount}) for ${exp.candidate_name} has been approved!`);
                          setMessages((prev) => [
                            ...prev,
                            {
                              id: `ai-exp-${Date.now()}`,
                              sender: 'ai',
                              text: `Expense claim of **${exp.amount}** for **${exp.candidate_name}** (${exp.category}) has been approved!`,
                              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }
                          ]);
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-200 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve Expense
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
