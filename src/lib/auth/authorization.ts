import { cache } from "react";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inferSurfaceFromRequest,
  isLocalDevelopmentHost,
} from "@/lib/hosts";
import {
  resolveSessionActor,
  resolveSignedPreviewContext,
} from "@/lib/auth/actor";
import { isSurface, type Surface } from "@/lib/surfaces";
import type {
  ActiveContext,
  PreviewContext,
  ResolvedActor,
  SupportSessionRecord,
} from "@/lib/auth/types";

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class AuthenticationRequiredError extends Error {
  constructor(message = "Authentication is required for this action.") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export interface AuthorizedScope {
  actor: ResolvedActor | null;
  activeContext: ActiveContext | null;
  previewContext: PreviewContext | null;
  requestSurface: Surface;
  isPlatformAdmin: boolean;
  isLocalDevelopmentBypass: boolean;
  partnerIds: string[];
  partnerAdminIds: string[];
  clientIds: string[];
  clientAdminIds: string[];
  supportSession: SupportSessionRecord | null;
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
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

async function getRequestEnvironment() {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const surfaceHeader = headerStore.get("x-trajectas-surface");
  const routePrefix = headerStore.get("x-trajectas-route-prefix");

  // Always use host + pathname-based surface detection. The
  // x-trajectas-surface header is only used as a last-resort fallback
  // in local development to prevent header-spoofing attacks in production.
  const hostBasedSurface = inferSurfaceFromRequest({
    host,
    pathname: routePrefix && routePrefix !== "/" ? routePrefix : undefined,
  });
  const isLocal = isLocalDevelopmentHost(host);

  return {
    host,
    isLocalDevelopment: isLocal,
    requestSurface:
      isLocal && isSurface(surfaceHeader)
        ? surfaceHeader
        : hostBasedSurface,
  };
}

async function loadClientPartnerMap(partnerIds: string[]) {
  if (partnerIds.length === 0) {
    return new Map<string, string>();
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("clients")
    .select("id, partner_id")
    .in("partner_id", partnerIds)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(String(row.id), String(row.partner_id));
  }
  return map;
}

async function loadAllPartnerIds() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("partners")
    .select("id")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => String(row.id));
}

