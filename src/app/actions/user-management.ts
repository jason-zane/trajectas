"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminScope } from "@/lib/auth/authorization";
import { sendStaffInviteEmail } from "@/lib/auth/staff-invite-email";
import {
  hashInviteToken,
  type InviteRole,
  type InviteTenantType,
} from "@/lib/auth/staff-auth";
import type { MembershipRole } from "@/lib/auth/types";
import { logAuditEvent } from "@/lib/auth/support-sessions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

const profileIdSchema = z.uuid();
const inviteIdSchema = z.uuid();
const tenantIdSchema = z.uuid();
const membershipIdSchema = z.uuid();
const tenantTypeSchema = z.enum(["partner", "client"]);
const membershipRoleSchema = z.enum(["admin", "member"]);
const profileRoleSchema = z.enum([
  "platform_admin",
  "partner_admin",
  "org_admin",
  "consultant",
]);

type StaffProfileRole = z.infer<typeof profileRoleSchema>;
type MutationResult = { success: true } | { error: string };

const STAFF_PROFILE_ROLES = new Set<StaffProfileRole>(profileRoleSchema.options);
const NON_STAFF_PROFILE_ROLES = new Set(["assessor", "participant", "candidate"]);

type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: UserRole | string;
  is_active: boolean;
  created_at: string;
};

type PartnerMembershipRow = {
  id: string;
  profile_id: string;
  partner_id: string;
  role: MembershipRole;
  created_at: string;
  revoked_at: string | null;
};

type ClientMembershipRow = {
  id: string;
  profile_id: string;
  client_id: string;
  role: MembershipRole;
  created_at: string;
  revoked_at: string | null;
};

