# Quality Review and Validation Framework

Read this document after generating any item pool (trait, competency, or SJT). Use the frameworks below to conduct a structured quality review and produce the final item set.

For trait items, also apply the trait-specific quality checks from trait-items.md (Section 7).
For competency items, also apply the competency-specific quality checks from competency-items.md (Section 8).
For SJT items, also apply the SJT-specific quality checks from sjt-items.md (Section 10).

## Table of Contents
1. Structured quality review process
2. Item revision guidelines
3. Final item set assembly
4. Mandatory validation disclaimer
5. Scale-level quality indicators
6. When to recommend restructuring
7. Multi-construct assessment considerations

---

## 1. Structured Quality Review Process

Review in this order. Do not skip any stage.

### Stage 1: Individual Item Review

Evaluate every item against these checks. Flag any item that fails one or more.

| Check | Question | Action if failed |
|---|---|---|
| **Construct focus** | Does this item measure the intended construct? | Identify contamination; rewrite or cut |
| **Single idea** | Is this double-barrelled? | Split or choose the more important facet |
| **No extreme language** | Uses always/never/constantly/perfectly? | Replace with frequency language |
| **Non-obvious desirability** | Could a low-capability person easily identify the "right" answer? | Add specificity, complexity, or cost |
| **Appropriate reading level** | Matches target population? | Simplify or elevate language |
| **Appropriate authority level** | Can the target population demonstrate this? | Rewrite for correct level |
| **Cultural sensitivity** | Encodes specific cultural norm as universal? | Rewrite to be method-neutral |
| **Natural wording** | Sounds like something a real person would say? | Reword for naturalness |

For **trait items**, also check: dispositional framing, trait vs. attitude, trait vs. self-concept, context independence, reverse-key quality, criterion relevance.

For **competency items**, also check: behavioural focus (observable, not self-concept), honest low-performer test (especially for senior populations).

For **SJT items**, also check: realistic dilemma, genuine trade-off, all options plausible, options discriminate on construct, no loaded framing, balanced option length.

### Stage 2: Pool-Level Review

After individual items, evaluate the pool as a whole.

**Redundancy analysis.** Two items are redundant when they map to the same indicator/facet AND use similar framing (same difficulty, keying, and type). For redundant pairs, recommend which to keep and why.

**Coverage analysis.** Check every indicator/facet from Step 2:

| Indicator/Facet | # of items | Assessment |
|---|---|---|
| [Name] | 3 | Adequate |
| [Name] | 1 | Gap — needs additional items |
| [Name] | 5 | Possible over-representation |

**Difficulty distribution:**

For trait items:
| Level | Target | Actual count | Actual % | Assessment |
|---|---|---|---|---|
| Easy | ~25% | ? | ? | |
| Moderate | ~50% | ? | ? | |
| Hard | ~25% | ? | ? | |

For competency items:
| Tier | Target | Actual count | Actual % | Assessment |
|---|---|---|---|---|
| Foundation | 20-30% | ? | ? | |
| Applied | 40-50% | ? | ? | |
| Demanding | 20-30% | ? | ? | |

For SJT items:
| Level | Target | Actual count | Actual % | Assessment |
|---|---|---|---|---|
| Straightforward | ~25% | ? | ? | |
| Complex | ~50% | ? | ? | |
| Ambiguous | ~25% | ? | ? | |

**Keying balance** (trait and competency items): Target 20-30% reverse-keyed if requested. Check reverse-keyed items are distributed across indicators, not clustered on one facet.

### Stage 3: Faking Vulnerability Assessment

**Pool-level faking risk:**
- Count items rated as high social desirability / impression management risk
- If more than 30% are high risk, the scale is vulnerable
- Apply population-adjusted thresholds (see response-scales.md, Section 4)

**Faking strategies to assess:**
- Uniform endorsement — does the scale include enough reverse-keyed items to detect this?
- Selective exaggeration — are items specific enough that exaggeration creates inconsistencies?
- Self-enhancement (not deliberate faking) — the most common inflation source for senior leaders. Only mitigated by items that force consideration of specific, difficult situations.

---

## 2. Item Revision Guidelines

When flagging an item, always provide:
1. The specific problem
2. A concrete rewrite
3. A brief rationale for the change

Do not say "this item could be improved" without specifying how.

**Format:**

> **Item 7:** "I am someone who values open communication."
>
> **Problem:** Self-concept statement with high social desirability. Measures identity, not behaviour. Transparent desirable answer.
>
> **Revised:** "When I disagree with a decision, I voice my concerns to the relevant people rather than keeping them to myself."
>
> **Rationale:** Anchors to specific, observable behaviour with inherent cost (voicing disagreement is uncomfortable), reducing SD risk.

### Mandatory Re-Review After Substantial Revision

If quality review results in substantial rewriting (more than minor wording changes), revised items must be reviewed again using Stage 1 checks.

**Workflow:** generate pool → review → revise → re-review revised items → assemble final set.

This prevents revised items from introducing new problems (construct drift, double-barrelling, changed difficulty) that go undetected.

---

