# Trajectas: Organisational Assessment Architecture

> **Status:** Initial thought reference. Not yet a build plan.
> **Date captured:** 2026-04-20
> **Purpose:** Defines the full architecture for Trajectas's organisational assessment system — the "organisation side" of a person-organisation matching platform.

## Document Purpose

This document defines the full architecture for Trajectas's organisational assessment system — the "organisation side" of a person-organisation matching platform. It is intended to serve as a structural reference for building this system into the existing Trajectas codebase.

Trajectas is a psychometric assessment platform (Next.js, Supabase, TypeScript, Tailwind, shadcn/ui, Vercel). The platform currently supports psychometric assessment building and administration. This document describes a new capability: assessing organisations to produce a structured profile that can later be matched against candidate assessment results.

---

## The Problem We're Solving

Most recruitment assessment tools measure the candidate but not the organisation. The few tools that do assess organisations (e.g., Denison, OCAI, CultureAmp) don't connect their output to candidate assessment in a way that enables direct matching. The result is that person-organisation fit — one of the strongest predictors of retention, engagement, and performance — is assessed by gut feel rather than data.

Trajectas solves this by:

1. Independently profiling the organisation on a structured set of dimensions.
2. Assessing candidates on commensurate dimensions using psychometric instruments.
3. Algorithmically computing the degree of match between a candidate's profile and the organisation+role profile.

This document covers step 1 — the organisational assessment system. Step 2 is handled by the existing assessment builder. Step 3 (the matching algorithm) is a future workstream that depends on both the organisational profile and candidate assessment data being available in the platform.

---

## Core Concepts

### The Dimensional Framework

The organisation is measured across **16 dimensions** organised into **4 layers**. Each layer captures a different aspect of the organisational environment.

| Layer | What It Captures | Stability | Primary Source |
|-------|-----------------|-----------|----------------|
| **Culture** (Values & Identity) | What the organisation fundamentally prizes | Slow-changing (years) | Employees + Leaders |
| **Climate** (Lived Experience) | What it feels like to work there day-to-day | Moderate (months) | Employees |
| **Operating Environment** (Structural Reality) | The conditions people work within | Variable by context | Employees + Leaders |
| **Leadership Norms** (How Leadership Operates) | How leadership behaviour is actually experienced | Moderate (months) | Employees |

### The Three Instruments

The system uses three instruments, each targeting a different respondent group:

| Instrument | Respondents | Purpose | Items | Time |
|-----------|------------|---------|-------|------|
| **Organisational Profile Survey (OPS)** | Employees (broad) | Ground-truth profile of the organisation | ~68 items | 12-15 min |
| **Leadership Context Questionnaire (LCQ)** | Senior leaders, hiring managers | Aspirational profile + strategic context | ~32 items | 8-10 min |
| **Role Environment Profile (REP)** | Hiring manager + 2-3 team members | Team/role-level micro-context | ~24-30 items | 5-8 min |

### Three Levels of Profile

The system produces profiles at three levels of granularity:

1. **Organisation-level profile:** Aggregated from the OPS across all respondents. This is the macro view.
2. **Function/team-level profile:** Aggregated from OPS respondents within a specific function or team (when sample size permits). This captures sub-cultures.
3. **Role-level profile:** Derived from the REP for a specific position. This is the micro view used for candidate matching.

---

## The 16 Dimensions: Full Definitions

### Layer 1: Culture (Values & Identity)

These dimensions capture what the organisation fundamentally prizes — its deep priorities and identity. Culture is relatively stable and changes slowly. Both ends of each dimension are valid — this is about character, not quality.

---

**1.1 Innovation Orientation**

*The degree to which the organisation values experimentation, creative risk-taking, and novelty over proven methods and established approaches.*

- **High end:** The organisation celebrates new ideas, tolerates failure as a learning cost, and rewards people who challenge the status quo. There is appetite for trying unproven approaches. "Let's try it and see" is a common phrase.
- **Low end:** The organisation values reliability, refinement of what already works, and risk mitigation. Proven methods are preferred. Change requires strong justification. "If it's not broken, don't fix it" is the prevailing attitude.
- **Why it matters for fit:** People who are highly creative and novelty-seeking will feel stifled in a low-innovation environment. People who value stability and predictability will feel anxious in a high-innovation one. Neither preference is wrong — but the mismatch predicts dissatisfaction and turnover.

---

**1.2 Achievement Orientation**

*The degree to which the organisation is driven by measurable results, competitive performance, and commercial outcomes.*

- **High end:** Success is defined through metrics and targets. Performance is visible and compared. There is internal competition, and hitting numbers is celebrated. The question "what did you deliver?" is central.
- **Low end:** Success is defined more broadly — through quality, relationships, sustainability, mission fulfilment, or process adherence. The organisation is less metric-fixated and less competitive internally.
- **Why it matters for fit:** High-achievement-oriented individuals thrive in competitive, results-driven environments. People who are motivated by craft, service, or collaboration may find high-achievement cultures exhausting or shallow.

---

**1.3 People Orientation**

*The degree to which the organisation prioritises relationships, collective wellbeing, and belonging as core values.*

- **High end:** The organisation invests in people as an end in itself, not just as a means to output. Team cohesion, loyalty, care, and mutual support are emphasised. "We look after our people" is a genuine statement, not just a slogan.
- **Low end:** The organisation is more transactional. Performance is what matters, and personal connection is secondary. Relationships are professional and functional. The organisation doesn't expect or foster deep personal bonds.
- **Why it matters for fit:** People with high affiliation needs and relational values will struggle in low-people-orientation environments. People who prefer clear professional boundaries may find high-people-orientation environments cloying or distractingly social.

