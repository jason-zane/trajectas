# Business Outcomes

Business Outcomes is a separate internal workspace under **Insights → Business Outcomes**. Platform consultants connect completed assessment scores to a client's business measures, inspect the evidence, and publish a frozen report for the client's existing authenticated portal. Revenue, satisfaction, engagement, retention, time, errors and other measures have their own names, units and improvement directions. There is no mandatory monetary conversion.

## Consultant workflow

1. Create a client study and record the business question. Select identifiable client campaigns and a fixed outcome period. Save to discover eligible capabilities. Review score comparability before analysis.
2. Download the participant template, add one business row per person for that period, and upload CSV or XLSX. The template's `person_key` is preferred; exact email matching is also supported. CSV and Excel cells must contain bare numbers, with blank missing values. Binary measures use 0/1; percentage-valued continuous measures use 0–100. The original file stays private. Re-importing the same file and worksheet reuses its source version.
3. Map each KPI's column, type, label, units, direction and optional valid range. Count models can use a positive exposure column. Choose pre-existing business controls, such as tenure or job level. Save and run.
4. Review the inclusion ledger, adjusted associations, descriptive comparisons, uncertainty, and held-out prediction. Every KPI is retained, including inconclusive results. Multiple runs preserve independent input and output snapshots.
5. Select the report's lead KPI and capability, edit the headline and interpretation, and give a testable next step. An optional continuous-outcome scenario states its score-shift assumption; money appears only if the consultant explicitly supplies a per-person, per-period unit value. Save drafts independently of study configuration. Review the evidence and publish an immutable version.
6. Open the published report, download its PDF or copy the authenticated client link. Revoking the report disables future link access; it cannot recall downloaded copies.

The executive view leads with a native-unit, observed high-versus-low score difference and two comparison bars. Confidence intervals and model detail live in an optional web appendix and a separate PDF appendix. The report always distinguishes an observed relationship from a scenario or intervention claim.

## Data contract and eligibility

- One client per study. Up to 40 campaigns, 10 capabilities, 8 KPIs, 5 business controls, 5,000 imported people and 4 MB per CSV/XLSX file; up to 100 unique headings. Only one active run per study and two statistical jobs globally.
- Completed, ready, non-internal sessions with non-provisional `scaled_score` values. Internal campaigns, rater responses and aggregate-only confidentiality campaigns are excluded.
- Person matching is exact, client-scoped and deduplicated across campaigns. All duplicate business rows for one person are excluded, rather than arbitrarily choosing a value. The inclusion ledger records unmatched, ambiguous, duplicate and ineligible rows.
- Assessment completion must precede the outcome period and fall within the selected maximum age. The latest eligible score per person and capability is used. Capability identity includes the assessment, factor, scoring method, metric, scoring variant, parameter scale, norm version and norm group. Different identities are never pooled silently. Assessment form versions are recorded when available; the consultant must review comparability.
- Business files are already aggregated to the specified person-period. This version does not aggregate arbitrary transaction logs, resolve external HR identifiers or infer time windows from rows. Use the participant template to link those sources first.
- Original source checksum, extraction time, configuration, form provenance, inclusion counts, de-identified analysis rows, engine/library versions and random seed are retained. Canonical input hashing survives JSONB key ordering and is checked before computation.

## Statistical methods

| Question | Implemented method | Interpretation |
| --- | --- | --- |
| Do two measures move together? | Pearson correlation with 95% interval; Spearman rank correlation | Exploratory, unadjusted association |
| How do higher and lower scorers differ? | Lowest/highest quartile means; unadjusted Welch interval | Descriptive comparison; ties stay together and may expand groups |
| Which capabilities are associated with this continuous KPI after accounting for context? | Joint linear regression, HC3 robust uncertainty | KPI units per score point; a separate plot scales each capability to one observed score SD |
| Is a binary outcome associated with capability? | Joint logistic regression with robust uncertainty | Log-odds coefficients; observed group rates displayed as percentages and differences as percentage points |
| Is a count associated with capability? | Joint Poisson regression, optional log-exposure offset, robust uncertainty | Log-rate coefficients; overdispersion flagged for review |
| Do assessments add predictive information? | Fixed five-fold Ridge/logistic models compared with a context-only baseline on identical held-out people | MAE for continuous outcomes; Brier loss for binary outcomes; lower is better |

All selected capabilities enter each adjusted model together. Predeclared numeric/categorical business controls and estimable campaign intercepts are included. With at least 10 campaigns, covariance is clustered by campaign; below that threshold, the report explicitly warns that campaign dependence is not resolved. Categorical fields are limited to 20 levels. Rank-deficient, constant, undersized, separated or non-convergent models are unavailable, rather than being reported as zero effects. Coefficient magnitude is not a causal importance ranking.

