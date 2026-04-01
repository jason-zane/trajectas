# Response Scales and Social Desirability Guide

Read this document when selecting or recommending a response scale, and when designing social desirability or impression management detection items.

## Table of Contents
1. Response scale options
2. Scale selection decision framework
3. Anchoring principles
4. Social desirability detection (competency items)
5. Impression management detection (trait items)
6. Presentation guidance

---

## 1. Response Scale Options

### Default for Trait Items: Dispositional Agreement Scale (5-point)

| Rating | Label |
|---|---|
| 1 | Very unlike me |
| 2 | Somewhat unlike me |
| 3 | Neither like nor unlike me |
| 4 | Somewhat like me |
| 5 | Very like me |

Why this is the default: Asks respondents to evaluate how well the statement describes their general tendency. Does not anchor to behaviour frequency. "Like me / unlike me" framing is well-established in personality measurement. The midpoint is a genuine neutral.

**When NOT to use:** For items that describe specific workplace behaviours (use behavioural consistency instead). When the construct is actually a competency despite being labelled a "trait."

### Default for Competency Items: Behavioural Consistency Scale (5-point)

| Rating | Label |
|---|---|
| 1 | Rarely true in practice |
| 2 | Sometimes true |
| 3 | Often true |
| 4 | Usually true |
| 5 | Consistently true, even in demanding situations |

Why this is the default: Anchors to behaviour. Top anchor creates ceiling discrimination. Avoids acquiescence problems of agree/disagree scales. Midpoint (3 = "Often true") is genuinely midpoint.

### Default for SJT Items: Most/Least Effective

SJTs do not use Likert scales. See the SJT reference file (Section 7) for response instruction formats.

### Alternative: Frequency Scale (5-point)

| Rating | Label |
|---|---|
| 1 | Never or almost never |
| 2 | Rarely |
| 3 | Sometimes |
| 4 | Often |
| 5 | Very frequently or always |

When to use: Behaviours with a natural frequency dimension. Trade-off: top anchor ("always") may create ceiling compression.

### Alternative: Confidence Scale (5-point)

| Rating | Label |
|---|---|
| 1 | Not at all confident |
| 2 | Slightly confident |
| 3 | Moderately confident |
| 4 | Quite confident |
| 5 | Very confident |

When to use: Measuring self-efficacy beliefs rather than behaviour. Useful for development needs analysis and readiness assessment. Trade-off: confidence and capability are correlated but not identical. Overconfident respondents score highly regardless of skill; underconfident respondents score low despite high capability.

### Alternative for Traits: Forced-Choice Paired Comparisons

For high-stakes selection, pairs of equally desirable statements force respondents to choose which describes them more. Dramatically reduces faking. Requires ipsative scoring and specialised analysis (Thurstonian IRT modelling). Recommend only if the user specifically requests faking resistance and understands scoring implications.

---

## 2. Scale Selection Decision Framework

| Measurement focus | Recommended scale | Rationale |
|---|---|---|
| Trait / disposition | Dispositional agreement (default for traits) | Measures how well a statement describes the person's enduring tendency |
| Capability (can they do it?) | Behavioural consistency (default for competencies) | Anchors to demonstration of behaviour across difficulty levels |
| Frequency (how often?) | Frequency scale | Natural mapping between behaviour and response |
| Confidence (how confident?) | Confidence scale | Directly measures self-efficacy beliefs |
| Judgement (good decisions?) | SJT format | Assesses decision quality in context; resists faking |
| Mixed competency types | Behavioural consistency for most, tag confidence items separately | Keeps primary scale consistent |
| Two-layer model (traits + competencies) | Dispositional agreement for traits; behavioural consistency for competencies | Each layer uses its own scale. Do not mix. |

**Critical rule:** Do not mix trait and competency items on the same response scale. Each layer gets its own scale. Mixing dispositional items with behavioural items confuses respondents and produces noisy data.

---

## 3. Anchoring Principles

Regardless of scale:
- **All points labelled.** Every point must have a verbal label, not just endpoints.
- **Equidistant intervals.** Labels should imply roughly equal psychological distance between adjacent points.
- **Unambiguous labels.** Each label must have a clearly different meaning from adjacent labels.
- **No double-barrelled anchors.** Each anchor describes one concept. Not "frequently and enthusiastically."

### 5-point vs. 7-point

| | 5-point | 7-point |
|---|---|---|
| Advantages | Simpler; adequate discrimination; reduces overthinking | Finer discrimination; slightly higher reliability |
| Disadvantages | Less granularity; midpoint may attract fence-sitters | Anchors harder to differentiate; marginal benefit |
| Recommendation | Default for applied assessment | Only if user has specific psychometric reason |

---

## 4. Social Desirability Detection (Competency Items)

### When to include
- High-motivation-to-fake contexts (selection, promotion, performance evaluation)
- User specifically requests them
- Construct is particularly vulnerable (integrity, ethics, leadership)

### Design principles

**Improbable virtue items** — desirable but almost no one does consistently:
- "I have never felt frustrated with a colleague's work"
- "I have never made a decision I later regretted"

**Unrealistic consistency items** — maintaining behaviour at an implausible level:
- "I remain completely calm in every stressful situation, without exception"
- "I give every person I work with exactly the same amount of attention and support"

### Rules
1. Match tone and format of genuine items
2. 2-4 per competency, maximum
3. Avoid well-known traps ("I have never told a lie")
4. Calibrate to the population — what is implausible depends on the target group
5. Scored separately, never included in competency total

### Population-Adjusted SD Thresholds

| Population | SD risk adjustment |
|---|---|
| General workforce | Use standard ratings |
| Middle managers | Upgrade medium to high if items describe normative management behaviours |
| Senior leaders/executives | Treat all medium as high. Only items rated low are genuinely low-risk. |
| High-stakes context | Apply senior leader threshold regardless of population level |

---

## 5. Impression Management Detection (Trait Items)

Trait items are even more vulnerable because there is no specific event to anchor honesty to.

**Design items as tendencies desirable but implausible at extreme levels:**
- "I never feel reluctant to try something completely new"
- "I have never lost interest in a project before completing it"
- "I find it equally easy to focus on long-term goals and short-term tasks"
- "I never feel impatient when learning something that doesn't come naturally to me"

### Rules
- 2-4 per trait scale
- Match tone and format of genuine items
- Reference the trait domain to blend naturally
- Flag clearly for assessment designer (invisible to respondents)

---

## 6. Presentation Guidance

When including the recommended scale in the final item set:

### Template

**Response scale**
Respondents rate each item using the following scale:

[Insert appropriate scale with all anchor labels]

**Administration notes:**
- All items use the same response scale for consistency
- Reverse-keyed items are scored in reverse (5→1, 4→2, 3→3, 2→4, 1→5) during analysis
- Social desirability / impression management items are scored separately and not included in construct totals
- The scale should be presented with all anchor labels visible to the respondent
- Items should be presented in randomised order within the construct

### Multi-Construct Assessments

- Use one response scale for the entire assessment within a measurement layer
- Randomise across constructs (do not group by construct — creates halo effects)
- If one construct requires a different scale, consider a separate instrument
- Monitor total length for respondent burden:
  - Under 50 items: minimal burden
  - 50-80 items: moderate
  - 80-120 items: high; recommend prioritisation
  - Over 120 items: likely fatigue effects and degraded data quality
