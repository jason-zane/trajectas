# Trajectas — Master Plan: Product, Business & Roadmap

*Date: 29 April 2026.*
*Synthesises v1 (strategic direction), v2 (competitive landscape), and v3 (rigour framework) into one operating document.*
*This is the plan, not the essay. It tells the team what we are building, why, in what order, with what economics, against which competitors, and how we will know if we are right.*

---

## Document map

1. Executive summary
2. Strategic foundation
3. Product strategy and architecture
4. Product pipeline and roadmap
5. Go-to-market plan
6. Business plan and financials
7. Team and operations
8. Risk register and kill criteria
9. Decision framework: when to revisit, when to pivot
10. Appendix A: detailed feature backlog with build state
11. Appendix B: rigour and methodology specification
12. Appendix C: validation experiment design
13. Appendix D: key metrics dashboard

---

## 1. Executive summary

**What Trajectas is.** A productised contextual-competency platform for mid-market organisations, sold through consulting partners. The platform produces a culture/operating-style profile of an organisation through a multi-layer diagnostic, then matches the organisation to a bespoke set of competencies that anchor both hiring assessments and ongoing capability development tracking.

**Why now.** The HR-tech market has just bifurcated into a commoditised infrastructure tier (skills graphs, ATS integration, generic competency libraries) and a thin, undersupplied capability-measurement tier. Phenom's acquisition of Plum, Workday's acquisitions of Sana and HiredScore, and Eightfold's $220M Series E all signal that *validated capability measurement* is now treated as strategic by enterprise buyers. The mid-market is being underserved by all of them. AI is making generic competency models cheap and validated longitudinal data scarce; we are positioned for the latter.

**The wedge.** The productised org diagnostic. McKinsey OHI and equivalents own the enterprise diagnostic conversation but cannot productise without cannibalising consulting revenue. Culture Amp, Microsoft Viva, and Peakon do engagement, not operating-style. No one connects diagnostic output to a contextually-calibrated competency model. We do.

**The moat.** Three layers, compounding. (1) The contextual-competency layer — bespoke models from the diagnostic, hard to copy without a real diagnostic capability. (2) The longitudinal capability data — validated measurement of identified employees on the same calibrated framework over years, getting better with time and impossible to retrofit. (3) The dual-paradigm rigour story — published evidence calibrated to the decision (selection vs. development), which no competitor in our tier currently makes legible.

**The product, in one sentence.** Org diagnostic produces operating-style profile → matching algorithm produces contextual competency framework → competency framework drives hiring assessments at point of entry → same framework drives lightweight pulse measurement on identified employees over years → manager-facing reports turn measurement into developmental action.

**The strategy, in one sentence.** Win the AU/NZ mid-market (250–2,500 employees) via consulting partners, sold as a platform fee plus partner-services overlay; accumulate longitudinal capability data and published rigour evidence as the durable moat; expand to UK and US in Years 2–3; treat enterprise as an acquisition exit, not a sales target.

**The 18-month plan.** Finish the wedge (matching algorithm, LLM wiring, diagnostic launch flow). Run a 90-day validation experiment with 2–3 partner orgs to prove longitudinal value. Build the longitudinal layer (Person spine, capability log, pulse runner, manager view, consent layer). Hire an IO-psych research lead and publish first concurrent-validity case study. Reach 12–20 paying mid-market clients across AU and NZ via 4–7 active partners by end of 2026; expand to 40+ clients during 2027 with selective UK partner additions. By H2 2027 the moat is visible enough to support a Series B story or a credible acquisition conversation.

**What success looks like by end of Year 3.** ~120 paying mid-market clients across ~25 partners (60% AU/NZ, 30% UK, 10% other), blended ARR ~A$28M, net revenue retention >110%, peer-reviewed publications in IO psychology, the recognised name in ANZ for "productised org diagnostic + contextual competencies + longitudinal development."

**What we are explicitly not doing.** Selling direct to F500 in competition with Phenom or Workday. Building a full HCM operating system. Pretending generic personality assessments are equivalent to capability development. Entering regulated competency markets (aviation, healthcare, nuclear) without sector partnerships. All of these are real businesses; none of them is the highest-EV path for Trajectas given our actual assets.

---

## 2. Strategic foundation

### 2.1 Vision

To be the layer that makes contextual capability — what a specific organisation actually needs from its people, and how those people are growing into it — the new default for how organisations hire, develop, and reason about their workforce.

### 2.2 Mission

Replace generic personality testing and unvalidated skill labels with measured, contextual capability data — calibrated per organisation, accumulated per person over years, reported with the rigour appropriate to each decision.

### 2.3 The strategic thesis

Three propositions, each defensible on its own and each mutually reinforcing.

*Proposition one.* Generic competency frameworks underperform context-calibrated ones. A fintech's "adaptability" is not a pharma's "adaptability" — same word, different competency. The only way to produce a context-calibrated competency model at productised pricing is via a structured org diagnostic that surveys multiple layers of the organisation. Trajectas is built around this.

*Proposition two.* The HR-tech moat that compounds is longitudinal validated capability data, measured (not inferred), on identified employees, against a stable framework over years. Skills inference (Eightfold, Gloat, TechWolf) is keyword matching with NLP overlays — fast and shallow. Engagement surveys (Lattice, Culture Amp) are noisy, self-report, and not capability data. Coaching networks (BetterUp) measure outcomes by self-report. No one is accumulating the right thing. We can.

*Proposition three.* The right rigour for development is different from the right rigour for selection. Most assessment providers oversell selection-paradigm rigour (predictive validity coefficients) and undersell what development needs (sensitivity to change, decision-threshold validity, action validity). Articulating and publishing the development-paradigm rigour framework — and matching it with real evidence — is a credibility moat no incumbent in our tier currently makes legible.

These three combine into a coherent business: a productised diagnostic produces contextual competencies, contextual competencies anchor hiring assessments and longitudinal tracking, longitudinal tracking accumulates the data moat, and the rigour story makes the whole thing publicly defensible.

### 2.4 What we are not betting on

Several plausible-sounding theses that we are deliberately not building around:

- *That AI alone produces sufficient competency frameworks.* Claude or GPT can produce a credible-looking framework from a one-page org description. It will not be context-calibrated to the specific organisation in any deep sense. Productising AI-only generation is the commodity move and we should not lead with it.
- *That personality assessment is dead.* It isn't. Hogan, KF4D, SHL all have legitimate businesses and continue to grow. We're not displacing them; we're operating in a different paradigm (developable capability) and integrating with their world via crosswalks rather than competing head-on.
- *That the all-in-one HCM platform play is winnable for us.* Workday and SAP are billion-dollar businesses we cannot out-feature. We embed into and around them via crosswalks and integrations, not compete with them on breadth.
- *That direct sales to enterprise is the right motion.* Phenom and Eightfold can spend $200K of CAC on a Fortune 500 deal and amortise it over a five-year ACV. We can't. Mid-market via partners has lower deal sizes but proportionally lower CAC and shorter cycles. The unit economics work; the prestige is lower; we accept that.

### 2.5 Market and ICP

Total addressable market for HR-tech in 2026 is ~A$60B globally; the talent acquisition + assessment + talent management segments combined are ~A$23B. Mid-market (250–2,500 employees) accounts for roughly 30–40% of that depending on segment, so ~A$6–9B globally.

The AU/NZ segment specifically: combined working population ~17M (Australia ~14M, New Zealand ~3M). Approximately 3,000–5,000 mid-market organisations across the two markets, of which a meaningful subset (probably 800–1,500) actively buy assessment, engagement, or talent-tech tooling. Trajectas's serviceable addressable market in ANZ mid-market alone is approximately A$300–500M annually. We do not need to win this market; we need to be a credible specialist in it. ANZ is large enough to support a A$30–50M ARR business at maturity, which is the bar for "venture-scale launch market with optionality to expand."

**Primary ICP: 250–2,500 employee organisations, post product-market fit, with a deliberate hiring cadence and at least one of (CHRO, VP People, Head of Talent / Head of People).**

Sub-segments we prioritise:

1. *Tech and tech-enabled services* (SaaS, fintech, e-commerce, modern services) — they understand competency frameworks intuitively, value the rigour story, and have managers who use tools. Atlassian, Canva, Xero alumni networks are a natural starting recruiting ground.
2. *Professional services and partnerships* — consultancies, agencies, law firms, accounting practices — high natural fit with our partner channel; their leaders already think in capability terms; ANZ has a particularly dense professional-services mid-market.
3. *Resources, infrastructure, and energy transition* — Australia's mining, renewables, grid, and infrastructure companies are unusually large in their domestic mid-market, hiring rapidly in skills-scarce roles, and have capability development as a real strategic constraint. This sub-segment is more important in ANZ than it would be in the UK or US.

