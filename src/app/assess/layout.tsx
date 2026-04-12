import type { Metadata } from "next";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import type { BrandConfig } from "@/lib/brand/types";

interface AssessLayoutProps {
  children: React.ReactNode;
}

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Assessment runner layout.
 *
 * This layout:
 * 1. Resolves the brand config (org-specific or platform default)
 * 2. Generates CSS tokens and injects them via <style>
 * 3. Loads any custom Google Fonts
 * 4. Renders the outer shell
 *
 * Brand tokens are passed down via CSS custom properties so all child
 * components can reference --brand-primary, --brand-surface, etc.
 */
export default async function AssessLayout({ children }: AssessLayoutProps) {
  // Load the platform brand as the baseline. Child pages (section runner)
  // will override with org-specific tokens via inline style when needed.
  const brandConfig: BrandConfig = await getCachedEffectiveBrand();

  const { css: lightCss } = generateCSSTokens(brandConfig);
  const darkCss = brandConfig.darkModeEnabled
    ? generateDarkCSSTokens(brandConfig)
    : "";

  // Build Google Fonts URL for custom fonts
  const fontsUrl = buildGoogleFontsUrl([
    brandConfig.headingFont,
    brandConfig.bodyFont,
    brandConfig.monoFont,
  ]);

  // CSS is generated server-side from trusted brand config, not user HTML
  const brandCss = `${lightCss}\n${darkCss}`;

  return (
    <>
      {/* Inject brand CSS tokens — content is server-generated from DB config */}
      <style dangerouslySetInnerHTML={{ __html: brandCss }} />

      {/* Load custom Google Fonts if needed */}
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

      <div
        className="flex min-h-dvh flex-col"
        style={{
          background: "var(--brand-neutral-50, hsl(var(--background)))",
          fontFamily: "var(--brand-font-body, inherit)",
        }}
      >
        {children}
      </div>
    </>
  );
}
