import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, User, Sparkles, Check, ChevronDown, ChevronUp, Video, Calendar, Clock, FileText } from 'lucide-react';
import { ROUND_TYPES } from '../utils/interviewConstants';
import { interviewApi } from '../services/interviewApi';
import { useAuth } from '../../context/AuthContext';

function getDefaultTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function getPresetRole(typeId) {
  if (typeId === 'Recruiter') return 'Talent Acquisition / HR';
  if (typeId === 'Technical_1') return 'Senior Staff Engineer';
  if (typeId === 'Technical_2') return 'Principal Systems Architect';
  if (typeId === 'Manager') return 'Engineering Manager';
  if (typeId === 'Final') return 'VP / Director of Engineering';
  return 'Technical Interviewer';
}

function getPresetNotes(typeId) {
  if (typeId === 'Recruiter') return 'Assess cultural alignment, career motivations, and compensation expectations.';
  if (typeId === 'Technical_1') return 'Evaluate core data structures, algorithms, coding cleanliness, and problem breakdown.';
  if (typeId === 'Technical_2') return 'Assess distributed architecture, scalability, system trade-offs, and production resiliency.';
  if (typeId === 'Manager') return 'Assess behavioral leadership, conflict resolution, ownership, and team collaboration.';
  if (typeId === 'Final') return 'Executive alignment, strategic vision, department fit, and final hiring confirmation.';
  return 'Evaluate core technical and communication competencies.';
}

