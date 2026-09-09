import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { request } from '../api/client';

const AuthContext = createContext(null);

const TOKEN_KEY = 'auth_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [initializing, setInitializing] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const applySession = useCallback((accessToken, userData) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
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
    async (candidateId, password) => {
      const data = await request('/api/auth/login', { 
        method: 'POST', 
        body: { username: candidateId, password } 
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
        if (!cancelled) setUser(data);
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

  return (
    <AuthContext.Provider value={{ user, token, initializing, login, loginWithCandidateId, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