async function loadAllClientRows() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("clients")
    .select("id, partner_id")
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function getValidatedSupportSession(
  actor: ResolvedActor,
  activeContext: ActiveContext | null
) {
  if (
    actor.role !== "platform_admin" ||
    !activeContext?.supportSessionId ||
    !activeContext.tenantType ||
    !activeContext.tenantId
  ) {
    return null;
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("support_sessions")
    .select("*")
    .eq("id", activeContext.supportSessionId)
    .eq("actor_profile_id", actor.id)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  const session = mapSupportSession(data as Record<string, unknown>);

  if (
    session.targetSurface !== activeContext.surface ||
    session.targetSurface !== activeContext.tenantType ||
    session.targetTenantId !== activeContext.tenantId
  ) {
    return null;
  }

  return session;
}

function getPreviewPartnerIdsFromClients(
  clientRows: { id: string; partner_id: string | null }[]
) {
  return dedupe(
    clientRows
      .map((row) => (row.partner_id ? String(row.partner_id) : ""))
      .filter(Boolean)
  );
}

function getEffectivePreviewContext(
  previewContext: PreviewContext | null,
  requestSurface: Surface
) {
  if (!previewContext) {
    return null;
  }

  return previewContext.surface === requestSurface ? previewContext : null;
}

async function resolveAuthorizedScopeImpl(): Promise<AuthorizedScope> {
  const requestEnvironment = await getRequestEnvironment();
  const actor = await resolveSessionActor();
  const localDevBypass =
    !actor &&
    requestEnvironment.isLocalDevelopment &&
    process.env.NODE_ENV !== "production";

  if (!actor && !localDevBypass) {
    throw new AuthenticationRequiredError();
  }

  if (!actor && localDevBypass) {
    const previewContext = getEffectivePreviewContext(
      await resolveSignedPreviewContext(),
      requestEnvironment.requestSurface
    );
    const allPartners = await loadAllPartnerIds();
    const allClients = (await loadAllClientRows()).map((row) => ({
      id: String(row.id),
      partner_id: row.partner_id ? String(row.partner_id) : null,
    }));

    let partnerIds =
      requestEnvironment.requestSurface === "partner"
        ? allPartners
        : getPreviewPartnerIdsFromClients(allClients);
    let clientIds =
      requestEnvironment.requestSurface === "partner" ||
      requestEnvironment.requestSurface === "client"
        ? allClients.map((row) => row.id)
        : [];

    if (previewContext?.tenantType === "partner" && previewContext.tenantId) {
      partnerIds = [previewContext.tenantId];
      clientIds = allClients
        .filter((row) => row.partner_id === previewContext.tenantId)
        .map((row) => String(row.id));
    } else if (previewContext?.tenantType === "client" && previewContext.tenantId) {
      clientIds = [previewContext.tenantId];
      const selectedClient = allClients.find(
        (row) => row.id === previewContext.tenantId
      );
      partnerIds = selectedClient?.partner_id ? [selectedClient.partner_id] : [];
    }

    return {
      actor: null,
      activeContext: null,
      previewContext,
      requestSurface: requestEnvironment.requestSurface,
      isPlatformAdmin: requestEnvironment.requestSurface === "admin",
      isLocalDevelopmentBypass: true,
      partnerIds,
      partnerAdminIds: partnerIds,
      clientIds,
      clientAdminIds: clientIds,
      supportSession: null,
    };
  }

  if (!actor) {
    throw new AuthenticationRequiredError();
  }

  const actorIsActive = actor.isActive;
  const hasPlatformAdminRole = actorIsActive && actor.role === "platform_admin";
  const isPlatformAdmin =
    hasPlatformAdminRole && requestEnvironment.requestSurface === "admin";
  const actorPartnerIds = dedupe(
    actorIsActive
      ? actor.partnerMemberships.map((membership) => membership.partnerId)
      : []
  );
  const actorPartnerAdminIds = dedupe(
    (actorIsActive ? actor.partnerMemberships : [])
      .filter((membership) => membership.role === "admin")
      .map((membership) => membership.partnerId)
  );
  const directClientIds = dedupe(
    actorIsActive
      ? actor.clientMemberships.map((membership) => membership.clientId)
      : []
  );
  const directClientAdminIds = dedupe(
    (actorIsActive ? actor.clientMemberships : [])
      .filter((membership) => membership.role === "admin")
      .map((membership) => membership.clientId)
  );
  const clientPartnerMap = await loadClientPartnerMap(actorPartnerIds);
  const partnerClientIds = Array.from(clientPartnerMap.keys());
  const activeContext = actorIsActive ? actor.activeContext ?? null : null;
  const supportSession = actorIsActive
    ? await getValidatedSupportSession(actor, activeContext)
    : null;

  let partnerIds = actorPartnerIds;
  let partnerAdminIds = actorPartnerAdminIds;
  let clientIds = dedupe([...directClientIds, ...partnerClientIds]);
  let clientAdminIds = directClientAdminIds;

  if (supportSession) {
    if (supportSession.targetSurface === "partner") {
      partnerIds = [supportSession.targetTenantId];
      partnerAdminIds = [supportSession.targetTenantId];
      clientIds = partnerClientIds.filter(
        (clientId) => clientPartnerMap.get(clientId) === supportSession.targetTenantId
      );
      clientAdminIds = [];
    } else {
      partnerIds = [];
      partnerAdminIds = [];
      clientIds = [supportSession.targetTenantId];
      clientAdminIds = [supportSession.targetTenantId];
    }
  } else if (activeContext?.tenantType === "partner" && activeContext.tenantId) {
    if (isPlatformAdmin || actorPartnerIds.includes(activeContext.tenantId)) {
      partnerIds = [activeContext.tenantId];
      partnerAdminIds = actorPartnerAdminIds.includes(activeContext.tenantId)
        ? [activeContext.tenantId]
        : [];
      clientIds = clientIds.filter(
        (clientId) => clientPartnerMap.get(clientId) === activeContext.tenantId
      );
      clientAdminIds = clientAdminIds.filter((clientId) =>
        clientIds.includes(clientId)
      );
    }
  } else if (activeContext?.tenantType === "client" && activeContext.tenantId) {
    if (isPlatformAdmin || clientIds.includes(activeContext.tenantId)) {
      clientIds = [activeContext.tenantId];
      clientAdminIds = directClientAdminIds.includes(activeContext.tenantId)
        ? [activeContext.tenantId]
        : [];
    }
  }

  return {
    actor,
    activeContext,
    previewContext: null,
    requestSurface: requestEnvironment.requestSurface,
    isPlatformAdmin,
    isLocalDevelopmentBypass: false,
    partnerIds,
    partnerAdminIds,
    clientIds,
    clientAdminIds,
    supportSession,
  };
}

export const resolveAuthorizedScope = cache(resolveAuthorizedScopeImpl);

export function canAccessClient(scope: AuthorizedScope, clientId: string) {
  return scope.isPlatformAdmin || scope.clientIds.includes(clientId);
}

export function canManageClient(
  scope: AuthorizedScope,
  clientId: string,
  clientPartnerId?: string | null
) {
  return (
    scope.isPlatformAdmin ||
    scope.clientAdminIds.includes(clientId) ||
    (clientPartnerId != null && scope.partnerAdminIds.includes(clientPartnerId))
  );
}

export function canManagePartner(scope: AuthorizedScope, partnerId: string) {
  return scope.isPlatformAdmin || scope.partnerAdminIds.includes(partnerId);
}

export function canManageClientDirectory(scope: AuthorizedScope) {
  return scope.isPlatformAdmin || scope.partnerAdminIds.length > 0;
}

export function canManageClientAssignment(scope: AuthorizedScope) {
  return scope.isPlatformAdmin;
}

export function canAccessPartner(scope: AuthorizedScope, partnerId: string) {
  return scope.isPlatformAdmin || scope.partnerIds.includes(partnerId);
}

export function canManagePartnerDirectory(scope: AuthorizedScope) {
  return scope.isPlatformAdmin;
}

export async function requirePartnerAccess(
  partnerId: string,
  options: { includeArchived?: boolean } = {}
) {
  const scope = await resolveAuthorizedScope();
  const db = createAdminClient();
  const { data, error } = await db
    .from("partners")
    .select("id, deleted_at")
    .eq("id", partnerId)
    .single();

  if (error || !data || (!options.includeArchived && data.deleted_at)) {
    throw new AuthorizationError("Partner not found or inaccessible.");
  }

  if (!canAccessPartner(scope, String(data.id))) {
    throw new AuthorizationError("You do not have access to this partner.");
  }

  return {
    scope,
    partnerId: String(data.id),
  };
}

export async function requireClientAccess(
  clientId: string,
  options: { includeArchived?: boolean } = {}
) {
  const scope = await resolveAuthorizedScope();
  const db = createAdminClient();
  const { data, error } = await db
    .from("clients")
    .select("id, partner_id, deleted_at")
    .eq("id", clientId)
    .single();

  if (error || !data || (!options.includeArchived && data.deleted_at)) {
    throw new AuthorizationError("Client not found or inaccessible.");
  }

  const partnerId = data.partner_id ? String(data.partner_id) : null;
  const hasAccess =
    scope.isPlatformAdmin ||
    scope.clientIds.includes(String(data.id)) ||
    (partnerId ? scope.partnerIds.includes(partnerId) : false);

  if (!hasAccess) {
    throw new AuthorizationError("You do not have access to this client.");
  }

  return {
    scope,
    clientId: String(data.id),
    partnerId,
  };
}

export async function requireCampaignAccess(campaignId: string) {
  const scope = await resolveAuthorizedScope();
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaigns")
    .select("id, client_id, partner_id, deleted_at")
    .eq("id", campaignId)
    .single();

  if (error || !data || data.deleted_at) {
    throw new AuthorizationError("Campaign not found or inaccessible.");
  }

  const clientId = data.client_id ? String(data.client_id) : null;
  const partnerId = data.partner_id ? String(data.partner_id) : null;
  const hasAccess =
    scope.isPlatformAdmin ||
    (clientId ? scope.clientIds.includes(clientId) : false) ||
    (partnerId ? scope.partnerIds.includes(partnerId) : false);

  if (!hasAccess) {
    throw new AuthorizationError("You do not have access to this campaign.");
  }

  return {
    scope,
    campaignId: String(data.id),
    clientId,
    partnerId,
  };
}

export async function requireParticipantAccess(participantId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_participants")
    .select("id, campaign_id")
    .eq("id", participantId)
    .single();

  if (error || !data) {
    throw new AuthorizationError("Participant not found or inaccessible.");
  }

  const campaign = await requireCampaignAccess(String(data.campaign_id));
  return {
    ...campaign,
    participantId: String(data.id),
  };
}

export async function requireSessionAccess(sessionId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("participant_sessions")
    .select("id, campaign_participant_id")
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    throw new AuthorizationError("Session not found or inaccessible.");
  }

  const participant = await requireParticipantAccess(String(data.campaign_participant_id));
  return {
    ...participant,
    sessionId: String(data.id),
  };
}

