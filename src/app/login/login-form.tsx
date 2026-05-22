"use client";

import { useActionState, useEffect, useRef } from "react";
import { requestStaffOtp, verifyStaffOtp } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [requestState, requestAction, requestPending] = useActionState(
    requestStaffOtp,
    undefined,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyStaffOtp,
    undefined,
  );

  const email = verifyState?.email ?? requestState?.email ?? initialEmail ?? "";
  const resolvedNextPath =
    verifyState?.next ?? requestState?.next ?? nextPath;
  const isCodeStep =
    verifyState?.step === "code" ||
    requestState?.step === "code" ||
    (initialStep === "code" && Boolean(email));
  const verifyError = verifyState?.error ?? null;
  const requestError = requestState?.error ?? null;
  const successMessage =
    requestState?.success ??
    (isCodeStep
      ? "If that email has staff access, we've sent a sign-in code. Check your inbox."
      : null);

  const verifyFormRef = useRef<HTMLFormElement>(null);
  const autoSubmittedCodeRef = useRef<string | null>(null);

  // Cross-surface redirect after request — keeps the request flow working
  // when the user lands on the wrong surface for their workspace.
  useEffect(() => {
    if (!requestState?.redirectTo) return;
    window.location.replace(requestState.redirectTo);
  }, [requestState?.redirectTo]);

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
        <form ref={verifyFormRef} action={verifyAction} className="space-y-4">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={resolvedNextPath ?? ""} />
          <div className="space-y-1.5">
            <Input
              name="code"
              defaultValue=""
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              required
              pattern="\d{6}"
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (
                  /^\d{6}$/.test(value) &&
                  !verifyPending &&
                  autoSubmittedCodeRef.current !== value
                ) {
                  autoSubmittedCodeRef.current = value;
                  verifyFormRef.current?.requestSubmit();
                }
              }}
              className="h-11 rounded-xl border-[rgba(30,74,62,0.18)] bg-white/88 px-4 text-center text-lg font-semibold tracking-[0.3em] shadow-none placeholder:text-[var(--mk-text-muted)]/60 placeholder:tracking-[0.3em] focus-visible:border-[var(--mk-accent)] focus-visible:ring-[var(--mk-accent)]/30"
            />
          </div>
          {verifyError ? (
            <p className="text-sm text-destructive">{verifyError}</p>
          ) : null}
          {!verifyError && successMessage ? (
            <p className="text-sm text-[var(--mk-primary)]">{successMessage}</p>
          ) : null}
          <Button
            type="submit"
            className="h-11 w-full rounded-xl bg-[var(--mk-primary-dark)] text-white hover:bg-[var(--mk-primary)]"
            disabled={verifyPending}
          >
            {verifyPending ? "Verifying..." : "Verify"}
          </Button>
        </form>
        <div className="mt-4 flex items-center justify-between text-sm">
          <form action={requestAction}>
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="next" value={resolvedNextPath ?? ""} />
            <button
              type="submit"
              className="text-[var(--mk-primary)] hover:underline"
              disabled={requestPending}
            >
              {requestPending ? "Sending..." : "Resend code"}
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
        {requestError ? (
          <p className="mt-3 text-sm text-destructive">{requestError}</p>
        ) : null}
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
      <form action={requestAction} className="space-y-4">
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
          {requestState?.fields?.email?.length ? (
            <p className="text-sm text-destructive">{requestState.fields.email[0]}</p>
          ) : null}
        </div>
        {requestState?.error ? (
          <p className="text-sm text-destructive">{requestState.error}</p>
        ) : null}
        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-[var(--mk-primary-dark)] text-white hover:bg-[var(--mk-primary)]"
          disabled={requestPending}
        >
          {requestPending ? "Sending code..." : "Send sign-in code"}
        </Button>
      </form>
    </div>
  );
}