Geographies in priority order: **Australia first** (regulatory clarity under Privacy Act 1988 and APPs, mature mid-market, English-language, partner ecosystem accessible, founder is launching from this market, lower competitive density from US heavyweights than UK or US). **New Zealand second** (small but tightly networked, similar regulatory regime under Privacy Act 2020, often closes immediately after AU references). **United Kingdom third** (Year 2 expansion, similar regulatory regime to ANZ, partner ecosystem mature, larger absolute market). **United States fourth** (Year 3+ if capital and team support it, partner-led only, requires significant CAC investment to break through Phenom/Workday saturation). Continental Europe and Asia-Pacific selective opportunism only.

Out of primary ICP for now: orgs <100 employees (deal size too small for partner economics, more relevant in ANZ where small business is large share of economy), F500 enterprise (lost to Phenom/Workday in AU just as in US/UK), regulated operational competency (aviation, healthcare, mining safety competence, nuclear — adjacent and interesting, particularly in Australian mining and aviation sectors, but needs sector-specific partnerships).

### 2.6 Competitive positioning

The condensed map. *Phenom-Plum:* enterprise psychometric + AI delivery, US$169M raised, will move slowly into mid-market, limited ANZ presence, our nearest direct threat globally but barely visible in ANZ for the next 18 months. *Workday + Sana + HiredScore:* enterprise HCM bundling AI talent stack, strong ANZ enterprise presence (most large Australian companies use Workday), no measurement rigour, potential acquirer. *Eightfold AI:* skills-graph distribution, US$96.6M ARR, no validity, limited ANZ presence. *Gloat / Beamery / TechWolf:* skills inference platforms, similar gaps, mostly absent from ANZ mid-market. *Lattice / 15Five:* engagement and performance, growing ANZ presence, no real capability measurement, at risk if a measurement competitor undercuts them on credibility. *Hogan / SHL / Korn Ferry / Plum (pre-acquisition) / PI:* selection-paradigm assessment, generic libraries, present in ANZ via licensees, partner with us via crosswalks rather than compete head-on. *McKinsey OHI / Bain / BCG:* enterprise consultancy diagnostic with ANZ practices, will not productise, complementary not competitive.

**ANZ-specific competitive notes:**

- *Culture Amp.* Australian-founded (Melbourne 2009), now global, dominant brand in ANZ for engagement surveys. Strong CHRO mindshare. We are *not* competing with Culture Amp on engagement — we are complementary. Our positioning is "Culture Amp tells you how your people feel; Trajectas tells you what they can do and how they're growing." Many of our prospects will have Culture Amp; we should integrate or coexist, not displace.
- *Employment Hero.* Australian HRIS, strong mid-market presence, recently acquired KeyPay. Possible integration partner for HRIS connectivity in the ANZ market — likely faster path than chasing Workday integration first.
- *Local boutique psychometric firms.* PsyMetrix, People Insights, Sonia Lee Consulting and a long tail of consulting psychologists in AU/NZ run hand-crafted assessment programmes for mid-market clients. These are *partner candidates*, not competitors — they have the relationships and methodology credibility but lack a productised platform.
- *Hudson, Davidson, Six Degrees Executive, Sirius People.* Australian recruitment + talent advisory firms with mid-market client books and natural extension into capability assessment. Strong partner candidates.
- *Big Four ANZ practices (KPMG, Deloitte, EY, PwC).* Each has a People & Change practice running culture diagnostics and capability assessments for mid-to-large clients. Possible partner candidates at the larger end, but their billable-hour models can clash with our productised approach. Approach selectively.

Our positioning lines:

- *Vs. Phenom-Plum:* "We do for mid-market what Phenom does for enterprise; their motion needs A$2M deal sizes, ours doesn't. And we're here in ANZ where they aren't yet."
- *Vs. Workday/SuccessFactors:* "We're the contextual capability layer your HRIS doesn't have. We integrate, we don't replace."
- *Vs. Eightfold/Gloat:* "Inferred labels are not measurement. We measure. Here's the validity evidence."
- *Vs. Lattice / Culture Amp:* "Engagement is not capability. Manager ratings are noisy. We give you the underlying signal — and we work with your engagement platform, we don't replace it."
- *Vs. McKinsey OHI:* "We're not your culture-change consultant. We're the productised diagnostic that lets your HR team and your boutique consulting partner move faster."

---

## 3. Product strategy and architecture

### 3.1 Product principles

Six principles that govern every product decision. Disagreement with any of these is the signal to escalate, not to quietly compromise.

1. **Context first.** No generic library. Every competency framework is calibrated to a specific organisation via diagnostic, even if the calibration is light. We crosswalk to industry standards but we do not lead with them.
2. **Measure, don't infer.** Skills inference from work artifacts is a 2027–2028 optionality. The primary product measures, with calibrated psychometric instruments, on a known cadence, with explicit consent. We will eventually layer inference on top of measurement; we will not lead with inference.
3. **Right rigour for right decision.** Selection-paradigm rigour for hiring; development-paradigm rigour for longitudinal tracking; criterion-referenced rigour for any criterion-referenced decision. We publish which standards we hold ourselves to and against which decisions.
4. **Partner-channel-friendly by default.** Every product surface assumes a consultant or coach is in the loop. Brandable, white-labellable where appropriate, designed to make the partner look good.
5. **Action over insight.** Insight that doesn't lead to an action is decoration. Every report ends with suggested actions. Action efficacy is itself measured over time.
6. **Privacy and consent are first-class.** Longitudinal capability data on identified employees has higher legal/ethical exposure than one-off hiring assessments. We design consent, retention, access, and right-to-be-forgotten in once, properly, before customer data accumulates.

### 3.2 Product architecture — the layered model

The platform has six logical layers. Some are mature, some are partial, some are unbuilt; the layering is what matters. (Build state is annotated against each.)

**Layer 1 — Identity and tenancy.** Multi-tenant 3-tier (Platform → Partners → Clients), Person identity that persists across hire, role change, and tenure. *Tenancy is built; durable Person identity is not yet first-class in the data model.*

**Layer 2 — Org diagnostic.** Multi-layer surveys (executive, management, frontline, IC), role-rep campaigns pinned to a baseline, anonymity guarantees enforced at the data layer, output: an operating-style profile per client with role-level granularity. *Schema and architecture shipped 20 April; the launch flow and the actual diagnostic output rendering are the missing pieces. The user has noted this is mostly framework rather than fully realised.*

**Layer 3 — Contextual competency framework.** Dimensions → Factors → Constructs → Items hierarchy, calibrated per client by the matching algorithm that consumes the diagnostic output. Each construct labelled by *developability* (trait / mixed / skill). Crosswalks to SHL, Hogan, KF4D, and other industry standards. *Hierarchy and items are built; the matching algorithm itself and the developability labelling are not.*

**Layer 4 — Measurement engine.** IRT/CTT psychometric backbone, calibration, norm groups, DIF, item statistics, AI-GENIE item generation pipeline, assessment runner, pulse measurement runner (lightweight repeated). *Backbone and runner are built; AI-GENIE is architecturally in place but LLM-stubbed; pulse runner is not built; calibration data needs accumulation.*

**Layer 5 — Longitudinal capability log.** Append-only history per Person per construct, with timestamp, source campaign/pulse, statistical metadata (point estimate, SEM, CI). Change-score modelling. *Not built.*

**Layer 6 — Surfaces.** Manager-facing development view, person-facing self-service view, partner-facing client management, admin/launch UIs, report rendering, notification/email production, consent and access management. *Some surfaces built (admin, reports), some half-built (launch, score interpretation), some unbuilt (manager development view, person view, consent layer).*

Above all six layers sits the *rigour and methodology* commitment — the dual-paradigm rigour standards (Appendix B) and the published validity evidence — which functions less as a layer and more as a public commitment that constrains what each layer is allowed to claim.

### 3.3 The dual-paradigm rigour framework

This is the single most important non-engineering commitment in the plan. Summarised here; specified fully in Appendix B.

**For selection / hiring decisions:** classical reliability (alpha ≥ 0.75), differential item functioning analysed and published, predictive validity case studies within 12 months of GA on hire-quality outcomes, content validity grounded in job-task analysis from the diagnostic.

**For development / longitudinal decisions:** standard error of measurement and smallest detectable change reported alongside every score and change-score, concurrent validity case studies with manager observation as criterion, decision-threshold validity (every reported level anchored to behaviour descriptions and empirically distinguishable), test-retest analyses run holding ability constant, every construct labelled by expected developability.

