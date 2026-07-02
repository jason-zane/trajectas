# Board AI Capability Diagnostic — Research & Instrument Design

> **Status:** Research synthesis + recommended instrument design. Not yet a build plan.
> **Date:** 2026-07-02
> **Purpose:** Ground the design of a quantitative diagnostic survey of Australian board
> directors on AI capability and governance, and map what the Trajectas platform can
> already deliver versus what needs building.
> **Method:** Multi-source web research with adversarial claim verification (25 sources
> fetched, 74 claims extracted, 25 independently verified — 24 confirmed, 1 refuted),
> plus a full audit of the Trajectas question/response machinery.

---

## Design brief (locked decisions)

| Decision | Choice |
|---|---|
| Unit of analysis | **Individual directors first, designed for both** — items worded and modelled so responses from multiple directors of the same board can later aggregate into a board-level profile |
| Primary purpose | **Market research / thought leadership** — broad anonymous survey feeding a published "State of AI in Australian Boardrooms"-style report, benchmarking emphasis |
| Length | Derived from comparable instruments (see §4.2): **~35–40 items, 10–12 minutes** |
| Format | Quantitative, scale-based, with minimal free text |

---

## 1. TL;DR — what the evidence says to build

1. **Anchor the domain structure on the AICD/UTS HTI framework.** The *Director's Guide
   to AI Governance* (AICD + UTS Human Technology Institute, June 2024; **Version 2, June
   2026**) is the flagship Australian board-level framework. Its eight elements are the
   credibility skeleton Australian directors will recognise, and it explicitly scopes to
   boards "already using or planning to deploy AI" — which mandates an adoption-stage
   screener as the first question block.
2. **Use ASIC's maturity spectrum as the headline ordinal.** ASIC REP 798 (Oct 2024)
   observed AI governance approaches on a spectrum: **latent → decentralised (leveraging
   existing frameworks) → strategic, centralised**. A regulator-anchored maturity scale is
   both defensible and quotable in a published report.
3. **Six survey domains converge across every credible instrument** (AICD/HTI, ASIC,
   Deloitte Global Boardroom Program, Deloitte Board Practices Quarterly, WEF, McKinsey,
   Cisco, GIA, Diligent): adoption-stage screener; individual director literacy/usage;
   board oversight structures; governance policies & controls; organisational
   adoption/maturity as seen from the board; and capability uplift.
4. **Australian benchmarks already exist for norm-referenced reporting** — GIA 2025
   (n=344): 46% of governance professionals have no AI training, 64% of organisations
   offer none, 93% can't measure AI ROI, 88% struggle with legacy integration;
   Diligent/GIA APAC 2026: only 13% of Australian boards have recruited AI-savvy
   directors, 21% mandate director AI training, yet 43% put AI atop the strategic agenda.
   **Nobody has directly surveyed Australian board directors at scale on this — that's
   the white space this survey fills.**
5. **The single refuted claim is a warning:** the widely-circulated Deloitte figure that
   "66% of board members self-report limited-to-no AI knowledge" failed adversarial
   verification (0–3). There is **no verified global benchmark for self-rated director
   AI literacy** — treat published self-report literacy stats with suspicion, and design
   our own literacy items behaviourally rather than as self-ratings of "knowledge".
6. **Platform-wise, roughly 70% of the machinery exists.** Anonymous token-based
   delivery, 5-point Likert with custom anchors, frequency ordinals, response capture,
   and comparison/reporting infra are all live. Genuinely new: scored categorical
   single-select, multi-select, a staged maturity-descriptor format, "don't know"
   handling, and light skip logic. The `org_diagnostic_*` skeleton is the natural home
   for later board-level aggregation but its item/response/scoring layers are unbuilt.

---

## 2. The landscape — frameworks and instruments reviewed

### 2.1 Australian frameworks & regulator signals

**AICD / UTS Human Technology Institute suite** (published 12 June 2024; Guide now V2,
June 2026). Four resources: *A Director's Introduction to AI*, *A Director's Guide to AI
Governance*, a *Snapshot* of the eight elements, and an *AI Governance Checklist for SME
and NFP Directors*. The eight elements of safe and responsible AI governance:

