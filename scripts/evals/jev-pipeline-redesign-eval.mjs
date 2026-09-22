/* eslint-disable @typescript-eslint/no-unused-vars -- research harness: keeps the alternative prompt/question variants that were tried, for re-runs */
import fs from 'node:fs'
/**
 * Pipeline-redesign evaluation: how to use Jev better for competency matching.
 *
 * Reference = a three-model expert panel (Opus 5, GPT-5.6 Terra, Grok 4.7) scoring all
 * 25 factors from the raw PD, scores only, consensus by mean z-score. Every ranker
 * (production Sonnet, Haiku, and Jev variants V0–V5) is measured against the panel
 * and against Sonnet. Also times/costs Haiku brief extraction and Haiku reasoning for
 * the top 8, to price the proposed pipeline end to end.
 *
 *   node --env-file=.env.local scripts/evals/jev-pipeline-redesign-eval.mjs
 *   node scripts/evals/jev-pipeline-redesign-eval.mjs --report   # tables from saved JSON
 * Optional: REAL_PD_FILE=<path> adds the real Accountant build (PD text kept out of the repo).
 */
const S = new URL('.', import.meta.url).pathname.replace(/\/$/, '')
const key = process.env.OpenRouter_API_KEY
if (!key) { console.error('OpenRouter_API_KEY is not set (run with node --env-file=.env.local)'); process.exit(1) }
const factors = JSON.parse(fs.readFileSync(`${S}/jev-factors-full.json`, 'utf8'))
const H = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://trajectas.com', 'X-Title': 'Trajectas' }

// ---- Prod prompts, verbatim ----
const BRIEF_SYS = `You are an I-O psychology assistant for the Trajectas Assessment Architect.

You read free text about a role — a pasted or uploaded position description, or a short typed description — together with the decision the user is making, and you extract a single structured "brief" that a downstream matcher will use to select assessment factors.

Return ONLY a JSON object (no Markdown, no code fences, no commentary) with exactly this shape:

{
  "role_title": string,                  // best inference of the role title; "" if genuinely unclear
  "level": "ic" | "first_line_manager" | "mid_manager" | "senior_leader" | "executive",
  "function": string,                    // job family, e.g. "sales", "engineering", "operations"; "" if unclear
  "outcome": "selection" | "development" | "team_composition",
  "outcome_intent": string,              // the user's stated decision verbatim, e.g. "succession planning"
  "responsibilities": string[],          // 3-7 concise bullets drawn from the source
  "context_signals": string[],           // e.g. "fast-growth startup", "matrixed org", "regulated industry"
  "technical_requirements": string[],    // domain/technical skills explicitly mentioned
  "confidence": "high" | "medium" | "low" // how well the input supported a useful brief
}

Rules:
- Infer \`level\` from scope, reports, and seniority language; default to "mid_manager" only when there is genuinely no signal.
- \`outcome\` is the coarse stored category. Map the user's stated decision onto it: hiring / promotion / succession -> "selection"; development planning / coaching -> "development"; team build / balance -> "team_composition". Preserve the user's exact words in \`outcome_intent\`.
- Do not invent responsibilities or requirements that are not supported by the input. Fewer accurate bullets beat more speculative ones.
- Set \`confidence\` to "low" when the input is too thin to extract a meaningful brief (e.g. a single vague sentence). The caller may ask the user for more.
- Output valid JSON only.`

const MATCH_SYS = `You are an expert organisational psychologist and psychometric assessment designer working within the Trajectas platform.

Your task is to read a signal describing what matters for a role or organisation, then determine which factors from a given pool are most relevant for inclusion in a psychometric assessment.

You will be given ONE of two kinds of signal:

- A **diagnostic profile** — dimension scores for an organisation. Higher scores indicate stronger capability; lower scores indicate development needs. A factor is relevant when it either addresses a development need or sustains a key strength.
- A **role brief** — a structured description of a role (title, level, function, responsibilities, context, requirements) and the decision being made. A factor is relevant when measuring it meaningfully informs that decision for that role.

## Instructions

1. **Read the signal.** Identify the priorities it implies — for a diagnostic, the strengths and gaps; for a brief, what genuinely differentiates success in the role given its level, function, and the stated decision (outcome_intent).
2. **Evaluate each factor** in the pool for relevance to those priorities. Respect the role's level — do not rank factors that suit a different level highly.
3. **Rank by relevance.** Assign each factor a relevanceScore from 0 to 100, order most to least relevant, and include only factors with meaningful relevance (relevanceScore >= 20).
4. **Explain each pick** in 1–3 sentences, referencing the specific signal (a dimension pattern, or a responsibility / context / the stated decision). Ground the reasoning in the brief's outcome_intent when one is given.
5. **Calculate incremental value.** For each factor, give incrementalValue (0–100) and cumulativeValue (0–100). The first factor has the highest incremental value; each subsequent one adds progressively less unique measurement value (avoid ranking two near-duplicate factors both highly).
6. **Recommend assessment size.** Provide minimum, optimal, and maximum factor counts based on the diminishing-returns curve.

## Output format

Return ONLY valid JSON with this exact structure:

{
  "rankings": [
    {
      "factorId": "<string>",
      "factorName": "<string>",
      "rank": <number>,
      "relevanceScore": <number 0-100>,
      "reasoning": "<string>",
      "incrementalValue": <number 0-100>,
      "cumulativeValue": <number 0-100>
    }
  ],
  "summary": "<1-3 sentence overview of the matching rationale>",
  "recommendedCount": {
    "minimum": <number>,
    "optimal": <number>,
    "maximum": <number>
  }
}`

