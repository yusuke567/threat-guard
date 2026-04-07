'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const WARNING_BEFORE_MS = 5 * 60 * 1000; // 5 minutes before timeout
const CHECK_INTERVAL_MS = 10 * 1000; // check every 10 seconds

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

interface AutoLogoutState {
  showWarning: boolean;
  remainingSeconds: number;
  reason: 'idle' | 'session' | null;
}

export function useAutoLogout(
  isAuthenticated: boolean,
  onLogout: (reason: 'idle' | 'session') => void,
) {
  const lastActivityRef = useRef(Date.now());
  const [state, setState] = useState<AutoLogoutState>({
    showWarning: false,
    remainingSeconds: 0,
    reason: null,
  });

  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setState((prev) => {
      if (prev.reason === 'idle' && prev.showWarning) {
        return { showWarning: false, remainingSeconds: 0, reason: null };
      }
      return prev;
    });
  }, []);

  const extendSession = useCallback(() => {
    lastActivityRef.current = Date.now();
    // Reset session start time to extend session expiry
    localStorage.setItem('threatguard_session_start', String(Date.now()));
    setState({ showWarning: false, remainingSeconds: 0, reason: null });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Register activity listeners for idle detection
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetIdleTimer, { passive: true });
    }

    const interval = setInterval(() => {
      const now = Date.now();

      // Check session expiry
      const sessionStart = localStorage.getItem('threatguard_session_start');
      if (sessionStart) {
        const sessionElapsed = now - Number(sessionStart);
        const sessionRemaining = SESSION_TIMEOUT_MS - sessionElapsed;

        if (sessionRemaining <= 0) {
          onLogout('session');
          return;
        }

        if (sessionRemaining <= WARNING_BEFORE_MS) {
          setState({
            showWarning: true,
            remainingSeconds: Math.ceil(sessionRemaining / 1000),
            reason: 'session',
          });
          return;
        }
      }

      // Check idle timeout
      const idleElapsed = now - lastActivityRef.current;
      const idleRemaining = IDLE_TIMEOUT_MS - idleElapsed;

      if (idleRemaining <= 0) {
        onLogout('idle');
        return;
      }

      if (idleRemaining <= WARNING_BEFORE_MS) {
        setState({
          showWarning: true,
          remainingSeconds: Math.ceil(idleRemaining / 1000),
          reason: 'idle',
        });
        return;
      }

      // No warning needed
      setState((prev) => (prev.showWarning ? { showWarning: false, remainingSeconds: 0, reason: null } : prev));
    }, CHECK_INTERVAL_MS);

    // Also check on tab visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Trigger an immediate check by running the same logic
        const now = Date.now();
        const sessionStart = localStorage.getItem('threatguard_session_start');
        if (sessionStart) {
          const sessionRemaining = SESSION_TIMEOUT_MS - (now - Number(sessionStart));
          if (sessionRemaining <= 0) {
            onLogout('session');
            return;
          }
        }
        const idleRemaining = IDLE_TIMEOUT_MS - (now - lastActivityRef.current);
        if (idleRemaining <= 0) {
          onLogout('idle');
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetIdleTimer);
      }
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthenticated, onLogout, resetIdleTimer]);

  return { ...state, extendSession };
}
