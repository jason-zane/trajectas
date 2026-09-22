import fs from 'node:fs'
/**
 * Jev vs LLM head-to-head on competency matching (Role Builder / Architect).
 *
 * Runs the production brief-extraction + competency-matching prompts on six
 * designed position descriptions through Sonnet 4.5 and Haiku 4.5 (OpenRouter
 * chat completions), and Jev 1.13 (OpenRouter Decisions API, one Score
 * question per level-eligible factor), then prints rank agreement, latency and
 * cost. Prompts are a snapshot of ai_system_prompts as of 2026-09-22; the
 * factor list is a snapshot of match-eligible factors on the same date.
 *
 * Usage (needs OpenRouter credit — Sonnet reserves max_tokens up front):
 *   node --env-file=.env.local scripts/evals/jev-competency-match-eval.mjs
 * Writes scripts/evals/jev-competency-match-out.json next to this file.
 */
const S = new URL('.', import.meta.url).pathname.replace(/\/$/, '')
const key = process.env.OpenRouter_API_KEY
if (!key) { console.error('OpenRouter_API_KEY is not set (run with node --env-file=.env.local)'); process.exit(1) }
const factors = JSON.parse(fs.readFileSync(`${S}/jev-competency-match-factors.json`, 'utf8'))
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

// ---- sequential orchestration with 402/429 retry ----
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function withRetry(fn, label) { for (let i = 0; i < 5; i++) { try { return await fn() } catch (e) { if (/HTTP (402|429|5\d\d)|fetch failed|UND_ERR|ECONN|ETIMEDOUT|socket hang up/.test(e.message + ' ' + (e.cause?.code ?? '')) && i < 4) { console.error(`  retry ${label} after ${e.message.slice(0, 60)}`); await sleep(20000 * (i + 1)); continue } throw e } } }

