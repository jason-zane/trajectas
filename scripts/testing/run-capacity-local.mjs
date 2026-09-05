#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const source = resolve(here, '../..')
const env = {
  PATH: process.env.PATH,
  TMPDIR: process.env.TMPDIR,
  NODE_ENV: 'test',
  TZ: 'UTC',
  CAPACITY_SOURCE_DIR: source,
}
{
  // Fixed LOCAL container and loopback destination; no production config read.
  // Capture credentials in memory, and never include subprocess output in an error.
  let gateway
  try {
    gateway = execFileSync('docker', ['exec', 'supabase_kong_trajectas-local', 'cat', '/home/kong/kong.yml'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch {
    throw new Error('Unable to read the running local Supabase gateway configuration')
  }
  const localJwtKeys = [...new Set(gateway.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || [])]
  const keyFor = (role) => localJwtKeys.find((token) => {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
      return payload.role === role && payload.iss === 'supabase-demo'
    } catch { return false }
  })
  const serviceKey = keyFor('service_role')
  const anonKey = keyFor('anon')
  if (!serviceKey || !anonKey) throw new Error('Local gateway credential shape was not recognized; no tests were run')
  env.CAPACITY_DB = '1'
  env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
  env.SUPABASE_SERVICE_ROLE_KEY = serviceKey
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey
}
// Intentional allowlist, not {...process.env}: never inherit production keys,
// Redis credentials, report/email integrations, or any .env file.
const result = spawnSync(process.execPath,
  [resolve(source, 'node_modules/vitest/vitest.mjs'), 'run', '--configLoader', 'native', 'tests/integration/assessment-capacity.test.ts', 'tests/integration/report-job-capacity.test.ts'],
  { cwd: source, env, stdio: 'inherit' })
process.exit(result.status ?? 1)