---

**1.4 Order Orientation**

*The degree to which the organisation values structure, consistency, process, and predictability.*

- **High end:** Clear rules, defined workflows, formalised decision-making, and documented processes. Roles are well-defined. Consistency is prized. "There's a process for that" is common.
- **Low end:** The organisation is more fluid. Roles flex, processes are informal, and people are expected to figure things out. Structure emerges from practice rather than being imposed. "Just get it done however you think best" is common.
- **Why it matters for fit:** People high in conscientiousness and need for structure will flounder in low-order environments. People who are adaptable and autonomous will feel constrained by excessive process.

---

### Layer 2: Climate (Lived Experience)

These dimensions capture what it actually feels like to work in the organisation on a daily basis. Climate is more proximal and changeable than culture — it can shift within months based on leadership behaviour, workload, or organisational events. This is the layer employees feel most directly.

Note: Unlike Layer 1, these dimensions are less purely bipolar — higher scores are generally associated with better organisational health outcomes. However, individual tolerance and preference still vary, which is what makes them relevant for fit.

---

**2.1 Psychological Safety**

*The degree to which people feel they can speak up, take interpersonal risks, admit mistakes, and challenge ideas without fear of punishment or embarrassment.*

- **High end:** People openly disagree in meetings. Mistakes are discussed as learning opportunities. Bad news travels up quickly because people aren't afraid to share it. Questions are welcomed, including challenging ones.
- **Low end:** People self-censor. Disagreement happens in private, not in meetings. Mistakes are hidden or blamed on others. There's a sense that speaking up carries career risk.
- **Why it matters for fit:** While higher psychological safety is better for most people, some individuals have a higher threshold for navigating low-safety environments — and the matching algorithm needs to account for how much safety a candidate needs versus how much the environment provides.

---

**2.2 Feedback & Recognition**

*The degree to which performance is visibly acknowledged, and how frequently and directly people receive both positive recognition and developmental feedback.*

- **High end:** Strong feedback loops. People know where they stand. Good work is recognised publicly and specifically. Developmental feedback is regular and constructive. Performance conversations happen frequently, not just at annual review.
- **Low end:** Feedback-sparse environment. People are often uncertain about how they're perceived. Recognition is rare or generic. Performance issues may not be surfaced until they become critical.
- **Why it matters for fit:** People with high recognition needs or who are strongly motivated by feedback will disengage in low-feedback environments. Some people prefer to work autonomously without regular check-ins and find frequent feedback intrusive.

---

**2.3 Growth & Development**

*The degree to which the organisation actively supports learning, skill-building, and career progression.*

- **High end:** Development is structurally embedded — training budgets, mentoring programmes, stretch assignments, clear promotion pathways, and regular career conversations. The organisation actively invests in people's futures.
- **Low end:** Development is left to the individual. There may be nominal programmes, but in practice, people learn by doing and advance by creating their own opportunities. The organisation's attitude is "we hired you for what you can do now."
- **Why it matters for fit:** People who are growth-oriented and career-focused will feel stagnant in low-development environments. People who are content in their current role and prefer stability may not care about this dimension at all.

---

**2.4 Social Connection**

*The degree to which the workplace is socially warm and connected versus professional and transactional.*

- **High end:** Genuine interpersonal relationships beyond task requirements. People know each other personally. Social rituals exist (team lunches, celebrations, informal catch-ups). There's a sense of community and belonging.
- **Low end:** Interactions are cordial but task-focused. People don't socialise much outside of work requirements. The environment is professional and arms-length. Relationships are functional.
- **Why it matters for fit:** People with high affiliation needs thrive in socially connected environments. Introverts or people who prefer clear work/life separation may find high-connection environments draining or boundary-crossing.

---

### Layer 3: Operating Environment (Structural Reality)

These dimensions capture the conditions people work within, regardless of cultural aspirations or leadership intentions. This is the most contextual layer — shaped by industry, market, organisational maturity, and the nature of the work itself. It is the least amenable to change through culture initiatives and the most important to match correctly.

---

**3.1 Pace of Change**

*How fast the organisation moves — how frequently priorities shift, how quickly decisions need to be made, and how much external pressure drives urgency.*

- **High end:** Constant motion. Priorities shift frequently. Speed of execution is valued over perfection. The external environment (market, competitors, regulation) creates genuine urgency. Quarterly plans may be obsolete within weeks.
- **Low end:** Stable and deliberate. Priorities are set and maintained. There is time to think, plan, and execute carefully. The external environment is relatively predictable.
- **Why it matters for fit:** People who thrive on energy and rapid change will be bored in low-pace environments. People who need time to think deeply and work thoroughly will be overwhelmed in high-pace ones.

---

**3.2 Ambiguity**

*How clear versus uncertain the problems, goals, success criteria, and paths forward are.*

- **High end:** The organisation is dealing with novel problems, undefined markets, evolving strategies, and imperfect information. "We're figuring it out as we go" is accurate, not an excuse. Success criteria may be unclear or contested.
- **Low end:** Well-understood problems with established playbooks. Clear success metrics. The path from input to output is well-defined. People know what good looks like.
- **Why it matters for fit:** This is distinct from Pace of Change. An organisation can be fast-paced but low-ambiguity (high-volume, well-understood work done quickly) or slow-paced but high-ambiguity (a research institution working on undefined questions). People with high tolerance for ambiguity are a specific personality profile — they find clarity boring. People with low tolerance for ambiguity find unclear expectations deeply stressful.

