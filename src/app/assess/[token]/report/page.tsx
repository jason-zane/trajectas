import { redirect } from "next/navigation";
import { validateAccessToken } from "@/app/actions/assess";
import { getEffectiveBrand } from "@/app/actions/brand";
import { getEffectiveExperience } from "@/app/actions/experience";
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults";
import { getPageContent, isPageEnabled } from "@/lib/experience/resolve";
import { interpolateContent } from "@/lib/experience/interpolate";
import { CheckCircle2, Clock } from "lucide-react";
import type { TemplateVariables, ReportContent } from "@/lib/experience/types";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await validateAccessToken(token);

  if (result.error) {
    redirect("/assess/expired");
  }

  const { campaign, candidate } = result.data!;
  const experience = await getEffectiveExperience(campaign.id);

  if (!isPageEnabled(experience, "report")) {
    redirect(`/assess/${token}/complete`);
  }

  const brandConfig = await getEffectiveBrand(campaign.organizationId);
  const isCustomBrand = brandConfig.name !== TALENT_FIT_DEFAULTS.name;

  const rawContent = getPageContent(experience, "report");
  const variables: TemplateVariables = {
    candidateName: candidate.firstName,
    campaignTitle: campaign.title,
  };
  const content: ReportContent = interpolateContent(rawContent, variables);

  const { css: lightCss } = generateCSSTokens(brandConfig);
  const darkCss = brandConfig.darkModeEnabled
    ? generateDarkCSSTokens(brandConfig)
    : "";
  // Server-generated CSS custom properties from validated brand config hex colors — not user HTML
  const safeCSS = `${lightCss}\n${darkCss}`;

  const fontsUrl = buildGoogleFontsUrl([
    brandConfig.headingFont,
    brandConfig.bodyFont,
    brandConfig.monoFont,
  ]);

  const isHolding = content.reportMode === "holding";

  return (
    <>
      {/* eslint-disable-next-line react/no-danger -- server-generated CSS from validated brand hex colors */}
      <style dangerouslySetInnerHTML={{ __html: safeCSS }} />
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

      <div className="flex min-h-dvh flex-col">
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

        <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
          <div className="w-full max-w-[540px] text-center space-y-6">
            <div className="flex justify-center">
              <div
                className="flex size-20 items-center justify-center rounded-full"
                style={{
                  background:
                    "var(--brand-surface, hsl(var(--primary) / 0.1))",
                }}
              >
                {isHolding ? (
                  <Clock
                    className="size-10"
                    style={{
                      color: "var(--brand-primary, hsl(var(--primary)))",
                    }}
                  />
                ) : (
                  <CheckCircle2
                    className="size-10"
                    style={{
                      color: "var(--brand-primary, hsl(var(--primary)))",
                    }}
                  />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h1
                className="text-2xl font-semibold tracking-tight sm:text-3xl"
                style={{
                  color: "var(--brand-text, hsl(var(--foreground)))",
                  fontFamily: "var(--brand-font-heading, inherit)",
                }}
              >
                {content.heading}
              </h1>
              <p
                className="mx-auto max-w-md leading-relaxed"
                style={{
                  color:
                    "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
                }}
              >
                {content.body}
              </p>
            </div>

            {!isHolding && (
              <p
                className="text-sm"
                style={{
                  color:
                    "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
                }}
              >
                Results view will be available once the scoring pipeline is connected.
              </p>
            )}
          </div>
        </main>

        <footer className="flex items-center justify-center px-4 py-4">
          <span
            className="text-xs"
            style={{
              color:
                "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
            }}
          >
            {content.footerText ??
              (isCustomBrand ? "Powered by TalentFit" : "TalentFit")}
          </span>
        </footer>
      </div>
    </>
  );
}
