const BRANCH = 'codex/personality-preview-ready-20261030'
const DEVELOPMENT_PROJECT = 'bgrvqvtlhmfmvcytncgw'
type PreviewEnvironment = Record<string, string | undefined>
function isDedicatedPreview(env: PreviewEnvironment) {
  return env.VERCEL === '1' && (env.VERCEL_GIT_COMMIT_REF === BRANCH || env.TRAJECTAS_PERSONALITY_PREVIEW_TARGET === DEVELOPMENT_PROJECT)
}
function fail(name: string): never {
  throw new Error(`Personality Preview setup requires ${name}; no deployment should be accepted yet.`)
}
function modernKey(value: string | undefined, role: string) {
  return new RegExp(`^sb_${role === 'anon' ? 'publishable' : 'secret'}_[A-Za-z0-9_-]{20,}$`).test(value ?? '')
}
/** Fail closed before an unconfigured dedicated Preview can build from a Git push.
 * Values are inspected in memory; errors name the missing check, never its value.
 */
export function assertPersonalityPreviewEnvironment(env: PreviewEnvironment) {
  if (!isDedicatedPreview(env)) return
  if (env.VERCEL_ENV !== 'preview') fail('the Preview target')
  if (env.TRAJECTAS_PERSONALITY_PREVIEW_TARGET !== DEVELOPMENT_PROJECT) fail('the dedicated development-target marker')
  if (env.NEXT_PUBLIC_SUPABASE_URL !== `https://${DEVELOPMENT_PROJECT}.supabase.co`) fail('the verified development database URL')
  for (const [key, role] of [['NEXT_PUBLIC_SUPABASE_ANON_KEY','anon'],['SUPABASE_SERVICE_ROLE_KEY','service_role']]) {
    // Opaque keys are authenticated against this exact Dev project below.
    if (modernKey(env[key], role)) continue
    try {
      const payload = JSON.parse(Buffer.from((env[key] ?? '').split('.')[1], 'base64url').toString())
      if (payload.ref !== DEVELOPMENT_PROJECT || payload.role !== role) fail(`a verified development ${key}`)
    } catch { fail(`a verified development ${key}`) }
  }
  for (const key of ['TRAJECTAS_CONTEXT_SECRET','REPORT_ACCESS_TOKEN_SECRET','REPORT_PDF_TOKEN_SECRET','INTERNAL_API_KEY','CRON_SECRET']) if ((env[key]?.length ?? 0) < 32) fail(`dedicated ${key}`)
  if (!env.VERCEL_AUTOMATION_BYPASS_SECRET) fail('Vercel automation access for report generation and printing')
  const hosts = ['PUBLIC_APP_URL','ADMIN_APP_URL','ASSESS_APP_URL','PARTNER_APP_URL','CLIENT_APP_URL'].map(key => {
    try { const url = new URL(env[key] ?? ''); if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app')) fail(`an isolated ${key}`); return url.host }
    catch { return fail(`an isolated ${key}`) }
  })
  if (new Set(hosts).size !== 5) fail('five separate Preview surface hosts')
  if (env.COOKIE_DOMAIN || env.NEXT_PUBLIC_COOKIE_DOMAIN || env.TRAJECTAS_ALLOW_DEV_BYPASS) fail('isolated session cookies and deployed authentication')
  for (const key of ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','OpenRouter_API_KEY','OPENROUTER_MANAGEMENT_KEY','RESEND_API_KEY']) if (env[key]) fail(`disabled ${key} during synthetic acceptance`)
  if (env.INTERNAL_INTEGRATIONS_API_ENABLED !== 'false') fail('disabled external integrations')
}

/** Modern keys contain no project/role claims. Verify them through the exact Dev
 * API, entirely inside Vercel; never retrieve or log the inherited server key.
 * The capability table is SELECT-accessible only to service_role.
 */
export async function verifyPersonalityPreviewEnvironment(env: PreviewEnvironment, request: typeof fetch = fetch) {
  assertPersonalityPreviewEnvironment(env)
  if (!isDedicatedPreview(env)) return
  for (const [key, role, path] of [
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon', '/auth/v1/settings'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'service_role', '/rest/v1/norm_reporting_capabilities?select=editions_enabled&singleton=eq.true'],
  ]) {
    if (!modernKey(env[key], role)) continue
    try {
      const response = await request(`https://${DEVELOPMENT_PROJECT}.supabase.co${path}`, {
        headers: { apikey: env[key]! }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) fail(`a verified development ${key}`)
      if (role === 'service_role') {
        const rows: unknown = await response.json()
        if (!Array.isArray(rows) || rows.length !== 1 || typeof rows[0]?.editions_enabled !== 'boolean') fail(`a verified development ${key}`)
      }
    } catch { fail(`a verified development ${key}`) }
  }
}
