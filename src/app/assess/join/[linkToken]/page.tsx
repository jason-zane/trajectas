import { getEffectiveExperience } from "@/app/actions/experience";
import { getEffectiveBrand } from "@/app/actions/brand";
import { getPageContent } from "@/lib/experience/resolve";
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults";
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkRow = link as any;
  const campaignId = linkRow?.campaign_id ?? undefined;
  const clientId = linkRow?.campaigns?.client_id ?? undefined;

  const [experience, brandConfig] = await Promise.all([
    getEffectiveExperience(campaignId),
    getEffectiveBrand(clientId, campaignId),
  ]);

  const content = getPageContent(experience, "join");
  const isCustomBrand = brandConfig.name !== TALENT_FIT_DEFAULTS.name;

  // Brand CSS tokens are generated from admin-controlled brand config values
  // (color hex codes, font names, border radius) — not user-supplied content.
  const { css: lightCss } = generateCSSTokens(brandConfig);
  const darkCss = brandConfig.darkModeEnabled
    ? generateDarkCSSTokens(brandConfig)
    : "";
  const safeCSS = `${lightCss}\n${darkCss}`;

  const fontsUrl = buildGoogleFontsUrl([
    brandConfig.headingFont,
    brandConfig.bodyFont,
    brandConfig.monoFont,
  ]);

  return (
    <>
      {/* eslint-disable-next-line react/no-danger -- CSS tokens from admin-controlled brand config, not user input */}
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