---

**3.3 Interdependence**

*The degree to which work requires cross-functional collaboration, coordination across teams, and managing multiple dependencies versus independent execution within clear boundaries.*

- **High end:** Nobody succeeds alone. Work products require input from multiple functions. Coordination costs are high. Meetings are frequent because alignment is genuinely necessary. Delays in one area cascade to others.
- **Low end:** Work is relatively self-contained. Teams or individuals can execute within their own boundaries without heavy coordination. Handoffs are clean and well-defined.
- **Why it matters for fit:** High-interdependence environments require strong collaboration skills, patience with process, and comfort with shared ownership. Low-interdependence environments reward individual execution and autonomy.

---

**3.4 Stakeholder Complexity**

*How many internal and external stakeholders people must navigate, how politically complex the environment is, and how much influence management is required to get things done.*

- **High end:** Multiple stakeholders with competing priorities. Getting things done requires navigating relationships, building coalitions, and managing upward and laterally. Political awareness matters. Who you know and how you influence them is as important as the quality of your work.
- **Low end:** Simpler influence structures. The path from "good idea" to "approved and implemented" is relatively direct. Fewer stakeholders to manage. Merit and quality of work are the primary drivers of outcomes.
- **Why it matters for fit:** People who are politically skilled and relationally sophisticated thrive in high-complexity environments. People who expect that good work speaks for itself will be frustrated and ineffective in them.

---

### Layer 4: Leadership Norms (How Leadership Operates)

These dimensions capture the behavioural patterns of leadership as experienced by employees — not what leaders say their style is, but how leadership is actually felt in the organisation. This layer is measured primarily through the employee survey (OPS), not leader self-report, because leaders consistently overrate their own effectiveness on these dimensions.

The gap between Layer 1 (what the organisation says it values) and Layer 4 (how leadership actually operates) is itself diagnostic. An organisation that values empowerment (Layer 1) but has leaders who micromanage (Layer 4) has a coherence problem that directly affects fit — a candidate entering that environment needs the ability to navigate mixed signals.

---

**4.1 Direction & Clarity**

*How prescriptively leaders define expectations, goals, and priorities.*

- **High end:** Leaders provide clear, specific direction. People know what's expected, what success looks like, and what the priorities are. Goals are explicit and measurable. There is little guesswork about what to focus on.
- **Low end:** Leaders set broad intent and expect people to interpret, define, and prioritise for themselves. Direction is more visionary than operational. "Figure out the best way to get there" is common.
- **Why it matters for fit:** People who need clarity to perform well will struggle under vague direction. People who are self-directed will feel constrained by overly prescriptive leadership.

---

**4.2 Empowerment**

*How much autonomy leaders actually grant — the degree to which people are trusted to make decisions, manage their own work, and act without seeking approval.*

- **High end:** Decision-making is pushed down. People are trusted to make calls within their domain. Approval processes are light. Leaders intervene by exception, not by default.
- **Low end:** Decision-making is centralised. More check-ins, sign-offs, and oversight. Leaders want to be involved in decisions and review work before it goes out. Autonomy is limited.
- **Why it matters for fit:** People with high autonomy needs will disengage or leave in low-empowerment environments. People who prefer guidance and validation will feel unsupported in high-empowerment ones.

---

**4.3 Challenge & Accountability**

*How directly leaders hold people to account, how they handle underperformance, and the degree to which high standards are enforced.*

- **High end:** Leaders confront performance issues directly. High standards are set and enforced. Underperformance is addressed promptly. There is a clear link between performance and consequences (positive and negative).
- **Low end:** Leaders avoid difficult conversations. Underperformance is tolerated or worked around. Standards exist on paper but are inconsistently enforced. Feedback tends toward the diplomatic or vague.
- **Why it matters for fit:** People who are driven and want to be pushed will thrive under high-accountability leadership. People who are sensitive to criticism or need a gentler management approach may find it punitive.

---

**4.4 Support & Coaching**

*How personally available and developmentally oriented leaders are.*

- **High end:** Leaders invest time in their people — coaching, mentoring, removing blockers, actively helping people grow. They are accessible and care about individual development as a genuine priority, not an afterthought.
- **Low end:** Leaders are more distant or purely task-focused. They manage work, not people. Development conversations are infrequent. Leaders may be well-intentioned but unavailable due to their own workload or orientation.
- **Why it matters for fit:** People who want mentorship and personal investment from their leader will feel neglected under low-support leadership. People who prefer to be left alone to do their work may find high-support leadership intrusive.

---

## Instrument Design: Detailed Specifications

### Instrument 1: Organisational Profile Survey (OPS)

**Purpose:** To produce the ground-truth organisational profile based on employee experience.

**Respondents:** Employees across the organisation, stratified by level and function where possible.

**Target sample sizes:**

