"use client";

import { useActionState } from "react";
import { requestStaffMagicLink } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, formAction, pending] = useActionState(requestStaffMagicLink, undefined);

  return (
    <div className="px-6 py-8 sm:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--mk-primary-dark)]">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-[var(--mk-text-muted)]">
          Enter your email to receive a sign-in link.
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
        {state?.success ? (
          <p className="text-sm text-[var(--mk-primary)]">{state.success}</p>
        ) : null}
        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-[var(--mk-primary-dark)] text-white hover:bg-[var(--mk-primary)]"
          disabled={pending}
        >
          {pending ? "Sending link..." : "Send sign-in link"}
        </Button>
      </form>
    </div>
  );
}
