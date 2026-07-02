import { validateAccessToken } from "@/app/actions/assess";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { generateCSSTokens } from "@/lib/brand/tokens";
import { generateRunnerTokens } from "@/lib/brand/runner-tokens";

/**
 * Token-scoped layout.
 *
 * Injects the campaign-resolved brand + runner CSS so that loading screens
 * (loading.tsx) and all child pages render with the correct campaign brand
 * (including its runnerTheme mode) rather than Trajectas defaults.
 *
 * Fonts are NOT loaded here: the runner type stack is fixed and already
 * loaded by the parent assess layout.
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
  let runnerCss = "";

  try {
    const result = await validateAccessToken(token);
    if (result.data?.campaign) {
      const { campaign } = result.data;
      const brandConfig = await getCachedEffectiveBrand(
        campaign.clientId,
        campaign.id,
      );
      brandCss = generateCSSTokens(brandConfig).css;
      runnerCss = generateRunnerTokens(brandConfig).css;
    }
  } catch {
    // Fall through — parent assess/layout.tsx already injected platform defaults
  }

  return (
    <>
      {brandCss && <style dangerouslySetInnerHTML={{ __html: brandCss }} />}
      {runnerCss && <style dangerouslySetInnerHTML={{ __html: runnerCss }} />}
      {children}
    </>
  );
}
