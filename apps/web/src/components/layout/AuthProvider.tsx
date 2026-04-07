'use client';

import { createContext, useContext, useCallback } from 'react';
import { useAuthState, type AuthContextType } from '@/lib/auth';
import { useAutoLogout } from '@/hooks/useAutoLogout';
import SessionTimeoutDialog from './SessionTimeoutDialog';

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthState();

  const handleAutoLogout = useCallback((reason: 'idle' | 'session') => {
    auth.logout();
    const message = reason === 'idle'
      ? '一定時間操作がなかったため、自動的にログアウトしました。'
      : 'セッションの有効期限が切れたため、自動的にログアウトしました。';
    // Store the message so login page can display it
    sessionStorage.setItem('threatguard_logout_message', message);
    window.location.href = '/login';
  }, [auth]);

  const { showWarning, remainingSeconds, reason, extendSession } = useAutoLogout(
    !!auth.user,
    handleAutoLogout,
  );

  return (
    <AuthContext.Provider value={auth}>
      {children}
      {showWarning && reason && (
        <SessionTimeoutDialog
          remainingSeconds={remainingSeconds}
          reason={reason}
          onExtend={extendSession}
          onLogout={() => handleAutoLogout(reason)}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
