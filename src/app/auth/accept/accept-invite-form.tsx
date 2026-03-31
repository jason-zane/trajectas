"use client";

import { useActionState } from "react";
import { requestInviteMagicLink } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function AcceptInviteForm({
  inviteToken,
  nextPath,
}: {
  inviteToken: string;
  nextPath?: string;
}) {
  const [state, formAction, pending] = useActionState(requestInviteMagicLink, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="invite" value={inviteToken} />
      <input type="hidden" name="next" value={nextPath ?? ""} />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending link..." : "Send sign-in link"}
      </Button>
    </form>
  );
}
