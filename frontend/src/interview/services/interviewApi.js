import { request as apiRequest, API_BASE_URL } from '../../api/client';
import { uploadParts } from '../utils/uploadPool';

export function interviewCredentialsQuery() {
  const query = new URLSearchParams();
  const invitation = new URLSearchParams(window.location.search).get('token');
  if (invitation) query.set('token', invitation);
  else {
    const accountToken = localStorage.getItem('auth_token');
    if (accountToken) query.set('access_token', accountToken);
  }
  return query.toString();
}

function request(path, options = {}) {
  const query = new URLSearchParams(window.location.search);
  const invitation = query.get('token');
  if (invitation && path.includes('/interviews/') && !path.includes('token=')) {
    path += `${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(invitation)}`;
  }
  return apiRequest(path, {
    ...options,
    token: options.token || (invitation ? undefined : localStorage.getItem('auth_token')),
  });
}

const commAnalysisCache = new Map();

export const interviewApi = {
  // Hiring Manager / HR Actions
  async createRound(payload, token) {
    return request('/api/interviews/rounds', {
      method: 'POST',
      body: payload,
      token,
    });
  },

  async listRounds(params = {}, token) {
    const query = new URLSearchParams();
    if (params.requisition_id) query.append('requisition_id', params.requisition_id);
    if (params.candidate_id) query.append('candidate_id', params.candidate_id);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/api/interviews/rounds${qs}`, {
      method: 'GET',
      token,
    });
  },

  async getSummary(token) {
    return request('/api/interviews/summary', {
      method: 'GET',
      token,
    });
  },

  async recordCandidateDecision(candidateId, decision, notes = '', requisitionId = null, token) {
    return request(`/api/interviews/candidates/${encodeURIComponent(candidateId)}/decision`, {
      method: 'POST',
      body: { decision, notes, requisition_id: requisitionId },
      token,
    });
  },

  // Candidate Authentication & Portal
  async candidateLogin({ email, passcode, token }) {
    return request('/api/interviews/candidate/login', {
      method: 'POST',
      body: { email, passcode, token },
    });
  },

  async getCandidatePortal({ token, email }) {
    const query = new URLSearchParams();
    if (token) query.append('token', token);
    if (email) query.append('email', email);
    return request(`/api/interviews/candidate/portal?${query.toString()}`, {
      method: 'GET',
    });
  },

  // Staff / Interviewer Portal
  async getStaffPortal({ token, email }) {
    const query = new URLSearchParams();
    if (token) query.append('token', token);
    if (email) query.append('email', email);
    return request(`/api/interviews/staff/portal?${query.toString()}`, {
      method: 'GET',
    });
  },

  // Meeting & Round Operations
  async getRoundDetail(roundId) {
    return request(`/api/interviews/rounds/${roundId}`, {
      method: 'GET',
      noCache: true,
    });
  },

  async updateRoundStatus(roundId, status) {
    return request(`/api/interviews/rounds/${roundId}/status`, {
      method: 'POST',
      body: { status },
    });
  },

  async submitEvaluation(roundId, payload) {
    return request(`/api/interviews/rounds/${roundId}/evaluation`, {
      method: 'POST',
      body: payload,
    });
  },

  // LiveKit WebRTC Token
  async getLiveKitToken(payload) {
    return request('/api/interviews/livekit/token', {
      method: 'POST',
      body: payload,
    });
  },

  // Chat & History
  async getChatHistory(roundId) {
    return request(`/api/interviews/rounds/${roundId}/chat`, {
      method: 'GET',
    });
  },

  async sendChatMessage(roundId, payload) {
    return request(`/api/interviews/rounds/${roundId}/chat`, {
      method: 'POST',
      body: payload,
    });
  },

  // Spoken Communication & Transcription Analysis
  async analyzeCommunication(roundId, payload) {
    return request(`/api/interviews/rounds/${roundId}/analyze-communication`, {
      method: 'POST',
      body: payload,
      timeout: 60000,
    });
  },

  async getAssessmentQuestions(roundId, token) {
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return request(`/api/interviews/rounds/${roundId}/questions${query}`, { noCache: true });
  },

  async saveTranscript(roundId, transcriptTurns) {
    return request(`/api/interviews/rounds/${roundId}/transcript`, {
      method: 'POST',
      body: { transcript_turns: transcriptTurns },
    });
  },

  async getCommunicationAnalysis(roundId) {
    if (!roundId) return null;
    const cacheKey = `${localStorage.getItem('auth_token') || new URLSearchParams(window.location.search).get('token') || 'anonymous'}:${roundId}`;
    if (commAnalysisCache.has(cacheKey)) {
      return commAnalysisCache.get(cacheKey);
    }
    const p = request(`/api/interviews/rounds/${roundId}/communication-analysis`, {
      method: 'GET',
    }).catch((err) => {
      commAnalysisCache.delete(cacheKey);
      throw err;
    });
    commAnalysisCache.set(cacheKey, p);
    return p;
  },

  // Candidate Interview Video Recording
  async uploadRecording(roundId, videoBlob, durationSeconds = 0, interviewToken = '', onProgress = () => {}) {
    interviewToken ||= new URLSearchParams(window.location.search).get('token') || '';
    if (interviewToken) {
      const size = 1024 * 1024;
      const count = Math.ceil(videoBlob.size / size);
      if (!count || count > 256) throw new Error('Recording is empty or larger than 256 MB. Contact the hiring team.');
      const uploadId = crypto.randomUUID();
      const base = `/api/interviews/rounds/${roundId}/recording/chunks/${uploadId}`;
      const query = `?token=${encodeURIComponent(interviewToken)}`;
      await uploadParts(count, async index => {
        const body = new FormData();
        body.append('file', videoBlob.slice(index * size, (index + 1) * size), 'chunk.bin');
        let failure;
        for (let attempt = 0; attempt < 3; attempt++) {
          try { await request(`${base}/parts/${index}${query}`, { method: 'POST', body, timeout: 60000 }); failure = null; break; }
          catch (error) { failure = error; }
        }
        if (failure) throw failure;
      }, onProgress);
      onProgress({ uploaded: count, total: count, phase: 'saving' });
      const body = new FormData();
      body.append('chunk_count', String(count));
      body.append('duration_seconds', String(Math.round(durationSeconds)));
      body.append('content_type', videoBlob.type || 'video/webm');
      return request(`${base}/complete${query}`, { method: 'POST', body, timeout: 180000 });
    }
    const formData = new FormData();
    formData.append('file', videoBlob, `recording_${roundId}.webm`);
    formData.append('duration_seconds', String(Math.round(durationSeconds)));
    return request(`/api/interviews/rounds/${roundId}/recording`, {
      method: 'POST',
      body: formData,
      timeout: 60000,
    });
  },

  async getRecordingAccess(roundId) {
    return request(`/api/interviews/rounds/${roundId}/recording-access`, { noCache: true });
  },

  getRecordingStreamUrl(roundId, download = false, mediaToken = '') {
    return `${API_BASE_URL}/api/interviews/rounds/${roundId}/recording?media_token=${encodeURIComponent(mediaToken)}${download ? '&download=true' : ''}`;
  },

  // 48-Hour Shortlist Automation & Instant Send
  async getShortlistStatus(requisitionId, token) {
    return request(`/api/requisitions/${requisitionId}/shortlist/status`, {
      method: 'GET',
      token,
    });
  },

  async sendShortlistInstant(requisitionId, notes = '', token) {
    return request(`/api/requisitions/${requisitionId}/shortlist/send-now`, {
      method: 'POST',
      body: { notes },
      token,
    });
  },

  async generateShortlist(requisitionId, token) {
    return request(`/api/requisitions/${requisitionId}/shortlist/generate`, {
      method: 'POST',
      token,
    });
  },
};
