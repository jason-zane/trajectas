import {randomUUID} from 'node:crypto'
import {describe,expect,it} from 'vitest'
import {buildRestrictedResearchCase} from '@/lib/privacy/research'
import {captureResearchScoring} from '@/lib/privacy/research-scoring'
describe('research uses frozen scoring evidence',()=>{
  const constructId=randomUUID(),itemId=randomUUID()
  const scoring={version:'research-scoring@1',constructId,reverseScored:true,minValue:1,maxValue:5,formatType:'likert'}
  const entry={itemId,itemVersion:1,purpose:'construct',countsTowardScore:true,researchScoring:scoring,stem:'A prompt that must not be copied'}
  it('scores the frozen reversed range and omits text and unknown response payloads',()=>{
    const result=buildRestrictedResearchCase([entry],[{item_id:itemId,response_value:1}])
    expect(result.scores).toEqual([{constructId,pomp:100}])
    expect(JSON.stringify(result)).not.toContain('A prompt')
    expect(result.formFingerprint).toMatch(/^[a-f0-9]{64}$/)
  })
  it('separates reverse direction, item version and scoring bounds in the cohort fingerprint',()=>{
    const run=(value:unknown)=>buildRestrictedResearchCase([value],[{item_id:itemId,response_value:3}]).formFingerprint
    expect(run(entry)).not.toBe(run({...entry,itemVersion:2}))
    expect(run(entry)).not.toBe(run({...entry,researchScoring:{...scoring,reverseScored:false}}))
    expect(run(entry)).not.toBe(run({...entry,researchScoring:{...scoring,maxValue:7}}))
  })
  it('rejects historical forms rather than silently using current item metadata',()=>{
    const historical={itemId:entry.itemId,itemVersion:entry.itemVersion,purpose:entry.purpose,countsTowardScore:entry.countsTowardScore}
    expect(()=>buildRestrictedResearchCase([historical],[{item_id:itemId,response_value:3}])).toThrow('Historical scoring metadata')
  })
  it('rejects incomplete, duplicate and out-of-range responses',()=>{
    expect(()=>buildRestrictedResearchCase([entry],[])).toThrow('Complete in-range')
    expect(()=>buildRestrictedResearchCase([entry],[{item_id:itemId,response_value:7}])).toThrow('Complete in-range')
    expect(()=>buildRestrictedResearchCase([entry,entry],[{item_id:itemId,response_value:3}])).toThrow('duplicate')
  })
  it('does not label expert-keyed options as ordinary Likert scoring',()=>{
    expect(captureResearchScoring({construct_id:constructId,reverse_scored:false,response_formats:{type:'likert',config:{minValue:1,maxValue:5}},item_options:[{value:1,score_value:4,exclude_from_scoring:false}]})).toBeUndefined()
  })
})
