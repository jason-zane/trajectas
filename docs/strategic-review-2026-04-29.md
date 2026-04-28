# Trajectas — Strategic & Infrastructure Review

*Date: 29 April 2026*
*Scope: where the platform sits today, whether the longitudinal-development thesis is right, and what to keep/change/remove/build to get there.*

---

## Executive summary

You are further along than you described. The underrated asset isn't the competency library or the matching algorithm — it's the **org diagnostic feeding contextual competency calibration**. That's the thing very few competitors have, and it's the foundation any future direction has to be built around.

Your three-part thesis ("people get more valuable, learning velocity matters most, therefore hire+develop on one platform") is roughly directionally right but rests on weak macro claims that won't hold up to a tough investor or a tough customer. The sharper version of the thesis is:

> *Trajectas's defensible asset is contextual competency definition — the ability to produce a bespoke competency model from an org diagnostic and instrument it with real psychometrics. Hiring is one application of that asset. Longitudinal development tracking is another. The compounding moat is the longitudinal capability data, not the platform breadth.*

Of the four strategic forks I considered (stay narrow on hiring, bridge into development, build a full HCM operating system, sell the data layer via API), the right move is **bridge into development — Fork B**, but for the right reason: not because "hiring naturally extends to development," but because longitudinal capability data on real people is the only asset here that gets **more valuable over time and can't be cloned by a well-funded startup with a Claude API key**.

On the build side, the change is meaningful but smaller than it looks. Most of what you have keeps. The core conceptual shift is from **campaign-centric** ("each assessment is a one-off batch") to **person-centric** ("each person has a longitudinal capability profile that campaigns add events to"). That's an additive change, not a rewrite.

You should not start building the longitudinal product yet. You should run a 90-day validation experiment first — using the infrastructure you already have to remeasure 20–30 hires across 2–3 partner orgs. If the data tells a story managers act on, the build path becomes clear and the fundraising story writes itself.

The rest of this doc explains the reasoning.

---

## 1. Where you actually are

You described the platform as "quite simplistic" on the second half (competency library + assessment building). That's understated. After mapping it, what you actually have is:

- **A multi-tenant 3-tier model** (Platform → Partners → Clients) with proper Row-Level Security. The renames (`organizations` → `clients`, `candidates` → `participants`) are clean and the boundaries between adjectival `org_*` and possessive `client_*` are deliberate.
- **A real psychometric backbone**: full IRT (1PL/2PL/3PL), CTT, calibration runs, item statistics, norm groups, DIF analysis. This is the kind of infrastructure that takes Plum/Hogan years and millions to build and that almost no HR-tech startup has.
- **An AI-GENIE item generation pipeline**: preflight construct analysis → candidate generation → embedding → exploratory graph analysis (EGA) → unidimensional validity → bootstrap stability → final validation. The architecture is in place; the LLM calls are still stubbed.
- **An org diagnostic** (`org_diagnostic_*`, shipped 2026-04-20): baseline campaigns and role-rep campaigns, role-level respondent bucketing, anonymity guarantees enforced at the RLS layer, temporal pinning of the baseline so role campaigns can be compared back to it.
- **Report generation**: snapshot lifecycle, band schemes, derived + AI narrative composition, PDF rendering.
- **A campaign + participant + session model** that is generic enough for repeated measurement — it just isn't being used that way today.
- **Active engineering velocity**: 40+ design specs in `docs/superpowers/specs/` over the last 60 days, ranging from score interpretation to participant comparison (the most recent, 2 days ago).

What's not yet built or is stubbed:

- Real LLM wiring (item generation mocks 30-stem pools today).
- The "matching algorithm" — schema-ready (`org_diagnostic_profiles` exists) but the algorithm that turns an org's culture profile into a recommended competency set is not visible in code.
- Manager-facing development surfaces, longitudinal scoring, change-score interpretation.
- HRIS integrations.
- Email/notification production wiring.

So the honest summary: you have a hiring-shaped psychometric platform with the foundations of an org-diagnostic engine, missing only the matching algorithm and the live LLM. That's a far better starting point for the strategic question than I expected before reading the code.

---

## 2. The thesis, sharpened

Your stated thesis has three claims. Two are partly wrong, one is right but for a different reason than you gave.

