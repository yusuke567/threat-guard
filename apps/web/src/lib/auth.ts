'use client';

import { useState, useEffect, createContext, useContext } from 'react';

interface User {
  id: string;
  email: string;
  name: string | null;
  organizationId: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

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
      throw new Error(err.error || 'Login failed');
    }
    const userData = await res.json();
    localStorage.setItem('threatguard_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('threatguard_user');
    setUser(null);
  };

  return { user, loading, login, logout };
}

export { type User, type AuthContextType };
