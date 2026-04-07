import crypto from "crypto";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import {
  ACTIVE_CONTEXT_COOKIE,
  PREVIEW_CONTEXT_COOKIE,
  encodeActiveContext,
  getActiveContextCookieOptions,
} from "@/lib/auth/active-context";
import { logAuditEvent } from "@/lib/auth/support-sessions";
import type { ActiveContext, ResolvedActor, TenantType } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { type WorkspaceSurface } from "@/lib/surfaces";
import { getConfiguredSurfaceUrl, getRoutePrefixForSurface, isLocalDevelopmentHost } from "@/lib/hosts";
import type { UserRole } from "@/types/database";

export const inviteTenantTypeSchema = z.enum(["platform", "partner", "client"]);
export const inviteRoleSchema = z.enum([
  "platform_admin",
  "partner_admin",
  "partner_member",
  "client_admin",
  "client_member",
]);

const createInviteSchema = z
  .object({
    email: z.email().trim().toLowerCase(),
    tenantType: inviteTenantTypeSchema,
    tenantId: z.string().uuid().optional(),
    role: inviteRoleSchema,
  })
  .superRefine((value, context) => {
    if (value.tenantType === "platform") {
      if (value.tenantId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tenantId"],
          message: "Platform invites cannot target a tenant.",
        });
      }

      if (value.role !== "platform_admin") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["role"],
          message: "Platform invites must use the platform admin role.",
        });
      }
    }

    if (value.tenantType === "partner") {
      if (!value.tenantId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tenantId"],
          message: "Select a partner for partner invites.",
        });
      }

      if (!["partner_admin", "partner_member"].includes(value.role)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["role"],
          message: "Partner invites must use a partner role.",
        });
      }
    }

    if (value.tenantType === "client") {
      if (!value.tenantId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tenantId"],
          message: "Select a client for client invites.",
        });
      }

      if (!["client_admin", "client_member"].includes(value.role)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["role"],
          message: "Client invites must use a client role.",
        });
      }
    }
  });

export type InviteTenantType = z.infer<typeof inviteTenantTypeSchema>;
export type InviteRole = z.infer<typeof inviteRoleSchema>;

export interface StaffInviteRecord {
  id: string;
  email: string;
  tenantType: InviteTenantType;
  tenantId: string | null;
  role: InviteRole;
  authUserId: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  invitedByProfileId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface CreateInviteInput {
  email: string;
  tenantType: InviteTenantType;
  tenantId?: string;
  role: InviteRole;
}

type InviteFieldErrors = {
  email?: string[];
  tenantType?: string[];
  tenantId?: string[];
  role?: string[];
  _form?: string[];
};

export type CreateStaffInviteResult =
  | {
      data: StaffInviteRecord;
      inviteToken: string;
    }
  | {
      error: InviteFieldErrors;
    };

interface InviteSummary {
  id: string;
  email: string;
  tenantType: InviteTenantType;
  tenantId: string | null;
  role: InviteRole;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  isExpired: boolean;
}

export function hashInviteToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createInviteToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function mapInviteRecord(row: Record<string, unknown>): StaffInviteRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    tenantType: row.tenant_type as InviteTenantType,
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    role: row.role as InviteRole,
    authUserId: row.auth_user_id ? String(row.auth_user_id) : null,
    expiresAt: String(row.expires_at),
    acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    invitedByProfileId: String(row.invited_by_profile_id),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapInviteSummary(invite: StaffInviteRecord): InviteSummary {
  return {
    id: invite.id,
    email: invite.email,
    tenantType: invite.tenantType,
    tenantId: invite.tenantId,
    role: invite.role,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
    revokedAt: invite.revokedAt,
    isExpired: isInviteExpired(invite),
  };
}

function isInviteExpired(invite: Pick<StaffInviteRecord, "expiresAt">) {
  return new Date(invite.expiresAt).getTime() <= Date.now();
}

function isInviteUsable(invite: StaffInviteRecord) {
  return !invite.acceptedAt && !invite.revokedAt && !isInviteExpired(invite);
}

export function getLegacyRoleForInvite(role: InviteRole): UserRole {
  switch (role) {
    case "platform_admin":
      return "platform_admin";
    case "partner_admin":
      return "partner_admin";
    case "client_admin":
      return "org_admin";
    case "partner_member":
    case "client_member":
      return "consultant";
  }
}

function getMembershipRoleForInvite(role: InviteRole): "admin" | "member" {
  return role.endsWith("_admin") ? "admin" : "member";
}

export function resolveDefaultWorkspaceContext(
  actor: Pick<ResolvedActor, "role" | "partnerMemberships" | "clientMemberships" | "activeContext">
): ActiveContext {
  if (actor.activeContext?.supportSessionId) {
    return actor.activeContext;
  }

  if (actor.activeContext?.tenantType && actor.activeContext.tenantId) {
    return actor.activeContext;
  }

  if (actor.role === "platform_admin") {
    return { surface: "admin" };
  }

  const partnerMemberships = [...actor.partnerMemberships].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    if (left.role !== right.role) {
      return left.role === "admin" ? -1 : 1;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });

