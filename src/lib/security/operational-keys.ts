import { createHash, createHmac } from 'node:crypto'

/** Stable per environment/project, with a separate preview-branch namespace. */
export function operationalNamespace(): string {
  const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development'
  const project = process.env.VERCEL_PROJECT_ID ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'local'
  const branch = environment === 'preview' ? process.env.VERCEL_GIT_COMMIT_REF ?? 'preview' : ''
  return `trajectas-v2:${createHash('sha256').update(`${environment}\n${project}\n${branch}`).digest('hex').slice(0, 24)}`
}

/** Domain-separated keyed digest; raw emails, IPs and bearer values never reach Redis. */
export function operationalIdentity(value: string): string {
  const secret = process.env.TRAJECTAS_CONTEXT_SECRET
  const input = `operational-key-v2\0${value}`
  return secret ? createHmac('sha256', secret).update(input).digest('hex')
    : createHash('sha256').update(`${operationalNamespace()}\0${input}`).digest('hex')
}
