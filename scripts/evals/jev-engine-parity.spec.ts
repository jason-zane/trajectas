/**
 * Live parity check: runs the production Jev engine (real client, real model)
 * on two of the designed roles from the evaluation harness and prints the
 * result next to the harness's saved two-stage order. Needs OpenRouter_API_KEY
 * (read from the primary checkout's .env.local when not already in the env;
 * the value is never printed).
 *
 *   npx vitest run --config scripts/evals/vitest.parity.config.ts
 *
 * The harness applied a HARD level filter before the rerank; production uses
 * the soft penalty, so factors outside the level pool may now appear. Exact
 * equality is not expected — the assertion is a loose overlap; read the table.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Brief, MatchingFactor } from '@/types/ai'

vi.mock('@/lib/security/action-errors', () => ({
  logActionError: (context: string, error: unknown) => {
    console.error(`[${context}]`, error instanceof Error ? error.message : error)
  },
  throwActionError: (context: string, message: string, cause?: unknown): never => {
    throw new Error(`${context}: ${message} (${cause instanceof Error ? cause.message : String(cause)})`)
  },
}))

const here = path.dirname(new URL(import.meta.url).pathname)
const evalSource = fs.readFileSync(path.join(here, 'jev-pipeline-redesign-eval.mjs'), 'utf8')
const saved = JSON.parse(fs.readFileSync(path.join(here, 'jev-pipeline-redesign-out.json'), 'utf8')) as Array<{
  role: string
  brief: Brief
  jevLevel: { choice: string; confidence: number }
  jev: { V3: { order: string[] } }
}>
const rawFactors = JSON.parse(fs.readFileSync(path.join(here, 'jev-factors-full.json'), 'utf8')) as Array<{
  id: string; name: string; category: string; levels: string[]; definition: string; high: string; low: string
}>

const factors: MatchingFactor[] = rawFactors.map((f) => ({
  id: f.id,
  name: f.name,
  definition: f.definition,
  applicableLevels: f.levels,
  indicatorsHigh: f.high,
  indicatorsLow: f.low,
  category: f.category,
}))

function pdFor(roleName: string): string {
  const re = new RegExp(`name: '${roleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}', expected: '[a-z_]+', pd: \`([\\s\\S]*?)\`\\s*\\}`)
  const m = evalSource.match(re)
  if (!m) throw new Error(`PD for ${roleName} not found in the eval script`)
  return m[1]
}

function ensureKey() {
  if (process.env.OpenRouter_API_KEY) return
  const envPath = '/Users/jasonhunt/Developer/trajectas/.env.local'
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^OpenRouter_API_KEY=(.*)$/)
    if (m) process.env.OpenRouter_API_KEY = m[1].trim().replace(/^"|"$/g, '')
  }
}
ensureKey()

const ROLES = ['Nurse Unit Manager', 'Graduate Policy Analyst']

describe.skipIf(!process.env.OpenRouter_API_KEY)('Jev engine parity with the evaluation harness', () => {
  for (const roleName of ROLES) {
    it(roleName, async () => {
      const { runJevMatching } = await import('@/lib/ai/matching/jev-engine')
      const { runRankingExplanation } = await import('@/lib/ai/matching/ranking-explanation')
      const { openRouterProvider } = await import('@/lib/ai/providers/openrouter')

      const savedRole = saved.find((r) => r.role === roleName)
      if (!savedRole) throw new Error(`no saved result for ${roleName}`)
      const pd = pdFor(roleName)

      const t0 = performance.now()
      const out = await runJevMatching(
        { source: { kind: 'brief', brief: savedRole.brief, rawText: pd }, availableFactors: factors },
        { modelId: 'typesafe/jev-1.13' },
      )
      const jevMs = Math.round(performance.now() - t0)

      const top = out.rankings.slice(0, 8)
      const harness = savedRole.jev.V3.order.slice(0, 8)
      const overlap8 = top.filter((r) => harness.includes(r.factorName)).length
      const overlap5 = top.slice(0, 5).filter((r) => harness.slice(0, 5).includes(r.factorName)).length

      const rows = top.map((r, i) => `${String(i + 1).padStart(2)}. ${r.factorName.padEnd(34)} ${String(r.relevanceScore).padStart(3)}  | ${harness[i] ?? ''}`)
      console.log(
        `\n${roleName}: level ${out.resolvedLevel} (${out.levelSource}, conf ${out.levelConfidence ?? 'n/a'}; harness ${savedRole.jevLevel.choice} @ ${savedRole.jevLevel.confidence}; brief ${savedRole.brief.level})` +
          `\n  ${jevMs} ms, model ${out.modelUsed}, usage ${JSON.stringify(out.usage)}, recommended ${JSON.stringify(out.recommendedCount)}` +
          `\n  production (score)                          | harness V3\n  ${rows.join('\n  ')}\n  top-5 overlap ${overlap5}/5, top-8 overlap ${overlap8}/8`,
      )

      expect(out.rankings.length).toBe(factors.length)
      expect(out.rankings[0].rank).toBe(1)
      expect(overlap8).toBeGreaterThanOrEqual(5)

      // Reasons stage, live, with the seed configuration injected (no DB needed).
      const t1 = performance.now()
      const explanation = await runRankingExplanation(
        {
          brief: savedRole.brief,
          picks: top.map((r) => ({
            factorId: r.factorId,
            factorName: r.factorName,
            definition: factors.find((f) => f.id === r.factorId)?.definition ?? '',
            relevanceScore: r.relevanceScore,
          })),
        },
        {
          provider: openRouterProvider,
          modelConfig: { purpose: 'ranking_explanation', modelId: 'anthropic/claude-haiku-4.5', config: { temperature: 0.4, max_tokens: 900 } },
          prompt: {
            id: 'seed', name: 'Ranking Explanation v1', purpose: 'ranking_explanation', version: 1,
            content: 'You are an organisational psychologist writing for a hiring manager who has just been shown which competencies an assessment will measure for their role. For each competency, write one or two plain sentences on why measuring it matters for THIS role, anchored in something specific from the role brief. Then write a two-sentence summary of what the set as a whole will and will not reveal. No headings, no jargon, no markdown. Return ONLY JSON: {"summary": string, "reasons": {"<factorId exactly as given>": string}}. Use the factorId from the list as the key, never the name.',
          },
        },
      )
      const reasonsMs = Math.round(performance.now() - t1)
      console.log(`  reasons: ${reasonsMs} ms, ${Object.keys(explanation.reasons).length}/8 reasons, usage ${JSON.stringify(explanation.usage)}\n  summary: ${explanation.summary}\n  e.g. ${top[0].factorName}: ${explanation.reasons[top[0].factorId]}`)
      expect(Object.keys(explanation.reasons).length).toBeGreaterThanOrEqual(6)
      expect(explanation.summary).toBeTruthy()
    })
  }
})
