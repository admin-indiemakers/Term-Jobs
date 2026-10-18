import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  Plus,
  Check,
  CheckCheck,
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
  MessageSquare,
} from 'lucide-react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import GoogleCalendarConnect from './GoogleCalendarConnect';
import { todayForDeadline } from '../utils/submissionDeadline';
import {
  toInterviewTime,
  format12to24,
  parseSlotToMinutes,
  getNowInKolkata,
  isTimeInPast,
  isRoundEnded,
} from '../utils/interviewSchedule';

export { isRoundEnded };

// Default editable process when this requisition has no saved template yet.
const DEFAULT_ROUNDS = ['Technical', 'HR', 'Manager', 'Final'].map((type, index) => ({ id: `round-${index + 1}`, title: type === 'Final' ? 'Final Review' : `${type} Interview`, type, duration: type === 'Final' ? 30 : 45, scheduledDate: '', scheduledTime: '', interviewer: null }));

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
  '01:30 PM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
  '04:30 PM',
  '05:00 PM',
  '05:30 PM',
  '06:00 PM',
  '06:30 PM',
  '07:00 PM',
  '07:30 PM',
  '08:00 PM',
];

function format24to12(timeStr) {
  if (!timeStr) return '';
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!match) return timeStr;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

export function getInterviewerAvailability(
  interviewer,
  targetDate,
  targetTime,
  durationMinutes = 45,
  currentRoundIndex = -1,
  allRounds = [],
  candidate = null
) {
  if (!interviewer || !targetDate || !targetTime) {
    return { isAvailable: true, conflict: null };
  }

  const targetMinutes = parseSlotToMinutes(targetTime);
  if (targetMinutes === null) {
    return { isAvailable: true, conflict: null };
  }
  const targetDuration = parseInt(durationMinutes || 45, 10);
  const targetEndMinutes = targetMinutes + targetDuration;

  const targetEmail = (interviewer.email || '').trim().toLowerCase();
  const targetName = (interviewer.name || '').trim().toLowerCase();

  const currentRound = (Array.isArray(allRounds) && currentRoundIndex >= 0) ? allRounds[currentRoundIndex] : null;
  const currentRoundId = currentRound?.persistedRoundId || currentRound?.id;
  const currentRoundTitle = (currentRound?.title || currentRound?.round_name || '').toLowerCase().trim();
  const candName = (candidate?.name || candidate?.candidate_name || currentRound?.candidateName || currentRound?.candidate_name || '').toLowerCase().trim();

  // 1. Check against other rounds within this modal session (intra-modal conflicts across rounds)
  if (Array.isArray(allRounds)) {
    for (let i = 0; i < allRounds.length; i++) {
      if (i === currentRoundIndex) continue;
      const otherRound = allRounds[i];
      if (!otherRound?.scheduledDate || !otherRound?.scheduledTime || !otherRound?.interviewer) continue;

      const otherEmail = (otherRound.interviewer.email || '').trim().toLowerCase();
      const otherName = (otherRound.interviewer.name || '').trim().toLowerCase();

      const matches = (targetEmail && otherEmail && targetEmail === otherEmail) ||
                      (!targetEmail && targetName && otherName && targetName === otherName);

      if (matches && otherRound.scheduledDate === targetDate) {
        const otherStartMin = parseSlotToMinutes(otherRound.scheduledTime);
        if (otherStartMin !== null) {
          const otherDuration = parseInt(otherRound.duration || 45, 10);
          const otherEndMin = otherStartMin + otherDuration;
          if (targetMinutes < otherEndMin && targetEndMinutes > otherStartMin) {
            return {
              isAvailable: false,
              conflict: {
                source: 'current_session',
                roundTitle: otherRound.title || `Round ${i + 1}`,
                timeRange: `${otherRound.scheduledTime} (${otherDuration}m)`,
                reason: `Already assigned to ${otherRound.title || `Round ${i + 1}`} at ${otherRound.scheduledTime}`,
              },
            };
          }
        }
      }
    }
  }

  // 2. Check against already booked slots in database (across all candidates, requisitions, and rounds)
  const bookedSlots = interviewer.booked_slots || [];
  for (const slot of bookedSlots) {
    // A) Skip if this slot is the round being evaluated itself
    if (currentRoundId && slot.round_id && String(slot.round_id).toLowerCase() === String(currentRoundId).toLowerCase()) {
      continue;
    }
    if (slot.round_id && currentRound?.persistedRoundId && String(slot.round_id) === String(currentRound.persistedRoundId)) {
      continue;
    }

    // B) Skip if this slot matches this same candidate and round title
    if (
      slot.round_name &&
      currentRoundTitle &&
      slot.round_name.toLowerCase().trim() === currentRoundTitle &&
      candName &&
      slot.candidate_name &&
      (
        slot.candidate_name.toLowerCase().trim() === candName ||
        slot.candidate_name.toLowerCase().includes(candName) ||
        candName.includes(slot.candidate_name.toLowerCase())
      )
    ) {
      continue;
    }

    // C) If this round was already scheduled and is unchanged, its slot in database is its own appointment
    if (
      currentRound?.isAlreadyScheduled &&
      slot.scheduled_date === targetDate &&
      (
        toInterviewTime(slot.scheduled_time) === toInterviewTime(targetTime) ||
        toInterviewTime(slot.scheduled_time) === toInterviewTime(currentRound.originalTime)
      ) &&
      (
        !slot.candidate_name ||
        !candName ||
        slot.candidate_name.toLowerCase().includes(candName) ||
        candName.includes(slot.candidate_name.toLowerCase())
      )
    ) {
      continue;
    }

    if (slot.scheduled_date === targetDate) {
      const slotStartMin = parseSlotToMinutes(slot.scheduled_time);
      if (slotStartMin !== null) {
        const slotDuration = parseInt(slot.duration_minutes || 45, 10);
        const slotEndMin = slotStartMin + slotDuration;
        if (targetMinutes < slotEndMin && targetEndMinutes > slotStartMin) {
          const candInfo = slot.candidate_name ? ` with ${slot.candidate_name}` : '';
          const reqInfo = slot.requisition_title ? ` for '${slot.requisition_title}'` : '';
          return {
            isAvailable: false,
            conflict: {
              source: 'database',
              roundTitle: slot.round_name || 'Interview Round',
              candidateName: slot.candidate_name,
              requisitionTitle: slot.requisition_title,
              timeRange: `${slot.scheduled_time} (${slotDuration}m)`,
              reason: `Booked for ${slot.round_name || 'Interview'}${candInfo}${reqInfo} at ${slot.scheduled_time}`,
            },
          };
        }
      }
    }
  }

  return { isAvailable: true, conflict: null };
}

