"use client";

type LocalTimeFormat = "date" | "date-time" | "date-time-full" | "relative";

interface LocalTimeProps {
  iso?: string | null;
  format?: LocalTimeFormat;
  fallback?: string;
  className?: string;
}

function formatValue(iso: string, format: LocalTimeFormat): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";

  if (format === "relative") {
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  if (format === "date") {
    return new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  if (format === "date-time") {
    return new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  // date-time-full
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function LocalTime({
  iso,
  format = "date-time",
  fallback = "—",
  className,
}: LocalTimeProps) {
  if (!iso) {
    return <span className={className}>{fallback}</span>;
  }

  const text = formatValue(iso, format);

  return (
    <span className={className} suppressHydrationWarning>
      {text || iso}
    </span>
  );
}
