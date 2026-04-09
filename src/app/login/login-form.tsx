"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { requestStaffOtp } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

function buildLoginUrl(nextPath?: string) {
  const params = new URLSearchParams();
  if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
    params.set("next", nextPath);
  }

  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

export function LoginForm({
  nextPath,
  initialEmail,
  initialStep = "email",
}: {
  nextPath?: string;
  initialEmail?: string;
  initialStep?: "email" | "code";
}) {
  const [state, formAction, pending] = useActionState(requestStaffOtp, undefined);
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, startVerify] = useTransition();

  const email = state?.email ?? initialEmail ?? "";
  const resolvedNextPath = state?.next ?? nextPath;
  const isCodeStep =
    state?.step === "code" || (initialStep === "code" && Boolean(email));

  useEffect(() => {
    if (!state?.redirectTo) return;
    window.location.replace(state.redirectTo);
  }, [state?.redirectTo]);

  function handleVerify() {
    if (!email) {
      setVerifyError("Enter your email again and request a fresh sign-in code.");
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
      <div className="px-6 py-8 sm:px-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--mk-primary-dark)]">
            Check your email
          </h1>
          <p className="mt-1 text-sm text-[var(--mk-text-muted)]">
            Enter the code sent to{" "}
            <span className="font-medium text-[var(--mk-primary-dark)]">{email}</span>
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              className="h-11 rounded-xl border-[rgba(30,74,62,0.18)] bg-white/88 px-4 text-center text-lg font-semibold tracking-[0.3em] shadow-none placeholder:text-[var(--mk-text-muted)]/60 placeholder:tracking-[0.3em] focus-visible:border-[var(--mk-accent)] focus-visible:ring-[var(--mk-accent)]/30"
            />
          </div>
          {verifyError ? <p className="text-sm text-destructive">{verifyError}</p> : null}
          {state?.success ? (
            <p className="text-sm text-[var(--mk-primary)]">{state.success}</p>
          ) : null}
          <Button
            type="button"
            className="h-11 w-full rounded-xl bg-[var(--mk-primary-dark)] text-white hover:bg-[var(--mk-primary)]"
            disabled={code.length < 6 || verifying}
            onClick={handleVerify}
          >
            {verifying ? "Verifying..." : "Verify"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <form action={formAction} onSubmit={handleResend}>
              <input type="hidden" name="email" value={email} />
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
              onClick={() => window.location.replace(buildLoginUrl(nextPath))}
            >
              Use different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 sm:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--mk-primary-dark)]">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-[var(--mk-text-muted)]">
          Enter your email to receive a sign-in code.
        </p>
      </div>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={nextPath ?? ""} />
        <div className="space-y-1.5">
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            className="h-11 rounded-xl border-[rgba(30,74,62,0.18)] bg-white/88 px-4 shadow-none placeholder:text-[var(--mk-text-muted)]/60 focus-visible:border-[var(--mk-accent)] focus-visible:ring-[var(--mk-accent)]/30"
            required
          />
          {state?.fields?.email?.length ? (
            <p className="text-sm text-destructive">{state.fields.email[0]}</p>
          ) : null}
        </div>
        {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-[var(--mk-primary-dark)] text-white hover:bg-[var(--mk-primary)]"
          disabled={pending}
        >
          {pending ? "Sending code..." : "Send sign-in code"}
        </Button>
      </form>
    </div>
  );
}