1. Roles and responsibilities
2. Governance structures
3. People, skills and culture
4. Principles, policies and strategy
5. Practices, processes and controls
6. Supporting infrastructure
7. Stakeholder engagement and impact assessment
8. Monitoring, reporting and evaluation

This is guidance, not an instrument — no question wording or scales — but it is the
domain map Australian directors know, and survey sections should be nameable against it.

**ASIC REP 798** (Oct 2024) — ASIC's first state-of-the-market review of AI adoption:
624 consumer-impacting AI use cases across 23 banking/credit/insurance/advice licensees.
Key verified findings, each convertible into a survey item:

- Only **~half** of licensees had updated risk management policies for AI.
- Only **43%** had policies referencing disclosure of AI use to affected consumers.
- **Nearly half** had no policies considering consumer fairness or bias.
- **~61%** planned to increase AI use; governance "lags the adoption of AI" in some cases.
- Chair Joe Longo's "governance gap" warning: *"Without appropriate governance, we risk
  seeing misinformation, unintended discrimination or bias… all of which has the
  potential to cause consumer harm and damage to market confidence."*
- The observed maturity spectrum: **latent** (no AI-specific governance) →
  **decentralised** (leveraging existing frameworks) → **strategic, centralised**.

Caveats: scope is financial services, not the whole economy; findings describe
organisational policies rather than board practices; ASIC described observed approaches
rather than promulgating a formal maturity model.

**Gaps in the verified evidence (flagged, not covered):** Australia's Voluntary AI
Safety Standard (10 guardrails), ISO/IEC 42001, and the NIST AI RMF produced **no
verified survey-ready claims** in this research pass (only a tangential note that just
14% of GIA respondents even know the NIST AI RMF). APRA signals (as distinct from ASIC)
also remain unverified. These matter for the *policy items'* content validity and should
be desk-checked before final item wording — see §7 open questions.

### 2.2 Global board AI survey instruments (question formats to replicate)

**Deloitte Global Boardroom Program, "Governance of AI"** (2nd ed., 695 respondents —
84% board members — 56 countries, fielded Jan–Feb 2025). The best template for board
oversight-practice items:

- **Agenda frequency:** 31% say AI is *not* on the board agenda (down from 45% in the
  2024 first edition), 17% address it *every meeting*, 19% *annually*. The true
  instrument has 4+ frequency categories (the 1st edition reported a "twice a year"
  option at 25%) — replicate the full scale, not the three headline categories.
- **Oversight locus:** where AI is on the agenda, 46% discuss at full board; committee
  delegation goes mainly to risk-oriented committees (risk/regulatory 25%, audit 22%).
- **Capability uplift (three distinct mechanisms):** 59% of board members seek to
  self-educate, only 48% of boards offer formal AI training, just 10% recruit AI-savvy
  directors.

**Deloitte Board Practices Quarterly** (US, ~80 public companies) — demonstrates the
*proxy-informant* design: respondents are corporate secretaries and in-house governance
professionals reporting on behalf of companies, not directors. Its domain map (where AI
responsibility resides; use policies/frameworks; risk mitigation; education & training;
board oversight responsibilities & agendas; employee utilisation of AI tools) overlaps
almost completely with the AICD/HTI elements — good construct convergence. Its informant
choice is the design decision we must make explicitly (we survey directors themselves).

**McKinsey State of AI** (March 2025 ed., n=1,491, 101 countries) — supplies the
accountability-locus item: 28% of respondents at AI-using organisations say the **CEO**
is responsible for overseeing AI governance; ~17% say the **board**. Respondents are
executives, not directors — useful as a contrast benchmark for the same question asked
of directors.

**WEF "Empowering AI Leadership" Oversight Toolkit** (with AICD input) — 13 modules
aligned to board committees. Verified to contain **zero** question wording or scales;
and it dates from 2020, pre-generative-AI. Use for domain coverage cross-checks only.

