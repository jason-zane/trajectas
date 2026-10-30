import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { ADMIN_STORAGE_STATE, createSeededServiceClient } from './auth'
import { firstPersonPersonalityStem } from '../../../src/lib/instrument/ipip-neo-120/administration'
import manifest from '../../../src/lib/instrument/ipip-neo-120/source/manifest.json'
import ids from '../../../src/lib/instrument/ipip-neo-120/database-ids.json'
import { INTEGRATED_QUALITY_QUESTIONS as QUALITY_QUESTIONS } from '../../../src/lib/instrument/ipip-neo-120/response-quality'

test('completes the integrated 128-statement questionnaire, resumes it, and records an assessor review', async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000)
  const db = createSeededServiceClient()
  const campaignId = randomUUID(), participantId = randomUUID(), sessionId = randomUUID()
  const token = `synthetic-quality-${randomUUID()}`
  const insert = async (table: string, row: Record<string, unknown>) => {
    const { error } = await db.from(table).insert(row)
    if (error) throw new Error(`${table}: ${error.message}`)
  }
  await insert('campaigns', { id: campaignId, title: 'Synthetic response quality pilot', slug: `quality-${campaignId}`, status: 'active', client_id: '10000000-0000-0000-0000-000000000101', partner_id: '10000000-0000-0000-0000-000000000001', allow_resume: true, is_internal: true })
  await insert('campaign_assessments', { campaign_id: campaignId, assessment_id: ids.assessmentId })
  await insert('campaign_participants', { id: participantId, campaign_id: campaignId, email: `quality-${participantId}@example.test`, first_name: 'Synthetic', last_name: 'Quality', access_token: token, status: 'in_progress' })
  await insert('participant_sessions', { id: sessionId, campaign_id: campaignId, campaign_participant_id: participantId, client_id: '10000000-0000-0000-0000-000000000101', assessment_id: ids.assessmentId, status: 'in_progress', is_internal: true })
  try {
    await page.goto(`/assess/${token}/section/0`)
    await expect(page.getByText('I worry about things.', { exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('integrated-runner-desktop.png'), fullPage: true })
    const labels = ['Very Inaccurate', 'Moderately Inaccurate', 'Neither Inaccurate nor Accurate', 'Moderately Accurate', 'Very Accurate']
    const values = [3, 2, 1, 2, 2, 1, 2, 1] // Deliberately miss one instruction.
    for (const [index, item] of manifest.items.entries()) {
      await expect(page.getByText(firstPersonPersonalityStem(item.stem), { exact: true })).toBeVisible()
      await page.getByRole('button', { name: labels[index % 5], exact: true }).click()
      const qIndex = QUALITY_QUESTIONS.findIndex(q => q.afterItem === index + 1)
      if (qIndex < 0) continue
      const question = QUALITY_QUESTIONS[qIndex]
      await expect(page.getByText(question.stem, { exact: true }).last()).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`/section/0$`))
      if (qIndex === 1) {
        await page.setViewportSize({ width: 390, height: 844 })
        await page.screenshot({ path: testInfo.outputPath('integrated-runner-mobile.png'), fullPage: true })
      }
      await page.getByRole('button', { name: labels[values[qIndex] - 1], exact: true }).click()
      await expect(page.getByText(firstPersonPersonalityStem(manifest.items[index + 1].stem), { exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      if (qIndex === 1) {
        // The shared Back control revisits the check; reload then resumes the
        // same integrated sequence with confirmed native and quality answers.
        await page.getByRole('button', { name: 'Back', exact: true }).click()
        await expect(page.getByText(question.stem, { exact: true })).toBeVisible()
        await page.getByRole('button', { name: labels[values[qIndex] - 1], exact: true }).click()
        await expect(page.getByText(firstPersonPersonalityStem(manifest.items[index + 1].stem), { exact: true })).toBeVisible()
        await page.reload()
      }
    }
    // Review is configurable. With it disabled, CompletePage submits through
    // the same server completeness/quality gate before rendering completion.
    await expect(page).toHaveURL(new RegExp(`/assess/${token}/(?:review|complete)$`))
    if (new URL(page.url()).pathname.endsWith('/review')) {
      await page.getByRole('button', { name: 'Submit assessment', exact: true }).click()
    }
    await expect.poll(async () => (await db.from('participant_response_quality_results').select('status').eq('session_id', sessionId).maybeSingle()).data?.status, { timeout: 60_000 }).toBe('review_recommended')
    const native = await db.from('participant_instrument_results').select('result').eq('session_id', sessionId).single()
    expect(native.data?.result.responseCount).toBe(120)
    expect(Object.keys(native.data?.result.facets ?? {})).toHaveLength(30)
    expect(native.data?.result.overallScore).toBeNull()
    const adminContext = await browser.newContext({ storageState: ADMIN_STORAGE_STATE })
    try {
      const adminPage = await adminContext.newPage()
      await adminPage.goto(`/campaigns/${campaignId}/sessions/${sessionId}`)
      await expect(adminPage.getByText('Review recommended', { exact: true })).toBeVisible()
      await expect(adminPage.getByText('1 of 2 instructions missed.', { exact: true })).toBeVisible()
      await adminPage.getByLabel('Review notes').fill('Synthetic review: follow up about the missed instruction.')
      await adminPage.getByRole('button', { name: 'Save review', exact: true }).click()
      await expect(adminPage.getByText('Response-quality review saved', { exact: true })).toBeVisible()
      await expect(adminPage.getByRole('heading', { name: 'Assessor reviews' })).toBeVisible()
      await expect(adminPage.getByText('Synthetic review: follow up about the missed instruction.', { exact: true })).toBeVisible()
      await adminPage.screenshot({ path: testInfo.outputPath('response-quality-light.png'), fullPage: true })
      await adminPage.evaluate(() => document.documentElement.classList.add('dark'))
      await adminPage.screenshot({ path: testInfo.outputPath('response-quality-dark.png'), fullPage: true })
      const qualityRows = await db.from('participant_response_quality_results').select('id').eq('session_id', sessionId)
      expect(qualityRows.error).toBeNull()
      expect(qualityRows.data).toHaveLength(1)
      const savedReviews = await db.from('response_quality_reviews').select('decision,notes').eq('result_id',qualityRows.data![0].id)
      expect(savedReviews.error).toBeNull()
      expect(savedReviews.data).toEqual([{ decision: 'follow_up', notes: 'Synthetic review: follow up about the missed instruction.' }])
    } finally { await adminContext.close() }
  } finally {
    await db.from('participant_sessions').delete().eq('id', sessionId)
    await db.from('campaign_participants').delete().eq('id', participantId)
    await db.from('campaign_assessments').delete().eq('campaign_id', campaignId)
    await db.from('campaigns').delete().eq('id', campaignId)
  }
})