**Claim 1: "As AI takes on more cognitive work, the value per person increases."**
Mostly wrong as stated. The historical pattern when technology absorbs cognitive work is *commoditisation*, not premium-isation — labour supply elasticity rises, real wages fall for the median, and the value concentrates in a small elite. The narrow version that holds up: *for organisations that choose to stay small and not outsource, the people who remain are filling more autonomous, higher-judgment roles, so getting those hires right matters more.* That's a much narrower claim, and it doesn't drive a TAM increase — it drives a willingness-to-pay increase among a specific buyer segment.

**Claim 2: "Learning velocity is the most economically valuable trait."**
This is the weakest claim. Three problems:

1. *Learning velocity isn't a stable, measurable trait.* The literature on transfer learning shows it's domain-specific. Someone fast at picking up a new tool may be slow at picking up new social dynamics.
2. *It's not what employers actually pay for.* When you look at what gets people promoted into senior IC and management roles, the predictors are judgment, accountability, and adversity tolerance — not "picks things up quickly."
3. *The "skill half-life is collapsing" framing is overstated.* Specific tools depreciate fast. Pattern libraries, judgment, and relationship networks don't.

The stronger version of this claim: *adaptability under uncertainty + willingness to operate with temporary incompetence* matters more than ever. That's not the same as "learning velocity," and it has different measurement implications.

**Claim 3: "Therefore, hiring + development on one platform is the right strategic position."**
The conclusion is roughly right, but the *reason* is wrong. "Same instrument across the lifecycle" isn't a winning argument by itself — it's the same argument Workday, Eightfold, Lattice, Cornerstone, SuccessFactors, and Culture Amp have all made, and the all-in-one talent platform is a graveyard. The market keeps fragmenting into best-of-breed point solutions because hiring buyers, development buyers, and HRIS buyers are different people with different success metrics.

**The sharper thesis that is actually right:**

> Most talent tooling treats competencies as generic, off-the-shelf, and static. That's wrong. A fintech's "adaptability" is risk-taking and iteration speed; a pharma's "adaptability" is risk mitigation and documentation discipline — same word, different competency. Trajectas's distinctive asset is the ability to *generate bespoke, contextual competency models from an org diagnostic and instrument them with real psychometrics*. That asset is a layer; many products can sit on it. Hiring is the obvious first one. Longitudinal development is where the moat compounds, because the more times you measure the same person against their org's contextual competencies, the better your data gets — and that data can't be cloned by anyone who doesn't have your installed base.

This is a sharper thesis because:
- It tells you what's *defensible* (the contextual layer + the accumulated longitudinal data), not just what's *true*.
- It explains why hiring + development belong on the same platform without leaning on a discredited integration argument.
- It survives the AI-disruption attack better. AI can generate generic competency models in minutes; what AI can't do is run an actual org diagnostic, calibrate against it, and accumulate years of trajectory data on real employees.

What this thesis still has to defend against:
- **Buyers may not actually want bespoke models.** Some HR leaders want to benchmark against industry standards (SHL, Hogan) precisely *because* they're generic. "We use SHL" is a defensible HR-leader decision; "we built a custom thing with Trajectas" is a career risk.
- **AI commoditises competency definition fast.** In 18 months, Claude/GPT will produce defensible competency frameworks from a one-page org description. The defensibility shifts from "we can produce the model" to "we have the validated, longitudinal data on real people against the model."
- **Longitudinal measurement decays.** Re-survey fatigue, self-report drift, life-event noise, and manager attrition all chip away at signal quality. The hard work isn't building the system — it's keeping participation high enough over years that the data actually means something.

---

## 3. The strategic forks

I evaluated four primary forks plus three "Fork E" alternatives.

**Fork A — Stay narrow on hiring.** Best-in-class hire-for-fit tool for mid-market via consulting partners, differentiated on contextual competencies. Verdict: defensible 2–3 year position, but the TAM is shared with Plum/Hogan/Pymetrics/PI/SHL and the moat is moderate. It's a local maximum, not a long game. *If you stay here, you're a feature, not a platform.*

**Fork B — Bridge hiring → development.** Same instrument at hire becomes the baseline for ongoing development tracking. Longitudinal data per person follows them through tenure. Verdict: **strongest fork**, for the reason in the sharper thesis (longitudinal data moat compounds), not for the reason you originally gave (lifecycle integration). Highest defensibility, plays directly to the assets you already have.

**Fork C — Operating system for human capital.** Hire + develop + perform + comp + workforce planning. Verdict: pass. Largest TAM, near-certain execution failure, requires $15M+ of capital and a VP Sales who's sold enterprise HCM. Workday and Eightfold will out-feature you on every line item. This is not a fork that can be tested cheaply — it's an all-in commitment.