**Cisco AI Readiness Index** (2023–2025, ~8,000 senior leaders, ~30 markets) — the
scale-architecture template: six weighted pillars (strategy 15%, infrastructure 25%,
data 20%, governance 15%, talent 15%, culture 10%) → 49 indicators → weighted 0–100
composite → four named tiers with fixed thresholds (**Pacesetters** >86, **Chasers**
61–85, **Followers** 31–60, **Laggards** 0–30). "Tested" means fielded at scale, not
psychometrically validated — no published reliability statistics. The *pattern* (weighted
composite + named bands) is what to emulate for tiered benchmark reporting.

### 2.3 Australian sentiment & adoption baselines

**Governance Institute of Australia, 2025 AI Deployment and Governance Survey** (n=344
governance professionals, fielded Feb–Mar 2025; sponsored by the National AI Centre,
Diligent and PKF). Verified against the primary PDF:

- **64%** of organisations have provided no AI training (Q13: No = 64.17%).
- **93%** cannot effectively measure AI ROI (Q18: No = 93.70%, 223/238 answering).
- **88%** have struggled to integrate generative AI into legacy systems.
- Only **10%** hold advanced AI qualifications; **46%** have no AI training at all.

**GIA 2025 Board Effectiveness Survey** ("Boards divided on AI", ~Nov 2025; medium
confidence, 2–1 verification vote): **44%** ready to invest in secure AI tools vs 56%
not yet convinced; **~70%** of boards used AI in some form of board work in the prior
six months; 40% experimenting with multiple tools. (Originally misattributed in some
coverage to the Deployment survey — cite the Board Effectiveness Survey.)

**Diligent Institute / GIA / SID, APAC Governance Outlook 2026** (n=187 governance
leaders APAC-wide, fielded Jul–Sep 2025; Australian subsample unpublished — treat as
directional): **43%** of Australian governance leaders say AI adoption is top of the
strategic agenda; **61%** of organisations have restricted or defined employee AI use
(~2× the Asian peer rate of 30%); only **13%** of boards have recruited AI-savvy
directors; only **21%** mandate director AI training.

**The gap:** every Australian source samples governance professionals / company
secretaries or mixed governance leaders — **no verified source samples Australian board
directors directly at scale.** That is exactly the positioning for this survey and its
published report.

---

## 3. Instrument architecture

### 3.1 Two indices, one instrument

The survey should produce **two separately scored composites**, because they answer
different questions and will diverge (a director can be personally fluent on a
latent-governance board, and vice versa):

1. **Director AI Capability Index** (individual-referent items: usage, literacy,
   confidence, personal uplift). Scored per respondent. This is the personal benchmark.
2. **Board AI Governance Maturity Index** (board/organisation-referent items: agenda,
   oversight locus, policies, org adoption, board uplift). Scored per respondent as an
   *informant report*; aggregatable per board later.

Banding (Cisco pattern, ASIC-anchored labels for the governance index): weighted 0–100
composite → four named tiers. Suggested governance tiers: **Latent / Emerging /
Structured / Strategic** — the outer anchors mirror ASIC's observed spectrum with the
middle split in two for reporting granularity. Publish the banding thresholds in the
report methodology (fixed thresholds, per Cisco) so year-on-year comparisons hold.

### 3.2 Design-for-both: aggregation rules baked in from day one

To let responses later roll up into a board-level profile (the org-diagnostic pattern
already specced in `docs/architecture/2026-04-20-org-assessment-architecture.md`):

- **Split item referents cleanly.** Every item is either *I/me* (individual index) or
  *this board / this organisation* (governance index). No mixed referents. Board-referent
  items become aggregatable informant reports — mean across directors of the same board,
  with the existing confidence-tier logic (≥5 respondents to report, variance-based
  confidence).
- **Descriptive, not evaluative anchors** for board-referent Likert items (the OPS
  lesson): "How well does this describe your board?" reduces social desirability
  contamination versus agree/disagree with "my board is good at X".
- **Capture an optional board/organisation identifier** (org name or ABN, optional and
  clearly separated from the anonymity promise) plus board role (chair / NED / committee
  chair), sector, org size, listing status. For the thought-leadership wave these are
  stratifiers; for the future board-diagnostic product they are the join key.
