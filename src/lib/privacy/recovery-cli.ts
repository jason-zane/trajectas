import {writeFile} from 'node:fs/promises'
import {createClient} from '@supabase/supabase-js'
import {createPrivacyLedger} from './ledger'
import {FilePrivacyLedger,sealLedgerSnapshot} from './file-ledger'
import {operationalNamespace} from '@/lib/security/operational-keys'
import {replayPrivacyLedger} from './recovery'

async function main() {
  const args=process.argv.slice(2),value=(flag:string)=>{const i=args.indexOf(flag);return i<0?undefined:args[i+1]}
  if(args.includes('--help')||args.length===0){console.log('Privacy recovery: --initialize-ledger | --export-ledger <private-file> | --target <quarantined-url> [--execute --confirm-quarantined] [--ledger-file <current-private-file> --confirm-current-ledger]. Default is plan. Target key: PRIVACY_RECOVERY_SERVICE_ROLE_KEY. Source ledger settings and namespace remain unchanged.');return}
  const namespace=operationalNamespace(),encoded=process.env.PRIVACY_LEDGER_ENCRYPTION_KEY
  if(!encoded||!/^[A-Za-z0-9+/]{43}=$/.test(encoded))throw new Error('privacy_ledger_key_invalid')
  const key=Buffer.from(encoded,'base64')
  if(args.includes('--initialize-ledger')) {
    if(!args.includes('--confirm-new-ledger'))throw new Error('confirm_new_ledger_required_never_reinitialize_a_lost_ledger')
    await createPrivacyLedger().initialize();console.log(JSON.stringify({initialized:true,namespace}));return
  }
  const file=value('--ledger-file')
  if(file&&!args.includes('--confirm-current-ledger'))throw new Error('offline_ledger_currency_confirmation_required')
  const ledger=file?new FilePrivacyLedger(file,key,namespace):createPrivacyLedger()
  const exportPath=value('--export-ledger')
  if(exportPath){await writeFile(exportPath,sealLedgerSnapshot(await ledger.read(),key,namespace),{mode:0o600,flag:'wx'});console.log(JSON.stringify({exported:true}));return}
  const target=value('--target'),token=process.env.PRIVACY_RECOVERY_SERVICE_ROLE_KEY
  if(!target||!token)throw new Error('recovery_target_configuration_required')
  const db=createClient(target,token,{auth:{persistSession:false,autoRefreshToken:false}})
  const result=await replayPrivacyLedger({client:db,ledger,targetUrl:target,execute:args.includes('--execute'),quarantined:args.includes('--confirm-quarantined'),approvedHostedTarget:process.env.PRIVACY_RECOVERY_APPROVED_TARGET})
  console.log(JSON.stringify(result))
  if(result.blocked)process.exitCode=2
}
main().catch(()=>{console.error('Privacy recovery stopped. Keep the target quarantined; review configuration, ledger integrity and recovery evidence.');process.exitCode=1})