**Fork D — Capability data layer (API-first).** Sell competency models and benchmarks as an API/data product to other HR tools. Verdict: real but not venture-scale. Ceiling is probably $10–30M ARR, very long sales cycles, and you're competing with Mercer/SHL who already have distribution. Worth keeping as an *optionality* — the data you accumulate via Fork B can be productised this way later. Don't pick it as the primary bet.

**E1 — Productise the org diagnostic alone.** Sell it as a standalone "find out what your org actually values" tool. Verdict: small business, not venture. Consultants will buy, but you compete with culture-consulting firms that have relationships you don't.

**E2 — AI-native competency inference from observable work.** Ditch surveys; infer capability from calendar, Slack, code, customer calls. Verdict: genuinely interesting and probably the right move *eventually*, but you're 2–3 years early. The product is fundamentally different from what you've built (continuous signals, not point assessments). Treat this as an 18-month optionality after Fork B has accumulated enough labelled data to train inference models against. It also has serious privacy/legal exposure that intentional assessments don't.

**E3 — Vertical-specific (engineering teams only, or sales orgs only).** Verdict: a hedge, not a strategy. You can do this *after* Fork B works in one vertical to get distribution. Don't split early.

**The recommendation: Fork B, with Fork D as latent optionality and E2 as a 24-month bet.**

There's one prior to flag: if your real reason for liking Fork B is "it feels like the natural product progression from where we are," that's a weak reason. The strong reason is the longitudinal data moat. If you're not actually willing to play the long game on accumulating capability trajectories — and accept that the value of this business compounds slowly for 3–4 years before the moat is visible — Fork A is honestly the better fit. The strategic question to settle for yourself is whether you want the slower, deeper game.

---

## 4. What this means for the build

The conceptual shift the platform needs is one sentence:

> Today the spine of the data model is a **campaign**. Tomorrow the spine has to be a **person** whose capability profile evolves over time, and campaigns become events that update that profile.

Most of what you have keeps. The change is additive, not a rewrite.

### Keep (these are the assets — protect them)

- The 3-tier multi-tenant model (Platform → Partners → Clients).
- The org diagnostic infrastructure (`org_diagnostic_campaigns`, `org_diagnostic_campaign_tracks`, `org_diagnostic_respondents`, `org_diagnostic_profiles`). This is the contextual layer; it's the thing competitors don't have.
- The competency hierarchy (Dimensions → Factors → Constructs → Items) and the flexible taxonomy work that just shipped.
- The IRT / CTT psychometric backbone, calibration, norm groups, DIF.
- The AI-GENIE item generation pipeline architecture (it just needs the LLM wired).
- The campaign + participant + session model. *Don't replace it.* Generalise it: it's still the mechanism by which measurement events flow into the longitudinal profile.
- Report generation, snapshot lifecycle, band schemes, derived + AI narrative.

### Change

- **Elevate "person" to a first-class entity with a stable identity.** Today a person who joins as a candidate, gets hired, and then starts being assessed for development is — in your data model — a sequence of mostly-disconnected `campaign_participants` and `profiles` rows. They need to be one durable record with a continuous identity that survives org changes, role changes, and re-measurement cycles.
- **Add a longitudinal capability log.** An append-only history per person per competency, with timestamps, source campaign, and statistical metadata for change-score interpretation. This is a small new table, not a refactor.
- **Adjust the anonymity model.** The org diagnostic deliberately strips respondent identity — that's correct for that product and must stay. But longitudinal development tracking *cannot* be anonymous: a manager has to see Mary's growth as Mary's growth. You'll need two clearly separated modes (anonymous diagnostic vs. identified development), with explicit consent and visible-to-the-employee transparency rules. This is the most consequential change because it has compliance implications, not just engineering ones.
- **Generalise the assessment runner to support short pulse-style measurements.** A 10-minute follow-up is a different shape than a 45-minute hiring assessment, but both can run on the same psychometric scale via adaptive item selection from the calibrated bank. The CAT skeleton you already have is the right primitive.

### Remove or deprioritise

- Anything explicitly recruitment-funnel-shaped that doesn't generalise. The "candidate" → "participant" rename is in the right direction; finish it.
- Don't sink more into full-CAT runtime sequencing right now. Pulse-style fixed forms (8–12 calibrated items) are simpler, cheaper to build, and cover most longitudinal use cases. Save the CAT investment for later when sample sizes justify it.
- The "matching algorithm" as currently scoped (org diagnostic → recommended assessments) is a hiring-product feature. Don't kill it, but stop investing further until the longitudinal layer is validated. The algorithm becomes much more interesting when it's also recommending *development interventions* per person, not just *assessments* per role.