| Org Size | Target Respondents | Profile Granularity |
|----------|-------------------|---------------------|
| Under 20 | 5-10 (census if possible) | Org-level only. Flag as "indicative" profile due to small sample. |
| 20-50 | 10-20 | Org-level only. Reliable profile with 15+ respondents. |
| 50-150 | 20-40 | Org-level + basic sub-group analysis (e.g., leadership vs. IC) with 10+ per sub-group. |
| 150-500 | 40-80 | Org-level + function/team-level sub-group profiles. |
| 500+ | 80-150+ (representative sample) | Full sub-group profiling by level, function, and location. |

**Minimum viable sample:** 5 respondents. Below 5, the platform should not compute a profile — the data is too sparse to be meaningful. At 5-9, the profile should be clearly labelled as "indicative" and confidence intervals should be wide.

**Structure:**

The OPS has two sections:

**Section A: Likert Items (64 items)**
- 4 items per dimension × 16 dimensions = 64 items
- Response scale: 5-point descriptive agreement scale
  - 1 = Not at all like this organisation
  - 2 = Slightly like this organisation
  - 3 = Moderately like this organisation
  - 4 = Very much like this organisation
  - 5 = Extremely like this organisation
- Note: The scale anchors are deliberately "descriptive" rather than "agree/disagree." This frames the respondent as describing the environment, not evaluating it, which reduces social desirability bias and satisfaction contamination.
- Items should be written as behavioural descriptions of the environment, not evaluative judgements. Example:
  - Good: "People in this organisation regularly try new approaches, even when the outcome is uncertain."
  - Bad: "This organisation does an excellent job of encouraging innovation."
- Within each set of 4 items per dimension, at least 1 should be reverse-keyed (describing the opposite end of the dimension) to reduce acquiescence bias.
- Items should be presented in randomised order across dimensions, not grouped by dimension.

**Section B: Ipsative Culture Profile (4 item sets)**
- Applies only to Layer 1 (Culture) dimensions.
- Each set presents 4 statements, one representing each culture dimension (Innovation, Achievement, People, Order).
- Respondent distributes 100 points across the 4 statements based on how well each describes the organisation.
- 4 item sets, each framing the culture from a different angle:
  1. "What this organisation most rewards" (reward signals)
  2. "What leadership in this organisation most embodies" (leadership identity)
  3. "The kind of people who succeed here" (success prototype)
  4. "What holds this organisation together" (organisational glue)
- The ipsative data produces a proportional culture profile (e.g., 35% Innovation, 15% Achievement, 30% People, 20% Order) that captures relative priorities rather than absolute levels.

**Total respondent burden:** 64 Likert items + 4 ipsative sets ≈ 12-15 minutes.

**Demographics collected (for stratification, not identification):**
- Role level: Individual contributor / Team lead or supervisor / Manager / Senior leader or executive
- Function/department (free-text or dropdown depending on org size)
- Tenure: Less than 1 year / 1-3 years / 3-5 years / 5+ years
- Location (if multi-site)

**Anonymity requirement:** Results are never reported at a granularity that could identify an individual. Minimum reporting group size = 5. If a sub-group has fewer than 5 respondents, their data is included in the org-level aggregate but not reported as a sub-group.

---

### Instrument 2: Leadership Context Questionnaire (LCQ)

**Purpose:** To capture the leadership perspective — both the aspirational culture profile (what leaders believe the organisation stands for and wants to be) and strategic context that informs the matching algorithm.

**Respondents:** Senior leaders and hiring managers. Typically 3-10 people depending on org size.

**Structure:**

**Section A: Dimension Ratings (32 items)**
- 2 items per dimension × 16 dimensions = 32 items
- Same response scale as OPS Section A
- Items are reframed to capture what leaders believe the organisation is like, not what they aspire to. This is important — we want their perception, which we compare against the employee perception. The gap between OPS and LCQ scores on the same dimensions is itself a key output.

**Section B: Strategic Context (10-12 items)**
These items do not map to the 16 dimensions. They capture contextual information that helps weight which dimensions matter most for a specific hire.

- Organisational lifecycle stage: Startup/early stage / Growth / Mature / Turnaround or transformation
- Growth trajectory: Contracting / Stable / Moderate growth / Rapid growth
- Industry competitive intensity: Low / Moderate / High / Hypercompetitive
- Regulatory environment: Lightly regulated / Moderately regulated / Heavily regulated
- Current strategic priorities (multi-select): Revenue growth / Cost optimisation / Market expansion / Product development / People and culture / Digital transformation / M&A integration / Other
- Biggest capability gaps in current workforce (open text, 2-3 sentences)
- What has caused the most recent hires to fail or underperform? (open text, 2-3 sentences)

**Section C: Aspirational Culture (1 ipsative set)**
- Same format as OPS Section B, but asking leaders to distribute 100 points based on what they want the organisation to be, not what it currently is.
- This produces a "desired culture" profile to compare against the "actual culture" profile from the OPS.

**Total respondent burden:** ~8-10 minutes.

---

### Instrument 3: Role Environment Profile (REP)

**Purpose:** To capture the micro-context — the specific team, role demands, and leadership environment the candidate will enter. This is the role-level overlay on top of the organisational baseline.

**Respondents:** The hiring manager for the specific role (required) + 2-3 team members (optional but recommended).

**Structure:**

**Section A: Team-Level Dimension Ratings (16 items)**
- 1 item per dimension × 16 dimensions = 16 items
- Same response scale as OPS
- Items are reframed for the team/role context. Example:
  - OPS version: "This organisation moves quickly and priorities shift frequently." (Pace of Change, org-level)
  - REP version: "In this team, priorities can shift significantly within a given week." (Pace of Change, team-level)

