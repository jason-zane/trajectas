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

// ---------------- criteria / information experiments on the saved 13 roles ----------------
const saved = JSON.parse(fs.readFileSync(`${S}/jev-pipeline-redesign-out.json`, 'utf8'))
const names = factors.map(f => f.name)
const z = s => { const v = Object.values(s), m = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1; return Object.fromEntries(Object.entries(s).map(([k, x]) => [k, (x - m) / sd])) }
const consensusZ = r => { const zs = Object.values(r.panel).filter(p => p.scores).map(p => z(p.scores)); return Object.fromEntries(names.map(n => [n, zs.reduce((a, s) => a + (s[n] ?? -2), 0) / zs.length])) }
const orderZ = zsc => names.slice().sort((a, b) => zsc[b] - zsc[a])
const avg = xs => xs.reduce((a, b) => a + b, 0) / xs.length
const poolOf = lvl => new Set(factors.filter(f => f.levels.includes(lvl)).map(f => f.name))
const softOrder = (scores, lvl, pen = 0.5) => { const p = poolOf(lvl); return Object.entries(scores).map(([n, v]) => [n, p.has(n) ? v : v - pen]).sort((a, b) => b[1] - a[1]).map(([n]) => n) }
const evalOrder = (r, o) => { const c = orderZ(consensusZ(r)); return [spearman(c, o), overlap(c, o, 5), overlap(c, o, 8)] }

console.log('A) SYSTEMATIC BIAS: mean (Jev V1 z-score − panel z-score) per factor across roles where the factor is level-eligible; + = Jev over-rates')
const diffs = {}
for (const r of saved) { const cz = consensusZ(r), jz = z(r.jev.V1.scores), p = poolOf(r.jevLevel.choice); for (const n of names) if (p.has(n)) (diffs[n] ??= []).push(jz[n] - cz[n]) }
const bias = Object.fromEntries(names.map(n => [n, avg(diffs[n])]))
for (const n of names.slice().sort((a, b) => bias[b] - bias[a])) console.log(`  ${n.padEnd(40)} ${bias[n] >= 0 ? '+' : ''}${bias[n].toFixed(2)}  (n=${diffs[n].length}, sd ${Math.sqrt(avg(diffs[n].map(d => (d - bias[n]) ** 2))).toFixed(2)})`)

console.log('\nB) LEAVE-ONE-OUT CORRECTION: fit per-factor offsets on 12 roles, apply to the 13th (Jev V1 z − offset, soft level penalty 0.5 in z units), score vs panel')
const rows = []
for (let i = 0; i < saved.length; i++) {
  const r = saved[i]; const train = saved.filter((_, j) => j !== i)
  const d = {}; for (const t of train) { const cz = consensusZ(t), jz = z(t.jev.V1.scores), p = poolOf(t.jevLevel.choice); for (const n of names) if (p.has(n)) (d[n] ??= []).push(jz[n] - cz[n]) }
  const off = Object.fromEntries(names.map(n => [n, d[n]?.length ? avg(d[n]) : 0]))
  const jz = z(r.jev.V1.scores), p = poolOf(r.jevLevel.choice)
  const base = Object.fromEntries(names.map(n => [n, p.has(n) ? jz[n] : jz[n] - 0.8]))
  const corr = Object.fromEntries(names.map(n => [n, base[n] - off[n]]))
  const corrHalf = Object.fromEntries(names.map(n => [n, base[n] - 0.5 * off[n]]))
  const e0 = evalOrder(r, orderZ(base)), e1 = evalOrder(r, orderZ(corr)), e2 = evalOrder(r, orderZ(corrHalf))
  rows.push([e0, e1, e2]); console.log(`  ${r.role.padEnd(36)} uncorrected ${e0[0].toFixed(2)} ${e0[2]}/8 | full offset ${e1[0].toFixed(2)} ${e1[2]}/8 | half offset ${e2[0].toFixed(2)} ${e2[2]}/8`)
}
console.log(`  MEAN  uncorrected rho ${avg(rows.map(x => x[0][0])).toFixed(3)} top8 ${avg(rows.map(x => x[0][2])).toFixed(2)} | full offset rho ${avg(rows.map(x => x[1][0])).toFixed(3)} top8 ${avg(rows.map(x => x[1][2])).toFixed(2)} | half offset rho ${avg(rows.map(x => x[2][0])).toFixed(3)} top8 ${avg(rows.map(x => x[2][2])).toFixed(2)}`)

