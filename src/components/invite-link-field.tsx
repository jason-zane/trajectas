"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * A read-only invite link with a one-click copy button. Copying runs in the
 * click handler (a direct user gesture) so it works across browsers; if the
 * clipboard API is unavailable, the field is pre-selectable for manual copy.
 */
export function InviteLinkField({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(
        "Couldn't copy automatically — select the link and copy it manually."
      );
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        readOnly
        value={link}
        onFocus={(event) => event.currentTarget.select()}
        className="font-mono text-xs"
        aria-label="Invite link"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleCopy}
        aria-label="Copy invite link"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}
