"use client";

import { useSessionActivity } from "@/components/auth/session-activity-provider";
import {
  ActionDialog,
  ActionDialogBody,
  ActionDialogFooter,
} from "@/components/action-dialog";
import { Button } from "@/components/ui/button";

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SessionExpiryWarning() {
  const { showWarning, timeRemaining, staySignedIn, signOut } = useSessionActivity();

  return (
    <ActionDialog
      open={showWarning}
      onOpenChange={() => {}}
      showCloseButton={false}
      eyebrow="Session"
      title="Session expiring soon"
      description="Your session will expire due to inactivity."
    >
      <ActionDialogBody>
        <div className="py-2 text-center">
          <p className="text-sm text-muted-foreground">Time remaining</p>
          <p className="font-mono text-5xl font-semibold tabular-nums text-primary">
            {formatCountdown(timeRemaining)}
          </p>
        </div>
      </ActionDialogBody>
      <ActionDialogFooter>
        <Button variant="ghost" onClick={signOut}>
          Sign out
        </Button>
        <Button onClick={staySignedIn}>Stay signed in</Button>
      </ActionDialogFooter>
    </ActionDialog>
  );
}
