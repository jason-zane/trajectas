"use client";

import { BrandLogo } from "@/components/brand/brand-logo";

interface SavingOverlayProps {
  message: string;
  brandLogoUrl?: string;
  brandName?: string;
}

export function SavingOverlay({
  message,
  brandLogoUrl,
  brandName,
}: SavingOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 animate-in fade-in duration-300"
      style={{ background: "var(--runner-ink)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2">
        <BrandLogo name={brandName} logoUrl={brandLogoUrl} height={28} light />
      </div>

      {/* Spinner */}
      <div
        className="size-10 rounded-full border-[2px] animate-spin"
        style={{
          borderColor: "var(--runner-ghost-border)",
          borderTopColor: "var(--runner-accent)",
        }}
      />

      {/* Message */}
      <p
        className="text-xs font-normal"
        style={{
          color: "var(--runner-text-muted)",
        }}
      >
        {message}
      </p>
    </div>
  );
}
