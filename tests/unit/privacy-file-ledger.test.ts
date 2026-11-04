import {randomUUID} from 'node:crypto'
import {mkdtemp,writeFile,readFile,rm,chmod} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {describe,expect,it} from 'vitest'
import {FilePrivacyLedger,openLedgerSnapshot,sealLedgerSnapshot} from '@/lib/privacy/file-ledger'
import type {PrivacyLedgerEntry} from '@/lib/privacy/ledger'
describe('offline encrypted recovery journal',()=>{
  const key=Buffer.alloc(32,7),namespace='synthetic-recovery'
  const entry:PrivacyLedgerEntry={kind:'hold',id:randomUUID(),campaignId:randomUUID(),participantId:null,status:'active',reviewAt:new Date().toISOString(),expiresAt:null}
  it('authenticates the whole snapshot including entry membership and environment',()=>{
    const encrypted=sealLedgerSnapshot([entry],key,namespace)
    expect(encrypted).not.toContain(entry.campaignId)
    expect(openLedgerSnapshot(encrypted,key,namespace).entries).toEqual([entry])
    expect(()=>openLedgerSnapshot(encrypted,key,'different-environment')).toThrow('integrity')
    const tampered=JSON.parse(encrypted);tampered.ciphertext=tampered.ciphertext.slice(0,-4)+'AAAA'
    expect(()=>openLedgerSnapshot(JSON.stringify(tampered),key,namespace)).toThrow('integrity')
  })
  it('writes encrypted recovery changes and rejects broadly readable journal files',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'privacy-ledger-test-')),path=join(directory,'ledger.enc')
    try {
      await writeFile(path,sealLedgerSnapshot([],key,namespace),{mode:0o600})
      const ledger=new FilePrivacyLedger(path,key,namespace)
      expect(await ledger.put(entry)).toMatch(/^[a-f0-9]{64}$/)
      expect(await ledger.read()).toEqual([entry])
      expect(await readFile(path,'utf8')).not.toContain(entry.campaignId)
      await chmod(path,0o644)
      await expect(ledger.read()).rejects.toThrow('permissions')
    } finally {await rm(directory,{recursive:true,force:true})}
  })
})