const OUT = `${S}/jev-competency-match-out.json`
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : []
for (const role of ROLES) {
  if (out.some(x => x.role === role.name)) { console.error(`skip (already done): ${role.name}`); continue }
  console.error(`running: ${role.name}`)
  const r = { role: role.name, expected: role.expected }
  let brief
  if (role.brief) { brief = role.brief; r.extract = { ms: 0, cost: 1858 * SONNET_IN + 402 * SONNET_OUT } }
  else {
    const ex = await withRetry(() => sonnet(BRIEF_SYS, `## Decision being made\n\nselection\n\n## Role description\n\n${role.pd.trim()}\n\nExtract the brief as a single JSON object following the schema in the system prompt. Output JSON only.`, 0.2, 1500), 'extract')
    const raw = parseJson(ex.json.choices[0].message.content)
    brief = { roleTitle: raw.role_title ?? '', level: raw.level, function: raw.function ?? '', outcome: raw.outcome ?? 'selection', outcomeIntent: raw.outcome_intent || 'selection', responsibilities: raw.responsibilities ?? [], contextSignals: raw.context_signals ?? [], technicalRequirements: raw.technical_requirements ?? [], confidence: raw.confidence }
    r.extract = { ms: ex.ms, usage: ex.json.usage, cost: ex.json.usage.prompt_tokens * SONNET_IN + ex.json.usage.completion_tokens * SONNET_OUT }
  }
  r.brief = brief
  const pool = factors.filter(f => f.levels.includes(brief.level))
  const llm = async (model, pin, pout) => { const mt = await withRetry(() => post('https://openrouter.ai/api/v1/chat/completions', { model, messages: [{ role: 'system', content: MATCH_SYS }, { role: 'user', content: matchUser(brief, pool) }], temperature: 0.3, max_tokens: 8000, response_format: { type: 'json_object' } }), model); const m = parseJson(mt.json.choices[0].message.content); return { ms: mt.ms, usage: mt.json.usage, cost: mt.json.usage.prompt_tokens * pin + mt.json.usage.completion_tokens * pout, recommended: m.recommendedCount, order: [...m.rankings].sort((a, b) => b.relevanceScore - a.relevanceScore).map(x => byKey[keyOf({ name: x.factorName })]?.name ?? x.factorName), scores: Object.fromEntries(m.rankings.map(x => [x.factorName, x.relevanceScore])) } }
  ;[r.sonnet, r.haiku] = await Promise.all([llm('anthropic/claude-sonnet-4-5', SONNET_IN, SONNET_OUT), llm('anthropic/claude-haiku-4.5', 1e-6, 5e-6)])
  const [jBriefA, jBriefA_rep, jBriefA2, jBriefN, jRawA, jLevel] = await Promise.all([
    withRetry(() => jev({ state: { role_brief: brief }, questions: scoreQs(pool, LEVELS_A, 'selection') }), 'jev'),
    withRetry(() => jev({ state: { role_brief: brief }, questions: scoreQs(pool, LEVELS_A, 'selection') }), 'jev'),
    withRetry(() => jev({ state: { role_brief: brief }, questions: scoreQs(pool, LEVELS_A2, 'selection') }), 'jev'),
    withRetry(() => jev({ state: { role_brief: brief }, questions: noulQs(pool, 'selection') }), 'jev'),
    withRetry(() => jev({ state: { decision: 'selection (hiring into this role)', position_description: role.pd }, questions: scoreQs(pool, LEVELS_A, 'selection') }), 'jev'),
    withRetry(() => jev({ state: { position_description: role.pd }, questions: { level: { type: 'choice', instructions: 'What seniority level is this role?', criteria: LEVEL_CRITERIA } } }), 'jev'),
  ])
  const orderScore = j => Object.entries(j.json.answers).sort((a, b) => b[1].score - a[1].score).map(([k]) => byKey[k].name)
  const orderNoul = j => Object.entries(j.json.answers).sort((a, b) => b[1].noul - a[1].noul).map(([k]) => byKey[k].name)
  r.jev = {
    briefA: { ms: jBriefA.ms, cost: jBriefA.json.usage.cost, tokens: jBriefA.json.usage.input_tokens, order: orderScore(jBriefA), scores: Object.fromEntries(Object.entries(jBriefA.json.answers).map(([k, a]) => [byKey[k].name, +a.score.toFixed(2)])), nImportant: Object.values(jBriefA.json.answers).filter(a => a.score >= 3).length },
    briefA_rep: { order: orderScore(jBriefA_rep), identical: JSON.stringify(jBriefA.json.answers) === JSON.stringify(jBriefA_rep.json.answers) },
    briefA2: { order: orderScore(jBriefA2) },
    briefN: { ms: jBriefN.ms, cost: jBriefN.json.usage.cost, order: orderNoul(jBriefN), nInclude: Object.values(jBriefN.json.answers).filter(a => a.noul >= 0.5).length },
    rawA: { ms: jRawA.ms, cost: jRawA.json.usage.cost, tokens: jRawA.json.usage.input_tokens, order: orderScore(jRawA), scores: Object.fromEntries(Object.entries(jRawA.json.answers).map(([k, a]) => [byKey[k].name, +a.score.toFixed(2)])), nImportant: Object.values(jRawA.json.answers).filter(a => a.score >= 3).length },
    level: { ms: jLevel.ms, choice: jLevel.json.answers.level.choice, confidence: jLevel.json.answers.level.confidence, probabilities: jLevel.json.answers.level.probabilities },
  }
  r.pool = pool.length
  out.push(r)
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
}
fs.writeFileSync(`${S}/jev-competency-match-out.json`, JSON.stringify(out, null, 2))

