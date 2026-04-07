"use client";

import { useActionState } from "react";
import { requestStaffMagicLink } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, formAction, pending] = useActionState(requestStaffMagicLink, undefined);

  return (
    <Card className="w-full border-transparent bg-transparent py-0 shadow-none ring-0 before:hidden">
      <CardHeader className="px-6 pt-6">
        <CardTitle className="text-2xl text-[var(--mk-primary-dark)]">
          Sign in to Trajectas
        </CardTitle>
        <CardDescription>
          Use your registered work email to receive a secure sign-in link.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={nextPath ?? ""} />
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[var(--mk-primary-dark)]">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              className="h-12 rounded-full border-[rgba(30,74,62,0.18)] bg-white/88 px-4 shadow-none placeholder:text-[var(--mk-text-muted)]/70 focus-visible:border-[var(--mk-accent)] focus-visible:ring-[var(--mk-accent)]/30"
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
            className="h-12 w-full rounded-full bg-[var(--mk-primary-dark)] text-[var(--mk-text-on-dark)] hover:bg-[var(--mk-primary)]"
            disabled={pending}
          >
            {pending ? "Sending link..." : "Email me a sign-in link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
