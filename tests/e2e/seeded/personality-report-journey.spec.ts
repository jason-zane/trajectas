import { test, expect } from '@playwright/test'
import { randomUUID, createHash } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { extractText } from 'unpdf'
import { createSeededServiceClient, mintStorageState } from './auth'
import manifest from '../../../src/lib/instrument/ipip-neo-120/source/manifest.json'
import ids from '../../../src/lib/instrument/ipip-neo-120/database-ids.json'
import { QUALITY_QUESTIONS, QUALITY_ANCHORS } from '../../../src/lib/instrument/ipip-neo-120/response-quality'
const { instrumentId: IPIP_ID, formVersion: IPIP_FORM_VERSION, scoringVersion: IPIP_SCORING_VERSION, itemsetSha256: IPIP_ITEMSET_SHA256 } = manifest

test.use({ actionTimeout: 30_000 })

// Disposable local/CI targets only: the service-client helper refuses hosted URLs.
test('creates a campaign, completes a fresh profile, downloads standard PDFs and preserves alternative norm editions', async ({ browser }, testInfo) => {
  test.setTimeout(300_000)
  const db = createSeededServiceClient()
  const tag = `personality-journey-${randomUUID().slice(0, 8)}`
  const clientId = randomUUID(), templateId = randomUUID(), sessionId = randomUUID(), participantId = randomUUID()
  const email = `${tag}@example.test`, actorPath = resolve(process.cwd(), 'tests/e2e/seeded/.auth', `${tag}.json`)
  let campaignId = '', actorId = ''
  const insert = async (table: string, row: Record<string, unknown>) => { const result = await db.from(table).insert(row); if (result.error) throw new Error(`${table}: ${result.error.message}`) }
  const check = <T extends { error: unknown }>(result: T): T => { expect(result.error).toBeNull(); return result }
  await insert('clients', { id: clientId, name: tag, slug: tag })
  await insert('report_templates', { id: templateId, name: `SYNTHETIC Standard ${tag}`, custom_report_slug: 'trajectas-personality-standard-v1', is_active: true, auto_release: false })
  async function reference(suffix: string, skew: boolean) {
    const id = randomUUID(), scaleCodes = ['N','E','O','A','C'].flatMap(d => [d, ...[1,2,3,4,5,6].map(n => d+n)])
    const artifact = JSON.stringify({ id: `${tag}-${suffix}`, rawN: 1700, kishEffectiveN: 1700, ageBoundsInclusive: [18,64], countryLabels: null, weighting: 'pooled', nativeScoreMass: Object.fromEntries(scaleCodes.map(code => {
      const size = code.length === 1 ? 97 : 17
      const mass = Array.from({ length: size }, () => skew ? 0 : 1/size)
      if (skew) { mass[0] = .1; mass[(size-1)/2] = .6; mass[size-1] = .3 }
      return [code,mass]
    })) })
    await insert('norm_reference_versions', { id, group_key: `${tag}:${suffix}`, name: `SYNTHETIC ${suffix} ${tag}`, version: 'synthetic-v1', instrument_id: IPIP_ID, form_version: IPIP_FORM_VERSION, scoring_version: IPIP_SCORING_VERSION, itemset_sha256: IPIP_ITEMSET_SHA256, method_version: 'weighted-empirical-midrank-v1', family: 'general-adult', scope_client_id: clientId, artifact_text: artifact, artifact_sha256: createHash('sha256').update(artifact).digest('hex'), provenance: { population: 'Synthetic software acceptance only' }, status: 'active', review_evidence: { datasetReuse: 'approved', formEquivalence: 'approved', methodology: 'approved', stability: 'approved', intendedUse: 'approved', evidence: 'SYNTHETIC software acceptance fixture only; no source norms approved', reviewedBy: 'synthetic-fixture', reviewedAt: new Date().toISOString() } })
    await insert('assessment_norm_references', { assessment_id: ids.assessmentId, reference_version_id: id })
    return id
  }
  const refA = await reference('A', false), refB = await reference('B', true)
  const user = check(await db.auth.admin.createUser({ email, email_confirm: true }))
  actorId = user.data.user!.id
  await insert('profiles', { id: actorId, email, role: 'platform_admin', display_name: 'Synthetic Preview Owner', is_active: true })
  await mintStorageState(email, actorPath)
  const admin = await browser.newContext({ storageState: actorPath })
  const participant = await browser.newContext()
  try {
    const page = await admin.newPage()
    await page.goto(`/report-templates/${templateId}/builder`)
    await expect(page.getByLabel('Cover headline')).toBeEnabled()
    await page.getByLabel('Cover headline').fill('Your personality preview')
    await expect(page.getByLabel('Cover headline')).toHaveValue('Your personality preview')
    await page.getByText('Openness', { exact: true }).click()
    await page.getByLabel('O Definition', { exact: true }).fill('Presentation wording edited in the platform.')
    await page.getByRole('button', { name: 'Save presentation', exact: true }).click()
    await expect(page.getByText('Report presentation saved', { exact: true })).toBeVisible()
    expect(check(await db.from('report_templates').select('presentation_config').eq('id', templateId).single()).data!.presentation_config.coverHeadline).toBe('Your personality preview')
    await page.goto(`/campaigns/create`)
    await page.getByLabel('Title', { exact: true }).fill(tag)
    await page.getByLabel('Client', { exact: true }).selectOption(clientId)
    await page.getByRole('button', { name: 'Create Campaign', exact: true }).click()
    await expect(page).toHaveURL(/\/campaigns\/[a-f0-9-]+(?:\/overview)?$/)
    campaignId = new URL(page.url()).pathname.split('/')[2]
    await page.goto(`/campaigns/${campaignId}/assessments`)
    await page.getByRole('button', { name: 'Add Assessment', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: /Trajectas Personality Profile/ }).click()
    await page.getByRole('button', { name: 'Choose reference', exact: true }).click()
    await page.getByRole('radio', { name: new RegExp(`SYNTHETIC A ${tag}`) }).check()
    await page.getByRole('button', { name: 'Save reference', exact: true }).click()
    await expect(page.getByText('Campaign reference saved', { exact: true })).toBeVisible()
    await page.goto(`/campaigns/${campaignId}/settings`)
    await page.getByText('Choose a template…', { exact: true }).click()
    await page.getByRole('option', { name: `SYNTHETIC Standard ${tag}`, exact: true }).click()
    await page.getByRole('button', { name: 'Add report template', exact: true }).click()
    await expect(page.getByText('Template added', { exact: true })).toBeVisible()
    // Only enrolment is a fixture; the fresh form, every answer and submission use the UI.
    const token = `synthetic-personality-${randomUUID()}`
    await insert('campaign_participants', { id: participantId, campaign_id: campaignId, email: `${tag}-participant@example.test`, first_name: 'Synthetic', last_name: 'Personality', access_token: token, status: 'in_progress' })
    await page.goto(`/campaigns/${campaignId}/overview`)
    await page.getByRole('button', { name: 'Activate', exact: true }).click()
    await expect(page.getByRole('dialog').getByText(`SYNTHETIC A ${tag}`, { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Activate campaign', exact: true }).click()
    await expect(page.getByText('Campaign activated', { exact: true })).toBeVisible()
    await insert('participant_sessions', { id: sessionId, campaign_id: campaignId, campaign_participant_id: participantId, client_id: clientId, assessment_id: ids.assessmentId, status: 'in_progress', is_internal: true })
    const respondent = await participant.newPage()
    await respondent.goto(`/assess/${token}/section/0`)
    const anchors = ['Very Inaccurate','Moderately Inaccurate','Neither Inaccurate nor Accurate','Moderately Accurate','Very Accurate']
    for (const [i,item] of manifest.items.entries()) {
      await expect(respondent.getByText(item.stem, { exact: true })).toBeVisible()
      await respondent.getByRole('button', { name: anchors[i%5], exact: true }).click()
    }
    await expect(respondent).toHaveURL(new RegExp(`/quality/${sessionId}$`))
    await respondent.setViewportSize({ width: 390, height: 844 })
    const quality = [4,1,1,1,2,2,2,2]
    for (const [i,q] of QUALITY_QUESTIONS.entries()) {
      await expect(respondent.getByText(q.stem, { exact: true }).last()).toBeVisible()
      await respondent.getByRole('button', { name: QUALITY_ANCHORS[quality[i]-1], exact: true }).click()
      await expect(respondent.getByRole('status')).toHaveText('Saved')
      if (i===1) await respondent.reload()
      else await respondent.getByRole('button', { name: i===7?'Continue to finish':'Continue', exact: true }).click()
    }
    await expect(respondent).toHaveURL(new RegExp(`/assess/${token}/(?:review|complete)$`))
    if (new URL(respondent.url()).pathname.endsWith('/review')) await respondent.getByRole('button', { name: 'Submit assessment', exact: true }).click()
    const reports = async () => check(await db.from('report_snapshots').select('*').eq('participant_session_id', sessionId).eq('template_id', templateId).order('edition_number')).data!
    await expect.poll(async () => (await reports())[0]?.status, { timeout: 60_000 }).toBe('ready')
    const first = (await reports())[0]
    expect(first.reference_version_id).toBe(refA)
    expect(first.rendered_data[0].data.payload.coverHeadline).toBe('Your personality preview')
    const native = check(await db.from('participant_instrument_results').select('result').eq('session_id',sessionId).single()).data!.result
    expect(native.responseCount).toBe(120)
    expect(Object.keys(native.facets)).toHaveLength(30)
    expect(check(await db.from('participant_response_quality_results').select('id').eq('session_id',sessionId)).data).toHaveLength(1)
    await page.goto(`/reports/${first.id}`)
    await expect(page.locator('.tpp-report .report-page')).toHaveCount(9)
    await expect(page.getByText(`SYNTHETIC A ${tag}`, { exact: true })).toBeVisible()
    const firstDownload = page.waitForEvent('download', { timeout: 90_000 })
    await page.getByRole('button', { name: 'Download PDF', exact: true }).click()
    const pdfA = await firstDownload, pdfAPath = testInfo.outputPath('standard-reference-a.pdf')
    await pdfA.saveAs(pdfAPath)
    const bytesA = await readFile(pdfAPath)
    expect((await PDFDocument.load(bytesA)).getPageCount()).toBe(9)
    const textA = (await extractText(new Uint8Array(bytesA), { mergePages: true })).text.replace(/\s+/g, ' ')
    expect(textA.replace(/\s+/g, '')).toContain(`SYNTHETICA${tag}`)
    expect(textA).toContain('synthetic-v1')
    expect(textA.split('Imagination').length - 1).toBeGreaterThanOrEqual(2)
    await page.goto(`/campaigns/${campaignId}/sessions/${sessionId}`)
    await page.getByRole('button', { name: 'Create report', exact: true }).click()
    await page.getByRole('radio', { name: new RegExp(`SYNTHETIC B ${tag}`) }).check()
    await page.getByRole('dialog').getByRole('button', { name: 'Create report', exact: true }).click()
    await expect.poll(async () => (await reports())[1]?.status, { timeout: 60_000 }).toBe('ready')
    const second = (await reports())[1]
    expect(second.edition_number).toBe(2)
    expect(second.reference_version_id).toBe(refB)
    expect(second.reference_interpretation).not.toEqual(first.reference_interpretation)
    expect(second.rendered_data[0].data.payload.dimensions).not.toEqual(first.rendered_data[0].data.payload.dimensions)
    expect((await reports())[0].rendered_data).toEqual(first.rendered_data)
    expect(check(await db.from('participant_instrument_results').select('result').eq('session_id',sessionId).single()).data!.result).toEqual(native)
    await page.goto(`/reports/${second.id}`)
    await expect(page.getByText(`SYNTHETIC B ${tag}`, { exact: true })).toBeVisible()
    const secondDownload = page.waitForEvent('download', { timeout: 90_000 })
    await page.getByRole('button', { name: 'Download PDF', exact: true }).click()
    const pdfB = await secondDownload, pdfBPath = testInfo.outputPath('standard-reference-b.pdf')
    await pdfB.saveAs(pdfBPath)
    const bytesB = await readFile(pdfBPath)
    expect((await PDFDocument.load(bytesB)).getPageCount()).toBe(9)
    expect((await extractText(new Uint8Array(bytesB), { mergePages: true })).text.replace(/\s+/g, '')).toContain(`SYNTHETICB${tag}`)
    expect(pdfB.suggestedFilename()).not.toBe(pdfA.suggestedFilename())
    await page.screenshot({ path: testInfo.outputPath('standard-reference-b.png'), fullPage: true })
  } finally {
    await participant.close(); await admin.close(); await rm(actorPath, { force: true })
    if (campaignId) {
      const stored = check(await db.from('report_snapshots').select('pdf_url').eq('campaign_id', campaignId)).data ?? []
      const paths = stored.map(row => row.pdf_url).filter((path): path is string => typeof path === 'string' && !path.includes('://'))
      if (paths.length) check(await db.storage.from('reports').remove(paths))
      check(await db.from('campaigns').delete().eq('id',campaignId))
    }
    check(await db.from('report_templates').delete().eq('id',templateId))
    check(await db.from('clients').delete().eq('id',clientId))
    if (actorId) check(await db.auth.admin.deleteUser(actorId))
  }
})
