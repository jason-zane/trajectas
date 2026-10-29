/** Explicit hosted-development target. Never reads primary .env.local. */
export const DEVELOPMENT_PROJECT_REF = 'bgrvqvtlhmfmvcytncgw'
export function requireDevelopmentDatabaseUrl(value) {
  let url
  try { url = new URL(value ?? '') } catch { throw new Error('Set TRAJECTAS_DEVELOPMENT_DATABASE_URL to the development Postgres connection URL.') }
  const direct = url.hostname === `db.${DEVELOPMENT_PROJECT_REF}.supabase.co`
  const pooled = url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username) === `postgres.${DEVELOPMENT_PROJECT_REF}`
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || (!direct && !pooled) || url.pathname !== '/postgres' || !url.password || url.search) {
    throw new Error('Refusing database access: only the approved Trajectas development project is allowed.')
  }
  return url.href
}
