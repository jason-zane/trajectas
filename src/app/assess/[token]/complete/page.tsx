import { validateAccessToken } from "@/app/actions/assess";
import { getEffectiveBrand } from "@/app/actions/brand";
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults";
import { CheckCircle2 } from "lucide-react";

export default async function CompletePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Try to load brand config from the campaign
  let brandConfig = await getEffectiveBrand();
  let isCustomBrand = false;

  try {
    const result = await validateAccessToken(token);
    if (result.data?.campaign.organizationId) {
      brandConfig = await getEffectiveBrand(
        result.data.campaign.organizationId
      );
      isCustomBrand = brandConfig.name !== TALENT_FIT_DEFAULTS.name;
    }
  } catch {
    // Use default brand if token validation fails
  }

  // CSS is server-generated from trusted DB brand config
  const { css: lightCss } = generateCSSTokens(brandConfig);
  const darkCss = brandConfig.darkModeEnabled
    ? generateDarkCSSTokens(brandConfig)
    : "";
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

      <div className="flex min-h-dvh flex-col">
        {/* Header */}
        <header
          className="flex h-14 items-center px-4 sm:px-6"
          style={{
            background: "var(--brand-neutral-50, hsl(var(--background)))",
          }}
        >
          <div className="flex items-center gap-2.5">
            {brandConfig.logoUrl ? (
              <img
                src={brandConfig.logoUrl}
                alt={brandConfig.name}
                className="h-7 w-auto object-contain"
              />
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="flex size-7 items-center justify-center rounded-lg"
                  style={{
                    background:
                      "var(--brand-surface, hsl(var(--primary) / 0.1))",
                  }}
                >
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      color: "var(--brand-primary, hsl(var(--primary)))",
                    }}
                  >
                    <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <span
                  className="text-sm font-semibold tracking-tight"
                  style={{
                    color: "var(--brand-text, hsl(var(--foreground)))",
                  }}
                >
                  {brandConfig.name}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
          <div className="w-full max-w-[540px] text-center space-y-6">
            {/* Success icon */}
            <div className="flex justify-center">
              <div
                className="flex size-20 items-center justify-center rounded-full"
                style={{
                  background:
                    "var(--brand-surface, hsl(var(--primary) / 0.1))",
                }}
              >
                <CheckCircle2
                  className="size-10 animate-in zoom-in duration-500"
                  style={{
                    color: "var(--brand-primary, hsl(var(--primary)))",
                  }}
                />
              </div>
            </div>

            {/* Thank you message */}
            <div className="space-y-3">
              <h1
                className="text-2xl font-semibold tracking-tight sm:text-3xl"
                style={{
                  color: "var(--brand-text, hsl(var(--foreground)))",
                  fontFamily: "var(--brand-font-heading, inherit)",
                }}
              >
                Thank You
              </h1>
              <p
                className="mx-auto max-w-md leading-relaxed"
                style={{
                  color:
                    "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
                }}
              >
                Your assessment has been submitted successfully. You can
                safely close this page.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="flex items-center justify-center px-4 py-4">
          {isCustomBrand ? (
            <span
              className="text-xs"
              style={{
                color:
                  "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
              }}
            >
              Powered by TalentFit
            </span>
          ) : (
            <span
              className="text-xs"
              style={{
                color:
                  "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
              }}
            >
              TalentFit
            </span>
          )}
        </footer>
      </div>
    </>
  );
}