Correlations require at least 20 paired observations with variation. Group comparisons require 40 paired observations and at least 10 people in each extreme group. Adjusted models require at least 30 complete people and 10 per parameter; binary models additionally require 10 people per parameter in each outcome class. These are conservative product gates, not formal power calculations. Consultants should design sample sizes around a meaningful effect and the study's dependence structure.

Adjusted associations and exploratory correlations use separate, study-wide Benjamini–Hochberg families across all estimable capability-by-KPI tests. “Supported” means adjusted FDR q < .05. It does not establish causality, transportability or a development effect. Confidence intervals are per-estimate intervals, not simultaneous family-wide intervals. Missing values are never converted to zero: adjusted modelling uses complete cases, with sample counts exposed.

Predictive transformations are fitted inside each training fold. With three or more campaigns, whole campaigns are held out; with fewer, person-held-out validation describes performance in the same campaign context. Context-only baselines without controls use the training mean or class prevalence. Count prediction validation, formal model selection and external validation are not implemented.

The scenario is available only for supported continuous relationships, using the native adjusted slope times a specified score shift. It stays within the observed score range and declared KPI scale. It assumes the fitted relationship persists under that hypothetical shift. Its uncertainty covers the estimated slope, not intervention efficacy, implementation or monetary assumptions. Financial conversion is delta × direction × people × periods × value per unit; net value subtracts the declared cost. It is not automatically an ROI or revenue forecast.

## Runtime and operations

Next.js handles authorization, import, immutable snapshots, queueing and reports. `api/outcomes-worker.py` is a file-based Python Vercel Function. It has no database access in its code, no file-based user input and no outbound requests. Requests require a timestamped, constant-time HMAC using the existing server-only `CRON_SECRET`; unsigned requests do not import the statistical libraries. Data is bounded to 4,000,000 bytes and 5,000 unique people. Runtime dependencies are pinned in `requirements.txt`, with Python 3.12.

A Next.js `after()` callback attempts the initial run. `/api/cron/outcome-analysis-sweep` recovers queued work every five minutes. A service-only invoker-rights SQL claim function holds a short advisory lock, limits global leases to two, and recovers leases older than six minutes. Each job has at most three attempts. Result writes require the current lease; expired workers cannot overwrite a replacement's result. A completed or failed run cannot be edited. Rerunning creates a new run.

`OUTCOMES_WORKER_URL` can explicitly point to an HTTPS worker; otherwise production uses the admin domain, previews use their deployment domain, and local development uses `http://127.0.0.1:8874`. Protected Vercel previews use `VERCEL_AUTOMATION_BYPASS_SECRET` when configured. The worker and its callback budgets must remain below the six-minute lease. Run locally with a matching local-only `CRON_SECRET` in both processes, then `python api/outcomes-worker.py`. Never point local integration fixtures at production.

The original `outcome-sources` bucket is private with no authenticated object policies. Authenticated table writes are revoked; all mutations pass through authorized server DAL functions and audit records. Raw studies/imports/runs/drafts are internal. Published reports are aggregate-only and client scoped; small cells are suppressed. Active-account restrictions apply to every new table. The server also applies the selected workspace's tenant filter, since database membership alone is not the workspace boundary.

## Verification and extension boundary

The suite exercises known synthetic linear/logistic/count relationships, missingness, constants, sample gates, deterministic output, false-discovery adjustment, worker signatures, exact matching, temporal selection, score provenance, duplicate handling, KPI arithmetic, HTML escaping, snapshot hashing, bounded multipart bytes, client isolation, deactivation, immutable records, revocation and concurrent claims. Browser QA uses only local synthetic satisfaction and engagement data and includes the actual import, analysis, draft, publication and PDF flow.

Hierarchical team models, repeated outcome windows, change scores, controlled experiments, difference-in-differences, survival/turnover timing, ordinal regression, negative-binomial/zero-inflated counts, formal power analysis and causal claims need separately specified methods and validation. The first release does not label any of these as available.

Reference implementations: [SciPy Pearson correlation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.pearsonr.html), [statsmodels robust covariance](https://www.statsmodels.org/stable/generated/statsmodels.regression.linear_model.RegressionResults.get_robustcov_results.html), [statsmodels multiple testing](https://www.statsmodels.org/stable/generated/statsmodels.stats.multitest.multipletests.html), [scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html#data-leakage), and [Vercel Python file-based functions](https://vercel.com/docs/functions/runtimes/python/api-directory).
