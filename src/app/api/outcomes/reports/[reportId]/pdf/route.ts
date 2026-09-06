import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getOutcomeReport } from "@/lib/dal/outcomes";
import { outcomeReportHtml } from "@/lib/outcomes/pdf-document";
import { withReportPdfBrowser } from "@/lib/reports/pdf-browser";
import { logActionError } from "@/lib/security/action-errors";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  let report;
  try {
    report = await getOutcomeReport((await params).reportId);
  } catch {
    return Response.json(
      { error: "Report not found or inaccessible." },
      { status: 403 },
    );
  }
  try {
    const font = await readFile(
      join(
        process.cwd(),
        "src/app/fonts/plus-jakarta-sans-latin-variable.woff2",
      ),
    );
    const html = outcomeReportHtml(report.payload, font.toString("base64"));
    const bytes = await withReportPdfBrowser(async (browser) => {
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        if (request.url().startsWith("data:")) void request.continue();
        else void request.abort();
      });
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      return page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate:
          '<div style="font-size:8px;color:#64776f;width:100%;text-align:center">Trajectas · Business Outcomes · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      });
    });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="business-outcomes-${report.id.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    logActionError("outcomes.pdf", error);
    return Response.json(
      { error: "Unable to render this report. Try again." },
      { status: 500 },
    );
  }
}
