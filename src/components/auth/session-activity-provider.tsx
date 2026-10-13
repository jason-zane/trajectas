"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getSessionTimeouts } from "@/lib/auth/session-activity-constants";
import { fetchWithTimeout } from "@/lib/net/fetch-with-timeout";

const DEBOUNCE_MS = 60_000; // record activity max once per 60 seconds
const BROADCAST_CHANNEL = "trajectas_session_activity";

type SessionActivityContextValue = {
  showWarning: boolean;
  timeRemaining: number; // seconds until expiry
  staySignedIn: () => void;
  signOut: () => void;
};

const SessionActivityContext = createContext<SessionActivityContextValue | null>(
  null
);

export function useSessionActivity() {
  const ctx = useContext(SessionActivityContext);
  if (!ctx) throw new Error("useSessionActivity must be used inside SessionActivityProvider");
  return ctx;
}

export function SessionActivityProvider({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: string | null;
}) {
  const { inactivityTimeoutSeconds, warningThresholdSeconds } = getSessionTimeouts(role);
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(inactivityTimeoutSeconds);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityCallRef = useRef<number>(0);
  const lastResetRef = useRef<number>(0);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const scheduleTimers = useCallback(() => {
    clearAllTimers();

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      const elapsed = Math.floor((Date.now() - lastResetRef.current) / 1000);
      setTimeRemaining(Math.max(0, inactivityTimeoutSeconds - elapsed));
      // Start countdown
      countdownRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - lastResetRef.current) / 1000);
        setTimeRemaining(Math.max(0, inactivityTimeoutSeconds - elapsed));
      }, 1000);
    }, warningThresholdSeconds * 1000);

    expiryTimerRef.current = setTimeout(() => {
      window.location.href = "/auth/expire";
    }, inactivityTimeoutSeconds * 1000);
  }, [clearAllTimers, inactivityTimeoutSeconds, warningThresholdSeconds]);

  const startTimers = useCallback(() => {
    lastResetRef.current = Date.now();
    setShowWarning(false);
    setTimeRemaining(inactivityTimeoutSeconds);
    scheduleTimers();
  }, [scheduleTimers, inactivityTimeoutSeconds]);

  const callKeepAlive = useCallback(async () => {
    try {
      await fetchWithTimeout("/api/auth/activity", { method: "POST", timeoutMs: 5_000 });
    } catch {
      // Silently ignore — if the server is unreachable, expiry redirect will handle it
    }
  }, []);

  const staySignedIn = useCallback(() => {
    callKeepAlive();
    startTimers();
    // Broadcast to other tabs
    try {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL);
      bc.postMessage({ type: "activity" });
      bc.close();
    } catch {
      // BroadcastChannel not available (e.g. in test environments)
    }
  }, [callKeepAlive, startTimers]);

  const signOut = useCallback(() => {
    window.location.href = "/logout";
  }, []);

  // Handle user activity events
  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityCallRef.current < DEBOUNCE_MS) return;
    lastActivityCallRef.current = now;

    startTimers();
    callKeepAlive();

    // Broadcast to other tabs
    try {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL);
      bc.postMessage({ type: "activity" });
      bc.close();
    } catch {
      // ignore
    }
  }, [startTimers, callKeepAlive]);

  useEffect(() => {
    lastResetRef.current = Date.now();
    scheduleTimers();

    const events = ["mousemove", "keydown", "scroll", "click", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

    // Listen for activity from other tabs
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL);
      bc.onmessage = (event) => {
        if (event.data?.type === "activity") {
          startTimers();
        }
      };
    } catch {
      // ignore
    }

    return () => {
      clearAllTimers();
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      bc?.close();
    };
  }, [scheduleTimers, handleActivity, clearAllTimers, startTimers]);

  return (
    <SessionActivityContext.Provider
      value={{ showWarning, timeRemaining, staySignedIn, signOut }}
    >
      {children}
    </SessionActivityContext.Provider>
  );
}