**Across both:** norm groups reported at multiple aggregation levels with sample sizes and dates; item-level psychometric statistics available to clients; bias and fairness audits per major release; aggregate (anonymised) data shared with academic partners under data-use agreements to support peer-reviewed publication.

The strategic move is to **publish all of this openly** — a "Rigour and methodology" page that any buyer, coach, or psychologist can read — and to be visibly held to it. Most competitors won't match this transparency. The transparency is part of the moat.

### 3.4 Build vs buy

Decisions and rationale.

*Build:* the diagnostic and competency layers (this is the moat — cannot be bought), the measurement engine (built already), the longitudinal log and Person spine (architecturally central, must be ours), the manager and person surfaces (UX is part of the product), the consent layer (legal exposure too high to outsource).

*Buy / use existing:* LLM (Claude/OpenAI via API for item generation, narrative, AI features), email/notification provider (Resend already in stack), background jobs (existing Next.js stack), payment (Stripe when needed), authentication (Supabase Auth in place), error tracking and observability (Sentry / Vercel built-in).

*Partner / integrate:* HRIS integrations (BambooHR, HiBob, Workday, Rippling, Personio) built ourselves but with awareness that Merge.dev or Finch.com can short-circuit early integrations cheaply if needed; coaching network integrations as we expand; learning-platform integrations (Sana, Cornerstone, Coursera for Business) at the development-action layer.

*Defer:* skills inference from observable work artifacts (2027–2028 optionality, not now); CAT runtime sequencing (full adaptive testing — we have skeletal infrastructure but pulse-fixed-form is more useful in the near term).

---

## 4. Product pipeline and roadmap

The roadmap is organised in five phases over 18 months, with optionality items beyond. Each phase has an explicit goal, the features delivered, the rationale per feature, success metrics, and the dependencies / decisions that gate the next phase.

### Phase 0 — Finish the wedge (now → end Q2 2026)

**Goal.** Have a complete, demoable end-to-end product that takes a client from diagnostic launch through to delivered hiring assessments with contextual competencies. Get to a state where the next conversation with a partner is "let's run this for a real client" not "let's see the demo again."

**What we build, why, what it does.**

*Matching algorithm: org diagnostic → contextual competency selection.* This is the single most important Phase 0 item. The algorithm consumes the operating-style profile from a closed diagnostic campaign and outputs a recommended competency framework: which constructs from the library matter most for this organisation, with weightings and rationale. Without this, the "contextual" claim is marketing copy. Implementation is roughly: (a) define a structured representation of the operating-style profile (already in `org_diagnostic_profiles`), (b) define a mapping function from profile dimensions to construct relevance scores, (c) layer in role-level adjustments from role-rep campaigns, (d) produce a human-readable rationale per construct. The first version can be deterministic / rule-based; later versions can use LLM-augmented reasoning over the profile. *Build state: conceptual / not built.*

*LLM wiring (production).* Replace stubs with real Claude calls. Item generation via the AI-GENIE pipeline, AI narrative composition, preflight construct analysis, AI-augmented matching rationale. Use the existing Anthropic SDK already in dependencies. Establish prompt versioning, output validation, fallback to human-curated stems on failure. *Build state: stubbed.*

*Org diagnostic launch flow and respondent UX.* Admin can configure a campaign, send invitations, monitor completion, close the campaign, generate the profile. Respondent-facing UX is mobile-friendly, anonymised, and short enough to maintain participation rates. *Build state: half — schema and RLS shipped 20 April; the actual launch flow and respondent UX still being assembled.*

*Contextual competency framework rendering.* Once the matching algorithm runs, the output needs to be visible: which competencies, which weightings, why. Partner-facing and client-facing views. *Build state: not built; depends on matching algorithm.*

*Score interpretation v2.* Recent spec exists; finish it. The interpretation layer turns IRT theta scores into bands, narratives, and behaviour anchors. *Build state: half.*

*Participant comparison.* Recent spec, in flight. Useful for hiring (comparing finalists). *Build state: half.*

**Success metrics for Phase 0.**
- A diagnostic can be launched, run, closed, and produce a profile end-to-end in under 4 weeks with no engineering hand-holding per client.
- The matching algorithm produces a defensible competency framework from a profile, with rationale that a CHRO can read and accept.
- LLM-driven item generation produces psychometrically acceptable items at ≥ 80% pass rate on automated quality checks.
- 2–3 partner firms have committed to running a real diagnostic campaign in Phase 1.

**Dependencies and decisions before Phase 1.**
- Matching algorithm v1 lands by mid-Q2.
- LLM wiring stable by end Q2.
- Three confirmed partner orgs for the validation experiment.
- Founder + research lead alignment on the Phase 1 research design.

### Phase 1 — Validation experiment and developability labelling (Q3 2026)

**Goal.** Run the validation experiment described in Appendix C: 2–3 partner orgs, 20–30 hires per org, remeasure at 6 months post-hire, manually-produced growth reports. Generate the first concurrent-validity evidence and the first set of in-the-wild use cases. Decide based on the evidence whether to commit to Phase 2 (build the longitudinal layer) or stay narrow on hiring (Fork A).

**What we build alongside the experiment.**

*Developability labelling for every construct in the library.* One column on `constructs` with values `trait`, `mixed`, `skill`. Surfaced in the framework rendering and used by the measurement and reporting layers. Constructs labelled `trait` get measured once and reported as stable; constructs labelled `skill` get the longitudinal treatment; constructs labelled `mixed` get a hybrid treatment with an explicit caveat. *Build state: not built; small additive change.*

*SEM and SDC reporting in scoring outputs.* Every individual score and change-score reports its standard error of measurement and, for change-scores, the smallest detectable change threshold. The IRT framework already supports computing SEM; the surfacing layer needs to be added. *Build state: conceptual; a small layer on top of existing scoring.*

*Manual longitudinal report (designed artefact, not engineered yet).* For the experiment, we produce growth reports manually in Figma/PDF — not engineered into the product yet. The point is to find out what's actually useful before we engineer it. *Build state: design-only.*

*Crosswalk v1 to industry standards.* Map ten of the most common Trajectas constructs to their nearest equivalents in SHL, Hogan, and KF4D. Useful for the sales objection "but we already use SHL." *Build state: not built; mostly research work.*

**Success metrics for Phase 1.**
- 2–3 orgs complete the experiment with remeasurement at 6 months.
- ≥ 70% of remeasured employees complete the second-round pulse without significant friction.
- Manager interviews confirm at ≥ 60% positive that the growth reports are *actionable* (lead to a real conversation, role change, mentorship, or assignment).
- First publishable concurrent-validity case study drafted by end of Q3 (correlation between competency scores and manager-observed performance).
- One published "Rigour and methodology" page on the marketing site.

**Decision gate to Phase 2.**
- If Phase 1 evidence is positive on adoption + manager utility + concurrent validity, proceed to Phase 2 (build the longitudinal layer).
- If Phase 1 evidence is mixed but adoption is good, narrow Phase 2 scope and re-run the experiment with adjustments.
- If Phase 1 evidence is negative on manager utility, *stay narrow on hiring* (Fork A) and rebuild the development case in 12 months.

### Phase 2 — Longitudinal MVP (Q4 2026 → Q1 2027)

**Goal.** Build the durable longitudinal layer. By end of Q1 2027, the same client that bought a hiring assessment in Phase 1 should be able to convert to ongoing development tracking on the same calibrated framework, with manager-facing reporting, on a recurring cadence.

**What we build, why, what it does.**

*Person spine and durable identity.* Elevate `profiles` (or introduce `persons`, naming TBD) to be the durable identity record across hire → tenure → role change. One person, one record, regardless of how many campaigns or pulses they've participated in. Foreign keys from sessions, scores, and reports point to Person. *Build state: not built; small additive migration with meaningful identity-resolution policy.*

*Longitudinal capability log.* Append-only `person_capability_history` table: per Person × Construct × Time, with point estimate (theta), SEM, source campaign or pulse, and metadata. Every measurement event from any campaign or pulse writes here. This is the moat. *Build state: not built.*

*Pulse measurement runner.* Lightweight (8–12 calibrated items) repeatable assessments that share the IRT scale of the full instrument. Configurable cadence (default quarterly for active development, annual for baseline-refresh). The runner reuses the existing assessment runner but with adaptive item selection from the calibrated bank. *Build state: not built but small once the bank exists.*

*Change-score scoring layer.* When a new measurement enters the longitudinal log, compute the change vs. the prior measurement, the SEM-based confidence interval on the change, and whether the change exceeds the smallest detectable change threshold. This is what powers manager-facing growth reporting. *Build state: not built; supported by IRT framework.*

