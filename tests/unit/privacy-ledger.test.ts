import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { Redis } from '@upstash/redis'
import { openLedgerEntry, sealLedgerEntry, RedisPrivacyLedger, type DeletionLedgerEntry } from '@/lib/privacy/ledger'

describe('encrypted independent deletion ledger', () => {
  const key = Buffer.alloc(32, 5)
  const entry: DeletionLedgerEntry = {
    kind: 'deletion', id: randomUUID(), participantId:randomUUID(),participantIds: [randomUUID()], sessionIds: [randomUUID()],
    snapshotIds: [randomUUID()], objects: [{ bucket: 'reports', path: 'reports/private-id/private.pdf' }],
    campaignId: randomUUID(), approvedAt: new Date().toISOString(), policyVersion: 'synthetic-v1',
    backupDays: 7, expiresAt: new Date(Date.now() + 8 * 86400000).toISOString(),
  }
  const member = entry.kind + ':' + entry.id
  it('keeps identifiers and object paths out of stored ciphertext and round trips them', () => {
    const sealed = sealLedgerEntry(entry, key, 'synthetic-production')
    const serialized = JSON.stringify(sealed)
    expect(serialized).not.toContain(entry.participantIds[0])
    expect(serialized).not.toContain('private.pdf')
    expect(openLedgerEntry(sealed, key, 'synthetic-production', member)).toEqual(entry)
  })
  it('rejects substitution between records or environments and authenticated tampering', () => {
    const sealed = sealLedgerEntry(entry, key, 'synthetic-production')
    expect(() => openLedgerEntry(sealed, key, 'synthetic-preview', member)).toThrow('privacy_ledger_integrity_failed')
    expect(() => openLedgerEntry(sealed, key, 'synthetic-production', 'deletion:' + randomUUID())).toThrow('privacy_ledger_integrity_failed')
    const bytes = Buffer.from(sealed.ciphertext, 'base64'); bytes[0] ^= 1
    expect(() => openLedgerEntry({ ...sealed, ciphertext: bytes.toString('base64') }, key, 'synthetic-production', member)).toThrow('privacy_ledger_integrity_failed')
  })
  it('uses a fresh nonce for every write', () => {
    const a = sealLedgerEntry(entry, key, 'synthetic-production'), b = sealLedgerEntry(entry, key, 'synthetic-production')
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })
  it('stops after whole-ledger loss instead of treating it as an empty queue', async () => {
    const redis={get:vi.fn().mockResolvedValue(null),zcard:vi.fn(),multi:vi.fn()}
    const ledger=new RedisPrivacyLedger(redis as unknown as Redis,key,'synthetic-production')
    await expect(ledger.read()).rejects.toThrow('privacy_ledger_not_initialized')
    await expect(ledger.put(entry)).rejects.toThrow('privacy_ledger_not_initialized')
    expect(redis.zcard).not.toHaveBeenCalled()
    expect(redis.multi).not.toHaveBeenCalled()
  })
  it('stops when an unexpired indexed recovery record is missing', async () => {
    const redis={get:vi.fn().mockResolvedValue('privacy-ledger-v1'),zcard:vi.fn().mockResolvedValue(1),zrange:vi.fn().mockResolvedValue([member]),mget:vi.fn().mockResolvedValue([null]),zscore:vi.fn().mockResolvedValue(Date.now()+86400000),eval:vi.fn()}
    const ledger=new RedisPrivacyLedger(redis as unknown as Redis,key,'synthetic-production')
    await expect(ledger.read()).rejects.toThrow('privacy_ledger_record_missing')
    expect(redis.eval).not.toHaveBeenCalled()
  })
  it('allows an expired missing record to be pruned without hiding a live record', async () => {
    const redis={get:vi.fn().mockResolvedValue('privacy-ledger-v1'),zcard:vi.fn().mockResolvedValue(1),zrange:vi.fn().mockResolvedValue([member]),mget:vi.fn().mockResolvedValue([null]),zscore:vi.fn().mockResolvedValue(Date.now()-1000),eval:vi.fn().mockResolvedValue(1)}
    const ledger=new RedisPrivacyLedger(redis as unknown as Redis,key,'synthetic-production')
    await expect(ledger.read()).resolves.toEqual([])
    expect(redis.eval).toHaveBeenCalledOnce()
    expect(redis.eval.mock.calls[0]?.[0]).toContain("redis.call('EXISTS'")
  })
  it('does not initialize over an existing recovery index', async () => {
    const redis={zcard:vi.fn().mockResolvedValue(1),set:vi.fn()}
    const ledger=new RedisPrivacyLedger(redis as unknown as Redis,key,'synthetic-production')
    await expect(ledger.initialize()).rejects.toThrow('privacy_ledger_initialization_requires_review')
    expect(redis.set).not.toHaveBeenCalled()
  })
})