  const clientMemberships = [...actor.clientMemberships].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    if (left.role !== right.role) {
      return left.role === "admin" ? -1 : 1;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });

  if (partnerMemberships.length > 0) {
    const membership = partnerMemberships[0];
    return {
      surface: "partner",
      tenantType: "partner",
      tenantId: membership.partnerId,
      membershipId: membership.id,
    };
  }

  if (clientMemberships.length > 0) {
    const membership = clientMemberships[0];
    return {
      surface: "client",
      tenantType: "client",
      tenantId: membership.clientId,
      membershipId: membership.id,
    };
  }

  return { surface: "admin" };
}

export function buildSurfaceDestinationUrl(input: {
  surface: WorkspaceSurface;
  path?: string;
  requestUrl: string;
  host: string | null;
}) {
  const configuredBase = getConfiguredSurfaceUrl(
    input.surface === "admin" ? "admin" : input.surface
  );
  const normalizedPath =
    input.surface === "admin"
      ? input.path && input.path !== "/"
        ? input.path
        : "/dashboard"
      : input.path && input.path !== "/"
        ? input.path
        : "/";
  const isLocal = isLocalDevelopmentHost(input.host);

  if (!configuredBase) {
    const routePrefix = getRoutePrefixForSurface(input.surface, isLocal);
    return new URL(`${routePrefix}${normalizedPath === "/" ? "" : normalizedPath}`, input.requestUrl);
  }

  const url = new URL(configuredBase);
  const basePath = url.pathname.replace(/\/+$/, "");
  const routePrefix = isLocal ? getRoutePrefixForSurface(input.surface, true) : "";
  const pathPrefix = basePath || routePrefix;
  const fullPath = `${pathPrefix}${normalizedPath === "/" ? "" : normalizedPath}` || "/";
  url.pathname = fullPath;
  url.search = "";
  url.hash = "";
  return url;
}

export async function createStaffInvite(
  input: CreateInviteInput & { invitedByProfileId: string }
): Promise<CreateStaffInviteResult> {
  const parsed = createInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const db = createAdminClient();
  const token = createInviteToken();
  const inviteTokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  const { data, error } = await db
    .from("user_invites")
    .insert({
      email: parsed.data.email,
      tenant_type: parsed.data.tenantType,
      tenant_id: parsed.data.tenantId ?? null,
      role: parsed.data.role,
      invite_token_hash: inviteTokenHash,
      expires_at: expiresAt,
      invited_by_profile_id: input.invitedByProfileId,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: { _form: [error?.message ?? "Failed to create invite."] } };
  }

  await logAuditEvent({
    actorProfileId: input.invitedByProfileId,
    eventType: "staff_invite.created",
    targetTable: "user_invites",
    targetId: String(data.id),
    partnerId: parsed.data.tenantType === "partner" ? parsed.data.tenantId ?? null : null,
    clientId: parsed.data.tenantType === "client" ? parsed.data.tenantId ?? null : null,
    metadata: {
      email: parsed.data.email,
      tenantType: parsed.data.tenantType,
      role: parsed.data.role,
    },
  });

  return {
    data: mapInviteRecord(data as Record<string, unknown>),
    inviteToken: token,
  };
}

