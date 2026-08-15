import type { Metadata } from "next";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { generateCSSTokens } from "@/lib/brand/tokens";
import { generateRunnerTokens } from "@/lib/brand/runner-tokens";
import { ForceLightTheme } from "@/components/force-light-theme";
import type { BrandConfig } from "@/lib/brand/types";

interface AssessLayoutProps {
  children: React.ReactNode;
}

// Brand config is resolved per-tenant from the database at request time;
// these routes cannot be statically prerendered (the build runs without
// Supabase env vars and the brand fetch would fail). Forcing dynamic at
// the layout level cascades to every /assess/* page.
export const dynamic = "force-dynamic";

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
  // Load the platform brand as the baseline. The token-scoped child layout
  // overrides with the campaign-resolved brand when a token is present.
  const brandConfig: BrandConfig = await getCachedEffectiveBrand();

  // Legacy --brand-* tokens (still consumed by report views and any screen
  // not yet on the runner design system).
  const { css: brandCss } = generateCSSTokens(brandConfig);

  // --runner-* tokens: four-anchor derivation + resolved theme mode
  // (dark by default; brands can flip runnerTheme to light).
  const { css: runnerCss, mode } = generateRunnerTokens(brandConfig);

  return (
    <>
      {/* Inject brand + runner CSS tokens — server-generated from DB config */}
      <style dangerouslySetInnerHTML={{ __html: brandCss }} />
      <style dangerouslySetInnerHTML={{ __html: runnerCss }} />

      {/* Runner type stack (Source Serif 4 / Plus Jakarta Sans / Geist Mono)
          is fixed and self-hosted via next/font/local in the root layout
          (woff2 vendored under src/app/fonts) — brand fonts do not apply
          to the runner. */}

      {/* Keep dashboard dark-class from leaking into --brand-* fallbacks
          on screens not yet migrated to --runner-* tokens. */}
      <ForceLightTheme />
      <div
        data-runner-theme={mode}
        className="flex min-h-dvh flex-col"
        style={{
          background: "var(--runner-page, var(--brand-neutral-50, hsl(var(--background))))",
          fontFamily: '"Plus Jakarta Sans", var(--brand-font-body, system-ui, sans-serif)',
        }}
      >
        {children}
      </div>
    </>
  );
}
