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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const db = createAdminClient();
  const [profileResult, partnerMembershipResult, clientMembershipResult, activeContext] =
    await Promise.all([
      db
        .from("profiles")
        .select("id, email, role, display_name, is_active")
        .eq("id", user.id)
        .single(),
      db
        .from("partner_memberships")
        .select("id, partner_id, role, is_default, created_at")
        .eq("profile_id", user.id)
        .is("revoked_at", null),
      db
        .from("client_memberships")
        .select("id, client_id, role, is_default, created_at")
        .eq("profile_id", user.id)
        .is("revoked_at", null),
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
    partnerMemberships: (partnerMembershipResult.data ?? []).map(mapPartnerMembership),
    clientMemberships: (clientMembershipResult.data ?? []).map(mapClientMembership),
    activeContext,
  };
}

export const resolveSessionActor = cache(resolveSessionActorImpl);
