import crypto from "crypto";
import type { AuthorizedScope } from "@/lib/auth/authorization";
import type {
  AuditEventInput,
  SupportSessionInput,
  SupportSessionRecord,
} from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

const SUPPORT_SESSION_ACCESS_DEBOUNCE_MS = 30_000;

type SupportSessionAccessStore = Map<string, number>;

function getSupportSessionAccessStore() {
  const globalStore = globalThis as typeof globalThis & {
    __talentFitSupportSessionAccessStore?: SupportSessionAccessStore;
  };

  if (!globalStore.__talentFitSupportSessionAccessStore) {
    globalStore.__talentFitSupportSessionAccessStore = new Map();
  }

  return globalStore.__talentFitSupportSessionAccessStore;
}

function mapSupportSession(row: Record<string, unknown>): SupportSessionRecord {
  const targetSurface = row.target_surface as SupportSessionRecord["targetSurface"];
  const targetTenantId =
    targetSurface === "partner"
      ? String(row.partner_id)
      : String(row.client_id);

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
    client_id: input.clientId ?? null,
    support_session_id: input.supportSessionId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function logReportViewed(input: {
  actorProfileId?: string | null;
  snapshotId: string;
  participantId?: string | null;
  audienceType: string;
  partnerId?: string | null;
  clientId?: string | null;
  supportSessionId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await logAuditEvent({
    actorProfileId: input.actorProfileId ?? null,
    eventType: "report.viewed",
    targetTable: "report_snapshots",
    targetId: input.snapshotId,
    partnerId: input.partnerId ?? null,
    clientId: input.clientId ?? null,
    supportSessionId: input.supportSessionId ?? null,
    metadata: {
      participantId: input.participantId ?? null,
      audienceType: input.audienceType,
      ...(input.metadata ?? {}),
    },
  });
}

export async function logSupportSessionDataAccess(input: {
  scope: Pick<AuthorizedScope, "actor" | "supportSession">;
  resourceType: string;
  resourceId: string;
  partnerId?: string | null;
  clientId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!input.scope.supportSession) {
    return;
  }

  const store = getSupportSessionAccessStore();
  const storeKey = [
    input.scope.supportSession.id,
    input.resourceType,
    input.resourceId,
  ].join(":");
  const now = Date.now();
  const lastLoggedAt = store.get(storeKey) ?? 0;

  if (now - lastLoggedAt < SUPPORT_SESSION_ACCESS_DEBOUNCE_MS) {
    return;
  }

  store.set(storeKey, now);

  if (store.size > 512) {
    const cutoff = now - SUPPORT_SESSION_ACCESS_DEBOUNCE_MS;
    for (const [key, timestamp] of store.entries()) {
      if (timestamp < cutoff) {
        store.delete(key);
      }
    }
  }

  await logAuditEvent({
    actorProfileId: input.scope.actor?.id ?? null,
    eventType: "support_session.data_accessed",
    targetTable: input.resourceType,
    targetId: input.resourceId,
    partnerId: input.partnerId ?? null,
    clientId: input.clientId ?? null,
    supportSessionId: input.scope.supportSession.id,
    metadata: input.metadata ?? {},
  });
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
          client_id: null,
          reason: input.reason,
          session_key: sessionKey,
          expires_at: expiresAt,
          metadata: input.metadata ?? {},
        }
      : {
          actor_profile_id: input.actorProfileId,
          target_surface: input.targetSurface,
          partner_id: null,
          client_id: input.targetTenantId,
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
    targetTable: input.targetSurface === "partner" ? "partners" : "clients",
    targetId: input.targetTenantId,
    partnerId: input.targetSurface === "partner" ? input.targetTenantId : null,
    clientId: input.targetSurface === "client" ? input.targetTenantId : null,
    metadata: {
      reason: input.reason,
      targetSurface: input.targetSurface,
    },
    supportSessionId: String(data.id),
  });

  return mapSupportSession(data as Record<string, unknown>);
}
