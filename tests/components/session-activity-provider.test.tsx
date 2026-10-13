// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SessionActivityProvider, useSessionActivity } from "@/components/auth/session-activity-provider";

const keepAlive = vi.hoisted(() => vi.fn());
vi.mock("@/lib/net/fetch-with-timeout", () => ({ fetchWithTimeout: keepAlive }));

const location = { href: "" };

function SessionStatus() {
  const { showWarning, timeRemaining, staySignedIn } = useSessionActivity();
  return <>
    <output data-testid="warning">{String(showWarning)}</output>
    <output data-testid="remaining">{timeRemaining}</output>
    <button onClick={staySignedIn}>Stay signed in</button>
  </>;
}

function advance(seconds: number) {
  act(() => { vi.advanceTimersByTime(seconds * 1000); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T00:00:00Z"));
  keepAlive.mockResolvedValue({ ok: true });
  location.href = "";
  const browserWindow = window;
  vi.stubGlobal("window", new Proxy(browserWindow, {
    get(target, key) {
      if (key === "location") return location;
      const value = Reflect.get(target, key, target);
      return ["addEventListener", "removeEventListener", "dispatchEvent"].includes(String(key))
        ? value.bind(target) : value;
    },
  }));
  vi.stubGlobal("BroadcastChannel", class {
    postMessage() {}
    close() {}
  });
});

afterEach(() => { vi.useRealTimers(); });

describe("session activity warnings and expiry", () => {
  it.each([
    ["consultant", 85, 90],
    ["partner_admin", 85, 90],
    ["org_admin", 85, 90],
    ["platform_admin", 25, 30],
    [undefined, 25, 30],
  ] as const)("warns and expires %s at the correct boundaries", (role, warningMinutes, expiryMinutes) => {
    render(<SessionActivityProvider role={role}><SessionStatus /></SessionActivityProvider>);
    advance(warningMinutes * 60 - 1);
    expect(screen.getByTestId("warning")).toHaveTextContent("false");
    advance(1);
    expect(screen.getByTestId("warning")).toHaveTextContent("true");
    expect(screen.getByTestId("remaining")).toHaveTextContent("300");
    advance((expiryMinutes - warningMinutes) * 60 - 1);
    expect(location.href).toBe("");
    advance(1);
    expect(location.href).toBe("/auth/expire");
  });

  it.each(["consultant", "platform_admin"])("resets %s's warning when Stay signed in is clicked", (role) => {
    render(<SessionActivityProvider role={role}><SessionStatus /></SessionActivityProvider>);
    const warningSeconds = role === "platform_admin" ? 1500 : 5100;
    advance(warningSeconds);
    fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
    expect(screen.getByTestId("warning")).toHaveTextContent("false");
    expect(keepAlive).toHaveBeenCalledWith("/api/auth/activity", { method: "POST", timeoutMs: 5000 });
    advance(warningSeconds - 1);
    expect(screen.getByTestId("warning")).toHaveTextContent("false");
    advance(1);
    expect(screen.getByTestId("warning")).toHaveTextContent("true");
    expect(location.href).toBe("");
  });

  it.each(["mousemove", "keydown", "scroll", "click", "touchstart"])("keeps an active session alive on %s without an eight-hour cap", (event) => {
    render(<SessionActivityProvider role="consultant"><SessionStatus /></SessionActivityProvider>);
    for (let hour = 0; hour < 10; hour++) {
      advance(60 * 60);
      act(() => { window.dispatchEvent(new Event(event)); });
    }
    expect(screen.getByTestId("warning")).toHaveTextContent("false");
    expect(location.href).toBe("");
  });
});
