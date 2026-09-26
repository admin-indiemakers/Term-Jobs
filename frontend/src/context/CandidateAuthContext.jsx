import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../api/client';

const CandidateAuthContext = createContext(null);

const CANDIDATE_TOKEN_KEY = 'candidate_profile_token';
const CANDIDATE_USER_KEY = 'candidate_profile_user';

export function CandidateAuthProvider({ children }) {
  const [candidateToken, setCandidateToken] = useState(() => {
    try {
      const t = localStorage.getItem(CANDIDATE_TOKEN_KEY);
      return (t && t !== 'undefined' && t !== 'null') ? t : null;
    } catch {
      return null;
    }
  });

  const [candidateUser, setCandidateUser] = useState(() => {
    try {
      const saved = localStorage.getItem(CANDIDATE_USER_KEY);
      return (saved && saved !== 'undefined' && saved !== 'null') ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [applications, setApplications] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [outreachHistory, setOutreachHistory] = useState([]);
  const [hasResume, setHasResume] = useState(false);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [resumeFilename, setResumeFilename] = useState(null);
  const [candidateLoading, setCandidateLoading] = useState(true);

  // Sync profile & applications from server whenever token changes
  const refreshProfile = useCallback(async (tokenOverride = null) => {
    const token = tokenOverride || candidateToken;
    if (!token) {
      setCandidateUser(null);
      setApplications([]);
      setAgreements([]);
      setProfileCompleted(false);
      setResumeFilename(null);
      setHasResume(false);
      setCandidateLoading(false);
      return null;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/candidate-profile/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          // Token expired or invalid
          localStorage.removeItem(CANDIDATE_TOKEN_KEY);
          localStorage.removeItem(CANDIDATE_USER_KEY);
          setCandidateToken(null);
          setCandidateUser(null);
          setApplications([]);
          setProfileCompleted(false);
          setResumeFilename(null);
          setHasResume(false);
        }
        return null;
      }

      const data = await res.json();
      if (data.candidate) {
        setCandidateUser(data.candidate);
        localStorage.setItem(CANDIDATE_USER_KEY, JSON.stringify(data.candidate));
      }
      if (Array.isArray(data.applications)) {
        setApplications(data.applications);
      }
      if (Array.isArray(data.agreements)) {
        setAgreements(data.agreements);
      }
      if (Array.isArray(data.outreach)) {
        setOutreachHistory(data.outreach);
      }
      setHasResume(Boolean(data.has_resume));
      setProfileCompleted(Boolean(data.profile_completed));
      setResumeFilename(data.resume_filename || (data.candidate?.filename) || null);
      return data;
    } catch (err) {
      console.error('[CandidateAuth] refreshProfile error:', err);
      return null;
    } finally {
      setCandidateLoading(false);
    }
  }, [candidateToken]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Handle saving session on successful auth
  const handleAuthSuccess = (token, userDoc) => {
    try {
      localStorage.setItem(CANDIDATE_TOKEN_KEY, token);
      localStorage.setItem(CANDIDATE_USER_KEY, JSON.stringify(userDoc));
    } catch (err) {
      console.warn('[CandidateAuth] Storage error:', err);
    }
    setCandidateToken(token);
    setCandidateUser(userDoc);
    // Refresh to fetch any application history
    refreshProfile(token);
  };

  // 1. Email + Password Login
  const login = async (email, password) => {
    const res = await fetch(`${API_BASE_URL}/api/candidate-profile/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Login failed. Please check your credentials.');
    }

    handleAuthSuccess(data.token, data.candidate);
    return data;
  };

  // 2. Google OAuth Login / Signup
  const loginWithGoogle = async (googlePayload) => {
    const res = await fetch(`${API_BASE_URL}/api/candidate-profile/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(googlePayload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Backend route not found (404). Please restart the backend uvicorn server so the new candidate profile endpoints are loaded.');
      }
      throw new Error(data.detail || data.message || data.error || `Google authentication failed (HTTP ${res.status}).`);
    }

    handleAuthSuccess(data.token, data.candidate);
    return data;
  };

  // 3. Register Candidate Profile (FormData with optional resume)
  const register = async (formData) => {
    const res = await fetch(`${API_BASE_URL}/api/candidate-profile/register`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Registration failed. Please check your form details.');
    }

    handleAuthSuccess(data.token, data.candidate);
    return data;
  };

  // 4. Update Profile
  const updateProfile = async (updates) => {
    if (!candidateToken) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/api/candidate-profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${candidateToken}`,
      },
      body: JSON.stringify(updates),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to update profile.');
    }

    if (data.candidate) {
      setCandidateUser(data.candidate);
      localStorage.setItem(CANDIDATE_USER_KEY, JSON.stringify(data.candidate));
    }
    return data;
  };

  // 5. Setup Profile with Mandatory Resume
  const setupProfile = async (formData) => {
    if (!candidateToken) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/api/candidate-profile/setup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${candidateToken}`,
      },
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Backend route not found (404). Please restart the backend server so the newly added candidate profile endpoints are loaded: "uvicorn main:app --reload"');
      }
      const errMsg =
        (typeof data.detail === 'string' ? data.detail : null) ||
        (Array.isArray(data.detail) ? data.detail.map((d) => d.msg || JSON.stringify(d)).join(', ') : null) ||
        data.error ||
        data.message ||
        'Failed to complete profile setup.';
      throw new Error(errMsg);
    }

    if (data.candidate) {
      setCandidateUser(data.candidate);
      localStorage.setItem(CANDIDATE_USER_KEY, JSON.stringify(data.candidate));
    }
    setProfileCompleted(true);
    setHasResume(true);
    if (data.resume_filename) {
      setResumeFilename(data.resume_filename);
    }
    await refreshProfile(candidateToken);
    return data;
  };

  // 6. Logout
  const logout = () => {
    try {
      localStorage.removeItem(CANDIDATE_TOKEN_KEY);
      localStorage.removeItem(CANDIDATE_USER_KEY);
    } catch {}
    setCandidateToken(null);
    setCandidateUser(null);
    setApplications([]);
    setOutreachHistory([]);
    setHasResume(false);
    setProfileCompleted(false);
    setResumeFilename(null);
  };

  const value = {
    candidateUser,
    candidateToken,
    isAuthenticated: Boolean(candidateToken && candidateUser),
    candidateLoading,
    applications,
    agreements,
    setAgreements,
    outreachHistory,
    hasResume,
    profileCompleted,
    resumeFilename,
    login,
    loginWithGoogle,
    register,
    updateProfile,
    setupProfile,
    refreshProfile,
    logout,
  };

  return (
    <CandidateAuthContext.Provider value={value}>
      {children}
    </CandidateAuthContext.Provider>
  );
}

export function useCandidateAuth() {
  const ctx = useContext(CandidateAuthContext);
  if (!ctx) {
    throw new Error('useCandidateAuth must be used within a CandidateAuthProvider');
  }
  return ctx;
}