// ---- Test roles (synthetic PDs, AU flavour) ----
const ROLES = [
{ name: 'Regional Sales Director', expected: 'senior_leader', pd: `Regional Sales Director, ANZ — B2B SaaS (Series D, 900 staff globally)

Reporting to the Chief Revenue Officer, the Regional Sales Director owns new-business and expansion revenue across Australia and New Zealand, currently A$62M ARR with a growth target of 35% year on year. You lead four Sales Managers and, through them, a team of roughly forty Account Executives and SDRs spread across Sydney, Melbourne and Auckland.

Key accountabilities:
- Own the regional revenue plan, pipeline coverage and forecast accuracy; present the forecast to the CRO and CFO monthly and to the board quarterly.
- Hire, coach and performance-manage the Sales Manager layer; build a bench of future managers.
- Set territory design, quota allocation and comp plan inputs in partnership with Rev Ops and Finance.
- Personally sponsor the region's top 15 enterprise accounts, joining executive-level negotiations and renewals.
- Partner with Marketing, Customer Success and Product on regional GTM priorities; represent ANZ customer needs in the global roadmap process.
- Lead the region through a shift from seat-based to consumption-based pricing over the next 18 months.

About you:
- 10+ years in B2B software sales including at least 4 years leading second-line sales teams.
- Track record of consistently exceeding regional targets of A$40M+.
- Comfortable operating in a matrixed, US-headquartered organisation with frequent change to targets, tooling and org structure.
- Experience selling into financial services and public sector highly regarded.` },
{ name: 'Customer Service Team Leader', expected: 'first_line_manager', pd: `Team Leader — Customer Care (Contact Centre), Energy Retailer, Adelaide

We are looking for a Team Leader to lead a team of 12–14 Customer Care Consultants handling inbound billing, hardship and account enquiries by phone, chat and email. The centre operates 7am–9pm Monday to Saturday on a rotating roster.

What you will do:
- Lead the daily huddle, manage the roster and real-time queue adherence, and step in on escalated or distressed customers.
- Coach each consultant fortnightly using call recordings and quality scores; run monthly one-on-ones and formal performance conversations where needed.
- Own team KPIs: average handle time, first-contact resolution, NPS, quality assurance and adherence, and report weekly to the Operations Manager.
- Handle complaints escalated to the Energy and Water Ombudsman within regulated timeframes and support consultants through hardship-program conversations.
- Identify process and knowledge-base gaps and raise them with the Continuous Improvement team.
- Support onboarding of new starters from the training academy and their first 90 days on the floor.

What you bring:
- 2+ years in a contact centre with at least 12 months of informal or formal leadership (2IC, senior consultant, acting team leader).
- Calm and steady under pressure; you can hold a difficult conversation with a customer and then with a team member in the same hour.
- Familiarity with energy retail regulation (NECF, hardship obligations) preferred but not essential.` },
{ name: 'Chief Financial Officer', expected: 'executive', pd: `Chief Financial Officer — ASX 300 industrial services group (~A$900M revenue, 4,000 employees)

The CFO is a member of the Group Executive, reports to the Managing Director and CEO, and works closely with the Board and its Audit & Risk Committee. The group operates across three divisions in Australia and New Zealand and is mid-way through a capital-recycling program and an ERP consolidation.

Accountabilities:
- Lead Group Finance (c. 120 people): financial control, statutory and ASX reporting, tax, treasury, FP&A, procurement, and investor relations.
- Own the group's capital allocation framework, balance sheet strategy, debt facilities and credit-rating relationships.
- Partner with the CEO on portfolio strategy, including acquisitions and divestments; lead due diligence and integration finance workstreams.
- Present to the Board, Audit & Risk Committee and investors; act as a primary spokesperson to the market alongside the CEO.
- Uplift the finance function's data and systems capability through the ERP consolidation while maintaining control integrity.
- Set the tone on ethics, controls and risk appetite across the group.

Experience:
- Proven CFO or Deputy CFO of a listed company, or a divisional CFO of a large complex group, with direct Board and market-facing exposure.
- Substantial M&A and capital-markets experience.
- Track record of building and developing high-performing finance leadership teams through significant change.` },
{ name: 'Senior Software Engineer', expected: 'ic', pd: `Senior Software Engineer — Payments Platform, fintech (Melbourne, hybrid)

You will join a product engineering squad of six building and operating our real-time payments and ledger services (TypeScript, Go, Postgres, Kafka, AWS). We process around 3 million transactions a day for 400 merchant customers, with strict availability and reconciliation obligations under our AFSL and scheme rules.

You will:
- Design, build, test and operate services end to end, including on-call participation in a follow-the-sun rotation.
- Lead technical design for medium-sized initiatives, write design docs, and review the code of peers and more junior engineers.
- Work with product managers and compliance to translate scheme rule changes and regulatory requirements into safe, well-tested implementations.
- Improve reliability and observability; run blameless post-incident reviews.
- Mentor two mid-level engineers, without formal people management responsibility.

You have:
- 6+ years of professional software engineering experience, including distributed systems in production.
- Strong judgement about trade-offs between speed, safety and simplicity in a regulated payments environment.
- Clear written communication; you can explain a design and its risks to an engineer and to a compliance officer.` },
{ name: 'Nurse Unit Manager', expected: 'mid_manager', pd: `Nurse Unit Manager — 32-bed Acute Medical Ward, metropolitan public hospital

The Nurse Unit Manager (NUM) is accountable for the clinical, operational and people leadership of the ward on a 24/7 basis. The ward has approximately 55 nursing and support staff including Associate Nurse Unit Managers who coordinate each shift. The NUM reports to the Director of Nursing for the Medical Division and works closely with medical heads of unit and allied health.

Responsibilities:
- Lead safe, high-quality patient care: monitor clinical indicators (falls, pressure injuries, medication incidents), lead incident reviews and drive improvement plans.
- Manage the ward budget (c. A$9M), rostering, skill mix, agency use and leave liability within targets.
- Recruit, develop and retain staff; supervise the ANUMs and support them to lead their shifts; manage performance and conduct matters in line with the enterprise agreement.
- Lead the ward through the introduction of a new electronic medical record and a model-of-care change moving to team-based nursing.
- Manage escalations from patients and families, and liaise with the Patient Liaison Office on complaints.
- Contribute to divisional planning and accreditation (NSQHS Standards) readiness.

Selection criteria:
- Registered Nurse with current AHPRA registration and postgraduate qualification in management or a clinical specialty.
- Demonstrated experience leading nursing teams at ANUM or NUM level in an acute setting.
- Demonstrated ability to manage competing priorities, change and budget constraints while sustaining staff engagement.` },
{ name: 'Graduate Policy Analyst', expected: 'ic', pd: `Graduate Policy Analyst — State Government Department of Treasury and Finance (12-month graduate program, ongoing role on completion)

As a graduate you will rotate through two policy branches, contributing to briefs, costings and options papers on matters going to the Treasurer and Cabinet. Work is fast-paced around the budget cycle and frequently involves incomplete information and tight ministerial deadlines.

You will:
- Research and analyse policy issues, gather and interpret data, and prepare clear written briefs and ministerial correspondence.
- Contribute to costings and financial modelling of policy proposals with guidance from senior analysts.
- Consult with other departments and agencies to gather input and test proposals.
- Take direction from multiple senior staff and manage competing deadlines.
- Participate in the graduate development program, including presenting your project work to the executive.

We are looking for:
- A recent degree in economics, public policy, law, finance or a related discipline.
- Strong written communication and the ability to summarise complex material for a non-specialist audience.
- Curiosity, willingness to ask questions, and the ability to take feedback and learn quickly.
- Comfort working with numbers and spreadsheets.` },
]

const LEVELS_A = ["Not relevant: measuring this would tell us little about success in this role","Marginal: occasionally useful but not a differentiator","Useful: contributes to performance in this role","Important: a clear driver of success in this role","Critical: among the few things that most separate strong from weak performers in this role"]
const LEVELS_A2 = ["Skip it: a hiring panel would not care how a candidate scores on this for this role","Nice to know: low weight in the hiring decision","Relevant: a panel would want to see this measured","High priority: weak scores here would be a serious concern for this role","Essential: this is one of the defining requirements of the role"]
const LEVEL_CRITERIA = { ic: 'Individual contributor with no direct reports', first_line_manager: 'Manages a team of individual contributors', mid_manager: 'Manages managers or a function', senior_leader: 'Leads a division or major business unit', executive: 'C-suite or equivalent enterprise leadership' }
const keyOf = f => f.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()
const byKey = Object.fromEntries(factors.map(f => [keyOf(f), f]))

