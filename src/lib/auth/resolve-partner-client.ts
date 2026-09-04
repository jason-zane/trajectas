import { notFound, redirect } from "next/navigation";

import { getClientBySlug } from "@/app/actions/clients";
import {
  canManageClient,
  resolveAuthorizedScope,
  type AuthorizedScope,
} from "@/lib/auth/authorization";
import { resolvePartnerOrg } from "@/lib/auth/resolve-partner-org";
import type { Client } from "@/types/database";

/**
 * Resolve a client for the partner console at /partner/clients/[slug].
 *
 * Three conditions, all required: the slug names a real client, that client
 * belongs to the partner whose workspace the caller is in, and the caller may
 * manage it (`canManageClient` — partner admins, not partner members). A
 * mismatch redirects rather than 404s so a partner never learns whether a slug
 * exists under some other partner.
 */
export async function requirePartnerClient(slug: string): Promise<{
  client: Client;
  partnerId: string;
  scope: AuthorizedScope;
}> {
  const [{ partnerId }, client, scope] = await Promise.all([
    resolvePartnerOrg(`/partner/clients/${slug}`),
    getClientBySlug(slug, { includeArchived: true }),
    resolveAuthorizedScope(),
  ]);

  if (!client) notFound();

  if (!partnerId || client.partnerId !== partnerId || !canManageClient(scope, client.id)) {
    redirect("/unauthorized?reason=membership");
  }

  return { client, partnerId, scope };
}
