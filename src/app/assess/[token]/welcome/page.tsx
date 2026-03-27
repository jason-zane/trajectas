import { redirect } from "next/navigation";
import { validateAccessToken } from "@/app/actions/assess";
import { getEffectiveBrand } from "@/app/actions/brand";
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults";
import { WelcomeScreen } from "@/components/assess/welcome-screen";

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await validateAccessToken(token);

  if (result.error) {
    redirect("/assess/expired");
  }

  const { campaign, candidate, assessments, sessions } = result.data!;

  // Load brand config for the campaign's organization
  const brandConfig = await getEffectiveBrand(campaign.organizationId);
  const isCustomBrand = brandConfig.name !== TALENT_FIT_DEFAULTS.name;

  // Generate org-specific CSS tokens
  const { css: lightCss } = generateCSSTokens(brandConfig);
  const darkCss = brandConfig.darkModeEnabled
    ? generateDarkCSSTokens(brandConfig)
    : "";

  // CSS is server-generated from trusted DB brand config, not user HTML
  const brandCss = `${lightCss}\n${darkCss}`;

  const fontsUrl = buildGoogleFontsUrl([
    brandConfig.headingFont,
    brandConfig.bodyFont,
    brandConfig.monoFont,
  ]);

  return (
    <>
      {/* Server-generated CSS custom properties from DB brand config */}
      <style dangerouslySetInnerHTML={{ __html: brandCss }} />
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

      <WelcomeScreen
        token={token}
        campaignTitle={campaign.title}
        campaignDescription={campaign.description}
        assessmentCount={assessments.length}
        candidateFirstName={candidate.firstName}
        hasInProgressSession={sessions.some((s) => s.status === "in_progress")}
        allowResume={campaign.allowResume}
        brandLogoUrl={brandConfig.logoUrl}
        brandName={brandConfig.name}
        isCustomBrand={isCustomBrand}
      />
    </>
  );
}
