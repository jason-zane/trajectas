# Trait Item Design Guide

Read this document when the user is building trait-level (dispositional predictor) items. These items measure stable psychological tendencies that predict workplace behaviour and competency.

## Table of Contents
1. What trait measurement is
2. Trait construct inputs checklist
3. Trait construct analysis
4. Trait item writing rules
5. Item pool format
6. Impression management detection
7. Trait-specific quality review
8. Trait-to-competency mapping
9. Common mistakes

---

## 1. What Trait Measurement Is

Trait items measure **stable psychological dispositions** — enduring tendencies in how a person thinks, feels, and responds across situations. They are upstream predictors. They do not measure what someone does in a specific situation; they measure the disposition that makes certain behaviours more likely over time.

**The causal chain:**
Dispositional trait (stable predictor) → Behavioural tendency → Workplace competency → Performance outcome

### How Trait Items Differ From Competency Items

| | Trait items | Competency items |
|---|---|---|
| **What they measure** | Stable dispositions | Observable workplace behaviours |
| **Stability** | Relatively fixed over time | Developable through training |
| **Item framing** | "I tend to..." / "I am the kind of person who..." | "I do X when Y happens" / "In my work, I routinely..." |
| **Response scale** | Dispositional agreement (like me / unlike me) | Behavioural consistency (rarely → consistently true) |
| **Purpose** | Predict who is likely to develop the competency | Diagnose current capability level |
| **Context sensitivity** | Low — consistent across situations | High — tied to specific work contexts |
| **Validation target** | Criterion validity (does it predict the competency?) | Content validity (does it cover the construct?) |

### The Critical Distinction: Traits vs. States vs. Attitudes

| Type | Definition | Stability | Example | Suitability |
|---|---|---|---|---|
| **Trait** | Enduring psychological disposition | High | Need for cognition | Strong predictor |
| **State** | Temporary psychological condition | Low | Current enthusiasm for a tool | Poor predictor |
| **Attitude** | Evaluative judgement about an object | Moderate | "I think AI is useful" | Weak predictor |
| **Value** | Belief about what is important | Moderate | "Innovation matters" | Weak predictor |
| **Self-concept** | Belief about who you are | Moderate | "I am innovative" | Measures self-image, not disposition |

**Rule:** If a construct can change substantially based on a single experience, training programme, or shift in organisational culture, it is not a trait.

---

## 2. Trait Construct Inputs Checklist

Collect all of the following before proceeding. Ask all questions together.

- **Trait name**
- **Working definition** — must be dispositional (what the person is like)
- **Predicted competency/behaviour** — the downstream criterion this trait predicts
- **Theoretical mechanism** — why would this disposition lead to this behaviour?
- **Target population**
- **Context of use** (selection, prediction, development planning)
- **Desired final item count**
- **Reverse-keyed items** (yes/no)
- **Impression management detection items** (yes/no)
- **Item context:** general or lightly domain-contextualised
- **Target reading level** (plain language / standard / graduate-executive)

Do not proceed until inputs are confirmed by the user.

---

## 3. Trait Construct Analysis

Apply these checks in addition to the general construct analysis (construct-analysis.md).

### 3.1 Trait Stability Test

Would this construct remain relatively stable if the person:
- Changed jobs?
- Changed industries?
- Went through a major restructure?
- Had a bad experience with the relevant domain?

If most answers are "no," the construct is not a trait.

### 3.2 Big Five Mapping

Map the proposed trait against Big Five domains:

| Big Five domain | Relevant facets | Your trait overlaps if... |
|---|---|---|
| **Openness** | Intellectual curiosity, imagination, willingness to try new things | Involves exploration, novelty-seeking, cognitive engagement |
| **Conscientiousness** | Organisation, thoroughness, self-discipline, achievement striving | Involves structure, follow-through, systematic behaviour |
| **Extraversion** | Assertiveness, sociability, positive emotionality, activity level | Involves social influence, energy, proactive engagement |
| **Agreeableness** | Cooperation, trust, compliance, modesty | Involves collaboration, empathy, interpersonal harmony |
| **Neuroticism (low = Emotional Stability)** | Anxiety, hostility, self-consciousness, vulnerability | Involves stress tolerance, emotional regulation, composure |

If the trait maps cleanly to an existing Big Five facet, flag it. The user should know established instruments already capture this.

If the trait sits at the intersection of two or more Big Five domains, that is often where the most useful applied constructs live. Flag this as a strength.

### 3.3 Criterion Linkage Analysis

Every trait must have a clear criterion. Specify:
1. **Predicted competency:** What behaviour should people high on this trait demonstrate more?
2. **Mechanism:** Why would this disposition lead to this behaviour?
3. **Discriminant claim:** What does this trait predict that other traits do not?