async function post(url, body) {
  const t0 = performance.now()
  const res = await fetch(url, { method: 'POST', headers: H, body: JSON.stringify(body) })
  const text = await res.text()
  const ms = Math.round(performance.now() - t0) // after the body: OpenRouter sends headers long before a non-streamed completion finishes
  let json; try { json = JSON.parse(text) } catch { json = { raw: text } }
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}: ${text.slice(0, 300)}`)
  return { ms, json }
}
const jev = body => post('https://openrouter.ai/api/alpha/decisions', { model: 'typesafe/jev-1.13', ...body })
const sonnet = (system, user, temperature, max_tokens) => post('https://openrouter.ai/api/v1/chat/completions', { model: 'anthropic/claude-sonnet-4-5', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature, max_tokens, response_format: { type: 'json_object' } })
const parseJson = s => { let c = s.trim(); const m = c.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/); if (m) c = m[1].trim(); try { return JSON.parse(c) } catch { return JSON.parse(c.slice(c.indexOf('{'), c.lastIndexOf('}') + 1)) } }
const SONNET_IN = 3e-6, SONNET_OUT = 15e-6

function briefSignal(b) {
  const list = items => items.length ? items.map(i => `- ${i}`).join('\n') : '- (none stated)'
  return `## Role brief\n\n- **Role title:** ${b.roleTitle || '(unspecified)'}\n- **Level:** ${b.level}\n- **Function:** ${b.function || '(unspecified)'}\n- **Decision (outcome):** ${b.outcome}\n- **Stated intent:** ${b.outcomeIntent || b.outcome}\n\n### Responsibilities\n${list(b.responsibilities)}\n\n### Context signals\n${list(b.contextSignals)}\n\n### Technical requirements\n${list(b.technicalRequirements)}`
}
function matchUser(brief, pool) {
  const fs_ = pool.map(f => `- **${f.name}** (${f.id})\n  ${f.definition}`).join('\n')
  return `${briefSignal(brief)}\n\n## Available factors\n\n${fs_}\n\nAnalyse the signal above, then rank the factors by relevance. Return your answer as JSON following the schema described in the system prompt.`
}
function scoreQs(pool, levels, decision) { const q = {}; for (const f of pool) q[keyOf(f)] = { type: 'score', instructions: `The state describes a role and the decision being made (${decision}). How relevant is it to measure the competency "${f.name}" in a psychometric assessment used for this decision about this role? Competency definition: ${f.definition}`, criteria: levels }; return q }
function noulQs(pool, decision) { const q = {}; for (const f of pool) q[keyOf(f)] = { type: 'noul', instructions: `Should the competency "${f.name}" be included in a psychometric assessment used for ${decision} into this role? Include it only if it genuinely differentiates success in this specific role. Definition: ${f.definition}`, criteria: { true: 'Measuring this competency clearly informs the hiring decision for this role', false: 'This competency is generic, peripheral, or better suited to a different level or kind of role' } }; return q }

function spearman(orderA, orderB) { // arrays of names, full pools; missing in A -> tied at bottom
  const all = [...new Set([...orderA, ...orderB])]
  const rankOf = order => { const r = {}; order.forEach((n, i) => { r[n] = i + 1 }); const missing = all.filter(n => !(n in r)); const tie = order.length + (missing.length + 1) / 2; missing.forEach(n => { r[n] = tie }); return r }
  const ra = rankOf(orderA), rb = rankOf(orderB); const n = all.length
  const d2 = all.reduce((s, x) => s + (ra[x] - rb[x]) ** 2, 0)
  return 1 - 6 * d2 / (n * (n * n - 1))
}
const overlap = (a, b, k) => a.slice(0, k).filter(x => new Set(b.slice(0, k)).has(x)).length