## 3. Final Item Set Assembly

### Selection Criteria

From the reviewed pool, select items that:
- Passed review or were successfully revised
- Cover all indicators/facets (no gaps)
- Achieve target difficulty distribution
- Include requested proportion of reverse-keyed items
- Minimise redundancy
- Achieve target item count

### Final Set Format — Competency Items

| # | Item text | Indicator | Type | Key | Difficulty |
|---|---|---|---|---|---|
| 1 | [Statement] | [Indicator #] | Cap/Freq/Jdg/Conf | +/R | Found/App/Dem |

### Final Set Format — Trait Items

| # | Item text | Trait facet | Key | Endorsement difficulty | Criterion link |
|---|---|---|---|---|---|
| 1 | [Statement] | [Facet] | +/R | Easy/Mod/Hard | [Predicted competency] |

### Final Set Format — SJT Items

Present each scenario with its options, effectiveness keying, and scoring rationale. See sjt-items.md Section 9 for the full template.

### Every Final Set Must Include:
- All final items with keying/scoring
- Response scale with full anchor labels
- Coverage map
- Criterion linkage statement (traits: which competency this predicts; SJTs: which judgement dimensions are covered)
- Reverse-keyed items clearly identified
- Risks and limitations
- Validation disclaimer (mandatory, see below)

---

## 4. Mandatory Validation Disclaimer

Every final item set must include this statement. Do not shorten, omit, or weaken it.

### For Competency Items

> This item set is conceptually designed based on psychometric principles and has not been empirically validated. Before operational use, the following validation steps are recommended:
>
> 1. **Cognitive interviewing or pilot testing** — administer to a small sample from the target population and gather feedback on clarity, interpretation, and response process
> 2. **Internal consistency analysis** — assess reliability (Cronbach's alpha or McDonald's omega)
> 3. **Exploratory factor analysis** — verify items load on the intended factor
> 4. **Confirmatory factor analysis** — test the proposed structure on a separate sample
> 5. **Criterion validation** — correlate scores with relevant performance outcomes
> 6. **Differential item functioning (DIF) analysis** — check for bias across demographic groups
> 7. **Test-retest reliability** — assess score stability over an appropriate interval
>
> The scale should not be used for high-stakes decisions until adequate validity evidence has been established.

### For Trait Items — Add:

> 8. **Convergent validity** — correlate with established personality measures to confirm expected positioning
> 9. **Discriminant validity** — demonstrate the scale is not a relabelled version of an existing personality facet
> 10. **Criterion-related validity (predictive)** — demonstrate trait scores predict the target competency behaviours. This is the core validation requirement for a predictor scale.
> 11. **Incremental validity** — demonstrate the scale predicts above and beyond existing personality measures. If it does not, using an established instrument would be more defensible.

### For SJT Items — Add:

> 8. **Scoring key validation** — establish expert consensus on option effectiveness through independent SME ratings (minimum 5-10 SMEs; 70%+ agreement threshold)
> 9. **Construct validity** — verify SJT scores correlate with the intended judgement dimensions
> 10. **Criterion-related validity** — demonstrate SJT scores predict relevant job performance outcomes
> 11. **Incremental validity over self-report** — if a self-report measure of the same construct exists, demonstrate the SJT adds predictive value beyond it
> 12. **Adverse impact analysis** — SJTs can produce group differences; assess and mitigate

---

## 5. Scale-Level Quality Indicators

Report these for every final item set:

| Indicator | Target |
|---|---|
| Content coverage | All indicators/facets represented by 2+ items |
| Difficulty range | Items span all difficulty tiers |
| Keying balance | 20-30% reverse-keyed if requested |
| SD/IM profile | Fewer than 30% high risk |
| Reading level consistency | All items within specified level |
| Item count adequacy | Minimum 5 per construct; 8-12 preferred |
| Redundancy | No two items measuring same indicator/facet at same difficulty in same way |

---

## 6. When to Recommend Restructuring

Sometimes the review reveals the pool cannot be salvaged. Be direct when:

- **Fewer than 60% pass review.** The construct definition or indicators likely need revision. Return to Step 2.
- **Multiple indicators cannot be covered.** The construct may be too narrow, or indicators need expansion.
- **Most items are high SD risk.** The construct may be too value-laden for self-report. Discuss alternative methods (360, SJT, behavioural event interviews).
- **Difficulty is compressed.** All items at the same tier. The indicators themselves may lack range.

Do not produce a compromised final set to avoid difficult feedback.

---

## 7. Multi-Construct Assessment Considerations

When building items for multiple constructs in one assessment:

**Cross-scale redundancy.** Flag items that could load on multiple constructs.

**Respondent burden:**
- Under 50 items: minimal
- 50-80 items: moderate
- 80-120 items: high; recommend prioritisation
- Over 120 items: likely fatigue effects

**Construct overlap.** If two constructs consistently produce interchangeable items, they may not be sufficiently differentiated. Recommend merging or redefining.

**Consistent formatting.** All constructs in the same assessment should use the same response scale, item format, and reading level within each measurement layer.