- **Ask "which organisation are you answering for?"** Directors average multiple boards.
  Instruct respondents to answer board-referent items for **one nominated board** (their
  primary or most AI-exposed), and record which type it is. Without this, board-referent
  data is uninterpretable.

### 3.3 Length recommendation: ~35–40 items, 10–12 minutes

Derived from the comparable instruments rather than picked arbitrarily:

- The director surveys that achieved usable Ns are all pulse-length: GIA's Deployment
  survey (n=344) runs ~20 substantive questions; Deloitte's Governance of AI survey
  (n=695, 84% directors) is a short structured instrument; Diligent's APAC Outlook is
  similar. None is a 60+ item battery.
- Floor effects (46% no training) mean long expertise batteries waste items on
  questions most respondents answer at the bottom anchor.
- Cold outreach to time-poor directors: every comparable that worked kept burden near
  10 minutes.

Budget: ~6 screener/demographic items, ~8 individual capability, ~6 oversight
structures, ~8 policies & controls, ~5 organisational adoption, ~5 capability uplift,
1–2 optional free-text. Total ≈ 38 items ≈ 10–12 minutes at directors' reading pace.

---

## 4. Recommended domains, example items and scale formats

Item stems below are drafts grounded in the verified instruments; final wording needs a
review pass against the AICD/HTI V2 guide and a pilot (n≈15–20 friendly directors).

### Domain 0 — Screener & context (~6 items)

*Rationale:* AICD/HTI scopes guidance by adoption stage; Diligent benchmarks strategic
agenda placement (43% top-of-agenda in AU). These items also drive skip logic.

| # | Item stem | Format |
|---|---|---|
| 0.1 | Which best describes your primary board role? | Categorical: Chair / Non-executive director / Executive director / Committee chair / Other |
| 0.2 | For the questions about "this board/organisation", answer for the board you spend the most time with. Which sector is it in? | Categorical (ANZSIC-lite list) |
| 0.3 | Organisation size / type | Categorical: listed / private / government / NFP; FTE bands |
| 0.4 | Which best describes this organisation's use of AI today? | Staged categorical: Not using and no plans / Exploring / Piloting / In production in some functions / Embedded across the organisation / **Don't know** |
| 0.5 | Where does AI currently sit on this organisation's strategic agenda? | Ordinal: Top priority / One of several priorities / An emerging topic / Not on the agenda (benchmark: Diligent 43% top) |
| 0.6 | How many boards do you currently serve on? | Numeric band |

"Don't know" on 0.4 is itself a diagnostic signal for a director and should be reported
as such, not treated as missing data.

### Domain 1 — Individual director AI literacy, usage & confidence (~8 items)

*Rationale:* GIA gives Australian anchors (10% advanced qualifications, 46% no training,
~70% of boards used AI in board work). The refuted Deloitte literacy stat says: measure
**behaviour and confidence-in-task**, not self-rated "knowledge".

| # | Item stem | Format |
|---|---|---|
| 1.1 | How often do you personally use AI tools (e.g. ChatGPT, Copilot, Gemini) in your professional or board work? | Frequency ordinal: Never / A few times ever / Monthly / Weekly / Daily or near-daily |
| 1.2 | In the last 6 months, have you used AI to prepare for board work (e.g. summarising papers, scanning risk)? | Yes, regularly / Yes, occasionally / No (benchmark: GIA ~70% of boards) |
| 1.3 | What formal AI learning have you completed? | Staged categorical: None / Self-directed only / Short course or director briefing / Formal qualification / Advanced qualification (benchmark: GIA 10% advanced, 46% none) |
| 1.4–1.7 | Confidence battery, 5-pt Likert (Not at all confident → Extremely confident): "Asking management probing questions about our AI use" / "Assessing the key risks AI poses to this organisation" / "Reading an AI risk or assurance report critically" / "Contributing to a board decision to invest in (or reject) an AI initiative" | Likert battery, one scale, 4 statements |
| 1.8 | When AI is discussed at board level, which best describes your typical part? | Behavioural categorical: I lead or sponsor the discussion / I contribute actively / I follow and vote / I defer to others with more expertise / It hasn't come up |