type InviteRow = {
  id: string;
  email: string;
  tenant_type: InviteTenantType;
  tenant_id: string | null;
  role: InviteRole;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

export interface PartnerMembershipListItem {
  id: string;
  partnerId: string;
  partnerName: string | null;
  role: MembershipRole;
}

export interface ClientMembershipListItem {
  id: string;
  clientId: string;
  clientName: string | null;
  role: MembershipRole;
}

export interface ProfileListItem {
  type: "profile";
  id: string;
  email: string;
  displayName: string | null;
  role: StaffProfileRole;
  isActive: boolean;
  createdAt: string;
  partnerMemberships: PartnerMembershipListItem[];
  clientMemberships: ClientMembershipListItem[];
}

export interface InviteListItem {
  type: "invite";
  id: string;
  email: string;
  role: InviteRole;
  tenantType: InviteTenantType;
  tenantId: string | null;
  tenantName: string | null;
  expiresAt: string;
  createdAt: string;
}

export type UserListItem = ProfileListItem | InviteListItem;

export interface PartnerMembershipDetail {
  id: string;
  partnerId: string;
  partnerName: string | null;
  role: MembershipRole;
  createdAt: string;
  revokedAt: string | null;
}

export interface ClientMembershipDetail {
  id: string;
  clientId: string;
  clientName: string | null;
  role: MembershipRole;
  createdAt: string;
  revokedAt: string | null;
}

export interface UserDetail {
  id: string;
  email: string;
  displayName: string | null;
  role: StaffProfileRole;
  isActive: boolean;
  createdAt: string;
  partnerMemberships: PartnerMembershipDetail[];
  clientMemberships: ClientMembershipDetail[];
}

export interface InviteDetail {
  id: string;
  email: string;
  role: InviteRole;
  tenantType: InviteTenantType;
  tenantId: string | null;
  tenantName: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

function isStaffProfileRole(role: string): role is StaffProfileRole {
  if (NON_STAFF_PROFILE_ROLES.has(role)) {
    return false;
  }

  return STAFF_PROFILE_ROLES.has(role as StaffProfileRole);
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function resolveDisplayName(row: Pick<ProfileRow, "display_name" | "first_name" | "last_name">) {
  if (typeof row.display_name === "string" && row.display_name.trim()) {
    return row.display_name.trim();
  }

  const fallback = [row.first_name, row.last_name]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ")
    .trim();

  return fallback || null;
}

function sortByLabelThenDate(
  left: { label: string; createdAt: string },
  right: { label: string; createdAt: string }
) {
  const labelCompare = left.label.localeCompare(right.label, undefined, {
    sensitivity: "base",
  });

  if (labelCompare !== 0) {
    return labelCompare;
  }

  return right.createdAt.localeCompare(left.createdAt);
}

function sortDetailMembershipsByStatusAndName(
  left: { name: string | null; revokedAt: string | null; createdAt: string },
  right: { name: string | null; revokedAt: string | null; createdAt: string }
) {
  const leftActive = left.revokedAt ? 1 : 0;
  const rightActive = right.revokedAt ? 1 : 0;

  if (leftActive !== rightActive) {
    return leftActive - rightActive;
  }

  const leftName = left.name ?? "";
  const rightName = right.name ?? "";
  const nameCompare = leftName.localeCompare(rightName, undefined, {
    sensitivity: "base",
  });

  if (nameCompare !== 0) {
    return nameCompare;
  }

  return left.createdAt.localeCompare(right.createdAt);
}

async function loadPartnerNameMap(db: ReturnType<typeof createAdminClient>, partnerIds: string[]) {
  if (partnerIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await db
    .from("partners")
    .select("id, name")
    .in("id", partnerIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((row) => [String(row.id), String(row.name)]));
}

async function loadClientNameMap(db: ReturnType<typeof createAdminClient>, clientIds: string[]) {
  if (clientIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await db
    .from("clients")
    .select("id, name")
    .in("id", clientIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((row) => [String(row.id), String(row.name)]));
}

export async function listUsersForAdmin(): Promise<UserListItem[]> {
  await requireAdminScope();

  const db = createAdminClient();
  const nowIso = new Date().toISOString();
  const [profilesResult, partnerMembershipsResult, clientMembershipsResult, invitesResult] =
    await Promise.all([
      db
        .from("profiles")
        .select(
          "id, email, display_name, first_name, last_name, role, is_active, created_at"
        ),
      db
        .from("partner_memberships")
        .select("id, profile_id, partner_id, role, created_at, revoked_at")
        .is("revoked_at", null),
      db
        .from("client_memberships")
        .select("id, profile_id, client_id, role, created_at, revoked_at")
        .is("revoked_at", null),
      db
        .from("user_invites")
        .select("id, email, tenant_type, tenant_id, role, expires_at, created_at, accepted_at, revoked_at")
        .is("accepted_at", null)
        .is("revoked_at", null)
        .gt("expires_at", nowIso),
    ]);

  if (profilesResult.error) {
    throw new Error(profilesResult.error.message);
  }
  if (partnerMembershipsResult.error) {
    throw new Error(partnerMembershipsResult.error.message);
  }
  if (clientMembershipsResult.error) {
    throw new Error(clientMembershipsResult.error.message);
  }
  if (invitesResult.error) {
    throw new Error(invitesResult.error.message);
  }

  const profiles = ((profilesResult.data ?? []) as ProfileRow[]).filter((row) =>
    isStaffProfileRole(String(row.role))
  );
  const partnerMemberships = (partnerMembershipsResult.data ?? []) as PartnerMembershipRow[];
  const clientMemberships = (clientMembershipsResult.data ?? []) as ClientMembershipRow[];
  const invites = (invitesResult.data ?? []) as InviteRow[];

  const [partnerNameMap, clientNameMap] = await Promise.all([
    loadPartnerNameMap(
      db,
      unique([
        ...partnerMemberships.map((membership) => membership.partner_id),
        ...invites
          .filter((invite) => invite.tenant_type === "partner")
          .map((invite) => invite.tenant_id),
      ])
    ),
    loadClientNameMap(
      db,
      unique([
        ...clientMemberships.map((membership) => membership.client_id),
        ...invites
          .filter((invite) => invite.tenant_type === "client")
          .map((invite) => invite.tenant_id),
      ])
    ),
  ]);

  const partnerMembershipsByProfile = new Map<string, PartnerMembershipListItem[]>();
  for (const membership of partnerMemberships) {
    const nextMembership: PartnerMembershipListItem = {
      id: membership.id,
      partnerId: membership.partner_id,
      partnerName: partnerNameMap.get(membership.partner_id) ?? null,
      role: membership.role,
    };
    const existing = partnerMembershipsByProfile.get(membership.profile_id) ?? [];
    existing.push(nextMembership);
    partnerMembershipsByProfile.set(membership.profile_id, existing);
  }

  const clientMembershipsByProfile = new Map<string, ClientMembershipListItem[]>();
  for (const membership of clientMemberships) {
    const nextMembership: ClientMembershipListItem = {
      id: membership.id,
      clientId: membership.client_id,
      clientName: clientNameMap.get(membership.client_id) ?? null,
      role: membership.role,
    };
    const existing = clientMembershipsByProfile.get(membership.profile_id) ?? [];
    existing.push(nextMembership);
    clientMembershipsByProfile.set(membership.profile_id, existing);
  }

  const profileItems: ProfileListItem[] = profiles.map((profile) => {
    const partnerItems = (partnerMembershipsByProfile.get(profile.id) ?? []).sort((left, right) =>
      (left.partnerName ?? "").localeCompare(right.partnerName ?? "", undefined, {
        sensitivity: "base",
      })
    );
    const clientItems = (clientMembershipsByProfile.get(profile.id) ?? []).sort((left, right) =>
      (left.clientName ?? "").localeCompare(right.clientName ?? "", undefined, {
        sensitivity: "base",
      })
    );

    return {
      type: "profile",
      id: profile.id,
      email: profile.email,
      displayName: resolveDisplayName(profile),
      role: String(profile.role) as StaffProfileRole,
      isActive: Boolean(profile.is_active),
      createdAt: profile.created_at,
      partnerMemberships: partnerItems,
      clientMemberships: clientItems,
    };
  });

  const inviteItems: InviteListItem[] = invites.map((invite) => ({
    type: "invite",
    id: invite.id,
    email: invite.email,
    role: invite.role,
    tenantType: invite.tenant_type,
    tenantId: invite.tenant_id,
    tenantName:
      invite.tenant_type === "partner"
        ? invite.tenant_id
          ? partnerNameMap.get(invite.tenant_id) ?? null
          : null
        : invite.tenant_type === "client"
          ? invite.tenant_id
            ? clientNameMap.get(invite.tenant_id) ?? null
            : null
          : null,
    expiresAt: invite.expires_at,
    createdAt: invite.created_at,
  }));

  return [...profileItems, ...inviteItems].sort((left, right) =>
    sortByLabelThenDate(
      {
        label: left.type === "profile" ? left.displayName ?? left.email : left.email,
        createdAt: left.createdAt,
      },
      {
        label: right.type === "profile" ? right.displayName ?? right.email : right.email,
        createdAt: right.createdAt,
      }
    )
  );
}

export async function getUserDetail(profileId: string): Promise<UserDetail | null> {
  await requireAdminScope();

  const parsedProfileId = profileIdSchema.parse(profileId);
  const db = createAdminClient();
  const [profileResult, partnerMembershipsResult, clientMembershipsResult] = await Promise.all([
    db
      .from("profiles")
      .select(
        "id, email, display_name, first_name, last_name, role, is_active, created_at"
      )
      .eq("id", parsedProfileId)
      .maybeSingle(),
    db
      .from("partner_memberships")
      .select("id, profile_id, partner_id, role, created_at, revoked_at")
      .eq("profile_id", parsedProfileId),
    db
      .from("client_memberships")
      .select("id, profile_id, client_id, role, created_at, revoked_at")
      .eq("profile_id", parsedProfileId),
  ]);

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }
  if (partnerMembershipsResult.error) {
    throw new Error(partnerMembershipsResult.error.message);
  }
  if (clientMembershipsResult.error) {
    throw new Error(clientMembershipsResult.error.message);
  }

  const profile = profileResult.data as ProfileRow | null;
  if (!profile || !isStaffProfileRole(String(profile.role))) {
    return null;
  }

  const partnerMemberships = (partnerMembershipsResult.data ?? []) as PartnerMembershipRow[];
  const clientMemberships = (clientMembershipsResult.data ?? []) as ClientMembershipRow[];
  const [partnerNameMap, clientNameMap] = await Promise.all([
    loadPartnerNameMap(
      db,
      unique(partnerMemberships.map((membership) => membership.partner_id))
    ),
    loadClientNameMap(
      db,
      unique(clientMemberships.map((membership) => membership.client_id))
    ),
  ]);

  const partnerMembershipDetails: PartnerMembershipDetail[] = partnerMemberships
    .map((membership) => ({
      id: membership.id,
      partnerId: membership.partner_id,
      partnerName: partnerNameMap.get(membership.partner_id) ?? null,
      role: membership.role,
      createdAt: membership.created_at,
      revokedAt: membership.revoked_at,
    }))
    .sort((left, right) =>
      sortDetailMembershipsByStatusAndName(
        {
          name: left.partnerName,
          revokedAt: left.revokedAt,
          createdAt: left.createdAt,
        },
        {
          name: right.partnerName,
          revokedAt: right.revokedAt,
          createdAt: right.createdAt,
        }
      )
    );

  const clientMembershipDetails: ClientMembershipDetail[] = clientMemberships
    .map((membership) => ({
      id: membership.id,
      clientId: membership.client_id,
      clientName: clientNameMap.get(membership.client_id) ?? null,
      role: membership.role,
      createdAt: membership.created_at,
      revokedAt: membership.revoked_at,
    }))
    .sort((left, right) =>
      sortDetailMembershipsByStatusAndName(
        {
          name: left.clientName,
          revokedAt: left.revokedAt,
          createdAt: left.createdAt,
        },
        {
          name: right.clientName,
          revokedAt: right.revokedAt,
          createdAt: right.createdAt,
        }
      )
    );

  return {
    id: profile.id,
    email: profile.email,
    displayName: resolveDisplayName(profile),
    role: String(profile.role) as StaffProfileRole,
    isActive: Boolean(profile.is_active),
    createdAt: profile.created_at,
    partnerMemberships: partnerMembershipDetails,
    clientMemberships: clientMembershipDetails,
  };
}

export async function getInviteDetail(inviteId: string): Promise<InviteDetail | null> {
  await requireAdminScope();

  const parsedInviteId = inviteIdSchema.parse(inviteId);
  const db = createAdminClient();
  const { data, error } = await db
    .from("user_invites")
    .select("id, email, tenant_type, tenant_id, role, expires_at, created_at, accepted_at, revoked_at")
    .eq("id", parsedInviteId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const invite = (data ?? null) as InviteRow | null;
  if (!invite) {
    return null;
  }

  let tenantName: string | null = null;

  if (invite.tenant_type === "partner" && invite.tenant_id) {
    const { data: partnerData, error: partnerError } = await db
      .from("partners")
      .select("name")
      .eq("id", invite.tenant_id)
      .maybeSingle();

    if (partnerError) {
      throw new Error(partnerError.message);
    }

    tenantName = partnerData?.name ? String(partnerData.name) : null;
  }

  if (invite.tenant_type === "client" && invite.tenant_id) {
    const { data: clientData, error: clientError } = await db
      .from("clients")
      .select("name")
      .eq("id", invite.tenant_id)
      .maybeSingle();

    if (clientError) {
      throw new Error(clientError.message);
    }

    tenantName = clientData?.name ? String(clientData.name) : null;
  }

  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    tenantType: invite.tenant_type,
    tenantId: invite.tenant_id,
    tenantName,
    createdAt: invite.created_at,
    expiresAt: invite.expires_at,
    acceptedAt: invite.accepted_at,
    revokedAt: invite.revoked_at,
  };
}

export async function updateUserRole(
  profileId: string,
  role: StaffProfileRole
): Promise<MutationResult> {
  try {
    const scope = await requireAdminScope();
    const parsedProfileId = profileIdSchema.parse(profileId);
    const parsedRole = profileRoleSchema.parse(role);
    const db = createAdminClient();

    const { data: existing, error: existingError } = await db
      .from("profiles")
      .select("id, role")
      .eq("id", parsedProfileId)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (!existing) {
      return { error: "User not found." };
    }

    const previousRole = String(existing.role);
    if (previousRole === parsedRole) {
      return { success: true };
    }

    const { error } = await db
      .from("profiles")
      .update({ role: parsedRole })
      .eq("id", parsedProfileId);

    if (error) {
      throw new Error(error.message);
    }

    await logAuditEvent({
      actorProfileId: scope.actor?.id ?? null,
      eventType: "staff_user.role_changed",
      targetTable: "profiles",
      targetId: parsedProfileId,
      metadata: {
        previousRole,
        nextRole: parsedRole,
      },
    });

    revalidatePath("/users");
    revalidatePath(`/users/${parsedProfileId}`);

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update user role.",
    };
  }
}

export async function addMembership(
  profileId: string,
  tenantType: "partner" | "client",
  tenantId: string,
  role: MembershipRole
): Promise<MutationResult> {
  try {
    const scope = await requireAdminScope();
    const parsedProfileId = profileIdSchema.parse(profileId);
    const parsedTenantType = tenantTypeSchema.parse(tenantType);
    const parsedTenantId = tenantIdSchema.parse(tenantId);
    const parsedRole = membershipRoleSchema.parse(role);
    const db = createAdminClient();
    const tenantColumn =
      parsedTenantType === "partner" ? "partner_id" : "client_id";
    const table =
      parsedTenantType === "partner" ? "partner_memberships" : "client_memberships";

    const { data: existing, error: existingError } = await db
      .from(table)
      .select(`id, profile_id, ${tenantColumn}, role, revoked_at`)
      .eq("profile_id", parsedProfileId)
      .eq(tenantColumn, parsedTenantId)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existing && !existing.revoked_at) {
      return { error: "Membership already exists." };
    }

    const payload =
      parsedTenantType === "partner"
        ? {
            profile_id: parsedProfileId,
            partner_id: parsedTenantId,
            role: parsedRole,
            is_default: false,
            created_by: scope.actor?.id ?? null,
            revoked_at: null,
            revoked_by_profile_id: null,
          }
        : {
            profile_id: parsedProfileId,
            client_id: parsedTenantId,
            role: parsedRole,
            is_default: false,
            created_by: scope.actor?.id ?? null,
            revoked_at: null,
            revoked_by_profile_id: null,
          };

    const { data: upserted, error: upsertError } = await db
      .from(table)
      .upsert(payload, {
        onConflict:
          parsedTenantType === "partner" ? "profile_id,partner_id" : "profile_id,client_id",
      })
      .select("id")
      .single();

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    await logAuditEvent({
      actorProfileId: scope.actor?.id ?? null,
      eventType: `${parsedTenantType}_membership.created`,
      targetTable: table,
      targetId: String(upserted.id),
      partnerId: parsedTenantType === "partner" ? parsedTenantId : null,
      clientId: parsedTenantType === "client" ? parsedTenantId : null,
      metadata: {
        profileId: parsedProfileId,
        role: parsedRole,
        reactivated: Boolean(existing?.revoked_at),
      },
    });

    revalidatePath("/users");
    revalidatePath(`/users/${parsedProfileId}`);

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to add membership.",
    };
  }
}

export async function updateMembershipRole(
  membershipId: string,
  tenantType: "partner" | "client",
  role: MembershipRole
): Promise<MutationResult> {
  try {
    const scope = await requireAdminScope();
    const parsedMembershipId = membershipIdSchema.parse(membershipId);
    const parsedTenantType = tenantTypeSchema.parse(tenantType);
    const parsedRole = membershipRoleSchema.parse(role);
    const db = createAdminClient();
    const table =
      parsedTenantType === "partner" ? "partner_memberships" : "client_memberships";
    const select =
      parsedTenantType === "partner"
        ? "id, profile_id, partner_id, role, revoked_at"
        : "id, profile_id, client_id, role, revoked_at";

    const { data: existing, error: existingError } = await db
      .from(table)
      .select(select)
      .eq("id", parsedMembershipId)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (!existing || existing.revoked_at) {
      return { error: "Membership not found." };
    }

    const previousRole = String(existing.role);
    if (previousRole === parsedRole) {
      return { success: true };
    }

    const { error } = await db
      .from(table)
      .update({ role: parsedRole })
      .eq("id", parsedMembershipId)
      .is("revoked_at", null);

    if (error) {
      throw new Error(error.message);
    }

    await logAuditEvent({
      actorProfileId: scope.actor?.id ?? null,
      eventType: `${parsedTenantType}_membership.role_changed`,
      targetTable: table,
      targetId: parsedMembershipId,
      partnerId:
        parsedTenantType === "partner" && "partner_id" in existing
          ? String(existing.partner_id)
          : null,
      clientId:
        parsedTenantType === "client" && "client_id" in existing
          ? String(existing.client_id)
          : null,
      metadata: {
        previousRole,
        nextRole: parsedRole,
        profileId: String(existing.profile_id),
      },
    });

    revalidatePath("/users");
    revalidatePath(`/users/${String(existing.profile_id)}`);

    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update membership role.",
    };
  }
}

