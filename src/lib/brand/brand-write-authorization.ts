import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  AuthorizationError,
  type AuthorizedScope,
} from "@/lib/auth/authorization";

/**
 * Who may WRITE a client's brand layer (decision D5 of the partner
 * self-service plan), over and above `canManageClient`:
 *
 * - platform admins: always — the admin console configures branding for a
 *   client whether or not the client may self-serve
 * - a partner admin (managing through the partner that owns the client): only
 *   while the partner's `can_customize_branding` flag is on
 * - a client admin (direct membership, or a client-target support session):
 *   only while the client's flag is on AND the partner's flag (if the client
 *   has a partner) is on — the same rule the client portal applies before it
 *   renders the editor (`isClientBrandingEnabled`)
 *
 * Reads (previews, effective-brand resolution) are not gated by the flags.
 * Call this after `canManageClient` has passed; it does not re-check access.
 */
export async function assertCanEditClientBrand(
  scope: AuthorizedScope,
  clientId: string
): Promise<void> {
  if (scope.isPlatformAdmin) return;

  const db = createAdminClient();
  const { data: client, error } = await db
    .from("clients")
    .select("can_customize_branding, partner_id")
    .eq("id", clientId)
    .single();
  if (error || !client) {
    throw new AuthorizationError("Client not found or inaccessible.");
  }

  const partnerId = client.partner_id ? String(client.partner_id) : null;
  let partnerFlag = true;
  if (partnerId) {
    const { data: partner, error: partnerError } = await db
      .from("partners")
      .select("can_customize_branding")
      .eq("id", partnerId)
      .single();
    if (partnerError) {
      throw new AuthorizationError("Partner not found or inaccessible.");
    }
    partnerFlag = Boolean(partner?.can_customize_branding);
  }

  const viaPartner = partnerId != null && scope.partnerAdminIds.includes(partnerId);
  if (viaPartner) {
    if (!partnerFlag) {
      throw new AuthorizationError(
        "Brand customisation is not enabled for your partner. Contact Trajectas to enable it."
      );
    }
    return;
  }

  if (!client.can_customize_branding || !partnerFlag) {
    throw new AuthorizationError(
      "Brand customisation is not enabled for this client."
    );
  }
}
