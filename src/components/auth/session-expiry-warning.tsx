"use client";

import { useSessionActivity } from "@/components/auth/session-activity-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SessionExpiryWarning() {
  const { showWarning, timeRemaining, staySignedIn, signOut } = useSessionActivity();

  return (
    <Dialog
      open={showWarning}
      // Prevent closing — user must explicitly choose Stay or Sign Out
      onOpenChange={() => {}}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Session Expiring Soon</DialogTitle>
          <DialogDescription>
            Your session will expire due to inactivity.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 text-center">
          <p className="text-sm text-muted-foreground">Time remaining</p>
          <p
            className="font-mono text-4xl font-semibold tabular-nums"
            style={{ color: "var(--primary)" }}
          >
            {formatCountdown(timeRemaining)}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={signOut}>
            Sign Out
          </Button>
          <Button
            onClick={staySignedIn}
            style={{ backgroundColor: "var(--primary)" }}
          >
            Stay Signed In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
