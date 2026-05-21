/**
 * Render an audit_events row into a human-readable title + optional detail.
 * Used by /users/[id] activity card and /settings/audit feed.
 *
 * Add new event types here as they're introduced. Unknown types fall back
 * to a verbatim event_type display — annoying but never misleading.
 */

export interface FormatAuditEventInput {
  eventType: string
  metadata: Record<string, unknown> | null
}

export interface FormattedAuditEvent {
  title: string
  detail: string | null
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function asBool(value: unknown): boolean {
  return value === true
}

const FORMATTERS: Record<string, (m: Record<string, unknown> | null) => FormattedAuditEvent> = {
  "staff_user.otp_resent": (m) => ({
    title: "Sign-in code sent",
    detail: asString(m?.email),
  }),
  "staff_user.force_signed_out": (m) => ({
    title: "All sessions revoked",
    detail: asString(m?.email),
  }),
  "staff_user.role_changed": (m) => {
    const from = asString(m?.previous_role) ?? asString(m?.from)
    const to = asString(m?.new_role) ?? asString(m?.to)
    return {
      title: "Role changed",
      detail: from && to ? `${from} → ${to}` : null,
    }
  },
  "staff_user.active_state_changed": (m) => ({
    title: m?.is_active === true ? "Account activated" : "Account deactivated",
    detail: asBool(m?.bulk) ? "Bulk action" : null,
  }),
  "staff_user.deletion_scheduled": (m) => ({
    title: "Account deletion scheduled",
    detail: asString(m?.scheduled_for)
      ? `Sweeps on ${new Date(String(m?.scheduled_for)).toLocaleDateString()}`
      : null,
  }),
  "staff_user.deletion_cancelled": () => ({
    title: "Pending deletion cancelled",
    detail: null,
  }),
  "staff_user.deleted": () => ({
    title: "Account deleted",
    detail: null,
  }),
  "staff_invite.created": (m) => ({
    title: "Invite created",
    detail: asString(m?.email),
  }),
  "staff_invite.resent": (m) => ({
    title: "Invite resent",
    detail: asString(m?.email),
  }),
  "staff_invite.revoked": (m) => ({
    title: "Invite revoked",
    detail: asString(m?.email),
  }),
  "partner_membership.created": (m) => ({
    title: "Partner membership added",
    detail: asString(m?.partner_name) ?? asString(m?.partner_id),
  }),
  "partner_membership.role_changed": (m) => ({
    title: "Partner role changed",
    detail: asString(m?.partner_name),
  }),
  "partner_membership.revoked": (m) => ({
    title: "Partner membership revoked",
    detail: asString(m?.partner_name),
  }),
  "client_membership.created": (m) => ({
    title: "Client membership added",
    detail: asString(m?.client_name) ?? asString(m?.client_id),
  }),
  "client_membership.role_changed": (m) => ({
    title: "Client role changed",
    detail: asString(m?.client_name),
  }),
  "client_membership.revoked": (m) => ({
    title: "Client membership revoked",
    detail: asString(m?.client_name),
  }),
  "participant_session.reset_by_admin": () => ({
    title: "Session processing state reset",
    detail: null,
  }),
  "support_session.started": () => ({
    title: "Support session started",
    detail: null,
  }),
  "support_session.data_accessed": () => ({
    title: "Support session — data accessed",
    detail: null,
  }),
}

export function formatAuditEvent(input: FormatAuditEventInput): FormattedAuditEvent {
  const formatter = FORMATTERS[input.eventType]
  if (formatter) return formatter(input.metadata)
  return { title: input.eventType, detail: null }
}