// ---------------- roles: six more, plus the real build when REAL_PD_FILE is set ----------------
ROLES.push(
{ name: 'HR Business Partner', expected: 'ic', pd: `HR Business Partner — national logistics company, 2,500 employees (Brisbane, hybrid)

Partnering with the General Manager Operations and their leadership team (c. 900 staff across depots and a contact centre), the HRBP is the senior people adviser for the division. No direct reports; you draw on the HR centres of excellence (talent, reward, ER, L&D) and a shared-services team.

Accountabilities:
- Coach depot managers and team leaders through performance, conduct and capability matters; handle complex employee-relations cases under the enterprise agreement, including union consultation and Fair Work matters.
- Lead the annual workforce planning, talent review and succession process for the division and translate it into hiring and development plans.
- Use HR analytics (turnover, absence, engagement, safety) to diagnose issues and put evidence-based proposals to the GM.
- Drive the division's engagement action plans and the roll-out of a new leadership framework.
- Partner with the safety team on a culture program following two serious incidents last year.

You bring:
- 5+ years generalist HR with genuine ER depth in a unionised, blue-collar environment.
- Credibility with operational leaders: you can hold your ground with a depot manager, then help them land a hard message with their team.
- Comfort with data and a habit of testing what people say against what the numbers show.` },
{ name: 'Warehouse Shift Supervisor', expected: 'first_line_manager', pd: `Shift Supervisor — Afternoon Shift, 3PL Distribution Centre (Truganina, VIC)

Lead a team of 22 pickers, packers and forklift operators on the 2pm–10pm shift in a 40,000 m² ambient DC serving a national retail client. Report to the DC Operations Manager.

What you will do:
- Run the shift: allocate labour to inbound, pick, pack and dispatch waves against the daily plan; hit throughput, accuracy (>99.7%) and dispatch cut-off targets.
- Own safety on the floor: pre-start briefings, forklift and traffic-management compliance, incident reporting and investigation, and stopping work when something is unsafe.
- Manage attendance, breaks, overtime and agency top-ups within budget; keep the roster fair and the team's fatigue in check.
- Coach and performance-manage team members; run toolbox talks; onboard casuals during peak.
- Handle the shift's problems as they come: WMS glitches, late trucks, damaged stock, short-staffed lines, a client escalation at 9pm.
- Hand over cleanly to the night shift with an accurate picture of what is done and what is not.

What you bring:
- 3+ years in a DC or manufacturing environment, with at least a year as a 2IC, leading hand or supervisor.
- Current forklift licence; familiarity with WMS and RF scanning.
- Calm, fair and direct with people; able to make quick decisions when the plan breaks.` },
{ name: 'Head of Product', expected: 'mid_manager', pd: `Head of Product — consumer fintech app (Sydney), 2.1M customers, Series C

Reporting to the Chief Product Officer, you lead the Money Management product group: four Product Managers and, through them, three cross-functional squads (engineering, design, data, ~35 people). The group owns budgeting, savings goals and the transaction-insights features that drive engagement and cross-sell.

You will:
- Set the group's product strategy and quarterly roadmap in line with company OKRs; defend trade-offs with the CPO, CTO and CFO.
- Hire, coach and grow the PMs; raise the bar on discovery, experimentation and writing.
- Own the group's outcome metrics (weekly active users, feature adoption, cross-sell conversion) and be accountable for moving them.
- Run a disciplined discovery-to-delivery process across three squads without slowing them down.
- Represent the group to the executive, to compliance (design-and-distribution obligations), and to key partners.
- Lead the response when a launch underperforms or a regulator asks questions.

You have:
- 7+ years in product, including 2+ years managing PMs in a consumer app at scale.
- A track record of moving engagement metrics through experimentation, and of killing your own ideas when the data says so.
- Strong commercial sense: you understand how the app makes money and where the group's features fit.` },
{ name: 'Data Scientist', expected: 'ic', pd: `Data Scientist — Pricing & Risk, general insurer (Melbourne, hybrid)

Join a team of eight data scientists and actuaries supporting motor and home pricing. You will report to the Lead Data Scientist and work day to day with pricing actuaries, underwriters and the data engineering team.

Responsibilities:
- Build, validate and document predictive models (GLM, GBM) for risk pricing and claims propensity; monitor model performance in production and recommend refreshes.
- Run analyses on portfolio performance, competitor pricing and customer behaviour, and present findings to pricing committees and underwriting leads.
- Work with data engineers to productionise features and models on the cloud data platform.
- Contribute to the model-governance process, including documentation for APRA and internal model risk review.
- Mentor graduates and share techniques across the team.

Requirements:
- Degree in statistics, mathematics, actuarial studies or similar; 3+ years applying statistical and machine-learning methods to real business problems.
- Strong Python or R and SQL; experience with model deployment and monitoring preferred.
- Able to explain a model and its limitations to a non-technical committee, and to push back when a result is being over-interpreted.
- Insurance or financial services experience an advantage.` },
{ name: 'Senior Project Manager (Construction)', expected: 'mid_manager', pd: `Senior Project Manager — Commercial Construction, Tier 2 builder (Perth)

Lead the delivery of a $180M health-precinct project from early works through to practical completion (34 months). You manage a site team of three Site Supervisors, two Contract Administrators and a Project Engineer, plus 40+ subcontract packages, and report to the Construction Manager.

Key responsibilities:
- Own program, cost and quality: set and hold the master program, manage the budget and forecast to completion, and run monthly cost reports to the Construction Manager and the client's superintendent.
- Lead procurement and administration of subcontract packages; negotiate variations, extensions of time and claims.
- Chair client, consultant and subcontractor meetings; manage the relationship with the client's project team and the head consultant.
- Drive safety and quality culture on site; ensure compliance with the safety management system and the building code.
- Lead, develop and hold accountable the site team; resolve disputes between the site and the design team.
- Anticipate and resolve program risks — long-lead items, design changes, weather, industrial issues.

Experience:
- 10+ years in commercial construction with at least two projects over $80M delivered as PM.
- Strong commercial and contractual skills (design-and-construct contracts, claims).
- Composure and decisiveness when the program is under pressure.` },
{ name: 'Hotel General Manager', expected: 'senior_leader', pd: `General Manager — 280-room upscale hotel with conference centre, Gold Coast (international operator, managed property)

Full P&L accountability for a A$48M revenue property with 210 staff across rooms, food and beverage (three outlets), events, spa, engineering and back of house. You lead an executive committee of seven department heads and report to the Regional Vice President; the owner's asset manager reviews performance monthly.

Accountabilities:
- Deliver the annual budget: RevPAR, GOP margin, guest satisfaction and employee engagement targets; present monthly to the owner.
- Set and drive the commercial strategy with the Director of Sales & Marketing and Revenue Manager, in a market with two new competitor openings in the next 18 months.
- Lead, develop and hold accountable the executive committee; own succession for department-head roles.
- Own the guest experience and brand standards; personally handle escalated guest and owner issues.
- Lead a $12M rooms renovation with minimal disruption to operations.
- Represent the hotel with the owner, the brand, tourism bodies and key corporate accounts.

Experience:
- Prior General Manager or Hotel Manager experience in a 200+ room full-service hotel; strong F&B and events background.
- Demonstrated commercial results in a competitive market and experience managing an owner relationship.
- A visible, energetic leader who is on the floor with staff and guests.` },
)
if (process.env.REAL_PD_FILE) ROLES.unshift({ name: 'Accountant (REAL build)', expected: 'ic', pd: fs.readFileSync(process.env.REAL_PD_FILE, 'utf8'),
  brief: {"level":"ic","outcome":"selection","function":"finance","roleTitle":"Accountant","outcomeIntent":"selection","contextSignals":["Health insurance industry","Regulated industry (APRA prudential standards)","Board reporting requirements","12 month contract position","Member service organization","Privacy Act and compliance-focused environment"],"responsibilities":["Prepare financial and management reporting, analysis, accruals, provisions, prepayments, budgets and forecasts","Assist Finance Manager in preparing statutory financial accounts and notes for Board approval","Undertake bank and general ledger account reconciliations as directed","Process accounts payable and receivable functions and backup other accounting functions as required","Complete statutory and regulatory compliance activities including APRA quarterly/annual reporting, ambulance levies, and BAS returns","Process period end journals including accruals, prepayments and fixed asset entries","Provide information and assistance to external auditor, appointed actuary, internal auditor and third parties"],"technicalRequirements":["Degree qualification in accounting or equivalent","2+ years accounting experience","CPA/CA qualification or working towards","Advanced Excel and Microsoft Office proficiency","Financial and management reporting preparation","Statutory accounts preparation","General ledger reconciliations","APRA regulatory reporting","BAS and tax compliance","Fixed asset register maintenance"],"confidence":"high"},
  sonnetOrder: ["Analytical Thinking","Process Discipline","Execution (Implementation)","Organisation","Critical Analysis (Evaluation)","Communication","Flexibility","Collaboration (Teamwork)","Judgement","Resilience","Learning Agility","Decision Prioritisation","Self-Insight","Emotional Regulation","Interpersonal Sensitivity","Visible Self-Development","Building Relationships","Achievement Drive","Performance Tenacity"], sonnetCost: 3180 * 3e-6 + 2924 * 15e-6, sonnetMs: 45000 })

