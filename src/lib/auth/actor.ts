import { cache } from "react";
import { cookies } from "next/headers";
import {
  ACTIVE_CONTEXT_COOKIE,
  PREVIEW_CONTEXT_COOKIE,
  decodeActiveContext,
  decodePreviewContext,
} from "@/lib/auth/active-context";
import type {
  ActiveContext,
  ClientMembershipRecord,
  PartnerMembershipRecord,
  PreviewContext,
  ResolvedActor,
} from "@/lib/auth/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedUserId } from "@/lib/auth/claims";

function mapPartnerMembership(row: Record<string, unknown>): PartnerMembershipRecord {
  return {
    id: String(row.id),
    partnerId: String(row.partner_id),
    role: (row.role as PartnerMembershipRecord["role"]) ?? "member",
    isDefault: Boolean(row.is_default),
    createdAt: String(row.created_at),
  };
}

function mapClientMembership(row: Record<string, unknown>): ClientMembershipRecord {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    role: (row.role as ClientMembershipRecord["role"]) ?? "member",
    isDefault: Boolean(row.is_default),
    createdAt: String(row.created_at),
  };
}

export async function resolveSignedActiveContext(): Promise<ActiveContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACTIVE_CONTEXT_COOKIE)?.value;
  return decodeActiveContext(token);
}

export async function resolveSignedPreviewContext(): Promise<PreviewContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PREVIEW_CONTEXT_COOKIE)?.value;
  return decodePreviewContext(token);
}

async function resolveSessionActorImpl(): Promise<ResolvedActor | null> {
  const supabase = await createServerSupabaseClient();
  // Local JWT verification — the profile lookup below is the freshness
  // check (deactivated users fail isActive) so a network getUser() here
  // would only duplicate it.
  const userId = await getVerifiedUserId(supabase);

  if (!userId) return null;

  const db = createAdminClient();
  // Fetch the profile and its active memberships in one database snapshot.
  // Pin each join to profile_id: created_by/revoked_by also reference profiles.
  // Left joins retain platform admins and accounts with no memberships.
  const [profileResult, activeContext] = await Promise.all([
    db
      .from("profiles")
      .select(`
        id, email, role, display_name, is_active,
        partner_memberships!partner_memberships_profile_id_fkey(
          id, partner_id, role, is_default, created_at
        ),
        client_memberships!client_memberships_profile_id_fkey(
          id, client_id, role, is_default, created_at
        )
      `)
      .eq("id", userId)
      .is("partner_memberships.revoked_at", null)
      .is("client_memberships.revoked_at", null)
      .single(),
    resolveSignedActiveContext(),
  ]);

  if (profileResult.error || !profileResult.data) {
    return null;
  }

  return {
    id: profileResult.data.id,
    email: profileResult.data.email,
    role: profileResult.data.role,
    displayName: profileResult.data.display_name,
    isActive: profileResult.data.is_active,
    partnerMemberships: (profileResult.data.partner_memberships ?? []).map(mapPartnerMembership),
    clientMemberships: (profileResult.data.client_memberships ?? []).map(mapClientMembership),
    activeContext,
  };
}

export const resolveSessionActor = cache(resolveSessionActorImpl);
