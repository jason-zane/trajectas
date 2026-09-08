/** Explicit opt-in: real model calls, exclusively local database fixtures. */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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
try {
  execFileSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...(tests.length ? tests : ['tests/benchmarks/autonomous-likert-live.test.ts', 'tests/benchmarks/likert-review-challenges.test.ts'])], { env, stdio: 'inherit' })
} catch { process.exitCode = 1 }
