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
    <Card className="w-full border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle>Staff sign in</CardTitle>
        <CardDescription>
          Use your invited work email to receive a secure sign-in link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={nextPath ?? ""} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
            {state?.fields?.email?.length ? (
              <p className="text-sm text-destructive">{state.fields.email[0]}</p>
            ) : null}
          </div>
          {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state?.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending link..." : "Send sign-in link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
