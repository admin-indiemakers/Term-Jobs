import { request } from '../../api/client';

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
};
