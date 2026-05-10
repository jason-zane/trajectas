"use client";

import Link from "next/link";
import { Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { buildCampaignAccessLinkUrl } from "@/lib/campaign-access-links";
import { cn } from "@/lib/utils";

interface CopyCampaignLinkButtonProps {
  token?: string | null;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  label?: string;
  disabledLabel?: string;
  className?: string;
  createHref?: string;
}

export function CopyCampaignLinkButton({
  token,
  variant = "outline",
  size = "sm",
  label = "Copy link",
  disabledLabel = "Create link",
  className,
  createHref,
}: CopyCampaignLinkButtonProps) {
  async function handleCopy() {
    if (!token || typeof window === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        buildCampaignAccessLinkUrl(token, window.location.origin),
      );
      toast.success("Campaign link copied");
    } catch {
      toast.error("Unable to copy campaign link");
    }
  }

  if (!token && createHref) {
    return (
      <Link
        href={createHref}
        className={cn(buttonVariants({ variant, size }), className)}
        title={disabledLabel}
      >
        <Link2 className="size-4" />
        {disabledLabel}
      </Link>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={!token}
      onClick={handleCopy}
      title={token ? label : disabledLabel}
    >
      <Link2 className="size-4" />
      {token ? label : disabledLabel}
    </Button>
  );
}
