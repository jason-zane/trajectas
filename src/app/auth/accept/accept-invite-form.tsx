"use client";

import { useActionState, useState, useTransition } from "react";
import { requestInviteOtp } from "@/app/actions/auth";
import type { AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function AcceptInviteForm({
  inviteToken,
  nextPath,
}: {
  inviteToken: string;
  nextPath?: string;
}) {
  const [state, formAction, pending] = useActionState(requestInviteOtp, undefined);
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, startVerify] = useTransition();

  const isCodeStep = state?.step === "code";

  function handleVerify() {
    setVerifyError(null);
    startVerify(async () => {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.verifyOtp({
        email: state!.email!,
        token: code,
        type: "email",
      });

      if (error) {
        setVerifyError(error.message);
        return;
      }

      const params = new URLSearchParams();
      if (state?.invite) params.set("invite", state.invite);
      if (state?.next && state.next.startsWith("/") && !state.next.startsWith("//")) {
        params.set("next", state.next);
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
            <span className="font-medium text-[var(--mk-primary-dark)]">{state.email}</span>
          </p>
        </div>
        <div className="space-y-1.5">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="00000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={8}
            className="h-11 text-center text-lg font-semibold tracking-[0.3em] placeholder:tracking-[0.3em]"
          />
        </div>
        {verifyError ? <p className="text-sm text-destructive">{verifyError}</p> : null}
        {state?.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
        <Button
          type="button"
          className="w-full"
          disabled={code.length < 6 || code.length > 8 || verifying}
          onClick={handleVerify}
        >
          {verifying ? "Verifying..." : "Verify"}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <form action={formAction} onSubmit={handleResend}>
            <input type="hidden" name="invite" value={inviteToken} />
            <input type="hidden" name="next" value={nextPath ?? ""} />
            <button
              type="submit"
              className="text-[var(--mk-primary)] hover:underline"
              disabled={pending}
            >
              {pending ? "Sending..." : "Resend code"}
            </button>
          </form>
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