export function getCandidateSlotConflict(
  targetDate,
  targetTime,
  durationMinutes = 45,
  currentRoundIndex = -1,
  allRounds = [],
  candidateBookedRounds = []
) {
  if (!targetDate || !targetTime) {
    return { hasConflict: false, conflict: null };
  }

  const targetMinutes = parseSlotToMinutes(targetTime);
  if (targetMinutes === null) {
    return { hasConflict: false, conflict: null };
  }
  const targetDuration = parseInt(durationMinutes || 45, 10);
  const targetEndMinutes = targetMinutes + targetDuration;

  // 1. Check against candidate's other rounds within this modal session
  if (Array.isArray(allRounds)) {
    for (let i = 0; i < allRounds.length; i++) {
      if (i === currentRoundIndex) continue;
      const otherRound = allRounds[i];
      if (!otherRound?.scheduledDate || !otherRound?.scheduledTime) continue;

      if (otherRound.scheduledDate === targetDate) {
        const otherStartMin = parseSlotToMinutes(otherRound.scheduledTime);
        if (otherStartMin !== null) {
          const otherDuration = parseInt(otherRound.duration || 45, 10);
          const otherEndMin = otherStartMin + otherDuration;
          if (targetMinutes < otherEndMin && targetEndMinutes > otherStartMin) {
            const otherTitle = otherRound.title || `Round ${i + 1}`;
            return {
              hasConflict: true,
              conflict: {
                source: 'current_session',
                roundIndex: i,
                roundTitle: otherTitle,
                scheduledDate: otherRound.scheduledDate,
                scheduledTime: otherRound.scheduledTime,
                duration: otherDuration,
                reason: `Already selected for "${otherTitle}" at ${otherRound.scheduledTime} (${otherDuration}m)`,
              },
            };
          }
        }
      }
    }
  }

  // 2. Check against already booked rounds in database for this candidate
  if (Array.isArray(candidateBookedRounds)) {
    const curRound = allRounds[currentRoundIndex];
    const curRoundId = curRound?.persistedRoundId || curRound?.id;
    const curTitle = (curRound?.title || curRound?.round_name || '').toLowerCase().trim();

    for (const bSlot of candidateBookedRounds) {
      if (curRoundId && (String(bSlot.round_id || bSlot.id) === String(curRoundId) || String(bSlot.round_id || bSlot.id) === String(curRound?.persistedRoundId))) continue;
      if (curTitle && bSlot.round_name && bSlot.round_name.toLowerCase().trim() === curTitle) continue;
      if (bSlot.scheduled_date === targetDate && bSlot.scheduled_time) {
        const bStartMin = parseSlotToMinutes(bSlot.scheduled_time);
        if (bStartMin !== null) {
          const bDuration = parseInt(bSlot.duration_minutes || 45, 10);
          const bEndMin = bStartMin + bDuration;
          if (targetMinutes < bEndMin && targetEndMinutes > bStartMin) {
            const bTitle = bSlot.round_name || 'Interview Round';
            return {
              hasConflict: true,
              conflict: {
                source: 'database',
                roundTitle: bTitle,
                scheduledDate: bSlot.scheduled_date,
                scheduledTime: bSlot.scheduled_time,
                duration: bDuration,
                reason: `Candidate already booked for "${bTitle}" at ${bSlot.scheduled_time} (${bDuration}m)`,
              },
            };
          }
        }
      }
    }
  }

  return { hasConflict: false, conflict: null };
}

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
function MiniScoreRing({ score }) {
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
      <span className="absolute font-black text-gray-900 text-[11px] tracking-tight">{score ?? '—'}</span>
    </div>
  );
}