Without criterion linkage, a trait scale has no predictive target and cannot be validated.

---

## 4. Trait Item Writing Rules

These rules are specific to dispositional trait items.

### Rule 1: Measure Tendencies, Not Behaviours

Trait items describe how someone typically is, not what they do in a specific situation.

| Competency item (wrong for traits) | Trait item (correct) |
|---|---|
| When AI outputs are weak, I try alternative approaches | I find it natural to keep trying different approaches when something doesn't work the first time |
| I test new AI tools before being asked to | I tend to explore new tools and methods on my own, before being told to |
| I track commitments and follow through | I am naturally inclined to keep track of what I have committed to |

**The test:** Could this item be true regardless of the person's current job, tools, or context? If yes, it is properly trait-level.

### Rule 2: Use Dispositional Language

Preferred phrasings:
- "I tend to..."
- "I am the kind of person who..."
- "I naturally..."
- "I find it easy to..." / "I find it difficult to..."
- "In general, I..."
- "My inclination is to..."
- "Compared to most people, I..."

Avoid:
- "In my current role, I..." (too context-specific)
- "At work, I always..." (behavioural + extreme)
- "When using [specific tool], I..." (too domain-specific)
- "I believe that..." (measures attitude, not disposition)

### Rule 3: Context-Light, Not Context-Free

Items should be recognisable in a work context but not dependent on a specific tool, technology, or job.

| Too abstract | Too context-specific | Right level |
|---|---|---|
| I like learning | When using ChatGPT, I experiment with prompt styles | I enjoy figuring out how to get better results from new tools and methods |
| I am organised | I build SOPs for my AI workflows | I naturally create structure and repeatable processes when I find something that works |
| I am sceptical | I fact-check every AI output | I tend to question information before accepting it, even from credible sources |

**Exception — domain-contextualised trait items:** When building a domain-specific predictor, light domain references are acceptable if the underlying construct is still dispositional. Example: "I am drawn to experimenting with new technologies, even before I fully understand them." This references technology but measures a stable disposition.

### Rule 4: Avoid Transparent Virtue Items

The transparency test: Would someone who wants to appear capable immediately know which end of the scale to endorse? If yes, rewrite.

| Strategy | Example |
|---|---|
| Frame as preference, not virtue | "I prefer to figure things out on my own before asking for help" |
| Describe trade-offs | "I sometimes spend more time exploring options than is strictly necessary" |
| Use tendency, not evaluation | "I often find myself testing things outside my immediate responsibilities" |
| Reverse-key with natural alternative | "I prefer to wait until a new approach has been proven before I try it myself" |

### Rule 5: Reverse-Keyed Items Must Be Legitimate Alternatives

Reverse-keyed items should describe the opposite pole as a genuine, non-deficient alternative.

| Bad (implies deficiency) | Good (legitimate alternative) |
|---|---|
| I do not like learning new things | I prefer to deepen my expertise in what I already know rather than constantly trying new things |
| I am not organised | I tend to work flexibly and adapt as I go rather than following a set structure |
| I do not question things | I generally trust established processes and focus my energy on execution |

If reverse-keyed items describe obviously undesirable traits, respondents reject them regardless of actual disposition. The item then measures social desirability, not the trait.

### Rule 6: Avoid Self-Concept Items

Items that ask respondents to evaluate themselves ("I am creative", "I am analytical") measure self-concept, not disposition. Self-concept is influenced by identity, social comparison, and recent feedback.

| Self-concept (avoid) | Dispositional tendency (prefer) |
|---|---|
| I am a curious person | I find myself drawn to exploring how things work, even when it is not required |
| I am analytical | I tend to break down problems into components before deciding what to do |
| I am resilient | When things go wrong, I tend to recover my focus relatively quickly |

### Rule 7: Calibrate Endorsement Difficulty

Items should vary in how easy they are to endorse, creating measurement discrimination.

| Level | Description | Example (exploratory disposition) |
|---|---|---|
| **Easy** | Most people with some trait level would agree | "I like trying new tools and approaches when they become available" |
| **Moderate** | Requires meaningful trait level | "I tend to seek out new methods even when my current approach is working well" |
| **Hard** | Only strong trait-holders agree | "I sometimes spend time exploring tools that have no obvious immediate application to my work" |

Target distribution: ~25% easy, ~50% moderate, ~25% hard.

### Rule 8: No Extreme Language

Avoid: always, never, constantly, perfectly, without exception. These cause honest respondents to underrate themselves and only dishonest respondents to endorse. The one exception is impression management detection items.

### Rule 9: Single Idea Per Item

Each item measures one facet of the trait. If the item contains "and" linking two distinct tendencies, split it.