*Manager-facing development view (v1).* The single most important new surface. Manager logs in, sees their team, drills into a person, sees: current competency profile, recent change, suggested development conversations, scheduled next pulse. Designed for a manager to use in 5 minutes during 1:1 prep. *Build state: not built.*

*Anonymity-vs-identified mode separation.* First-class concept in the data model and the UX. Org diagnostic remains anonymised (existing RLS); development tracking is identified (new path with explicit consent). Visible to the employee. *Build state: half — the diagnostic anonymity is enforced; the development-mode identification is implicit and needs to become explicit.*

*Consent / retention / privacy layer.* Explicit consent records per Person × campaign type, retention windows configurable per client, right-to-be-forgotten flows, role-based access controls, audit trails. GDPR-aligned for EU clients; broadly equivalent for UK/US. Built once, properly. *Build state: not built; non-negotiable to ship before customer longitudinal data accumulates.*

*Email / notification production wiring.* Skeletal today; needs to be production-grade for pulse invitations, results-ready notifications, manager nudges, consent renewals. *Build state: stubbed; finish in Phase 2.*

**Success metrics for Phase 2.**
- Phase 1 experiment clients convert to a paying recurring development engagement (at minimum 2 of 3).
- Pulse completion rate ≥ 75% within 14 days of invitation across Phase 2 clients.
- Manager-view weekly active rate ≥ 30% of managers with active reports.
- First development-paradigm rigour case study (concurrent validity, SEM benchmarks) submitted for publication by end of Q1 2027.
- Consent / retention layer audited by external counsel.

### Phase 3 — Manager surfaces, HRIS, and recurring revenue at scale (Q2 → Q3 2027)

**Goal.** Convert the longitudinal MVP into a sticky, recurring product that managers actually use weekly. Establish the integrations that anchor the longitudinal data to organisational reality. Begin scaling the partner channel from a handful to dozens.

**What we build.**

*HRIS integrations (first: HiBob and BambooHR; second: Workday and Personio; third: Rippling).* Lifecycle event ingestion (hire, role change, promotion, exit) automatically updates the Person spine and triggers appropriate measurement events. Bidirectional where it makes sense (e.g. publishing capability summaries back to the HRIS profile). Implementation via direct APIs initially; revisit Merge.dev / Finch as a meta-integration shortcut if proliferation becomes a tax. *Build state: not built.*

*Change-score interpretation in plain English.* Manager-facing reports surface change in language a non-psychologist can act on: "Mary's 'judgment under uncertainty' has improved meaningfully over the past 6 months — this is a strong signal she's ready for the next stretch project." Behaviour-anchored, never just numerical. *Build state: not built.*

*Cohort and team capability heatmaps.* Aggregations over the longitudinal log: team-level competency profiles, gap analyses vs. role expectations, function-level rollups. The view that lets a CEO answer "where are my capability gaps?" *Build state: not built.*

*Person-facing self-service view.* Opt-in. The employee sees their own capability profile, growth over time, suggested development actions, transparency over what's collected and who sees it. Drives engagement with pulse cadence and supports the consent narrative. *Build state: not built.*

*Crosswalk v2 (extended).* Industry-standard mappings extended to 30+ constructs with the major external frameworks. Sales-enabled artefacts. *Build state: not built.*

*Score interpretation finalised, participant comparison generalised, partner branding completed.* All currently in flight or recently shipped. *Build state: half.*

*Partner-led self-service onboarding.* Partners can launch a new client diagnostic without engineering involvement. *Build state: not built.*

**Success metrics for Phase 3.**
- HRIS integrations live with 3+ providers, used by ≥ 50% of paying clients.
- Manager-view weekly active rate ≥ 50%.
- Net revenue retention across Phase 1/2 cohort ≥ 110%.
- Partner-led client onboarding time-to-value < 4 weeks.
- Second peer-reviewed case study published or in submission.

### Phase 4 — Compounding moat (H2 2027 → 2028)

**Goal.** Make the moat visible. Cross-org benchmarking, intervention efficacy tracking, vertical overlays, deeper science output. By end of 2028, Trajectas is the recognised name in productised contextual capability and a credible Series B story or acquisition target.

**What we build.**

*Cross-org benchmarking (anonymised, opt-in).* Once we have ≥ 30 paying clients with longitudinal data, anonymised cross-client norm groups become a real product feature. "Your engineering managers' judgment-under-uncertainty profile vs. mid-market tech benchmark" is a differentiated insight no incumbent in our tier has. *Build state: not built; depends on data accumulation.*

*Intervention efficacy tracking.* Every action recommended in a manager report is tracked. When the same person is remeasured, we can correlate action-taken with score-movement at scale. Eventually: "of clients who took action X for construct Y, ZZ% saw meaningful score improvement within 6 months." This is the analytics layer that justifies the platform's existence to a CFO. *Build state: not built; depends on Phase 2 data.*

*Vertical overlays (sectors).* Sector-specific competency benchmarks once we have enough longitudinal data per sector. Engineering, sales, professional services first. Each vertical adds context-calibrated baseline competencies that bias the diagnostic-to-competency matching. *Build state: not built.*

*Manager workflow embedding.* Slack / Teams / Outlook nudges, calendar integration ("you have a 1:1 with Mary in 15 minutes — here's her recent capability movement"), 1:1 prep templates pre-populated with relevant insights. The adoption multiplier. *Build state: not built.*

*Adaptive / CAT runtime sequencing.* Now that pulse cadence and participation rates justify it, full adaptive testing on the calibrated bank produces shorter, more precise pulse measurements per person. *Build state: half — infrastructure exists, runtime sequencing not built.*

*Published research programme.* Multiple peer-reviewed publications on the development-paradigm rigour framework, concurrent and growth validity, longitudinal stability, and developability classification. Conference presentations at SIOP, EAWOP, APS. Academic partnerships formalised. *Build state: research programme; needs the IO-psych research lead.*

**Success metrics for Phase 4.**
- Cross-org benchmarking live with ≥ 30 contributing clients.
- Three or more peer-reviewed publications.
- Net revenue retention ≥ 120%.
- 100+ paying mid-market clients across 15+ active partners.
- Series B raised or acquisition conversations active.

### Phase 5 — Optionality (2028+)

These are real options worth having on the roadmap, but none of them is a primary bet now.

*Capability data layer (API-first, the Fork D play).* Sell competency models and benchmarks to other HR tools as an API. Becomes viable once we have a critical mass of longitudinal data and validated benchmarks. Could be an acquisition motivator for Workday or Phenom.

*AI-native competency inference (the Fork E2 play).* Skills inference from observable work artifacts (calendar, Slack, code, sales transcripts). Done well, anchored against measured ground truth from our longitudinal log. Privacy/legal complexity is real but the ground-truth advantage is unique to us.

*Vertical-specific products (the Fork E3 play).* Engineering-only, sales-only, or sector-specific (financial services, healthcare, professional services) versions with tighter calibration and domain-specific behaviour anchors.

*Regulated operational competency.* Aviation, healthcare, energy. Requires sector partnerships and regulator engagement; not casually entered, but a meaningful adjacent market with high willingness to pay and regulatory moats once established.

*Acquisition or integration partnerships.* OpenAI Jobs (mid-2026 launch) is a possible distribution channel. Major HRIS vendors (HiBob, Workday) are possible deeper integration partners or acquirers.

---

## 5. Go-to-market plan

### 5.1 Channel strategy: partner-led mid-market

Direct sales to mid-market does not work at our pricing. Lattice and Culture Amp can run a direct mid-market motion because their products are credit-card buyable and the buyer is one HR person. Our product requires a diagnostic engagement, contextual calibration, and a commitment to a longitudinal programme — that is consultative selling, and the right entity to do it is a consulting partner with existing relationships.

The 3-tier architecture (Platform → Partners → Clients) is built for this. The economic model, in summary:

- *Trajectas charges the client a platform fee* on a per-employee-per-year basis (typically A$155–345 PEPY, blended hiring + development).
- *The partner takes a margin on the platform fee* (25–40% depending on volume and contribution).
- *The partner adds services overlay* — the diagnostic facilitation, the feedback workshops, the manager training, the senior coaching — typically priced at 1–2× the platform fee.
- *Total client engagement* is typically 2–3× the platform fee, which is the size that supports a "transformation" sales conversation that consultancies are good at having.

