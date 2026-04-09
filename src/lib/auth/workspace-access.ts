import type {
  ActiveContext,
  ClientMembershipRecord,
  PartnerMembershipRecord,
  PreviewContext,
  ResolvedActor,
  TenantType,
} from "@/lib/auth/types";
import {
  AuthenticationRequiredError,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export type WorkspaceAccessStatus = "signed_out" | "forbidden" | "ok";

export interface AdminWorkspaceAccessResult {
  status: WorkspaceAccessStatus;
  actor: ResolvedActor | null;
  isLocalDevelopmentBypass: boolean;
}

export interface WorkspaceAccessResult {
  status: WorkspaceAccessStatus;
  actor: ResolvedActor | null;
  activeContext: ActiveContext | null;
  previewContext: PreviewContext | null;
  partnerMembershipCount: number;
  clientMembershipCount: number;
  accessiblePartnerCount: number;
  accessibleClientCount: number;
  canExportReports: boolean;
  hasSupportSession: boolean;
  isLocalDevelopmentBypass: boolean;
}

export interface WorkspaceContextOption {
  key: string;
  label: string;
  description: string;
  tenantType?: TenantType;
  tenantId?: string;
  membershipId?: string;
  kind: "all" | "partner" | "client";
  selected: boolean;
}

function canAccessWorkspace(
  actor: ResolvedActor | null,
  accessiblePartnerCount: number,
  accessibleClientCount: number,
  isLocalDevelopmentBypass: boolean,
  surface: "partner" | "client"
): boolean {
  if (isLocalDevelopmentBypass) {
    return true;
  }

  if (!actor) {
    return false;
  }

  if (surface === "partner") {
    return accessiblePartnerCount > 0;
  }

  return accessibleClientCount > 0;
}

export async function resolveWorkspaceAccess(
  surface: "partner" | "client"
): Promise<WorkspaceAccessResult> {
  let scope;
  try {
    scope = await resolveAuthorizedScope();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return {
        status: "signed_out",
        actor: null,
        activeContext: null,
        previewContext: null,
        partnerMembershipCount: 0,
        clientMembershipCount: 0,
        accessiblePartnerCount: 0,
        accessibleClientCount: 0,
        canExportReports: false,
        hasSupportSession: false,
        isLocalDevelopmentBypass: false,
      };
    }

    throw error;
  }

  const actor = scope.actor;

  const result = {
    actor,
    activeContext: scope.activeContext,
    previewContext: scope.previewContext,
    partnerMembershipCount: actor?.partnerMemberships.length ?? 0,
    clientMembershipCount: actor?.clientMemberships.length ?? 0,
    accessiblePartnerCount: scope.partnerIds.length,
    accessibleClientCount: scope.clientIds.length,
    canExportReports:
      scope.isLocalDevelopmentBypass ||
      scope.isPlatformAdmin ||
      (surface === "partner"
        ? scope.partnerAdminIds.length > 0
        : scope.clientAdminIds.length > 0),
    hasSupportSession: Boolean(scope.supportSession),
    isLocalDevelopmentBypass: scope.isLocalDevelopmentBypass,
  };

  if (
    !canAccessWorkspace(
      actor,
      scope.partnerIds.length,
      scope.clientIds.length,
      scope.isLocalDevelopmentBypass,
      surface
    )
  ) {
    return {
      status: "forbidden",
      ...result,
    };
  }

  return {
    status: "ok",
    ...result,
  };
}

export async function resolveAdminWorkspaceAccess(): Promise<AdminWorkspaceAccessResult> {
  try {
    const scope = await resolveAuthorizedScope();

    if (scope.isPlatformAdmin || scope.isLocalDevelopmentBypass) {
      return {
        status: "ok",
        actor: scope.actor,
        isLocalDevelopmentBypass: scope.isLocalDevelopmentBypass,
      };
    }

    return {
      status: "forbidden",
      actor: scope.actor,
      isLocalDevelopmentBypass: scope.isLocalDevelopmentBypass,
    };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return {
        status: "signed_out",
        actor: null,
        isLocalDevelopmentBypass: false,
      };
    }

    throw error;
  }
}

function findSelectedOption(
  context: Pick<ActiveContext, "surface" | "tenantType" | "tenantId"> | Pick<PreviewContext, "surface" | "tenantType" | "tenantId"> | null,
  option: Pick<WorkspaceContextOption, "tenantType" | "tenantId" | "kind">
) {
  if (!context) {
    return option.kind === "all";
  }

  if (!option.tenantType || !option.tenantId) {
    return context.surface === "partner" || context.surface === "client"
      ? !context.tenantType && !context.tenantId
      : false;
  }

  return (
    context.tenantType === option.tenantType &&
    context.tenantId === option.tenantId
  );
}

