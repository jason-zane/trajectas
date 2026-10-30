const BRANCH = 'codex/personality-preview-ready-20261030'
const DEVELOPMENT_PROJECT = 'bgrvqvtlhmfmvcytncgw'
/** Fail closed before an unconfigured dedicated Preview can build from a Git push.
 * Values are inspected in memory; errors name the missing check, never its value.
 */
export function assertPersonalityPreviewEnvironment(env: Record<string, string | undefined>) {
  if (env.VERCEL !== '1' || (env.VERCEL_GIT_COMMIT_REF !== BRANCH && env.TRAJECTAS_PERSONALITY_PREVIEW_TARGET !== DEVELOPMENT_PROJECT)) return
  const fail = (name: string): never => { throw new Error(`Personality Preview setup requires ${name}; no deployment should be accepted yet.`) }
  if (env.VERCEL_ENV !== 'preview') fail('the Preview target')
  if (env.TRAJECTAS_PERSONALITY_PREVIEW_TARGET !== DEVELOPMENT_PROJECT) fail('the dedicated development-target marker')
  if (env.NEXT_PUBLIC_SUPABASE_URL !== `https://${DEVELOPMENT_PROJECT}.supabase.co`) fail('the verified development database URL')
  for (const [key, role] of [['NEXT_PUBLIC_SUPABASE_ANON_KEY','anon'],['SUPABASE_SERVICE_ROLE_KEY','service_role']]) {
    try {
      const payload = JSON.parse(Buffer.from((env[key] ?? '').split('.')[1], 'base64url').toString())
      if (payload.ref !== DEVELOPMENT_PROJECT || payload.role !== role) fail(`a verified development ${key}`)
    } catch { fail(`a verified development ${key}`) }
  }
  for (const key of ['TRAJECTAS_CONTEXT_SECRET','REPORT_ACCESS_TOKEN_SECRET','REPORT_PDF_TOKEN_SECRET','INTERNAL_API_KEY','CRON_SECRET']) if ((env[key]?.length ?? 0) < 32) fail(`dedicated ${key}`)
  const hosts = ['PUBLIC_APP_URL','ADMIN_APP_URL','ASSESS_APP_URL','PARTNER_APP_URL','CLIENT_APP_URL'].map(key => {
    try { const url = new URL(env[key] ?? ''); if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app')) fail(`an isolated ${key}`); return url.host }
    catch { return fail(`an isolated ${key}`) }
  })
  if (new Set(hosts).size !== 5) fail('five separate Preview surface hosts')
  if (env.COOKIE_DOMAIN || env.NEXT_PUBLIC_COOKIE_DOMAIN || env.TRAJECTAS_ALLOW_DEV_BYPASS) fail('isolated session cookies and deployed authentication')
  for (const key of ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','OpenRouter_API_KEY','OPENROUTER_MANAGEMENT_KEY','RESEND_API_KEY']) if (env[key]) fail(`disabled ${key} during synthetic acceptance`)
  if (env.INTERNAL_INTEGRATIONS_API_ENABLED !== 'false') fail('disabled external integrations')
}