// ---------------- models, prompts ----------------
const PANEL = [['anthropic/claude-opus-5', 5e-6, 25e-6], ['openai/gpt-5.6-terra', 2e-6, 12e-6], ['x-ai/grok-4.7', 1.6e-6, 4.8e-6]]
const HAIKU = 'anthropic/claude-haiku-4.5', HAIKU_IN = 1e-6, HAIKU_OUT = 5e-6
const PANEL_SYS = `You are a senior organisational psychologist deciding which competencies to measure in a pre-hire psychometric assessment for a specific role.

You will be given a position description and a competency library. Score EVERY competency from 0 to 100 for how important it is to measure it when selecting for this role: 100 = one of the defining requirements of the role; 50 = useful but not a differentiator; 0 = irrelevant. Judge from the position description. Weigh what separates strong from merely adequate performers in this specific role at its level, not what is generically desirable in any employee. Use the full range; do not cluster scores.

Return ONLY JSON: {"scores": {"<competency name exactly as given>": <number>, ...}} with an entry for every competency.`
const libraryBlock = () => factors.map(f => `- **${f.name}** [${f.category}; suits: ${f.levels.join(', ')}]\n  ${f.definition}\n  High performers: ${f.high}\n  Low performers: ${f.low}`).join('\n')
const panelUser = pd => `## Position description\n\n${pd.trim()}\n\n## Competency library\n\n${libraryBlock()}\n\nScore every competency. JSON only.`
const REASONS_SYS = `You are an organisational psychologist writing for a hiring manager who has just been shown which competencies an assessment will measure for their role. For each competency, write one or two plain sentences on why measuring it matters for THIS role, anchored in something specific from the role brief. Then write a two-sentence summary of what the set as a whole will and will not reveal. No headings, no jargon. Return ONLY JSON: {"summary": string, "reasons": {"<competency name>": string}}.`

// ---------------- LLM + Jev helpers ----------------
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function withRetry(fn, label) { for (let i = 0; i < 5; i++) { try { return await fn() } catch (e) { const m = e.message + ' ' + (e.cause?.code ?? ''); if (/HTTP (402|429|5\d\d)|fetch failed|UND_ERR|ECONN|ETIMEDOUT|socket hang up/.test(m) && i < 4) { console.error(`  retry ${label}: ${e.message.slice(0, 80)}`); await sleep(15000 * (i + 1)); continue } throw e } } }
async function chat(model, system, user, { temperature, max_tokens, json = true, pin, pout }) {
  const body = { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens, ...(temperature !== undefined && { temperature }), ...(json && { response_format: { type: 'json_object' } }) }
  let r
  try { r = await withRetry(() => post('https://openrouter.ai/api/v1/chat/completions', body), model) }
  catch (e) { if (/HTTP 400/.test(e.message)) { delete body.response_format; delete body.temperature; r = await withRetry(() => post('https://openrouter.ai/api/v1/chat/completions', body), model + ' (plain)') } else throw e }
  const c = r.json.choices?.[0]?.message?.content ?? ''
  const u = r.json.usage ?? { prompt_tokens: 0, completion_tokens: 0 }
  return { ms: r.ms, content: c, usage: u, cost: u.prompt_tokens * pin + u.completion_tokens * pout, finish: r.json.choices?.[0]?.finish_reason }
}
const safe = async (label, p) => { try { return await p } catch (e) { console.error(`  FAILED ${label}: ${e.message.slice(0, 160)}`); return { error: e.message.slice(0, 200) } } }
const nameKey = Object.fromEntries(factors.map(f => [f.name.toLowerCase().replace(/[^a-z0-9]+/g, ''), f.name]))
const canon = n => nameKey[String(n).toLowerCase().replace(/[^a-z0-9]+/g, '')] ?? null
function parseScores(content) { const j = parseJson(content); const src = j.scores ?? j; const out = {}; for (const [k, v] of Object.entries(src)) { const n = canon(k); if (n && typeof v === 'number') out[n] = v } return out }

// Jev question builders. `detail` = 'def' (definition only) or 'full' (definition + high/low indicators + category)
const detailOf = (f, detail) => detail === 'full' ? `Definition: ${f.definition} High performers: ${f.high} Low performers: ${f.low} (Category: ${f.category}.)` : `Definition: ${f.definition}`
const RELEVANCE_Q = name => `The state contains a position description and the decision being made. How important is it to measure the competency "${name}" in a pre-hire psychometric assessment for this role? Judge what separates strong from merely adequate performers in this specific role at its level, not what is generically desirable.`
function scoreQsAll(detail) { const q = {}; for (const f of factors) q[keyOf(f)] = { type: 'score', instructions: `${RELEVANCE_Q(f.name)} ${detailOf(f, detail)}`, criteria: LEVELS_A }; return q }
function noulTrio(detail) { const q = {}; for (const f of factors) { const d = detailOf(f, detail), k = keyOf(f)
  q[`${k}__req`] = { type: 'noul', instructions: `Does the position description explicitly require, or clearly imply the need for, the competency "${f.name}"? ${d}`, criteria: { true: 'The description names this capability or describes duties that plainly depend on it', false: 'The description does not call for it, or only in a generic boilerplate way' } }
  q[`${k}__diff`] = { type: 'noul', instructions: `In this specific role, would "${f.name}" separate a strong performer from a merely adequate one? ${d}`, criteria: { true: 'Strong performers in this role visibly rely on this; adequate ones get by without it', false: 'Performance in this role does not hinge on it' } }
  q[`${k}__risk`] = { type: 'noul', instructions: `Would a clear weakness in "${f.name}" be a serious risk to performing this role well? ${d}`, criteria: { true: 'A weakness here would likely cause failures the role cannot tolerate', false: 'A weakness here would be tolerable or easily compensated for' } } }
  return q }
const STAGE2_LEVELS = ['Least essential of the shortlist: the first to drop if the assessment had to be shorter', 'Useful but secondary to the others on the shortlist', 'Core: clearly belongs in the assessment for this role', 'Defining: the role cannot be assessed properly without it']
function stage2Qs(shortlist) { const q = {}; for (const f of shortlist) q[keyOf(f)] = { type: 'score', instructions: `The state contains a position description and a shortlist of competencies already judged relevant. Relative to the OTHER shortlisted competencies, how essential is "${f.name}" to measure for this role? ${detailOf(f, 'full')}`, criteria: STAGE2_LEVELS }; return q }
const scoresFrom = (answers, get) => Object.fromEntries(Object.entries(answers).map(([k, a]) => [byKey[k].name, get(a)]))
const orderOf = (scores, pool) => Object.entries(scores).filter(([n]) => pool.has(n)).sort((a, b) => b[1] - a[1]).map(([n]) => n)
const poolFor = level => new Set(factors.filter(f => f.levels.includes(level)).map(f => f.name))
const jevSummary = (r, extra = {}) => r.error ? r : { ms: r.ms, cost: r.json.usage.cost, tokens: r.json.usage.input_tokens, ...extra }

