import { useState } from 'react';
import { X, Copy, Check, ExternalLink, Mail, KeyRound, UserCheck, ShieldCheck } from 'lucide-react';
import {
  getCandidateInterviewLink,
  getInterviewerStaffLink,
  getMeetingRoomLink,
  generateCandidateEmailTemplate,
  generateStaffEmailTemplate,
} from '../utils/credentialGenerator';

export function InviteActionsModal({ isOpen, onClose, round }) {
  const [copiedItem, setCopiedItem] = useState('');

  if (!isOpen || !round) return null;

  const candidateLink = getCandidateInterviewLink(round);
  const staffLink = getInterviewerStaffLink(round);
  const roomLink = getMeetingRoomLink(round.id);

  const copyToClipboard = (text, itemKey) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(itemKey);
    setTimeout(() => setCopiedItem(''), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-xl w-full p-6 sm:p-8 my-8 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition"
        >
          <X size={20} />
        </button>

        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
            <Check size={13} /> Round Created Successfully
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            Interview Access & Invitations
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Share these generated credentials and links with {round.candidate_name} and interviewer {round.interviewer_name}.
          </p>
        </div>

        <div className="space-y-4">
          {/* Candidate Access Card */}
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                <UserCheck size={15} /> Candidate Credentials
              </span>
              <span className="text-xs font-medium text-zinc-500">{round.candidate_email}</span>
            </div>

            {/* Candidate Passcode */}
            <div>
              <div className="text-[11px] font-semibold text-zinc-500 mb-1">Temporary Passcode</div>
              <div className="flex items-center justify-between gap-2 p-2.5 bg-white border border-zinc-300 rounded-xl font-mono text-sm font-bold text-zinc-900">
                <span>{round.candidate_passcode || 'TJ-INT-XXXX'}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(round.candidate_passcode || '', 'passcode')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition flex items-center gap-1 cursor-pointer"
                >
                  {copiedItem === 'passcode' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copiedItem === 'passcode' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Candidate Invite Link */}
            <div>
              <div className="text-[11px] font-semibold text-zinc-500 mb-1">Candidate Interview Link</div>
              <div className="flex items-center justify-between gap-2 p-2.5 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-700 truncate">
                <span className="truncate">{candidateLink}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(candidateLink, 'cand_link')}
                  className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition flex items-center gap-1 cursor-pointer"
                >
                  {copiedItem === 'cand_link' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copiedItem === 'cand_link' ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interviewer Staff Link */}
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                <ShieldCheck size={15} /> Interviewer Direct Access
              </span>
              <span className="text-xs font-medium text-zinc-500">{round.interviewer_email}</span>
            </div>
            <div className="flex items-center justify-between gap-2 p-2.5 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-700 truncate">
              <span className="truncate">{staffLink}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(staffLink, 'staff_link')}
                className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition flex items-center gap-1 cursor-pointer"
              >
                {copiedItem === 'staff_link' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copiedItem === 'staff_link' ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Email Templates Copy Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => copyToClipboard(generateCandidateEmailTemplate(round), 'cand_email')}
              className="px-4 py-2.5 rounded-xl border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Mail size={15} />
              <span>{copiedItem === 'cand_email' ? 'Email Copied!' : 'Copy Candidate Invite Email'}</span>
            </button>

            <button
              type="button"
              onClick={() => copyToClipboard(generateStaffEmailTemplate(round), 'staff_email')}
              className="px-4 py-2.5 rounded-xl border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Mail size={15} />
              <span>{copiedItem === 'staff_email' ? 'Email Copied!' : 'Copy Interviewer Brief Email'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-zinc-200">
          <a
            href={staffLink}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 flex items-center gap-1"
          >
            <span>Preview as Interviewer</span>
            <ExternalLink size={13} />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-zinc-950 text-white text-sm font-semibold hover:bg-zinc-800 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
