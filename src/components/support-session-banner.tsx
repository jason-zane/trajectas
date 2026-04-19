"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";

type SupportSessionBannerProps = {
  sessionId: string;
  tenantName: string;
  tenantType: "client" | "partner";
  actorName: string;
  returnUrl: string;
};

export function SupportSessionBanner({
  sessionId,
  tenantName,
  tenantType,
  actorName,
  returnUrl,
}: SupportSessionBannerProps) {
  const [isEnding, setIsEnding] = useState(false);

  async function handleReturn() {
    setIsEnding(true);
    // Navigate back to admin with full page reload to clear portal context.
    // The session ending is handled by the admin surface on arrival.
    window.location.href = returnUrl;
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2 text-amber-900">
          <AlertCircle className="size-4 shrink-0" />
          <span data-support-session-id={sessionId}>
            Support session active — viewing <strong>{tenantName}</strong> as{" "}
            <strong>{actorName}</strong> in the{" "}
            <strong>{tenantType}</strong> workspace
          </span>
        </div>
        <button
          onClick={handleReturn}
          disabled={isEnding}
          className="text-amber-900 underline hover:no-underline font-medium disabled:opacity-50"
        >
          {isEnding ? "Ending session..." : "Return to admin"}
        </button>
      </div>
    </div>
  );
}