export function CreateRoundModal({ isOpen, onClose, onSuccess, initialData = {} }) {
  const { user, token } = useAuth();

  const [candidateSubmissionId, setCandidateSubmissionId] = useState(() => initialData.candidate_submission_id || '');
  const [candidateName, setCandidateName] = useState(() => initialData.candidate_name || 'Arjun m');
  const [candidateEmail, setCandidateEmail] = useState(() => initialData.candidate_email || 'candidate@termjobs.in');
  const [requisitionId, setRequisitionId] = useState(() => initialData.requisition_id || '');
  const [requisitionTitle, setRequisitionTitle] = useState(() => initialData.requisition_title || 'DevSecOps Engineer');

  const [roundType, setRoundType] = useState(() => initialData.round_type || 'Technical_1');
  const [roundName, setRoundName] = useState(() => initialData.round_name || 'Technical Round 1');
  const [roundNumber, setRoundNumber] = useState(() => initialData.nextRoundNumber || 2);

  const [scheduledDate, setScheduledDate] = useState(() => initialData.scheduled_date || getDefaultTomorrowDate());
  const [scheduledTime, setScheduledTime] = useState(() => initialData.scheduled_time || '11:00');
  const [durationMinutes, setDurationMinutes] = useState(() => initialData.duration_minutes || 45);

  const [interviewerName, setInterviewerName] = useState(() => initialData.interviewer_name || user?.name || 'Hiring Manager');
  const [interviewerEmail, setInterviewerEmail] = useState(() => initialData.interviewer_email || user?.email || 'hm@gmail.com');
  const [interviewerRole, setInterviewerRole] = useState(() => initialData.interviewer_role || 'Senior Staff Engineer');

  const [instructions, setInstructions] = useState('Please ensure you have a quiet environment, a working webcam and microphone. Join directly via the encrypted LiveKit video room.');
  const [internalNotes, setInternalNotes] = useState('Assess core algorithm efficiency, code cleanliness, and architectural trade-offs.');

  const [showAdvancedNotes, setShowAdvancedNotes] = useState(false);
  const [autofilledNotice, setAutofilledNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Intelligent Autofill function
  const applyAutofill = useCallback((overrideData = {}) => {
    const data = { ...initialData, ...overrideData };

    setCandidateSubmissionId(data.candidate_submission_id || candidateSubmissionId || '');
    setCandidateName(data.candidate_name || candidateName || 'Arjun m');
    setCandidateEmail(data.candidate_email || candidateEmail || 'candidate@termjobs.in');
    setRequisitionId(data.requisition_id || requisitionId || '');
    setRequisitionTitle(data.requisition_title || requisitionTitle || 'DevSecOps Engineer');

    const targetType = data.round_type || roundType || 'Technical_1';
    setRoundType(targetType);

    const preset = ROUND_TYPES.find((r) => r.id === targetType);
    setRoundName(data.round_name || preset?.label || 'Technical Round 1');
    setRoundNumber(data.nextRoundNumber || data.round_number || roundNumber || 2);
    setDurationMinutes(data.duration_minutes || preset?.defaultDuration || 45);

    setScheduledDate(data.scheduled_date || getDefaultTomorrowDate());
    setScheduledTime(data.scheduled_time || '11:00');

    // Use current logged-in user or HM defaults
    const hmName = data.interviewer_name || user?.name || 'Hiring Manager';
    const hmEmail = data.interviewer_email || user?.email || (typeof window !== 'undefined' ? localStorage.getItem('user_email') || 'hm@gmail.com' : 'hm@gmail.com');
    setInterviewerName(hmName);
    setInterviewerEmail(hmEmail);
    setInterviewerRole(data.interviewer_role || getPresetRole(targetType));

    setInstructions(
      data.instructions ||
      'Please ensure you have a quiet environment, a working webcam and microphone. Join directly via the encrypted LiveKit video room.'
    );
    setInternalNotes(data.internal_notes || getPresetNotes(targetType));

    setAutofilledNotice(true);
    setTimeout(() => setAutofilledNotice(false), 2200);
  }, [initialData, candidateSubmissionId, candidateName, candidateEmail, requisitionId, requisitionTitle, roundType, roundNumber, user]);

  // Auto-populate whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      applyAutofill(initialData);
      setErrorMsg('');
    }
  }, [isOpen, initialData, applyAutofill]);

  if (!isOpen) return null;

  const handleRoundTypeChange = (typeId) => {
    setRoundType(typeId);
    const preset = ROUND_TYPES.find((r) => r.id === typeId);
    if (preset) {
      setRoundName(preset.label);
      setDurationMinutes(preset.defaultDuration);
      setInterviewerRole(getPresetRole(typeId));
      setInternalNotes(getPresetNotes(typeId));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!candidateName.trim() || !candidateEmail.trim()) {
      setErrorMsg('Candidate Name and Candidate Email are required.');
      return;
    }
    if (!interviewerName.trim() || !interviewerEmail.trim()) {
      setErrorMsg('Interviewer Name and Interviewer Email are required.');
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      setErrorMsg('Please specify interview date and time.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        requisition_id: requisitionId,
        requisition_title: requisitionTitle,
        candidate_submission_id: candidateSubmissionId,
        candidate_name: candidateName.trim(),
        candidate_email: candidateEmail.trim().toLowerCase(),
        round_number: parseInt(roundNumber, 10) || 1,
        round_name: roundName.trim(),
        round_type: roundType,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        duration_minutes: parseInt(durationMinutes, 10) || 45,
        interviewer_name: interviewerName.trim(),
        interviewer_email: interviewerEmail.trim().toLowerCase(),
        interviewer_role: interviewerRole.trim(),
        instructions: instructions.trim(),
        internal_notes: internalNotes.trim(),
      };

      const created = await interviewApi.createRound(payload, token);
      if (created) {
        if (onSuccess) onSuccess(created);
        onClose();
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to create interview round. Please check for duplicate rounds.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    color: '#09090b',
    backgroundColor: '#ffffff',
    WebkitTextFillColor: '#09090b',
  };

  return (
    <div className="create-round-modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      {/* Scoped style to guarantee inputs are never white text */}
      <style>{`
        .create-round-modal input,
        .create-round-modal textarea,
        .create-round-modal select {
          color: #09090b !important;
          background-color: #ffffff !important;
          -webkit-text-fill-color: #09090b !important;
        }
        .create-round-modal input::placeholder,
        .create-round-modal textarea::placeholder {
          color: #71717a !important;
          -webkit-text-fill-color: #71717a !important;
        }
      `}</style>

      <div className="bg-white rounded-3xl border border-zinc-200/90 shadow-2xl max-w-lg w-full p-5 sm:p-6 my-auto max-h-[94vh] flex flex-col relative text-zinc-950">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LiveKit Company Round
              </span>
              {autofilledNotice && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 animate-fadeIn">
                  <Check size={11} className="stroke-[3]" /> Autofilled
                </span>
              )}
            </div>
            <h2 className="text-lg font-black text-zinc-950 tracking-tight">
              Schedule Company Interview
            </h2>
            <p className="text-[11px] text-zinc-500">
              Setup multi-round live video meeting with encrypted LiveKit room & passcode.
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quick Autofill Button */}
            <button
              type="button"
              onClick={() => applyAutofill()}
              title="Click to automatically fill all optimal details"
              className="px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer border border-zinc-200"
            >
              <Sparkles size={12} className="text-amber-500 fill-amber-500" />
              <span>Autofill</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="overflow-y-auto space-y-4 pt-3 pr-1 text-xs">
          {/* Candidate Badge */}
          <div className="p-2.5 bg-zinc-50 border border-zinc-200/80 rounded-2xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-zinc-950 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {(candidateName || 'C').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-zinc-950 text-xs truncate">
                  {candidateName || 'Candidate'}
                </div>
                <div className="text-[10.5px] text-zinc-500 truncate">
                  {candidateEmail || 'No email provided'}
                </div>
              </div>
            </div>
            {requisitionTitle && (
              <span className="px-2 py-0.5 rounded-md bg-white border border-zinc-200 text-zinc-700 font-semibold text-[10px] shrink-0 truncate max-w-[150px]">
                {requisitionTitle}
              </span>
            )}
          </div>

          {/* Round Presets (Compact 3x2 Grid) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Select Round Type
              </label>
              <span className="text-[10px] text-zinc-400">Clicking updates preset details</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {ROUND_TYPES.map((preset) => {
                const isSelected = roundType === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleRoundTypeChange(preset.id)}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs ring-1 ring-zinc-950'
                        : 'bg-zinc-50/80 text-zinc-800 border-zinc-200/80 hover:bg-zinc-100 hover:border-zinc-300'
                    }`}
                  >
                    <div className="text-[11px] font-bold leading-tight truncate">{preset.label}</div>
                    <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-zinc-300' : 'text-zinc-400'}`}>
                      {preset.defaultDuration} mins
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Round Name & Sequence */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Round Name
              </label>
              <input
                type="text"
                value={roundName}
                onChange={(e) => setRoundName(e.target.value)}
                required
                style={inputStyle}
                placeholder="e.g. Technical Round 1"
                className="w-full px-3 py-1.5 bg-white text-zinc-950 font-bold placeholder:text-zinc-400 rounded-xl border border-zinc-300 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 shadow-xs"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Round #
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={roundNumber}
                onChange={(e) => setRoundNumber(e.target.value)}
                required
                style={inputStyle}
                className="w-full px-3 py-1.5 bg-white text-zinc-950 font-bold placeholder:text-zinc-400 rounded-xl border border-zinc-300 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 shadow-xs"
              />
            </div>
          </div>

          {/* Date, Time & Duration */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
                style={inputStyle}
                className="w-full px-2.5 py-1.5 bg-white text-zinc-950 font-semibold rounded-xl border border-zinc-300 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 shadow-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
                style={inputStyle}
                className="w-full px-2.5 py-1.5 bg-white text-zinc-950 font-semibold rounded-xl border border-zinc-300 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 shadow-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Duration (mins)
              </label>
              <input
                type="number"
                step="15"
                min="15"
                max="180"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                required
                style={inputStyle}
                className="w-full px-2.5 py-1.5 bg-white text-zinc-950 font-semibold rounded-xl border border-zinc-300 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 shadow-xs"
              />
            </div>
          </div>

          {/* Assigned Interviewer Card */}
          <div className="p-3 bg-zinc-50/80 border border-zinc-200/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1">
                <User size={12} className="text-zinc-500" />
                <span>Assigned Company Interviewer</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setInterviewerName(user?.name || 'Hiring Manager');
                  setInterviewerEmail(user?.email || 'hm@gmail.com');
                  setInterviewerRole(getPresetRole(roundType));
                }}
                className="text-[10px] text-zinc-700 hover:text-zinc-950 font-bold cursor-pointer underline"
              >
                Set Me as Interviewer
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">Interviewer Name *</label>
                <input
                  type="text"
                  value={interviewerName}
                  onChange={(e) => setInterviewerName(e.target.value)}
                  required
                  style={inputStyle}
                  placeholder="e.g. Hiring Manager"
                  className="w-full px-3 py-1.5 bg-white text-zinc-950 font-semibold placeholder:text-zinc-400 rounded-xl border border-zinc-300 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 shadow-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">Interviewer Email *</label>
                <input
                  type="email"
                  value={interviewerEmail}
                  onChange={(e) => setInterviewerEmail(e.target.value)}
                  required
                  style={inputStyle}
                  placeholder="e.g. hm@gmail.com"
                  className="w-full px-3 py-1.5 bg-white text-zinc-950 font-semibold placeholder:text-zinc-400 rounded-xl border border-zinc-300 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">Interviewer Title / Role</label>
              <input
                type="text"
                value={interviewerRole}
                onChange={(e) => setInterviewerRole(e.target.value)}
                style={inputStyle}
                placeholder="e.g. Senior Staff Engineer"
                className="w-full px-3 py-1.5 bg-white text-zinc-950 font-semibold placeholder:text-zinc-400 rounded-xl border border-zinc-300 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 shadow-xs"
              />
            </div>
          </div>

          {/* Collapsible Instructions & Notes */}
          <div className="border border-zinc-200/80 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvancedNotes(!showAdvancedNotes)}
              className="w-full p-2.5 bg-zinc-50/60 hover:bg-zinc-100/70 flex items-center justify-between text-[11px] font-bold text-zinc-700 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <FileText size={12} className="text-zinc-500" />
                <span>Instructions & Rubric Notes (Optional)</span>
              </span>
              {showAdvancedNotes ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showAdvancedNotes && (
              <div className="p-3 bg-white space-y-2.5 border-t border-zinc-100">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Candidate Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    style={inputStyle}
                    placeholder="Instructions visible to the candidate..."
                    className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 text-xs text-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Interviewer Internal Notes
                  </label>
                  <textarea
                    rows={2}
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    style={inputStyle}
                    placeholder="Scoring rubrics or internal focus areas..."
                    className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 text-xs text-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-bold hover:bg-zinc-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Video size={13} />
              <span>{submitting ? 'Scheduling...' : 'Schedule LiveKit Interview'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
