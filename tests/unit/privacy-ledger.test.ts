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
    const redis={get:vi.fn().mockResolvedValue('privacy-ledger-v1'),zcard:vi.fn().mockResolvedValue(1),zrange:vi.fn().mockImplementation((_key,_min,_max,options)=>options?.byScore?[]:[member]),mget:vi.fn().mockResolvedValue([null]),zscore:vi.fn().mockResolvedValue(Date.now()+86400000),eval:vi.fn()}
    const ledger=new RedisPrivacyLedger(redis as unknown as Redis,key,'synthetic-production')
    await expect(ledger.read()).rejects.toThrow('privacy_ledger_record_missing')
    expect(redis.eval).not.toHaveBeenCalled()
  })
  it('allows an expired missing record to be pruned without hiding a live record', async () => {
    const redis={get:vi.fn().mockResolvedValue('privacy-ledger-v1'),zcard:vi.fn().mockResolvedValue(0),zrange:vi.fn().mockResolvedValueOnce([member]).mockResolvedValue([]),mget:vi.fn(),zscore:vi.fn(),eval:vi.fn().mockResolvedValue(1)}
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

  function indexFixture() {
    const index=new Map<string,number>(),values=new Map<string,unknown>()
    const memberOf=(value:string)=>value.match(/(?:deletion|hold|account):[^:]+$/)![0]
    const beforePrune=vi.fn()
    const redis={
      get:vi.fn().mockResolvedValue('privacy-ledger-v1'),
      zcard:vi.fn(async()=>index.size),
      zrange:vi.fn(async(_key:string,min:number,max:number,options?:{byScore?:boolean;offset?:number;count?:number})=>{
        const sorted=[...index].sort((a,b)=>a[1]-b[1]).filter(([,score])=>!options?.byScore||(score>=min&&score<=max)).map(([id])=>id)
        return options?.byScore?sorted.slice(options.offset??0,(options.offset??0)+(options.count??sorted.length)):sorted
      }),
      mget:vi.fn(async(...keys:string[])=>keys.map(value=>values.get(memberOf(value))??null)),
      zscore:vi.fn(async(_key:string,id:string)=>index.get(id)??null),
      eval:vi.fn(async(_script:string,keys:string[],args:Array<string|number>)=>{
        beforePrune()
        let removed=0
        for(const key of keys.slice(1)){
          const id=memberOf(key),score=index.get(id)
          if(score!==undefined&&score<=Number(args[0])&&!values.has(id)){index.delete(id);removed++}
        }
        return removed
      }),
    }
    return {index,values,redis,beforePrune,ledger:new RedisPrivacyLedger(redis as unknown as Redis,key,'synthetic-production')}
  }
  it('recovers after more than 10,000 expired index members without losing live recovery data',async()=>{
    const f=indexFixture()
    for(let n=0;n<10001;n++)f.index.set('deletion:'+randomUUID(),Date.now()-1000)
    f.index.set(member,Date.parse(entry.expiresAt));f.values.set(member,sealLedgerEntry(entry,key,'synthetic-production'))
    await expect(f.ledger.read()).resolves.toEqual([entry])
    expect([...f.index.keys()]).toEqual([member])
    expect(f.redis.eval.mock.calls.length).toBeGreaterThan(1)
  })
  it('retains the capacity guard when more than 10,000 live entries remain',async()=>{
    const f=indexFixture()
    for(let n=0;n<10001;n++)f.index.set('deletion:'+randomUUID(),Date.now()+86400000)
    await expect(f.ledger.read()).rejects.toThrow('privacy_ledger_review_capacity')
    expect(f.redis.mget).not.toHaveBeenCalled()
  })
  it('keeps a member renewed between expired selection and atomic pruning',async()=>{
    const f=indexFixture();f.index.set(member,Date.now()-1000)
    f.beforePrune.mockImplementationOnce(()=>{f.index.set(member,Date.parse(entry.expiresAt));f.values.set(member,sealLedgerEntry(entry,key,'synthetic-production'))})
    await expect(f.ledger.read()).resolves.toEqual([entry])
    expect(f.index.has(member)).toBe(true)
    expect(f.redis.eval.mock.calls[0]?.[0]).toContain("redis.call('ZSCORE'")
  })
  it('still stops on a missing live record after pruning an expired backlog',async()=>{
    const f=indexFixture()
    for(let n=0;n<10001;n++)f.index.set('deletion:'+randomUUID(),Date.now()-1000)
    f.index.set(member,Date.parse(entry.expiresAt))
    await expect(f.ledger.read()).rejects.toThrow('privacy_ledger_record_missing')
    expect(f.index.has(member)).toBe(true)
  })
  it('keeps active holds with no TTL while pruning expired deletion entries',async()=>{
    const f=indexFixture(),hold={kind:'hold' as const,id:randomUUID(),campaignId:randomUUID(),participantId:null,status:'active' as const,reviewAt:new Date().toISOString(),expiresAt:null}
    const holdMember='hold:'+hold.id
    f.index.set('deletion:'+randomUUID(),Date.now()-1000)
    f.index.set(holdMember,Number.MAX_SAFE_INTEGER);f.values.set(holdMember,sealLedgerEntry(hold,key,'synthetic-production'))
    await expect(f.ledger.read()).resolves.toEqual([hold])
    expect([...f.index.keys()]).toEqual([holdMember])
  })
})