**Section B: Role Demands (8-10 items)**
These items capture the specific demands of the role that influence which candidate capabilities matter most.

- Level of decision-making authority in this role: Very limited / Limited / Moderate / Significant / Extensive
- How defined vs. undefined is the scope of this role? (5-point scale: Highly defined to Highly undefined)
- How much does this role require working across teams/functions? (5-point scale)
- How much does this role require managing external stakeholders (clients, vendors, regulators)? (5-point scale)
- What is the expected ramp-up time to full productivity? Less than 1 month / 1-3 months / 3-6 months / 6-12 months / 12+ months
- What is the primary failure mode when someone doesn't work out in this role? (multi-select): Couldn't handle the pace / Struggled with ambiguity / Didn't fit the team / Couldn't navigate stakeholders / Lacked technical skill / Wasn't self-directed enough / Struggled with feedback / Other

**Section C: Hiring Manager Leadership Self-Report (4 items)**
- 1 item per Layer 4 dimension (Direction, Empowerment, Challenge, Support)
- These are the hiring manager's self-assessment of their own leadership style.
- Important: This is explicitly compared against the OPS Layer 4 scores to check for self-report inflation. The platform should surface the gap to the hiring manager as developmental feedback, but the matching algorithm should weight the employee-reported scores more heavily.

**Total respondent burden:** ~5-8 minutes.

---

## Scoring & Profile Output

### Dimension Scores

Each dimension produces a score on a 1-5 scale, calculated as the mean of the Likert items for that dimension, aggregated across respondents.

For Layer 1 (Culture), two types of scores are produced:
1. **Likert score** (1-5): The absolute level of each culture dimension.
2. **Ipsative score** (0-100%): The relative priority of each culture dimension, constrained to sum to 100% across the four culture dimensions.

The ipsative score is the more important one for matching, because it captures trade-offs — an organisation can't maximise everything simultaneously.

### Confidence Indicators

