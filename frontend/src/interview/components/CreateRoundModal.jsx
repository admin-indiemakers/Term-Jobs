import { useState, useEffect } from 'react';
import { X, AlertCircle, User } from 'lucide-react';
import { ROUND_TYPES } from '../utils/interviewConstants';
import { interviewApi } from '../services/interviewApi';
import { useAuth } from '../../context/AuthContext';

export function CreateRoundModal({ isOpen, onClose, onSuccess, initialData = {} }) {
  const { token } = useAuth();

  const [candidateSubmissionId, setCandidateSubmissionId] = useState(initialData.candidate_submission_id || '');
  const [candidateName, setCandidateName] = useState(initialData.candidate_name || '');
  const [candidateEmail, setCandidateEmail] = useState(initialData.candidate_email || '');
  const [requisitionId, setRequisitionId] = useState(initialData.requisition_id || '');
  const [requisitionTitle, setRequisitionTitle] = useState(initialData.requisition_title || '');

  const [roundType, setRoundType] = useState('Technical_1');
  const [roundName, setRoundName] = useState('Technical Round 1');
  const [roundNumber, setRoundNumber] = useState(initialData.nextRoundNumber || 1);

  useEffect(() => {
    if (isOpen) {
      setCandidateSubmissionId(initialData.candidate_submission_id || '');
      setCandidateName(initialData.candidate_name || '');
      setCandidateEmail(initialData.candidate_email || '');
      setRequisitionId(initialData.requisition_id || '');
      setRequisitionTitle(initialData.requisition_title || '');
      setRoundNumber(initialData.nextRoundNumber || 1);
      setErrorMsg('');
    }
  }, [isOpen, initialData]);
  const [scheduledDate, setScheduledDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [scheduledTime, setScheduledTime] = useState('11:00');
  const [durationMinutes, setDurationMinutes] = useState(45);

  const [interviewerName, setInterviewerName] = useState('');
  const [interviewerEmail, setInterviewerEmail] = useState('');
  const [interviewerRole, setInterviewerRole] = useState('Technical Interviewer');

  const [instructions, setInstructions] = useState('Please ensure you have a quiet environment, a working webcam and microphone. You may be asked to write live code.');
  const [internalNotes, setInternalNotes] = useState('Assess core algorithm efficiency, code cleanliness, and architectural trade-offs.');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleRoundTypeChange = (typeId) => {
    setRoundType(typeId);
    const preset = ROUND_TYPES.find((r) => r.id === typeId);
    if (preset) {
      setRoundName(preset.label);
      setDurationMinutes(preset.defaultDuration);
      if (typeId === 'Recruiter') {
        setInterviewerRole('HR / Talent Acquisition');
      } else if (typeId.startsWith('Technical')) {
        setInterviewerRole('Senior Staff Engineer');
      } else if (typeId === 'Manager') {
        setInterviewerRole('Engineering Manager');
      } else if (typeId === 'Final') {
        setInterviewerRole('VP / Director of Engineering');
      }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-6 sm:p-8 my-8 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition"
        >
          <X size={20} />
        </button>

        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 mb-2">
            Round Setup
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">Schedule Interview Round</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Configure round details, assign interviewers, and generate secure access links for {candidateName || 'the candidate'}.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-sm text-rose-700">
            <AlertCircle size={18} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Candidate Information Card */}
          {candidateName ? (
            <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Candidate</span>
                <span className="font-extrabold text-zinc-950 text-sm">{candidateName}</span>
                <span className="text-zinc-500 ml-2">({candidateEmail})</span>
              </div>
              {requisitionTitle && (
                <span className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200 text-zinc-700 font-semibold text-[11px]">
                  {requisitionTitle}
                </span>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Candidate Name *</label>
                <input
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  required
                  placeholder="e.g. Mohammed Hashil N K"
                  className="w-full px-3 py-2 bg-white rounded-xl border border-zinc-300 text-xs focus:ring-2 focus:ring-zinc-950"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Candidate Email *</label>
                <input
                  type="email"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  required
                  placeholder="e.g. candidate@example.com"
                  className="w-full px-3 py-2 bg-white rounded-xl border border-zinc-300 text-xs focus:ring-2 focus:ring-zinc-950"
                />
              </div>
            </div>
          )}

          {/* Round Presets */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">
              Select Round Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ROUND_TYPES.map((preset) => {
                const isSelected = roundType === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleRoundTypeChange(preset.id)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                        : 'bg-zinc-50 text-zinc-800 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <div className="text-xs font-bold leading-tight">{preset.label}</div>
                    <div className={`text-[11px] mt-0.5 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      {preset.defaultDuration} mins
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Round Name & Sequence */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Round Name</label>
              <input
                type="text"
                value={roundName}
                onChange={(e) => setRoundName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 text-sm"
                placeholder="e.g. Technical Round 1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Round Number</label>
              <input
                type="number"
                min="1"
                max="10"
                value={roundNumber}
                onChange={(e) => setRoundNumber(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 text-sm"
              />
            </div>
          </div>

          {/* Date, Time & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Start Time</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Duration (mins)</label>
              <input
                type="number"
                step="15"
                min="15"
                max="180"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 text-sm"
              />
            </div>
          </div>

          {/* Interviewer Assignment */}
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
              <User size={14} /> Assigned Interviewer
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Interviewer Name</label>
                <input
                  type="text"
                  value={interviewerName}
                  onChange={(e) => setInterviewerName(e.target.value)}
                  required
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full px-3 py-2 bg-white rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Interviewer Email</label>
                <input
                  type="email"
                  value={interviewerEmail}
                  onChange={(e) => setInterviewerEmail(e.target.value)}
                  required
                  placeholder="e.g. sarah.jenkins@company.com"
                  className="w-full px-3 py-2 bg-white rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Interviewer Title / Role</label>
              <input
                type="text"
                value={interviewerRole}
                onChange={(e) => setInterviewerRole(e.target.value)}
                placeholder="e.g. Principal Distributed Systems Engineer"
                className="w-full px-3 py-2 bg-white rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 text-sm"
              />
            </div>
          </div>

          {/* Instructions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Candidate Instructions</label>
              <textarea
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Notes visible to the candidate..."
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Interviewer Internal Notes</label>
              <textarea
                rows={2}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Internal scoring guidance or rubrics..."
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 text-xs"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-zinc-300 text-zinc-700 text-sm font-semibold hover:bg-zinc-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-zinc-950 text-white text-sm font-semibold hover:bg-zinc-800 transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Scheduling...' : 'Create & Generate Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