### Build (in rough order)

1. **LLM wiring for item generation and AI narrative.** This is "must do anyway" but it becomes urgent because pulse measurements and longitudinal narratives will lean on it heavily.
2. **Person entity + longitudinal capability log.** A small additive migration; it's the spine of everything else.
3. **Pulse measurement runner.** Short-form, 8–12 items, calibrated against the established item bank. Reuses everything you already have.
4. **Manager-facing development view.** Team capability dashboard, individual growth view, suggested development conversations. *This is the surface that actually creates value for buyers.* It's also the surface you don't have at all today.
5. **Person-facing self-service view.** "My capability profile, my growth, my learning recommendations." Probably opt-in initially.
6. **Consent + retention compliance layer.** GDPR-grade: explicit consent for longitudinal storage, right-to-be-forgotten flows, retention windows, role-based access. *Do this before you have customer data, not after.*
7. **HRIS integrations** (BambooHR, HiBob, Workday, Rippling). Not because of feature richness — because lifecycle events (hire, role change, promotion, exit) anchor the longitudinal data. Without these, your data drifts away from reality.
8. **Development analytics: change-score significance, cohort comparisons, intervention efficacy.** This is where the data moat becomes visible to buyers.
9. **Manager workflow embedding.** Slack/Teams nudges, calendar integration, 1:1 prep templates. This is what makes managers actually use it instead of forgetting it.

### Compliance/privacy is now a first-class concern

The shift from one-off hiring assessments to retained longitudinal capability data is a step-change in privacy/regulatory exposure. Hiring assessments are commonly seen as legitimate-interest-justified and short-retention. Longitudinal capability records on identified employees are a different beast — they look (legitimately) like an HR file, with all the GDPR Article 22 (automated decision-making) and works-council exposure that implies in EU markets, and equivalent discrimination/EEOC considerations in the US. Build the consent + access + retention model in once, properly, before customer data starts piling up. Retrofitting it is a six-month nightmare.

---

## 5. Three approaches to making the change — and the right one

I considered three ways to make this transition.

**Approach 1 — Incremental extension.** Keep everything; add new tables and new UIs alongside. Fast, low rework, but the conceptual mismatch between "campaign-centric tables" and "person-centric features" creates a slow tax that compounds.

**Approach 2 — Refactor to a person-centric core.** Restructure so that `Person` + `LongitudinalProfile` is the spine and campaigns are mechanisms hanging off it. Conceptually clean and future-proof, but high rework risk on the org-diagnostic feature you just shipped, and 4–6 months before you ship anything new.

**Approach 3 — Parallel new module.** Keep the existing hiring product as v1; build "Trajectory" (the development product) as a separate module that consumes outputs from the existing system. Fast separate shipping, but accumulates integration tax.

**The right answer is a hybrid: Approach 1 with one targeted refactor.** Specifically:

- Introduce `persons` as a new table (or elevate `profiles` to play that role — naming TBD with your team), small migration, additive.
- Introduce `person_capability_history` as a new append-only log.
- Keep `campaigns`, `campaign_participants`, and `participant_sessions` exactly as they are. They become the *event source* that writes into the longitudinal log when sessions complete.
- Add `measurement_pulses` as a new lightweight campaign type (essentially a campaign with a smaller item set and a recurring schedule).
- Add `development_engagements` — the "manager + report-relationship + cadence + competencies-being-tracked" record that powers the manager UI.

That's roughly four new tables and a few view/RLS updates. Maybe two weeks of careful migration work, plus the ongoing build of the surfaces and integrations on top. This minimises rework, doesn't touch the org-diagnostic feature, and keeps the option open to do a deeper refactor later once you've learned what the longitudinal product actually wants the data shape to be.

---

## 6. Phasing

**Phase 0 — Validate before you build (next 90 days).** Don't build the new infra yet. Use existing campaigns to remeasure 20–30 hires across 2–3 partner orgs at 6 months post-hire. Generate the simplest possible growth report manually. The questions you need answered before committing engineering time:

- *Do managers find the growth view useful enough to act on?* (Mentorship changes, project assignments, stretch goals, promotion decisions.)
- *Is the signal-to-noise ratio good enough at 6 months to be diagnostic, or do you need 12+?*
- *Are participants willing to do a re-measurement, and what does the drop-off look like?*
- *Will partner firms commit to selling a development engagement, not just a hiring engagement?*

