"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { requestInviteOtp } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

function buildAcceptInviteUrl(inviteToken: string, nextPath?: string) {
  const params = new URLSearchParams();
  params.set("invite", inviteToken);

  if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
    params.set("next", nextPath);
  }

  return `/auth/accept?${params.toString()}`;
}

export function AcceptInviteForm({
  inviteToken,
  nextPath,
  initialEmail,
  initialStep = "email",
}: {
  inviteToken: string;
  nextPath?: string;
  initialEmail?: string;
  initialStep?: "email" | "code";
}) {
  const [state, formAction, pending] = useActionState(requestInviteOtp, undefined);
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, startVerify] = useTransition();

  const email = state?.email ?? initialEmail ?? "";
  const invite = state?.invite ?? inviteToken;
  const resolvedNextPath = state?.next ?? nextPath;
  const isCodeStep =
    state?.step === "code" || (initialStep === "code" && Boolean(email));
  const successMessage =
    state?.success ??
    (isCodeStep && email
      ? `We've sent a sign-in code to ${email}. Enter the code to accept the invite.`
      : null);

  useEffect(() => {
    if (!state?.redirectTo) return;
    window.location.replace(state.redirectTo);
  }, [state?.redirectTo]);

  function handleVerify() {
    if (!email) {
      setVerifyError("Request a fresh sign-in code to continue.");
      return;
    }

    setVerifyError(null);
    startVerify(async () => {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });

      if (error) {
        setVerifyError(error.message);
        return;
      }

      const params = new URLSearchParams();
      params.set("invite", invite);
      if (
        resolvedNextPath &&
        resolvedNextPath.startsWith("/") &&
        !resolvedNextPath.startsWith("//")
      ) {
        params.set("next", resolvedNextPath);
      }
      const query = params.toString();
      window.location.replace(query ? `/auth/callback?${query}` : "/auth/callback");
    });
  }

  function handleResend() {
    setCode("");
    setVerifyError(null);
  }

  if (isCodeStep) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-[var(--mk-text-muted)]">
            Enter the code sent to{" "}
            <span className="font-medium text-[var(--mk-primary-dark)]">{email}</span>
          </p>
        </div>
        <div className="space-y-1.5">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            className="h-11 text-center text-lg font-semibold tracking-[0.3em] placeholder:tracking-[0.3em]"
          />
        </div>
        {verifyError ? <p className="text-sm text-destructive">{verifyError}</p> : null}
        {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
        <Button
          type="button"
          className="w-full"
          disabled={code.length < 6 || verifying}
          onClick={handleVerify}
        >
          {verifying ? "Verifying..." : "Verify"}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <form action={formAction} onSubmit={handleResend}>
            <input type="hidden" name="invite" value={invite} />
            <input type="hidden" name="next" value={resolvedNextPath ?? ""} />
            <button
              type="submit"
              className="text-[var(--mk-primary)] hover:underline"
              disabled={pending}
            >
              {pending ? "Sending..." : "Resend code"}
            </button>
          </form>
          <button
            type="button"
            className="text-[var(--mk-text-muted)] hover:underline"
            onClick={() => window.location.replace(buildAcceptInviteUrl(inviteToken, nextPath))}
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="invite" value={inviteToken} />
      <input type="hidden" name="next" value={nextPath ?? ""} />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending code..." : "Send sign-in code"}
      </Button>
    </form>
  );
}
