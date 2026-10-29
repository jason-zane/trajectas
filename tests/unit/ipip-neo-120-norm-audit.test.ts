import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

it('audits fixed-width already-keyed data, missingness, invalid records and duplicate cases independently', () => {
  const output=execFileSync('python3',['-c',String.raw`
import importlib.util, pathlib, tempfile, zipfile
path=pathlib.Path('scripts/instruments/audit-ipip-neo-120-norms.py')
spec=importlib.util.spec_from_file_location('ipip_audit',path)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def row(case,age,sex,values):
    return (f'{case:6}{sex}{age:02}'+'0000000100100'+'Australia'+values+'\r\n').encode()
assert len(row(1,30,1,'5'*120).rstrip(b'\r\n'))==151
records=[row(1,30,1,'5'*120),row(2,16,2,'1'*120),row(3,20,1,'0'+'3'*119),b'bad\n',row(5,20,1,'X'+'3'*119),row(6,20,1,'6'+'3'*119),row(1,30,1,'5'*120)]
with tempfile.TemporaryDirectory() as directory:
    archive=pathlib.Path(directory)/'fixture.zip'
    with zipfile.ZipFile(archive,'w') as z:z.writestr('IPIP120.dat',b''.join(records))
    result=module.audit(archive)
assert result['counts']['records']==7
assert result['counts']['invalid_width']==1
assert result['counts']['invalid_numeric_fields']==1
assert result['counts']['invalid_response_range']==1
assert result['counts']['incomplete_records']==1
assert result['counts']['missing_response_cells']==1
assert result['counts']['duplicate_case_ids']==1
assert result['cohorts']['complete']['n']==3
assert result['cohorts']['australia_age18plus']['n']==2
for code in ['N1','N4','N6']:
    assert result['cohorts']['complete']['scores'][code]=={20:2,4:1}, 'Archive data must not be reverse-keyed again'
for cohort in result['cohorts'].values():
    for code,hist in cohort['scores'].items():assert sum(hist.values())==cohort['n']
print('archive audit verified')
`],{cwd:resolve(import.meta.dirname,'../..'),encoding:'utf8'})
  expect(output).toContain('archive audit verified')
})