If the answers are "yes, useful," "yes, diagnostic," "yes, willing," "yes, will commit" — build the longitudinal layer. If any of these are weak, you don't have a development product yet; you have a hiring product. Stay narrow (Fork A) and rebuild this case in 12 months.

**Phase 1 — Minimum longitudinal layer (months 4–7).** LLM wiring. `persons` + capability history tables. Pulse runner. Basic manager UI. Consent/retention layer. Goal: ship to the same 2–3 partner orgs, get 100+ people in the longitudinal log, validate that the pulse cadence is sustainable.

**Phase 2 — Manager workflow + HRIS (months 8–12).** Manager-facing dashboards with real opinionated views. HRIS integrations (start with one: BambooHR or HiBob — mid-market focus). Development analytics. Self-serve onboarding for partners.

**Phase 3 — Compounding moat (year 2+).** Cross-org benchmarking (anonymised), intervention efficacy tracking ("which development actions actually move competency scores"), AI-driven competency drift detection. This is where the data starts being worth more than the product.

---

## 7. Key risks and how to deal with them

- **Measurement decay.** Longitudinal studies fail because participants drop off, self-reports drift, and life events add noise. Mitigation: keep cadence light (pulse), embed in manager workflows so the pulse arrives in a context that justifies it (1:1 prep, growth conversations), and treat 80% completion as a metric you actively defend.
- **AI commoditisation of the contextual layer.** In 18 months, Claude can generate a credible competency framework from a one-page org description. Mitigation: shift the moat narrative from "we can build the model" to "we have the validated longitudinal data against it." The data is what compounds; the framework alone won't be defensible.
- **Buyers wanting benchmarks, not bespoke models.** Some buyers value "we use SHL" precisely because it's industry-standard. Mitigation: dual-mode — Trajectas competencies map onto industry standards (e.g. publish a crosswalk to SHL/Hogan competencies) so buyers can have both. Don't force a choice between bespoke and benchmark.
- **Single-product-per-buyer dynamics.** Hiring buyers and development buyers are different personas. Mitigation: lead with the buyer who has both budgets — Head of Talent / VP People — and sell the lifecycle story. Don't try to sell hiring to recruiters and development to L&D as separate motions.
- **Compliance landmines.** GDPR Article 22, EEOC, EU works-council requirements, US state laws on automated decision-making. Mitigation: build the consent + access + retention model before customer data accumulates. Get a privacy lawyer's review before the longitudinal product goes to a paying customer.

---

## 8. What to do this week / this month

This week:

1. Decide whether you genuinely want to play the slow, compounding-data game (Fork B) or whether you'd rather optimise for a defensible 2–3 year hiring position (Fork A). The Phase 0 experiment is wasted if you're not actually going to back the result.
2. Get the LLM wiring on the engineering plan as the next major item after current commitments. It's required for both forks; it unblocks pulse measurements and AI narrative.

This month:

1. Pick the 2–3 partner orgs for the Phase 0 validation experiment. Ideally orgs where you have a baseline org diagnostic already and have hired 20+ people in the last 12 months.
2. Sketch the simplest possible "6-month growth report" — manually produced, one PDF per person, change-score interpretation in plain English. Don't engineer it; do it as a designed artefact first to find out what's actually useful.
3. Open the conversation with one partner firm about a development engagement (not hiring) commercial model. Find out what they'd pay, on what cadence, and what their objections are.

If those conversations land well, the case for building Phase 1 writes itself.

---

## 9. Things I'm uncertain about / open questions

- **The matching algorithm gap.** The schema is there but the algorithm isn't. I haven't fully reverse-engineered whether the matching is partly built in code I didn't read or whether it's mostly conceptual. Worth a focused review with whoever's been closest to that workstream.
- **Partner channel economics.** I've assumed your distribution is via consulting partners. If you're considering direct sales, the cost structure and ICP shift meaningfully and parts of the above need to be re-thought.
- **Geographic regulatory exposure.** EU vs US vs UK have meaningfully different compliance regimes for longitudinal employee data. The right legal-first design depends on which markets you want to be in over the next 2 years.
- **Whether the AI-GENIE pipeline survives contact with production traffic.** It's well-architected but unproven at scale. The first real LLM wiring is the moment you find out whether the design works or whether it needs a meaningful rework.

If any of these are load-bearing for a decision you're about to make, I'd dig further on them before committing to a direction.