export async function getInviteByToken(token: string): Promise<StaffInviteRecord | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("user_invites")
    .select("*")
    .eq("invite_token_hash", hashInviteToken(token))
    .single();

  if (error || !data) {
    return null;
  }

  return mapInviteRecord(data as Record<string, unknown>);
}

export async function getInviteSummaryByToken(token: string) {
  const invite = await getInviteByToken(token);
  return invite ? mapInviteSummary(invite) : null;
}

async function lookupPartnerIdForClient(clientId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("clients")
    .select("partner_id")
    .eq("id", clientId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data?.partner_id ? String(data.partner_id) : null;
}

async function ensureProfileForUser(user: User, invite: StaffInviteRecord) {
  const db = createAdminClient();
  const legacyRole = getLegacyRoleForInvite(invite.role);
  const profileUpdate: Record<string, unknown> = {
    email: user.email?.toLowerCase() ?? invite.email,
    role: legacyRole,
    display_name:
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : null,
    is_active: true,
  };

  if (invite.tenantType === "partner") {
    profileUpdate.partner_id = invite.tenantId;
    profileUpdate.client_id = null;
  } else if (invite.tenantType === "client" && invite.tenantId) {
    profileUpdate.client_id = invite.tenantId;
    profileUpdate.partner_id = await lookupPartnerIdForClient(invite.tenantId);
  } else {
    profileUpdate.partner_id = null;
    profileUpdate.client_id = null;
  }

  const { data: existing } = await db
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await db.from("profiles").update(profileUpdate).eq("id", user.id);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const { error } = await db.from("profiles").insert({
    id: user.id,
    first_name: "",
    last_name: "",
    ...profileUpdate,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function ensureMembershipForInvite(userId: string, invite: StaffInviteRecord, actorProfileId: string) {
  const db = createAdminClient();
  const membershipRole = getMembershipRoleForInvite(invite.role);

  if (invite.tenantType === "partner" && invite.tenantId) {
    const { error } = await db.from("partner_memberships").upsert(
      {
        profile_id: userId,
        partner_id: invite.tenantId,
        role: membershipRole,
        is_default: true,
        created_by: actorProfileId,
        revoked_at: null,
        revoked_by_profile_id: null,
      },
      { onConflict: "profile_id,partner_id" }
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  if (invite.tenantType === "client" && invite.tenantId) {
    const { error } = await db.from("client_memberships").upsert(
      {
        profile_id: userId,
        client_id: invite.tenantId,
        role: membershipRole,
        is_default: true,
        created_by: actorProfileId,
        revoked_at: null,
        revoked_by_profile_id: null,
      },
      { onConflict: "profile_id,client_id" }
    );

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function finalizeInviteAcceptance(user: User, token: string) {
  const invite = await getInviteByToken(token);
  if (!invite || !isInviteUsable(invite)) {
    throw new Error("This invite is invalid or expired.");
  }

  const normalizedUserEmail = user.email?.trim().toLowerCase();
  if (!normalizedUserEmail || normalizedUserEmail !== invite.email.trim().toLowerCase()) {
    throw new Error("This invite must be accepted with the invited email address.");
  }

  await ensureProfileForUser(user, invite);
  await ensureMembershipForInvite(user.id, invite, invite.invitedByProfileId);

  const db = createAdminClient();
  const { error } = await db
    .from("user_invites")
    .update({
      accepted_at: new Date().toISOString(),
      auth_user_id: user.id,
    })
    .eq("id", invite.id);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent({
    actorProfileId: user.id,
    eventType: "staff_invite.accepted",
    targetTable: "user_invites",
    targetId: invite.id,
    partnerId: invite.tenantType === "partner" ? invite.tenantId : null,
    clientId: invite.tenantType === "client" ? invite.tenantId : null,
    metadata: {
      tenantType: invite.tenantType,
      role: invite.role,
      invitedBy: invite.invitedByProfileId,
    },
  });

  return invite;
}

export async function listStaffUsers() {
  const db = createAdminClient();
  const [{ data: profiles, error: profileError }, { data: invites, error: inviteError }] =
    await Promise.all([
      db
        .from("profiles")
        .select("id, email, display_name, first_name, last_name, role, is_active, created_at, partner_id, client_id")
        .order("created_at", { ascending: false }),
      db
        .from("user_invites")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

  if (profileError) {
    throw new Error(profileError.message);
  }
  if (inviteError) {
    throw new Error(inviteError.message);
  }

  const [partnerMemberships, clientMemberships] = await Promise.all([
    db
      .from("partner_memberships")
      .select("id, profile_id, partner_id, role, is_default, revoked_at, created_at"),
    db
      .from("client_memberships")
      .select("id, profile_id, client_id, role, is_default, revoked_at, created_at"),
  ]);

  if (partnerMemberships.error) {
    throw new Error(partnerMemberships.error.message);
  }
  if (clientMemberships.error) {
    throw new Error(clientMemberships.error.message);
  }

  return {
    profiles: profiles ?? [],
    invites: (invites ?? [])
      .map((row) => mapInviteRecord(row as Record<string, unknown>))
      .map((invite) => ({
        ...invite,
        isExpired: isInviteExpired(invite),
      })),
    partnerMemberships: partnerMemberships.data ?? [],
    clientMemberships: clientMemberships.data ?? [],
  };
}

export function createInviteLink(token: string) {
  const base = getConfiguredSurfaceUrl("public") ?? getConfiguredSurfaceUrl("admin") ?? process.env.PUBLIC_APP_URL ?? process.env.ADMIN_APP_URL ?? "http://localhost:3002";
  const url = new URL(base);
  const basePath = url.pathname.replace(/\/+$/, "");
  url.pathname = `${basePath}/auth/accept`;
  url.searchParams.set("invite", token);
  return url.toString();
}

export async function revokeInvite(inviteId: string, actorProfileId: string) {
  const db = createAdminClient();
  const { error } = await db
    .from("user_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .is("accepted_at", null)
    .is("revoked_at", null);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent({
    actorProfileId,
    eventType: "staff_invite.revoked",
    targetTable: "user_invites",
    targetId: inviteId,
  });
}

export async function setProfileActiveState(input: {
  profileId: string;
  isActive: boolean;
  actorProfileId: string;
}) {
  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({ is_active: input.isActive })
    .eq("id", input.profileId);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent({
    actorProfileId: input.actorProfileId,
    eventType: input.isActive ? "staff_user.reactivated" : "staff_user.deactivated",
    targetTable: "profiles",
    targetId: input.profileId,
  });
}

export async function revokeMembership(input: {
  membershipType: TenantType;
  membershipId: string;
  actorProfileId: string;
}) {
  const db = createAdminClient();
  const table =
    input.membershipType === "partner" ? "partner_memberships" : "client_memberships";
  const { error } = await db
    .from(table)
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by_profile_id: input.actorProfileId,
      is_default: false,
    })
    .eq("id", input.membershipId)
    .is("revoked_at", null);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent({
    actorProfileId: input.actorProfileId,
    eventType: `${input.membershipType}_membership.revoked`,
    targetTable: table,
    targetId: input.membershipId,
  });
}

export function applyActiveContextToResponse(
  response: import("next/server").NextResponse,
  context: ActiveContext
) {
  response.cookies.set(
    ACTIVE_CONTEXT_COOKIE,
    encodeActiveContext(context),
    getActiveContextCookieOptions()
  );
  response.cookies.delete(PREVIEW_CONTEXT_COOKIE);
  return response;
}
