"use client";

import { Download, Printer } from "lucide-react";
import { ReportRenderer } from "@/components/reports/report-renderer";
import type { ReportContent } from "@/lib/experience/types";
import type { ResolvedBlockData } from "@/lib/reports/types";

interface ReportExportScreenProps {
  content: ReportContent;
  participantName: string;
  campaignTitle: string;
  brandName?: string;
  brandLogoUrl?: string;
  generatedAt: string;
  isReady: boolean;
  /** When provided, renders the actual generated report for print/export */
  renderedData?: unknown[];
}

export function ReportExportScreen({
  content,
  participantName,
  campaignTitle,
  brandName,
  brandLogoUrl,
  generatedAt,
  isReady,
  renderedData,
}: ReportExportScreenProps) {
  const hasReport = isReady && renderedData && renderedData.length > 0;

  return (
    <div className="min-h-dvh bg-[var(--brand-neutral-50,hsl(var(--background)))] px-4 py-8 sm:px-6 lg:px-8 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-0">
        <div className="flex items-start justify-between gap-4 rounded-3xl border border-border/70 bg-background/95 p-6 shadow-sm print:hidden">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Download className="size-3.5" />
              Export report
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {content.heading}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {hasReport
                ? "Use your browser print dialog to save a PDF, or download from the admin dashboard."
                : "The report is still being generated. Please check back shortly."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!hasReport}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="size-4" />
            Print / Save PDF
          </button>
        </div>

        <article className="overflow-hidden rounded-[32px] border border-border/70 bg-background shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <header className="border-b border-border/70 px-8 py-8 print:px-0">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {brandName ?? "TalentFit"} report
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                  {content.heading}
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {content.body}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {brandLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- export rendering uses runtime brand URLs without image optimization
                  <img
                    src={brandLogoUrl}
                    alt={brandName ?? "Brand logo"}
                    className="ml-auto h-10 w-auto object-contain"
                  />
                ) : null}
                <p className="mt-3 text-sm font-medium text-foreground">
                  {brandName ?? "TalentFit"}
                </p>
              </div>
            </div>
          </header>

          <section className="grid gap-6 px-8 py-8 md:grid-cols-3 print:px-0">
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Participant
              </p>
              <p className="mt-2 text-base font-medium text-foreground">
                {participantName}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Campaign
              </p>
              <p className="mt-2 text-base font-medium text-foreground">
                {campaignTitle}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Generated
              </p>
              <p className="mt-2 text-base font-medium text-foreground">
                {generatedAt}
              </p>
            </div>
          </section>

          {hasReport ? (
            <section className="border-t border-border/70 px-8 py-8 print:px-0">
              <ReportRenderer blocks={renderedData as ResolvedBlockData[]} />
            </section>
          ) : (
            <section className="border-t border-border/70 px-8 py-8 print:px-0">
              <h3 className="text-lg font-semibold text-foreground">
                Export readiness
              </h3>
              <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 p-5">
                <p className="text-sm leading-6 text-muted-foreground">
                  {isReady
                    ? "Report data is ready but contains no rendered blocks. This may indicate a template configuration issue."
                    : "The report is still being generated. Once complete, the full report content will appear here for export."}
                </p>
              </div>
            </section>
          )}
        </article>
      </div>
    </div>
  );
}
