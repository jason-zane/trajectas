/**
 * Template cascade resolution module.
 *
 * Resolves the correct email template for a given type and organisational
 * scope by walking the cascade: client → partner → platform.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { EmailType, EmailTemplateScope } from "@/lib/email/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailTemplateRecord {
  id: string;
  type: EmailType;
  scope_type: EmailTemplateScope;
  scope_id: string | null;
  subject: string;
  preview_text: string | null;
  editor_json: Record<string, unknown>;
  html_cache: string;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// findTemplate — single DB lookup
// ---------------------------------------------------------------------------

/**
 * Performs a single database lookup for an email template matching the given
 * type, scope type, and optional scope id.
 *
 * Returns the record if found, or null if no active template exists.
 */
export async function findTemplate(
  type: EmailType,
  scopeType: EmailTemplateScope,
  scopeId: string | null
): Promise<EmailTemplateRecord | null> {
  const admin = createAdminClient();

  let query = admin
    .from("email_templates")
    .select("*")
    .eq("type", type)
    .eq("scope_type", scopeType)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (scopeId !== null) {
    query = query.eq("scope_id", scopeId);
  } else {
    query = query.is("scope_id", null);
  }

  const { data } = await query.maybeSingle();
  return (data as EmailTemplateRecord | null) ?? null;
}

// ---------------------------------------------------------------------------
// resolveTemplate — cascade resolution
// ---------------------------------------------------------------------------

export interface ResolveTemplateOptions {
  clientId?: string;
  partnerId?: string;
}

/**
 * Resolves the most-specific active email template for a given type by
 * walking the cascade from most to least specific:
 *
 *   client → partner → platform
 *
 * Returns the first matching template, or null if none found at any level.
 */
export async function resolveTemplate(
  type: EmailType,
  { clientId, partnerId }: ResolveTemplateOptions
): Promise<EmailTemplateRecord | null> {
  if (clientId) {
    const template = await findTemplate(type, "client", clientId);
    if (template) return template;
  }

  if (partnerId) {
    const template = await findTemplate(type, "partner", partnerId);
    if (template) return template;
  }

  return findTemplate(type, "platform", null);
}
