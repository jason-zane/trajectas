import {timingSafeEqual} from 'node:crypto'
import {NextResponse} from 'next/server'
import {sweepAccountDeletions} from '@/lib/privacy/account-deletion'
import {reportError} from '@/lib/observability/report-error'
import {dataLifecycleMode} from '@/lib/privacy/types'

export const runtime='nodejs'
export const maxDuration=60

export async function GET(request:Request):Promise<Response> {
  const secret=process.env.CRON_SECRET
  if(!secret)return new Response('Not configured',{status:503})
  const expected=Buffer.from(`Bearer ${secret}`),actual=Buffer.from(request.headers.get('authorization')??'')
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return new Response('Unauthorized',{status:401})
  if(dataLifecycleMode()!=='execute')return NextResponse.json({mode:'plan',swept:0,errors:0})
  try {
    const result=await sweepAccountDeletions()
    if(result.errors || result.blocked)await reportError(new Error('Account disposal requires operator review'),{source:'cron.account-deletion',severity:'fatal',context:{swept:result.swept,failed:result.errors},alert:true})
    return NextResponse.json({ok:true,...result})
  } catch {
    await reportError(new Error('Account disposal could not complete'),{source:'cron.account-deletion',severity:'fatal',alert:true})
    return NextResponse.json({ok:false,error:'Account disposal requires operator review'},{status:503})
  }
}