// C) New information in the question: job-side signals (draft) and structured rubric levels
const SIGNALS = {
  'Analytical Thinking': 'roles that produce or consume numbers: reporting, forecasting, pricing, analytics, reconciliations, KPI ownership, data-based recommendations',
  'Commercial Acumen': 'P&L or budget ownership, pricing, margin, revenue targets, cost control, market or competitor positioning, owner or investor reporting',
  'Critical Analysis (Evaluation)': 'diagnosing problems, root-cause work, investigations, evaluating evidence or options, policy analysis, incident reviews, reviewing others\' work',
  'Ingenuity': 'roles that ask for novel solutions, innovation, product invention, unconventional problem-solving, creative or R&D work',
  'Judgement': 'decisions under uncertainty or time pressure, incomplete information, risk trade-offs, escalation authority, sign-off responsibility',
  'Strategic Vision': 'multi-year direction setting, portfolio or market strategy, executive or board-level planning, positioning against future competitors',
  'Decision Prioritisation': 'competing demands, many stakeholders, triage, allocating own or a team\'s attention when deadlines collide',
  'Execution (Implementation)': 'delivery against firm deadlines and commitments, operational throughput, compliance timetables, reliable completion of defined tasks',
  'Organisation': 'planning projects, schedules, rosters, milestones and dependencies; coordinating multiple workstreams, sites or subcontractors',
  'Performance Tenacity': 'long sales cycles, repeated rejection, slow-burn goals, pipeline building, persistence through setbacks',
  'Process Discipline': 'regulated or safety-critical environments, compliance, audit, standard operating procedures, quality systems',
  'Building Relationships': 'stakeholder networks, account management, partnerships, owner or client relationships maintained over time',
  'Collaboration (Teamwork)': 'squad or team-based work, shared deliverables, cross-functional projects, supporting colleagues, team dynamics',
  'Communication': 'writing briefs or reports, presenting to boards, committees or clients, explaining technical matters to non-experts, customer-facing contact',
  'Influence (Negotiation)': 'negotiation, contracts, claims, sales, persuading stakeholders without authority, union or client negotiations',
  'Interpersonal Sensitivity': 'reading customers, patients, staff or families; handling distress, conflict or complaints; coaching conversations',
  'Achievement Drive': 'targets, quotas, competitive markets, stretch goals, growth mandates',
  'Emotional Regulation': 'high-pressure, conflict-prone or emotionally charged work: escalations, complaints, crises, hard conversations',
  'Flexibility': 'changing priorities, restructures, new systems, shifting direction, matrixed organisations, fast-moving markets',
  'Learning Agility': 'new domains, unfamiliar tools or methods, graduate or rotation programs, rapid onboarding, evolving regulation or technology',
  'Resilience': 'sustained pressure, setbacks, long hours, criticism, extended change programs, high-stakes delivery',
  'Self-Insight': 'feedback-rich development expectations, leadership pipelines, coaching cultures, senior roles exposed to 360 feedback',
  'Visible Self-Development': 'development-oriented roles and graduate programs that explicitly expect a learning plan; rarely a selection differentiator',
  'Decisive Leadership (Directing Action)': 'direct reports, accountability for team outcomes, delegation, running shifts or units, making calls on behalf of others',
  'People Development': 'managing and coaching staff, performance management, succession, onboarding or mentoring responsibilities',
}
const LEVELS_STRUCT = [
  { what: 'Not relevant: measuring this would tell us little about success in this role', examples: ['a capability the role never calls on', 'a people-management capability for a role with no reports or budget'] },
  { what: 'Marginal: occasionally useful but not a differentiator', examples: ['a generic workplace virtue the description mentions in passing', 'helps in a minority of the role\'s tasks'] },
  { what: 'Useful: contributes to performance in this role', examples: ['supports several duties but a weakness could be compensated for', 'a hiring panel would note it but not screen on it'] },
  { what: 'Important: a clear driver of success in this role', examples: ['several core duties depend on it', 'a weakness would show in performance within months'] },
  { what: 'Critical: among the few things that most separate strong from weak performers in this role', examples: ['the role\'s defining responsibilities cannot be done well without it', 'the first thing an expert would want measured for this role'] },
]
const qs = (mode) => { const q = {}; for (const f of factors) { const sig = mode.includes('sig') ? ` Typically matters most in roles involving: ${SIGNALS[f.name]}.` : ''; q[keyOf(f)] = { type: 'score', instructions: `${RELEVANCE_Q(f.name)} ${detailOf(f, 'full')}${sig}`, criteria: mode.includes('struct') ? LEVELS_STRUCT : LEVELS_A } } return q }
const RELEVANCE_Q = name => `The state contains a position description and the decision being made. How important is it to measure the competency "${name}" in a pre-hire psychometric assessment for this role? Judge what separates strong from merely adequate performers in this specific role at its level, not what is generically desirable.`
const detailOf = (f, detail) => detail === 'full' ? `Definition: ${f.definition} High performers: ${f.high} Low performers: ${f.low} (Category: ${f.category}.)` : `Definition: ${f.definition}`
const scoresFrom = a => Object.fromEntries(Object.entries(a).map(([k, x]) => [byKey[k].name, x.score]))
console.log('\nC) MORE INFORMATION IN THE QUESTION (all with soft level penalty 0.5, Jev level): V1 baseline | +job-side signals | +structured rubric (what+examples) | both')
const res = []
for (const r of saved) {
  const role = ROLES.find(x => x.name === r.role); if (!role) { console.log('  no PD for', r.role); continue }
  const state = { decision: 'selection (hiring into this role)', position_description: role.pd }
  const [sig, st, both] = await Promise.all(['sig', 'struct', 'sig+struct'].map(m => jev({ state, questions: qs(m) }).then(x => ({ scores: scoresFrom(x.json.answers), ms: x.ms, cost: x.json.usage.cost, tokens: x.json.usage.input_tokens })).catch(e => ({ error: e.message.slice(0, 100) }))))
  const lvl = r.jevLevel.choice
  const e = { role: r.role, base: evalOrder(r, softOrder(r.jev.V1.scores, lvl)), sig: sig.error ? null : evalOrder(r, softOrder(sig.scores, lvl)), st: st.error ? null : evalOrder(r, softOrder(st.scores, lvl)), both: both.error ? null : evalOrder(r, softOrder(both.scores, lvl)), tok: [sig.tokens, st.tokens, both.tokens] }
  res.push(e); const f = x => x ? `${x[0].toFixed(2)} ${x[1]}/5 ${x[2]}/8` : 'ERR'
  console.log(`  ${r.role.padEnd(36)} ${f(e.base)} | ${f(e.sig)} | ${f(e.st)} | ${f(e.both)}   (tok ${e.tok.join('/')})`)
}
for (const k of ['base', 'sig', 'st', 'both']) { const ok = res.filter(x => x[k]); console.log(`  MEAN ${k.padEnd(5)} rho ${avg(ok.map(x => x[k][0])).toFixed(3)} top5 ${avg(ok.map(x => x[k][1])).toFixed(2)} top8 ${avg(ok.map(x => x[k][2])).toFixed(2)}  (n=${ok.length})`) }
fs.writeFileSync(`${S}/jev-criteria-experiments-out.json`, JSON.stringify({ bias, loo: rows, info: res }, null, 2))
