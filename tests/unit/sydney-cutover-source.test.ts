import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { verifySydneyCutoverFiles, verifySydneyCutoverCommit } from '../../scripts/release/verify-sydney-cutover.mjs'

let directory: string
beforeEach(() => {
  directory = mkdtempSync(resolve(tmpdir(), 'trajectas-cutover-source-'))
  cpSync('supabase/migrations', resolve(directory, 'supabase/migrations'), { recursive: true })
  cpSync('vercel.json', resolve(directory, 'vercel.json'))
})
afterEach(() => rmSync(directory, { recursive: true, force: true }))

describe('Sydney cutover source compatibility', () => {
  it('retains the exact reviewed privacy migrations and all nine schedules', () => {
    expect(verifySydneyCutoverFiles(directory)).toMatchObject({ cronCount: 9, region: 'syd1' })
  })
  it.each(['20261104195228_privacy_data_lifecycle.sql', '20261105013646_privacy_observer_erasure.sql'])('refuses a changed or missing applied migration: %s', filename => {
    const path = resolve(directory, 'supabase/migrations', filename)
    writeFileSync(path, readFileSync(path, 'utf8') + '\n-- changed\n')
    expect(() => verifySydneyCutoverFiles(directory)).toThrow('migration changed')
    rmSync(path)
    expect(() => verifySydneyCutoverFiles(directory)).toThrow()
  })
  it.each(['missing', 'changed', 'extra'])('refuses %s cron configuration', change => {
    const path = resolve(directory, 'vercel.json'), config = JSON.parse(readFileSync(path, 'utf8'))
    if (change === 'missing') config.crons.shift()
    if (change === 'changed') config.crons[0].schedule = '* * * * *'
    if (change === 'extra') config.crons.push({ path: '/api/cron/unreviewed', schedule: '* * * * *' })
    writeFileSync(path, JSON.stringify(config))
    expect(() => verifySydneyCutoverFiles(directory)).toThrow('nine reviewed cron schedules')
  })
  it('refuses a region change and an unidentified release', () => {
    const path = resolve(directory, 'vercel.json'), config = JSON.parse(readFileSync(path, 'utf8'))
    config.regions = ['sin1']; writeFileSync(path, JSON.stringify(config))
    expect(() => verifySydneyCutoverFiles(directory)).toThrow('Sydney functions')
    expect(() => verifySydneyCutoverCommit(directory, 'main')).toThrow('exact approved')
  })
})
