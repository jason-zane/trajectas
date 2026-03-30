import { cookies } from "next/headers";
import { decodeActiveContext, ACTIVE_CONTEXT_COOKIE } from "@/lib/auth/active-context";
import type {
  ActiveContext,
  ClientMembershipRecord,
  PartnerMembershipRecord,
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
    clientId: String(row.organization_id),
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

export async function resolveSessionActor(): Promise<ResolvedActor | null> {
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
        .select("id, email, role")
        .eq("id", user.id)
        .single(),
      db
        .from("partner_memberships")
        .select("id, partner_id, role, is_default, created_at")
        .eq("profile_id", user.id),
      db
        .from("client_memberships")
        .select("id, organization_id, role, is_default, created_at")
        .eq("profile_id", user.id),
      resolveSignedActiveContext(),
    ]);

  if (profileResult.error || !profileResult.data) {
    return null;
  }

  return {
    id: profileResult.data.id,
    email: profileResult.data.email,
    role: profileResult.data.role,
    partnerMemberships: (partnerMembershipResult.data ?? []).map(mapPartnerMembership),
    clientMemberships: (clientMembershipResult.data ?? []).map(mapClientMembership),
    activeContext,
  };
}
