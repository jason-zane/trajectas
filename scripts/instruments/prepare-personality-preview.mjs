/** Generate reviewed, idempotent SYNTHETIC Preview setup SQL; never connect or apply. */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const args=process.argv.slice(2), option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1]}
const target=option('--target'),output=option('--output')
if(target!=='bgrvqvtlhmfmvcytncgw'||!output)throw Error('Use --target bgrvqvtlhmfmvcytncgw --output <private-sql-file>; production is refused')
const path=resolve(output)
if(!relative(root,path).startsWith('..'))throw Error('Keep generated environment setup outside the repository')
const manifest=JSON.parse(readFileSync(resolve(root,'src/lib/instrument/ipip-neo-120/source/manifest.json'),'utf8'))
const ids=JSON.parse(readFileSync(resolve(root,'src/lib/instrument/ipip-neo-120/database-ids.json'),'utf8'))
const hash=s=>createHash('sha256').update(s).digest('hex'),quote=s=>"'"+String(s).replaceAll("'","''")+"'"
const uuid=s=>{const h=hash('personality-preview-only-v1:'+s);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`}
const clientId=uuid('client'),templateId='238694bb-3e60-5fee-a558-2cdde1464bb5'
const lines=['-- Target: Trajectas (Dev) bgrvqvtlhmfmvcytncgw. SYNTHETIC software fixtures only.','BEGIN;',`INSERT INTO public.clients(id,name,slug) VALUES(${quote(clientId)},'SYNTHETIC — Personality Profile Preview','synthetic-personality-profile-preview') ON CONFLICT(id) DO NOTHING;`]
const fixtureIds=[]
for(const [name,skew] of [['A — uniform',false],['B — alternate',true]]){
 const id=uuid(name);fixtureIds.push(id)
 const masses=Object.fromEntries(['N','E','O','A','C'].flatMap(d=>[d,...[1,2,3,4,5,6].map(n=>d+n)]).map(code=>{const n=code.length===1?97:17;const mass=Array.from({length:n},()=>skew?0:1/n);if(skew){mass[0]=.1;mass[(n-1)/2]=.6;mass[n-1]=.3}return[code,mass]}))
 const artifact=JSON.stringify({id:'synthetic-personality-preview-'+name,label:'SYNTHETIC '+name,rawN:1700,kishEffectiveN:1700,ageBoundsInclusive:[18,64],countryLabels:null,weighting:'pooled',nativeScoreMass:masses})
 const evidence=JSON.stringify({datasetReuse:'approved',formEquivalence:'approved',methodology:'approved',stability:'approved',intendedUse:'approved',evidence:'SYNTHETIC software acceptance fixture only; no source reference has been approved',reviewedBy:'synthetic-preview-fixture',reviewedAt:'2026-10-30T00:00:00Z'})
 const values=[id,'synthetic:personality-preview:'+name,'SYNTHETIC reference '+name+' — Preview only','synthetic-preview-v1',manifest.instrumentId,manifest.formVersion,manifest.scoringVersion,manifest.itemsetSha256,'weighted-empirical-midrank-v1','general-adult',artifact,hash(artifact),JSON.stringify({population:'Synthetic software acceptance only',collectionPeriod:'Synthetic fixtures'}),'active',evidence]
 lines.push(`DO $guard$ BEGIN IF EXISTS(SELECT 1 FROM public.norm_reference_versions WHERE id=${quote(id)} AND artifact_sha256<>${quote(hash(artifact))}) THEN RAISE EXCEPTION 'Synthetic fixture identity conflict'; END IF; END $guard$;`)
 lines.push(`INSERT INTO public.norm_reference_versions(id,group_key,name,version,instrument_id,form_version,scoring_version,itemset_sha256,method_version,family,artifact_text,artifact_sha256,provenance,status,review_evidence) VALUES(${values.map(quote).join(',')}) ON CONFLICT(id) DO NOTHING;`)
 lines.push(`INSERT INTO public.assessment_norm_references(assessment_id,reference_version_id) VALUES(${quote(ids.assessmentId)},${quote(id)}) ON CONFLICT DO NOTHING;`)
}
lines.push(`DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.report_templates WHERE id=${quote(templateId)} AND custom_report_slug='trajectas-personality-standard-v1') THEN RAISE EXCEPTION 'Expected standard report registration'; END IF; END $guard$;`)
lines.push(`UPDATE public.report_templates SET is_active=true,is_default=false,auto_release=false WHERE id=${quote(templateId)} AND custom_report_slug='trajectas-personality-standard-v1';`)
lines.push(`INSERT INTO public.assessment_report_templates(assessment_id,template_id,is_default) VALUES(${quote(ids.assessmentId)},${quote(templateId)},true) ON CONFLICT(assessment_id,template_id) DO UPDATE SET is_default=true;`)
lines.push(`DO $default$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.assessment_norm_references WHERE assessment_id=${quote(ids.assessmentId)} AND is_default) THEN PERFORM public.set_assessment_reference_default(${quote(ids.assessmentId)},${quote(fixtureIds[0])}); END IF; END $default$;`)
lines.push('COMMIT;')
writeFileSync(path,lines.join('\n')+'\n',{mode:0o600})
console.log('Prepared two clearly named synthetic references, one synthetic client and standard report assignment; nothing applied.')
