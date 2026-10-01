import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { request } from '../api/client';

const AuthContext = createContext(null);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const hasToken = Boolean(localStorage.getItem(TOKEN_KEY));
    if (!hasToken) {
      try {
        localStorage.removeItem(USER_KEY);
      } catch {}
      return null;
    }
    try {
      const saved = localStorage.getItem(USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [initializing, setInitializing] = useState(() => {
    const hasToken = Boolean(localStorage.getItem(TOKEN_KEY));
    const hasUser = Boolean(localStorage.getItem(USER_KEY));
    return hasToken && !hasUser;
  });

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const applySession = useCallback((accessToken, userData) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (userData) {
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
      } catch {}
    }
    setToken(accessToken);
    setUser(userData);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const cleanEmail = email ? String(email).trim() : '';
      const cleanPassword = password ? String(password).trim() : '';
      const data = await request('/api/auth/login', { 
        method: 'POST', 
        body: { email: cleanEmail, username: cleanEmail, password: cleanPassword } 
      });
      applySession(data.access_token, data.user);
      return data.user;
    },
    [applySession]
  );

  const loginWithCandidateId = useCallback(
    async (emailOrId, password) => {
      const data = await request('/api/auth/login', { 
        method: 'POST', 
        body: { username: emailOrId, email: emailOrId, password } 
      });
      applySession(data.access_token, data.user);
      return data.user;
    },
    [applySession]
  );

  useEffect(() => {
    if (!token) {
      setInitializing(false);
      return;
    }
    let cancelled = false;
    const maxTimer = setTimeout(() => {
      if (!cancelled) setInitializing(false);
    }, 3500);

    request('/api/auth/me', { token, timeout: 5000 })
      .then((data) => {
        if (!cancelled && data) {
          setUser(data);
          try {
            localStorage.setItem(USER_KEY, JSON.stringify(data));
          } catch {}
        }
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        clearTimeout(maxTimer);
        if (!cancelled) setInitializing(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(maxTimer);
    };
  }, [token, logout]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const data = await request('/api/auth/me', { token });
      if (data) {
        setUser(data);
        try {
          localStorage.setItem(USER_KEY, JSON.stringify(data));
        } catch {}
      }
      return data;
    } catch {
      // ignore
    }
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading: initializing,
      initializing,
      login,
      loginWithCandidateId,
      loginCandidate: loginWithCandidateId,
      logout,
      refreshUser,
    }),
    [user, token, initializing, login, loginWithCandidateId, logout, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