export async function getAccessibleCampaignIds(scope: AuthorizedScope) {
  if (scope.isPlatformAdmin) {
    return null;
  }

  const db = createAdminClient();
  let query = db
    .from("campaigns")
    .select("id")
    .is("deleted_at", null);

  if (scope.clientIds.length > 0 && scope.partnerIds.length > 0) {
    query = query.or(
      `client_id.in.(${scope.clientIds.join(",")}),partner_id.in.(${scope.partnerIds.join(",")})`
    );
  } else if (scope.clientIds.length > 0) {
    query = query.in("client_id", scope.clientIds);
  } else if (scope.partnerIds.length > 0) {
    query = query.in("partner_id", scope.partnerIds);
  } else {
    return [];
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => String(row.id));
}

export function getPreferredPartnerIdForClientCreation(scope: AuthorizedScope) {
  if (scope.isPlatformAdmin) {
    return null;
  }

  if (scope.activeContext?.tenantType === "partner" && scope.activeContext.tenantId) {
    if (scope.partnerAdminIds.includes(scope.activeContext.tenantId)) {
      return scope.activeContext.tenantId;
    }
  }

  if (scope.partnerAdminIds.length === 1) {
    return scope.partnerAdminIds[0];
  }

  throw new AuthorizationError(
    "Select an active partner context before creating a client."
  );
}

export function assertAdminOnly(scope: AuthorizedScope) {
  if (!scope.isPlatformAdmin) {
    throw new AuthorizationError("This action is restricted to platform admin.");
  }
}

export async function requireAdminScope() {
  const scope = await resolveAuthorizedScope();
  assertAdminOnly(scope);
  return scope;
}
