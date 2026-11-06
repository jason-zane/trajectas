import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { Redis } from '@upstash/redis'
import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'
import { operationalNamespace } from '@/lib/security/operational-keys'
import { objectReferenceSchema } from './types'

const deletionEntry = z.object({
  kind: z.literal('deletion'),
  id: postgresUuid(),
  participantId: postgresUuid(),
  participantIds: z.array(postgresUuid()).min(1),
  // Older encrypted entries remain readable, but cannot prove rater erasure.
  raterIds: z.array(postgresUuid()).optional(),
  holdParticipantIds: z.array(postgresUuid()).optional(),
  sessionIds: z.array(postgresUuid()),
  snapshotIds: z.array(postgresUuid()),
  objects: z.array(objectReferenceSchema),
  campaignId: postgresUuid(),
  approvedAt: z.iso.datetime({ offset: true }),
  policyVersion: z.string().min(1).max(80),
  backupDays: z.number().int().min(1).max(365),
  expiresAt: z.iso.datetime({ offset: true }),
})
const holdEntry = z.object({
  kind: z.literal('hold'),
  id: postgresUuid(),
  campaignId: postgresUuid(),
  participantId: postgresUuid().nullable(),
  status: z.enum(['active', 'released']),
  reviewAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
})
const accountEntry = z.object({
  kind:z.literal('account'),id:postgresUuid(),profileId:postgresUuid(),requestedAt:z.iso.datetime({offset:true}),
  expiresAt:z.iso.datetime({offset:true}),backupDays:z.number().int().min(1).max(365),
})
export const privacyLedgerEntrySchema = z.discriminatedUnion('kind', [deletionEntry, holdEntry, accountEntry])
export type PrivacyLedgerEntry = z.infer<typeof privacyLedgerEntrySchema>
export type DeletionLedgerEntry = z.infer<typeof deletionEntry>
export type HoldLedgerEntry = z.infer<typeof holdEntry>
export interface PrivacyLedger {
  put(entry: PrivacyLedgerEntry): Promise<string>
  read(): Promise<PrivacyLedgerEntry[]>
}

const envelopeSchema = z.object({ version: z.literal(1), iv: z.string(), tag: z.string(), ciphertext: z.string() })
export type LedgerEnvelope = z.infer<typeof envelopeSchema>

const PRUNE_EXPIRED_ABSENT = "local n=0; for i=2,#KEYS do local score=redis.call('ZSCORE',KEYS[1],ARGV[i]); if score and tonumber(score)<=tonumber(ARGV[1]) and redis.call('EXISTS',KEYS[i])==0 then n=n+redis.call('ZREM',KEYS[1],ARGV[i]) end end; return n"
const validMember = (member: string) => /^(deletion|hold|account):[0-9a-f-]{36}$/i.test(member)

/** Encryption binds each record to its environment, type and request ID. */
export function sealLedgerEntry(entry: PrivacyLedgerEntry, key: Buffer, namespace: string): LedgerEnvelope {
  privacyLedgerEntrySchema.parse(entry)
  if (key.length !== 32) throw new Error('privacy_ledger_key_invalid')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(namespace + ':' + entry.kind + ':' + entry.id))
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(entry), 'utf8'), cipher.final()])
  return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') }
}

export function openLedgerEntry(envelope: unknown, key: Buffer, namespace: string, member: string): PrivacyLedgerEntry {
  try {
    const e = envelopeSchema.parse(typeof envelope === 'string' ? JSON.parse(envelope) : envelope)
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(e.iv, 'base64'))
    decipher.setAAD(Buffer.from(namespace + ':' + member))
    decipher.setAuthTag(Buffer.from(e.tag, 'base64'))
    const plaintext = Buffer.concat([decipher.update(Buffer.from(e.ciphertext, 'base64')), decipher.final()])
    const entry = privacyLedgerEntrySchema.parse(JSON.parse(plaintext.toString('utf8')))
    if (member !== entry.kind + ':' + entry.id) throw new Error('identity_mismatch')
    return entry
  } catch { throw new Error('privacy_ledger_integrity_failed') }
}