Every dimension score should carry a confidence level based on:
- Number of respondents
- Variance of responses (high variance = less consensus = lower confidence)
- Internal consistency (if alpha is low for a dimension, the items aren't measuring the same thing consistently)

Suggested confidence tiers:

| Tier | Criteria | Label | Use in Matching |
|------|----------|-------|-----------------|
| High | 15+ respondents, alpha ≥ .70, low variance | "Reliable" | Full weight in matching algorithm |
| Moderate | 8-14 respondents, alpha ≥ .60 | "Adequate" | Standard weight, slightly wider tolerance bands |
| Low | 5-7 respondents | "Indicative" | Reduced weight, wider tolerance bands, flagged in output |
| Insufficient | <5 respondents | "Insufficient data" | Excluded from matching. Dimension greyed out in profile. |

### Profile Visualisation

The organisational profile should be presented as a multi-dimensional visual — not a single score or ranking. Options:

1. **Radar/spider chart** with 16 axes (one per dimension), grouped by layer. This is the most common approach in organisational diagnostics (Denison uses a circular profile).
2. **Four separate bar charts**, one per layer, each showing the 4 dimensions in that layer.
3. **Heat map** showing all 16 dimensions with colour intensity mapped to score.

The most important visual output is the **profile shape** — the pattern across dimensions — not the absolute level of any one dimension. Two organisations can both have an average score of 3.5 and look completely different in shape.

### Gap Analysis

The platform should automatically compute and surface:

1. **OPS vs. LCQ gap:** For each dimension, the difference between the employee-reported score and the leader-reported score. Large gaps indicate misalignment between leadership's perception and employee reality.
2. **Actual vs. desired culture gap (Layer 1 only):** The difference between the OPS ipsative profile (actual culture) and the LCQ aspirational profile (desired culture). This tells the organisation where they want to shift their culture.
3. **OPS vs. REP gap:** For each dimension, the difference between the org-level score and the team-level score from the REP. This surfaces sub-cultural differences and ensures the matching algorithm uses the most relevant data.

---

## Assessment Lifecycle & Cadence

### Initial Setup (Baseline Assessment)

When an organisation first onboards to Trajectas:

1. **Organisation created** in the platform with basic metadata (name, industry, size, locations).
2. **OPS administered** to employees. This is the full 68-item survey.
3. **LCQ administered** to senior leaders (3-10 people).
4. **Organisational profile generated** once both instruments are complete and minimum sample sizes are met.
5. **Profile reviewed** with the client — surfacing key findings, gaps, and any surprises.

The baseline assessment is the prerequisite for using the matching functionality. Until it's complete, the organisation can still use Trajectas for standalone candidate assessments, but the matching algorithm is unavailable.

### Per-Role Assessment

Each time the organisation wants to hire for a specific role:

1. **REP administered** to the hiring manager (+ optional team members).
2. **Role-level profile generated** by overlaying the REP data on the organisational baseline.
3. **Matching algorithm activated** — the role-level profile is translated into a weighted competency requirement set, which is used to score candidates against.

The REP is lightweight enough (5-8 minutes) that it can be completed for every role without creating fatigue.

### Refresh Cadence

| Instrument | Frequency | Trigger for Off-Cycle Re-Administration |
|-----------|-----------|----------------------------------------|
| OPS | Annually | M&A, leadership change, restructuring, >30% headcount change |
| LCQ | Annually (aligned with OPS) | Leadership team turnover |
| REP | Per role | N/A — always fresh |

Optional: **Pulse survey** — a 10-12 item subset of the OPS covering the most volatile dimensions (Layer 2 Climate and Layer 3 Operating Environment), run quarterly. This keeps the profile current without full survey fatigue. The pulse results update the relevant dimension scores in the standing profile, with a time-decay weighting (more recent data weighted more heavily).

---

## Data Model Considerations

### Key Entities

The following entities will need to exist in the database to support this system:

- **Organisation:** The client organisation. Has metadata (name, industry, size, etc.) and is the parent entity for all profiles and assessments.
- **Organisational Profile:** A versioned snapshot of the organisation's dimensional scores. Linked to an organisation and a time period. Multiple profiles can exist over time.
- **Assessment Campaign:** An instance of administering a specific instrument (OPS, LCQ, or REP) to a group of respondents. Has a status (draft, active, closed), a start/end date, and is linked to an organisation.
- **Respondent:** An individual who takes a survey. Linked to a campaign. Stores demographic data (level, function, tenure) but NOT personally identifying information. Respondents are anonymous.
- **Response:** An individual item-level response. Linked to a respondent and a specific item. Stores the response value.
- **Dimension Score:** A computed score for a specific dimension, aggregated from responses. Linked to a profile and can be scoped to org-level, function-level, or team-level.
- **Role Profile:** A role-specific overlay on an organisational profile. Linked to both the organisation and a specific hiring assignment. Contains the REP data plus the computed role-level dimensional scores.

### Relationship to Existing Trajectas Entities

The existing Trajectas codebase has concepts for assessments, items, and responses. The organisational assessment system should:

- Use the existing assessment/item infrastructure where possible (the OPS, LCQ, and REP are themselves assessments composed of items).
- Extend the data model to support the concept of an "organisation" as a first-class entity that assessments can be linked to.
- Introduce the concept of a "profile" as a computed aggregate that sits above individual assessment responses.
- The "matching" layer (future) will sit between the organisational/role profile and the candidate assessment results.

---

## MVP vs. Full Build

### MVP (Build First)

The minimum viable version of this system that delivers value:

1. **One instrument only: the OPS.** Get the employee survey working end-to-end — item presentation, response collection, scoring, and profile output.
2. **Organisation-level profile only.** No sub-group analysis in MVP. Just compute the 16 dimension scores aggregated across all respondents.
3. **Basic profile visualisation.** A radar chart or bar chart showing the 16 dimensions, with confidence indicators.
4. **No matching algorithm.** The profile is informational — the client and their Leadership Quarter consultant use it to inform their assessment approach manually. The algorithmic matching comes later.

This MVP is already valuable as a standalone diagnostic tool — organisations can see their own profile, understand their culture and climate, and use it to inform hiring decisions even without automated matching.

### Phase 2

- Add the LCQ instrument and gap analysis (leader vs. employee perception).
- Add function/team-level sub-group analysis.
- Add the REP instrument for role-level profiling.

### Phase 3

- Build the matching algorithm: the translation layer from organisational/role profile to weighted competency requirements.
- Connect to the candidate assessment side: use the competency requirements to auto-select and weight assessments from the Trajectas item bank.
- Produce match scores: quantified fit between candidate profile and org+role profile.

### Phase 4

- Benchmarking database: as more organisations are profiled, build normative comparisons (percentile rankings against other organisations).
- Longitudinal tracking: compare profiles over time to show cultural change.
- Pulse survey capability.

---

## Implementation Guidance

The following decisions have been made. Where flexibility remains, Claude Code should evaluate the current codebase and choose the most elegant approach that fits with existing patterns.

---

### 1. Admin Flow: Organisation Setup

**Decision:** Admin-first. The platform admin (Jason, operating as the Leadership Quarter consultant) sets up organisations and manages the assessment process. Client self-service is a future goal, but the admin experience needs to be nailed first because there are multiple components to orchestrate.

**What the admin flow needs to support:**

1. **Create an organisation.** Capture metadata: name, industry, size, locations, key contacts. This is a new first-class entity in the system.

2. **Set up an assessment campaign.** Select which instrument(s) to administer (OPS, LCQ, REP), configure the campaign (name, dates, any custom messaging), and define the respondent list.

3. **Add respondents.** Enter respondent details: name, email, and — critically — their **respondent type** (see section below). The admin needs to be able to bulk-add respondents (CSV upload or paste) and individually add them.

4. **Distribute the survey.** Trigger email invitations with unique links. The admin should be able to see who has been invited, who has started, who has completed, and send reminders to non-completers.

5. **Monitor progress.** A campaign dashboard showing response rates, completion status, and whether minimum sample sizes have been met per respondent type.

6. **Close campaign and generate profile.** Once enough responses are in, the admin closes the campaign and the system computes the organisational profile. The profile should auto-generate but the admin should be able to review it before making it visible to the client.

7. **Manage multiple campaigns over time.** An organisation will have multiple campaigns (annual OPS, per-role REPs, etc.). The admin needs a clear view of an organisation's assessment history and current active campaigns.

**Design note for Claude Code:** Look at the existing assessment administration patterns in the codebase. The org admin flow will share many of the same UX patterns (creating things, managing lists of participants, tracking completion, viewing results) but at a higher level of abstraction. The goal is a clean, well-structured admin section — not rushed, because this is the interface the consultant will live in.

---

### 2. Respondent Types and Scoring Implications

**Decision:** Every respondent is assigned a type when they're added to a campaign. The type determines which instrument they receive and how their responses are weighted and aggregated in scoring.

**Respondent types:**

| Type | Instrument(s) | Scoring Role |
|------|--------------|--------------|
| **Employee** | OPS | Primary data source for all 16 dimensions. Responses aggregated to produce the ground-truth organisational profile. This is the largest group. |
| **Senior Leader** | LCQ | Produces the leadership perception profile. Responses aggregated separately from employees. Used for gap analysis (leader perception vs. employee reality). Also provides strategic context data. |
| **Hiring Manager** | LCQ + REP | Takes the LCQ as a senior leader, plus the REP for a specific role they're hiring for. Their REP responses produce the role-level profile. Their LCQ responses are included in the leader aggregate. |
| **Team Member** | REP (short version) | Takes a shortened version of the REP to provide team-level perspective on the role environment. Their responses are aggregated with the hiring manager's REP data to produce the team/role profile. |

**Why this matters:** The system needs to know what type each respondent is before they take the survey, because:
- It determines which instrument they see (different item sets for OPS vs. LCQ vs. REP).
- It determines how their responses are scored — employee responses feed into the organisational profile; leader responses feed into a separate leader profile; hiring manager and team member responses feed into the role profile.
- It enables the gap analysis between layers (the system can compare "what employees reported" vs. "what leaders reported" on the same dimensions).

**How respondent types connect to links:** Each respondent gets a unique link via email. The link encodes (or resolves to) their respondent record, which includes their type. When they click the link and land on the survey, the system knows what instrument to serve them and how to score their responses. They don't need to create an account or log in — the unique link is their authentication. But the system tracks their identity on the backend for completion monitoring and scoring aggregation.

**Important:** Respondent identity is tracked for operational purposes (who completed, reminder emails, scoring aggregation by type) but is never exposed in profile outputs. Individual responses are anonymous in all reporting. The admin can see who completed and who didn't, but cannot see any individual's responses.

---

### 3. Distribution: Email with Unique Links

**Decision:** Survey distribution is via email with a unique link per respondent. No shared links.

**Flow:**

1. Admin adds respondents to a campaign (with name, email, and type).
2. Admin triggers invitation emails. Each email contains:
   - Brief context about what the survey is and why they're being asked to complete it (configurable per campaign — the admin should be able to customise the email message).
   - A unique link that authenticates the respondent and serves them the correct instrument.
   - Estimated completion time.
3. The unique link takes the respondent directly to the survey — no login, no account creation, no friction. They land on the first page of the survey and can begin immediately.
4. Responses auto-save as they progress (so they can close the browser and return via the same link to continue where they left off).
5. Admin can see completion status and send reminder emails to non-completers (either individually or in bulk).

**Email sending:** Claude Code should evaluate the best approach for the current stack. Options include Supabase Edge Functions with a transactional email service (Resend, SendGrid, Postmark), or a simpler approach if the codebase already has email infrastructure. The emails don't need to be fancy — clean, professional, and functional.

**Unique link structure:** The link should resolve to a respondent-specific token (not just an ID in the URL — use a UUID or similar non-guessable token). The token maps to the respondent record, which contains their type, campaign, and organisation. This means the survey page can be a single route that dynamically serves the correct instrument based on the respondent's type.

---

### 4. UI: Separate Organisational Diagnostics Section

**Decision:** This is a separate section in the Trajectas UI, not embedded within the existing assessment builder. It needs its own top-level navigation entry — something like "Organisations" or "Org Diagnostics" alongside whatever navigation structure currently exists.

**Key pages/views in this section:**

1. **Organisations list.** All organisations that have been set up, with key metadata (name, industry, size) and status (active campaign, last assessed date, profile available).

2. **Organisation detail view.** For a specific organisation:
   - Overview: metadata, key contacts, assessment history.
   - **Campaigns tab:** All campaigns (past and active) for this organisation. Each campaign shows its instrument type, dates, response rates, and status.
   - **Profile tab:** The current organisational profile — the 16-dimension visualisation with confidence indicators. This is the main output view. If multiple campaigns have been completed over time, show the most recent profile with the option to compare against earlier ones.
   - **Gap Analysis tab** (Phase 2): The computed gaps between employee and leader profiles, and between actual and desired culture.
   - **Roles tab** (Phase 2+): Role profiles created via the REP, linked to specific hiring assignments.

3. **Campaign management view.** For a specific campaign:
   - Respondent list with type, invitation status, completion status.
   - Add/edit/remove respondents.
   - Send invitations and reminders.
   - Campaign settings (dates, email messaging).
   - Response rate dashboard.

4. **Survey-taking view.** The respondent-facing page — this is what people see when they click their unique link. It should be clean, professional, and mobile-friendly. The Trajectas brand should be visible but the experience should feel neutral and trustworthy (respondents are providing honest feedback about their organisation — the UI shouldn't feel corporate or evaluative). This view is separate from the admin section and should have its own route structure.

**Design note for Claude Code:** Look at how the existing assessment-taking experience is built in the codebase. The survey-taking view for the OPS/LCQ/REP will share many patterns with the existing candidate assessment experience — presenting items, collecting responses, tracking progress, handling auto-save. The difference is that the respondent arrives via a unique link rather than through the platform's normal auth flow, and the instrument they see is determined by their respondent type rather than by an assessment they were assigned to. Evaluate what can be reused vs. what needs to be built fresh, and choose the approach that creates the least duplication while keeping the organisational side cleanly separated.

---

### 5. Roles and Projects: New Concepts Needed

**Decision:** The current codebase does not have a concept of a "role" or "project" in the hiring sense. This needs to be created.

**What's needed:**

A **Role** (or "Hiring Assignment" — Claude Code should choose the best terminology that fits the existing domain language) is a specific position that the organisation is hiring for. It is:
- Linked to an organisation.
- Linked to a specific REP campaign (which produces the role-level profile).
- Eventually linked to candidate assessments and match scores (Phase 3).

A Role has:
- Title (e.g., "Head of Product," "Senior Engineer").
- Department/function.
- Hiring manager (links to a respondent of type "Hiring Manager").
- Status (open, filled, closed).
- The role-level profile (computed from REP data).

**For MVP:** The Role concept doesn't need to be fully built out, since the REP is Phase 2. But the data model should be designed with it in mind so that the Organisation entity can eventually contain Roles. If it's natural to stub out the Role entity now, do so. If it creates unnecessary complexity for MVP, defer it — but document the intended relationship.

---

### 6. Item Authoring: Replicate the Assessment Builder Pattern

**Decision:** The OPS, LCQ, and REP items should be built using a pattern similar to the existing assessment builder and item bank, but adapted for the organisational side. This keeps the architecture consistent across the platform.

**How this should work:**

- There should be an **organisational item bank** — a library of items tagged by dimension (which of the 16 dimensions the item measures) and instrument (OPS, LCQ, or REP).
- Each instrument (OPS, LCQ, REP) is composed by selecting items from this bank, similar to how candidate assessments are composed from the existing item bank.
- For MVP, the items can be seeded directly into the database (we'll write them and load them in). The admin doesn't need a UI for authoring new organisational items in MVP — that can come later.
- The item bank structure should support:
  - Item text (the statement the respondent sees).
  - Dimension mapping (which of the 16 dimensions this item belongs to).
  - Layer mapping (which of the 4 layers — useful for filtering and organisation).
  - Instrument mapping (OPS, LCQ, REP, or multiple).
  - Response format (Likert 5-point, ipsative 100-point distribution, multiple choice, open text).
  - Reverse-keying flag (whether the item is scored in reverse for its dimension).
  - Item version/status (draft, active, retired — for future iteration on items without breaking historical data).

**Design note for Claude Code:** Look at the existing item bank and assessment builder patterns in the codebase. The organisational item bank will be simpler — fewer item types, no complex branching logic, no adaptive testing. But it should follow the same structural conventions (table naming, relationships, status management) so the codebase feels cohesive. The key architectural question is whether the organisational items live in the same tables as candidate assessment items (with a type/category discriminator) or in parallel tables. Evaluate which approach is cleaner given the current schema. Parallel tables are probably cleaner because the scoring logic and aggregation model are fundamentally different (organisational items aggregate across respondents to produce a group-level profile; candidate items produce an individual-level score).

---

### 7. Scoring Pipeline

**How responses become a profile:**

1. **Item-level responses** are stored as they come in (auto-save during survey completion).
2. When a campaign is closed (or on-demand by the admin), the **scoring pipeline** runs:
   a. Group responses by respondent type (Employee, Senior Leader, Hiring Manager, Team Member).
   b. For each respondent group, compute the **mean score per dimension** across all respondents in that group, using only the Likert items.
   c. For Layer 1 (Culture) ipsative items, compute the **mean proportional allocation** per culture dimension across respondents.
   d. Compute **confidence indicators** per dimension: number of respondents, standard deviation, and internal consistency (Cronbach's alpha if 4+ items per dimension, which the OPS has).
   e. Assign confidence tiers (Reliable / Adequate / Indicative / Insufficient) based on the criteria defined in the Scoring section above.
3. The computed scores are stored as a **profile snapshot** — a versioned, timestamped record of all 16 dimension scores plus confidence data, linked to the organisation and the campaign that produced it.
4. The profile snapshot is what gets displayed in the Profile tab and what the matching algorithm (future) reads from.

**Reverse-keyed items:** Items flagged as reverse-keyed are scored inversely (1→5, 2→4, 3→3, 4→2, 5→1) before aggregation. This is standard psychometric practice and should be handled in the scoring pipeline, not at the item display level (the respondent sees the item as written; the reversal happens in scoring).

**Handling incomplete responses:** If a respondent completes some but not all items, their completed items should still be included in the aggregation. Don't discard partial responses — every data point helps, especially with small samples. The confidence indicators will naturally reflect the reduced data.

---

## Summary

Trajectas's organisational assessment system measures organisations across 16 dimensions in 4 layers using 3 instruments, producing a structured profile that will ultimately power a person-organisation matching algorithm. The system is designed for small-to-medium sample sizes (5-40 respondents typically), produces confidence-graded output, and supports three levels of profile granularity (organisation, function/team, role).

The admin sets up organisations, adds respondents with assigned types, and distributes surveys via email with unique links. Respondent type determines which instrument is served and how responses are scored. The organisational diagnostics section is a separate area of the Trajectas UI with its own navigation, organisation management, campaign tracking, and profile visualisation. Items are stored in an organisational item bank following patterns similar to the existing assessment builder.

The MVP starts with the OPS instrument and org-level profile. The LCQ, REP, role-level profiling, gap analysis, matching algorithm, and benchmarking database layer on in subsequent phases.