console.log('LEVEL: role | expected | Sonnet brief | Jev from raw PD (conf)')
for (const r of out) console.log(`  ${r.role.padEnd(30)} ${r.expected.padEnd(19)} ${r.brief.level.padEnd(19)} ${r.jev.level.choice} (${r.jev.level.confidence.toFixed(2)})`)
console.log('\nAGREEMENT WITH SONNET (pool = level-eligible factors): rho / top5 / top8')
console.log('  role                           pool  Haiku 4.5        Jev brief-score  brief-score(rewording) brief-noul       raw-PD-score     rep-identical')
for (const r of out) { const s = r.sonnet.order, f = o => `${spearman(s, o).toFixed(2)} ${overlap(s, o, 5)}/5 ${overlap(s, o, 8)}/8`; console.log(`  ${r.role.padEnd(30)} ${String(r.pool).padEnd(5)} ${f(r.haiku.order).padEnd(16)} ${f(r.jev.briefA.order).padEnd(16)} ${f(r.jev.briefA2.order).padEnd(22)} ${f(r.jev.briefN.order).padEnd(16)} ${f(r.jev.rawA.order).padEnd(16)} ${r.jev.briefA_rep.identical}`) }
console.log('\nSELF-CONSISTENCY (rho): brief-score vs rewording | brief-score vs raw-PD-score')
for (const r of out) console.log(`  ${r.role.padEnd(30)} ${spearman(r.jev.briefA.order, r.jev.briefA2.order).toFixed(2)} | ${spearman(r.jev.briefA.order, r.jev.rawA.order).toFixed(2)}`)
console.log('\nCOUNT: Sonnet optimal | Jev score>=3 (brief) | Jev score>=3 (raw) | Jev noul>=0.5')
for (const r of out) console.log(`  ${r.role.padEnd(30)} ${String(r.sonnet.recommended?.optimal).padEnd(4)} | ${String(r.jev.briefA.nImportant).padEnd(4)} | ${String(r.jev.rawA.nImportant).padEnd(4)} | ${r.jev.briefN.nInclude}`)
console.log('\nLATENCY & COST: Sonnet extract | Sonnet match | Haiku match | Jev brief-score | Jev raw-PD-score')
let tS = 0, tJ = 0
for (const r of out) { tS += r.extract.cost + r.sonnet.cost; tJ += r.jev.rawA.cost; console.log(`  ${r.role.padEnd(30)} ${String(r.extract.ms + 'ms').padEnd(8)}$${r.extract.cost.toFixed(4)} | ${String(r.sonnet.ms + 'ms').padEnd(8)}$${r.sonnet.cost.toFixed(4)} (${r.sonnet.usage.prompt_tokens}/${r.sonnet.usage.completion_tokens} tok) | ${String(r.haiku.ms + 'ms').padEnd(8)}$${r.haiku.cost.toFixed(4)} (${r.haiku.usage.prompt_tokens}/${r.haiku.usage.completion_tokens} tok) | ${String(r.jev.briefA.ms + 'ms').padEnd(7)}$${r.jev.briefA.cost.toFixed(5)} (${r.jev.briefA.tokens} tok) | ${String(r.jev.rawA.ms + 'ms').padEnd(7)}$${r.jev.rawA.cost.toFixed(5)} (${r.jev.rawA.tokens} tok)`) }
console.log(`  TOTAL ${out.length} roles: Sonnet pipeline $${tS.toFixed(3)}  vs  Jev raw-PD $${tJ.toFixed(4)}  => ${(tS / tJ).toFixed(0)}x`)
console.log('\nTOP-8 SIDE BY SIDE (Sonnet | Haiku | Jev brief-score | Jev raw-PD-score)')
for (const r of out) { console.log(`\n  ${r.role} [${r.brief.level}]`); for (let i = 0; i < 8; i++) console.log(`   ${i + 1}. ${(r.sonnet.order[i] ?? '').slice(0, 26).padEnd(27)}| ${(r.haiku.order[i] ?? '').slice(0, 26).padEnd(27)}| ${(r.jev.briefA.order[i] ?? '').slice(0, 26).padEnd(27)}| ${(r.jev.rawA.order[i] ?? '')}`) }
