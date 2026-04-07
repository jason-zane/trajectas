"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { WARNING_THRESHOLD_SECONDS, INACTIVITY_TIMEOUT_SECONDS } from "@/lib/auth/session-activity";

const WARNING_MS = WARNING_THRESHOLD_SECONDS * 1000;
const TIMEOUT_MS = INACTIVITY_TIMEOUT_SECONDS * 1000;
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
}: {
  children: React.ReactNode;
}) {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(INACTIVITY_TIMEOUT_SECONDS);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityCallRef = useRef<number>(0);
  const lastResetRef = useRef<number>(Date.now());

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const startTimers = useCallback(() => {
    clearAllTimers();
    lastResetRef.current = Date.now();
    setShowWarning(false);
    setTimeRemaining(INACTIVITY_TIMEOUT_SECONDS);

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      // Start countdown
      countdownRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - lastResetRef.current) / 1000);
        setTimeRemaining(Math.max(0, INACTIVITY_TIMEOUT_SECONDS - elapsed));
      }, 1000);
    }, WARNING_MS);

    expiryTimerRef.current = setTimeout(() => {
      window.location.href = "/auth/expire";
    }, TIMEOUT_MS);
  }, [clearAllTimers]);

  const callKeepAlive = useCallback(async () => {
    try {
      await fetch("/api/auth/activity", { method: "POST" });
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
    startTimers();

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
  }, [startTimers, handleActivity, clearAllTimers]);

  return (
    <SessionActivityContext.Provider
      value={{ showWarning, timeRemaining, staySignedIn, signOut }}
    >
      {children}
    </SessionActivityContext.Provider>
  );
}
