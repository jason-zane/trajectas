# Trajectas Verbal Reasoning Assessment — Design Blueprint

**Status: DRAFT DESIGN — NOT VALIDATED. No claim of psychometric adequacy is made or implied. See §14, Empirical validation requirements, before any operational use.**

Document owner: Assessment Design (Psychometrics)
Scope: Design-only deliverable. No platform code. This is the reference document the build will follow.
Language standard: UK English throughout, including all candidate-facing text.

---

## 1. Construct definition

**Construct name:** Verbal Reasoning (deductive and evaluative inference from written information).

**Definition.** The capacity to read a short prose passage and determine, using only the information given, which conclusions follow, which are contradicted, and which are undetermined; and to evaluate the logical structure of short arguments — identifying unstated assumptions and judging how strongly evidence supports a stated conclusion.

Three cognitive operations are in scope:

1. **Entailment judgement** — does the passage logically require the statement to be true?
2. **Contradiction detection** — does the passage logically require the statement to be false?
3. **Suspension of judgement** — recognising that the passage licenses neither, and resisting the pull of prior knowledge, plausibility, or pragmatic suggestion.

Plus, in the secondary item type:

4. **Argument analysis** — identifying the assumption an argument depends on, and calibrating conclusion strength to evidence strength (the correlation/causation, sample/population, and reported/established distinctions).

### 1.1 Place in the CHC hierarchy

Under the Cattell–Horn–Carroll model, verbal reasoning of this kind is a **blend loading primarily on Gf (fluid reasoning), specifically the narrow abilities of sequential/deductive reasoning (RG) and induction (I), operating on verbal content**. Reading the stimulus necessarily engages **Gc (comprehension–knowledge, narrow abilities: language development LD, reading comprehension RC)** and **Grw (reading and writing)** as access skills.

The design intent is explicit: **Gc is the delivery channel, not the target.** The test should discriminate on the quality of inference, not on the size of a candidate's vocabulary, their reading speed, or their stock of acquired knowledge. Every design control in §7 and §11 exists to push variance toward Gf-on-verbal-content and away from Gc, Gs (processing speed), and domain knowledge. Complete separation is impossible — any verbal test carries some Gc variance — but it can be minimised and, critically, held constant across items so that it does not drive rank order.

### 1.2 What it predicts

General cognitive ability is among the strongest single predictors of job performance and training success, and the advantage grows with job complexity. Verbal reasoning is the most job-sampled facet of g for graduate-to-executive roles: reading briefs, board papers, contracts, research summaries and market analyses, and deciding what actually follows from them. The specific behaviours this construct forecasts:

