import React from 'react';
import { Mail, UserCheck } from 'lucide-react';

export default function CandidateApplicationActions({ application, applicationAction, onAction }) {
  const closed = application.requisition_deleted || ['Closed', 'Cancelled', 'Rejected', 'Draft'].includes(application.requisition_status);
  const terminal = ['Rejected', 'Withdrawn'].includes(application.status);
  const completed = ['Completed', 'Evaluated'].includes(application.ai_interview_status);
  const started = ['In Progress', 'Live'].includes(application.ai_interview_status);
  const sent = application.sent_to_hiring_manager;
  return <div className="mt-3 space-y-2 border-t border-gray-200 pt-2">
    <p className="text-[11px] text-gray-600">AI interview: <strong>{application.ai_interview_status || 'Not invited'}</strong></p>
    {application.ai_invitation_sent_at && <p className="text-[10px] text-gray-500">Last emailed: {new Date(application.ai_invitation_sent_at).toLocaleString()}</p>}
    {application.ai_email_delivery_status === 'failed' && <p className="text-[11px] text-rose-600">Last email failed. You can retry.</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={Boolean(applicationAction) || closed || terminal || completed || started || ['Hired', 'Offer Accepted'].includes(application.status)}
        onClick={() => onAction(application, 'email-ai-interview')}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-[11px] font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-50">
        <Mail size={13} />{applicationAction === `${application.submission_id}:email-ai-interview` ? 'Sending…' : application.ai_invitation_sent_at ? 'Resend AI interview link' : 'Email AI interview link'}
      </button>
      <button type="button" disabled={Boolean(applicationAction) || closed || terminal || sent}
        onClick={() => onAction(application, 'direct-shortlist')}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">
        <UserCheck size={13} />{sent ? 'Sent to hiring manager' : applicationAction === `${application.submission_id}:direct-shortlist` ? 'Shortlisting…' : 'Shortlist & send to hiring manager'}
      </button>
    </div>
    {!sent && !closed && !terminal && <p className="text-[10px] text-gray-500">Direct shortlisting sends this application for manager review without requiring an AI interview.</p>}
  </div>;
}