// ---------------- orchestration ----------------
const OUT = `${S}/jev-pipeline-redesign-out.json`
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : []
const PRIOR = `${S}/jev-competency-match-out.json`
const prior = fs.existsSync(PRIOR) ? JSON.parse(fs.readFileSync(PRIOR, 'utf8')) : []
if (!process.argv.includes('--report')) for (const role of ROLES) {
  if (out.some(x => x.role === role.name)) { console.error(`skip (done): ${role.name}`); continue }
  console.error(`running: ${role.name}`)
  const r = { role: role.name, expected: role.expected }
  const prev = prior.find(p => p.role === role.name)
  const extractUser = `## Decision being made\n\nselection\n\n## Role description\n\n${role.pd.trim()}\n\nExtract the brief as a single JSON object following the schema in the system prompt. Output JSON only.`
  const toBrief = raw => ({ roleTitle: raw.role_title ?? '', level: raw.level, function: raw.function ?? '', outcome: raw.outcome ?? 'selection', outcomeIntent: raw.outcome_intent || 'selection', responsibilities: raw.responsibilities ?? [], contextSignals: raw.context_signals ?? [], technicalRequirements: raw.technical_requirements ?? [], confidence: raw.confidence })
  // 1. extraction: Sonnet (reuse if available) + Haiku (always, for cost/latency and a sample)
  const [sx, hx] = await Promise.all([
    role.brief ? Promise.resolve({ reuse: true }) : prev?.brief ? Promise.resolve({ reuse: true }) : safe('sonnet extract', chat('anthropic/claude-sonnet-4-5', BRIEF_SYS, extractUser, { temperature: 0.2, max_tokens: 1500, pin: SONNET_IN, pout: SONNET_OUT })),
    safe('haiku extract', chat(HAIKU, BRIEF_SYS, extractUser, { temperature: 0.2, max_tokens: 1500, pin: HAIKU_IN, pout: HAIKU_OUT })),
  ])
  const brief = role.brief ?? prev?.brief ?? (sx.error ? null : toBrief(parseJson(sx.content)))
  r.brief = brief
  r.extract = { sonnet: role.brief ? { ms: 8000, cost: 1858 * SONNET_IN + 402 * SONNET_OUT, note: 'from prod usage' } : prev ? { ms: prev.extract.ms, cost: prev.extract.cost, note: 'from prior run (ttfb timing)' } : sx.error ? sx : { ms: sx.ms, cost: sx.cost, usage: sx.usage }, haiku: hx.error ? hx : { ms: hx.ms, cost: hx.cost, usage: hx.usage, brief: toBrief(parseJson(hx.content)) } }
  const sonnetLevel = brief?.level ?? 'mid_manager'
  const poolS = factors.filter(f => f.levels.includes(sonnetLevel))
  const matchU = matchUser(brief, poolS)
  const parseMatch = m => ({ recommended: m.recommendedCount, order: [...m.rankings].sort((a, b) => b.relevanceScore - a.relevanceScore).map(x => canon(x.factorName) ?? x.factorName), scores: Object.fromEntries(m.rankings.map(x => [canon(x.factorName) ?? x.factorName, x.relevanceScore])) })
  // 2. everything that only needs the raw PD (+ the Sonnet brief for the LLM matchers), in parallel
  const [sm, hm, ...rest] = await Promise.all([
    role.sonnetOrder ? Promise.resolve({ preset: true }) : prev ? Promise.resolve({ preset: true }) : safe('sonnet match', chat('anthropic/claude-sonnet-4-5', MATCH_SYS, matchU, { temperature: 0.3, max_tokens: 8000, pin: SONNET_IN, pout: SONNET_OUT })),
    prev ? Promise.resolve({ preset: true }) : safe('haiku match', chat(HAIKU, MATCH_SYS, matchU, { temperature: 0.3, max_tokens: 8000, pin: HAIKU_IN, pout: HAIKU_OUT })),
    ...PANEL.map(([m, pin, pout]) => safe(`panel ${m}`, chat(m, PANEL_SYS, panelUser(role.pd), { max_tokens: 4000, pin, pout }))),
    safe('jev level', jev({ state: { position_description: role.pd }, questions: { level: { type: 'choice', instructions: 'What seniority level is this role?', criteria: LEVEL_CRITERIA } } })),
    safe('jev V0', jev({ state: { decision: 'selection (hiring into this role)', position_description: role.pd }, questions: scoreQsAll('def') })),
    safe('jev V1', jev({ state: { decision: 'selection (hiring into this role)', position_description: role.pd }, questions: scoreQsAll('full') })),
    safe('jev V2', jev({ state: { decision: 'selection (hiring into this role)', position_description: role.pd }, questions: noulTrio('full') })),
  ])
  const [p0, p1, p2, jl, v0, v1, v2] = rest
  r.sonnet = role.sonnetOrder ? { order: role.sonnetOrder, cost: role.sonnetCost, ms: role.sonnetMs, note: 'prod ranking' } : prev ? { order: prev.sonnet.order, scores: prev.sonnet.scores, cost: prev.sonnet.cost, ms: 50000, recommended: prev.sonnet.recommended, note: 'from prior run; ms estimated at 67 tok/s' } : sm.error ? sm : { ...parseMatch(parseJson(sm.content)), ms: sm.ms, cost: sm.cost, usage: sm.usage }
  r.haiku = prev ? { order: prev.haiku.order, scores: prev.haiku.scores, cost: prev.haiku.cost, ms: 25000, recommended: prev.haiku.recommended, note: 'from prior run; ms estimated' } : hm.error ? hm : { ...parseMatch(parseJson(hm.content)), ms: hm.ms, cost: hm.cost, usage: hm.usage }
  r.panel = {}
  ;[p0, p1, p2].forEach((p, i) => { const m = PANEL[i][0]; r.panel[m] = p.error ? p : (() => { try { return { scores: parseScores(p.content), ms: p.ms, cost: p.cost, usage: p.usage, finish: p.finish } } catch (e) { return { error: 'parse: ' + e.message.slice(0, 80), raw: p.content.slice(0, 300), ms: p.ms, cost: p.cost } } })() })
  r.jevLevel = jl.error ? jl : { choice: jl.json.answers.level.choice, confidence: jl.json.answers.level.confidence, ms: jl.ms, cost: jl.json.usage.cost }
  const jevLevel = r.jevLevel.choice ?? sonnetLevel
  r.jev = {
    V0: jevSummary(v0, v0.error ? {} : { scores: scoresFrom(v0.json.answers, a => a.score), conf: scoresFrom(v0.json.answers, a => a.confidence) }),
    V1: jevSummary(v1, v1.error ? {} : { scores: scoresFrom(v1.json.answers, a => a.score), conf: scoresFrom(v1.json.answers, a => a.confidence) }),
    V2: jevSummary(v2, v2.error ? {} : (() => { const comp = {}, parts = {}; for (const f of factors) { const k = keyOf(f); const a = v2.json.answers; const req = a[`${k}__req`].noul, diff = a[`${k}__diff`].noul, risk = a[`${k}__risk`].noul; comp[f.name] = (req + diff + risk) / 3; parts[f.name] = [req, diff, risk] } return { scores: comp, parts } })()),
  }
  // 3. second stage (rerank the top 12 of V1 relative to each other), enriched-state variant, and Haiku reasons for V1's top 8 — in parallel
  const poolJ = poolFor(jevLevel)
  const v1order = r.jev.V1.scores ? orderOf(r.jev.V1.scores, poolJ) : []
  const shortlist = v1order.slice(0, 12).map(n => factors.find(f => f.name === n))
  const top8 = v1order.slice(0, 8)
  const reasonsUser = `## Role brief\n${JSON.stringify(brief ?? { note: 'no brief' }, null, 1)}\n\n## Competencies selected for the assessment (with the matcher's relevance score, 0–4)\n${top8.map(n => { const f = factors.find(x => x.name === n); return `- ${n} (${r.jev.V1.scores[n].toFixed(2)}): ${f.definition}` }).join('\n')}\n\nWrite the reasons and the summary. JSON only.`
  const [s2, v4, rs] = await Promise.all([
    shortlist.length ? safe('jev V3 stage2', jev({ state: { decision: 'selection (hiring into this role)', position_description: role.pd, shortlisted_competencies: shortlist.map(f => f.name) }, questions: stage2Qs(shortlist) })) : Promise.resolve({ error: 'no shortlist' }),
    brief ? safe('jev V4', jev({ state: { assessment_context: 'We are choosing up to 8 competencies, each measured with 6 questions, for a pre-hire psychometric assessment used to select candidates for this role.', decision: 'selection (hiring into this role)', seniority_level: jevLevel, role_brief: brief, position_description: role.pd }, questions: scoreQsAll('full') })) : Promise.resolve({ error: 'no brief' }),
    top8.length ? safe('haiku reasons', chat(HAIKU, REASONS_SYS, reasonsUser, { temperature: 0.4, max_tokens: 900, pin: HAIKU_IN, pout: HAIKU_OUT })) : Promise.resolve({ error: 'no top8' }),
  ])
  r.jev.V3 = jevSummary(s2, s2.error ? {} : { stage2: scoresFrom(s2.json.answers, a => a.score), order: [...orderOf(scoresFrom(s2.json.answers, a => a.score), new Set(shortlist.map(f => f.name))), ...v1order.slice(12)] })
  r.jev.V4 = jevSummary(v4, v4.error ? {} : { scores: scoresFrom(v4.json.answers, a => a.score) })
  r.reasons = rs.error ? rs : { ms: rs.ms, cost: rs.cost, usage: rs.usage, sample: (() => { try { return parseJson(rs.content) } catch { return rs.content.slice(0, 400) } })() }
  out.push(r); fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
}

