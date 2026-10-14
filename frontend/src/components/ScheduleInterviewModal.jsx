import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  Plus,
  Check,
  CheckCircle2,
  Sparkles,
  User,
  Users,
  Code,
  Shield,
  Flag,
  Search,
  Award,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  AlertCircle,
} from 'lucide-react';
import { request } from '../api/client';

// Default rounds if no hiring process saved in DB yet
const DEFAULT_ROUNDS = [
  {
    id: 'r-1',
    title: 'Technical Interview',
    type: 'Technical',
    duration: 45,
    scheduledDate: '2026-10-06',
    scheduledTime: '10:30 AM',
    interviewer: {
      name: 'Rahul Sharma',
      role: 'Senior Software Engineer',
      email: 'rahul.sharma@termjobs.com',
      phone: '+91 98765 43210',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    },
  },
  {
    id: 'r-2',
    title: 'HR Interview',
    type: 'HR',
    duration: 30,
    scheduledDate: '',
    scheduledTime: '',
    interviewer: {
      name: 'Pooja Iyer',
      role: 'Lead HR Business Partner',
      email: 'pooja.i@termjobs.com',
      phone: '+91 98765 43211',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
    },
  },
  {
    id: 'r-3',
    title: 'Manager Interview',
    type: 'Manager',
    duration: 45,
    scheduledDate: '',
    scheduledTime: '',
    interviewer: {
      name: 'Anand Verma',
      role: 'Engineering Manager',
      email: 'anand.v@termjobs.com',
      phone: '+91 98765 43212',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    },
  },
  {
    id: 'r-4',
    title: 'Final Review',
    type: 'Final',
    duration: 30,
    scheduledDate: '',
    scheduledTime: '',
    interviewer: {
      name: 'Henry Vance',
      role: 'Director of Product',
      email: 'henry.vance@termjobs.com',
      phone: '+91 98765 43213',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
    },
  },
];

const TIME_SLOTS = [
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '12:00 PM',
  '12:30 PM',
  '01:00 PM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
  '04:30 PM',
];

const AVAILABLE_INTERVIEWERS = [
  {
    id: 'int-1',
    name: 'Rahul Sharma',
    role: 'Senior Software Engineer',
    email: 'rahul.sharma@termjobs.com',
    phone: '+91 98765 43210',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
  },
  {
    id: 'int-2',
    name: 'Pooja Iyer',
    role: 'Lead HR Business Partner',
    email: 'pooja.i@termjobs.com',
    phone: '+91 98765 43211',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
  },
  {
    id: 'int-3',
    name: 'Anand Verma',
    role: 'Engineering Manager',
    email: 'anand.v@termjobs.com',
    phone: '+91 98765 43212',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
  },
  {
    id: 'int-4',
    name: 'Priya Nair',
    role: 'Staff System Architect',
    email: 'priya.nair@termjobs.com',
    phone: '+91 98765 43214',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  },
];

function getCategoryIcon(type) {
  switch (type) {
    case 'Technical':
      return <Code size={15} />;
    case 'HR':
      return <Users size={15} />;
    case 'Manager':
      return <Shield size={15} />;
    case 'Final':
      return <Flag size={15} />;
    case 'Screening':
      return <Search size={15} />;
    case 'Leadership':
      return <Award size={15} />;
    default:
      return <Calendar size={15} />;
  }
}

// Mini score gauge
function MiniScoreRing({ score = 92 }) {
  const size = 36;
  const stroke = 3;
  const radius = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, score || 0));
  const offset = circ * (1 - pct / 100);

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={stroke}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#059669"
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <span className="absolute font-black text-gray-900 text-[11px] tracking-tight">{score}</span>
    </div>
  );
}