For a 1,000-person client at A$250 PEPY, the platform fee is A$250K/year, the partner takes ~A$75K margin, Trajectas nets ~A$175K, and the partner overlays A$300–500K in services for a total client engagement of A$550–750K. That's the right size for a serious mid-market consulting engagement and is consistent with what ANZ Big Four and boutique consultancies already charge for diagnostic-and-capability programmes.

### 5.2 Partner profile and recruitment

Target partner profiles in priority order, with concrete ANZ examples:

1. *Boutique people consultancies and culture/talent specialists* (10–50 people, mid-market book) — the natural fit, often already running diagnostic-and-development engagements with manual tools. ANZ examples: Davidson Consulting, FlowState, FCB Group, Insync Surveys, The People's Project. Trajectas accelerates their existing motion. Easiest sell.
2. *Executive search and search-adjacent firms with talent advisory practices.* ANZ examples: Hudson, Sirius People, Six Degrees Executive, Slade Group, Talent International. Already trusted by CEO buyers; have a natural extension into onboarding and capability development.
3. *Coaching networks and group-coaching providers.* ANZ examples: Growth Coaching International, Real Insight, plus the local arms of CoachHub and Torch/EZRA. Natural fit for the development product; they need rigorous capability data to anchor coaching engagements.
4. *Mid-tier strategy and management consultancies.* ANZ examples: Strategic Project Partners, Pacific Strategy Partners, Nous Group, Insync. Using Trajectas to do faster, cheaper diagnostics inside broader transformation work.
5. *Big Four people-and-change practices (selectively).* KPMG, Deloitte, EY, PwC ANZ practices have large client books. Their billable-hour models can resist productisation but specific senior partners with mid-market practices are good targets. Approach 1–2 selectively, not as a primary motion.
6. *Local boutique psychometric / IO-psych firms.* PsyMetrix, People Insights, smaller consulting psychology practices. They have methodology credibility and want a platform; we have a platform and want methodology credibility. Mutually beneficial partnership.

Partner recruitment motion: warm intro from existing network + 1-day partner workshop + co-delivered first client + revenue share. Founder's existing ANZ network is the primary anchor for the first 4–6 partners. Target 4–7 active partners (mostly AU, 1–2 NZ) by end 2026, 12–18 by end 2027 (including 3–5 UK partners as Year 2 expansion begins), 30+ by end 2028.

Partner enablement: certification programme for partner consultants (1-week training + supervised first deployment + ongoing CPD), branded collateral, sales playbook, technical onboarding documentation, dedicated partner success manager beyond ~5 partners.

### 5.3 Pricing and packaging

Three packages, each with clear inclusions and clear upgrade paths. All pricing in AUD.

**Diagnostic only (A$30–80K per client per engagement).** Single org diagnostic + contextual competency framework + report. One-time engagement. Useful as a partner foot-in-the-door product or as a standalone "let's understand our org" engagement. No longitudinal commitment. Effectively a productised consulting deliverable.

**Hiring (A$155–250 PEPY annual platform fee, minimum A$60K/year).** Diagnostic + competency framework + hiring assessments, calibrated and rendered per role. Includes the assessment runner, partner branding, candidate experience, manager-facing report. The wedge product. Typical client size 250–1,500 employees with a deliberate hiring cadence.

**Lifecycle (A$250–345 PEPY annual platform fee, minimum A$120K/year).** Everything in Hiring plus longitudinal development tracking on the same framework: pulse measurement, manager-facing growth views, person-facing self-service, HRIS integration. The expansion product. Available to clients who have completed at least one full hiring engagement and have HR readiness for a longitudinal programme.

