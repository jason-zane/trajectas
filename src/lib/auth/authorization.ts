import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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
import {
  canViewIndividualResults,
  type CampaignConfidentialityMode,
} from "@/lib/reports/confidentiality";
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

/**
 * Render-path escape hatch: a dead/expired session during an RSC render must
 * land the user on /login (which re-runs the middleware session refresh), not
 * in the route error boundary — the boundary's retry re-renders the same
 * errored tree and can never recover. Call from `catch` blocks in page-level
 * data fetches; re-throws anything that isn't a dead-session error.
 */
export function redirectToLoginOnDeadSession(error: unknown): never {
  if (error instanceof AuthenticationRequiredError) {
    redirect("/login");
  }
  throw error;
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
  /**
   * Clients the actor may MANAGE: direct client-admin memberships plus every
   * client owned by a partner the actor administers. Narrowed by the active
   * workspace context and by support sessions exactly like `clientIds`.
   * `canManageClient` reads this — callers never reconstruct it.
   */
  managedClientIds: string[];
  /** True when the request host is localhost. Dev conveniences only. */
  isLocalDevelopment: boolean;
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

/**
 * The clients belonging to one partner.
 *
 * Needed when a platform admin steps into a partner workspace they hold no
 * membership in: `clientPartnerMap` is built from the actor's own memberships,
 * so for such an actor it is empty and narrowing to the workspace would leave
 * `clientIds` empty — i.e. "no clients" rather than "this partner's clients".
 */
async function loadPartnerClientIds(partnerId: string) {
  const map = await loadClientPartnerMap([partnerId]);
  return Array.from(map.keys());
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
  // Local-dev bypass lets an unauthenticated developer browse the app as a
  // synthetic full-access principal. Requires BOTH a local host (localhost /
  // 127.0.0.1 / 0.0.0.0) AND an explicit env opt-in, so a misconfigured
  // staging environment with NODE_ENV != 'production' can't accidentally
  // open the platform to the internet.
  const localDevBypass =
    !actor &&
    requestEnvironment.isLocalDevelopment &&
    process.env.TRAJECTAS_ALLOW_DEV_BYPASS === "1";

  if (!actor && !localDevBypass) {
    throw new AuthenticationRequiredError();
  }

  if (!actor && localDevBypass) {
    const previewContext = getEffectivePreviewContext(
      await resolveSignedPreviewContext(),
      requestEnvironment.requestSurface
    );
    let allPartners: string[] = [];
    let allClients: { id: string; partner_id: string | null }[] = [];

    try {
      const [partnerIdRows, clientRows] = await Promise.all([
        loadAllPartnerIds(),
        loadAllClientRows(),
      ]);
      allPartners = partnerIdRows;
      allClients = clientRows.map((row) => ({
        id: String(row.id),
        partner_id: row.partner_id ? String(row.partner_id) : null,
      }));
    } catch (error) {
      console.warn(
        "[authorization] Local development preview could not load workspace data:",
        error
      );
    }

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
      managedClientIds: clientIds,
      isLocalDevelopment: true,
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
  const activeContext = actorIsActive ? actor.activeContext ?? null : null;
  const [clientPartnerMap, supportSession] = await Promise.all([
    loadClientPartnerMap(actorPartnerIds),
    actorIsActive
      ? getValidatedSupportSession(actor, activeContext)
      : Promise.resolve(null),
  ]);
  const partnerClientIds = Array.from(clientPartnerMap.keys());
  // Every client owned by a partner the actor ADMINISTERS (not merely belongs to).
  const partnerManagedClientIds = Array.from(clientPartnerMap.entries())
    .filter(([, partnerId]) => actorPartnerAdminIds.includes(partnerId))
    .map(([clientId]) => clientId);

  let partnerIds = actorPartnerIds;
  let partnerAdminIds = actorPartnerAdminIds;
  let clientIds = dedupe([...directClientIds, ...partnerClientIds]);
  let clientAdminIds = directClientAdminIds;
  let managedClientIds = dedupe([...directClientAdminIds, ...partnerManagedClientIds]);

  if (supportSession) {
    if (supportSession.targetSurface === "partner") {
      partnerIds = [supportSession.targetTenantId];
      partnerAdminIds = [supportSession.targetTenantId];
      // Resolved from the partner rather than filtered out of the actor's own
      // scope: a support session is only ever opened by a platform admin, who
      // typically holds no partner membership, so filtering would yield none.
      clientIds = await loadPartnerClientIds(supportSession.targetTenantId);
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
      partnerAdminIds = isPlatformAdmin || actorPartnerAdminIds.includes(activeContext.tenantId)
        ? [activeContext.tenantId]
        : [];
      clientIds = actorPartnerIds.includes(activeContext.tenantId)
        ? // A member of this partner: narrow the scope they already had.
          clientIds.filter(
            (clientId) => clientPartnerMap.get(clientId) === activeContext.tenantId
          )
        : // A platform admin stepping in from outside: their scope was every
          // client, so resolve this partner's clients directly.
          await loadPartnerClientIds(activeContext.tenantId);
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

  // The managed set narrows with the same context as `clientIds`: inside a
  // partner support session the actor manages every client of the target
  // partner; inside a client support session exactly that client; otherwise
  // whatever survives the workspace narrowing above.
  if (supportSession) {
    managedClientIds =
      supportSession.targetSurface === "partner"
        ? // Resolved from the partner, not filtered out of the actor's own
          // memberships: the platform admin opening the session typically holds
          // none, so `clientIds` can be empty here while the partner has clients.
          Array.from(
            (await loadClientPartnerMap([supportSession.targetTenantId])).keys()
          )
        : [supportSession.targetTenantId];
  } else if (isPlatformAdmin && activeContext?.tenantId) {
    managedClientIds = [...clientIds];
  } else {
    managedClientIds = managedClientIds.filter((clientId) =>
      clientIds.includes(clientId)
    );
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
    managedClientIds,
    isLocalDevelopment: requestEnvironment.isLocalDevelopment,
    supportSession,
  };
}

export const resolveAuthorizedScope = cache(resolveAuthorizedScopeImpl);

export function isUnconfinedPlatformAdmin(scope: AuthorizedScope) {
  return resolveTenantClientFilter(scope) === null;
}

export function canAccessClient(scope: AuthorizedScope, clientId: string) {
  return isUnconfinedPlatformAdmin(scope) || scope.clientIds.includes(clientId);
}

/**
 * May the actor manage (not merely see) this client? Platform admins on the
 * admin surface always may; everyone else only when the client is in their
 * managed set — a direct client-admin membership, or admin membership of the
 * partner that owns the client. The set is resolved once in
 * `resolveAuthorizedScope`, so callers never need to know the client's partner.
 */
export function canManageClient(scope: AuthorizedScope, clientId: string) {
  return isUnconfinedPlatformAdmin(scope) || scope.managedClientIds.includes(clientId);
}

/**
 * Entitlements — assessment assignments and quotas, report-template
 * assignments, the client branding flag — are set by the platform or by the
 * partner that owns the client, never by the client's own admins (who satisfy
 * `canManageClient` for their tenant). The managed-set check keeps workspace
 * narrowing and support-session confinement in force.
 */
export function canManageClientEntitlements(
  scope: AuthorizedScope,
  clientId: string,
  clientPartnerId: string | null | undefined
) {
  return (
    scope.isPlatformAdmin ||
    (clientPartnerId != null &&
      scope.partnerAdminIds.includes(clientPartnerId) &&
      scope.managedClientIds.includes(clientId))
  );
}

export function canManagePartner(scope: AuthorizedScope, partnerId: string) {
  return scope.isPlatformAdmin || scope.partnerAdminIds.includes(partnerId);
}

export function canAccessAssessment(
  scope: AuthorizedScope,
  assessmentPartnerId?: string | null,
  assessmentClientId?: string | null
) {
  return (
    scope.isPlatformAdmin ||
    (assessmentPartnerId != null && scope.partnerIds.includes(assessmentPartnerId)) ||
    (assessmentClientId != null && scope.clientIds.includes(assessmentClientId)) ||
    (assessmentPartnerId == null && assessmentClientId == null)
  );
}

export function canManageAssessment(
  scope: AuthorizedScope,
  assessmentPartnerId?: string | null,
  assessmentClientId?: string | null
) {
  return (
    scope.isPlatformAdmin ||
    (assessmentPartnerId != null && scope.partnerAdminIds.includes(assessmentPartnerId)) ||
    (assessmentClientId != null && scope.clientAdminIds.includes(assessmentClientId))
  );
}

function standaloneCampaignPartnerIds(scope: AuthorizedScope): string[] {
  if (
    scope.supportSession?.targetSurface === "client" ||
    scope.activeContext?.tenantType === "client" ||
    scope.previewContext?.tenantType === "client"
  ) {
    return [];
  }
  return scope.partnerIds;
}

export function canAccessCampaign(
  scope: AuthorizedScope,
  campaignPartnerId?: string | null,
  campaignClientId?: string | null
) {
  if (isUnconfinedPlatformAdmin(scope)) return true;
  // The resolved client set follows current ownership and explicit memberships.
  // A copied campaign.partner_id must never preserve the previous owner's grant.
  if (campaignClientId != null) return canAccessClient(scope, campaignClientId);
  return campaignPartnerId != null &&
    standaloneCampaignPartnerIds(scope).includes(campaignPartnerId);
}

export function canManageCampaign(
  scope: AuthorizedScope,
  campaignPartnerId?: string | null,
  campaignClientId?: string | null
) {
  if (isUnconfinedPlatformAdmin(scope)) return true;
  if (campaignClientId != null) {
    return canManageClient(scope, campaignClientId);
  }
  return campaignPartnerId != null &&
    standaloneCampaignPartnerIds(scope).includes(campaignPartnerId) &&
    scope.partnerAdminIds.includes(campaignPartnerId);
}

function campaignOwnership(row: {
  client_id?: unknown;
  partner_id?: unknown;
  clients?: unknown;
}) {
  const clientId = row.client_id ? String(row.client_id) : null;
  if (!clientId) {
    return { clientId, partnerId: row.partner_id ? String(row.partner_id) : null };
  }
  const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  const clientRow = client as { deleted_at?: unknown; partner_id?: unknown } | null;
  if (!clientRow || typeof clientRow !== "object" || clientRow.deleted_at) {
    throw new AuthorizationError("Campaign client not found or inaccessible.");
  }
  return {
    clientId,
    partnerId: clientRow.partner_id ? String(clientRow.partner_id) : null,
  };
}

export function canManageReportTemplate(
  scope: AuthorizedScope,
  templatePartnerId?: string | null
) {
  return (
    scope.isPlatformAdmin ||
    (templatePartnerId != null && scope.partnerAdminIds.includes(templatePartnerId))
  );
}

export function canManageAssessmentLibrary(scope: AuthorizedScope) {
  return (
    scope.isPlatformAdmin ||
    scope.partnerAdminIds.length > 0 ||
    scope.clientAdminIds.length > 0
  );
}

export function canManageClientDirectory(scope: AuthorizedScope) {
  return scope.isPlatformAdmin || scope.partnerAdminIds.length > 0;
}

export function canManageReportTemplateLibrary(scope: AuthorizedScope) {
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
  const hasAccess = canAccessClient(scope, String(data.id));

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
    .select("id, client_id, partner_id, confidentiality_mode, deleted_at, clients(partner_id, deleted_at)")
    .eq("id", campaignId)
    .single();

  if (error || !data || data.deleted_at) {
    throw new AuthorizationError("Campaign not found or inaccessible.");
  }

  const { clientId, partnerId } = campaignOwnership(data);
  const hasAccess = canAccessCampaign(scope, partnerId, clientId);

  if (!hasAccess) {
    throw new AuthorizationError("You do not have access to this campaign.");
  }

  return {
    scope,
    campaignId: String(data.id),
    clientId,
    partnerId,
    confidentialityMode: (data.confidentiality_mode ??
      "standard") as CampaignConfidentialityMode,
  };
}

/**
 * Campaign access is membership-wide: any member of the owning client or
 * partner may READ a campaign. Mutating one is a management action, so every
 * campaign write goes through this instead of `requireCampaignAccess` — it
 * adds the `canManageCampaign` check on top of the same lookup.
 *
 * Without it an ordinary (non-admin) member of a tenant could edit, activate,
 * or invite into any campaign that tenant owns, because the actions run on the
 * service-role client and RLS never sees the request.
 */
export async function requireCampaignManage(campaignId: string) {
  const access = await requireCampaignAccess(campaignId);

  if (!canManageCampaign(access.scope, access.partnerId, access.clientId)) {
    throw new AuthorizationError(
      "You do not have permission to manage this campaign."
    );
  }

  return access;
}

/**
 * Throws unless the viewer may see individual-level results (scores,
 * responses, report snapshots) for a campaign with the given confidentiality
 * mode. See src/lib/reports/confidentiality.ts for the policy rationale.
 */
export function assertIndividualResultsAccess(
  scope: AuthorizedScope,
  confidentialityMode: CampaignConfidentialityMode | null | undefined,
) {
  if (!canViewIndividualResults(confidentialityMode, scope)) {
    throw new AuthorizationError(
      "This campaign is aggregate-only: individual results are not available.",
    );
  }
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

export async function requireReportSnapshotAccess(snapshotId: string) {
  const scope = await resolveAuthorizedScope();
  const db = createAdminClient();
  const { data, error } = await db
    .from("report_snapshots")
    .select(
      "id, campaign_id, participant_session_id, campaigns(client_id, partner_id, confidentiality_mode, clients(partner_id, deleted_at)), participant_sessions(campaign_participant_id)"
    )
    .eq("id", snapshotId)
    .maybeSingle();

  if (error || !data) {
    throw new AuthorizationError("Report snapshot not found or inaccessible.");
  }

  const campaign = Array.isArray(data.campaigns) ? data.campaigns[0] : data.campaigns;
  const session = Array.isArray(data.participant_sessions)
    ? data.participant_sessions[0]
    : data.participant_sessions;
  if (!campaign) {
    throw new AuthorizationError("Report campaign not found or inaccessible.");
  }
  const { clientId, partnerId } = campaignOwnership(campaign);
  const participantId = session?.campaign_participant_id
    ? String(session.campaign_participant_id)
    : null;
  const hasAccess = canAccessCampaign(scope, partnerId, clientId);

  if (!hasAccess) {
    throw new AuthorizationError("You do not have access to this report.");
  }

  return {
    scope,
    snapshotId: String(data.id),
    campaignId: data.campaign_id ? String(data.campaign_id) : null,
    participantSessionId: data.participant_session_id
      ? String(data.participant_session_id)
      : null,
    participantId,
    clientId,
    partnerId,
    confidentialityMode: (campaign?.confidentiality_mode ??
      "standard") as CampaignConfidentialityMode,
  };
}

export async function getAccessibleCampaignIds(scope: AuthorizedScope) {
  // `null` means unrestricted, and only a platform admin standing outside every
  // tenant workspace is. Gating on `isPlatformAdmin` alone returned `null` to an
  // admin inside a client's workspace too, which is how the workspace boundary
  // leaked through every caller that trusts this list.
  if (isUnconfinedPlatformAdmin(scope)) {
    return null;
  }

  const db = createAdminClient();
  let query = db
    .from("campaigns")
    .select("id")
    .is("deleted_at", null);

  const standalonePartnerIds = standaloneCampaignPartnerIds(scope);
  if (scope.clientIds.length > 0 && standalonePartnerIds.length > 0) {
    query = query.or(
      `client_id.in.(${scope.clientIds.join(",")}),and(client_id.is.null,partner_id.in.(${standalonePartnerIds.join(",")}))`
    );
  } else if (scope.clientIds.length > 0) {
    query = query.in("client_id", scope.clientIds);
  } else if (standalonePartnerIds.length > 0) {
    query = query.is("client_id", null).in("partner_id", standalonePartnerIds);
  } else {
    return [];
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => String(row.id));
}

export async function getAccessiblePartnerIds(scope: AuthorizedScope) {
  if (scope.activeContext?.tenantType === "partner" && scope.activeContext.tenantId) {
    const activePartnerId = scope.activeContext.tenantId;
    if (
      scope.isPlatformAdmin ||
      scope.partnerIds.includes(activePartnerId) ||
      scope.partnerAdminIds.includes(activePartnerId)
    ) {
      return [activePartnerId];
    }
    return [];
  }

  const effectiveClientIds =
    scope.activeContext?.tenantType === "client" && scope.activeContext.tenantId
      ? [scope.activeContext.tenantId]
      : scope.clientIds;

  if (effectiveClientIds.length === 0) {
    return dedupe(scope.partnerIds);
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("clients")
    .select("partner_id")
    .in("id", effectiveClientIds)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return dedupe([
    ...scope.partnerIds,
    ...(data ?? [])
      .map((row) => (row.partner_id ? String(row.partner_id) : ""))
      .filter(Boolean),
  ]);
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

export function getPreferredPartnerIdForAssessmentCreation(scope: AuthorizedScope) {
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
    "Select an active partner context before creating an assessment."
  );
}

export function getPreferredPartnerIdForReportTemplateCreation(scope: AuthorizedScope) {
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
    "Select an active partner context before creating a report template."
  );
}

export async function requireAssessmentAccess(
  assessmentId: string,
  options: { includeArchived?: boolean; forWrite?: boolean } = {}
) {
  const scope = await resolveAuthorizedScope();
  const db = createAdminClient();
  const { data, error } = await db
    .from("assessments")
    .select("id, partner_id, client_id, deleted_at")
    .eq("id", assessmentId)
    .single();

  if (error || !data || (!options.includeArchived && data.deleted_at)) {
    throw new AuthorizationError("Assessment not found or inaccessible.");
  }

  const partnerId = data.partner_id ? String(data.partner_id) : null;
  const clientId = data.client_id ? String(data.client_id) : null;
  const hasAccess = options.forWrite
    ? canManageAssessment(scope, partnerId, clientId)
    : canAccessAssessment(scope, partnerId, clientId);

  if (!hasAccess) {
    throw new AuthorizationError(
      options.forWrite
        ? "You do not have permission to modify this assessment."
        : "You do not have access to this assessment."
    );
  }

  return {
    scope,
    assessmentId: String(data.id),
    partnerId,
    clientId,
  };
}

export async function requireReportTemplateAccess(
  templateId: string,
  options: { includeArchived?: boolean; forWrite?: boolean } = {}
) {
  const scope = await resolveAuthorizedScope();
  const db = createAdminClient();
  const { data, error } = await db
    .from("report_templates")
    .select("id, partner_id, deleted_at")
    .eq("id", templateId)
    .single();

  if (error || !data || (!options.includeArchived && data.deleted_at)) {
    throw new AuthorizationError("Report template not found or inaccessible.");
  }

  const partnerId = data.partner_id ? String(data.partner_id) : null;
  const hasAccess = options.forWrite
    ? canManageReportTemplate(scope, partnerId)
    : scope.isPlatformAdmin ||
      partnerId == null ||
      (await getAccessiblePartnerIds(scope)).includes(partnerId);

  if (!hasAccess) {
    throw new AuthorizationError(
      options.forWrite
        ? "You do not have permission to modify this report template."
        : "You do not have access to this report template."
    );
  }

  return {
    scope,
    templateId: String(data.id),
    partnerId,
  };
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

/**
 * The client ids a workspace-scoped read must be restricted to, or `null` when
 * the caller is genuinely unrestricted — a platform admin on the admin surface
 * with no tenant workspace selected.
 *
 * Reach for this in any query whose tenant isolation would otherwise rest on
 * RLS alone. RLS scopes by *membership* (`auth_user_client_ids()`) and knows
 * nothing about the active workspace context or an in-flight support session:
 * both live in a signed cookie that never reaches Postgres. `is_platform_admin()`
 * is role-only, so for a platform admin RLS is not a tenant boundary at all.
 * Entering a client workspace therefore narrows `resolveAuthorizedScope()` and
 * nothing else — a query that trusts RLS still spans every client.
 *
 * An empty array means "restricted to nothing"; callers must return no rows
 * rather than treating it as unrestricted.
 */
export function resolveTenantClientFilter(
  scope: AuthorizedScope
): string[] | null {
  const inTenantWorkspace = Boolean(
    scope.supportSession ||
      scope.activeContext?.tenantId ||
      scope.previewContext?.tenantId
  );

  if (scope.isPlatformAdmin && !inTenantWorkspace) {
    return null;
  }

  return scope.clientIds;
}

/**
 * Narrow a query to the caller's workspace on a client-id column, or return
 * `null` when the caller is confined to nothing.
 *
 * Prefer this over calling `resolveTenantClientFilter` by hand: the empty-array
 * case means "no rows", and expressing it as a `null` the caller must handle
 * makes the mistake that caused the original leak — treating "restricted to
 * nothing" as "unrestricted" — a type error rather than a silent widening.
 *
 *   const scoped = applyTenantClientFilter(query, scope, "client_id");
 *   if (!scoped) return [];
 *   const { data, error } = await scoped;
 *
 * `column` may address an embedded relation ("campaigns.client_id").
 */
export function applyTenantClientFilter<
  Q extends { in(column: string, values: string[]): Q },
>(query: Q, scope: AuthorizedScope, column: string): Q | null {
  const clientFilter = resolveTenantClientFilter(scope);
  if (clientFilter === null) {
    return query;
  }
  if (clientFilter.length === 0) {
    return null;
  }
  return query.in(column, clientFilter);
}