The confidence battery is task-anchored (self-efficacy for specific director tasks)
rather than global self-rated literacy — more stable, more actionable, and it sidesteps
the refuted-benchmark problem.

### Domain 2 — Board oversight structures (~6 items)

*Rationale:* Deloitte's two formats are field-tested with global benchmarks; McKinsey
adds the accountability-locus contrast.

| # | Item stem | Format |
|---|---|---|
| 2.1 | How often does AI appear on this board's agenda? | Frequency ordinal (full Deloitte scale): Never / Annually / Twice a year / Quarterly / Every meeting (benchmarks: 31% never, 17% every meeting, global) |
| 2.2 | Where does AI oversight primarily sit? | Categorical: Full board / Audit committee / Risk committee / Technology or digital committee / Other committee / Not formally assigned (benchmark: 46% full board, global) |
| 2.3 | Who is accountable to the board for AI governance in this organisation? | Categorical: CEO / CIO-CTO / CRO / Chief Data or AI Officer / No single accountable executive / Don't know (benchmarks: McKinsey 28% CEO, 17% board) |
| 2.4 | How often does the board receive management reporting on AI use and its risks? | Frequency ordinal: Never / Ad hoc only / Annually / Quarterly / Every meeting |
| 2.5 | Has this board formally defined its own role in AI oversight (e.g. in the board charter or a committee charter)? | Yes / In progress / No / Don't know |
| 2.6 | Does the board have access to independent AI expertise when it needs it (advisor, external assurance, expert director)? | Yes, standing / Yes, ad hoc / No / Don't know |

### Domain 3 — Governance policies & controls (~8 items)

*Rationale:* ASIC REP 798 deficits convert directly; Diligent's 61% employee-use figure
benchmarks the policy-stance item; sections map to AICD/HTI elements 4–5 and 8.

| # | Item stem | Format |
|---|---|---|
| 3.1 | Has this organisation updated its risk management framework to specifically address AI? | Yes / In progress / No / Don't know (benchmark: ~50% of ASIC licensees) |
| 3.2 | Does this organisation have a policy on disclosing AI use to affected customers or stakeholders? | Yes / In progress / No / Don't know (benchmark: 43% ASIC) |
| 3.3 | Do this organisation's policies address fairness and bias in AI-driven decisions? | Yes / Partially / No / Don't know (benchmark: ~half lacking, ASIC) |
| 3.4 | Which best describes this organisation's position on employee use of AI tools? | Categorical: Prohibited / Restricted to approved tools & uses / Permitted with guidelines / No position taken / Don't know (benchmark: 61% restricted/defined, AU) |
| 3.5 | Which best describes this organisation's overall approach to AI governance? | **Staged maturity with descriptors** (ASIC spectrum, 4 levels): Latent — no AI-specific governance / Emerging — relying on existing risk frameworks, AI not separately addressed / Structured — AI-specific policies and clear ownership in place / Strategic — centralised, board-visible AI governance integrated with strategy |
| 3.6 | Before this organisation adopts a significant AI system, is a risk or impact assessment required? | Always / Sometimes / Never / Don't know |
| 3.7 | Is AI covered in this organisation's assurance program (internal audit, external review)? | Yes / Planned / No / Don't know |
| 3.8 | Does the board review any metrics on AI system performance or incidents? | Regularly / Occasionally / Never / Don't know |

The high expected rate of "Don't know" among directors is a *publishable finding* about
board visibility, not noise — design the report to use it.

### Domain 4 — Organisational adoption & value, as seen from the board (~5 items)

*Rationale:* GIA's 93% (ROI) and 88% (legacy integration) are the strongest Australian
hooks for the published report; the board's view of both is the new data.

| # | Item stem | Format |
|---|---|---|
| 4.1 | Can this organisation measure the return on its AI investments today? | Yes, systematically / Partially / No / Don't know (benchmark: 93% no, GIA) |
| 4.2 | How much has integration with existing systems constrained this organisation's AI adoption? | 5-pt Likert: Not at all → Severely (benchmark: 88% struggled, GIA) |
| 4.3 | Relative to competitors/peers, this organisation's AI adoption is… | Ordinal: Well behind / Somewhat behind / On par / Somewhat ahead / Well ahead / Can't judge |
| 4.4 | How confident are you that management has the capability to deliver this organisation's AI ambitions? | 5-pt confidence Likert |
| 4.5 | In the next 12 months, this organisation's investment in AI will… | Decrease / Stay flat / Increase somewhat / Increase significantly / Don't know (echo: ~61% of ASIC licensees planned increases; GIA 44/56 investment-readiness split) |

