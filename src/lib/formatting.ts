/**
 * Shared formatting utilities for dates, times, and status badges.
 *
 * This module consolidates formatting helpers that were previously defined
 * locally across the codebase. All exports are locale-aware (en-AU) with
 * consistent null/undefined handling.
 */

/**
 * Format a date value to "DD MMM YYYY" (e.g., "15 Jun 2026").
 * Returns fallback string if value is falsy (default: "Not scheduled").
 * Pass fallback="" or "—" for table contexts.
 * Used for scheduling endpoints and status displays.
 */
export function formatDate(value?: string | null, fallback = "Not scheduled"): string {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

/**
 * Format a date value to "DD MMM YYYY" (e.g., "15 Jun 2026").
 * Returns null if value is falsy (used for optional timestamps in server components).
 */
export function formatDateOrNull(value?: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

/**
 * Format a date value to "DD MMM YYYY – HH:MM" (e.g., "15 Jun 2026 – 14:30").
 * Returns fallback if value is falsy (default: "Not set"). Used for
 * created/updated timestamps.
 */
export function formatDateTime(value?: string | null, fallback = "Not set"): string {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * Format a date value with medium style (e.g., "Jun 15, 2026, 2:30 PM").
 * Returns "Not set" if value is falsy. Used for audit trails and user timestamps.
 */
export function formatDateTimeMedium(value?: string | null): string {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Format a date value to "DD MMM YYYY" with full weekday.
 * Returns null if value is falsy. Used for email templates and rich displays.
 */
export function formatDateLong(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a date range using opensAt and closesAt fields.
 * Returns "—" if both are null. Handles three cases:
 * - Both set: "DD MMM – DD MMM"
 * - opensAt only: "Opens DD MMM"
 * - closesAt only: "Closes DD MMM"
 */
export function formatDateRange(opensAt?: string | null, closesAt?: string | null): string {
  if (!opensAt && !closesAt) {
    return "—";
  }

  const fmt = (value: string) =>
    new Date(value).toLocaleDateString("en-AU", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  if (opensAt && closesAt) {
    return `${fmt(opensAt)} – ${fmt(closesAt)}`;
  }

  if (opensAt) {
    return `Opens ${fmt(opensAt)}`;
  }

  return `Closes ${fmt(closesAt!)}`;
}

/**
 * Format a date as relative time ("just now", "5m ago", "2h ago", "3d ago")
 * falling back to full date for older entries.
 * Used for "last activity" columns in tables.
 */
export function formatRelativeDate(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a date value as relative time or full date + time in a tooltip.
 * Used in conjunction with formatDateTime for rich timestamp displays.
 * Returns object with relative and full datetime representations.
 */
export function formatDateForTooltip(value: string): { relative: string; full: string } {
  return {
    relative: formatRelativeDate(value),
    full: formatDateTime(value),
  };
}

/**
 * Format relative time including days, hours, and minutes.
 * Negative values represent future dates ("in 2d").
 * Used for "created" and "revoked" timestamps in user tables.
 */
export function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffDays = Math.round(diffMs / 86_400_000);

  if (diffDays === 0) {
    const diffHours = Math.round(diffMs / 3_600_000);
    if (Math.abs(diffHours) < 1) return "just now";
    return diffHours > 0 ? `${diffHours}h ago` : `in ${Math.abs(diffHours)}h`;
  }

  if (Math.abs(diffDays) < 7) {
    return diffDays > 0 ? `${diffDays}d ago` : `in ${Math.abs(diffDays)}d`;
  }

  return formatDateTime(dateString);
}

/**
 * Get the Badge variant for a campaign/assessment/session status.
 * Maps status strings to Badge variant types (default, secondary, outline, destructive).
 * Covers campaign_status, assessment_status, participant_session_status values.
 */
export function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
    case "completed":
      return "default";
    case "draft":
    case "pending":
      return "secondary";
    case "paused":
    case "archived":
    case "closed":
      return "outline";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

/**
 * Format expiry status for invites: "Expires in X days" or "Expired X days ago".
 * Used in invite detail pages and pending invite tables.
 */
export function formatExpiryStatus(expiresAt: string): string {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const diffMs = expiry - now;
  const diffDays = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24));

  if (diffMs >= 0) {
    if (diffDays <= 1) return "Expires within 1 day";
    return `Expires in ${diffDays} days`;
  }

  if (diffDays <= 1) return "Expired within 1 day";
  return `Expired ${diffDays} days ago`;
}