// ---------------- report ----------------
const z = scores => { const v = Object.values(scores); const m = v.reduce((a, b) => a + b, 0) / v.length; const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1; return Object.fromEntries(Object.entries(scores).map(([k, x]) => [k, (x - m) / sd])) }
function consensus(panel) { const zs = Object.values(panel).filter(p => p.scores && Object.keys(p.scores).length >= 20).map(p => z(p.scores)); if (!zs.length) return null; const names = factors.map(f => f.name); const mean = Object.fromEntries(names.map(n => [n, zs.reduce((a, s) => a + (s[n] ?? -2), 0) / zs.length])); return { scores: mean, order: names.slice().sort((a, b) => mean[b] - mean[a]), n: zs.length } }
const avg = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN
const fmt = (ref, o) => o?.length ? `${spearman(ref, o).toFixed(2)} ${overlap(ref, o, 5)}/5 ${overlap(ref, o, 8)}/8` : '  ERR   '
const ensemble = (a, b, pool) => { const ra = {}, rb = {}; orderOf(a, pool).forEach((n, i) => { ra[n] = i }); orderOf(b, pool).forEach((n, i) => { rb[n] = i }); return [...pool].filter(n => n in ra && n in rb).sort((x, y) => (ra[x] + rb[x]) - (ra[y] + rb[y])) }
const rankers = r => { const pj = poolFor(r.jevLevel.choice ?? r.brief?.level ?? 'mid_manager'), ps = poolFor(r.brief?.level ?? 'mid_manager'); return {
  'Sonnet (prod)': r.sonnet.order, 'Haiku': r.haiku.order,
  'V0 def, Jev level': r.jev.V0.scores ? orderOf(r.jev.V0.scores, pj) : [], 'V0 def, Sonnet level': r.jev.V0.scores ? orderOf(r.jev.V0.scores, ps) : [],
  'V1 +indicators': r.jev.V1.scores ? orderOf(r.jev.V1.scores, pj) : [], 'V2 3-noul composite': r.jev.V2.scores ? orderOf(r.jev.V2.scores, pj) : [],
  'V3 two-stage': r.jev.V3.order ?? [], 'V4 enriched state': r.jev.V4.scores ? orderOf(r.jev.V4.scores, pj) : [], 'V5 V1+V2 ensemble': r.jev.V1.scores && r.jev.V2.scores ? ensemble(r.jev.V1.scores, r.jev.V2.scores, pj) : [] } }
