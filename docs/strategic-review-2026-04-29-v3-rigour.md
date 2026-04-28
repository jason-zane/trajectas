# Trajectas — Strategic Review v3: Rigour, Capability vs Personality, and What Buyers Actually Want

*Date: 29 April 2026. Companion to v1 and v2. This review tests the hypothesis that the classical assessment-science framework is mis-calibrated for capability-development products, rebuilds the rigour framework around use-case, and translates that into product implications.*

---

## TL;DR

Your hypothesis is mostly right but for slightly different reasons than you stated. The classical assessment-science framework — reliability coefficients, predictive validity correlations, norms — was built for a *selection* paradigm: one-time, high-stakes hiring decisions on stable personality traits. When you shift to a *development* paradigm — repeated measurement of skills that are supposed to change — three things happen:

1. Predictive validity in its classical form (does today's score predict 2-year-out job performance?) becomes much less central. What replaces it is **decision-threshold validity** ("is the line we're drawing on this score meaningful for the decision being made?") and **growth validity** ("does measured change correspond to real-world capability change?").
2. Reliability stops meaning what it meant. For a stable trait, you want test-retest stability — high consistency over time *is* the goal. For a capability that's supposed to develop, test-retest stability is partly a *bug*: if the score doesn't move when learning happens, your instrument isn't sensitive to change. The right reliability metrics shift to **standard error of measurement (SEM)** and **smallest detectable change**, not classical alpha or test-retest r.
3. The *type* of validity that matters reorders. Content validity (does the instrument cover the right developmental domain?), concurrent validity (does today's score correspond to what managers and peers actually observe?), and action validity (does the output lead to a clear next step?) become more important than predictive validity.

This isn't a lower bar. It's a *different* bar. Most existing assessment providers don't talk in this language because their products were built for selection and their commercial messaging is wedded to predictive-validity coefficients. There's a real strategic opportunity for Trajectas to **redefine the rigour conversation around the development paradigm** — not by lowering rigour, but by being articulate about which rigour is right for which decision. No incumbent can easily make this move because their products were built for the other paradigm.

But — three caveats that the hypothesis under-weights:
- Personality and capability aren't fully separable. "Judgment under uncertainty" looks like a capability but behaves like a stable trait. Your competency framework needs to label which constructs are trait-like and which are skill-like, because the rigour requirements differ.
- For *hiring* (vs. development), classical predictive validity is still the right bar. If you're using a score to make a selection decision, the decision-defensibility test is "does the score predict the outcome we care about?" That doesn't go away.
- For high-stakes regulated domains (airlines, healthcare, nuclear, finance), the rigour bar is *higher*, not lower, and is set by regulators using criterion-referenced (pass/fail-against-defined-standard) rather than norm-referenced standards.

What this means for Trajectas, in one sentence: **lead the conversation about the right rigour for the right decision, anchor the development product on capability constructs with decision-threshold and sensitivity-to-change rigour, keep the hiring product anchored on traditional predictive-validity rigour, and treat personality and capability as distinct layers in the same competency framework rather than collapsing them.**

The rest of this doc unpacks the reasoning, walks through what each persona actually wants from the data, and ends with a concrete set of rigour standards Trajectas can publish and hold itself to.

---

## 1. The classical framework, in plain English

To test where the hypothesis lands, it helps to have a clean shared vocabulary. The four classical pillars of assessment science:

- **Reliability** is consistency. If you measured the same thing twice, would you get a similar answer? It's typically expressed as Cronbach's alpha (internal consistency — do the items hang together?) or test-retest r (do scores stay the same over time on the same person?). Higher = more consistent.
- **Validity** is truth-claim. Does the instrument actually measure what it claims to measure? It splits into:
  - *Construct validity*: does the score reflect the underlying psychological thing we say it reflects?
  - *Content validity*: do the items cover the right domain? (Job-task analysis sits here.)
  - *Criterion validity*: does the score correspond to some external criterion?
    - *Predictive validity* (one type of criterion validity): does the score predict a future outcome (e.g. job performance 12 months later)?
    - *Concurrent validity* (another type): does the score correlate with a current outcome (e.g. today's manager rating)?
  - *Face validity*: does it look meaningful to the test-taker and to the buyer?
  - *Incremental validity*: does the score add information over and above what's already known?
- **Norms** are reference points. To make sense of "Mary scored 64 on judgment under uncertainty," you compare her to a population. Without norms, the score is just a number.
- **Bias / Differential Item Functioning (DIF)**: do groups (gender, ethnicity, age) score systematically differently for reasons unrelated to the underlying trait? This is the legal-defensibility pillar — it has its own regulatory weight.

These pillars were largely standardised in the era of paper-based personality and intelligence testing, where the dominant decision was *one-time selection*. Predictive validity was the headline metric because the dominant question was "if I make this hiring decision based on this score, do better hires result?"

When the paradigm shifts, the relative importance of each pillar shifts too. That's the part of your hypothesis that's right.

---

## 2. Personality vs capability — the distinction matters more than people think

Your framing — "personality is fixed, capability can change" — is roughly right but the science is more nuanced. Worth pulling apart, because the distinction has direct product implications.

**Personality traits (Big Five and analogues)** are stable patterns of behaviour, motivation, and emotion. The Big Five (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism) have rank-order stability test-retest correlations of around 0.7–0.85 across years, sometimes decades. They're not literally fixed — there's slow change across the lifespan and after major life events — but they're slow-moving enough that for any 12-month operational decision, they're effectively stable. *Selection paradigm fits this naturally:* if traits are stable and predictive of job performance, you measure once and decide.

**Capabilities / skills** are learned ways of doing things. Domain expertise (SQL, financial modelling, customer discovery), competencies (giving feedback, negotiating, leading meetings), and applied judgements (when to escalate, how to prioritise). These can change meaningfully over months or even weeks with practice. *Development paradigm fits this:* you measure repeatedly, observe change, target intervention.

**The fuzzy middle.** Plenty of constructs sit awkwardly between the two:
- *Cognitive ability / general mental ability (g):* highly stable from late adolescence onward, near-trait-like, but contributes to learning rate.
- *"Soft" competencies* like resilience, judgment under uncertainty, accountability: behave more like traits in adults than the development-paradigm framing suggests.
- *Emotional intelligence (EI):* contested — some elements are trainable, some are trait-like.
- *Leadership behaviours:* highly developable, but they sit on top of trait foundations.

This matters because **the product can't pretend everything is a developable skill.** If Trajectas's competency framework includes "judgment under uncertainty" as a developable construct and the underlying construct is actually 70% trait, you'll measure repeatedly, see no change, and lose credibility. The honest position is to label each construct in your library with its *expected developability* — strongly trait, mixed, strongly developable — and design the measurement and reporting accordingly.

This is also a positioning advantage. Most competency frameworks don't make this distinction; they list 30 "competencies" as if they're all developable. Trajectas can be specific about which ones are which, and what that means for measurement cadence, expected change, and reporting.

---

## 3. What rigour means in the development paradigm

If we accept that the dominant use case for the longitudinal product is *measuring change in developable capabilities over time* (not predicting future selection outcomes), the rigour framework legitimately shifts. Here's what changes, in plain language.

**Reliability shifts from "stable" to "precise."**
- *Classical alpha* (internal consistency) still matters. You want the items in a scale to hang together. ≥ 0.70 is the standard floor; ≥ 0.80 for high-stakes use.
- *Test-retest reliability* is reframed. You don't want stability per se — you want stability *holding ability constant*. The technical term for this is the **standard error of measurement (SEM)**: how much measurement noise is in any individual score? A small SEM means: when the score moves, you can be confident it's not just noise. SEM is the metric that actually matters for development tracking.
- Out of SEM falls **the smallest detectable change (SDC)**: how big a change in score is statistically distinguishable from noise? This is the operational floor for "did Mary actually improve?"

**Predictive validity is downgraded but not removed.**
- Classical predictive validity (correlation with 12-month future outcomes) is still relevant for *hiring decisions*. If you're going to use a Trajectas score to make a hiring call, you need this evidence eventually.
- For *development*, predictive validity is replaced or augmented by:
  - **Concurrent validity:** does today's score align with what we'd see if a competent observer rated this person right now?
  - **Decision-threshold validity:** are the levels / bands we report (e.g. "developing / proficient / advanced") meaningfully distinct in the real world? Two people on either side of the proficient/advanced line should look different to their manager and to peers.
  - **Growth validity:** when scores move, does observable behaviour move with them? This is harder to study but it's the development-paradigm equivalent of predictive validity.

**Content validity is upgraded.**
- For development, the question "does this instrument cover the right developmental domain?" matters enormously. If you measure 30 competencies but managers say "you're missing the four that actually matter at our org," the product is worthless even if the 30 are reliable.
- This is where the **org diagnostic** earns its keep. The content validity of a Trajectas competency framework for a specific client is anchored in a job-task analysis derived from their org diagnostic, not in a generic library. That's a real differentiator and a real defensible claim.

**Action validity becomes a first-class metric.**
- This isn't standard psychometric vocabulary, but it's what buyers actually care about. *Does the score lead to a clear next step?* If a manager looks at "Mary: judgment under uncertainty 62/100" and has no idea what to do next, the score has zero action validity even if it's perfectly reliable and valid in the classical senses.
- Action validity sits at the boundary of measurement and product design. The scoring engine produces the number; the report, the manager UI, and the suggested-actions layer turn that number into a decision.

**Bias / DIF stays exactly where it is.**
- This is regulatory/legal, not paradigm-specific. Trajectas needs DIF analysis at the same rigour level regardless of whether the use case is selection or development. The IRT framework already supports this.

**Norms shift from "what's typical?" to "what's typical *in this context*?"**
- Generic norm groups (UK working population, mid-market managers, etc.) are useful but limited. The development paradigm benefits more from **role-and-context-specific norms** — what does proficient look like at *this kind of org, in this role, for this competency*?
- This is where Trajectas's accumulated longitudinal data becomes a unique norming asset over time. Five years in, you have norms no incumbent has.

The summary: **the development paradigm doesn't lower the rigour bar; it shifts it.** Sensitivity-to-change, precision (SEM), content validity, decision-threshold validity, and action validity move to the foreground. Classical predictive validity and population-level reliability move to the background, but they don't disappear.

---

## 4. What each lens actually wants

### The org psychologist (rigour view)

What an org psychologist *should* want — once they accept the paradigm shift — is what I described above. What they tend to *actually* want, partly out of professional habit, is the classical framework: reliability ≥ 0.80, published predictive validity, large-N norming samples, DIF studies on protected characteristics, peer-reviewed validation.

The honest assessment: most working org psychs, especially those in selection-heavy backgrounds, will reflexively apply the selection-paradigm rigour bar to a development product. To win them over, Trajectas needs to *teach the distinction* — and back the development-paradigm framework with credible empirical work (SEM, sensitivity-to-change, concurrent validity case studies). Once they see it framed clearly, the better-informed psychs will agree it's the right framework. The less-informed ones will wave the predictive-validity flag forever; you can't satisfy them and shouldn't try.

The practical implication: Trajectas needs published rigour evidence in *both* paradigms, calibrated to the use case. For hiring: classical reliability + DIF + at least one published predictive validity case study. For development: SEM, smallest detectable change, concurrent validity with manager observation, decision-threshold validity for the levels you report.

### The executive coach

Coaches care about *insight, dialogue, change*. They want a tool that:
- Produces output rich enough to coach with — not just a number, but a description, behaviour anchors, examples, contradictions.
- Detects meaningful change over time (so they can show coachees real progress).
- Has a credible legitimacy signal (a Hogan/Korn Ferry/SHL brand has this; a new tool needs to earn it).
- Has face validity to the coachee — the coachee has to look at the report and say "yes, that's me."
- Is not too heavy (a 2-hour assessment kills coaching engagement).

What coaches *don't* care much about: predictive validity coefficients, alpha values, sampling design. They don't read the technical manual. They want a tool they can trust *and* a tool their clients accept.

This is a real product implication. The development-paradigm output should be designed for a coaching/manager-conversation use case: narrative-rich, behaviour-anchored, change-aware, fast to read, hard to argue with. The IRT score in the back end matters, but it should be invisible. The buyer is the partner firm and the user is the coach; the design target is "could this coach use this in a 60-minute development conversation?"

### The tech CEO

A tech CEO of a 500–2,500 person company is making a recurring set of decisions:
- *Bet decisions:* "Should I promote Mary into VP Engineering?" "Is this candidate ready for a Staff role?"
- *Gap decisions:* "Where is my engineering org weakest? Where do I invest in development?"
- *Risk decisions:* "Who's a flight risk? Who's about to break under stretch?"
- *Restructuring decisions:* "Do I have the people for this strategy or do I need to hire?"

What they want from assessment data is **decision-grade signal at the level of the decision they're making** — individual for promotions, team for restructuring, function for investment. They don't read psychometric manuals. They glance at a dashboard, ask one question, and either accept the answer or push back.

The CEO's quality bar is implicit: *"will this hold up if challenged?"* If they fire a senior person and a court asks why, they want to point to defensible evidence. If they double-headcount in customer success based on a capability gap analysis, they want to be confident the gap is real and not measurement noise. They don't need r = 0.42; they need to *not be embarrassed* by the underlying data when it gets scrutinised.

What this means in practice:
- Outputs need to be at decision-relevant aggregations (individual, team, function), not just raw individual scores.
- The supporting evidence (sample sizes, confidence intervals, the "why we're confident" footnote) needs to be one click away — visible if asked, invisible by default.
- The narrative needs to be in business language, not psychometric language. "Mary scores at the 68th percentile of mid-market engineering managers on stakeholder communication" is fine; "Mary's z-score is 0.47 SDs above the calibration sample mean on Construct 14" is not.

The tech CEO is also unusually open to *forward-looking* analytics. "Will Mary be ready for VP in 12 months?" is a question Lattice can't answer. Trajectas's longitudinal data can produce a developmental trajectory model that gives a defensible answer with clear assumptions. That's the killer demo.

### The infrastructure / airline CEO

This is a meaningfully different buyer. In airline, infrastructure, healthcare, energy, finance — anywhere with regulated competency requirements — the question isn't "is Mary developing?" but "is Mary *certified* against the role's defined standard?" The decision is criterion-referenced, the rigour is regulator-defined, and the legal exposure is high.

What they want:
- **Pass/fail or graduated competency levels against a defined standard** (e.g. "type-rated on aircraft X," "qualified to commission switchgear class Y," "competent to handle credit decisions to threshold Z").
- **Currency tracking** ("when does this person's certification expire?"), gap closure plans, and regulatory audit trails.
- **Job-task analysis** linking competencies to actual operational tasks.
- **High reliability** (often higher than mid-market norms — 0.90+), because the stakes are safety-critical.

Should Trajectas play here? *Probably not as a primary market.* Regulated competency requires sector-specific job-task analysis, regulator approval, deep domain expertise (you don't pretend to know how to assess pilot capability without aviation specialists), and a different sales motion. It's a defensible adjacent market for a 2028+ vertical play, but entering it casually is the wrong move.

What it usefully tells you about your *primary* market: even mid-market tech and corporate buyers want some of the regulated mindset — clear levels, defined standards, audit trails. The "graduated competency level against a defined standard" framing is more compelling to most CEOs than a relative percentile, even when the stakes don't require it.

This points to a product implication: **report capability against criterion-referenced levels** ("developing / proficient / advanced / expert" anchored to behaviour descriptions) *and* against norm-referenced percentiles, not just one or the other. Both serve different decisions.

---

## 5. The unifying view: what every buyer actually wants

Stripping back differences, every buyer in this market wants four things from capability data:

1. **Decision-grade signal.** "Tell me something I can act on, defensibly."
2. **Aggregated insight.** "Roll it up to the level I'm making decisions at — individual, team, org."
3. **Forward-looking direction.** "Where is this going? Will this person / team / function be ready for what I need?"
4. **Action specificity.** "What should I do next?"

Almost no commercial assessment product nails all four. Personality-paradigm tools (Hogan, KF4D, SHL) nail (1) for selection but rarely deliver on (2), (3), or (4) outside of consulting wraps. Skills-graph tools (Eightfold, Gloat) gesture at (2) and (3) but their underlying signal is weak. Engagement tools (Culture Amp, Lattice) deliver on (2) but their signal is engagement, not capability. Coaching networks (BetterUp) deliver on (4) but don't produce the underlying measurement.

A development-paradigm product anchored on contextual capability measurement, with role-and-context norms and decision-threshold reporting, can plausibly hit all four. That's the product Trajectas is in a position to ship, and the rigour framework above is what supports it.

---

## 6. The rigour standards Trajectas should publish and hold itself to

Below is a concrete set of standards. The point is to *publish these openly* — on your website, in a "Rigour and methodology" page that any buyer or coach can read — and to hold the product to them. Most competitors won't match this transparency. The transparency itself is part of the moat.

### For hiring use cases (selection paradigm)

- Internal consistency (alpha) ≥ 0.75 per scale at population level.
- Standard error of measurement reported with every individual score.
- Differential item functioning analysed for protected characteristics on every scale; published bias/fairness report per major release.
- At least one published predictive-validity case study within 12 months of GA, with hire-quality outcomes (productivity, retention, manager rating) as the criterion.
- Job-task analysis linking competencies to role outcomes for any contextual hiring assessment.

### For development tracking use cases (development paradigm)

- Standard error of measurement and smallest detectable change reported alongside every individual score and every change score.
- Concurrent validity case study (correlation of capability scores with manager observation / 360 feedback) within 12 months of GA.
- Decision-threshold validity: every reported level (developing / proficient / advanced / expert) anchored to observable behaviour descriptions, with empirical evidence that levels are distinguishable in practice.
- Test-retest analyses run *holding ability constant* (i.e. demonstrated stability when no learning has occurred), separately from change detection (i.e. demonstrated movement when learning has occurred).
- Construct-by-construct labelling of expected developability (strongly trait / mixed / strongly developable) so users know what to expect from change measurement.

### For both

- Norms reported at multiple aggregation levels (general working population, mid-market sector, role-specific) with sample sizes and dates.
- Item-level statistics (IRT difficulty, discrimination, infit/outfit) available to clients on request.
- Anonymised aggregate validity data shared with academic partners under data-use agreements, supporting peer-reviewed publication over time.

### Action / decision support layer (often missing from competitor rigour stories)

- Every individual report ends with a small set of empirically-defensible suggested actions, anchored to the observed score pattern and the construct's developability label.
- Action recommendations are themselves tracked over time so intervention efficacy can eventually be reported back ("development action X, taken Y times across Z clients, associated with score movement of W").

This last item is the most differentiated thing on the list. No major competitor reports intervention efficacy at scale. Trajectas can — eventually — once the longitudinal data set is big enough.

---

## 7. What this changes from v1 / v2

The v2 review told you to "publish predictive validity" as the moat. That guidance was right for *hiring* and incomplete for *development*. The corrected guidance:

- For the *hiring product*, publish predictive validity. Same as before.
- For the *development product*, publish a different rigour story — SEM, smallest detectable change, concurrent validity, decision-threshold validity, growth validity. And label constructs by developability so users know what to expect.
- Across both, lead with *transparency about which rigour belongs to which decision*. Most competitors conflate or oversell. Trajectas can be the one that gets this right and says so out loud.

The product implications also sharpen. Specifically:

- The **competency framework needs a developability label per construct.** This is a small data-model addition (one column on `constructs` with values like `trait`, `mixed`, `skill`) and a meaningful product-design change in how each construct is measured, reported, and tracked over time.
- The **scoring layer needs to surface SEM and SDC** as first-class outputs, not internal statistics. Every individual score should display its uncertainty visibly. Every change-score reported to a manager should pass a "smallest detectable change" gate.
- The **reporting layer should support both norm-referenced (percentile vs population) and criterion-referenced (level against behaviour-anchored standard) views.** Different buyers and different decisions want different framings.
- The **sales/marketing narrative shifts.** Instead of "we have IRT," you say "we hold ourselves to different rigour standards for selection and development decisions, here's exactly what those standards are, here's the evidence we publish against them." That's a credibility move that no competitor in your tier currently makes.
- The **research/IO-psych hire** gets a sharper job description. Not "publish predictive validity" but "build the development-paradigm rigour framework, label every construct by developability, run the SEM and concurrent-validity studies, and own the methodology page." That's a more attractive role for a strong researcher than "produce predictive validity studies for our hiring tool."

---

## 8. The honest limits of this hypothesis

Three places the capability-vs-personality framing under-weights, worth keeping in view:

- **Some "capabilities" are mostly traits.** Resilience, judgment under uncertainty, accountability, intellectual humility — popular competency-library entries — are mixed-to-trait-heavy. Treating them as freely-developable risks measuring repeatedly, seeing no change, and disappointing buyers. The developability labelling above addresses this; but the temptation to oversell will be there. Resist it.
- **Hiring decisions still need predictive validity.** If Trajectas supports any selection decision (hire, promotion to a critical role) on the basis of a score, the legal-defensibility test is criterion validity. That's not negotiable. The development-paradigm rigour framework doesn't replace it; it supplements it.
- **Capability development without a stable underlying trait floor is hard.** Most "capability development" success stories quietly depend on trait-level prerequisites. Someone with very low Conscientiousness is not going to develop reliable execution discipline through a coaching engagement. The product should acknowledge this — possibly by reporting trait-level data alongside capability data and being honest about what's likely to move.

These limits don't undermine the hypothesis. They keep it honest.

---

## 9. The strategic upshot

Combining v1, v2, and this:

- *Strategic direction:* unchanged. Bridge hiring → development, mid-market focus, partner channel, productised contextual diagnostic → contextual competencies → measured capability over time.
- *Competitive moat:* now refined into three parts — productised org diagnostic (the wedge), longitudinal capability data (the data moat), and the dual-paradigm rigour story (the credibility moat). The third one is new in this review and is the most under-claimed in the market.
- *Product:* the competency framework needs developability labels, the scoring layer needs SEM/SDC as first-class outputs, the reporting layer needs both norm- and criterion-referenced views, the action layer eventually needs intervention-efficacy tracking. None of this is a re-platform; it's targeted additions.
- *Hiring narrative:* keep it. Classical predictive validity remains the right standard for selection.
- *Development narrative:* the new piece. Sensitivity to change, precision, decision-threshold validity, action validity. Published transparently. Owned by a research lead who can articulate the framework in plain English to coaches, psychologists, and CEOs alike.

The single most important new idea in this review is that **the rigour bar for development is different, not lower**, and that being publicly clear about this — and matching it with real evidence — is a credibility move that no competitor in your tier can easily copy. Phenom inherits Plum's selection-paradigm rigour framework. Workday + Sana + HiredScore have no rigour framework. Eightfold/Gloat/TechWolf have inferred labels with no rigour framework. The development-paradigm rigour conversation is currently un-owned. Owning it costs comparatively little and pays disproportionately.

If you want me to next: (a) draft the actual "Rigour and methodology" page in plain English for the website; (b) sketch the developability-labelling extension to the competency data model; (c) propose a research agenda and timeline that produces the SEM / SDC / concurrent-validity evidence in the right order — say which and I'll do it.
