export function getCandidateInterviewLink(round) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const emailParam = encodeURIComponent(round.candidate_email || '');
  const tokenParam = round.candidate_token || '';
  const passcodeParam = round.candidate_passcode || '';
  return `${origin}/interview/candidate/login?token=${tokenParam}&email=${emailParam}&passcode=${passcodeParam}`;
}

export function getInterviewerStaffLink(round) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const tokenParam = round.interviewer_token || '';
  return `${origin}/interview/staff?token=${tokenParam}`;
}

export function getMeetingRoomLink(roundId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/interview/room/${roundId}`;
}

export function generateCandidateEmailTemplate(round) {
  const link = getCandidateInterviewLink(round);
  return `Subject: Interview Invitation: ${round.round_name || 'Interview Round'} - ${round.requisition_title || 'Position'}

Hi ${round.candidate_name || 'Candidate'},

You have been scheduled for ${round.round_name || 'an interview round'} with our team for the ${round.requisition_title || 'role'} position.

📅 Date: ${round.scheduled_date || 'TBD'}
⏰ Time: ${round.scheduled_time || 'TBD'} (${round.duration_minutes || 45} minutes)
👤 Interviewer: ${round.interviewer_name || 'Hiring Team'} (${round.interviewer_role || 'Interviewer'})

🔗 Secure Interview Portal Link:
${link}

🔑 Your Temporary Interview Passcode:
${round.candidate_passcode || 'TJ-INT-XXXX'}

Instructions for the Interview:
1. Click the link above or visit our Interview Portal.
2. Log in using your email (${round.candidate_email}) and your passcode.
3. Once in your Candidate Portal, click "Join Interview Room" when your round is active.
4. Please ensure your camera and microphone permissions are granted.

${round.instructions ? `Special Note:\n${round.instructions}\n` : ''}

Best regards,
Hiring Team
Term Jobs Platform`;
}

export function generateStaffEmailTemplate(round) {
  const link = getInterviewerStaffLink(round);
  return `Subject: Interview Assignment: ${round.round_name} with ${round.candidate_name}

Hi ${round.interviewer_name || 'Interviewer'},

You have been assigned to conduct an interview with ${round.candidate_name} for the position: ${round.requisition_title}.

📅 Scheduled Date: ${round.scheduled_date || 'TBD'}
⏰ Scheduled Time: ${round.scheduled_time || 'TBD'} (${round.duration_minutes || 45} mins)
👤 Candidate Name: ${round.candidate_name} (${round.candidate_email})

🔗 Interviewer Direct Access Link:
${link}

Internal Notes / Instructions:
${round.internal_notes || 'Please review candidate profile and complete the evaluation sheet post-interview.'}

Best regards,
Term Jobs Coordination Team`;
}
