/** Build a deterministic, atomic draft import. Does not contact a database. */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
const root = new URL('../../', import.meta.url)
const load = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const manifest = await load('src/lib/instrument/ipip-neo-120/source/manifest.json')
const taxonomy = await load('src/lib/instrument/ipip-neo-120/source/authored-taxonomy.json')
const presentation = await load('src/lib/instrument/ipip-neo-120/presentation.json')
const format = await load('src/lib/instrument/ipip-neo-120/source/response-format.json')
const source = await load('src/lib/instrument/ipip-neo-120/source/source-record.json')
const setup = await load('docs/assessments/ipip-neo-120/assessment-setup.json')
const id = key => {
  const h = createHash('sha256').update(`${manifest.instrumentId}:${key}`).digest('hex')
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`
}
const ids = { assessmentId: id('assessment-v1'), sectionId: id('section-v1'), responseFormatId: id('format-v1'), sourceId: id('source'),
  dimensions: Object.fromEntries(manifest.dimensions.map(d => [d.code,id(`dimension:${d.code}`)])),
  facets: Object.fromEntries(manifest.facets.map(f => [f.code,{factorId:id(`factor:${f.code}`),constructId:id(`construct:${f.code}`)}])),
  items: Object.fromEntries(manifest.items.map(i => [i.itemId,id(`item:${i.itemId}`)])),
  itemContentHashes: Object.fromEntries(manifest.items.map(i => [i.itemId,createHash('sha256').update(JSON.stringify({instrumentId:manifest.instrumentId,formVersion:manifest.formVersion,...i})).digest('hex')])) }
const rows = {}
const add = (table,row) => (rows[table] ??= []).push(row)
add('content_sources',{id:ids.sourceId,...source})
add('response_formats',{id:ids.responseFormatId,name:format.name,type:format.type,config:format.config,is_active:false})
function fields(node) {
  const inverse = presentation.reversedDisplayFacets.includes(node.code)
  const low = inverse ? node.high : node.low, high = inverse ? node.low : node.high
  return { name:presentation.displayNames[node.code] ?? node.name, description:`${node.code} — ${presentation.definitions[node.code] ?? node.definition}`,
    definition:presentation.definitions[node.code] ?? node.definition, is_active:false, source_id:ids.sourceId,
    indicators_low:low.join('\n'), indicators_mid:'Expression can vary by context; examine examples of both ends.',indicators_high:high.join('\n'),
    anchor_low:low[0],anchor_high:high[0],strength_commentary:node.context,development_suggestion:node.reflection }
}
for (const [index,d] of manifest.dimensions.entries()) add('dimensions',{id:ids.dimensions[d.code],slug:d.slug,...fields(taxonomy.domains[index]),display_order:index,is_scored:true})
for (const [index,f] of manifest.facets.entries()) {
  const common = fields(taxonomy.facets[index]), facet = ids.facets[f.code]
  add('constructs',{id:facet.constructId,slug:f.constructSlug,...common})
  add('factors',{id:facet.factorId,slug:f.factorSlug,...common,dimension_id:ids.dimensions[f.code[0]],composition_locked:true,is_match_eligible:false})
  add('factor_constructs',{id:id(`factor-link:${f.code}`),factor_id:facet.factorId,construct_id:facet.constructId,weight:1,display_order:0})
}
for (const item of manifest.items) add('items',{id:ids.items[item.itemId],construct_id:ids.facets[item.facetCode].constructId,response_format_id:ids.responseFormatId,
  stem:item.stem,reverse_scored:item.reverseScored,weight:1,purpose:'construct',status:'draft',lifecycle_state:'draft',
  display_order:item.displayOrder,source_id:ids.sourceId,item_version:1,content_hash:ids.itemContentHashes[item.itemId],deleted_at:null})
add('assessments',{id:ids.assessmentId,title:setup.nativeDraftFields.title,slug:manifest.instrumentId,description:'A fixed 120-item personality assessment. Scale scores describe self-reported tendencies; no overall effectiveness score or percentile is provided.',
  scoring_profile:'ipip_neo_120_v1',scoring_method:'ctt',item_selection_strategy:'fixed',status:'draft',creation_mode:'manual',format_mode:'traditional',
  min_custom_factors:null,time_limit_minutes:null,source_id:ids.sourceId,deleted_at:null})
for (const [index,f] of manifest.facets.entries()) add('assessment_factors',{id:id(`assessment-factor:${f.code}`),assessment_id:ids.assessmentId,factor_id:ids.facets[f.code].factorId,weight:1,item_count:4,min_items:4,max_items:4,display_order:index,composite_weight:null})
add('assessment_sections',{id:ids.sectionId,assessment_id:ids.assessmentId,response_format_id:ids.responseFormatId,title:setup.section.title,instructions:setup.section.instructions,
  display_order:0,item_ordering:'fixed',section_role:'scored',time_limit_seconds:null,allow_back_nav:true,items_per_page:10})
for (const item of manifest.items) add('assessment_section_items',{id:id(`section-item:${item.itemId}`),section_id:ids.sectionId,item_id:ids.items[item.itemId],display_order:item.itemNumber-1})
const references = {
  items:{construct_id:Object.values(ids.facets).map(x=>x.constructId),response_format_id:[ids.responseFormatId]},
  item_options:{item_id:Object.values(ids.items)},
  assessment_sections:{assessment_id:[ids.assessmentId]},
  assessment_section_items:{section_id:[ids.sectionId],item_id:Object.values(ids.items)},
  assessment_factors:{assessment_id:[ids.assessmentId],factor_id:Object.values(ids.facets).map(x=>x.factorId)},
  factor_constructs:{factor_id:Object.values(ids.facets).map(x=>x.factorId),construct_id:Object.values(ids.facets).map(x=>x.constructId)},
  forced_choice_block_items:{item_id:Object.values(ids.items)},
}
const binding = {...ids,instrumentId:manifest.instrumentId,formVersion:manifest.formVersion,scoringVersion:manifest.scoringVersion,presentationVersion:presentation.version,itemsetSha256:manifest.itemsetSha256,activationReady:false,rows,references}
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
const sql = `-- Generated by build-ipip-neo-120-database.mjs. Apply only after schema migrations.\n-- Atomic, additive, collision-checking, idempotent; never activates the assessment.\nBEGIN;\nSELECT pg_advisory_xact_lock(hashtextextended('ipip-neo-120-import-v1',0));\nDO $import$\nDECLARE config jsonb := ${literal(binding)}; tbl text; expected jsonb; actual jsonb; columns text;\nBEGIN\n  FOR tbl IN SELECT jsonb_object_keys(config->'rows') LOOP\n    FOR expected IN SELECT value FROM jsonb_array_elements(config->'rows'->tbl) LOOP\n      EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',tbl) INTO actual USING (expected->>'id')::uuid;\n      IF actual IS NOT NULL THEN\n        IF NOT actual @> expected THEN RAISE EXCEPTION 'IPIP import collision in % at %',tbl,expected->>'id'; END IF;\n      ELSE\n        SELECT string_agg(format('%I',key),',') INTO columns FROM jsonb_object_keys(expected) key;\n        EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1)',tbl,columns,columns,tbl) USING expected;\n      END IF;\n    END LOOP;\n  END LOOP;\n  INSERT INTO public.standardized_assessment_forms(assessment_id,instrument_id,definition) VALUES ((config->>'assessmentId')::uuid,config->>'instrumentId',config) ON CONFLICT (assessment_id) DO NOTHING;\n  IF NOT EXISTS(SELECT 1 FROM public.standardized_assessment_forms WHERE assessment_id=(config->>'assessmentId')::uuid AND definition=config) THEN RAISE EXCEPTION 'IPIP binding collision'; END IF;\nEND $import$;\nCOMMIT;\n`
// JSON object key order is not insertion order in PostgreSQL: insert explicitly in FK order.
const ordered = Object.keys(rows).map(t=>`'${t}'`).join(',')
const orderedSql = sql.replace("SELECT jsonb_object_keys(config->'rows')",`SELECT unnest(ARRAY[${ordered}])`)
const outputs = {'supabase/migrations/20261029040600_ipip_neo_120_draft.sql':orderedSql,'src/lib/instrument/ipip-neo-120/database-ids.json':JSON.stringify(ids,null,2)+'\n','docs/assessments/ipip-neo-120/database-import.sql':orderedSql}
for (const [path,content] of Object.entries(outputs)) {
  const target = new URL(path,root)
  if (process.argv.includes('--check')) { if(await readFile(target,'utf8')!==content) throw Error(`Stale generated output: ${path}`) }
  else await writeFile(target,content)
}
console.log('Prepared deterministic draft import; no database contacted.')