export default function ScheduleInterviewModal({
  candidate,
  requisitionId,
  requisitionTitle = '',
  requisitionCode = '',
  initialSelectedRound = '',
  existingRounds = null,
  onClose,
  onScheduled,
}) {
  const { token, user } = useAuth();
  const [error, setError] = useState('');
  const [dispatchResults, setDispatchResults] = useState({});
  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(false);
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(2); // 1 = Set Process (completed with checkmark), 2 = Schedule Interviews, 3 = Review & Confirm
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduledSuccess, setScheduledSuccess] = useState(false);

  // Calendar month state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => todayForDeadline());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [customTimeError, setCustomTimeError] = useState('');

  // Interviewers list & search state
  const [interviewersList, setInterviewersList] = useState([]);
  const [candidateBookedRounds, setCandidateBookedRounds] = useState([]);
  const [interviewerSearch, setInterviewerSearch] = useState('');
  const [showInterviewerDropdown, setShowInterviewerDropdown] = useState(false);

  // Add new interviewer modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newInterviewer, setNewInterviewer] = useState({ name: '', role: '', email: '' });
  const [isSavingInterviewer, setIsSavingInterviewer] = useState(false);
  const [interviewerError, setInterviewerError] = useState('');

  useEffect(() => {
    let mounted = true;
    const candSubId = candidate?.submission_id || candidate?.id || '';
    const candEmail = candidate?.email || '';
    const candName = candidate?.name || '';

    Promise.all([
      request('/api/interviews/interviewers', { token, noCache: true }),
      request(`/api/interviews/process/template?requisition_id=${encodeURIComponent(requisitionId)}`, { token, noCache: true }),
      request(`/api/interviews/candidate/booked-slots?candidate_submission_id=${encodeURIComponent(candSubId)}&candidate_email=${encodeURIComponent(candEmail)}&candidate_name=${encodeURIComponent(candName)}`, { token, noCache: true }).catch(() => ({ booked_slots: [] })),
      existingRounds
        ? Promise.resolve(existingRounds)
        : request(`/api/interviews/rounds?requisition_id=${encodeURIComponent(requisitionId)}&candidate_id=${encodeURIComponent(candSubId)}`, { token, noCache: true }).catch(() => []),
    ]).then(([people, process, candSlots, candidateRounds]) => {
      if (!mounted) return;
      const allInterviewers = people.interviewers || [];
      setInterviewersList(allInterviewers);
      setCandidateBookedRounds(candSlots?.booked_slots || []);

      const knownRounds = Array.isArray(candidateRounds) ? candidateRounds : [];
      const candPersisted = knownRounds.filter(r =>
        !candSubId || String(r.candidate_submission_id) === String(candSubId) ||
        (candEmail && r.candidate_email && r.candidate_email.toLowerCase() === candEmail.toLowerCase())
      );

      const rawConfigured = process.rounds?.length ? process.rounds : DEFAULT_ROUNDS;
      // Filter out AI rounds from company LiveKit scheduling modal
      const configured = rawConfigured.filter(r => r.type !== 'AI' && !String(r.title || '').toLowerCase().includes('ai'));
      const initialDate = todayForDeadline();

      const mergedRounds = configured.map((r, index) => {
        // Look for existing scheduled round matching this template round
        const stored = candPersisted.find(er =>
          (er.round_name && er.round_name.toLowerCase().trim() === (r.title || '').toLowerCase().trim()) ||
          (er.round_type && er.round_type.toLowerCase().trim() === (r.type || '').toLowerCase().trim())
        );

        if (stored) {
          let assignedInterviewer = null;
          if (stored.interviewer_email || stored.interviewer_name) {
            assignedInterviewer = allInterviewers.find(i =>
              (i.email && stored.interviewer_email && i.email.toLowerCase().trim() === stored.interviewer_email.toLowerCase().trim()) ||
              (!stored.interviewer_email && i.name && stored.interviewer_name && i.name.toLowerCase().trim() === stored.interviewer_name.toLowerCase().trim())
            ) || {
              name: stored.interviewer_name,
              email: stored.interviewer_email,
              role: stored.interviewer_role || 'Interviewer',
              avatar: stored.interviewer_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(stored.interviewer_name || 'Interviewer')}&background=0f172a&color=fff`,
            };
          }

          const formattedTime = stored.scheduled_time ? (format24to12(stored.scheduled_time) || stored.scheduled_time) : '';

          return {
            ...r,
            persistedRoundId: stored.id,
            id: stored.id || r.id,
            title: stored.round_name || r.title,
            type: stored.round_type || r.type,
            duration: stored.duration_minutes || r.duration || 45,
            scheduledDate: stored.scheduled_date || initialDate,
            scheduledTime: formattedTime,
            interviewer: assignedInterviewer,
            candidateName: candidate?.name || candidate?.candidate_name || candidate?.candidateName || '',
            instructions: stored.instructions || '',
            status: stored.status || 'Scheduled',
            isAlreadyScheduled: Boolean(stored.scheduled_date && stored.scheduled_time),
            originalDate: stored.scheduled_date,
            originalTime: stored.scheduled_time,
            originalInterviewerEmail: stored.interviewer_email,
            originalInstructions: stored.instructions || '',
          };
        }

        return {
          ...r,
          id: r.id || `round-${index + 1}`,
          duration: r.duration || 45,
          scheduledDate: r.scheduledDate || initialDate,
          scheduledTime: r.scheduledTime ? (format24to12(r.scheduledTime) || r.scheduledTime) : '',
          interviewer: r.interviewer || null,
          candidateName: candidate?.name || candidate?.candidate_name || candidate?.candidateName || '',
          instructions: '',
          status: 'Not Scheduled',
          isAlreadyScheduled: false,
          originalDate: '',
          originalTime: '',
          originalInterviewerEmail: '',
          originalInstructions: '',
        };
      });

      // Also append any non-AI persisted rounds that weren't in the template
      candPersisted.forEach((stored) => {
        const isAi = stored.round_type === 'AI' || String(stored.round_name || '').toLowerCase().includes('ai');
        if (isAi) return;
        const alreadyIn = mergedRounds.some(mr => mr.persistedRoundId === stored.id || (mr.title && mr.title.toLowerCase().trim() === (stored.round_name || '').toLowerCase().trim()));
        if (!alreadyIn) {
          let assignedInterviewer = null;
          if (stored.interviewer_email || stored.interviewer_name) {
            assignedInterviewer = allInterviewers.find(i =>
              (i.email && stored.interviewer_email && i.email.toLowerCase().trim() === stored.interviewer_email.toLowerCase().trim()) ||
              (!stored.interviewer_email && i.name && stored.interviewer_name && i.name.toLowerCase().trim() === stored.interviewer_name.toLowerCase().trim())
            ) || {
              name: stored.interviewer_name,
              email: stored.interviewer_email,
              role: stored.interviewer_role || 'Interviewer',
              avatar: stored.interviewer_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(stored.interviewer_name || 'Interviewer')}&background=0f172a&color=fff`,
            };
          }
          mergedRounds.push({
            id: stored.id,
            persistedRoundId: stored.id,
            title: stored.round_name || `Round ${mergedRounds.length + 1}`,
            type: stored.round_type || 'Technical',
            duration: stored.duration_minutes || 45,
            scheduledDate: stored.scheduled_date || initialDate,
            scheduledTime: stored.scheduled_time ? (format24to12(stored.scheduled_time) || stored.scheduled_time) : '',
            interviewer: assignedInterviewer,
            candidateName: candidate?.name || candidate?.candidate_name || candidate?.candidateName || '',
            instructions: stored.instructions || '',
            status: stored.status || 'Scheduled',
            isAlreadyScheduled: Boolean(stored.scheduled_date && stored.scheduled_time),
            originalDate: stored.scheduled_date,
            originalTime: stored.scheduled_time,
            originalInterviewerEmail: stored.interviewer_email,
            originalInstructions: stored.instructions || '',
          });
        }
      });

      setRounds(mergedRounds);

      // Determine initial selected round
      let targetIdx = 0;
      if (initialSelectedRound) {
        const cleanTarget = String(initialSelectedRound).toLowerCase().trim();
        const foundIdx = mergedRounds.findIndex(r =>
          (r.title && r.title.toLowerCase().trim() === cleanTarget) ||
          (r.type && r.type.toLowerCase().trim() === cleanTarget) ||
          (r.id && String(r.id).toLowerCase() === cleanTarget) ||
          (cleanTarget.includes('technical') && (r.title.toLowerCase().includes('technical') || r.type?.toLowerCase().includes('technical'))) ||
          (cleanTarget.includes('hr') && (r.title.toLowerCase().includes('hr') || r.type?.toLowerCase().includes('hr')))
        );
        if (foundIdx !== -1) {
          targetIdx = foundIdx;
        }
      } else {
        const unscheduledIdx = mergedRounds.findIndex(r => !r.scheduledTime);
        if (unscheduledIdx !== -1) {
          targetIdx = unscheduledIdx;
        }
      }

      setSelectedRoundIndex(targetIdx);
      const active = mergedRounds[targetIdx] || mergedRounds[0];
      if (active) {
        const aDate = active.scheduledDate || initialDate;
        setSelectedDate(aDate);
        setSelectedTimeSlot(active.scheduledTime || '');
        setCustomTimeInput(format12to24(active.scheduledTime));
      }
    }).catch(err => { if (mounted) setError(err.message || 'Unable to load scheduling data.'); });
    return () => { mounted = false; };
  }, [token, requisitionId, candidate, initialSelectedRound, existingRounds]);

  const activeRound = rounds[selectedRoundIndex] || rounds[0];

  // Calendar helper for the selected month
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
        hasSlots: false,
      });
    }

    return days;
  }, [currentMonth]);

  // Handle slot click
  const handleSelectSlot = (slot) => {
    const effectiveDate = selectedDate || todayForDeadline();
    if (isTimeInPast(slot, effectiveDate)) return;

    // Check candidate slot conflict with other rounds
    const candConflict = getCandidateSlotConflict(
      effectiveDate,
      slot,
      activeRound.duration || 45,
      selectedRoundIndex,
      rounds,
      candidateBookedRounds
    );
    if (candConflict.hasConflict) {
      setError(`Cannot select ${slot}: ${candConflict.conflict.reason}. Each round must have a separate, non-conflicting time slot.`);
      return;
    }

    if (!selectedDate) {
      setSelectedDate(effectiveDate);
    }
    setError('');
    setAvailability(null);
    setSelectedTimeSlot(slot);
    setCustomTimeError('');
    setRounds((prev) =>
      prev.map((r, idx) =>
        idx === selectedRoundIndex
          ? { ...r, scheduledDate: effectiveDate, scheduledTime: slot }
          : r
      )
    );
  };

  // Handle custom time apply
  const handleApplyCustomTime = (e) => {
    e?.preventDefault();
    if (!customTimeInput) return;
    const effectiveDate = selectedDate || todayForDeadline();
    if (isTimeInPast(customTimeInput, effectiveDate)) {
      setCustomTimeError('Cannot choose a past time for today.');
      return;
    }
    const candConflict = getCandidateSlotConflict(
      effectiveDate,
      customTimeInput,
      activeRound.duration || 45,
      selectedRoundIndex,
      rounds,
      candidateBookedRounds
    );
    if (candConflict.hasConflict) {
      setCustomTimeError(candConflict.conflict.reason);
      return;
    }
    const formatted = format24to12(customTimeInput);
    setCustomTimeError('');
    handleSelectSlot(formatted);
  };

  // Handle day click
  const handleSelectDay = (dayObj) => {
    if (!dayObj.isCurrentMonth || dayObj.dateStr < todayForDeadline()) return;
    setAvailability(null);
    setSelectedDate(dayObj.dateStr);

    // If current selected slot is in the past on this new day or conflicts with another round, clear it
    const isCurrentSlotPast = selectedTimeSlot && isTimeInPast(selectedTimeSlot, dayObj.dateStr);
    const hasSlotConflict = selectedTimeSlot && getCandidateSlotConflict(
      dayObj.dateStr,
      selectedTimeSlot,
      activeRound.duration || 45,
      selectedRoundIndex,
      rounds,
      candidateBookedRounds
    ).hasConflict;

    const newSlot = (isCurrentSlotPast || hasSlotConflict) ? '' : selectedTimeSlot;
    if (isCurrentSlotPast || hasSlotConflict) {
      setSelectedTimeSlot('');
    }

    if (customTimeInput) {
      if (isTimeInPast(customTimeInput, dayObj.dateStr)) {
        setCustomTimeError('Selected time has already passed for today.');
      } else {
        const cConflict = getCandidateSlotConflict(
          dayObj.dateStr,
          customTimeInput,
          activeRound.duration || 45,
          selectedRoundIndex,
          rounds,
          candidateBookedRounds
        );
        if (cConflict.hasConflict) {
          setCustomTimeError(cConflict.conflict.reason);
        } else {
          setCustomTimeError('');
        }
      }
    }

    setRounds((prev) =>
      prev.map((r, idx) =>
        idx === selectedRoundIndex
          ? { ...r, scheduledDate: dayObj.dateStr, scheduledTime: newSlot }
          : r
      )
    );
  };

  // Handle interviewer change
  const handleAssignInterviewer = (interviewer) => {
    const curDate = selectedDate || activeRound.scheduledDate || todayForDeadline();
    const curTime = selectedTimeSlot || activeRound.scheduledTime;
    if (interviewer && curDate && curTime) {
      const avail = getInterviewerAvailability(
        interviewer,
        curDate,
        curTime,
        activeRound.duration || 45,
        selectedRoundIndex,
        rounds,
        candidate
      );
      if (!avail.isAvailable) {
        setError(`Cannot assign ${interviewer.name}: ${avail.conflict?.reason || 'Interviewer is already booked during this time slot.'}`);
        return;
      }
    }
    setError('');
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
    const trimmedName = (newInterviewer.name || '').trim();
    const trimmedRole = (newInterviewer.role || '').trim();
    const trimmedEmail = (newInterviewer.email || '').trim();

    // 1. Name validation
    if (!trimmedName || trimmedName.length < 2) {
      setInterviewerError('Please enter a valid full name (minimum 2 characters).');
      return;
    }
    if (trimmedName.length > 80) {
      setInterviewerError('Full name must be 80 characters or less.');
      return;
    }
    if (!/^[a-zA-Z\s.'-]+$/.test(trimmedName) || !/[a-zA-Z]/.test(trimmedName)) {
      setInterviewerError('Full name should only contain letters, spaces, hyphens, and apostrophes.');
      return;
    }
    const lowerName = trimmedName.toLowerCase();
    const dummyWords = ['test', 'testing', 'fake', 'dummy', 'asdf', 'admin', 'user', 'interviewer', 'none', 'null', 'na', 'qwerty', 'abc', 'xyz', 'xxx'];
    if (dummyWords.includes(lowerName) || lowerName.split(/\s+/).every((w) => dummyWords.includes(w))) {
      setInterviewerError('Please enter a valid real name instead of a placeholder.');
      return;
    }

    // 2. Role validation
    if (!trimmedRole || trimmedRole.length < 2) {
      setInterviewerError('Please enter a valid role / designation (e.g., Lead Architect).');
      return;
    }
    if (trimmedRole.length > 80) {
      setInterviewerError('Role / designation must be 80 characters or less.');
      return;
    }
    if (!/[a-zA-Z]/.test(trimmedRole)) {
      setInterviewerError('Role / designation must contain letters.');
      return;
    }
    const lowerRole = trimmedRole.toLowerCase();
    if (dummyWords.includes(lowerRole)) {
      setInterviewerError('Please enter a valid role or designation instead of a placeholder.');
      return;
    }

    // 3. Email validation
    if (!trimmedEmail) {
      setInterviewerError('Please enter an email address.');
      return;
    }
    const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail) || trimmedEmail.includes('..')) {
      setInterviewerError('Please enter a valid email address format.');
      return;
    }
    const parts = trimmedEmail.toLowerCase().split('@');
    const localPart = parts[0];
    const domainPart = parts[1];
    if (!domainPart || !domainPart.includes('.')) {
      setInterviewerError('Please enter an email address with a valid domain.');
      return;
    }
    const blockedDomains = [
      'test.com', 'testing.com', 'fake.com', 'example.com', 'example.org', 'example.net',
      'sample.com', 'invalid.com', 'nowhere.com', 'dummy.com', 'noemail.com', 'temp.com',
      'asdf.com', 'abc.com', 'xyz.com', 'fakeemail.com', 'nomail.com', 'null.com',
      'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'yopmail.com', 'trashmail.com',
      'sharklasers.com', 'dispostable.com', '10minutemail.com', 'throwawaymail.com',
    ];
    if (blockedDomains.includes(domainPart) || blockedDomains.some((bd) => domainPart.endsWith(`.${bd}`))) {
      setInterviewerError(`Email addresses from "${domainPart}" are not allowed. Please use a valid business or personal email.`);
      return;
    }
    if (dummyWords.includes(localPart) || localPart.length < 2) {
      setInterviewerError('Please enter a valid, non-placeholder email address.');
      return;
    }

    // 4. Duplicate check against current interviewer suggestions (Task 4)
    const isDuplicate = interviewersList.some(
      (i) => i.email && i.email.trim().toLowerCase() === trimmedEmail.toLowerCase()
    );
    if (isDuplicate) {
      setInterviewerError('An interviewer with this email address is already registered.');
      return;
    }

    setIsSavingInterviewer(true);
    setInterviewerError('');

    try {
      const res = await request('/api/interviews/interviewers', {
        method: 'POST',
        token,
        body: {
          name: trimmedName,
          role: trimmedRole,
          email: trimmedEmail,
        },
      });
      setInterviewersList(res.interviewers || []);
      handleAssignInterviewer(res.interviewer);
      setNewInterviewer({ name: '', role: '', email: '' });
      setShowAddModal(false);
    } catch (err) {
      setInterviewerError(err.message || 'Unable to save interviewer.');
    } finally {
      setIsSavingInterviewer(false);
    }
  };

  // Proceed directly to Review & Confirm (Step 3)
  const handleSaveAndNext = () => {
    setError('');
    const finalDate = selectedDate || todayForDeadline();
    const finalSlot = selectedTimeSlot || activeRound.scheduledTime;

    const isActiveRoundEnded = isRoundEnded({
      ...activeRound,
      scheduledDate: finalDate,
      scheduledTime: finalSlot,
    });

    if (!isActiveRoundEnded && finalSlot && isTimeInPast(finalSlot, finalDate)) {
      setError(`The selected time (${finalSlot}) is in the past for ${finalDate}. Please select a future time.`);
      return;
    }

    // Check candidate slot conflict for active round
    if (finalDate && finalSlot) {
      const candConflict = getCandidateSlotConflict(
        finalDate,
        finalSlot,
        activeRound.duration || 45,
        selectedRoundIndex,
        rounds,
        candidateBookedRounds
      );
      if (candConflict.hasConflict) {
        setError(`Candidate scheduling conflict: ${candConflict.conflict.reason}. Each round must have a separate, non-conflicting time slot.`);
        return;
      }
    }

    if (activeRound.interviewer && finalDate && finalSlot) {
      const avail = getInterviewerAvailability(
        activeRound.interviewer,
        finalDate,
        finalSlot,
        activeRound.duration || 45,
        selectedRoundIndex,
        rounds,
        candidate
      );
      if (!avail.isAvailable) {
        setError(`Scheduling conflict: Interviewer ${activeRound.interviewer.name} is ${avail.conflict?.reason?.toLowerCase() || 'already booked at this time'}. Please select an available interviewer or another time slot before proceeding.`);
        return;
      }
    }

    // Sync current active round selections before proceeding
    const updatedRounds = rounds.map((r, idx) =>
      idx === selectedRoundIndex
        ? {
            ...r,
            scheduledDate: finalDate,
            scheduledTime: finalSlot,
          }
        : r
    );

    // Cross-validate all scheduled rounds for any candidate overlaps
    for (let i = 0; i < updatedRounds.length; i++) {
      for (let j = i + 1; j < updatedRounds.length; j++) {
        const r1 = updatedRounds[i];
        const r2 = updatedRounds[j];
        if (r1.scheduledDate && r1.scheduledTime && r2.scheduledDate && r2.scheduledTime && r1.scheduledDate === r2.scheduledDate) {
          const s1 = parseSlotToMinutes(r1.scheduledTime);
          const s2 = parseSlotToMinutes(r2.scheduledTime);
          if (s1 !== null && s2 !== null) {
            const e1 = s1 + (r1.duration || 45);
            const e2 = s2 + (r2.duration || 45);
            if (s1 < e2 && e1 > s2) {
              setError(`Scheduling conflict: "${r1.title}" and "${r2.title}" are scheduled at overlapping times (${r1.scheduledTime} and ${r2.scheduledTime}) on ${r1.scheduledDate}. Each round must have a separate, non-conflicting time slot.`);
              return;
            }
          }
        }
      }
    }

    setRounds(updatedRounds);
    // When press Save & Next it goes to Review & Confirm (where all details are shown non-editable)
    setCurrentStep(3);
  };

  const checkAvailability = async () => {
    setChecking(true); setError(''); setAvailability(null);
    try {
      const result = await request('/api/calendar/google/availability', { method: 'POST', token, body: {
        scheduled_date: selectedDate, scheduled_time: toInterviewTime(selectedTimeSlot), scheduled_timezone: 'Asia/Kolkata', duration_minutes: activeRound.duration || 45,
      }});
      setAvailability(result);
    } catch (err) { setError(err.message || 'Unable to check Google Calendar.'); }
    finally { setChecking(false); }
  };

  const handleConfirmAndSchedule = async () => {
    setIsSubmitting(true); setError('');
    try {
      const scheduledRounds = rounds.filter(r => r.scheduledDate && r.scheduledTime);
      if (scheduledRounds.length === 0) {
        throw new Error('Please choose a date and time for at least one interview round before confirming.');
      }
      
      for (const r of scheduledRounds) {
        if (isRoundEnded(r)) continue;
        if (isTimeInPast(r.scheduledTime, r.scheduledDate)) {
          throw new Error(`Round "${r.title}" has a past time (${r.scheduledTime} on ${r.scheduledDate}). Please select a future time.`);
        }
      }

      // Validate candidate has no overlapping rounds across all scheduled rounds
      for (let i = 0; i < scheduledRounds.length; i++) {
        for (let j = i + 1; j < scheduledRounds.length; j++) {
          const r1 = scheduledRounds[i];
          const r2 = scheduledRounds[j];
          if (r1.scheduledDate === r2.scheduledDate) {
            const s1 = parseSlotToMinutes(r1.scheduledTime);
            const s2 = parseSlotToMinutes(r2.scheduledTime);
            if (s1 !== null && s2 !== null) {
              const e1 = s1 + (r1.duration || 45);
              const e2 = s2 + (r2.duration || 45);
              if (s1 < e2 && e1 > s2) {
                throw new Error(`Candidate scheduling conflict: "${r1.title}" and "${r2.title}" are scheduled at overlapping times (${r1.scheduledTime} and ${r2.scheduledTime}) on ${r1.scheduledDate}. Each round must have a separate, non-conflicting time slot.`);
              }
            }
          }
        }
      }

      // Also validate candidate against any database bookings
      for (let idx = 0; idx < scheduledRounds.length; idx++) {
        const r = scheduledRounds[idx];
        if (isRoundEnded(r)) continue;
        const dbConflict = getCandidateSlotConflict(
          r.scheduledDate,
          r.scheduledTime,
          r.duration || 45,
          idx,
          scheduledRounds,
          candidateBookedRounds
        );
        if (dbConflict.hasConflict && dbConflict.conflict.source === 'database') {
          throw new Error(`Candidate scheduling conflict in "${r.title}": ${dbConflict.conflict.reason}.`);
        }
      }

      // Validate all interviewers against conflicts across all candidates, requisitions, and rounds
      for (let idx = 0; idx < scheduledRounds.length; idx++) {
        const r = scheduledRounds[idx];
        if (isRoundEnded(r)) continue;
        if (r.interviewer) {
          const avail = getInterviewerAvailability(
            r.interviewer,
            r.scheduledDate,
            r.scheduledTime,
            r.duration || 45,
            idx,
            scheduledRounds,
            candidate
          );
          if (!avail.isAvailable && !r.isAlreadyScheduled) {
            throw new Error(`Schedule conflict in "${r.title}": ${r.interviewer.name} is ${avail.conflict?.reason?.toLowerCase() || 'already booked at this time'}. Please edit the schedule.`);
          }
        }
      }

      for (const r of scheduledRounds) {
        const dateChanged = Boolean(r.originalDate && r.scheduledDate !== r.originalDate);
        const timeChanged = Boolean(r.originalTime && format12to24(r.scheduledTime) !== format12to24(r.originalTime));
        const interviewerChanged = (r.interviewer?.email || '').toLowerCase().trim() !== (r.originalInterviewerEmail || '').toLowerCase().trim();
        const instructionsChanged = (r.instructions || '').trim() !== (r.originalInstructions || '').trim();

        // 1. If this round has already ended and was not rescheduled to a new date/time, NEVER re-dispatch it
        if (isRoundEnded(r) && !dateChanged && !timeChanged) {
          continue;
        }

        // 2. If it was already scheduled and completely unchanged, skip sending duplicate API calls and emails
        if (r.isAlreadyScheduled && !dateChanged && !timeChanged && !interviewerChanged && !instructionsChanged) {
          continue;
        }

        const existingRoundId = r.persistedRoundId || (r.id && !String(r.id).startsWith('round-') && !String(r.id).startsWith('planned-') ? r.id : (dispatchResults[r.id]?.id || null));
        // Only send round_id if the round was already previously scheduled (rescheduling).
        // For fresh new bookings, pass null so the backend creates a fresh booking without triggering reschedule checks.
        const roundId = (r.isAlreadyScheduled || dispatchResults[r.id]?.id) ? existingRoundId : null;

        const saved = await request('/api/interviews/company-round', { method: 'POST', token, timeout: 90000, body: {
          candidate_identifier: candidate.submission_id || candidate.id,
          requisition_id: requisitionId,
          round_id: roundId,
          round_name: r.title,
          round_type: r.type,
          scheduled_date: r.scheduledDate,
          scheduled_time: toInterviewTime(r.scheduledTime),
          scheduled_timezone: 'Asia/Kolkata',
          duration_minutes: r.duration || 45,
          interviewer_name: r.interviewer?.name || user?.name,
          interviewer_email: r.interviewer?.email || user?.email,
          interviewer_role: r.interviewer?.role || 'Interviewer',
          instructions: r.instructions || '',
        }});
        setDispatchResults(prev => ({ ...prev, [r.id]: saved }));
        onScheduled?.(saved);
      }
      setScheduledSuccess(true);
    } catch (err) { setError(err.message || 'Unable to schedule interviews.'); }
    finally { setIsSubmitting(false); }
  };

  // Filtered interviewers from DB
  const filteredInterviewers = interviewersList.filter(
    (i) =>
      !interviewerSearch ||
      (i.name || '').toLowerCase().includes(interviewerSearch.toLowerCase()) ||
      (i.role || '').toLowerCase().includes(interviewerSearch.toLowerCase()) ||
      (i.email || '').toLowerCase().includes(interviewerSearch.toLowerCase())
  );

  const { todayStr, minTime24, currentTimeDisplay } = getNowInKolkata();
  const effectiveDate = selectedDate || todayStr;
  const isTodaySelected = effectiveDate === todayStr;
  const isCustomSelected = Boolean(
    selectedTimeSlot && !TIME_SLOTS.includes(selectedTimeSlot)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-5xl bg-white border border-black/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── TOP HEADER ── */}
        <div className="relative z-20 px-5 py-3.5 sm:px-6 sm:py-4 flex items-center justify-between border-b border-black/[0.06] bg-white gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200/80 flex items-center justify-center text-gray-800 shadow-3xs shrink-0">
              <Calendar size={17} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight leading-tight truncate">
                {currentStep === 3 ? 'Review & Confirm Interviews' : 'Schedule Interviews'}
              </h2>
              <p className="text-xs text-gray-500 font-normal mt-0.5 truncate">
                {currentStep === 3
                  ? 'Verify candidate details and assigned interview rounds before finalizing.'
                  : 'Assign date, time and interviewers for each round.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <GoogleCalendarConnect />
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-black flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {(error || Object.values(dispatchResults).length > 0) && (
          <div className="px-5 py-2 border-b border-black/[0.06] bg-white">
            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            {Object.values(dispatchResults).map(r => (
              <p key={r.id} className="mt-1 text-xs text-gray-600">
                {r.round_name}: saved · Candidate Email: {r.email_delivery?.status || 'Not sent'} · Interviewer Email: {r.interviewer_email_delivery?.status || 'Not sent'} · Telegram: {r.telegram_delivery?.status || 'Not sent'} · Google Calendar: {r.calendar_sync?.status || 'Not synced'}
              </p>
            ))}
          </div>
        )}
        {/* ── STEPPER BAR (Reflects Active & Completed Steps) ── */}
        <div className="px-5 py-2.5 border-b border-black/[0.06] bg-gray-50/60 flex items-center justify-center gap-3 sm:gap-6 flex-wrap shrink-0">
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
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 sm:p-5 pb-3 sm:pb-4 space-y-3.5">
          {currentStep === 2 ? (
            /* ════════ STEP 2: SCHEDULE INTERVIEWS CONFIGURATION ════════ */
            <>
              {/* SPLIT LAYOUT: ROUNDS + INTERVIEWER (LEFT) | CALENDAR & TIME SLOTS (RIGHT) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
                {/* LEFT COLUMN: Interview Rounds List + Select Interviewer */}
                <div className="lg:col-span-5 space-y-3.5">
                  {/* 1. Interview Rounds List */}
                  <div className="space-y-2">
                    <h4 className="text-xs sm:text-sm font-bold text-gray-900 tracking-tight">
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
                              const roundDate = round.scheduledDate || todayForDeadline();
                              setSelectedDate(roundDate);
                              setSelectedTimeSlot(round.scheduledTime || '');
                              if (round.scheduledTime) {
                                setCustomTimeInput(format12to24(round.scheduledTime));
                              } else {
                                setCustomTimeInput('');
                              }
                              setCustomTimeError('');
                            }}
                            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                              isSelected
                                ? 'bg-gray-50/80 border-black/40 shadow-3xs ring-1 ring-black/10'
                                : 'bg-white hover:bg-gray-50/60 border-gray-200/90'
                            }`}
                          >
                            {/* Round Index / Category Icon Box */}
                            {isSelected ? (
                              <div className="w-6 h-6 rounded-lg bg-black text-white text-[11px] font-bold flex items-center justify-center shrink-0 shadow-xs">
                                {idx + 1}
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-lg bg-gray-50 border border-gray-200/80 text-gray-700 flex items-center justify-center shrink-0">
                                {getCategoryIcon(round.type)}
                              </div>
                            )}

                            {/* Title & Scheduling Status */}
                            {(() => {
                              const candConflict = getCandidateSlotConflict(
                                round.scheduledDate,
                                round.scheduledTime,
                                round.duration || 45,
                                idx,
                                rounds,
                                candidateBookedRounds
                              );
                              const hasOverlap = candConflict.hasConflict;
                              const isEnded = isRoundEnded(round);
                              return (
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs sm:text-[13px] font-bold text-gray-900 tracking-tight truncate">
                                      {round.title}
                                    </span>
                                    {isEnded ? (
                                      <span className="px-1.5 py-0.2 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[9.5px] font-bold shrink-0 flex items-center gap-0.5">
                                        <CheckCheck size={9} className="text-slate-600" />
                                        Interview Ended
                                      </span>
                                    ) : hasOverlap ? (
                                      <span className="px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-700 text-[9.5px] font-bold shrink-0">
                                        Time Conflict
                                      </span>
                                    ) : null}
                                  </div>
                                  <div
                                    className={`text-[10px] font-medium truncate ${
                                      hasOverlap
                                        ? 'text-rose-600 font-semibold'
                                        : isEnded
                                        ? 'text-slate-500 font-medium'
                                        : isScheduled
                                        ? 'text-emerald-700 font-semibold'
                                        : 'text-gray-400'
                                    }`}
                                  >
                                    {hasOverlap
                                      ? candConflict.conflict?.reason || 'Schedule overlaps with another round'
                                      : isEnded
                                      ? `${round.scheduledDate ? new Date(`${round.scheduledDate}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Scheduled'}, ${round.scheduledTime} (Ended)`
                                      : isScheduled
                                      ? `${round.scheduledDate ? new Date(`${round.scheduledDate}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Scheduled'}, ${round.scheduledTime}`
                                      : 'Not Scheduled'}
                                  </div>
                                  {round.interviewer?.name && (
                                    <div className="text-[9.5px] text-gray-500 font-medium truncate mt-0.5 flex items-center gap-1">
                                      <User size={10} className="text-gray-400 shrink-0" />
                                      <span className="truncate">{round.interviewer.name}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. SELECT INTERVIEWER SECTION (Left Column, Under Rounds) */}
                  <div className="space-y-2 pt-3 border-t border-black/[0.06]">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-xs sm:text-sm font-bold text-gray-900 tracking-tight">
                        Select Interviewer(s)
                      </h5>

                      <button
                        type="button"
                        onClick={() => {
                          setInterviewerError('');
                          setShowAddModal(true);
                        }}
                        className="px-2.5 py-1 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold flex items-center gap-1 shadow-3xs transition-all cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>Add New</span>
                      </button>
                    </div>

                    {/* Search Bar / Dropdown to pick interviewer from DB */}
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={interviewerSearch}
                        onChange={(e) => {
                          setInterviewerSearch(e.target.value);
                          setShowInterviewerDropdown(true);
                        }}
                        onFocus={() => setShowInterviewerDropdown(true)}
                        placeholder="Search interviewer by name or email..."
                        className="w-full pl-8 pr-3 py-2 bg-gray-50/60 hover:bg-gray-50 border border-gray-200/90 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs"
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
                            filteredInterviewers.map((interviewer) => {
                              const currentSlotTime = selectedTimeSlot || activeRound.scheduledTime;
                              const currentSlotDate = selectedDate || activeRound.scheduledDate;
                              const avail = getInterviewerAvailability(
                                interviewer,
                                currentSlotDate,
                                currentSlotTime,
                                activeRound.duration || 45,
                                selectedRoundIndex,
                                rounds,
                                candidate
                              );
                              const isSelected = activeRound.interviewer?.email === interviewer.email || (!activeRound.interviewer?.email && activeRound.interviewer?.name === interviewer.name);

                              if (!avail.isAvailable) {
                                return (
                                  <div
                                    key={interviewer.id || interviewer.email}
                                    onClick={() => {
                                      setError(`Cannot assign ${interviewer.name}: ${avail.conflict?.reason || 'Already booked during this time slot.'}`);
                                    }}
                                    className="p-2 rounded-xl bg-gray-50/80 border border-gray-200/70 opacity-60 flex items-center justify-between gap-2.5 cursor-not-allowed select-none transition-all group hover:opacity-75"
                                    title={avail.conflict?.reason || 'Interviewer is booked at this time'}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="relative shrink-0">
                                        <img
                                          src={interviewer.avatar}
                                          alt={interviewer.name}
                                          className="w-7 h-7 rounded-full object-cover grayscale"
                                        />
                                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 ring-1 ring-white" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-xs font-bold text-gray-700 truncate">{interviewer.name}</span>
                                          <span className="px-1.5 py-0.2 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[9.5px] font-bold shrink-0">
                                            Unavailable &bull; Booked
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 truncate">
                                          {interviewer.role} &bull; {interviewer.email}
                                        </div>
                                        {avail.conflict?.reason && (
                                          <div className="text-[9.5px] text-rose-600 font-medium truncate mt-0.5">
                                            {avail.conflict.reason}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-[10px] font-semibold text-rose-600 shrink-0 bg-rose-50/80 px-2 py-0.5 rounded-md border border-rose-200/60">
                                      Busy
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={interviewer.id || interviewer.email}
                                  onClick={() => handleAssignInterviewer(interviewer)}
                                  className="p-2 rounded-xl hover:bg-gray-50 flex items-center justify-between gap-2.5 cursor-pointer transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="relative shrink-0">
                                      <img
                                        src={interviewer.avatar}
                                        alt={interviewer.name}
                                        className="w-7 h-7 rounded-full object-cover shrink-0"
                                      />
                                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-bold text-gray-900 truncate">{interviewer.name}</span>
                                        <span className="px-1.5 py-0.2 rounded-md bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[9.5px] font-semibold shrink-0">
                                          Available
                                        </span>
                                      </div>
                                      <div className="text-[10.5px] text-gray-500 truncate">
                                        {interviewer.role} &bull; {interviewer.email}
                                      </div>
                                    </div>
                                  </div>
                                  {isSelected ? (
                                    <Check size={14} className="text-emerald-600 shrink-0" />
                                  ) : (
                                    <span className="text-[10.5px] font-medium text-gray-400 hover:text-black">Select</span>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected Interviewer Card */}
                    {activeRound.interviewer && (() => {
                      const curSlotTime = selectedTimeSlot || activeRound.scheduledTime;
                      const curSlotDate = selectedDate || activeRound.scheduledDate;
                      const activeConflict = getInterviewerAvailability(
                        activeRound.interviewer,
                        curSlotDate,
                        curSlotTime,
                        activeRound.duration || 45,
                        selectedRoundIndex,
                        rounds,
                        candidate
                      );
                      const isConflicted = !activeConflict.isAvailable && !activeRound.isAlreadyScheduled;
                      return (
                        <div className={`border rounded-2xl p-2.5 shadow-3xs transition-all ${
                          isConflicted ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-gray-200/90'
                        }`}>
                          <div className="flex items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="relative shrink-0">
                                <img
                                  src={activeRound.interviewer.avatar}
                                  alt={activeRound.interviewer.name}
                                  className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-black/5"
                                />
                                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-1 ring-white ${
                                  isConflicted ? 'bg-rose-500' : 'bg-emerald-500'
                                }`} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-gray-900 tracking-tight truncate">
                                    {activeRound.interviewer.name}
                                  </span>
                                  {activeRound.isAlreadyScheduled ? (
                                    <span className="px-1.5 py-0.2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9.5px] font-bold flex items-center gap-1">
                                      <Check size={9} className="text-emerald-600" />
                                      Confirmed
                                    </span>
                                  ) : isConflicted ? (
                                    <span className="px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-700 text-[9.5px] font-bold">
                                      Conflict
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded-md bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[9.5px] font-semibold">
                                      Available
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-500 truncate">
                                  {activeRound.interviewer.role}
                                </div>
                                {activeRound.interviewer.email && (
                                  <div className="text-[10px] text-gray-400 truncate">
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
                                className="w-6 h-6 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                                title="Remove interviewer"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </div>

                          {!activeConflict.isAvailable && (
                            <div className="mt-2 pt-2 border-t border-rose-200/70 text-[10.5px] text-rose-700 flex items-start gap-1.5">
                              <AlertCircle size={13} className="shrink-0 text-rose-600 mt-0.5" />
                              <span>
                                <strong>Schedule Conflict:</strong> {activeConflict.conflict?.reason || 'Interviewer is already booked during this time.'} Choose another interviewer or adjust time.
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Message / Instructions for Interviewer */}
                    <div className="space-y-1 pt-1.5 border-t border-gray-100">
                      <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
                        <MessageSquare size={12} className="text-gray-400" />
                        <span>Message / Instructions for Interviewer (Optional)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={activeRound.instructions || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRounds((prev) =>
                            prev.map((r, idx) =>
                              idx === selectedRoundIndex ? { ...r, instructions: val } : r
                            )
                          );
                        }}
                        placeholder="Evaluation focus or message (e.g. Focus on technical assessment, system architecture)..."
                        className="w-full px-2.5 py-1.5 bg-gray-50/60 hover:bg-gray-50 border border-gray-200/90 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Active Round Date & Time Slots (Ultra-compact Calendar & Timesheet) */}
                <div className="lg:col-span-7 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      disabled={checking || !selectedDate || !selectedTimeSlot}
                      onClick={checkAvailability}
                      className="rounded-lg border border-gray-200/90 px-2.5 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      {checking ? 'Checking…' : 'Check Google Calendar'}
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      {availability && (
                        <span className={`text-[10.5px] font-semibold ${availability.available ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {availability.available ? '✓ Slot free' : '✕ Slot busy'}
                        </span>
                      )}
                      <span className="text-gray-400 text-[10.5px]">Asia/Kolkata</span>
                    </div>
                  </div>

                  {/* Header for Active Round */}
                  <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] pb-1.5">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-gray-900 tracking-tight leading-tight">
                          {activeRound.title}
                        </h4>
                        {isRoundEnded(activeRound) && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-slate-700 text-[10px] font-bold flex items-center gap-1">
                            <CheckCheck size={10} className="text-slate-600" />
                            Interview Ended
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 font-normal">
                        {isRoundEnded(activeRound)
                          ? `This round took place on ${activeRound.scheduledDate} at ${activeRound.scheduledTime} and has ended. Select a future time to reschedule.`
                          : 'Select date, time and interviewer for this round.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 shrink-0">
                      <Clock size={12} className="text-gray-400" />
                      <span>Duration: {activeRound.duration || 45} mins</span>
                    </div>
                  </div>

                  {/* Calendar & Time Slots Grid (Compact, balanced layout) */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                    {/* ── COMPACT CALENDAR ── */}
                    <div className="sm:col-span-6 bg-white border border-gray-200/90 rounded-xl p-2.5 shadow-3xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900">{currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
                        <div className="flex items-center gap-0.5 text-gray-500">
                          <button
                            type="button"
                            className="w-5 h-5 rounded hover:bg-gray-100 flex items-center justify-center cursor-pointer transition-colors"
                            onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                            title="Previous Month"
                          >
                            <ChevronLeft size={13} />
                          </button>
                          <button
                            type="button"
                            className="w-5 h-5 rounded hover:bg-gray-100 flex items-center justify-center cursor-pointer transition-colors"
                            onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                            title="Next Month"
                          >
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Day Names Header */}
                      <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-gray-400 py-0">
                        <span>Sun</span>
                        <span>Mon</span>
                        <span>Tue</span>
                        <span>Wed</span>
                        <span>Thu</span>
                        <span>Fri</span>
                        <span>Sat</span>
                      </div>

                      {/* Days Matrix */}
                      <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
                        {calendarDays.map((dObj, i) => {
                          const isChosen = selectedDate === dObj.dateStr && dObj.isCurrentMonth;
                          const isToday = dObj.dateStr === todayForDeadline() && dObj.isCurrentMonth;
                          const isPast = !dObj.isCurrentMonth || dObj.dateStr < todayForDeadline();

                          return (
                            <div
                              key={i}
                              onClick={() => {
                                if (isPast && !isChosen) return;
                                handleSelectDay(dObj);
                              }}
                              className={`h-6 rounded-md flex flex-col items-center justify-center transition-all relative ${
                                isChosen
                                  ? 'bg-black text-white font-bold shadow-3xs cursor-pointer'
                                  : isPast
                                  ? 'text-gray-300 pointer-events-none cursor-not-allowed'
                                  : isToday
                                  ? 'text-gray-900 font-bold border border-black/30 hover:bg-gray-100 cursor-pointer'
                                  : 'text-gray-800 hover:bg-gray-100 font-medium cursor-pointer'
                              }`}
                            >
                              <span className="leading-none text-[11px]">{dObj.day}</span>
                              {dObj.hasSlots && !isChosen && (
                                <span className="w-1 h-1 rounded-full bg-sky-500 mt-0.5" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── COMPACT TIMESHEET & CUSTOM TIME OPTION ── */}
                    <div className="sm:col-span-6 bg-white border border-gray-200/90 rounded-xl p-2.5 shadow-3xs space-y-2">
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <h5 className="text-xs font-bold text-gray-900 whitespace-nowrap">
                            Available Time Slots
                          </h5>
                          <div className="flex items-center gap-1 flex-wrap">
                            {isTodaySelected && (
                              <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/70 px-1.5 py-0.2 rounded-md shrink-0">
                                Past disabled
                              </span>
                            )}
                            {TIME_SLOTS.some((s) => getCandidateSlotConflict(effectiveDate, s, activeRound.duration || 45, selectedRoundIndex, rounds, candidateBookedRounds).hasConflict) && (
                              <span className="text-[9px] font-semibold text-rose-700 bg-rose-50 border border-rose-200/70 px-1.5 py-0.2 rounded-md shrink-0" title="Time slots booked for candidate's other rounds are disabled">
                                Conflict disabled
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] font-normal text-gray-400 block mt-0.5">
                          {selectedDate
                            ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-IN', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Select a date'}
                        </span>
                      </div>

                      {/* Compact Predefined Slots Grid */}
                      <div className="max-h-[125px] overflow-y-auto pr-0.5 space-y-1 no-scrollbar">
                        <div className="grid grid-cols-3 gap-1">
                          {TIME_SLOTS.map((slot) => {
                            const isPast = isTimeInPast(slot, selectedDate || todayForDeadline());
                            const candConflict = getCandidateSlotConflict(
                              selectedDate || todayForDeadline(),
                              slot,
                              activeRound.duration || 45,
                              selectedRoundIndex,
                              rounds,
                              candidateBookedRounds
                            );
                            const isSlotConflicted = candConflict.hasConflict;
                            const isSlotDisabled = isPast || isSlotConflicted;
                            const isSlotChosen = selectedTimeSlot === slot;

                            let tooltipText = `Select ${slot}`;
                            if (isPast) {
                              tooltipText = `This time (${slot}) has already passed for today`;
                            } else if (isSlotConflicted) {
                              tooltipText = `Unavailable: ${candConflict.conflict?.reason}`;
                            }

                            return (
                              <button
                                key={slot}
                                type="button"
                                disabled={isSlotDisabled}
                                onClick={() => handleSelectSlot(slot)}
                                title={tooltipText}
                                className={`relative h-6 py-0 px-1 text-center rounded-md text-[10.5px] font-medium leading-none flex items-center justify-center transition-all border ${
                                  isPast
                                    ? 'bg-gray-50/70 text-gray-300 border-gray-100 line-through cursor-not-allowed select-none'
                                    : isSlotConflicted
                                    ? 'bg-rose-50/70 text-rose-400 border-rose-200/90 line-through cursor-not-allowed select-none'
                                    : isSlotChosen
                                    ? 'bg-black text-white font-bold border-black shadow-3xs cursor-pointer'
                                    : 'bg-white hover:bg-gray-50 text-gray-800 border-gray-200/80 hover:border-gray-300 cursor-pointer'
                                }`}
                              >
                                <span className="truncate">{slot}</span>
                                {isSlotConflicted && !isPast && (
                                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500 ring-1 ring-white" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* ── CUSTOM TIME OPTION ── */}
                      <div className="pt-1.5 border-t border-gray-100 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] font-bold text-gray-700 flex items-center gap-1">
                            <Clock size={11} className="text-gray-400" />
                            <span>Custom Time</span>
                          </span>
                          {isCustomSelected && (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                              <Check size={9} strokeWidth={3} />
                              <span>{selectedTimeSlot}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={customTimeInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomTimeInput(val);
                              if (!val) {
                                setCustomTimeError('');
                                return;
                              }
                              const effectiveDt = selectedDate || todayForDeadline();
                              if (isTimeInPast(val, effectiveDt)) {
                                setCustomTimeError('Past time disabled for today.');
                                return;
                              }
                              const cConflict = getCandidateSlotConflict(
                                effectiveDt,
                                val,
                                activeRound.duration || 45,
                                selectedRoundIndex,
                                rounds,
                                candidateBookedRounds
                              );
                              if (cConflict.hasConflict) {
                                setCustomTimeError(cConflict.conflict.reason);
                              } else {
                                setCustomTimeError('');
                              }
                            }}
                            min={isTodaySelected ? minTime24 : undefined}
                            className={`h-6 flex-1 px-1.5 py-0 bg-gray-50/70 border rounded-md text-[11px] font-medium text-gray-900 focus:outline-hidden focus:ring-1 focus:ring-black transition-all ${
                              customTimeError
                                ? 'border-rose-300 bg-rose-50/30'
                                : isCustomSelected
                                ? 'border-black ring-1 ring-black/10 bg-white'
                                : 'border-gray-200'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={handleApplyCustomTime}
                            disabled={!customTimeInput || Boolean(customTimeError)}
                            className="h-6 px-2.5 rounded-md bg-black hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10.5px] font-bold transition-all shadow-3xs cursor-pointer shrink-0"
                          >
                            Set Time
                          </button>
                        </div>

                        {customTimeError ? (
                          <p className="text-[9.5px] text-rose-600 font-medium flex items-center gap-1">
                            <AlertCircle size={10} className="shrink-0" />
                            <span>{customTimeError}</span>
                          </p>
                        ) : isTodaySelected ? (
                          <p className="text-[9.5px] text-gray-400">
                            Current: {currentTimeDisplay}. Backward time disabled.
                          </p>
                        ) : null}
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
                  className="px-6 py-2.5 rounded-xl bg-black hover:bg-gray-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <span>
                    {selectedRoundIndex < rounds.length - 1 ? 'Save & Next' : 'Save & Next'}
                  </span>
                  <ArrowRight size={15} />
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
                        {candidate?.name || 'Candidate'}
                      </h3>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                        {candidate?.score ?? null}% Match Score
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
                        <MapPin size={12} /> {candidate?.location || 'Not provided'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase size={12} /> {candidate?.experience || 'Not provided'} experience
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isRoundEnded(round) ? (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-slate-700 text-[10px] font-bold flex items-center gap-1">
                                <CheckCheck size={10} className="text-slate-600" />
                                Interview Ended
                              </span>
                            ) : round.isAlreadyScheduled ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                                <Check size={10} className="text-emerald-600" />
                                Already Scheduled
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-bold">
                                New Booking
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10.5px] font-bold">
                              {round.duration || 45} mins
                            </span>
                          </div>
                        </div>

                        <div className="text-sm font-bold text-gray-900 tracking-tight">
                          {round.title}
                        </div>

                        <div className="mt-2.5 p-2 rounded-xl bg-gray-50 border border-gray-200/60 space-y-1">
                          {(() => {
                            const isScheduled = Boolean(round.scheduledDate && round.scheduledTime);
                            const candConflict = isScheduled
                              ? getCandidateSlotConflict(
                                  round.scheduledDate,
                                  round.scheduledTime,
                                  round.duration || 45,
                                  idx,
                                  rounds,
                                  candidateBookedRounds
                                )
                              : { hasConflict: false };
                            const hasCandConflict = candConflict.hasConflict;
                            const isEnded = isRoundEnded(round);
                            return (
                              <>
                                {isScheduled ? (
                                  <div className={`text-[11px] font-bold flex items-center justify-between gap-1 flex-wrap ${
                                    isEnded ? 'text-slate-700' : 'text-emerald-800'
                                  }`}>
                                    <div className="flex items-center gap-1.5">
                                      <Calendar size={12} className={isEnded ? 'text-slate-500' : 'text-emerald-600'} />
                                      <span>
                                        {new Date(`${round.scheduledDate}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </span>
                                      <span>&bull;</span>
                                      <Clock size={12} className={isEnded ? 'text-slate-500' : 'text-emerald-600'} />
                                      <span>{round.scheduledTime}</span>
                                      {isEnded && (
                                        <span className="text-[10px] font-semibold text-slate-500 ml-1">
                                          (Ended)
                                        </span>
                                      )}
                                    </div>
                                    {hasCandConflict && (
                                      <span className="px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-700 text-[9.5px] font-bold">
                                        Conflict
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-[11px] font-medium text-gray-500 flex items-center gap-1.5">
                                    <Clock size={12} className="text-gray-400" />
                                    <span>Not scheduled</span>
                                  </div>
                                )}
                                {hasCandConflict && (
                                  <div className="text-[10px] text-rose-600 font-semibold pt-1 border-t border-rose-200/60 flex items-center gap-1">
                                    <AlertCircle size={11} className="shrink-0 text-rose-600" />
                                    <span>{candConflict.conflict?.reason}</span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Non-editable Assigned Interviewer Card */}
                      <div className="pt-2.5 border-t border-gray-100">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                          Assigned Interviewer
                        </div>
                        {round.interviewer ? (() => {
                          const roundAvail = getInterviewerAvailability(
                            round.interviewer,
                            round.scheduledDate,
                            round.scheduledTime,
                            round.duration || 45,
                            idx,
                            rounds,
                            candidate
                          );
                          const isConflicted = !roundAvail.isAvailable && !round.isAlreadyScheduled;
                          const isEnded = isRoundEnded(round);
                          return (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={round.interviewer.avatar}
                                  alt={round.interviewer.name}
                                  className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-black/10"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-gray-900 truncate">
                                      {round.interviewer.name}
                                    </span>
                                    {isEnded ? (
                                      <span className="px-1.5 py-0.2 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[9.5px] font-bold flex items-center gap-1">
                                        <CheckCheck size={9} className="text-slate-600" />
                                        Completed
                                      </span>
                                    ) : round.isAlreadyScheduled ? (
                                      <span className="px-1.5 py-0.2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9.5px] font-bold flex items-center gap-1">
                                        <Check size={9} className="text-emerald-600" />
                                        Confirmed
                                      </span>
                                    ) : isConflicted ? (
                                      <span className="px-1.5 py-0.2 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[9.5px] font-bold">
                                        Conflict
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9.5px] font-bold">
                                        Available
                                      </span>
                                    )}
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
                              {round.instructions && (
                                <div className="p-2 rounded-xl bg-gray-50 border border-gray-200/60 text-[10.5px] text-gray-600 line-clamp-2">
                                  <span className="font-semibold text-gray-800">Message / Focus:</span> {round.instructions}
                                </div>
                              )}
                              {isConflicted && (
                                <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-medium flex items-center gap-1">
                                  <AlertCircle size={12} className="shrink-0 text-rose-600" />
                                  <span>Conflict: {roundAvail.conflict?.reason}</span>
                                </div>
                              )}
                            </div>
                          );
                        })() : (
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

              {/* Conflict warning banner if any round has a candidate schedule overlap */}
              {rounds.some((r, i) => r.scheduledTime && getCandidateSlotConflict(r.scheduledDate, r.scheduledTime, r.duration || 45, i, rounds, candidateBookedRounds).hasConflict) && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2.5">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>
                    Multiple interview rounds are scheduled at overlapping dates and times for this candidate. Click &ldquo;Back to Edit&rdquo; to assign separate time slots before confirming.
                  </span>
                </div>
              )}

              {/* Conflict warning banner if any round has an interviewer overlap */}
              {rounds.some((r, i) => !r.isAlreadyScheduled && r.scheduledTime && r.interviewer && !getInterviewerAvailability(r.interviewer, r.scheduledDate, r.scheduledTime, r.duration || 45, i, rounds, candidate).isAvailable) && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2.5">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>
                    One or more interviewers have conflicting interview schedules. Click &ldquo;Back to Edit&rdquo; to resolve conflicts before confirming.
                  </span>
                </div>
              )}

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
                  onClick={scheduledSuccess ? onClose : handleConfirmAndSchedule}
                  disabled={
                    isSubmitting ||
                    (!scheduledSuccess && (
                      !rounds.some(r => r.scheduledDate && r.scheduledTime) ||
                      rounds.some((r, i) => !r.isAlreadyScheduled && r.scheduledTime && r.interviewer && !getInterviewerAvailability(r.interviewer, r.scheduledDate, r.scheduledTime, r.duration || 45, i, rounds, candidate).isAvailable) ||
                      rounds.some((r, i) => r.scheduledTime && getCandidateSlotConflict(r.scheduledDate, r.scheduledTime, r.duration || 45, i, rounds, candidateBookedRounds).hasConflict)
                    ))
                  }
                  className={`px-7 py-3 rounded-2xl bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-sm transition-all cursor-pointer ${
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
