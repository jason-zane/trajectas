"use client";

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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 animate-in fade-in duration-300"
      style={{ background: "var(--brand-neutral-50, hsl(var(--background)))" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        {brandLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- brand logo URLs are runtime-configured
          <img
            src={brandLogoUrl}
            alt={brandName ?? "Logo"}
            className="h-7 w-auto object-contain"
          />
        ) : (
          <>
            <div
              className="flex size-7 items-center justify-center rounded-lg"
              style={{
                background: "var(--brand-surface, hsl(var(--primary) / 0.1))",
              }}
            >
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--brand-primary, hsl(var(--primary)))" }}
              >
                <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <span
              className="text-sm font-semibold tracking-tight"
              style={{ color: "var(--brand-text, hsl(var(--foreground)))" }}
            >
              {brandName ?? "Trajectas"}
            </span>
          </>
        )}
      </div>

      {/* Spinner */}
      <div
        className="size-12 rounded-full border-[3px] animate-spin"
        style={{
          borderColor: "var(--brand-primary, hsl(var(--primary)))",
          borderTopColor: "transparent",
        }}
      />

      {/* Message */}
      <p
        className="text-sm font-medium tracking-wide"
        style={{
          color: "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
        }}
      >
        {message}
      </p>
    </div>
  );
}