export class RedisPrivacyLedger implements PrivacyLedger {
  private readonly prefix: string
  private readonly redis: Redis
  private readonly key: Buffer
  private readonly namespace: string
  constructor(redis: Redis, key: Buffer, namespace: string) {
    this.redis=redis;this.key=key;this.namespace=namespace
    if (key.length !== 32) throw new Error('privacy_ledger_key_invalid')
    const tag = createHash('sha256').update(namespace).digest('hex').slice(0, 24)
    this.prefix = namespace + ':privacy-ledger:{' + tag + '}'
  }
  async initialize(): Promise<void> {
    if (await this.redis.zcard(this.prefix+':index')!==0) throw new Error('privacy_ledger_initialization_requires_review')
    const initialized=await this.redis.set(this.prefix+':initialized','privacy-ledger-v1',{nx:true})
    if(initialized!=='OK')throw new Error('privacy_ledger_already_initialized')
  }
  async put(input: PrivacyLedgerEntry): Promise<string> {
    if(await this.redis.get(this.prefix+':initialized')!=='privacy-ledger-v1')throw new Error('privacy_ledger_not_initialized')
    const entry = privacyLedgerEntrySchema.parse(input)
    const member = entry.kind + ':' + entry.id
    const envelope = sealLedgerEntry(entry, this.key, this.namespace)
    const recordKey = this.prefix + ':' + member
    const expiry = entry.expiresAt ? Math.ceil((Date.parse(entry.expiresAt) - Date.now()) / 1000) : null
    if (expiry !== null && (expiry <= 0 || expiry > 367 * 86400)) throw new Error('privacy_ledger_expiry_invalid')
    const transaction = this.redis.multi()
    if (expiry === null) transaction.set(recordKey, envelope)
    else transaction.set(recordKey, envelope, { ex: expiry })
    transaction.zadd(this.prefix + ':index', { score: entry.expiresAt ? Date.parse(entry.expiresAt) : Number.MAX_SAFE_INTEGER, member })
    const result = await transaction.exec()
    if (result[0] !== 'OK' || typeof result[1] !== 'number') throw new Error('privacy_ledger_write_unconfirmed')
    return createHash('sha256').update(JSON.stringify(envelope)).digest('hex')
  }
  async read(): Promise<PrivacyLedgerEntry[]> {
    if(await this.redis.get(this.prefix+':initialized')!=='privacy-ledger-v1')throw new Error('privacy_ledger_not_initialized')
    const index = this.prefix + ':index'
    const started = Date.now()
    // Record TTLs do not remove sorted-set members. Clean expired, absent
    // records before capacity enforcement; recheck score and existence inside
    // Redis so a concurrent renewal cannot lose its recovery index entry.
    let offset = 0
    for (;;) {
      if (Date.now() - started > 20000) throw new Error('privacy_ledger_read_budget')
      const expired = await this.redis.zrange<string[]>(index, Number.MIN_SAFE_INTEGER, started, { byScore: true, offset, count: 1000 })
      if (!expired.length) break
      if (expired.some(member => !validMember(member))) throw new Error('privacy_ledger_index_invalid')
      const removed = await this.redis.eval<Array<string|number>,number>(PRUNE_EXPIRED_ABSENT,
        [index, ...expired.map(member => this.prefix + ':' + member)], [started, ...expired])
      if (!Number.isInteger(removed) || removed < 0 || removed > expired.length) throw new Error('privacy_ledger_prune_unconfirmed')
      // Existing ciphertext may live for the final fraction of its TTL. Skip
      // those retained members rather than repeatedly reading the same page.
      offset += expired.length - removed
      if (expired.length < 1000) break
    }
    if (await this.redis.zcard(index) > 10000) throw new Error('privacy_ledger_review_capacity')
    const members = await this.redis.zrange<string[]>(index, 0, -1)
    const result: PrivacyLedgerEntry[] = []
    for (let offset = 0; offset < members.length; offset += 50) {
      if (Date.now() - started > 20000) throw new Error('privacy_ledger_read_budget')
      const batch = members.slice(offset, offset + 50)
      if (batch.some(member => !validMember(member))) throw new Error('privacy_ledger_index_invalid')
      const envelopes = await this.redis.mget<(LedgerEnvelope | null)[]>(...batch.map(member => this.prefix + ':' + member))
      const missing: string[] = []
      for (let i = 0; i < batch.length; i++) {
        if (!envelopes[i]) {
          const expectedExpiry = await this.redis.zscore(index,batch[i])
          if (expectedExpiry === null || Number(expectedExpiry)>Date.now()) throw new Error('privacy_ledger_record_missing')
          missing.push(batch[i]); continue
        }
        const entry = openLedgerEntry(envelopes[i], this.key, this.namespace, batch[i])
        if (!entry.expiresAt || Date.parse(entry.expiresAt) > Date.now()) result.push(entry)
      }
      if (missing.length) {
        // Prune only if still absent: a concurrent successful write wins.
        await this.redis.eval(PRUNE_EXPIRED_ABSENT, [index, ...missing.map(member => this.prefix + ':' + member)], [Date.now(), ...missing])
      }
    }
    return result
  }
}

export function createPrivacyLedger(): RedisPrivacyLedger {
  const encoded = process.env.PRIVACY_LEDGER_ENCRYPTION_KEY
  const dedicatedUrl = process.env.PRIVACY_LEDGER_REDIS_REST_URL
  const dedicatedToken = process.env.PRIVACY_LEDGER_REDIS_REST_TOKEN
  // A partially configured dedicated store must never fall back to shared cache
  // credentials or mix a URL and token from different databases.
  const dedicated = dedicatedUrl !== undefined || dedicatedToken !== undefined
  const url = dedicated ? dedicatedUrl : process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = dedicated ? dedicatedToken : process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!encoded || !url || !token || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error('privacy_ledger_not_configured')
  return new RedisPrivacyLedger(new Redis({ url, token, retry: false, signal: () => AbortSignal.timeout(3000) }), Buffer.from(encoded, 'base64'), operationalNamespace())
}
