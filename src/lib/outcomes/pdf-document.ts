import type { OutcomeReportPayload } from "./types";
import {
  metricValue,
  groupComparisonText,
  scenarioValues,
  selectedReportFinding,
  findingSummary,
} from "./report";
export function escapeReportHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function outcomeReportHtml(
  payload: OutcomeReportPayload,
  fontData = "",
): string {
  const e = escapeReportHtml,
    { metric, result, finding, predictor } = selectedReportFinding(payload),
    scenario = scenarioValues(payload),
    groups = finding.groups;
  const money = (v: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: payload.draft.scenario.currency,
      maximumFractionDigits: 0,
    }).format(v);
  const min = groups ? Math.min(0, groups.low, groups.high) : 0,
    max = groups ? Math.max(0, groups.low, groups.high) : 1,
    span = max - min || 1,
    zero = (-min / span) * 100;
  const chart = groups
    ? [
        { label: "Lower capability scores", value: groups.low, n: groups.lowN },
        {
          label: "Higher capability scores",
          value: groups.high,
          n: groups.highN,
        },
      ]
        .map((r, i) => {
          const end = ((r.value - min) / span) * 100;
          return `<div class="chart-row"><div class="row-label"><span>${e(r.label)} · ${r.n} people</span><b>${e(metricValue(r.value, metric))}</b></div><div class="track"><div class="bar ${i ? "high" : ""}" style="left:${Math.min(zero, end)}%;width:${Math.abs(end - zero)}%"></div></div></div>`;
        })
        .join("")
    : "<p>No reliable high-versus-low group contrast is available.</p>";
  const technical = payload.result.results
    .map((r) => {
      const m = payload.config.metrics.find((m) => m.id === r.metricId)!;
      return `<section class="technical-section"><h2>${e(m.label)}</h2><p>${e(r.model.method || r.model.unavailable)}. ${r.model.n} complete people; ${r.model.parameters} parameters. Context: ${e(r.model.controls.join(", ") || "None selected")}.</p><table><thead><tr><th>Capability</th><th>People</th><th>Pearson r</th><th>Adjusted coefficient<br/>(95% interval)</th><th>FDR q</th><th>Evidence</th></tr></thead><tbody>${r.findings.map((f) => `<tr><td>${e(payload.predictors.find((p) => p.id === f.predictorId)?.label)}</td><td>${f.n}</td><td>${f.correlation?.value.toFixed(3) ?? "—"}</td><td>${f.adjusted ? `${f.adjusted.value.toFixed(3)}<br/>[${f.adjusted.lower.toFixed(3)}, ${f.adjusted.upper.toFixed(3)}]` : "Unavailable"}</td><td>${f.adjusted?.q?.toPrecision(3) ?? "—"}</td><td>${e(f.status)}</td></tr>`).join("")}</tbody></table>${r.findings.map((f) => `<p class="caption">${e(groupComparisonText(f, m, payload.predictors.find((p) => p.id === f.predictorId)?.label ?? "Capability"))}</p>`).join("")}<p>${r.validation ? `${e(r.validation.method)}: ${e(r.validation.metric)} ${r.validation.baseline.toFixed(3)} with business context alone; ${r.validation.assessment.toFixed(3)} with assessment added. Lower is better. ${r.validation.folds} folds and ${r.validation.n} people.` : e(r.validationReason)}</p>${r.model.warnings.map((w) => `<p>${e(w)}</p>`).join("")}</section>`;
    })
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${e(payload.draft.headline)}</title><style>
  ${fontData ? `@font-face{font-family:Jakarta;src:url(data:font/woff2;base64,${fontData}) format('woff2');font-weight:200 800}` : ""}
  @page{size:A4;margin:17mm 17mm 19mm}*{box-sizing:border-box}body{font-family:Jakarta,Arial,sans-serif;color:#263a34;font-size:10pt;line-height:1.65;margin:0}h1,h2,h3,p{margin:0}h1{font-size:29pt;line-height:1.2;letter-spacing:-1pt;font-weight:800;margin:15pt 0}h2{font-size:14pt;line-height:1.4;margin-bottom:10pt}p{margin-bottom:10pt}.brand{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #dce3df;padding-bottom:16pt;margin-bottom:26pt}.brand b{font-size:21pt;letter-spacing:-1pt}.brand span{color:#64776f;font-size:8pt}.eyebrow{font-size:8pt;text-transform:uppercase;letter-spacing:1.7pt;color:#2d6a5a;font-weight:700}.muted{color:#64776f}.question{max-width:95%;font-size:10pt}.finding{border-top:1px solid #dce3df;border-bottom:1px solid #dce3df;margin:22pt 0;padding:22pt 0;display:grid;grid-template-columns:.9fr 1.1fr;gap:22pt;break-inside:avoid}.amount{font-size:29pt;font-weight:800;line-height:1.2;letter-spacing:-1pt;margin:10pt 0}.caption{font-size:8pt;color:#64776f}.row-label{display:flex;justify-content:space-between;gap:12pt;font-size:8pt;margin-bottom:6pt}.chart-row{margin-bottom:12pt}.track{height:22pt;position:relative;background:#f3f5f3;border-radius:2pt}.bar{position:absolute;top:3pt;bottom:3pt;background:#91a29b;border-radius:2pt}.bar.high{background:#2d6a5a}.meaning{margin:0 0 22pt}.narrative{white-space:pre-line}.scenario{padding:18pt;background:#f0f5f2;border:1px solid #d6e4dc;border-radius:7pt;margin:22pt 0;break-inside:avoid}.scenario .amount{font-size:23pt}.recommendation{border-top:1px solid #dce3df;padding-top:18pt;margin:20pt 0;break-inside:avoid}.metadata{border-top:1px solid #dce3df;padding-top:12pt;font-size:8pt;color:#64776f}.appendix{break-before:page}.appendix h1{font-size:24pt}.technical-section{margin-top:22pt;break-inside:avoid}.technical-section h2{break-after:avoid}table{width:100%;border-collapse:collapse;font-size:7pt;margin:12pt 0;table-layout:fixed}th,td{text-align:left;border-bottom:1px solid #dce3df;padding:7pt 4pt;vertical-align:top;overflow-wrap:anywhere}th{font-weight:700;color:#2d6a5a;background:#f3f5f3}th:first-child{width:25%}tr{break-inside:avoid}thead{display:table-header-group}.provenance{font-size:7pt;overflow-wrap:anywhere;border-top:1px solid #dce3df;padding-top:12pt;margin-top:20pt}
  </style></head><body><div class="brand"><b>trajectas<span style="color:#2d6a5a;font-size:21pt">.</span></b><span>BUSINESS OUTCOMES · ${e(payload.study.clientName)}</span></div><header><p class="eyebrow">${e(metric.label)} · ${e(payload.config.periodStart)} to ${e(payload.config.periodEnd)}</p><h1>${e(payload.draft.headline)}</h1><p class="question muted">${e(payload.study.question)}</p></header>
  <section class="finding"><div><p class="eyebrow">${groups ? "Observed difference" : "Evidence so far"}</p><p class="amount">${groups ? e(metricValue(Math.abs(groups.difference), metric, true)) : "Further evidence needed"}</p>${groups ? `<p>${groups.difference > 0 ? "Higher" : groups.difference < 0 ? "Lower" : "The same"} ${e(metric.label.toLowerCase())} in the higher ${e(predictor.label.toLowerCase())} score group.</p>` : ""}<p class="caption">${e(findingSummary(finding, metric))}<br/>${result.n} people with this measure. ${metric.direction === "higher" ? "Higher" : "Lower"} is better.</p></div><figure style="margin:0">${chart}<figcaption class="caption">Lowest and highest capability-score quartiles. Ties stay together. These are observed differences; business context can also influence the outcome.</figcaption></figure></section>
  <section class="meaning"><h2>What this means for the business</h2><p class="narrative">${e(payload.draft.interpretation)}</p></section>
  ${scenario ? `<section class="scenario"><p class="eyebrow">Modelled scenario</p><p class="amount">${e(metricValue(Math.abs(scenario.delta), metric, true))}</p><p>${scenario.delta >= 0 ? "Increase" : "Decrease"} in average ${e(metric.label.toLowerCase())} per person per outcome period.</p>${scenario.gross !== null ? `<p class="amount">${e(money(scenario.gross))}</p><p>Estimated gross value under the stated conversion assumptions.${payload.draft.scenario.cost ? ` ${e(money(scenario.net!))} after implementation costs.` : ""}</p>` : ""}<p class="caption">Assumes a ${payload.draft.scenario.shift}-point shift in ${e(predictor.label)} across ${payload.draft.scenario.people} people${scenario.gross !== null ? `, ${payload.draft.scenario.periods} outcome periods and ${e(money(payload.draft.scenario.valuePerUnit!))} per outcome unit per person per period` : ""}. This extrapolates an observed relationship; it is not a forecast or a proven intervention effect.</p></section>` : ""}
  <section class="recommendation"><h2>Recommended next step</h2><p class="narrative">${e(payload.draft.recommendation)}</p></section><p class="metadata">${payload.quality.eligible} people included from ${payload.quality.imported} imported rows. Assessment results precede the outcome period. Analysis dated ${e(new Date(payload.runCreatedAt).toLocaleDateString("en-AU"))}.</p>
  <section class="appendix"><p class="eyebrow">Supporting evidence</p><h1>Evidence and methods</h1><p>This appendix includes every selected KPI, including inconclusive relationships. Adjusted coefficients describe the relationship with one capability while holding the other selected capabilities and context controls constant.</p><p class="caption">Continuous coefficients use KPI units per score point. Logistic coefficients use log odds. Count coefficients use log rates. Benjamini–Hochberg correction covers all estimable adjusted capability-by-KPI relationships in the run; exploratory correlations form a separate family.</p>${technical}<h2>Inclusion and limitations</h2>${[...payload.quality.warnings, ...payload.result.warnings].map((w) => `<p>${e(w)}</p>`).join("")}${Object.entries(
    payload.quality.excluded,
  )
    .map(([r, n]) => `<p>${n} rows excluded: ${e(r)}.</p>`)
    .join(
      "",
    )}${scenario ? `<p>Scenario relationship uncertainty: ${e(metricValue(scenario.interval[0], metric, true))} to ${e(metricValue(scenario.interval[1], metric, true))} per person per outcome period. This excludes implementation and value-conversion uncertainty.</p>` : ""}<p class="provenance">Engine ${e(payload.result.engineVersion)} · ${e(
    Object.entries(payload.result.libraryVersions)
      .map(([k, v]) => `${k} ${v}`)
      .join(" · "),
  )} · Seed ${payload.result.seed}<br/>Source checksum: ${e(payload.source.checksum)}<br/>Analysis run: ${e(payload.runId)}<br/>Form versions: ${e(payload.source.formVersions.join(", ") || "Not recorded")}</p></section></body></html>`;
}
