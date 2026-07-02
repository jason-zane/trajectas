import { getCachedEffectiveExperience } from "@/app/actions/experience";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { getPageContent } from "@/lib/experience/resolve";
import { generateCSSTokens } from "@/lib/brand/tokens";
import { generateRunnerTokens } from "@/lib/brand/runner-tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapCampaignRow } from "@/lib/supabase/mappers";
import { JoinForm } from "@/components/assess/join-form";
import type { Campaign } from "@/types/database";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ linkToken: string }>;
}) {
  const { linkToken } = await params;

  // Look up the access link to get campaign context for branding. The
  // embedded `campaigns(*)` already carries client_id — do NOT add a second
  // `campaigns(...)` embed: PostgREST rejects a duplicated relationship
  // ("table name specified more than once", 42712), which silently nulls the
  // result and drops the page back to platform branding.
  const db = createAdminClient();
  const { data: link, error: linkError } = await db
    .from("campaign_access_links")
    .select("campaign_id, campaigns(*)")
    .eq("token", linkToken)
    .eq("is_active", true)
    .maybeSingle();

  if (linkError) {
    // Branding resolution must not fail silently — a broken lookup here means
    // participants see the wrong brand. Surface it in server logs.
    console.error("[assess/join] access link lookup failed", linkError);
  }

  const linkRow = link as
    | {
        campaign_id: string | null;
        campaigns: Record<string, unknown> | Record<string, unknown>[] | null;
      }
    | null;
  const campaignId = linkRow?.campaign_id ?? undefined;
  let campaign: Campaign | undefined;

  // Extract campaign client_id for branding lookup
  let clientId: string | undefined;
  if (linkRow?.campaigns) {
    if (Array.isArray(linkRow.campaigns)) {
      const campaignRow = linkRow.campaigns[0];
      if (campaignRow) {
        campaign = mapCampaignRow(campaignRow);
        clientId = (campaignRow as Record<string, unknown>)
          .client_id as string | undefined;
      }
    } else {
      campaign = mapCampaignRow(linkRow.campaigns);
      clientId = (linkRow.campaigns as Record<string, unknown>)
        .client_id as string | undefined;
    }
  }

  const [experience, brandConfig] = await Promise.all([
    getCachedEffectiveExperience(campaignId),
    getCachedEffectiveBrand(clientId, campaignId),
  ]);

  const content = getPageContent(experience, "join");

  // The join route sits beside /assess/[token] rather than under it, so it
  // never passes through [token]/layout.tsx — the parent assess/layout only
  // injects the PLATFORM default tokens. We must therefore override BOTH the
  // legacy --brand-* tokens AND the --runner-* tokens (which drive the
  // re-skinned join form) with the campaign-resolved brand here, or the join
  // page renders in Trajectas branding while every later page is on-brand.
  //
  // Tokens are generated from admin-controlled brand config values (hex
  // colours, border radius, theme mode) — not user-supplied content. The
  // runner type stack is fixed and already loaded by the root layout, so no
  // brand fonts are loaded here.
  const brandCss = generateCSSTokens(brandConfig).css;
  const runnerCss = generateRunnerTokens(brandConfig).css;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: brandCss }} />
      <style dangerouslySetInnerHTML={{ __html: runnerCss }} />
      <JoinForm
        linkToken={linkToken}
        content={content}
        brandLogoUrl={brandConfig.logoUrl}
        brandName={brandConfig.name}
        campaign={campaign}
        privacyUrl={experience.privacyUrl}
      />
    </>
  );
}