### Domain 5 — Capability uplift (~5 items)

*Rationale:* Deloitte shows the three mechanisms diverge sharply (59% self-educate /
48% formal training / 10% recruit); Australia is lower still (21% mandate training, 13%
recruited). Measure each separately.

| # | Item stem | Format |
|---|---|---|
| 5.1 | In the past 12 months, have you undertaken self-directed learning about AI (reading, courses, briefings)? | Frequency ordinal (benchmark: 59% global) |
| 5.2 | Does this board provide or arrange formal AI training for directors? | Yes, mandatory / Yes, optional / No / Don't know (benchmarks: 48% offer global; 21% mandate AU) |
| 5.3 | Has this board recruited, or does it plan to recruit, directors with AI expertise? | Have recruited / Actively planning / Considered but no plans / Not considered (benchmarks: 10% global, 13% AU) |
| 5.4 | Does this board have a defined plan to uplift its collective AI capability? | Yes / In development / No / Don't know |
| 5.5 | What is the biggest barrier to lifting this board's AI capability? | **Multi-select (pick up to 2):** Time on the agenda / Access to relevant training / Cost / Difficulty assessing quality of advice / Board composition / It isn't seen as a priority / Other |

### Optional close (~2 items)

- One open text: "What is the one thing that would most improve your board's ability to
  govern AI?" (short, optional — qualitative colour for the published report).
- Consent to be re-contacted / receive the benchmark report (the lead-gen hook, kept
  separate from the anonymous response data).

---

## 5. Scoring & benchmark reporting

- **Director AI Capability Index:** weighted composite of Domain 1 + item 5.1.
  Frequency and staged items map to 0–100 sub-scores; confidence battery averaged.
  Suggested weights: usage 30 / learning 20 / confidence 40 / contribution 10.
