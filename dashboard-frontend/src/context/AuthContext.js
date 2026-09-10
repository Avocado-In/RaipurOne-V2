import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

/**
 * Session state for the dashboard.
 *
 * The dashboard previously had no login at all - tickets, citizen PII, worker records and
 * the broadcast-to-citizens tool were reachable by anyone who could open the page. The
 * backend now requires a bearer token for every staff action, so the UI has to hold one.
 */

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
const STORAGE_KEY = 'raipurone.session';

const AuthContext = createContext(null);

const readStoredSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token) return null;
    // Drop an expired token rather than letting every request 401.
    if (parsed.expires_at && new Date(parsed.expires_at) <= new Date()) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(readStoredSession);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    setIsRestoring(false);
  }, []);

  const login = useCallback(async (username, password) => {
    const { data } = await axios.post(`${API_URL}/auth/login`, { username, password });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSession(data);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  // Several pages call axios directly instead of going through api.js, so the token is
  // attached on the global instance rather than only on the api.js client.
  useEffect(() => {
    const id = axios.interceptors.request.use((config) => {
      const token = readStoredSession()?.access_token;
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    return () => axios.interceptors.request.eject(id);
  }, [session]);

  // A 401 from anywhere means the token is gone or expired - clear it so the user is sent
  // back to the login screen instead of staring at empty pages.
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error?.response?.status === 401) logout();
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, [logout]);

  const value = useMemo(
    () => ({
      session,
      token: session?.access_token || null,
      username: session?.username || null,
      role: session?.role || null,
      isStaff: ['admin', 'manager', 'worker'].includes(session?.role),
      isAuthenticated: Boolean(session?.access_token),
      isRestoring,
      login,
      logout,
    }),
    [session, isRestoring, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
};

export const getStoredToken = () => readStoredSession()?.access_token || null;

export default AuthContext;
