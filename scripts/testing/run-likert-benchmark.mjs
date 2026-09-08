/** Explicit opt-in: real model calls, exclusively local database fixtures. */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseEnv } from 'node:util'

const source = process.env.LIKERT_ENV_FILE ? parseEnv(readFileSync(process.env.LIKERT_ENV_FILE, 'utf8')) : {}
const apiKey = process.env.OpenRouter_API_KEY ?? source.OpenRouter_API_KEY
if (!apiKey) throw new Error('Set OpenRouter_API_KEY, or LIKERT_ENV_FILE pointing to a file containing it. Real model calls incur usage charges.')
const local = parseEnv(execFileSync(process.env.SUPABASE_BIN ?? 'supabase', ['status', '-o', 'env'], { encoding: 'utf8' }))
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(local.API_URL ?? '')) throw new Error('Local Supabase database required')
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
  OpenRouter_API_KEY: apiKey,
  LIKERT_LIVE: '1',
}
const tests = process.argv.slice(2)
const artifactDir = process.env.LIKERT_ARTIFACT_DIR ?? 'output/autonomous-likert'
mkdirSync(`${artifactDir}/run-manifests`, { recursive: true })
const startedAt = new Date().toISOString()
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
let uncommittedTrackedChanges = false
try { execFileSync('git', ['diff', '--quiet', 'HEAD']) } catch { uncommittedTrackedChanges = true }
const sourceHashes = Object.fromEntries(['contracts', 'pipeline', 'generation', 'review', 'form-review', 'identity'].map(name => {
  const path = `src/lib/instrument/likert/${name}.ts`
  return [path, createHash('sha256').update(readFileSync(path)).digest('hex')]
}))
writeFileSync(`${artifactDir}/run-manifests/${startedAt.replaceAll(':', '-')}.json`, JSON.stringify({ startedAt, revision, uncommittedTrackedChanges, sourceHashes, tests, resumeBuild: process.env.LIKERT_RESUME_BUILD ?? null, scenario: process.env.LIKERT_SCENARIO ?? 'behaviour', itemsPerConstruct: Number(process.env.LIKERT_ITEMS_PER_CONSTRUCT ?? 6), models: JSON.parse(readFileSync(process.env.LIKERT_MODEL_SNAPSHOT ?? 'tests/benchmarks/likert-models.json', 'utf8')) }, null, 2))
try {
  execFileSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...(tests.length ? tests : ['tests/benchmarks/autonomous-likert-live.test.ts', 'tests/benchmarks/likert-review-challenges.test.ts'])], { env, stdio: 'inherit' })
} catch { process.exitCode = 1 }