export async function resendInvite(inviteId: string): Promise<
  | {
      success: true;
      inviteLink: string;
    }
  | {
      error: string;
    }
> {
  try {
    const scope = await requireAdminScope();
    const parsedInviteId = inviteIdSchema.parse(inviteId);
    const db = createAdminClient();
    const { data: invite, error: inviteError } = await db
      .from("user_invites")
      .select("id, email, tenant_type, tenant_id, role, expires_at, accepted_at, revoked_at")
      .eq("id", parsedInviteId)
      .maybeSingle();

    if (inviteError) {
      throw new Error(inviteError.message);
    }

    const inviteRow = (invite ?? null) as InviteRow | null;
    if (!inviteRow) {
      return { error: "Invite not found." };
    }

    if (inviteRow.accepted_at) {
      return { error: "Accepted invites cannot be resent." };
    }

    if (inviteRow.revoked_at) {
      return { error: "Revoked invites cannot be resent." };
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    const { error } = await db
      .from("user_invites")
      .update({
        invite_token_hash: hashInviteToken(token),
        expires_at: expiresAt,
      })
      .eq("id", parsedInviteId);

    if (error) {
      throw new Error(error.message);
    }

    await logAuditEvent({
      actorProfileId: scope.actor?.id ?? null,
      eventType: "staff_invite.resent",
      targetTable: "user_invites",
      targetId: parsedInviteId,
      partnerId:
        inviteRow.tenant_type === "partner" ? inviteRow.tenant_id : null,
      clientId:
        inviteRow.tenant_type === "client" ? inviteRow.tenant_id : null,
      metadata: {
        email: inviteRow.email,
        tenantType: inviteRow.tenant_type,
        role: inviteRow.role,
        previousExpiresAt: inviteRow.expires_at,
        nextExpiresAt: expiresAt,
      },
    });

    revalidatePath("/users");
    revalidatePath(`/users/invite/${parsedInviteId}`);

    const { inviteLink } = await sendStaffInviteEmail({
      email: inviteRow.email,
      inviteToken: token,
      tenantType: inviteRow.tenant_type,
      tenantId: inviteRow.tenant_id,
    });

    return {
      success: true,
      inviteLink,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to resend invite.",
    };
  }
}

// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------

export async function bulkDeleteUsers(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await requireAdminScope()
  const db = createAdminClient()
  const { error } = await db
    .from('profiles')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/users')
}

export async function bulkUpdateUserStatus(ids: string[], status: 'active' | 'inactive'): Promise<void> {
  if (ids.length === 0) return
  await requireAdminScope()
  const db = createAdminClient()
  const { error } = await db
    .from('profiles')
    .update({ status })
    .in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/users')
}
