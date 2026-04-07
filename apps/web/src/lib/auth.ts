'use client';

import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  organizationId: string | null;
  organizationName: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

// Always use relative /api path — Vercel rewrites proxy to Railway backend
const API_BASE = '/api';

export function useAuthState(): AuthContextType {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('threatguard_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'ログインに失敗しました。メールアドレスとパスワードを確認してください。');
    }
    const data = await res.json();
    // Store token separately
    localStorage.setItem('threatguard_token', data.token);
    localStorage.setItem('threatguard_user', JSON.stringify(data.user));
    localStorage.setItem('threatguard_session_start', String(Date.now()));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('threatguard_token');
    localStorage.removeItem('threatguard_user');
    localStorage.removeItem('threatguard_session_start');
    setUser(null);
  };

  return { user, loading, login, logout };
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('threatguard_token');
}

export { type User, type AuthContextType };