Pricing principles: PEPY-based at a defensible per-employee value, partner-friendly margin structure, expansion path that makes Lifecycle the natural year-2 upsell from Hiring, no hidden services SKUs (services are the partner's revenue, not ours).

### 5.4 Sales motion and cycle

For Hiring: typical 3–4 month sales cycle from partner-introduced opportunity to signed contract. Steps: discovery call (partner-led), demo with technical follow-up (Trajectas joins), pilot scoping (typically a single-role pilot for a quarter), commercial proposal, signature. Pilot pricing is A$30–50K with conversion-on-success terms.

For Lifecycle expansion: typical 2–3 month cycle inside an existing client. The conversation is owned by the partner; Trajectas's role is to provide evidence and case studies. Conversion-on-evidence (concurrent validity story, growth report quality, manager NPS) makes this dramatically easier than cold-selling a standalone development product.

For new partner recruitment: 6–8 month cycle from first conversation to first signed client. Most of that is co-development of the first client; the partner contract itself is fast.

### 5.5 Marketing and positioning

Five things we lead with publicly.

*The org diagnostic as the differentiator.* "We are the only platform that produces a contextual competency framework from a real diagnostic of your organisation, not a generic library." Public-facing examples (anonymised case studies), partner-led webinars, a free-or-cheap "diagnostic preview" that produces a 1-page operating-style summary in exchange for an email and a 20-minute survey from 5–10 leaders.

*The dual rigour story.* Public "Rigour and methodology" page (Appendix B). Per-decision standards. Published validity evidence. Item-level statistics on request. This is the credibility moat — talked about openly so it becomes the public-record version of the moat. Most competitors won't match this.

*Partner case studies.* Each partner-delivered engagement produces (anonymised, where required) a case study: the client situation, the diagnostic finding, the competency framework, the hiring outcomes, the development trajectory. Case studies are the dominant form of B2B HR-tech buying signal.

*Capability vs. personality, capability vs. inferred skills.* The category-defining argument. Op-eds, conference talks, podcast appearances. The narrative: "personality is real, skills inference is hype, validated capability with the right rigour for the right decision is what your org actually needs." This is positioning warfare against Phenom, Eightfold, Lattice — fought in narrative, not in feature comparisons.

*Research outputs.* Peer-reviewed publications, SIOP/EAWOP conference presentations, academic partnerships. Slow-burning but powerful — they accumulate credibility that no amount of marketing spend buys.

What we do not do publicly: head-to-head feature comparisons (we lose those by default against larger competitors), generic "best HR tools" listicle plays, paid search at high CAC for terms dominated by incumbents.

### 5.6 The first 18 months of GTM, sequenced

*Now → Q3 2026:* finish the wedge, recruit 3–5 anchor partners across AU and NZ through warm intros and the existing ANZ relationship network, run the Phase 0 → Phase 1 validation experiment with 2–3 clients of those partners. No external marketing spend. Goal: produce 2 case studies (Australian, ideally one tech and one professional services or resources) and 1 published rigour case study by end Q3.

*Q4 2026 → Q1 2027:* publish the rigour and methodology page, launch the first round of paid case studies, recruit partners 6–9 (still ANZ-focused, with at least 1 NZ partner). Begin marketing content (AU/NZ HR press, partner webinars, AHRI / IPA / NZHRI engagement). Goal: 8–12 paying clients across 5–8 ANZ partners by end Q1 2027.

*Q2 → Q3 2027:* expand ANZ partner network to 12–15, launch Lifecycle product expansion to existing Hiring clients. First conference presentations (AHRI National Convention, SIOP Asia-Pacific). Begin academic partnership conversations (University of Melbourne, Macquarie University, University of Auckland — strong IO-psych programmes). Begin opportunistic UK partner conversations as Year 2 expansion preparation. Goal: 25–35 paying clients (mostly ANZ), blended ARR ~A$5–7M by end Q3 2027.

*Q4 2027 → 2028:* compounding moat phase. Cross-org benchmarking goes live. Vertical overlays. UK launch via 3–5 partners. Series B fundraising or acquisition conversations. Goal: 50+ paying clients by end 2027, 90+ by mid-2028, with 25–35% of new client growth from UK by end 2028.

---

## 6. Business plan and financials

### 6.1 Revenue model and unit economics

Revenue is platform-fee-based (per-employee-per-year) plus diagnostic engagement fees plus selective implementation services. Partner revenue is recognised gross with partner margin paid as cost-of-revenue. All figures in AUD.

**Average client economics (illustrative, for a 750-person mid-market client on the Lifecycle package):**

- Platform fee: A$190K/year (~A$253 PEPY).
- Partner margin: A$57K (30%).
- Trajectas net revenue: A$133K/year.
- Gross margin (platform infrastructure, LLM costs, support): ~80% → A$106K gross profit per client per year.

**Average client economics (Hiring-only package, same 750-person client):**

- Platform fee: A$105K/year (~A$140 PEPY).
- Partner margin: A$32K.
- Trajectas net: A$73K/year.
- Gross profit: ~A$58K per client per year.

**Mix assumptions over time:**
- End 2026: 80% Hiring-only, 20% Lifecycle (early; few have completed the wedge engagement).
- End 2027: 50/50.
- End 2028: 30% Hiring-only, 70% Lifecycle. Net revenue retention compounds as clients expand.

**Net revenue retention.** Targeting 110%+ by end 2027, 120%+ by 2028, driven by Hiring → Lifecycle conversion, employee-base growth at clients, and selective price increases.

**LTV/CAC.** Mid-market consultative selling has higher CAC than direct-SaaS but partners absorb most of it. Target Trajectas CAC per direct client ≤ A$30K (a partner-success manager's blended cost over a 4-month sales cycle, plus marketing allocation), ARPC of A$95K+ in Year 1, LTV at 5-year retention assumption north of A$480K. LTV/CAC > 15× at maturity is the target; > 5× is acceptable in early scaling.

### 6.2 Three-year revenue forecast (illustrative)

These are estimates anchored in industry benchmarks for mid-market HR-tech-via-partner, scaled to AUD pricing and an ANZ-first launch. Real numbers will move with hiring pace, partner ramp, and macro.

| End of period | Active clients | Active partners | Avg net ARR per client | Net revenue (A$M) | Notes |
|---|---|---|---|---|---|
| Q4 2026 | 12 | 5 | A$77K | 0.9 | Phase 1+2 cohort, mostly AU, mostly Hiring-only |
| Q4 2027 | 45 | 14 | A$105K | 4.7 | Lifecycle expansion underway, NZ partners ramping, opportunistic UK |
| Q4 2028 | 110 | 28 | A$140K | 15.4 | Vertical overlays + cross-org benchmarking driving expansion, UK ~25% of new growth |
| Q4 2029 | 220+ | 45+ | A$180K | 39+ | Series B-stage business or acquisition target |

*These are aspirational and assume reasonable execution in ANZ first, with UK expansion in Year 2 and selective US in Year 3. The key drivers to monitor monthly: partner ramp rate, time-to-first-client per partner, Hiring → Lifecycle conversion rate, NRR. ANZ has a smaller absolute mid-market than UK or US, so the path to A$15M+ ARR involves either deeper penetration of the ANZ mid-market plus UK expansion, or much higher per-client expansion via Lifecycle and vertical overlays.*

### 6.3 Cost structure and burn

Approximate annual run-rate costs at end-2027 (illustrative, AUD, ANZ-based team with selective UK presence):

- Engineering (10–12 people): A$2.4–2.9M
- Research / IO-psych team (3–4 people): A$650–800K
- Partner success and customer success (4–5 people): A$700–880K
- Sales and partner development (3 people): A$650–800K
- Marketing (2–3 people, plus content and events): A$560–800K
- Founder / leadership (4 people): A$960K–1.3M
- G&A, infrastructure, LLM API costs (USD-denominated, AUD risk), legal, audit: A$800K–1.1M
- Total annual burn end-2027: A$6.7–8.6M

Against ~A$4.7M ARR end-2027, that's a healthy burn for a Series A-stage company; sufficient to reach mid-Series B metrics by end-2028 with one more raise. Note that LLM API costs and some SaaS infrastructure are USD-denominated, which is a real exchange-rate exposure when revenue is mostly AUD; this should be monitored quarterly and hedged informally by maintaining 12+ months of USD coverage at favourable conversion windows.

### 6.4 Funding strategy

Assumes Trajectas is currently at seed or post-seed; treat numbers as ranges to verify with current cap table. AUD throughout; AU/NZ VC market for context (Blackbird, Square Peg, AirTree, OneVentures, Folklore are the primary local Series A/B funds; international funds like Accel and Index have ANZ-active partners).

*Now → Q3 2026 (Phase 0 + Phase 1):* operate from current funding. Goal is to ship the wedge and run the validation experiment. No marquee marketing spend.

*Q4 2026 → Q1 2027 (Phase 2):* raise A$8–12M Series A on the back of validation evidence, first paying clients, and the rigour story. Likely lead investor profile: ANZ Series A fund (Blackbird, AirTree, Square Peg) with HR-tech or B2B SaaS thesis; potential co-lead from international fund with HR-tech track record. Use of funds: longitudinal layer engineering, IO-psych research lead and team, partner channel ramp, consent/privacy infrastructure, opportunistic UK partner setup at end of period.

*Q4 2027 → Q1 2028 (Phase 3 → Phase 4):* either raise a Series B (A$23–38M) on ARR growth + moat visibility + UK expansion proof points, or accept an acquisition at a strategic multiple. The decision turns on (a) whether the moat is actually compounding (longitudinal data assets, published research, partner network), (b) macroeconomic conditions and ANZ vs international VC market, (c) whether a credible acquisition offer matches venture-scale outcomes for the cap table. Series B is more likely to be internationally led (US or UK fund) on the back of UK traction and ANZ market dominance.

*Acquisition exits worth modelling:*
- Workday acquires for talent-intelligence completion (most likely strategic acquirer; they have strong ANZ enterprise presence already).
- Phenom acquires for mid-market expansion and rigour stack.
- Korn Ferry / Mercer acquires for SaaS leverage on consulting business (both have ANZ practices).
- Culture Amp acquires (the local-hero scenario) to add capability measurement to their engagement-heavy stack — a particularly Australian-flavoured outcome.
- HRIS challenger (HiBob, Rippling, Employment Hero) acquires to differentiate vs. Workday; Employment Hero is the ANZ-specific acquirer to watch.
- A PE rollup of validated assessment + skills intelligence (consolidating Trajectas, TechWolf, smaller players) into a horizontal capability layer.

---

## 7. Team and operations

### 7.1 Current state assumption

I don't have visibility into the current cap table, headcount, or burn. Treat the below as a target end-state, not a hiring plan against current state. The founders should map current state to this and identify the actual sequence.

### 7.2 Target team end-2027

*Founders / leadership (4):* CEO/founder, CTO or eng lead, Head of Science / IO-psych research, Head of Commercial / GTM. The Head of Science role is the single most important non-founder hire — they are the moat-builder.

*Engineering (10–12):* product engineering split into platform (data model, scoring engine, LLM pipeline), surfaces (admin, partner, client, manager, person), and integrations (HRIS connectors). Technical leads at platform, surfaces; integrations probably contracted or junior to start.

*Science / research (3–4):* Head of Science, two IO psychologists / psychometricians (one development-paradigm, one validation/case-study), one research operations / data person.

*Customer / partner success (4–5):* partner success managers (1 per ~5 active partners), customer success lead, implementation specialist.

*Sales and partner development (3):* head of partnerships, two BD/partner development reps. No traditional account executives — partners do the selling.

*Marketing and content (2–3):* head of marketing, content/research-comms lead, optional product marketing.

*Operations / G&A (1–2):* operations lead, possibly a finance/legal partial hire. External counsel, accountancy on retainer.

Total: ~25–30 people. Lean for what we are doing; possible because the partner channel absorbs much of what an inside sales team would otherwise do. Geographic distribution at end-2027: ~85% ANZ-based, ~15% UK-based (a small Year-2 UK presence including 1–2 BD/partner-development hires and a UK customer success lead). Time-zone reality: ANZ-based engineering and research will work async with UK partners; this is manageable but should be planned for in collaboration tooling and meeting cadence.

### 7.3 Critical hires and timing

In priority order:

1. *Head of Science / IO-psych research lead.* Now, or within 6 months. The moat-builder. Required to define the development-paradigm rigour standards, lead validation studies, write the publishable case studies, own the methodology page, and be the public face of the rigour conversation. Without this hire, the rigour story is marketing copy.
2. *Head of Partnerships / Channel.* Within 6–9 months. Required to formalise the partner channel motion as we go from 3–5 anchor partners to 15+. Background should be partner channel management at a B2B SaaS or HR-tech, ideally with mid-market consulting partner experience.
3. *Senior implementation lead.* Within 9–12 months. The person who owns the partner-led client onboarding playbook and ensures it's repeatable. Becomes head of partner success at scale.
4. *Engineering hires for the longitudinal layer.* As Phase 2 starts, probably 3–4 net new engineers focused on Person spine, longitudinal log, pulse runner, manager surfaces. The hiring profile should include at least one full-stack senior who has built consumer-facing data products before — the manager and person surfaces are unusually design-and-data dense.
5. *Privacy and compliance partial.* External counsel relationship from now; full-time hire when EU client volume justifies it (probably end-2027).

### 7.4 Operating cadence

Founder-level: weekly metrics review, monthly strategic checkpoint, quarterly OKR setting, half-year strategic review (with explicit revisit-the-strategy section, see decision framework below).

Engineering: weekly sprint cadence; biweekly product review with founder; monthly architecture review.

Research: monthly research output review; quarterly case-study delivery; per-publication peer-review milestones tracked separately.

Partner success: weekly partner-by-partner status; monthly partner office hours; quarterly partner advisory council meeting.

---

## 8. Risk register and kill criteria

Real risks ranked by likelihood × impact, with mitigations and the kill criterion (the signal that says we're wrong).

**R1 — Phenom + Plum moves to mid-market faster than expected.** *Likelihood: medium. Impact: high.* Mitigation: focus on partner channel where Phenom's enterprise direct motion doesn't compete; double down on UK/Europe where their distribution is weaker; lean into the productised diagnostic which Phenom has not yet built. Kill criterion: Phenom announces a partner channel programme aimed at mid-market with diagnostic capability, and we lose 3 deals to them in a single quarter. Response if triggered: re-evaluate channel strategy and consider acquisition discussion.

**R2 — Validation experiment evidence is weak.** *Likelihood: medium. Impact: very high.* Mitigation: Phase 1 designed deliberately to surface this early before committing engineering to Phase 2. Kill criterion: at end of Phase 1, manager interviews show < 40% find growth reports actionable and concurrent validity correlations < 0.30. Response: stay narrow on hiring (Fork A), rebuild the development case in 12 months with adjusted approach.

**R3 — Measurement decay over years.** *Likelihood: high. Impact: medium.* Mitigation: pulse cadence designed for low friction (8–12 items, 5–10 minutes), embedded in manager workflows, opt-in self-service drives motivation, anchored in HRIS lifecycle events. Kill criterion: pulse completion rate falls below 50% across multiple clients post-12-month cohort. Response: redesign cadence and incentive structure.

**R4 — AI commoditises competency definition.** *Likelihood: high. Impact: medium.* Mitigation: shift the moat narrative explicitly from "we generate competency models" to "we have validated longitudinal data against contextual frameworks." Strengthen rigour story; deepen diagnostic methodology beyond what AI can produce solo. Kill criterion: a major incumbent (Workday, Lattice) ships AI-generated contextual competency models with credible adoption. Response: lean harder on longitudinal data moat and rigour, accelerate cross-org benchmarking.

**R5 — Compliance landmines around longitudinal employee data.** *Likelihood: medium. Impact: very high.* Mitigation: build consent/retention/access in once, properly, before customer data accumulates. Primary jurisdiction is Australia (Privacy Act 1988 + APPs) and New Zealand (Privacy Act 2020) at launch — both lighter than GDPR but with real consent, notification, and breach-disclosure requirements. Australian anti-discrimination law (Sex / Age / Disability / Racial Discrimination Acts plus state Equal Opportunity Acts) applies to assessment used in selection. For UK / EU expansion, design for GDPR compliance from the start including Article 22 (automated decision-making) constraints. Default to opt-in over opt-out. External counsel review pre-launch in each new jurisdiction. Kill criterion: a regulatory action against Trajectas or a comparable competitor in any of our active markets that fundamentally changes the legal landscape for longitudinal capability data. Response: pause feature work, retrofit compliance, communicate transparently with clients.

**R6 — Partner channel doesn't ramp.** *Likelihood: medium. Impact: high.* Mitigation: anchor partners first (warm intros, trusted relationships), partner-success investment starting at 5+ partners, simple economics, clear enablement. Kill criterion: < 5 active partners with at least one paying client by end Q3 2026, or partner-led client acquisition cycle > 9 months. Response: re-examine direct sales motion for a subset of mid-market clients, or pivot channel strategy.

**R7 — Capital market closes for HR-tech.** *Likelihood: medium. Impact: high.* Mitigation: aim for path to operational sustainability at ~£8–10M ARR; build with capital efficiency in mind; cultivate strategic acquisition relationships early as alternative to growth funding. Kill criterion: Series A unraisable on planned terms in Q4 2026; bridge to strategic exit at lower multiple.

**R8 — Anthropic or OpenAI launches a competing assessment product.** *Likelihood: low. Impact: very high.* Mitigation: publish rigour evidence early and own the science narrative; differentiate on the productised diagnostic and partner channel which AI labs won't replicate. Kill criterion: Anthropic or OpenAI ships a validated assessment product or API with credible IO-psych endorsement. Response: re-evaluate the moat, consider integration partnership or acquisition.

**R9 — Construct labelling overpromises developability.** *Likelihood: medium. Impact: medium.* Mitigation: conservative initial labelling; default to `mixed` when uncertain; transparent about expected change rates per construct. Kill criterion: customer NPS data shows manager dissatisfaction concentrated on "no measurable change" complaints. Response: re-label, recalibrate cadence expectations, communicate transparently.

**R10 — Founder/team execution capacity.** *Likelihood: medium. Impact: high.* Mitigation: prioritise the critical hires above; resist over-hiring; protect founder time on the strategic pivots; hire a strong COO-equivalent if scaling beyond 25 people becomes hard. Kill criterion: any quarter with two or more major delivery slips or two or more senior departures. Response: structural reset and external advisor engagement.

**R11 — ANZ market is too small to support venture-scale growth alone.** *Likelihood: medium. Impact: high.* Mitigation: ANZ is the launch market and the optimum testing ground given lower competitive density and founder relationships, but the path to a A$30M+ ARR business requires UK and selectively US expansion in Years 2–3. Plan for that expansion deliberately rather than as an afterthought; protect AUD/USD exchange exposure on USD costs; ensure technical architecture and data-residency design supports multi-region deployment from day one. Kill criterion: ANZ TAM penetration plateaus at < A$8M ARR and UK partner channel fails to ramp by mid-2027. Response: re-evaluate as either a profitable but smaller ANZ-focused business (acquisition-stage at A$10–15M ARR) or a more capital-intensive US-led re-pivot.

**R12 — AUD/USD exchange-rate exposure on US-denominated costs.** *Likelihood: high. Impact: low-medium.* Mitigation: LLM API spend, some cloud infrastructure, and any US-based research collaborations are USD-denominated; revenue is mostly AUD/NZD. Maintain 12+ months of USD coverage, monitor quarterly, hedge informally via favourable conversion windows; consider formal forwards once monthly USD spend exceeds A$200K. Kill criterion: not really a kill criterion, but a 20%+ adverse FX movement sustained over 6 months meaningfully compresses margins and should trigger pricing review.

---

## 9. Decision framework: when to revisit, when to pivot

A common failure mode is to commit to a strategic direction and then either ignore evidence that it's wrong or thrash on every signal. The cure is an explicit rhythm of revisiting strategy at predefined points, with predefined questions.

**Half-yearly strategic review (every 6 months).** At each review, the founders and leadership team explicitly re-test:

1. *Is the thesis still right?* Re-read v1 and v2 thesis. Has the competitive landscape moved in a way that breaks one of the three propositions? (Productised diagnostic is still differentiated? Longitudinal data moat is still uncopied? Dual-paradigm rigour is still un-owned?)
2. *Is the wedge working?* Are partners selling Hiring? Are clients converting to Lifecycle? Are diagnostic engagements producing the contextual competency framework with the quality we need?
3. *Is the data accumulating?* Pulse completion rates, longitudinal log depth, manager engagement, NRR.
4. *Is the rigour story being heard?* Inbound from psychologists, partners, academic interest, peer-review submissions.
5. *Are we hitting the milestones?* Phase-level OKRs.

If any of (1)–(4) is failing, the answer is *not* "try harder" — it's to figure out which of v1's strategic forks should be reactivated. The forks are still on the shelf:

- *Fork A — stay narrow on hiring.* Reactivate if Phase 1 development evidence is weak.
- *Fork D — capability data layer.* Reactivate if direct platform sales stall but the underlying data is valuable to other tools.
- *Fork E2 — AI-native inference.* Reactivate as a 24-month optionality if longitudinal data accumulates faster than expected and provides a labelled training set.

The point is to have the forks named and ready, not to thrash. A founder who is willing to revisit strategy every 6 months with discipline is much more dangerous than one who clings to the original plan or one who pivots monthly.

**Quarterly product priority review.** Every quarter, the appendix-level feature backlog is re-ranked against the same criteria: strategic value, evidence-from-clients, compounding effect on the moat. Items that have been on the backlog for more than 3 quarters without rising are explicitly killed (with rationale recorded), not silently forgotten.

**Phase-gate decisions.** Each phase has an explicit decision gate — Phase 0 → Phase 1 (matching algorithm and LLM live, partners committed), Phase 1 → Phase 2 (validation evidence positive), Phase 2 → Phase 3 (longitudinal MVP shipped, NRR tracking), Phase 3 → Phase 4 (compounding moat visible). Skipping a gate decision is forbidden.

---

## 10. Appendix A — Detailed feature backlog with build state

Re-stated from the v2 review for completeness, in priority tiers.

*Tier 1 — existential.* (1) Org diagnostic with full launch flow [HALF]. (2) Matching algorithm: diagnostic → contextual competencies [CONCEPTUAL]. (3) LLM wiring (production) [STUBBED]. (4) Competency hierarchy and items [BUILT]. (5) Psychometric backbone (IRT/CTT, calibration, norms, DIF) [BUILT]. (6) Assessment runner [BUILT]. (7) Report generation pipeline [BUILT]. (8) Multi-tenant 3-tier model [BUILT].

*Tier 2 — moat.* (9) Stable Person identity [NOT BUILT]. (10) Longitudinal capability log [NOT BUILT]. (11) Pulse measurement runner [NOT BUILT]. (12) Manager-facing development view [NOT BUILT]. (13) Predictive validity case study (hiring) [NOT BUILT — research]. (14) Concurrent validity case study (development) [NOT BUILT — research]. (15) Consent / retention / privacy layer [NOT BUILT]. (16) Anonymity-vs-identified mode separation [HALF]. (17) Developability label per construct [NOT BUILT]. (18) SEM and SDC reporting in scoring outputs [CONCEPTUAL].

*Tier 3 — recurring revenue.* (19) HRIS integrations [NOT BUILT]. (20) Change-score interpretation in plain English [NOT BUILT]. (21) Cohort and team capability heatmaps [NOT BUILT]. (22) Crosswalk to industry standards [NOT BUILT]. (23) Person-facing self-service view [NOT BUILT]. (24) Email and notification production [STUBBED]. (25) Partner branding and entitlements [BUILT/HALF]. (26) Score interpretation v2 [HALF]. (27) Participant comparison [HALF]. (28) Partner-led self-service onboarding [NOT BUILT].

*Tier 4 — compounding moat.* (29) Manager workflow embedding (Slack/Teams/calendar) [NOT BUILT]. (30) Cross-org benchmarking (anonymised, opt-in) [NOT BUILT]. (31) Intervention efficacy tracking [NOT BUILT]. (32) Vertical overlays [NOT BUILT]. (33) Adaptive / CAT runtime sequencing [HALF].

*Tier 5 — strategic optionality.* (34) Capability data API product [NOT BUILT]. (35) AI-native competency inference [NOT BUILT]. (36) Vertical-specific products [NOT BUILT]. (37) Marketplace for partner-built assessments [NOT BUILT].

---

## 11. Appendix B — Rigour and methodology specification

Restated from v3 for completeness.

**For hiring use cases (selection paradigm):**
- Internal consistency (alpha) ≥ 0.75 per scale.
- Standard error of measurement reported with every individual score.
- DIF analysed for protected characteristics; published bias/fairness report per major release.
- At least one published predictive-validity case study within 12 months of GA.
- Job-task analysis linking competencies to role outcomes for any contextual hiring assessment.

**For development tracking use cases (development paradigm):**
- Standard error of measurement and smallest detectable change reported alongside every score and change-score.
- Concurrent validity case study within 12 months of GA.
- Decision-threshold validity: every reported level anchored to behaviour descriptions and empirically distinguishable.
- Test-retest analyses run holding ability constant.
- Construct-by-construct labelling of expected developability.

**Across both:**
- Norms reported at multiple aggregation levels with sample sizes and dates.
- Item-level statistics available to clients on request.
- Anonymised aggregate validity data shared with academic partners under data-use agreements.

**Action layer:**
- Every individual report ends with empirically-defensible suggested actions, anchored to score pattern and developability label.
- Action recommendations tracked over time; intervention efficacy reported at scale once data permits.

---

## 12. Appendix C — Validation experiment design (Phase 1 / Phase 0 → Phase 1 gate)

**Goal.** Produce evidence that supports or refutes the longitudinal-development thesis before committing engineering to Phase 2. Generate first concurrent validity case study and first qualitative manager-utility evidence.

**Design.**

- *Cohort.* 2–3 ANZ partner orgs (ideally a mix: one Australian tech company, one Australian professional-services or resources company, optionally one NZ org) that have run a Trajectas org diagnostic in the last 12 months, hired 20–30 people via Trajectas hiring assessments in the last 12 months, and have HR sponsorship for re-measurement.
- *Procedure.* For each org: (a) baseline competency profiles drawn from hire-time assessments; (b) re-measurement 6 months post-hire using a focused 8–12-item pulse derived from the same calibrated instrument; (c) manual generation (designed Figma → PDF) of a "growth report" per individual showing baseline, current, change, and behaviour-anchored interpretation; (d) structured manager interviews at +1 month after report delivery to assess perceived utility, action taken, willingness to repeat.
- *Concurrent validity stream.* Manager observation rating on each construct collected at re-measurement; correlate with Trajectas score. Target N ≥ 60 across orgs for first publishable estimate.
- *Adoption stream.* Pulse completion rate, time-to-complete, drop-off points.
- *Qualitative stream.* Manager interviews coded for: actionability, surprise (did the score reveal something unexpected?), trust (would you act on this without other input?), willingness to commit to longitudinal cadence.

**Success thresholds.**

- Pulse completion ≥ 70%.
- Manager-utility positive at ≥ 60% (i.e. report led to a real action or conversation).
- Concurrent validity correlation ≥ 0.40 on at least 5 constructs.
- At least 2 of 3 orgs commit to a paying recurring development engagement post-experiment.

**Decisions from the data.**

- All four thresholds met → proceed to Phase 2 with confidence; raise Series A on the back of evidence.
- Two or three thresholds met → narrow Phase 2 scope; iterate on weak areas; consider 6-month delay before full Phase 2 commit.
- Fewer than two thresholds met → stay narrow on hiring (Fork A); rebuild development case over 12 months with adjusted methodology.

---

## 13. Appendix D — Key metrics dashboard

The metrics that get reviewed weekly, monthly, and quarterly.

**Weekly (founder + leadership):**
- New diagnostic engagements started.
- Pulse completion rate (rolling 30-day, by client).
- Manager-view weekly active rate.
- Open partner pipeline (count and value).
- Customer-reported issues by severity.

**Monthly (full team):**
- Net revenue retention (NRR), by cohort.
- ARR (gross and net), by package, by partner.
- Hiring → Lifecycle conversion rate (rolling 90-day).
- New paying clients (count, by partner).
- Partner activation: % of partners with at least one client in last 90 days.
- Engineering velocity (against phase plan).
- Research output (publications submitted, in review, accepted).

**Quarterly (board / leadership):**
- Phase-level OKR scorecard.
- LTV/CAC by acquisition cohort.
- Logo retention and gross revenue retention.
- Concurrent validity / SEM / SDC measured across the longitudinal log (the moat metric).
- Cross-org benchmarking depth (when active).
- Competitive response signals (Phenom, Workday, Eightfold, etc.).
- Cap table, runway, hiring plan vs. actual.

**Annual (strategic review):**
- All half-yearly strategic review questions (Section 9).
- Three-year forecast vs. actual.
- Major risk register update.
- Strategic optionality status (Forks A, D, E2, E3, regulated, acquisition).
- Founder / leadership compensation and equity refresh review.

---

## 14. Closing

This is the plan. It is opinionated; it commits to a sequence; it names the things we are explicitly not doing; it identifies the moments at which we should re-test our own thesis with discipline.

The single most important commitment in the plan is not the engineering work — most of it is straightforward extension of what already exists. It is the **commitment to publish rigour evidence and own the development-paradigm science conversation**. That is what differentiates Trajectas from a well-built but undifferentiated assessment platform. Without that commitment, the moat doesn't get built and the business is replicable. With it, the business is venture-scale and the eventual exit is on Trajectas's terms.

The single most important hire is the Head of Science / IO-psych research lead. Without them, the rigour commitment is marketing copy. With them, it's a moat.

The single most important next decision is whether to commit to the Phase 0 → Phase 1 → Phase 2 sequence as planned, or to take six weeks to re-examine the assumptions in this document with the leadership team and any board observers before committing engineering to it. Either is a defensible answer. Sleep-walking past this decision and quietly building Phase 2 features without testing the assumptions is not.

If you want me to next: (a) draft the public "Rigour and methodology" page in plain English; (b) sketch the developability-labelling and Person-spine data model migrations specifically; (c) write the partner-recruitment one-pager and partner-enablement playbook; (d) build the validation experiment instrumentation plan in detail; (e) build a more rigorous financial model with sensitivity analyses — say which and I'll do it. All five are doable.