const RK = Object.keys(rankers(out[0]))
console.log(`ROLES: ${out.length}`)
console.log('\nPANEL: per-model status and agreement with the consensus (rho / top8) — the ceiling any ranker can be expected to reach')
for (const r of out) { const c = consensus(r.panel); r._c = c; console.log(`  ${r.role.padEnd(36)} ${Object.entries(r.panel).map(([m, p]) => `${m.split('/')[1].padEnd(16)} ${p.scores ? `${Object.keys(p.scores).length}f ${spearman(c.order, Object.keys(p.scores).sort((a, b) => p.scores[b] - p.scores[a])).toFixed(2)} ${overlap(c.order, Object.keys(p.scores).sort((a, b) => p.scores[b] - p.scores[a]), 8)}/8` : 'ERR ' + (p.error ?? '').slice(0, 40)}`).join(' | ')}`) }
const pairs = []; for (const r of out) { const ms = Object.values(r.panel).filter(p => p.scores); for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) { const oi = Object.keys(ms[i].scores).sort((a, b) => ms[i].scores[b] - ms[i].scores[a]), oj = Object.keys(ms[j].scores).sort((a, b) => ms[j].scores[b] - ms[j].scores[a]); pairs.push([spearman(oi, oj), overlap(oi, oj, 8)]) } }
console.log(`  mean pairwise agreement between panel members: rho ${avg(pairs.map(p => p[0])).toFixed(2)}, top8 ${avg(pairs.map(p => p[1])).toFixed(1)}/8`)
console.log('\nLEVEL: expected | Sonnet brief | Haiku brief | Jev (conf)')
for (const r of out) console.log(`  ${r.role.padEnd(36)} ${r.expected.padEnd(19)} ${(r.brief?.level ?? '-').padEnd(19)} ${(r.extract.haiku.brief?.level ?? '-').padEnd(19)} ${r.jevLevel.choice} (${(r.jevLevel.confidence ?? 0).toFixed(2)})`)
const acc = k => out.filter(r => k(r) === r.expected).length; console.log(`  matches expected: Sonnet ${acc(r => r.brief?.level)}/${out.length}, Haiku ${acc(r => r.extract.haiku.brief?.level)}/${out.length}, Jev ${acc(r => r.jevLevel.choice)}/${out.length}`)
console.log('\nAGREEMENT WITH PANEL CONSENSUS (rho / top5 / top8) — mean over roles, then per role')
const means = {}; for (const k of RK) { means[k] = { rho: avg(out.map(r => spearman(r._c.order, rankers(r)[k]))), t5: avg(out.map(r => overlap(r._c.order, rankers(r)[k], 5))), t8: avg(out.map(r => overlap(r._c.order, rankers(r)[k], 8))), rhoS: avg(out.map(r => spearman(r.sonnet.order, rankers(r)[k]))), t8S: avg(out.map(r => overlap(r.sonnet.order, rankers(r)[k], 8))) } }
console.log('  ranker'.padEnd(26) + 'vs panel: rho  top5  top8   | vs Sonnet: rho  top8')
for (const k of RK) console.log(`  ${k.padEnd(24)} ${means[k].rho.toFixed(3)}  ${means[k].t5.toFixed(2)}  ${means[k].t8.toFixed(2)}    | ${means[k].rhoS.toFixed(3)}  ${means[k].t8S.toFixed(2)}`)
console.log('\n  per role (vs panel): ' + RK.map((k, i) => `[${i}] ${k}`).join('  '))
for (const r of out) console.log(`  ${r.role.padEnd(36)} ${RK.map(k => fmt(r._c.order, rankers(r)[k])).join(' | ')}`)
console.log('\nCOST & LATENCY (per role, measured; LLM ms = full response)')
const m = k => avg(out.map(k).filter(x => Number.isFinite(x)))
console.log(`  brief extraction   Sonnet ${Math.round(m(r => r.extract.sonnet.ms))} ms $${m(r => r.extract.sonnet.cost).toFixed(4)}   Haiku ${Math.round(m(r => r.extract.haiku.ms))} ms $${m(r => r.extract.haiku.cost).toFixed(4)}`)
console.log(`  matching           Sonnet ${Math.round(m(r => r.sonnet.ms))} ms $${m(r => r.sonnet.cost).toFixed(4)}   Haiku ${Math.round(m(r => r.haiku.ms))} ms $${m(r => r.haiku.cost).toFixed(4)}`)
for (const v of ['V0', 'V1', 'V2', 'V3', 'V4']) console.log(`  Jev ${v.padEnd(14)} ${Math.round(m(r => r.jev[v].ms))} ms $${m(r => r.jev[v].cost).toFixed(5)} (${Math.round(m(r => r.jev[v].tokens))} tok)${v === 'V3' ? ' [stage 2 only; add V1]' : ''}`)
console.log(`  Jev level          ${Math.round(m(r => r.jevLevel.ms))} ms $${m(r => r.jevLevel.cost).toFixed(5)}`)
console.log(`  Haiku reasons(8)   ${Math.round(m(r => r.reasons.ms))} ms $${m(r => r.reasons.cost).toFixed(4)}`)
const cur = { ms: m(r => r.extract.sonnet.ms) + m(r => r.sonnet.ms), cost: m(r => r.extract.sonnet.cost) + m(r => r.sonnet.cost) }
const propA = { ms: Math.max(m(r => r.extract.sonnet.ms), m(r => r.jev.V1.ms) + m(r => r.jevLevel.ms)) + m(r => r.reasons.ms), cost: m(r => r.extract.sonnet.cost) + m(r => r.jev.V1.cost) + m(r => r.jevLevel.cost) + m(r => r.reasons.cost) }
const propB = { ms: Math.max(m(r => r.extract.haiku.ms), m(r => r.jev.V1.ms) + m(r => r.jevLevel.ms)) + m(r => r.reasons.ms), cost: m(r => r.extract.haiku.cost) + m(r => r.jev.V1.cost) + m(r => r.jevLevel.cost) + m(r => r.reasons.cost) }
console.log(`\n  PIPELINE   current (Sonnet extract → Sonnet match):            ${Math.round(cur.ms / 1000)} s  $${cur.cost.toFixed(4)}`)
console.log(`  PIPELINE   proposed A (Sonnet extract ∥ Jev V1 → Haiku reasons): ${Math.round(propA.ms / 1000)} s  $${propA.cost.toFixed(4)}   (${(cur.cost / propA.cost).toFixed(1)}x cheaper, ${(cur.ms / propA.ms).toFixed(1)}x faster)`)
console.log(`  PIPELINE   proposed B (Haiku extract ∥ Jev V1 → Haiku reasons):  ${Math.round(propB.ms / 1000)} s  $${propB.cost.toFixed(4)}   (${(cur.cost / propB.cost).toFixed(1)}x cheaper, ${(cur.ms / propB.ms).toFixed(1)}x faster)`)
const s1 = out.find(r => r.reasons.sample?.reasons); if (s1) console.log(`\nSAMPLE HAIKU REASONS (${s1.role}):\n  summary: ${s1.reasons.sample.summary}\n` + Object.entries(s1.reasons.sample.reasons).slice(0, 3).map(([k, v]) => `  ${k}: ${v}`).join('\n'))
const s2 = out.find(r => r.extract.haiku.brief && r.brief); if (s2) console.log(`\nSAMPLE BRIEF (${s2.role}) Sonnet vs Haiku:\n  Sonnet: level=${s2.brief.level} fn=${s2.brief.function} resp=${s2.brief.responsibilities.length} ctx=${s2.brief.contextSignals.length} tech=${s2.brief.technicalRequirements.length}\n  Haiku:  level=${s2.extract.haiku.brief.level} fn=${s2.extract.haiku.brief.function} resp=${s2.extract.haiku.brief.responsibilities.length} ctx=${s2.extract.haiku.brief.contextSignals.length} tech=${s2.extract.haiku.brief.technicalRequirements.length}\n  Haiku responsibilities: ${s2.extract.haiku.brief.responsibilities.slice(0, 3).join(' | ')}`)
console.log('\nTOP-8: panel consensus | Sonnet | V1 | V3')
for (const r of out) { const rk = rankers(r); console.log(`\n  ${r.role} [jev=${r.jevLevel.choice}, sonnet=${r.brief?.level}]`); for (let i = 0; i < 8; i++) console.log(`   ${i + 1}. ${(r._c.order[i] ?? '').slice(0, 26).padEnd(27)}| ${(rk['Sonnet (prod)'][i] ?? '').slice(0, 26).padEnd(27)}| ${(rk['V1 +indicators'][i] ?? '').slice(0, 26).padEnd(27)}| ${(rk['V3 two-stage'][i] ?? '')}`) }
