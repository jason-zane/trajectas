import { getCachedEffectiveExperience } from "@/app/actions/experience";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { getPageContent } from "@/lib/experience/resolve";
import { generateCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
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

  // Look up the access link to get campaign context for branding
  const db = createAdminClient();
  const { data: link } = await db
    .from("campaign_access_links")
    .select("campaign_id, campaigns(*), campaigns(client_id)")
    .eq("token", linkToken)
    .eq("is_active", true)
    .maybeSingle();

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

  // Brand CSS tokens are generated from admin-controlled brand config values
  // (color hex codes, font names, border radius) — not user-supplied content.
  const { css: safeCSS } = generateCSSTokens(brandConfig);

  const fontsUrl = buildGoogleFontsUrl([
    brandConfig.headingFont,
    brandConfig.bodyFont,
    brandConfig.monoFont,
  ]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: safeCSS }} />
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}
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
