import { expect, it } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { OpenRouterProvider } from '@/lib/ai/providers/openrouter'
import { LIKERT_VERSION, type LikertSpec, type LikertCandidate, type ReviewerResult } from '@/lib/instrument/likert/contracts'
import { assessItem, parseReview, reviewPrompt } from '@/lib/instrument/likert/review'

const enabled = process.env.LIKERT_LIVE === '1'
const dir = process.env.LIKERT_ARTIFACT_DIR ?? 'output/autonomous-likert'
const models = ['anthropic/claude-sonnet-4-5', 'minimax/minimax-m2.5', 'deepseek/deepseek-v3.2']
const constructDefs = [
  ['Dependability', 'Meeting agreed work commitments. Excludes general sociability, health, family status and long hours.'],
  ['Sociability', 'Seeking and enjoying interaction with other people. Excludes dependable task completion.'],
  ['Autonomy Preference', 'Preferring discretion over work methods rather than prescribed steps. Neither pole is better; this is a preference, not independent-work ability.'],
  ['Team Psychological Safety', 'Perceiving that members of this team can admit mistakes and speak up without humiliation. Referent is the team, not individual courage.'],
  ['Self-rated Numerical Capability', 'Perceived ability to perform basic numerical work tasks; this self-report does not measure actual correct numerical performance.'],
]
const constructs = constructDefs.map(([name, definition], i) => ({ id: `c${i}`, name, definition, exclusions: [], cells: [{ id: `cell${i}`, facetLabel: name, facetDefinition: definition, intensity: 'mid' as const, targetItemCount: 4, displayOrder: 0 }] }))
const spec: LikertSpec = { version: LIKERT_VERSION, measureType: 'trait', brief: 'Adult workplace self-report items for development.', audience: { level: 'entry' }, useContext: 'development', timeframe: 'Past three months', readingCeiling: 8, itemsPerConstruct: 4, reverseProportion: 0.25, scoreDirection: 'Higher scores mean more of the defined construct, not better people.', format: { id: 'fixture', name: '5-point agreement', anchorType: 'agreement', points: 5, anchors: { 1: 'Strongly disagree', 2: 'Disagree', 3: 'Neutral', 4: 'Agree', 5: 'Strongly agree' } }, constructs }
const cases: Array<{ label: string; stem: string; construct: number; shouldPass?: boolean; correctKey?: boolean }> = [
  { label: 'double_barrel', stem: 'I meet deadlines and help my colleagues resolve their disputes.', construct: 0, shouldPass: false },
  { label: 'absolute_virtue', stem: 'I always do perfect work and have never made a mistake.', construct: 0, shouldPass: false },
  { label: 'confusing_negation', stem: 'I do not fail to avoid missing deadlines.', construct: 0, shouldPass: false },
  { label: 'off_construct', stem: 'I enjoy being the centre of attention at parties.', construct: 0, shouldPass: false },
  { label: 'family_status', stem: 'Because I have no children, I can always stay late to finish work.', construct: 0, shouldPass: false },
  { label: 'health_proxy', stem: 'I never take sick leave, which shows how dependable I am.', construct: 0, shouldPass: false },
  { label: 'idiom', stem: 'I knock it out of the park when the chips are down.', construct: 0, shouldPass: false },
  { label: 'forward_control', stem: 'I do the work I have agreed to do.', construct: 0, shouldPass: true, correctKey: false },
  { label: 'wrong_reverse_key', stem: 'I often forget the work tasks I have agreed to do.', construct: 0, correctKey: true },
  { label: 'preference_polarity', stem: 'I prefer to follow set steps rather than choose my own work method.', construct: 2, correctKey: true },
  { label: 'climate_negative_words_forward_key', stem: 'In my team, I can admit a mistake without being mocked.', construct: 3, correctKey: false },
  { label: 'self_rated_capability', stem: 'I feel able to work out the total cost of a purchase.', construct: 4, correctKey: false },
]

it.runIf(enabled)('blindly detects authored defects and infers keys across Likert constructs with real models', async () => {
  mkdirSync(dir, { recursive: true })
  const raw: unknown[] = []
  const results: unknown[] = []
  const items: LikertCandidate[] = cases.map((item, index) => ({ id: `challenge-${index}`, stem: item.stem, reverseScored: false, blueprintCellId: `cell${item.construct}`, status: 'candidate', updatedAt: new Date().toISOString() }))
  for (let offset = 0; offset < items.length; offset += 2) {
    const batch = items.slice(offset, offset + 2)
    const panels = await Promise.all(models.map(async (model, index): Promise<ReviewerResult> => {
      const provider = new OpenRouterProvider({ timeoutMs: 90_000, maxAttempts: 1 })
      let error = ''
      let tokenLimit = 6000
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await provider.complete({ model, prompt: reviewPrompt(spec, batch, index) + (error ? `\nCorrect the previous schema error: ${error}` : ''), responseFormat: 'json', temperature: 0.2, maxTokens: tokenLimit })
        raw.push({ model, response, attempt, offset })
        writeFileSync(`${dir}/challenge-results.json`, JSON.stringify({ results, raw }, null, 2))
        if (response.finishReason === 'length' || (!response.content.trim() && response.usage.outputTokens >= tokenLimit)) { tokenLimit = Math.min(16000, tokenLimit * 2); error = 'Output was truncated. Return complete JSON with concise explanations.'; continue }
        try { return { model, items: parseReview(response.content, batch.map(item => item.id), spec) } } catch (err) { error = String(err) }
      }
      throw new Error(error)
    }))
    batch.forEach(item => results.push({ ...cases[Number(item.id.split('-')[1])], id: item.id, result: assessItem(item, spec, panels), reviews: panels.map(panel => ({ model: panel.model, review: panel.items.find(review => review.id === item.id) })) }))
    writeFileSync(`${dir}/challenge-results.json`, JSON.stringify({ results, raw }, null, 2))
  }
  for (const entry of results as Array<{ label: string; shouldPass?: boolean; correctKey?: boolean; result: ReturnType<typeof assessItem> }>) {
    if (entry.shouldPass !== undefined) expect(entry.result.pass, `${entry.label}: ${entry.result.reasons.join('; ')}`).toBe(entry.shouldPass)
    if (entry.correctKey !== undefined) expect(entry.result.key, entry.label).toBe(entry.correctKey)
  }
}, 600_000)