async function loadPartnerOptionRows(partnerIds: string[]) {
  if (partnerIds.length === 0) {
    return [];
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("partners")
    .select("id, name")
    .in("id", partnerIds)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function loadClientOptionRows(clientIds: string[]) {
  if (clientIds.length === 0) {
    return [];
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("clients")
    .select("id, name, partner_id")
    .in("id", clientIds)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

function membershipByPartnerId(actor: ResolvedActor | null) {
  const map = new Map<string, PartnerMembershipRecord>();
  for (const membership of actor?.partnerMemberships ?? []) {
    map.set(membership.partnerId, membership);
  }
  return map;
}

function membershipByClientId(actor: ResolvedActor | null) {
  const map = new Map<string, ClientMembershipRecord>();
  for (const membership of actor?.clientMemberships ?? []) {
    map.set(membership.clientId, membership);
  }
  return map;
}

export async function getWorkspaceContextOptions(
  surface: "partner" | "client"
): Promise<WorkspaceContextOption[]> {
  let scope;
  try {
    scope = await resolveAuthorizedScope();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return [];
    }

    throw error;
  }

  let partnerIds = scope.partnerIds;
  let clientIds = scope.clientIds;
  let partners: Array<{ id: string; name: string }> = [];
  let clients: Array<{ id: string; name: string; partner_id: string | null }> = [];

  try {
    if (scope.isLocalDevelopmentBypass) {
      const db = createAdminClient();
      partnerIds =
        surface === "partner"
          ? (
              await db
                .from("partners")
                .select("id")
                .order("name", { ascending: true })
            ).data?.map((row) => String(row.id)) ?? []
          : scope.partnerIds;
      clientIds =
        (
          await db
            .from("clients")
            .select("id")
            .is("deleted_at", null)
            .order("name", { ascending: true })
        ).data?.map((row) => String(row.id)) ?? [];
    }

    [partners, clients] = await Promise.all([
      surface === "partner"
        ? loadPartnerOptionRows(partnerIds)
        : Promise.resolve([]),
      loadClientOptionRows(clientIds),
    ]);
  } catch (error) {
    if (!scope.isLocalDevelopmentBypass) {
      throw error;
    }

    console.warn(
      "[workspace-access] Local development preview options unavailable:",
      error
    );
    return [
      {
        key: `${surface}-preview`,
        label: "Preview all data",
        description:
          "Local development preview without a loaded tenant context.",
        kind: "all",
        selected: true,
      },
    ];
  }

  const partnerMembershipMap = membershipByPartnerId(scope.actor);
  const clientMembershipMap = membershipByClientId(scope.actor);
  const selectedContext = scope.isLocalDevelopmentBypass
    ? scope.previewContext
    : scope.activeContext;
  const options: WorkspaceContextOption[] = [];

  if ((surface === "partner" && (partners.length > 1 || clients.length > 0)) || (surface === "client" && clients.length > 1)) {
    options.push({
      key: `${surface}-all`,
      label: scope.isLocalDevelopmentBypass
        ? surface === "partner"
          ? "Preview all partner data"
          : "Preview all client data"
        : surface === "partner"
          ? "All assigned clients"
          : "All accessible clients",
      description:
        scope.isLocalDevelopmentBypass
          ? "Local development preview across all seeded workspace data."
          : surface === "partner"
          ? "View all accessible client data in this portal."
          : "View all accessible client scopes in this portal.",
      kind: "all",
      selected: findSelectedOption(selectedContext, { kind: "all" }),
    });
  }

  if (surface === "partner") {
    for (const partner of partners) {
      const partnerId = String(partner.id);
      const linkedClientCount = clients.filter(
        (client) => String(client.partner_id ?? "") === partnerId
      ).length;
      const membership = partnerMembershipMap.get(partnerId);

      options.push({
        key: `partner:${partnerId}`,
        label: String(partner.name),
        description:
          linkedClientCount > 0
            ? `${linkedClientCount} accessible client${linkedClientCount === 1 ? "" : "s"}`
            : "Partner-scoped workspace",
        tenantType: "partner",
        tenantId: partnerId,
        membershipId: membership?.id,
        kind: "partner",
        selected: findSelectedOption(selectedContext, {
          tenantType: "partner",
          tenantId: partnerId,
          kind: "partner",
        }),
      });
    }
  }

  for (const client of clients) {
    const clientId = String(client.id);
    const membership = clientMembershipMap.get(clientId);
    const partnerLabel =
      surface === "partner" && client.partner_id
        ? partners.find((partner) => String(partner.id) === String(client.partner_id))?.name
        : null;

    options.push({
      key: `client:${clientId}`,
      label: String(client.name),
      description: partnerLabel
        ? `Client scope under ${String(partnerLabel)}`
        : "Client-scoped workspace",
      tenantType: "client",
      tenantId: clientId,
      membershipId: membership?.id,
      kind: "client",
      selected: findSelectedOption(selectedContext, {
        tenantType: "client",
        tenantId: clientId,
        kind: "client",
      }),
    });
  }

  if (options.length === 0 && scope.isLocalDevelopmentBypass) {
    options.push({
      key: `${surface}-preview`,
      label: "Preview all data",
      description: "Local development preview without a signed-in tenant context.",
      kind: "all",
      selected: true,
    });
  }

  return options;
}
