"use client";

import { useState, useTransition } from "react";
import { requestCode, verifyCode } from "@/app/actions/public-builds";
import { WallPage } from "./wall-page";

export function VerifyStep({ onVerified }: { onVerified: (email: string) => void }) {
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestCode({ email, inviteCode: inviteCode || undefined });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStage("code");
    });
  }

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyCode({ email, code });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onVerified(email);
    });
  }

  return (
    <WallPage width="narrow">
        <h1 className="display mb-8" style={{ fontSize: "clamp(2.5rem, 6vw, 3.25rem)" }}>
          Build a role-specific assessment.
        </h1>
        <p className="body mb-10" style={{ color: "var(--mint)" }}>
          Paste a position description. We&rsquo;ll read the role, weigh it against the
          capability library, and let you build a real assessment &mdash; free, one taker, your
          report by email. First, verify your email so nothing runs before we know where to send it.
        </p>

        <div className="card relative flex flex-col gap-4 p-7">
          <i className="pin" aria-hidden="true" />
          {stage === "email" ? (
            <form onSubmit={submitEmail} className="flex flex-col gap-4">
              <div>
                <label htmlFor="rb-email" className="field-label">
                  Email
                </label>
                <input
                  id="rb-email"
                  className="strip"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="rb-invite" className="field-label">
                  Invite code (if you have one)
                </label>
                <input
                  id="rb-invite"
                  className="strip"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              {error && <p className="body-soft text-red-700">{error}</p>}
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? "Sending…" : "Send me a code"}
              </button>
            </form>
          ) : (
            <form onSubmit={submitCode} className="flex flex-col gap-4">
              <p className="body-soft">
                We sent a six-digit code to <strong>{email}</strong>.
              </p>
              <div>
                <label htmlFor="rb-code" className="field-label">
                  Code
                </label>
                <input
                  id="rb-code"
                  className="strip"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                />
              </div>
              {error && <p className="body-soft text-red-700">{error}</p>}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="btn btn-ink-outline"
                  onClick={() => {
                    setStage("email");
                    setError(null);
                  }}
                >
                  Use a different email
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  {pending ? "Verifying…" : "Verify"}
                </button>
              </div>
            </form>
          )}
        </div>
        <p className="label label-paper mt-10" style={{ opacity: 0.7 }}>
          Free &middot; one taker &middot; your report by email
        </p>
    </WallPage>
  );
}
