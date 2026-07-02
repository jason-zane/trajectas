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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 animate-in fade-in duration-300"
      style={{ background: "var(--runner-ink)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2">
        {brandLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- brand logo URLs are runtime-configured
          <img
            src={brandLogoUrl}
            alt={brandName ?? "Logo"}
            className="h-6 w-auto object-contain"
          />
        ) : (
          <>
            <div
              className="flex size-6 items-center justify-center rounded-lg"
              style={{
                background: "var(--runner-ghost-fill)",
              }}
            >
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--runner-accent)" }}
              >
                <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--runner-text)" }}
            >
              {brandName ?? "Trajectas"}
            </span>
          </>
        )}
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