---

## 5. Trait Item Pool Format

Present every trait item pool using this structure:

| # | Item text | Trait facet | Key | SD risk | Endorsement difficulty | Criterion link | Notes |
|---|---|---|---|---|---|---|---|
| 1 | [Statement] | [Facet] | + / R | Low / Mod / High | Easy / Mod / Hard | [Predicted competency] | [Concerns] |

**Column definitions:**
- **#:** Sequential number
- **Item text:** The dispositional statement
- **Trait facet:** Which aspect of the trait this item taps
- **Key:** + (positive) or R (reverse-keyed)
- **SD risk:** Social desirability risk
- **Endorsement difficulty:** Easy / Moderate / Hard to endorse
- **Criterion link:** Which competency/behaviour this item predicts
- **Notes:** Concerns, design rationale, flagged issues

---

## 6. Impression Management Detection

Trait items are highly vulnerable to impression management because the desirable pole is often obvious and there is no specific event to anchor honesty to.

**Design impression management items as tendencies that are desirable but implausible at extreme levels:**

| Example | Why it works |
|---|---|
| "I never feel reluctant to try something completely new" | Some reluctance is universal |
| "I have never lost interest in a project before completing it" | Loss of interest is universal |
| "I find it equally easy to focus on long-term goals and short-term tasks" | Cognitive trade-off makes this implausible |
| "I never feel impatient when learning something that doesn't come naturally" | Impatience is normal |

**Rules:**
- 2-4 items per trait scale
- Must match the tone and format of genuine items
- Should reference the trait domain to blend naturally
- Flag clearly in the item pool (invisible to respondents)

---

## 7. Trait-Specific Quality Review

Apply these checks in addition to the standard quality review (quality-review.md).

### Individual Item Checks

| Check | Question | Action if failed |
|---|---|---|
| **Dispositional framing** | Does this measure a stable tendency, not situational behaviour? | Rewrite with dispositional language |
| **Trait vs. attitude** | Could this change after a single experience or training? | Reframe around the enduring disposition |
| **Trait vs. self-concept** | Does this ask the respondent to evaluate themselves? | Rewrite as behavioural inclination |
| **Context independence** | Would this make sense if the respondent changed jobs? | Reduce context-specificity |
| **Reverse-key quality** | Does the reverse item describe a legitimate alternative? | Rewrite opposite pole as genuine preference |
| **Criterion relevance** | Can you articulate why endorsing this predicts the target competency? | Strengthen connection or cut the item |

### Pool-Level Checks

| Check | Question | Action if failed |
|---|---|---|
| **Big Five discrimination** | Could this scale be replaced by an existing Big Five facet? | Ensure items capture the unique intersection |
| **Endorsement distribution** | Items spread across easy/moderate/hard? | Add items at underrepresented levels |
| **Facet coverage** | Pool covers all identified trait facets? | Add items for uncovered facets |
| **Criterion coverage** | Items collectively predict the full range of the target competency? | Review whether any aspect lacks a predictor |

---

## 8. Trait-to-Competency Mapping

For multi-layer assessments, each trait must map explicitly to competencies.

**Format:**

| Trait | Predicted competency | Mechanism | Expected relationship |
|---|---|---|---|
| [Trait name] | [Competency name] | [Why this disposition leads to this behaviour] | Strong / Moderate positive |

**Mapping rules:**
1. One-to-one is cleanest but not mandatory
2. The mechanism must be articulable in 1-2 sentences
3. Each trait should predict its target more strongly than other competencies in the model
4. The mapping is a hypothesis until validated — always state this

---

## 9. Common Mistakes

| Mistake | Example | Problem | Fix |
|---|---|---|---|
| Measuring attitude | "I think AI will transform my industry" | Current opinion, not disposition | "I tend to be early in exploring new technologies" |
| Measuring behaviour | "I experiment with new AI tools weekly" | Frequency, not disposition | "I am naturally inclined to try new tools, even without a specific need" |
| Measuring self-concept | "I am an innovative person" | Identity label, not tendency | "I often find myself thinking about how things could be done differently" |
| Too domain-specific | "I test different prompting strategies in ChatGPT" | Requires specific tool knowledge | "When a new tool doesn't work first try, I tend to experiment with different approaches" |
| Obvious social desirability | "I am always open to new ideas" | Transparent virtue + extreme language | "I am more comfortable trying unfamiliar approaches than sticking with what I know" |
| Reverse-key as deficiency | "I do not like change" | Frames low pole as character flaw | "I prefer stability and consistency over frequent change" |
| Confusing traits with values | "I believe continuous learning is essential" | Belief, not tendency | "I regularly seek out learning opportunities, even when not required to" |
