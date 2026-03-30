import crypto from "crypto";
import type {
  AuditEventInput,
  SupportSessionInput,
  SupportSessionRecord,
} from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

function mapSupportSession(row: Record<string, unknown>): SupportSessionRecord {
  const targetSurface = row.target_surface as SupportSessionRecord["targetSurface"];
  const targetTenantId =
    targetSurface === "partner"
      ? String(row.partner_id)
      : String(row.organization_id);

  return {
    id: String(row.id),
    actorProfileId: String(row.actor_profile_id),
    targetSurface,
    targetTenantId,
    reason: String(row.reason),
    sessionKey: String(row.session_key),
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    endedAt: row.ended_at ? String(row.ended_at) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

export async function getActiveSupportSessionByKey(input: {
  supportSessionId: string;
  sessionKey: string;
  targetSurface: SupportSessionRecord["targetSurface"];
}): Promise<SupportSessionRecord | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("support_sessions")
    .select("*")
    .eq("id", input.supportSessionId)
    .eq("session_key", input.sessionKey)
    .eq("target_surface", input.targetSurface)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  return mapSupportSession(data as Record<string, unknown>);
}

export async function logAuditEvent(input: AuditEventInput) {
  const db = createAdminClient();
  const { error } = await db.from("audit_events").insert({
    actor_profile_id: input.actorProfileId ?? null,
    event_type: input.eventType,
    target_table: input.targetTable ?? null,
    target_id: input.targetId ?? null,
    partner_id: input.partnerId ?? null,
    organization_id: input.clientId ?? null,
    support_session_id: input.supportSessionId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function startSupportSession(
  input: SupportSessionInput
): Promise<SupportSessionRecord> {
  if (!input.reason.trim()) {
    throw new Error("Support sessions require a reason.");
  }

  const db = createAdminClient();
  const sessionKey = crypto.randomUUID();
  const expiresAt =
    input.expiresAt ??
    new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const insert =
    input.targetSurface === "partner"
      ? {
          actor_profile_id: input.actorProfileId,
          target_surface: input.targetSurface,
          partner_id: input.targetTenantId,
          organization_id: null,
          reason: input.reason,
          session_key: sessionKey,
          expires_at: expiresAt,
          metadata: input.metadata ?? {},
        }
      : {
          actor_profile_id: input.actorProfileId,
          target_surface: input.targetSurface,
          partner_id: null,
          organization_id: input.targetTenantId,
          reason: input.reason,
          session_key: sessionKey,
          expires_at: expiresAt,
          metadata: input.metadata ?? {},
        };

  const { data, error } = await db
    .from("support_sessions")
    .insert(insert)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create support session.");
  }

  await logAuditEvent({
    actorProfileId: input.actorProfileId,
    eventType: "support_session.started",
    targetTable: input.targetSurface === "partner" ? "partners" : "organizations",
    targetId: input.targetTenantId,
    partnerId: input.targetSurface === "partner" ? input.targetTenantId : null,
    clientId: input.targetSurface === "client" ? input.targetTenantId : null,
    metadata: {
      reason: input.reason,
      sessionKey,
      targetSurface: input.targetSurface,
    },
    supportSessionId: String(data.id),
  });

  return mapSupportSession(data as Record<string, unknown>);
}
