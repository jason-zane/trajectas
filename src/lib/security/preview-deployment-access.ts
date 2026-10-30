import 'server-only'

/** Vercel protection is separate from application authentication. Send its
 * automation credential only to this Preview's configured admin origin. */
export function previewDeploymentHeaders(
  target: string,
  env: Record<string, string | undefined> = process.env,
): Record<string, string> {
  if (env.VERCEL_ENV !== 'preview' || !env.VERCEL_AUTOMATION_BYPASS_SECRET) return {}
  try {
    const url = new URL(target)
    const admin = new URL(env.ADMIN_APP_URL ?? '')
    if (url.protocol !== 'https:' || url.username || url.password ||
      !url.hostname.endsWith('.vercel.app') || url.origin !== admin.origin) return {}
    return { 'x-vercel-protection-bypass': env.VERCEL_AUTOMATION_BYPASS_SECRET }
  } catch {
    return {}
  }
}
