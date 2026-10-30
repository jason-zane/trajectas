import { expect, it } from 'vitest'
import { assertPersonalityPreviewEnvironment } from '@/lib/next-config/personality-preview-safety'
const jwt=(role:string,ref='bgrvqvtlhmfmvcytncgw')=>`synthetic.${Buffer.from(JSON.stringify({role,ref})).toString('base64url')}.synthetic`
function ready():Record<string,string>{return {
 VERCEL:'1',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/personality-preview-ready-20261030',TRAJECTAS_PERSONALITY_PREVIEW_TARGET:'bgrvqvtlhmfmvcytncgw',NEXT_PUBLIC_SUPABASE_URL:'https://bgrvqvtlhmfmvcytncgw.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:jwt('anon'),SUPABASE_SERVICE_ROLE_KEY:jwt('service_role'),
 ...Object.fromEntries(['TRAJECTAS_CONTEXT_SECRET','REPORT_ACCESS_TOKEN_SECRET','REPORT_PDF_TOKEN_SECRET','INTERNAL_API_KEY','CRON_SECRET'].map(k=>[k,'synthetic-preview-test-material-only-0000'])),
 ...Object.fromEntries(['PUBLIC','ADMIN','ASSESS','PARTNER','CLIENT'].map(k=>[k+'_APP_URL',`https://synthetic-${k.toLowerCase()}.vercel.app`])),INTERNAL_INTEGRATIONS_API_ENABLED:'false',
}}
it('leaves normal local builds and the unrelated main deployment unchanged',()=>{
 expect(()=>assertPersonalityPreviewEnvironment({})).not.toThrow()
 expect(()=>assertPersonalityPreviewEnvironment({VERCEL:'1',VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'main'})).not.toThrow()
})
it('accepts only the fully scoped synthetic Preview configuration',()=>{expect(()=>assertPersonalityPreviewEnvironment(ready())).not.toThrow()})
it.each([
 {VERCEL_ENV:'production'}, {TRAJECTAS_PERSONALITY_PREVIEW_TARGET:''}, {NEXT_PUBLIC_SUPABASE_URL:'https://other.supabase.co'}, {SUPABASE_SERVICE_ROLE_KEY:jwt('service_role','other')}, {NEXT_PUBLIC_SUPABASE_ANON_KEY:jwt('anon','other')}, {REPORT_PDF_TOKEN_SECRET:''}, {PUBLIC_APP_URL:'https://production.example.com'}, {COOKIE_DOMAIN:'.example.com'}, {TRAJECTAS_ALLOW_DEV_BYPASS:'1'}, {STRIPE_SECRET_KEY:'synthetic-live-canary'}, {INTERNAL_INTEGRATIONS_API_ENABLED:'true'},
])('refuses unsafe dedicated Preview settings without logging values: %j',overrides=>{
 try {assertPersonalityPreviewEnvironment({...ready(),...overrides});throw Error('Expected setup refusal')}
 catch(e){expect((e as Error).message).toMatch(/Personality Preview setup requires/);expect((e as Error).message).not.toContain('synthetic-live-canary');expect((e as Error).message).not.toContain('eyJ')}
})