export default function ScheduleInterviewModal({
  candidate,
  requisitionTitle = 'Senior Product Designer',
  requisitionCode = 'REQ #1A1D5F',
  onClose,
  onScheduled,
}) {
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(2); // 1 = Set Process (completed with checkmark), 2 = Schedule Interviews, 3 = Review & Confirm
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduledSuccess, setScheduledSuccess] = useState(false);

  // Calendar month state
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 9, 1)); // October 2026 as per mockup
  const [selectedDate, setSelectedDate] = useState('2026-10-06');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('10:30 AM');

  // Interviewers list & search state
  const [interviewersList, setInterviewersList] = useState(AVAILABLE_INTERVIEWERS);
  const [interviewerSearch, setInterviewerSearch] = useState('');
  const [showInterviewerDropdown, setShowInterviewerDropdown] = useState(false);

  // Add new interviewer modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newInterviewer, setNewInterviewer] = useState({ name: '', role: '', email: '' });
  const [isSavingInterviewer, setIsSavingInterviewer] = useState(false);
  const [interviewerError, setInterviewerError] = useState('');

  // 1. Load interviewers from DB
  const loadInterviewersFromDb = async () => {
    try {
      const res = await request('/interviews/interviewers');
      if (res && Array.isArray(res.interviewers) && res.interviewers.length > 0) {
        setInterviewersList(res.interviewers);
        try {
          localStorage.setItem('hm_saved_interviewers', JSON.stringify(res.interviewers));
        } catch (e) {}
      }
    } catch (e) {
      try {
        const cached = localStorage.getItem('hm_saved_interviewers');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setInterviewersList(parsed);
          }
        }
      } catch (err) {}
    }
  };

  useEffect(() => {
    loadInterviewersFromDb();
  }, []);

  // 2. Load configured interview process from DB / localStorage
  useEffect(() => {
    let isMounted = true;

    async function loadConfiguredProcess() {
      try {
        const res = await request('/interviews/process/template');
        if (!isMounted) return;

        if (res && res.is_saved && Array.isArray(res.rounds) && res.rounds.length > 0) {
          setRounds(
            res.rounds.map((r, i) => ({
              ...r,
              duration: r.duration || 45,
              scheduledDate: i === 0 ? '2026-10-06' : '',
              scheduledTime: i === 0 ? '10:30 AM' : '',
              interviewer: DEFAULT_ROUNDS[i % DEFAULT_ROUNDS.length].interviewer,
            }))
          );
          return;
        }
      } catch (e) {
        // Fallback
      }

      try {
        const cached = localStorage.getItem('hm_interview_process_template');
        if (cached && isMounted) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.rounds) && parsed.rounds.length > 0) {
            setRounds(
              parsed.rounds.map((r, i) => ({
                ...r,
                duration: r.duration || 45,
                scheduledDate: i === 0 ? '2026-10-06' : '',
                scheduledTime: i === 0 ? '10:30 AM' : '',
                interviewer: DEFAULT_ROUNDS[i % DEFAULT_ROUNDS.length].interviewer,
              }))
            );
          }
        }
      } catch (e) {
        // Ignore
      }
    }

    loadConfiguredProcess();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeRound = rounds[selectedRoundIndex] || rounds[0];

  // Calendar helper: days in October 2026
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // Sunday = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days = [];

    // Prev month filler
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        dateStr: `${year}-${String(month).padStart(2, '0')}-${String(prevMonthDays - i).padStart(2, '0')}`,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        isCurrentMonth: true,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        hasSlots: [6, 7, 8, 9, 13, 14, 15, 16, 20, 21, 22].includes(d),
      });
    }

    return days;
  }, [currentMonth]);

  // Handle slot click
  const handleSelectSlot = (slot) => {
    setSelectedTimeSlot(slot);
    setRounds((prev) =>
      prev.map((r, idx) =>
        idx === selectedRoundIndex
          ? { ...r, scheduledDate: selectedDate, scheduledTime: slot }
          : r
      )
    );
  };

  // Handle day click
  const handleSelectDay = (dayObj) => {
    if (!dayObj.isCurrentMonth) return;
    setSelectedDate(dayObj.dateStr);
    setRounds((prev) =>
      prev.map((r, idx) =>
        idx === selectedRoundIndex
          ? { ...r, scheduledDate: dayObj.dateStr, scheduledTime: selectedTimeSlot }
          : r
      )
    );
  };

  // Handle interviewer change
  const handleAssignInterviewer = (interviewer) => {
    setRounds((prev) =>
      prev.map((r, idx) =>
        idx === selectedRoundIndex ? { ...r, interviewer } : r
      )
    );
    setShowInterviewerDropdown(false);
  };

  // Handle saving new interviewer into DB
  const handleSaveNewInterviewer = async (e) => {
    e?.preventDefault();
    if (!newInterviewer.name.trim()) {
      setInterviewerError('Please enter full name');
      return;
    }
    if (!newInterviewer.role.trim()) {
      setInterviewerError('Please enter role / designation');
      return;
    }
    if (!newInterviewer.email.trim()) {
      setInterviewerError('Please enter email address');
      return;
    }

    setIsSavingInterviewer(true);
    setInterviewerError('');

    try {
      const res = await request('/interviews/interviewers', {
        method: 'POST',
        body: {
          name: newInterviewer.name.trim(),
          role: newInterviewer.role.trim(),
          email: newInterviewer.email.trim(),
        },
      });

      let added = null;
      if (res && res.interviewer) {
        added = res.interviewer;
        if (Array.isArray(res.interviewers)) {
          setInterviewersList(res.interviewers);
          try {
            localStorage.setItem('hm_saved_interviewers', JSON.stringify(res.interviewers));
          } catch (err) {}
        }
      } else {
        added = {
          id: `int-${Date.now()}`,
          name: newInterviewer.name.trim(),
          role: newInterviewer.role.trim(),
          email: newInterviewer.email.trim(),
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newInterviewer.name.trim().replace(/\s+/g, '')}`,
        };
        setInterviewersList((prev) => [added, ...prev]);
      }

      // Automatically assign the newly added interviewer to active round
      if (added) {
        handleAssignInterviewer(added);
      }

      setNewInterviewer({ name: '', role: '', email: '' });
      setShowAddModal(false);
    } catch (err) {
      // Local fallback
      const added = {
        id: `int-${Date.now()}`,
        name: newInterviewer.name.trim(),
        role: newInterviewer.role.trim(),
        email: newInterviewer.email.trim(),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newInterviewer.name.trim().replace(/\s+/g, '')}`,
      };
      setInterviewersList((prev) => [added, ...prev]);
      handleAssignInterviewer(added);
      setNewInterviewer({ name: '', role: '', email: '' });
      setShowAddModal(false);
    } finally {
      setIsSavingInterviewer(false);
    }
  };

  // Proceed directly to Review & Confirm (Step 3)
  const handleSaveAndNext = () => {
    // Sync current active round selections before proceeding
    setRounds((prev) =>
      prev.map((r, idx) =>
        idx === selectedRoundIndex
          ? {
              ...r,
              scheduledDate: selectedDate || r.scheduledDate,
              scheduledTime: selectedTimeSlot || r.scheduledTime,
            }
          : r
      )
    );
    // When press Save & Next it goes to Review & Confirm (where all details are shown non-editable)
    setCurrentStep(3);
  };

  // Final confirmation and dispatch
  const handleConfirmAndSchedule = async () => {
    setIsSubmitting(true);
    try {
      await request('/interviews/schedule', {
        method: 'POST',
        body: {
          candidate_id: candidate?.id,
          candidate_name: candidate?.name,
          candidate_email: candidate?.email,
          rounds: rounds,
          requisition_title: requisitionTitle,
          requisition_code: requisitionCode,
        },
      });
    } catch (e) {
      // Silent fallback
    }

    try {
      const stored = localStorage.getItem('scheduled_candidates_pool') || '[]';
      const parsed = JSON.parse(stored);
      parsed.push({
        candidateId: candidate?.id,
        candidateName: candidate?.name,
        rounds,
        requisitionTitle,
        requisitionCode,
        scheduledAt: new Date().toISOString(),
      });
      localStorage.setItem('scheduled_candidates_pool', JSON.stringify(parsed));
    } catch (e) {}

    setIsSubmitting(false);
    setScheduledSuccess(true);
    setTimeout(() => {
      if (onScheduled) onScheduled({ candidate, rounds });
      onClose();
    }, 700);
  };

  // Filtered interviewers from DB
  const filteredInterviewers = interviewersList.filter(
    (i) =>
      !interviewerSearch ||
      i.name.toLowerCase().includes(interviewerSearch.toLowerCase()) ||
      i.role.toLowerCase().includes(interviewerSearch.toLowerCase()) ||
      i.email.toLowerCase().includes(interviewerSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-5xl bg-white border border-black/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[94vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── TOP HEADER ── */}
        <div className="p-5 sm:p-6 flex items-center justify-between border-b border-black/[0.06] bg-white">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200/80 flex items-center justify-center text-gray-800 shadow-3xs shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight leading-tight">
                {currentStep === 3 ? 'Review & Confirm Interviews' : 'Schedule Interviews'}
              </h2>
              <p className="text-xs text-gray-500 font-normal mt-0.5">
                {currentStep === 3
                  ? 'Verify candidate details and assigned interview rounds before finalizing.'
                  : 'Assign date, time and interviewers for each round.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-black flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── STEPPER BAR (Reflects Active & Completed Steps) ── */}
        <div className="px-6 py-3.5 border-b border-black/[0.06] bg-gray-50/60 flex items-center justify-center gap-3 sm:gap-6 flex-wrap shrink-0">
          {/* Step 1: Set Interview Process (COMPLETED with checkmark) */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shadow-3xs">
              <Check size={11} strokeWidth={3} />
            </div>
            <span className="text-xs font-semibold text-gray-700">Set Interview Process</span>
          </div>

          <div className="w-8 sm:w-16 border-t border-dashed border-gray-300" />

          {/* Step 2: Schedule Interviews (Completed if on step 3) */}
          <div
            onClick={() => currentStep === 3 && setCurrentStep(2)}
            className={`flex items-center gap-2 ${currentStep === 3 ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
          >
            {currentStep === 3 ? (
              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shadow-3xs">
                <Check size={11} strokeWidth={3} />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-black text-white text-[11px] font-bold flex items-center justify-center shadow-3xs">
                2
              </div>
            )}
            <span className={`text-xs ${currentStep === 2 ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
              Schedule Interviews
            </span>
          </div>

          <div className="w-8 sm:w-16 border-t border-dashed border-gray-300" />

          {/* Step 3: Review & Confirm (Active when currentStep === 3) */}
          <div className="flex items-center gap-2">
            <div
              className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center transition-all ${
                currentStep === 3
                  ? 'bg-black text-white shadow-3xs'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              3
            </div>
            <span
              className={`text-xs transition-colors ${
                currentStep === 3 ? 'font-bold text-gray-900' : 'font-medium text-gray-500'
              }`}
            >
              Review & Confirm
            </span>
          </div>
        </div>

        {/* ── MODAL BODY ── */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-5 sm:p-6 pb-4 sm:pb-5 space-y-4">
          {currentStep === 2 ? (
            /* ════════ STEP 2: SCHEDULE INTERVIEWS CONFIGURATION ════════ */
            <>
              {/* SPLIT LAYOUT: ROUNDS + INTERVIEWER (LEFT) | CALENDAR & TIME SLOTS (RIGHT) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN: Interview Rounds List + Select Interviewer */}
                <div className="lg:col-span-5 space-y-4">
                  {/* 1. Interview Rounds List */}
                  <div className="space-y-2.5">
                    <h4 className="text-sm font-bold text-gray-900 tracking-tight">
                      Interview Rounds
                    </h4>

                    <div className="space-y-1.5">
                      {rounds.map((round, idx) => {
                        const isSelected = selectedRoundIndex === idx;
                        const isScheduled = Boolean(round.scheduledDate && round.scheduledTime);

                        return (
                          <div
                            key={round.id || idx}
                            onClick={() => {
                              setSelectedRoundIndex(idx);
                              if (round.scheduledDate) setSelectedDate(round.scheduledDate);
                              if (round.scheduledTime) setSelectedTimeSlot(round.scheduledTime);
                            }}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                              isSelected
                                ? 'bg-gray-50/80 border-black/40 shadow-3xs ring-1 ring-black/10'
                                : 'bg-white hover:bg-gray-50/60 border-gray-200/90'
                            }`}
                          >
                            {/* Round Index / Category Icon Box */}
                            {isSelected ? (
                              <div className="w-7 h-7 rounded-lg bg-black text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs">
                                {idx + 1}
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200/80 text-gray-700 flex items-center justify-center shrink-0">
                                {getCategoryIcon(round.type)}
                              </div>
                            )}

                            {/* Title & Scheduling Status */}
                            <div className="min-w-0 flex-1">
                              <div className="text-xs sm:text-[13px] font-bold text-gray-900 tracking-tight truncate">
                                {round.title}
                              </div>
                              <div
                                className={`text-[10.5px] font-medium truncate ${
                                  isScheduled ? 'text-emerald-700 font-semibold' : 'text-gray-400'
                                }`}
                              >
                                {isScheduled
                                  ? `Oct ${round.scheduledDate?.split('-')[2] || '6'}, ${round.scheduledTime}`
                                  : 'Not Scheduled'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. SELECT INTERVIEWER SECTION (Left Column, Under Rounds) */}
                  <div className="space-y-2.5 pt-4 border-t border-black/[0.06]">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-sm font-bold text-gray-900 tracking-tight">
                        Select Interviewer(s)
                      </h5>

                      <button
                        type="button"
                        onClick={() => {
                          setInterviewerError('');
                          setShowAddModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold flex items-center gap-1 shadow-3xs transition-all cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Add New</span>
                      </button>
                    </div>

                    {/* Search Bar / Dropdown to pick interviewer from DB */}
                    <div className="relative">
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={interviewerSearch}
                        onChange={(e) => {
                          setInterviewerSearch(e.target.value);
                          setShowInterviewerDropdown(true);
                        }}
                        onFocus={() => setShowInterviewerDropdown(true)}
                        placeholder="Search interviewer by name or email..."
                        className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50/60 hover:bg-gray-50 border border-gray-200/90 rounded-xl text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs"
                      />

                      {showInterviewerDropdown && (
                        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl p-2 z-30 max-h-52 overflow-y-auto no-scrollbar space-y-1">
                          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 flex items-center justify-between">
                            <span>Select Interviewer ({filteredInterviewers.length})</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowInterviewerDropdown(false);
                              }}
                              className="hover:text-black cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </div>

                          {filteredInterviewers.length === 0 ? (
                            <div className="p-3 text-center text-xs text-gray-400">
                              No interviewers found.{' '}
                              <button
                                type="button"
                                onClick={() => {
                                  setShowInterviewerDropdown(false);
                                  setShowAddModal(true);
                                }}
                                className="text-black font-bold underline cursor-pointer"
                              >
                                Add New
                              </button>
                            </div>
                          ) : (
                            filteredInterviewers.map((interviewer) => (
                              <div
                                key={interviewer.id || interviewer.email}
                                onClick={() => handleAssignInterviewer(interviewer)}
                                className="p-2.5 rounded-xl hover:bg-gray-50 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <img
                                    src={interviewer.avatar}
                                    alt={interviewer.name}
                                    className="w-8 h-8 rounded-full object-cover shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                                      {interviewer.name}
                                    </div>
                                    <div className="text-[11px] text-gray-500 truncate">
                                      {interviewer.role} &bull; {interviewer.email}
                                    </div>
                                  </div>
                                </div>
                                {activeRound.interviewer?.email === interviewer.email && (
                                  <Check size={15} className="text-emerald-600 shrink-0" />
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected Interviewer Card */}
                    {activeRound.interviewer && (
                      <div className="bg-white border border-gray-200/90 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-3xs">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img
                            src={activeRound.interviewer.avatar}
                            alt={activeRound.interviewer.name}
                            className="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-black/5"
                          />
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-bold text-gray-900 tracking-tight truncate">
                              {activeRound.interviewer.name}
                            </div>
                            <div className="text-xs text-gray-500 truncate mt-0.5">
                              {activeRound.interviewer.role}
                            </div>
                            {activeRound.interviewer.email && (
                              <div className="text-[11px] text-gray-400 truncate">
                                {activeRound.interviewer.email}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setRounds((prev) =>
                                prev.map((r, idx) =>
                                  idx === selectedRoundIndex ? { ...r, interviewer: null } : r
                                )
                              )
                            }
                            className="w-7 h-7 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                            title="Remove interviewer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: Active Round Date & Time Slots (Enlarged Calendar & Roomy Timesheet) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Header for Active Round */}
                  <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] pb-2.5">
                    <div>
                      <h4 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                        {activeRound.title}
                      </h4>
                      <p className="text-xs text-gray-500 font-normal mt-0.5">
                        Select date, time and interviewer for this round.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 shrink-0">
                      <Clock size={14} className="text-gray-400" />
                      <span>Estimated duration: {activeRound.duration || 45} mins</span>
                    </div>
                  </div>

                  {/* Calendar & Time Slots Grid (Uncompacted, generous sizing) */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
                    {/* ── ENLARGED CALENDAR ── */}
                    <div className="sm:col-span-6 bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-4.5 shadow-3xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm sm:text-base font-bold text-gray-900">October 2026</span>
                        <div className="flex items-center gap-1 text-gray-500">
                          <button
                            type="button"
                            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center cursor-pointer transition-colors"
                            title="Previous Month"
                          >
                            <ChevronLeft size={15} />
                          </button>
                          <button
                            type="button"
                            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center cursor-pointer transition-colors"
                            title="Next Month"
                          >
                            <ChevronRight size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Day Names Header */}
                      <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-400 py-0.5">
                        <span>Sun</span>
                        <span>Mon</span>
                        <span>Tue</span>
                        <span>Wed</span>
                        <span>Thu</span>
                        <span>Fri</span>
                        <span>Sat</span>
                      </div>

                      {/* Days Matrix (Roomy cells with pill selection) */}
                      <div className="grid grid-cols-7 gap-1.5 text-center text-xs sm:text-sm">
                        {calendarDays.map((dObj, i) => {
                          const isChosen = selectedDate === dObj.dateStr && dObj.isCurrentMonth;

                          return (
                            <div
                              key={i}
                              onClick={() => handleSelectDay(dObj)}
                              className={`h-8 sm:h-9 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                                !dObj.isCurrentMonth
                                  ? 'text-gray-300 pointer-events-none'
                                  : isChosen
                                  ? 'bg-black text-white font-bold shadow-xs'
                                  : 'text-gray-800 hover:bg-gray-100 font-medium'
                              }`}
                            >
                              <span className="leading-none">{dObj.day}</span>
                              {dObj.hasSlots && !isChosen && (
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── ENLARGED TIMESHEET (Available Time Slots) ── */}
                    <div className="sm:col-span-6 space-y-2">
                      <div>
                        <h5 className="text-sm font-bold text-gray-900">
                          Available Time Slots
                        </h5>
                        <span className="text-xs font-normal text-gray-400 block mt-0.5">
                          Tue, Oct 6, 2026
                        </span>
                      </div>

                      {/* 3 columns roomy pill grid */}
                      <div className="grid grid-cols-3 gap-2">
                        {TIME_SLOTS.map((slot) => {
                          const isSlotChosen = selectedTimeSlot === slot;

                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => handleSelectSlot(slot)}
                              className={`py-2.5 px-1.5 text-center rounded-xl text-xs sm:text-[12.5px] transition-all cursor-pointer border ${
                                isSlotChosen
                                  ? 'bg-black text-white font-bold border-black shadow-xs'
                                  : 'bg-white hover:bg-gray-50 text-gray-800 font-semibold border-gray-200/90 hover:border-gray-300'
                              }`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SAVE & NEXT ACTION BUTTON ── */}
              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleSaveAndNext}
                  className="px-7 py-3 rounded-2xl bg-black hover:bg-gray-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-sm transition-all cursor-pointer"
                >
                  <span>
                    {selectedRoundIndex < rounds.length - 1 ? 'Save & Next' : 'Save & Next'}
                  </span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : (
            /* ════════ STEP 3: REVIEW & CONFIRM (ALL DETAILS NON-EDITABLE) ════════ */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Candidate & Role Non-editable Summary Card */}
              <div className="bg-gray-50/80 border border-gray-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={candidate?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                    alt={candidate?.name || 'Candidate'}
                    className="w-12 h-12 rounded-2xl object-cover ring-2 ring-black/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-gray-900 tracking-tight">
                        {candidate?.name || 'Arjun S'}
                      </h3>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                        {candidate?.score || 92}% Match Score
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium mt-0.5">
                      {requisitionTitle} &bull; <span className="font-mono text-gray-500">{requisitionCode}</span>
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Mail size={12} /> {candidate?.email || 'arjun.s@email.com'}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {candidate?.location || 'Bangalore, India'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase size={12} /> {candidate?.experience || '3 yrs'} experience
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0 bg-white border border-gray-200/80 rounded-xl px-3.5 py-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Configured Schedule</div>
                  <div className="text-sm sm:text-base font-black text-gray-900">{rounds.length} Interview Rounds</div>
                </div>
              </div>

              {/* Non-editable Configured Rounds Cards */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900 tracking-tight">
                    Interview Rounds Schedule
                  </h4>
                  <span className="text-[11px] text-gray-500 font-semibold bg-gray-100 px-2.5 py-1 rounded-lg">
                    Locked / Non-editable
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {rounds.map((round, idx) => (
                    <div
                      key={round.id || idx}
                      className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-3xs flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="w-6 h-6 rounded-lg bg-black text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10.5px] font-bold">
                            {round.duration || 45} mins
                          </span>
                        </div>

                        <div className="text-sm font-bold text-gray-900 tracking-tight">
                          {round.title}
                        </div>

                        <div className="mt-2.5 p-2 rounded-xl bg-gray-50 border border-gray-200/60 space-y-1">
                          <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                            <Calendar size={12} className="text-emerald-600" />
                            <span>
                              {round.scheduledDate
                                ? `Oct ${round.scheduledDate.split('-')[2] || '6'}, 2026`
                                : 'Oct 06, 2026'}
                            </span>
                            <span>&bull;</span>
                            <Clock size={12} className="text-emerald-600" />
                            <span>{round.scheduledTime || '10:30 AM'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Non-editable Assigned Interviewer Card */}
                      <div className="pt-2.5 border-t border-gray-100">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                          Assigned Interviewer
                        </div>
                        {round.interviewer ? (
                          <div className="flex items-center gap-2.5">
                            <img
                              src={round.interviewer.avatar}
                              alt={round.interviewer.name}
                              className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-black/10"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-gray-900 truncate">
                                {round.interviewer.name}
                              </div>
                              <div className="text-[10px] text-gray-500 truncate">
                                {round.interviewer.role}
                              </div>
                              {round.interviewer.email && (
                                <div className="text-[9.5px] text-gray-400 truncate">
                                  {round.interviewer.email}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 italic">Interviewer to be assigned</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Automated dispatch notice */}
              <div className="p-3 bg-purple-50/70 border border-purple-200/70 rounded-xl text-purple-900 text-xs flex items-center gap-2.5">
                <CheckCircle2 size={16} className="text-purple-600 shrink-0" />
                <span>
                  Upon confirmation, calendar invitations (.ics) and video interview room access will be automatically generated and dispatched to all participants.
                </span>
              </div>

              {/* Actions: Back to edit & Confirm and Schedule */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-2xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-all"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Edit</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAndSchedule}
                  disabled={isSubmitting}
                  className={`px-7 py-3 rounded-2xl bg-black hover:bg-gray-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-sm transition-all cursor-pointer ${
                    scheduledSuccess ? 'bg-emerald-600 hover:bg-emerald-700' : ''
                  }`}
                >
                  {scheduledSuccess ? (
                    <>
                      <Check size={16} />
                      <span>Interviews Scheduled!</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm & Schedule</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ADD NEW INTERVIEWER POPUP (Persists to MongoDB) ── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-md bg-white border border-black/[0.08] rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-800">
                  <User size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Add New Interviewer</h3>
                  <p className="text-[11px] text-gray-500">
                    Saves to database and available for all requisitions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-black flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {interviewerError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{interviewerError}</span>
              </div>
            )}

            <form onSubmit={handleSaveNewInterviewer} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newInterviewer.name}
                  onChange={(e) => setNewInterviewer({ ...newInterviewer, name: e.target.value })}
                  placeholder="e.g. Vikram Malhotra"
                  className="w-full px-3 py-2 bg-gray-50/60 hover:bg-gray-50 border border-gray-200/80 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Role / Designation <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newInterviewer.role}
                  onChange={(e) => setNewInterviewer({ ...newInterviewer, role: e.target.value })}
                  placeholder="e.g. Lead System Architect"
                  className="w-full px-3 py-2 bg-gray-50/60 hover:bg-gray-50 border border-gray-200/80 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={newInterviewer.email}
                  onChange={(e) => setNewInterviewer({ ...newInterviewer, email: e.target.value })}
                  placeholder="e.g. vikram.m@termjobs.com"
                  className="w-full px-3 py-2 bg-gray-50/60 hover:bg-gray-50 border border-gray-200/80 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-black border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingInterviewer}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-black hover:bg-gray-800 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingInterviewer ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check size={13} />
                      <span>Save Interviewer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
