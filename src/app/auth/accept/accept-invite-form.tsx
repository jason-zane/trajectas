"use client";

import { useActionState, useEffect } from "react";
import { requestInviteOtp, verifyInviteOtp } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [requestState, requestAction, requestPending] = useActionState(
    requestInviteOtp,
    undefined,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyInviteOtp,
    undefined,
  );

  // The displayed email comes from the server state — the verify action
  // does not trust a hidden email input and re-derives it from the invite
  // token on every submission. We only show the email here as a hint.
  const email = verifyState?.email ?? requestState?.email ?? initialEmail ?? "";
  const invite = verifyState?.invite ?? requestState?.invite ?? inviteToken;
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
    (isCodeStep && email
      ? `We've sent a sign-in code to ${email}. Enter the code to accept the invite.`
      : null);

  useEffect(() => {
    if (!requestState?.redirectTo) return;
    window.location.replace(requestState.redirectTo);
  }, [requestState?.redirectTo]);

  if (isCodeStep) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-[var(--mk-text-muted)]">
            Enter the code sent to{" "}
            <span className="font-medium text-[var(--mk-primary-dark)]">{email}</span>
          </p>
        </div>
        <form action={verifyAction} className="space-y-4">
          <input type="hidden" name="invite" value={invite} />
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
              className="h-11 text-center text-lg font-semibold tracking-[0.3em] placeholder:tracking-[0.3em]"
            />
          </div>
          {verifyError ? (
            <p className="text-sm text-destructive">{verifyError}</p>
          ) : null}
          {!verifyError && successMessage ? (
            <p className="text-sm text-emerald-700">{successMessage}</p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            disabled={verifyPending}
          >
            {verifyPending ? "Verifying..." : "Verify"}
          </Button>
        </form>
        <div className="flex items-center justify-between text-sm">
          <form action={requestAction}>
            <input type="hidden" name="invite" value={invite} />
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
            onClick={() => window.location.replace(buildAcceptInviteUrl(inviteToken, nextPath))}
          >
            Start over
          </button>
        </div>
        {requestError ? (
          <p className="text-sm text-destructive">{requestError}</p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={requestAction} className="space-y-4">
      <input type="hidden" name="invite" value={inviteToken} />
      <input type="hidden" name="next" value={nextPath ?? ""} />
      {requestState?.error ? (
        <p className="text-sm text-destructive">{requestState.error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={requestPending}>
        {requestPending ? "Sending code..." : "Send sign-in code"}
      </Button>
    </form>
  );
}
