import 'server-only'
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto'
import {readFile,open,rename,lstat,unlink} from 'node:fs/promises'
import {dirname,join} from 'node:path'
import {z} from 'zod'
import {privacyLedgerEntrySchema,type PrivacyLedger,type PrivacyLedgerEntry} from './ledger'

const snapshot=z.object({version:z.literal(1),namespace:z.string(),exportedAt:z.iso.datetime({offset:true}),entries:z.array(privacyLedgerEntrySchema).max(10000)})
const envelope=z.object({version:z.literal(1),iv:z.string(),tag:z.string(),ciphertext:z.string()})
export function sealLedgerSnapshot(entries:PrivacyLedgerEntry[],key:Buffer,namespace:string):string {
  if(key.length!==32)throw new Error('privacy_ledger_key_invalid')
  const data=snapshot.parse({version:1,namespace,exportedAt:new Date().toISOString(),entries})
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv)
  cipher.setAAD(Buffer.from(namespace+':snapshot:v1'))
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()])
  return JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')})
}
export function openLedgerSnapshot(value:string,key:Buffer,namespace:string) {
  try {
    const data=envelope.parse(JSON.parse(value)),decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(data.iv,'base64'))
    decipher.setAAD(Buffer.from(namespace+':snapshot:v1'));decipher.setAuthTag(Buffer.from(data.tag,'base64'))
    const result=snapshot.parse(JSON.parse(Buffer.concat([decipher.update(Buffer.from(data.ciphertext,'base64')),decipher.final()]).toString('utf8')))
    if(result.namespace!==namespace)throw new Error('namespace_mismatch')
    return result
  } catch {throw new Error('privacy_ledger_snapshot_integrity_failed')}
}

/** Offline recovery journal. Its directory must be in the approved recovery store. */
export class FilePrivacyLedger implements PrivacyLedger {
  private path:string;private key:Buffer;private namespace:string
  constructor(path:string,key:Buffer,namespace:string){this.path=path;this.key=key;this.namespace=namespace}
  async read():Promise<PrivacyLedgerEntry[]> {
    const stat=await lstat(this.path)
    if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||stat.size>20_000_000)throw new Error('privacy_ledger_file_permissions_invalid')
    return openLedgerSnapshot(await readFile(this.path,'utf8'),this.key,this.namespace).entries
      .filter(entry=>!entry.expiresAt||Date.parse(entry.expiresAt)>Date.now())
  }
  async put(input:PrivacyLedgerEntry):Promise<string> {
    const lock=await open(this.path+'.lock','wx',0o600)
    const temporary=join(dirname(this.path),'.privacy-ledger-'+randomBytes(16).toString('hex'))
    try {
      const entry=privacyLedgerEntrySchema.parse(input),entries=await this.read()
      const updated=[...entries.filter(old=>old.kind!==entry.kind||old.id!==entry.id),entry]
      const encrypted=sealLedgerSnapshot(updated,this.key,this.namespace)
      const file=await open(temporary,'wx',0o600)
      try {await file.writeFile(encrypted);await file.sync()}finally{await file.close()}
      await rename(temporary,this.path)
      const directory=await open(dirname(this.path),'r')
      try{await directory.sync()}finally{await directory.close()}
      return createHash('sha256').update(encrypted).digest('hex')
    } finally {
      await unlink(temporary).catch(()=>{})
      await lock.close();await unlink(this.path+'.lock')
    }
  }
}
