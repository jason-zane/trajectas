/** Produces private, inactive import SQL from an explicitly supplied research artifact.
 * Never stores research distributions in the public repository or activates norms.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, realpathSync } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i+1] : undefined }
const source = option('--artifact'), expected = option('--sha256'), decisions = option('--decisions'), output = option('--output')
if (!source || !expected || !decisions || !output) throw new Error('Use --artifact <private-file> --sha256 <reviewed-hash> --decisions <private-decision-file> --output <private-sql-file>')
const privateOutput = resolve(output)
if (!relative(root, privateOutput).startsWith('..')) throw new Error('Research import SQL must stay outside the public repository')
const sha = text => createHash('sha256').update(text).digest('hex')
const text = readFileSync(realpathSync(source), 'utf8')
if (sha(text) !== expected) throw new Error('The private reference artifact hash differs')
const artifact = JSON.parse(text), decision = JSON.parse(readFileSync(decisions, 'utf8'))
const ids = JSON.parse(readFileSync(resolve(root,'src/lib/instrument/ipip-neo-120/database-ids.json'),'utf8'))
const c = artifact.assessmentContract
if (artifact.state !== 'draft-research-only' || artifact.activationAllowed !== false || artifact.groups.length !== 41 || c.instrumentId !== 'ipip-neo-120-johnson-2014' || artifact.methodVersion !== 'weighted-empirical-midrank-v1') throw new Error('Only the held 41-group draft contract can be imported')
const uuid = key => { const h=sha('trajectas-reference-v1:'+key);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}` }
const quote = value => "'"+String(value).replaceAll("'","''")+"'"
let sql = '-- PRIVATE research import. All source references remain draft; no activation/defaults.\nBEGIN;\n'
for (const group of artifact.groups) {
 const family=decision.families.find(f=>f.groups.some(g=>g.id===group.id))?.id
 if (!family || Object.keys(group.nativeScoreMass).length !== 35) throw new Error('Unknown draft group or incomplete scale distribution')
 for (const [code,mass] of Object.entries(group.nativeScoreMass)) {
  if (!/^[NEOAC]([1-6])?$/.test(code) || mass.length !== (code.length===1?97:17) || mass.some(v=>!Number.isFinite(v)||v<0) || Math.abs(mass.reduce((a,b)=>a+b,0)-1)>1e-9) throw new Error('Invalid reference distribution')
 }
 const key=`${c.instrumentId}:${group.id}`, id=uuid(key+':'+artifact.referenceVersion), data=JSON.stringify(group), hash=sha(data)
 const provenance=JSON.stringify({...artifact.source,sourceArtifactSha256:expected,collectionPeriod:'2001–2011',population:'Self-selected internet records; occupation and leadership not verified',reuseStatus:'unverified',preparationDecision:'2026-10-30'})
 sql+=`DO $guard$ BEGIN IF EXISTS(SELECT 1 FROM public.norm_reference_versions WHERE id=${quote(id)} AND (artifact_sha256<>${quote(hash)} OR group_key<>${quote(key)} OR version<>${quote(artifact.referenceVersion)})) THEN RAISE EXCEPTION 'Existing reference conflicts with reviewed draft'; END IF; END $guard$;\n`
 sql+=`INSERT INTO public.norm_reference_versions(id,group_key,name,version,instrument_id,form_version,scoring_version,itemset_sha256,method_version,family,artifact_text,artifact_sha256,provenance,status) VALUES(${[id,key,group.label,artifact.referenceVersion,c.instrumentId,c.formVersion,c.scoringVersion,c.itemsetSha256,artifact.methodVersion,family,data,hash,provenance,'draft'].map(quote).join(',')}) ON CONFLICT(id) DO NOTHING;\n`
 sql+=`INSERT INTO public.assessment_norm_references(assessment_id,reference_version_id) VALUES(${quote(ids.assessmentId)},${quote(id)}) ON CONFLICT DO NOTHING;\n`
}
sql+='COMMIT;\n'
writeFileSync(privateOutput,sql,{mode:0o600})
console.log('Prepared 41 private draft references with checked source hash; nothing applied or activated.')