- **Board AI Governance Maturity Index:** weighted composite of Domains 2, 3, and 5.2–5.4,
  with Domain 4 reported alongside but *not* in the composite (it measures the
  organisation, not the board's governance of it). Suggested weights: oversight
  structures 35 / policies & controls 40 / uplift 25. "Don't know" scores 0 for the
  composite **and** is reported separately as a visibility metric.
- **Tiers:** fixed thresholds published in the methodology (e.g. 0–30 Latent, 31–60
  Emerging, 61–85 Structured, 86–100 Strategic), Cisco-style, so wave 2 is comparable.
- **Norm-referenced report lines:** every domain has at least one external anchor
  (Deloitte agenda/committee/uplift; McKinsey accountability; ASIC policy deficits &
  spectrum; GIA ROI/legacy/training; Diligent agenda/employee-policy/recruitment) —
  cite them as directional priors, not population norms (see §6.5).

---

## 6. Measurement pitfalls (and the design responses baked in above)

1. **Informant effects.** Director self-report vs governance-professional proxy report
   diverge dramatically (a verifier cross-check noted PwC 2025 found 99% of executives
   vs 35% of directors reporting board AI use). *Response:* we survey directors
   directly, fix the informant in the methodology, and treat GIA/Diligent
   (governance-professional samples) as adjacent, not identical, benchmarks.
2. **Floor effects.** With 46% no-training and 10% advanced qualifications among even
   governance professionals, expect mass at the bottom of capability items. *Response:*
   scales anchored with low-end behavioural gradations (Never / A few times ever /
   Monthly…), not expertise gradations most respondents lack.
3. **Self-rated literacy is unstable.** The only refuted claim in verification (0–3) was
   the widely-cited "66% of directors have limited-to-no AI knowledge" figure. *Response:*
   task-anchored confidence and behaviour-frequency items instead of global self-ratings;
   do **not** reuse the 66% stat in any published material.
4. **Outcome self-reports without measurement infrastructure.** 93% of organisations
   can't measure AI ROI, so board-perceived "AI value" items measure sentiment.
   *Response:* ask *whether* ROI can be measured (a fact-like item) rather than *how much*
   value AI has created.
5. **Benchmark fragility.** Diligent's Australian figures sit inside an APAC n=187 with
   an unpublished national subsample; GIA is a self-selected member sample. *Response:*
   cite as "surveyed organisations/professionals" with sample descriptions, never as
   national population statistics.
6. **Truncated scales.** Headline reporting (e.g. Deloitte's three quoted agenda
   percentages summing to 67%) hides response options. *Response:* replicate full scales
   from the source instruments so our distributions are comparable.
7. **Acquiescence & social desirability on board-referent items.** *Response:*
   descriptive anchors ("which best describes…") over agree/disagree; "Don't know"
   offered on all fact-like policy items and reported as a visibility finding.

---

## 7. Open questions for a follow-up research pass

1. AICD **Director Sentiment Index** AI items — exact wording and latest results
   (unverified this pass; AICD pages resisted fetching). Worth a manual pull: it is the
   closest thing to a true Australian director-sampled benchmark.
2. Mapping the **Voluntary AI Safety Standard's 10 guardrails**, **ISO/IEC 42001** and
   **NIST AI RMF** to board-level surveyable practices — none survived verification this
   pass; needed to future-proof the policy items against the compliance frames boards
   will be assessed against.
3. **APRA** expectations on board AI oversight (distinct from ASIC) — unverified.
4. Whether any **psychometrically validated director AI-competency instrument** exists
   (published reliability/validity) — none found; current instruments are all
   consulting/vendor pulse surveys. If none exists, our validated instrument is itself a
   defensible differentiator worth building toward (test-retest + alpha on wave 1 data).
5. Diligent's Australian subsample size / crosstabs, to firm up the 43/61/13/21 figures.

---

## 8. Platform gap analysis — building this in Trajectas

Full machinery audit summary (from the codebase pass, 2026-07-02):

### 8.1 What exists and is directly reusable

| Capability | Where |
|---|---|
| Anonymous token-based delivery, no account | `campaign_participants.access_token` → `/assess/[token]/…`; self-enrol via `registerViaLink`; `org_diagnostic_respondents` follows the same pattern |
| 5-pt Likert with custom anchor labels | `response_formats` (`type='likert'`, `config` JSONB), `anchor_presets` (2–10 pt: agreement / frequency / capability families), `likert-response.tsx` |
| One scale bound to a block of statements | `assessment_sections.response_format_id` (data model supports the "battery" pattern; rendering is one-item-per-card, which is fine for directors on mobile) |
| Response capture | `participant_responses.response_value` (numeric, unconstrained) + `response_data` JSONB; batched autosave RPC |
| Free text | `free_text` format + renderer |
| Demographics side-flow | `demographics-form.tsx` (categorical selects, config-driven) — covers Domain 0 stratifiers without new item types |
| Aggregation/reporting infra | `src/lib/comparison/`, `diagnostic_snapshots`, `org_diagnostic_profiles` (skeleton) |

### 8.2 What is genuinely new work for this instrument

Ordered by necessity for the market-research wave:

1. **Scored categorical single-select** (oversight locus, accountability, policy stance).
   Closest existing renderer is `sjt-response.tsx` (lettered single-select). Needs: a
   `categorical` response format (or a generalisation of SJT), analysis treating values
   as unordered categories rather than scale points.
2. **"Don't know / can't judge" option semantics** — an option flagged as
   excluded-from-composite but reported as a visibility metric. Small schema/config
   addition (e.g. an `exclude_from_scoring` flag on `item_options`), touches scoring.
3. **Staged maturity descriptor format** (item 3.5, 0.4): single-select where each
   option carries a multi-line descriptor. `capability` anchor preset has short labels
   only; needs a renderer variant with descriptor text per option.
4. **Multi-select** (item 5.5, one item only): new format type + array capture in
   `response_data` + checkbox renderer (primitive exists in `ui/checkbox.tsx`). Could be
   avoided in wave 1 by converting 5.5 to "biggest single barrier" (single-select) —
   recommended simplification if we want zero multi-select build.
5. **Skip logic** (screener 0.4 = "not using and no plans" → skip Domains 3–4 policy
   detail): no conditional logic exists. Wave-1 workaround: rely on "Don't know / Not
   applicable" options instead of branching — acceptable for a 38-item instrument and
   avoids the build entirely. Real branching becomes worthwhile for the productised
   diagnostic later.
6. **Board-level aggregation** (the "design for both" half): the `org_diagnostic_*`
   skeleton (campaigns, tracks, respondents, profiles) is the intended home, but its
   items/responses/scoring layers are explicitly deferred and unbuilt. Wave 1 does not
   need them — individual scoring on the existing engine suffices — but item referent
   discipline (§3.2) keeps the door open.

### 8.3 Recommended build path

**Wave 1 (market research), minimal new build:** run on the existing assessment engine
(`assessments` → sections → items) with (a) the categorical single-select format,
(b) `exclude_from_scoring` option flag, (c) the maturity-descriptor renderer variant.
Convert the one multi-select to single-select; replace branching with N/A options.
That is 3 contained additions, everything else is authoring and report work.

**Wave 2 (board diagnostic product):** build the org-diagnostic item/response/scoring
layers per the existing architecture doc, add a `board_ai` campaign kind, port the
instrument, and light up multi-director aggregation with the min-5 anonymity rule and
confidence tiers — at which point the same items yield board profiles and
director-vs-board gap analysis (the OPS-vs-LCQ pattern, applied to AI governance).

---

## 9. Sources (verified, with quality ratings)

**Primary, fetched or verbatim-verified:**
- ASIC REP 798 (Oct 2024) — https://download.asic.gov.au/media/mtllqjo0/rep-798-published-29-october-2024.pdf
- AICD/UTS HTI Director's Guide to AI Governance suite — https://www.uts.edu.au/human-technology-institute/projects/ai-corporate-governance-program/governance-ai-aicd-hti-director-resources
- Deloitte Global Boardroom Program, Governance of AI (2nd ed., 2025) — https://www.deloitte.com/global/en/issues/trust/progress-on-ai-in-the-boardroom-but-room-to-accelerate.html
- Deloitte Board Practices Quarterly, AI (US) — https://www.deloitte.com/us/en/programs/center-for-board-effectiveness/articles/future-of-tech-artificial-intelligence.html
- McKinsey State of AI (March 2025 edition) — https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
- WEF Empowering AI Leadership Oversight Toolkit (2020) — https://www3.weforum.org/docs/WEF_Empowering-AI-Leadership_Oversight-Toolkit.pdf
- Cisco AI Readiness Index methodology — https://www.cisco.com/c/m/en_us/solutions/ai/readiness-index/methodology.html
- GIA 2025 AI Deployment and Governance Survey (primary PDF verified) — https://www.governanceinstitute.com.au/thought-leadership/2025-ai-deployment-and-governance-survey-report/
- GIA "Boards divided on AI" (2025 Board Effectiveness Survey) — https://www.governanceinstitute.com.au/news_media/boards-divided-on-ai-what-2025-data-reveals/
- Diligent Institute APAC Governance Outlook 2026 — https://www.diligent.com/company/newsroom/Diligent-Governance-Outlook-Australia

**Refuted — do not use:**
- "66% of board members self-report limited-to-no AI knowledge" (attributed to Deloitte
  Governance of AI) — failed adversarial verification 0–3. No verified global benchmark
  for self-rated director AI literacy exists.

**Verification note:** most primary pages (ASIC, AICD, UTS, Deloitte, Cisco, GIA,
McKinsey) resist automated fetching; verification relied on exact-phrase corroboration
across multiple independent secondary sources, except the WEF toolkit and GIA survey
PDFs which were fetched and text-verified directly. Fieldwork dates: Deloitte Jan–Feb
2025; GIA Feb–Mar 2025; Diligent Jul–Sep 2025 — all should be re-checked for newer waves
before the report ships.