- Extracting the decision-relevant content of dense written material accurately.
- Not over-claiming: distinguishing what a document establishes from what it merely suggests.
- Detecting when an argument (a business case, a vendor claim, a consultant's deck) rests on an unstated and possibly false assumption.
- Resisting confirmation from prior belief when the evidence in front of them does not support it.

These are stated as design rationale grounded in the general criterion-validity literature for cognitive ability, **not** as validity claims for this instrument, which has none until the programme in §14 is completed.

### 1.3 Construct boundaries — what this test must NOT measure

| Excluded source of variance | Control |
|---|---|
| **Reading speed** (Gs/Grw fluency) | Power-with-limit timing (§10); generous per-item time; short passages; passage remains on screen — no memory component |
| **Vocabulary breadth / Gc** | Word-frequency screening of all stimulus text; FK band control (§7); no idioms; no low-frequency lexis in keys or statements |
| **Prior or cultural knowledge** | All passages self-contained and counterfactual-tolerant: every item is answerable, and only answerable, from the passage. Items are screened by the rule in §7.4 |
| **Mathematical ability** | Quantities appear only as simple comparatives ("half", "40 per cent", "fell"); no computation is ever required — that belongs to the numerical reasoning instrument |
| **Test-wiseness** | §12 controls: balanced keys, balanced option properties, absolutes appearing on both sides of the key |
| **Working-memory span beyond task demands** | One statement presented at a time; passage always visible; no cross-passage dependencies |
| **First-language status beyond what the construct requires** | §6.3 and §7: reading-level ceiling, plain syntax, no culturally embedded pragmatics; ESL DIF screening mandatory at pilot |

If an item can be answered faster by knowing things, computing things, or having grown up somewhere in particular, it is defective, whatever its statistics.

---

## 2. Test architecture at a glance

| Component | Item type | Sample items in this document | Recommended operational form | Options | Timing |
|---|---|---|---|---|---|
| Part 1 (core) | Passage-based True / False / Cannot Say | 4 passages × 3–4 statements = 14 | 8 passages × 3 statements = 24 | 3 | 16 min |
| Part 2 (secondary) | Critical-reasoning MCQ (assumption identification, inference strength, argument evaluation) | 5 | 8 | 4 | 10 min |
| Whole test | — | 19 | 32 | — | 26 min + untimed instructions and practice |

Rationale for the two-part structure: Part 1 measures disciplined comprehension-level inference with high item density (short response time per statement, so many data points per minute of testing — important given the 3-option guessing floor, §9). Part 2 measures argument-level analysis that the T/F/CS paradigm cannot reach (assumptions are by definition *not in the text*, so "Cannot Say" logic does not apply), and its 4-option format shores up overall score reliability against guessing. The two parts are reported as a single Verbal Reasoning score with the two subscores available diagnostically only; the parts are not separately normed at launch.

---

## 3. Defence of the True / False / Cannot Say paradigm

### 3.1 Why it is the right core

1. **Construct fidelity.** T/F/CS is a direct operationalisation of the target construct: the three response options *are* the three epistemic states (entailed, contradicted, undetermined) the construct definition names. No other verbal format maps candidate response onto construct state this cleanly. In particular, "Cannot Say" is the only widely used format that measures **suspension of judgement** — the executive-relevant skill of not concluding beyond the evidence — as a scored behaviour rather than as an inference from distractor choices.
2. **Market interpretability.** It is the industry-standard paradigm (SHL Verify, Saville, Talent Q, cut-e derivatives). Clients, candidates and their advisers know how to read the scores, and candidates arrive already understanding the response rules, which reduces construct-irrelevant format-learning variance in live administrations.
3. **Item economics.** One 100-word passage yields three to four scored responses at ~35–45 seconds each. That density matters because the 3-option format needs more items for a given reliability (§9); the paradigm supplies them cheaply in testing time.
4. **Fairness properties.** Text-only stimuli are fully screen-reader compatible and carry none of the figural/colour risks of diagrammatic reasoning. With the reading-level and cultural-neutrality controls of §7, it is one of the most accommodating high-g formats available.

### 3.2 Known weaknesses — stated plainly

The paradigm has well-documented reliability and validity problems when built carelessly. We adopt it with eyes open:

- **W1 — "Cannot Say" ambiguity.** The False/Cannot Say boundary is where most bad items live. If item writers apply "false" loosely (statement is *unlikely* given the passage) in some items and strictly (statement is *contradicted*) in others, candidates cannot learn a consistent rule, inter-item consistency collapses, and the test partly measures agreement with the item writer's epistemology rather than reasoning.
- **W2 — Pragmatic-implicature traps.** Items whose key turns on Gricean implicature ("the report *mentioned* X" → does that mean *only* X?) or on lexical hair-splitting punish cooperative readers and ESL candidates and add error variance, not signal.
- **W3 — Guessing floor.** Chance performance is 33%, compressing the usable score range and putting a ceiling on item discrimination (full analysis in §9).
- **W4 — Response-style contamination.** Cautious candidates over-select Cannot Say; confident candidates under-select it. If keys are unbalanced, this response style masquerades as ability.
- **W5 — Local dependence.** Statements sharing a passage are not experimentally independent; a misread passage takes three items down together, inflating alpha estimates and violating IRT local-independence assumptions if modelled naively.

### 3.3 Mitigations — binding design rules

**M1 — Strict operationalisation of the three keys (the central rule).** Item writers, reviewers and the candidate instructions all use the same definitions:

> - **True** — the statement *must* be true if everything in the passage is true. It is either restated or logically entailed (including licensed paraphrase and valid converses, e.g. "A is clearer than B" entails "B is less clear than A").
> - **False** — the statement *must* be false if everything in the passage is true. The passage entails the statement's **negation**. "Implausible", "probably wrong" and "goes further than the passage" are NOT False.
> - **Cannot Say** — neither of the above. The passage entails neither the statement nor its negation. This includes statements that are probably true in the real world, and statements that combine passage facts with an unsupported link (e.g. an unsupported causal claim between two facts the passage does state).

The candidate instruction screen states these rules verbatim with one worked example of each, plus the framing sentence: *"Use only the information in the passage. Assume it is true, even if you know or believe otherwise."* This single sentence removes most prior-knowledge contamination and legitimises counterfactual content.

**M2 — Reviewer decision procedure.** Every statement passes a two-question test applied independently by two reviewers: (Q1) "Does the passage entail this?" (Q2) "Does the passage entail its negation?" Yes/No → True; No/Yes → False; No/No → Cannot Say; Yes/Yes → defective item, rewrite the passage. Any reviewer disagreement kills or rewrites the item — disagreement between trained reviewers is direct evidence of W1.

**M3 — No-trick rules.** Banned outright: keys that turn on implicature rather than entailment; keys that turn on a single easily missed word ("all", "only", "first") **unless** that word is the legitimate reasoning target and is not visually buried; keys hinging on obscure senses of a word; double negatives; statements whose truth depends on the passage title or on information outside the passage body.

**M4 — Balanced keys.** Operational forms carry keys as close to ⅓/⅓/⅓ as the form allows (tolerance ±1 per form; per-passage tolerance: no passage keys all three of its statements identically). This neutralises W4: no response style earns points, and no meta-strategy ("when unsure, pick Cannot Say") beats chance.

**M5 — Local dependence handled structurally.** Three (occasionally four) statements per passage, never more; statements within a passage probe *different* sentences or different inferential moves, never the same fact twice; reliability estimated at pilot with passage-level testlet models (or stratified alpha) rather than raw coefficient alpha; if IRT-calibrated, a bifactor/testlet model or polytomous testlet scoring is used.

**M6 — Difficulty comes from inference, not decoding.** The intended source of difficulty for every item is written down at authoring time (the "difficulty driver" field in the item records below). If the driver is vocabulary, syntax, memory or trickery, the item is rejected before it reaches pilot.

---

## 4. Secondary item type — decision and defence

### 4.1 Choice: critical-reasoning MCQ (Watson–Glaser-style), not verbal analogies

Two candidates were considered, per the brief.

**Verbal analogies (rejected).** Analogies are a classic Gf-inductive format, but on verbal content their difficulty is manipulated almost entirely through **word rarity** — which is Gc/vocabulary, exactly the contaminant §1.3 excludes. Easy-vocabulary analogies are trivially easy; hard ones are vocabulary tests. The format is also the most coachable in the verbal domain (finite relation taxonomies are published in every prep book), and it shows persistent DIF against ESL candidates because relation recognition depends on deep, native-like lexical semantics (connotation, register, collocation) that explicit instruction reaches late. For a commercial instrument sold into international executive search, that is disqualifying.

**Critical-reasoning MCQ (adopted).** Watson–Glaser-style tasks — assumption identification, inference-strength calibration, argument evaluation — extend the core construct upward rather than sideways: from "what does this text entail?" to "what does this argument depend on, and how much does this evidence prove?". This is the highest-value verbal skill at executive level, and it cannot be reached by T/F/CS (an unstated assumption is, by construction, something the passage does not say — the CS logic has nothing to grip). Difficulty is manipulated through **argument structure** (confounds, self-selection, necessary-vs-helpful assumptions), not through lexis, so the format can be written to the same FK band and word-frequency discipline as Part 1.

### 4.2 Gc/vocabulary contamination and ESL fairness in the chosen format

The Watson–Glaser tradition is not automatically clean — commercial forms have historically carried culturally loaded stimuli (politics, social policy) and mid-frequency abstract vocabulary. Our controls:

- All CR stimuli obey the same passage discipline as Part 1: §7 word-frequency and FK rules, neutral business/science topics, self-contained.
- Logical vocabulary in stems is standardised to a tiny fixed set, defined in the instructions with an example: *assumption* ("something not stated that must be true for the argument to work"), *conclusion*, *supports*, *weakens*. The same words are used identically in every item, so they are learned once, in the test, not brought from outside.
- Options are written in whole plain sentences, not compressed noun phrases ("Passengers will mostly follow the boarding order they are given", not "passenger compliance assumptions").
- ESL fairness is empirically checked, not assumed: DIF screening by English-as-additional-language status is a mandatory pilot analysis (§14), with a stricter flag threshold for Part 2 than Part 1 because the format is newer to most candidates.

Residual risk, stated honestly: any argument-analysis format retains more Gc variance than a figural test would. That is the price of measuring a verbal construct, and it is bounded by the controls above and monitored by DIF — not defined away.

---

## 5. Response format specifications

**Part 1 (T/F/CS).** Three response options, fixed order **True / False / Cannot Say** on every item (a fixed, meaningful order is correct for classification responses; key balance, not position rotation, is the anti-pattern control — see §12). Passage displayed above/beside the statement at all times; one statement on screen at a time; candidates may revisit statements within the current passage but not return to earlier passages (limits cross-passage answer-changing noise and simplifies mobile navigation).

**Part 2 (CR MCQ).** Four options, one key, single best answer. Key position balanced across the form (§12). No "all of the above"/"none of the above" ever.

**Scoring.** Number-right scoring, no penalty ("formula") scoring. Penalty scoring imports a risk-attitude construct with known group differences and is indefensible in selection; the guessing floor is managed by test length and item quality instead (§9). Omitted items score zero and candidates are told this, with the explicit instruction that an unsure answer is better than a blank — stated policy prevents differential guessing sophistication from becoming score variance.

---

## 6. Passage discipline (binding authoring rules)

### 6.1 Length and structure

- **80–120 words** per passage, hard limits. Below 80 words a passage cannot support three independent statements without every statement probing the same sentence; above 120 words, reading time (Gs/Grw variance) grows and mobile display degrades (§11).
- Four to six sentences; one topic; at most one hedged or attributed claim ("researchers cautioned…", "analysts note…") per passage — these attribution structures are the raw material of good CS and False items but more than one per passage makes the passage itself confusing.
- Simple past/present tense; active voice preferred; no sentence over ~30 words; no nested subordinate clauses beyond one level.

### 6.2 Reading level — target Flesch–Kincaid band and why

**Target: FK Grade 9–11 for every passage and every statement; hard ceiling FK 12.** (Equivalently, Flesch Reading Ease roughly 45–60.)

Why this band and not lower or higher:

- **Not higher**, even for an executive population, because decoding difficulty is construct-irrelevant (§1.3). Any candidate who can be selected for a graduate scheme can decode Grade-11 prose; pushing FK higher adds Gc/Grw variance and ESL DIF without adding a single unit of reasoning difficulty. Difficulty must come from the inferential structure (quantifier scope, attributed vs asserted claims, conditional vs actual, referent tracking), which FK does not measure and which we control separately via the difficulty-driver field.
- **Not lower**, because Grade 7–8 prose forces artificially short sentences that destroy the very structures (conditionals, attributions, comparatives) the items reason over, and reads as patronising to the population, harming candidate experience and face validity.
- Supplementary lexical rule, because FK is necessary but not sufficient (it counts syllables, not familiarity): **content words must sit within roughly the 5,000 most frequent English word families** (checked against a standard frequency list, e.g. COCA/BNC bands); proper nouns are invented, pronounceable, and culturally neutral (Meridian, Halden); technical terms only if defined by the passage itself or universally transparent ("sorting equipment", "recycling facility").

### 6.3 Topic and cultural-neutrality rules

- Topics: **neutral business operations and neutral natural science only.** Whitelist by example: logistics, manufacturing, generic retail, workplace studies, marine biology, materials, energy, agriculture. Blacklist: politics, religion, law, medicine and health outcomes, sport, food and drink customs, family structures, holidays, money amounts in any specific currency, named countries/regions/ethnicities, historical events, humour, and any topic on which candidates predictably hold prior beliefs strong enough to fight the "use only the passage" instruction (climate policy, diets, remote-work culture wars — a remote-work *measurement study* is acceptable only if the passage's claims are self-contained and deliberately undercut prior-belief shortcuts; when in doubt, exclude).
- **No prior knowledge may help.** Authoring check ("the counterfactual test"): could the passage's key facts be inverted and every item re-keyed accordingly without the passage becoming absurd? If real-world knowledge would then mislead candidates, the item set depends on the passage alone — which is the requirement. If inversion is impossible because the fact is common knowledge, the fact is doing no work and the item probing it is defective.
- Units metric, percentages in words ("40 per cent"), no currency symbols, no dates that anchor to real events, en-GB spelling.

---

## 7. Part 1 sample items — 4 passages, 14 statements

Documentation standard per item: stimulus (passage + statement), key, solution rationale (including the exact False/Cannot Say line where relevant), rationale for each non-keyed option (the "distractors" in a classification format), difficulty driver, predicted difficulty band, target response time. Difficulty bands: **Easy** p ≈ .75–.90 · **Moderate** p ≈ .55–.75 · **Hard** p ≈ .35–.55 (predictions only — pilot data govern).

Timing note used throughout: first statement of each passage carries the passage-reading cost (~60–75 s including reading); subsequent statements ~30–45 s.

---

### Passage A — Warehouse automation (business operations)

> Meridian Logistics operates three regional warehouses. Last year the company installed automated sorting equipment in its largest warehouse, which handles roughly half of Meridian's total parcel volume. After the installation, sorting errors at that site fell by 40 per cent, although operating costs there rose slightly because of new maintenance contracts. The two smaller warehouses continue to sort parcels by hand. Meridian's directors have stated that further automation will be considered only if the equipment's maintenance costs come down. Industry analysts note that automated sorting typically reduces errors most in warehouses that handle very large parcel volumes.

(≈97 words; FK ≈ Grade 10; five sentences; one attributed-claim structure — the analysts' generalisation.)

**Item A1**
- **Statement:** Sorting errors at the automated warehouse fell after the new equipment was installed.
- **Key: TRUE**
- **Solution rationale:** Direct entailment of sentence 3 with light paraphrase ("after the installation, sorting errors at that site fell").
- **Why not False:** Nothing in the passage entails the negation; the passage asserts the fact outright.
- **Why not Cannot Say:** The fact is explicitly stated; CS would require it to be absent or undetermined.
- **Difficulty driver:** None beyond locating the sentence — anchor/easy item to settle candidates and calibrate the response rules.
- **Predicted difficulty: Easy** (p ≈ .90). **Target response time:** 70 s (includes passage reading).

**Item A2**
- **Statement:** Meridian's operating costs across all three warehouses rose after the automation.
- **Key: CANNOT SAY**
- **Solution rationale:** The passage says costs rose *at that site* ("operating costs there"). It says nothing about costs at the two manual warehouses or about company-wide totals. Neither the statement nor its negation is entailed.
- **The False/CS line, exactly:** For the key to be False, the passage would have to entail that total costs did *not* rise — e.g. by stating that savings elsewhere outweighed the increase. It does not. A rise at one site is compatible with company totals rising, falling, or holding — hence CS, not False and not True.
- **Why not True:** "There" scopes the cost claim to one warehouse; extending it to the whole company is an unsupported generalisation — precisely the over-claim the construct penalises.
- **Why not False:** No contradicting information exists anywhere in the passage.
- **Difficulty driver:** Scope of the quantifier/locative "there"; part-to-whole overgeneralisation.
- **Predicted difficulty: Moderate** (p ≈ .60). **Target response time:** 40 s.

**Item A3**
- **Statement:** Meridian has decided to install automated sorting in its two smaller warehouses.
- **Key: FALSE**
- **Solution rationale:** The directors have stated that further automation *will be considered only if* maintenance costs come down. That entails no decision to automate has been taken — the matter has not even reached consideration; consideration itself is conditional on a future event. The statement asserts a completed decision; the passage entails its negation.
- **The False/CS line, exactly:** Contrast with the statement "Meridian will never automate its smaller warehouses" — that would be **Cannot Say** (the conditional leaves the future open in both directions). And "Meridian is considering automating its smaller warehouses" would also be **Cannot Say-leaning-False** and would be rejected at review as ambiguous (has the condition been met? undetermined) — it fails the M2 two-reviewer test and illustrates the boundary this item deliberately stays on the clean side of. A3 is clean because "has decided" (a completed past event) is directly incompatible with "will be considered only if…" (an explicitly not-yet-begun process).
- **Why not True:** No decision is reported; the only relevant sentence makes future consideration conditional.
- **Why not Cannot Say:** This is the intended pull. Candidates who read "further automation will be considered" as leaving the question open must notice that a *decision already made* is excluded by the directors' own framing. CS is wrong because the negation ("no such decision has been made") *is* entailed.
- **Difficulty driver:** Modal/temporal reasoning — distinguishing a conditional future consideration from a completed decision.
- **Predicted difficulty: Moderate–Hard** (p ≈ .55). **Target response time:** 45 s.

**Item A4**
- **Statement:** The equipment reduced errors at Meridian's largest warehouse because that warehouse handles a very large parcel volume.
- **Key: CANNOT SAY**
- **Solution rationale:** Both component facts are in the passage (errors fell; the warehouse handles roughly half of total volume). The *causal mechanism*, however, is supported only by the analysts' generalisation about what "typically" happens across the industry. A typical pattern neither entails nor contradicts the mechanism in this particular case; the passage never asserts why errors fell at this site.
- **The False/CS line, exactly:** False would require the passage to entail that volume was *not* the reason (e.g. "engineers attributed the improvement entirely to the new software"). Nothing rules the mechanism out — it is merely unestablished. Unestablished ≠ contradicted → CS.
- **Why not True:** "Typically" is a hedged population-level claim attributed to third parties; importing it as a case-level causal fact is the reported-vs-established error the construct targets. The pull toward True is strong precisely because everything in the statement *sounds* consistent with the passage.
- **Why not False:** As above — no contradicting content.
- **Difficulty driver:** Attributed hedged generalisation vs case-level causal assertion; assembling two true fragments into an unsupported link.
- **Predicted difficulty: Hard** (p ≈ .40). **Target response time:** 45 s.

**Passage A key pattern:** T, CS, F, CS.

---

### Passage B — Sponges and water clarity (natural science)

> Sea sponges feed by drawing water through their bodies and filtering out microscopic particles. A single sponge can filter thousands of litres of water in a day. Researchers studying one coastal bay found that areas with dense sponge populations had clearer water than areas without sponges. The researchers cautioned, however, that water clarity in the bay is also affected by currents and by seasonal algae growth, and that their study did not measure either factor. Sponges obtain most of their energy from the bacteria they filter out of the water, rather than from larger organisms.

(≈97 words; FK ≈ Grade 10–11; five sentences; one hedged-researcher structure.)

**Item B1**
- **Statement:** In the bay that was studied, areas without sponges had less clear water than areas with dense sponge populations.
- **Key: TRUE**
- **Solution rationale:** Valid converse of sentence 3: "A clearer than B" entails "B less clear than A". Licensed logical transformation, not new information — exactly the kind of entailment M1 defines as True.
- **Why not False:** The negation would contradict sentence 3 directly.
- **Why not Cannot Say:** The pull is that the sentence *looks* rephrased and reversed, and cautious candidates treat any transformation as "not stated". The M1 rule is explicit that entailed converses are True; the practice example in the instructions covers this case so the first scored exposure is fair.
- **Difficulty driver:** Recognising a comparative converse as entailment.
- **Predicted difficulty: Moderate** (p ≈ .70). **Target response time:** 70 s (includes passage reading).

**Item B2**
- **Statement:** The researchers proved that sponges caused the clearer water in the parts of the bay where they are dense.
- **Key: FALSE**
- **Solution rationale:** The passage reports a found association *and* reports the researchers' own caution that two other clarity-affecting factors were not measured. On the passage's own terms, the study leaves rival explanations open; a study that leaves acknowledged rival explanations unmeasured has not *proved* the causal claim. The negation ("they did not prove it") is entailed by the caution sentence.
- **The False/CS line, exactly:** Contrast with "Sponges caused the clearer water in the bay" — that is **Cannot Say** (the causal claim itself is neither established nor contradicted; the sponges may well be the cause). The scored statement is about what the researchers *proved*, and the passage speaks to that directly: unmeasured acknowledged confounders entail absence of proof. This pairing — causal claim CS, proof claim False — is the single most instructive contrast in the form and is preserved verbatim in reviewer training materials.
- **Why not True:** "Found that areas … had clearer water" is an association; treating it as proof of causation is the exact error the construct penalises.
- **Why not Cannot Say:** The caution sentence gives positive passage-internal grounds that proof is absent — this is not silence, it is contradiction of "proved".
- **Difficulty driver:** Association vs causation vs *proof of* causation; three-way distinction.
- **Predicted difficulty: Hard** (p ≈ .45). **Target response time:** 45 s.

**Item B3**
- **Statement:** Seasonal algae growth affects water clarity in the bay more strongly than currents do.
- **Key: CANNOT SAY**
- **Solution rationale:** Both factors are named as affecting clarity; no ordering, weighting or comparison between them appears anywhere. Neither the statement nor its negation is entailed.
- **The False/CS line, exactly:** False would require an entailed reverse ordering ("currents affect clarity more than algae") or an entailed equality. The passage lists the factors conjunctively with no comparative structure at all — silence on the comparison, hence CS.
- **Why not True:** No comparative information exists; choosing True typically reflects importing outside beliefs about algae, which the "use only the passage" instruction excludes.
- **Why not False:** Symmetric — no comparative information in either direction.
- **Difficulty driver:** Detecting the absence of comparative structure between two co-mentioned factors.
- **Predicted difficulty: Easy–Moderate** (p ≈ .75). **Target response time:** 35 s.

**Passage B key pattern:** T, F, CS.

---

### Passage C — Four-day week trial (business/workplace study)

> A consultancy studied 200 firms that agreed to trial a four-day working week for six months. Fifteen firms withdrew before the end of the trial, most of them citing scheduling difficulties with clients. Of the firms that completed the trial, 60 per cent reported unchanged or improved output, and most of these firms chose to keep the four-day arrangement afterwards. The consultancy noted that the participating firms had volunteered for the trial and were mostly small service businesses, so the findings may not hold for other kinds of organisation. Data on staff turnover were collected during the trial but have not yet been released.

(≈105 words; FK ≈ Grade 11; five sentences; volunteer-sample caveat is deliberate CR-adjacent material.)

**Item C1**
- **Statement:** Every firm that began the trial completed it.
- **Key: FALSE**
- **Solution rationale:** Sentence 2 states fifteen firms withdrew before the end. The negation of the universal ("not every firm completed") is directly entailed.
- **Why not True:** Contradicted explicitly.
- **Why not Cannot Say:** The withdrawal fact is stated, not absent. Note the anti-test-wiseness point: this keyed-False statement contains the absolute "every" — but so does a keyed-True statement elsewhere in the operational pool, so "absolute word → False" is not a winning heuristic (§12).
- **Difficulty driver:** Simple universal vs stated exception; anchor item for the passage.
- **Predicted difficulty: Easy** (p ≈ .88). **Target response time:** 75 s (includes passage reading).

**Item C2**
- **Statement:** Staff turnover fell at the firms that completed the trial.
- **Key: CANNOT SAY**
- **Solution rationale:** Turnover data exist but are unreleased; their direction is undetermined by the passage. Neither the statement nor its negation is entailed.
- **The False/CS line, exactly:** False would require the passage to entail that turnover did not fall (rose or held). "Collected but not yet released" entails nothing about direction. Note what this item is *not*: it is not a trap about the word "released" (the statement asks about the underlying fact, not about publication) — a statement like "The turnover results have been published" would be a legitimate but much weaker item (False, trivial); this one probes whether candidates confuse *the existence of data* with *knowledge of what the data show*.
- **Why not True:** Direction unreported; True-choosers typically reason "they'd have released bad news / four-day weeks obviously cut turnover" — outside knowledge and speculation.
- **Why not False:** Symmetric absence of directional information.
- **Difficulty driver:** Existence-of-evidence vs content-of-evidence distinction.
- **Predicted difficulty: Moderate** (p ≈ .70). **Target response time:** 35 s.

**Item C3**
- **Statement:** The consultancy claimed that its findings apply to all kinds of organisation.
- **Key: FALSE**
- **Solution rationale:** The passage reports the consultancy itself noting the findings "may not hold for other kinds of organisation". A party that expressly flags non-generalisability has not claimed universal applicability; the negation of the statement is entailed by the consultancy's own reported caveat.
- **The False/CS line, exactly:** Contrast with "The findings do not apply to large manufacturers" — that is **Cannot Say** ("may not hold" is a hedge, not an assertion that they fail to hold). The scored statement is about what the consultancy *claimed*, and the passage reports the claim's content directly, including the caveat that contradicts universality.
- **Why not True:** Directly at odds with the reported caveat.
- **Why not Cannot Say:** The pull: candidates reason "the passage never says what the consultancy claimed overall". But the caveat *is* reported speech of the consultancy, and it is incompatible with a claim of universal applicability.
- **Difficulty driver:** Reported-speech tracking; hedge vs assertion; whose claim is whose.
- **Predicted difficulty: Moderate–Hard** (p ≈ .55). **Target response time:** 45 s.

**Item C4**
- **Statement:** Most of the firms that reported unchanged or improved output kept the four-day week after the trial.
- **Key: TRUE**
- **Solution rationale:** Sentence 3: "most of these firms chose to keep the arrangement", where "these" refers to the 60 per cent reporting unchanged or improved output. The statement is a resolved-referent restatement.
- **Why not False:** No contradiction anywhere.
- **Why not Cannot Say:** The pull is referent confusion — "most of these" could be misattached to "firms that completed the trial" or "the 200 firms", in which case the statement would look unstated. Correct anaphora resolution makes it a direct restatement. Reviewers confirmed (M2) that the referent is grammatically unambiguous — the difficulty is care, not genuine ambiguity, which is the permitted side of the no-trick line M3 draws.
- **Difficulty driver:** Anaphora/referent tracking across a quantified chain (200 → completers → 60% → most).
- **Predicted difficulty: Moderate** (p ≈ .65). **Target response time:** 40 s.

**Passage C key pattern:** F, CS, F, T.

---

### Passage D — Battery recycling (science/industry)

> Lithium batteries contain metals that can be recovered and used again. A recycling facility in the Halden region recovers about 90 per cent of the cobalt from the batteries it processes, but a smaller share of the lithium, which is harder to separate from the other materials. The facility currently accepts only batteries from consumer electronics. Vehicle batteries, which are larger, need handling equipment the facility does not have. Regional regulators are reviewing a proposal that would require battery producers to pay towards recycling. The facility's manager has said that processing vehicle batteries would become commercially attractive if such payments were introduced.

(≈103 words; FK ≈ Grade 10–11; six sentences; conditional-future structure in the final sentence is deliberate.)

**Item D1**
- **Statement:** The facility recovers a higher proportion of the cobalt in the batteries it processes than of the lithium.
- **Key: TRUE**
- **Solution rationale:** Sentence 2 states 90 per cent cobalt recovery "but a smaller share of the lithium" — the comparative is asserted directly; the statement restates it.
- **Why not False:** Would contradict the explicit comparative.
- **Why not Cannot Say:** The comparison is stated, not inferred; no gap exists. (Note: no arithmetic is required — the item never asks *how much* smaller; §1.3 numerical boundary respected.)
- **Difficulty driver:** Parsing a "X but a smaller share of Y" comparative; anchor item.
- **Predicted difficulty: Easy** (p ≈ .85). **Target response time:** 75 s (includes passage reading).

**Item D2**
- **Statement:** The facility currently processes batteries from vehicles.
- **Key: FALSE**
- **Solution rationale:** "Currently accepts only batteries from consumer electronics" plus "vehicle batteries … need handling equipment the facility does not have" jointly entail the negation twice over — by the exclusivity of "only" and by the stated equipment gap.
- **Why not True:** Doubly contradicted, as above.
- **Why not Cannot Say:** "Only" is doing legitimate, visible work here (M3: the restrictive word is the reasoning target and is reinforced by an independent second sentence, so the key never hangs on one easily missed token).
- **Difficulty driver:** Restriction ("only") plus corroborating fact; easy contradiction detection.
- **Predicted difficulty: Easy** (p ≈ .85). **Target response time:** 30 s.

**Item D3**
- **Statement:** If producers are required to pay towards recycling, the facility will start processing vehicle batteries.
- **Key: CANNOT SAY**
- **Solution rationale:** The manager said processing vehicle batteries *would become commercially attractive* under that condition. Attractiveness is not a commitment, a plan, or a prediction of action; and the facility would still lack the handling equipment, whose acquisition is nowhere discussed. The conditional statement is neither entailed (no commitment reported) nor contradicted (nothing rules out that the facility would proceed).
- **The False/CS line, exactly:** False would require the passage to entail that the facility would *not* start (e.g. "the manager ruled out vehicle-battery processing regardless of funding"). Nothing does. The gap between "would be attractive" and "will happen" is undetermined territory — the definitional home of Cannot Say. Contrast the neighbouring True: "The facility's manager believes producer payments would make vehicle-battery processing commercially attractive" restates the reported speech and would be keyed True.
- **Why not True:** Converts a reported attractiveness judgement into a predicted action — over-claiming from testimony, the executive failure mode this passage was built to probe.
- **Why not False:** No exclusionary content.
- **Difficulty driver:** Conditional reported evaluation vs conditional predicted action; regulatory proposal still under review adds a second layer of unrealised condition.
- **Predicted difficulty: Hard** (p ≈ .45). **Target response time:** 45 s.

**Passage D key pattern:** T, F, CS.

---

### Part 1 sample-set summary

| Item | Key | Predicted band | Difficulty driver |
|---|---|---|---|
| A1 | True | Easy | Locate and match |
| A2 | Cannot Say | Moderate | Scope ("there") — part vs whole |
| A3 | False | Moderate–Hard | Conditional consideration vs completed decision |
| A4 | Cannot Say | Hard | Attributed generalisation vs case-level cause |
| B1 | True | Moderate | Comparative converse as entailment |
| B2 | False | Hard | Association / causation / proof three-way |
| B3 | Cannot Say | Easy–Moderate | Absent comparison between co-mentioned factors |
| C1 | False | Easy | Universal vs stated exception |
| C2 | Cannot Say | Moderate | Data exist vs data direction known |
| C3 | False | Moderate–Hard | Reported hedge contradicts claimed universality |
| C4 | True | Moderate | Referent tracking |
| D1 | True | Easy | Stated comparative |
| D2 | False | Easy | "Only" + corroborating fact |
| D3 | Cannot Say | Hard | Attractiveness ≠ commitment; nested conditionals |

**Key balance of the sample set: 4 True / 5 False / 5 Cannot Say** — within the ±1 tolerance around 14 ÷ 3 ≈ 4.67 required by M4. No passage keys all statements identically; each key appears in at least three different serial positions. Operational 24-item forms are assembled at exactly 8/8/8. Difficulty spread: 4 Easy, 6 Moderate, 4 Hard — matching a selection-oriented information target centred slightly above the population mean.

---

## 8. Part 2 sample items — critical-reasoning MCQ (5 items)

Standing instructions shown to candidates (fixed wording, with one worked example per subtype): *"An **assumption** is something the argument does not state but needs to be true in order to work. Base every answer only on the passage given."* Four options per item; single best answer; key positions across the five samples: B, C, A, B, D (balanced within rotation rules, §12).

---

**Item CR1 — Assumption identification**

> A regional airline announces: "From next month we will cut total boarding time by asking passengers to board in order of seat row, starting from the back of the aircraft."
>
> Which of the following is an assumption the plan depends on?
>
> A. Boarding time is the airline's largest cause of delayed departures.
> B. Passengers will mostly follow the boarding order they are given.
> C. Other airlines have already introduced boarding by seat row.
> D. Passengers would rather board in seat-row order than in a single group.

- **Key: B.** If passengers largely ignore the called order, the mechanism by which the plan cuts boarding time never operates. Negate B and the argument collapses — the negation test that defines a necessary assumption.
- **Distractor A:** Confuses *worth doing* with *works*. The plan can cut boarding time even if boarding is a minor cause of delays; A is relevant to whether the plan matters, not to whether it functions. Predicted most-popular distractor.
- **Distractor C:** Precedent elsewhere is neither necessary nor sufficient; the plan's logic is internal. Tests the "others do it" plausibility pull.
- **Distractor D:** Preference is not compliance; passengers may comply while disliking it. Near-miss to the key designed to separate candidates who apply the negation test from those matching on topic ("passengers … boarding order").
- **Difficulty driver:** Necessary-assumption negation test vs relevance and preference confusions.
- **Predicted difficulty: Moderate** (p ≈ .60). **Target response time:** 75 s.

---

**Item CR2 — Assumption identification**

> A town council argues: "Replacing all our streetlights with LED units will reduce the town's spending on streetlight electricity, because LED units use less electricity per hour of operation."
>
> Which of the following is an assumption the argument depends on?
>
> A. LED units cost less to purchase than the current lamps did.
> B. Residents of the town support the replacement programme.
> C. Total hours of streetlight operation will not rise by enough to cancel out the saving per hour.
> D. LED units need replacing less often than the current lamps.

- **Key: C.** The stated premise is per-hour efficiency; the conclusion is about total electricity spending. The bridge between rate and total is usage volume: if operating hours rose sufficiently, per-hour savings could be swamped. Negating C breaks the inference from premise to conclusion.
- **Distractor A:** Purchase cost is outside the conclusion, which is scoped to *electricity* spending. Tests scope discipline — the verbal-reasoning skill of reading exactly what was concluded.
- **Distractor B:** Popular support affects feasibility, not the electrical arithmetic of the argument. Classic relevance lure.
- **Distractor D:** Replacement frequency, like A, sits outside electricity spend; attractive because it is a true-sounding real-world merit of LEDs — a prior-knowledge lure the "use only the passage" discipline must override.
- **Difficulty driver:** Rate-vs-total gap; conclusion-scope tracking.
- **Predicted difficulty: Moderate–Hard** (p ≈ .50). **Target response time:** 80 s.

---

**Item CR3 — Inference strength (causal calibration)**

> A subscription business examined its records for the past year. Customers who had switched on automatic renewal cancelled their subscriptions at half the rate of customers who had not switched it on. Customers chose for themselves whether to switch on automatic renewal.
>
> Conclusion proposed: "Switching on automatic renewal causes customers to stay subscribed for longer."
>
> How well does the evidence support this conclusion?
>
> A. The conclusion follows: the cancellation rates differ substantially between the two groups.
> B. The evidence is consistent with the conclusion, but customers chose their own group, so more committed customers may simply be likelier both to switch on renewal and to stay.
> C. The evidence contradicts the conclusion, because some automatic-renewal customers still cancelled.
> D. The evidence is irrelevant to the conclusion, because it concerns only one business.

- **Key: B.** Self-selection is stated in the stimulus itself; the association is real but the causal reading is confounded by commitment (or any third factor driving both choices). B is the calibrated verdict: consistent, not established.
- **Distractor A:** Effect size ≠ causal identification; the size of an observational difference does nothing to remove confounding. Catches candidates who treat "big difference" as proof.
- **Distractor C:** Misreads exceptions as contradiction — a causal claim is not falsified by imperfect prevention. Tests deterministic-vs-probabilistic reading.
- **Distractor D:** Over-corrects: limited generalisability is not irrelevance, and the conclusion is about this business's customers anyway. Catches indiscriminate scepticism — the mirror image of the A error, and deliberately included so that "always pick the most sceptical option" is not a winning meta-strategy.
- **Difficulty driver:** Self-selection confound recognition; calibration between credulity (A) and blanket scepticism (D).
- **Predicted difficulty: Moderate** (p ≈ .60). **Target response time:** 80 s.

---

**Item CR4 — Inference strength (best-supported conclusion)**

> A furniture factory introduced a daily equipment check at the start of March. The factory's defect rate in March was lower than its defect rate in February.
>
> Which conclusion is best supported by this information?
>
> A. The daily checks caused the fall in the defect rate.
> B. The defect rate was lower in the month after the checks began than in the month before.
> C. The defect rate will continue to fall while the checks remain in place.
> D. Before March, the factory did not check its equipment at all.

- **Key: B.** A pure restatement of the evidence — the only option the two sentences entail. The item's point is that the *strongest supported* conclusion is often the most modest one.
- **Distractor A:** Post hoc causal leap from a two-month before/after with no controls (seasonality, materials, staffing all uncontrolled). The designed pull; predicted most-popular wrong answer.
- **Distractor C:** Extrapolation beyond the observed period — prediction from a single difference.
- **Distractor D:** Confuses "introduced a *daily* check" with "previously no checks"; the factory may have checked weekly. Scope-of-claim reading.
- **Difficulty driver:** Choosing entailment over an attractive causal narrative; the "modest option is correct" structure must be used sparingly per form (≤2 items) or it becomes a learnable pattern — noted in assembly rules.
- **Predicted difficulty: Moderate** (p ≈ .65). **Target response time:** 70 s.

---

**Item CR5 — Argument evaluation (weakening)**

> A firm argues: "We should recruit more of our staff straight from university, because the graduates we hired over the past five years were promoted more quickly, on average, than the people we hired from other companies."
>
> Which of the following, if true, most weakens the argument?
>
> A. Some staff hired from other companies were also promoted quickly.
> B. The firm's promotion decisions must be approved by two managers.
> C. Managers were encouraged during those five years to fast-track graduate hires into a leadership programme.
> D. The number of graduates hired over the past five years varied from year to year.
>
- **Key: C.** Supplies an alternative explanation for the promotion gap — a policy that fast-tracked graduates regardless of performance — severing the link from "promoted faster" to "better hires", which the recommendation needs.
- **Distractor A:** Exceptions do not weaken a comparison of averages; the stimulus already concedes variation by saying "on average". Tests statistical-claim reading.
- **Distractor B:** Process detail, orthogonal to the between-group difference — pure relevance filter.
- **Distractor D:** Sounds methodological ("varying n!") but variation in hiring numbers does not by itself explain or remove the average promotion gap; a near-miss for candidates pattern-matching on "sounds like a statistics objection" without a mechanism. This is the discriminating distractor at the top of the ability range.
- **Difficulty driver:** Alternative-cause identification vs exception-, process- and pseudo-methodological lures.
- **Predicted difficulty: Hard** (p ≈ .45). **Target response time:** 85 s.

---

**Part 2 sample-set summary:** 2 assumption, 2 inference-strength, 1 weakening; keys B, C, A, B, D; predicted bands 3 Moderate, 1 Moderate–Hard, 1 Hard (argument analysis sits deliberately above Part 1's average difficulty — it carries the top of the score scale). Every option in every item is a full sentence of comparable length to its key (§12), and every stimulus passes the §7 lexical and topic rules.

---

## 9. Key balance and guessing analysis (3-option format)

### 9.1 The arithmetic

With three options, blind guessing scores **33.3%** in expectation. On the operational 24-item Part 1, a pure guesser expects 8 correct with a standard deviation of √(24 × ⅓ × ⅔) ≈ 2.3 — so roughly one guesser in forty exceeds 12/24 by chance alone. Three consequences follow.

**(a) The usable score range is compressed.** True measurement happens between the 33% floor and 100%; a 3-option test discards a third of the raw scale, versus a quarter (4-option) or a fifth (5-option). Near and below the floor, scores carry almost no information: the test cannot distinguish "reasoned badly" from "guessed".

**(b) Item discrimination is capped.** Guessing adds binomial noise to every item response, attenuating item–total correlations, and under a 3PL-style lens the lower asymptote c ≈ .33 flattens the item response function precisely where low-to-middle-ability candidates sit. Items keyed Cannot Say suffer additionally at pilot if candidates use CS as a dumping ground for uncertainty (W4) — expect their initial statistics to look better than they are; testlet-aware analysis and the balanced-key design (M4) are the countermeasures.

**(c) Reliability per item is lower than in 4–5-option formats, so length must compensate.** The standard result (Lord's analysis of options-vs-length trade-offs) is that for a fixed testing time, fewer options with more items is often *at parity or better* — but only when the extra options being dropped were non-functioning. That justification does not apply here, because in T/F/CS the three options are not interchangeable distractors; they are the construct's own categories (§3.1). We therefore accept the 3-option guessing cost as a construct-fidelity cost, and pay for it with **length**: 24 statements at ~40 s each is affordable precisely because the paradigm's response time per item is short. As a design planning figure (illustrative, not a claim about this instrument): if a 4-option format of similar item quality reached a target internal consistency at ~19 items, the Spearman–Brown-style compensation for the higher guessing floor and lower per-item information puts the 3-option requirement in the mid-20s — hence 24 statements as the pilot form target, with the pilot itself (not this arithmetic) determining the final length.

### 9.2 Design responses

1. **Length and mix.** 24 T/F/CS statements + 8 four-option CR items. The CR section's 25% floor and higher per-item information stiffen the composite; the whole-test expected chance score is (24 × ⅓ + 8 × ¼) / 32 = **31%**, and the composite SEM around any plausible cut is dominated by the region the test is information-targeted at (slightly above the population mean, per the difficulty distribution in §7/§8).
2. **Number-right scoring, no correction for guessing** (§5) — penalty formulas trade guessing noise for risk-attitude bias and differential instruction-following; with explicit "answer everything" instructions, omission variance is minimised instead.
3. **Key balance as an anti-strategy device.** At 8/8/8, every blind strategy — always-True, always-CS, alternate — earns exactly chance. If keys drifted (say 6/8/10), a candidate who noticed the drift (or was coached on the publisher's habits) could beat chance with zero reasoning. Balance also protects the CS category from base-rate corruption: if CS were over-keyed, the test would reward dispositional caution; under-keyed, it would reward never suspending judgement — either way scoring a personality style, not reasoning (W4).
4. **Floor management in reporting.** Scores in the region statistically indistinguishable from chance (Part 1 raw ≤ 11/24 at the 95th percentile of the guessing distribution) are flagged in the recruiter report as "at or near chance level — interpret as *no evidence of the ability*, not evidence of its absence", with retest guidance. This is a reporting rule, not a scoring adjustment.
5. **Why not simply use 4–5 options in Part 1?** Adding options to T/F/CS means inventing pseudo-categories ("Probably True/Probably False", the classic Watson–Glaser inference scale). That five-way scale has a long record of key disputes precisely because "probably" has no strict operationalisation — it reintroduces W1 at scale. We keep the clean three-category logic in Part 1 and obtain the lower guessing floor where it is cheap and legitimate: in Part 2's genuine 4-option MCQs.

---

## 10. Time-pressure policy

**Policy: power-with-limit, not speeded.** The limit exists for operational and security reasons (session scheduling, item exposure, resistance to unhurried external assistance), not as a difficulty mechanism.

- **Calibration target:** ≥ 90% of the pilot norm group completes each part within the limit without hurrying (operationally: ≥ 90% completion **and** no more than trivial score gain in an untimed pilot arm; final limits are set from pilot timing distributions at approximately the 95th-percentile natural working time, then rounded up).
- **Planned limits (to be confirmed at pilot):** Part 1 — 24 statements, **16 minutes** (~40 s per statement including passage reading amortised at ~70 s for each passage's first item). Part 2 — 8 items, **10 minutes** (~75 s each). Instructions, worked examples and a 3-item unscored practice set are untimed.
- **Why not speeded:** speed under time pressure is Gs, excluded by §1.3; speededness interacts with ESL status, age, and several disabilities, manufacturing DIF; and a speeded test cannot honour the "read carefully, conclude only what follows" instruction without self-contradiction — we would be telling candidates to be careful while scoring them for hurrying.
- **Accommodations:** extended-time versions (+25%, +50%) are configuration flags, defensible only because the base test is a power test — under a speeded design, extended time would change the construct measured, not merely the access to it. Per-item response latencies are logged for research and aberrance screening, never scored.

---

## 11. Construct-irrelevant variance controls: device, display and accessibility

**Mobile-first display rules (items must work on a phone screen).**
- One statement (or one CR item) per screen. The passage is always available: on ≥ 768 px viewports, side-by-side with the statement; on phones, the passage sits above the statement in a collapsible panel that is **open by default** and re-openable with one tap — candidates must never answer from memory of a collapsed passage, and the 80–120-word cap (§6.1) is what makes a phone-height passage panel feasible without internal scrolling on mainstream devices at default font size.
- No horizontal scrolling anywhere; text reflows; minimum touch targets 44 × 44 px; response options are full-width buttons in fixed vertical order (True / False / Cannot Say), with a separate confirm action so a mis-tap is not a committed answer.
- No images, tables, or figures in this instrument at all — the verbal construct needs none, and excluding them removes an entire class of rendering, bandwidth and accessibility risks. No item may depend on text styling (bold/italics) to carry meaning.
- Device type is recorded; desktop-vs-mobile score comparability is a mandatory pilot analysis (§14) before mobile completion is allowed in high-stakes use.

**Accessibility.**
- **Screen readers:** text-only stimuli make this instrument genuinely and fully screen-reader compatible — passages, statements and options are plain marked-up text with a defined reading order (passage → statement → options) and proper landmarks. This is a real advantage over figural and numerical instruments, and one of the reasons a verbal test should anchor an accessible battery. The one place screen-reader use has a genuine residual effect: listening is serial while sighted re-reading is random-access, so locating "the sentence about costs" takes longer by ear. That is an access-speed effect, not a reasoning effect — handled by extended-time accommodation (legitimate under the power-test policy, §10), not by item changes.
- **Colour:** no information is ever carried by colour alone (there are no figural elements, and UI states — selected option, flagged item — are conveyed by shape/weight/label as well as colour). Contrast meets WCAG 2.1 AA minimums; the colour-blind-safe figural rule from the house standards is honoured trivially and stated here for completeness: this test contains no figural items, so the requirement has no further application.
- **Dyslexia and low vision:** user-adjustable font size without layout breakage (test the 200% zoom case); a dyslexia-friendly typeface option; the reading-level ceiling (§6.2) is itself the largest single accessibility control in the design.
- The instrument measures reasoning *through* reading; for candidates whose documented disability affects decoding rather than reasoning, extended time is the appropriate accommodation, and the report notes when non-standard administration was used, per prevailing test-use guidelines.

---

## 12. Anti-test-wiseness controls

1. **Balanced statement and option properties.** In Part 1, keyed-True, keyed-False and keyed-CS statements are matched in length distribution and syntactic complexity across each form (audited at assembly: mean length per key category within ±10%). In Part 2, all four options are full sentences of comparable length; the key is never systematically the longest, most qualified option — the classic giveaway.
2. **Absolutes and hedges appear on both sides of the key.** "Every/only/never" must appear in keyed-True statements (e.g. a passage that itself asserts a universal) as often as in keyed-False ones across the pool, and hedges ("may", "some") must not signal CS. The heuristics "absolute → False" and "hedge → True/CS" must earn exactly chance. Audited per form.
3. **No "all of the above" / "none of the above"** in Part 2, ever (house rule; both formats leak information and break single-best-answer logic).
4. **Key position balance.** Part 2 keys are distributed near-uniformly across A–D within each form, with no runs longer than two and no learnable sequence. Part 1's fixed option order is not a leak because the balance control operates on the *keys* (8/8/8), which is the only exploitable dimension in a classification format.
5. **No giveaway convergence patterns.** Distractors never pair off in ways that isolate the key (e.g. two options that are mutually exclusive paraphrases flagging the third as the answer); reviewers check each Part 2 item for "option-elimination-without-reading-the-stimulus" solvability — an item a reviewer can key without the stimulus is rejected.
6. **Structure frequency caps.** Recurring deep structures (the "modest conclusion is correct" design of CR4; the "proof vs cause" contrast of B2) are capped at two instances per form so they cannot be learned *within* a sitting, and alternate forms vary which structures appear where — a coaching-resistance measure as much as a test-wiseness one.
7. **Cross-form exposure control.** Passages and stimuli are banked with exposure counts and retired on schedule; item statistics are monitored for drift that signals leakage (sudden p-value inflation on stable items).

---

## 13. Scoring, reporting and assembly notes

- Raw number-right per part; composite standardised against the relevant norm group (graduate vs experienced-professional norms to be established at calibration — §14). Subscores (T/F/CS accuracy by key category; CR subtype) are internal diagnostics for item analysis and are **not** reported to clients at launch: category-level subscores from ≤ 8 items apiece are too unreliable to survive client over-interpretation.
- Recruiter-facing reports state the score band with its confidence interval, the chance-level flag rule (§9.2.4), and standard cognitive-test interpretation guardrails. Candidate-facing feedback is plain-language and developmental in tone.
- Form assembly checklist (each operational form): 8 passages × 3 statements; keys 8/8/8; per-passage keys non-uniform; difficulty distribution ≈ 25% Easy / 45% Moderate / 30% Hard by predicted band pre-pilot, by calibrated b-parameters post-pilot; §12 audits passed; topic spread ≥ 4 business / ≥ 3 science with no topic family repeated in adjacent passages.

---

## 14. Empirical validation requirements (mandatory)

**These are draft blueprints. Nothing in this document is evidence that the instrument works.** The item keys, difficulty predictions, timing figures and reliability arguments above are design hypotheses. The instrument must not be used to inform any selection decision, and must not be described to clients or candidates as validated, standardised or normed, until the following programme is complete and documented.

**Stage 1 — Expert and sensitivity review (pre-pilot).**
Independent review of every item by (a) a second psychometrician applying the M2 two-question key test blind to intended keys — any key disagreement is a stop-fault for that item; (b) a fairness/sensitivity reviewer against §6.3; (c) an ESL reader and a screen-reader user completing the full test with think-aloud. Readability and word-frequency audits re-run on final text.

**Stage 2 — Pilot calibration.**
- Sample: **n ≥ 400 per form** for classical statistics and stable 2PL-type IRT calibration (n ≥ 1,000 if a lower-asymptote/3PL-style model is to be estimated, which the 33% guessing floor makes advisable for Part 1); recruited to mirror the operational population in education level, age, sex, ethnicity and first-language status, with quota targets sufficient for the DIF analyses below (minimum ~150 per focal group per analysis).
- Analyses: item p-values and discrimination; option/category functioning (are False and CS both drawing endorsements at the intended ability levels?); **testlet-aware reliability** (stratified alpha or bifactor omega — raw alpha will overstate precision, per M5); timing distributions against the §10 completion criterion, including an untimed comparison arm; response-latency screens for items answerable too fast (giveaway) or too slow (overload); mobile-vs-desktop score and timing comparability.
- Item survival rules pre-registered: e.g. drop or rewrite items with discrimination below floor, p outside .25–.95, key-category confusion patterns indicating W1 (CS items where high scorers systematically choose False, or vice versa), or DIF flags below.

**Stage 3 — DIF screening.**
Mantel–Haenszel and IRT-based DIF by sex, age band, ethnicity (as legally collectable per jurisdiction) and **English-as-additional-language status** — the last is the critical screen for a verbal instrument and applies with a stricter action threshold to Part 2 (§4.2). Items with moderate-or-worse DIF are removed or rewritten and re-piloted; the DIF file is retained as part of the technical record.

**Stage 4 — Norming.**
Norm groups assembled per intended reporting population (graduate intake; experienced professional/executive), **n ≥ 500 per norm group** as a floor for stable percentile tables in the operating range, refreshed on a stated cycle and documented with sampling method and dates.

**Stage 5 — Criterion and construct validation.**
- Convergent/discriminant: correlations with an established verbal reasoning measure and a non-verbal (e.g. inductive/figural) measure in a subsample (**n ≥ 200**) — verbal-with-verbal expected to exceed verbal-with-figural; a reading-speed or vocabulary marker included to verify the §1.3 boundary claims empirically rather than rhetorically.
- Criterion: predictive or concurrent studies against training performance, work-sample or performance criteria in client populations (**n ≥ 100 per study** as an interpretability floor, with meta-analytic accumulation across clients planned from the outset); range-restriction and criterion-reliability artefacts documented.
- Reliability: alternate-form and/or test–retest (interval 2–8 weeks, **n ≥ 150**) in addition to internal consistency, because internal-consistency estimates on testlet structures are the weakest link (M5).

**Stage 6 — Ongoing obligations.**
Exposure monitoring and item drift review each cycle; norm refresh; adverse-impact monitoring in live selection data; accommodation-condition comparability review; annual technical-report update. Any change to timing, item count, or delivery mode after calibration triggers re-equating.

Until Stages 1–5 are complete for a given form, that form is a research instrument. This paragraph, or its equivalent, must appear in any internal or client-facing description of the assessment.

---

*End of design blueprint.*
