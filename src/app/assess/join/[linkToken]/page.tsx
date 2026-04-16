import { getCachedEffectiveExperience } from "@/app/actions/experience";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { getPageContent } from "@/lib/experience/resolve";
import { generateCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults";
import { createAdminClient } from "@/lib/supabase/admin";
import { JoinForm } from "@/components/assess/join-form";

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
    .select("campaign_id, campaigns(client_id)")
    .eq("token", linkToken)
    .eq("is_active", true)
    .maybeSingle();

  const linkRow = link as
    | {
        campaign_id: string | null;
        campaigns:
          | { client_id: string | null }
          | Array<{ client_id: string | null }>
          | null;
      }
    | null;
  const campaignRow = Array.isArray(linkRow?.campaigns)
    ? linkRow.campaigns[0]
    : linkRow?.campaigns;
  const campaignId = linkRow?.campaign_id ?? undefined;
  const clientId = campaignRow?.client_id ?? undefined;

  const [experience, brandConfig] = await Promise.all([
    getCachedEffectiveExperience(campaignId),
    getCachedEffectiveBrand(clientId, campaignId),
  ]);

  const content = getPageContent(experience, "join");
  const isCustomBrand = brandConfig.name !== TRAJECTAS_DEFAULTS.name;

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
        isCustomBrand={isCustomBrand}
      />
    </>
  );
}
