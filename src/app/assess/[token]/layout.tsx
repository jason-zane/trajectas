import { validateAccessToken } from "@/app/actions/assess";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { generateCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";

/**
 * Token-scoped layout.
 *
 * Injects org-specific brand CSS so that loading screens (loading.tsx) and all
 * child pages render with the correct campaign brand rather than Trajectas defaults.
 *
 * validateAccessToken uses React cache() so this call is deduplicated with any
 * identical call made by the child page in the same render.
 */
export default async function TokenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let brandCss = "";
  let fontsUrl: string | null = null;

  try {
    const result = await validateAccessToken(token);
    if (result.data?.campaign) {
      const { campaign } = result.data;
      const brandConfig = await getCachedEffectiveBrand(
        campaign.clientId,
        campaign.id,
      );
      brandCss = generateCSSTokens(brandConfig).css;
      fontsUrl = buildGoogleFontsUrl([
        brandConfig.headingFont,
        brandConfig.bodyFont,
        brandConfig.monoFont,
      ]);
    }
  } catch {
    // Fall through — parent assess/layout.tsx already injected platform defaults
  }

  return (
    <>
      {brandCss && <style dangerouslySetInnerHTML={{ __html: brandCss }} />}
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}
      {children}
    </>
  );
}
