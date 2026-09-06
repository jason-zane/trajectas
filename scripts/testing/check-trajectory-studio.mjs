import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import puppeteer from 'puppeteer-core'

const base = process.env.STUDIO_URL ?? 'http://127.0.0.1:3012'
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Run against a local development server only.')
const output = resolve('output/trajectory-studio')
await mkdir(output, { recursive: true })
const downloads = await mkdtemp(resolve(output, 'downloads-v2-'))
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const checks = [], errors = []
try {
  const page = await browser.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.setViewport({ width: 1512, height: 1050, deviceScaleFactor: 1 })
  const cdp = await page.createCDPSession()
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
  const pass = (message) => { checks.push(message); console.log(`PASS ${message}`) }
  async function clickText(text) {
    for (const handle of await page.$$('button')) {
      if (await handle.evaluate((element, target) => element.getClientRects().length > 0 && element.textContent.trim() === target, text)) { await handle.click(); return }
    }
    throw new Error(`Visible button not found: ${text}`)
  }
  async function clickLabel(text) {
    for (const handle of await page.$$('label')) {
      if (await handle.evaluate((element, target) => element.getClientRects().length > 0 && element.textContent.includes(target), text)) { const input = await handle.$('input'); assert(input); await input.click(); return }
    }
    throw new Error(`Visible checkbox not found: ${text}`)
  }
  async function inputValue(label, value) {
    await page.$eval(`input[aria-label="${label}"]`, (element, next) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, next)
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
  }
  async function navigate(experience) {
    await page.emulateMediaType('screen')
    const response = await page.goto(`${base}/preview/trajectory?experience=${experience}`, { waitUntil: 'networkidle0' })
    assert.equal(response.status(), 200)
    try { await page.waitForSelector('main h1') } catch (error) { console.error('NAVIGATION DIAGNOSTIC', await page.$eval('body', (e) => e.innerText), errors); throw error }
  }
  async function shot(name) {
    // Shared tables reveal as they enter the viewport. Visit them before a full-page capture.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await delay(700)
    await page.evaluate(() => window.scrollTo(0, 0))
    await delay(200)
    await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true })
  }
  const selectedCount = () => page.$$eval('[aria-label="People selection"] button[aria-pressed=true]', (nodes) => nodes.length)
  const chartCount = () => page.$$eval('main svg polyline', (nodes) => nodes.length)
  const closeDialog = async () => { await page.keyboard.press('Escape'); await page.waitForSelector('[role=dialog]', { hidden: true }) }
  const mainText = () => page.$eval('main', (e) => e.innerText)

  await navigate('compare')
  assert.equal(await selectedCount(), 4)
  assert.equal(await page.$$eval('main [data-testid="snapshot-cards"] button', (nodes) => nodes.length), 24)
  assert.equal(await page.$('select[aria-label="People type"]'), null)
  assert.equal(await page.$('select[aria-label="Focus measure"]'), null)
  assert(!(await mainText()).includes('SNAPSHOT WINDOW'))
  assert((await page.$eval('[aria-label="Overall score comparison"]', (e) => e.innerText)).includes('Group mean 76'))
  await shot('compare-desktop')
  pass('Snapshot shows named bars, explicit scores and a selected-group mean; redundant filters are absent')

  await clickText('Difference')
  assert((await page.$eval('[aria-label="Overall score comparison"]', (e) => e.innerText)).includes('0 · reference'))
  await shot('compare-difference')
  await page.click('[aria-label="Overall score comparison"] button')
  assert((await page.$eval('[role=dialog]', (e) => e.innerText)).includes('Priya Sharma'))
  assert((await page.$eval('[role=dialog]', (e) => e.innerText)).includes('Overall score'))
  await closeDialog()
  await clickText('Scores')
  pass('Difference view uses a common zero baseline and named bars open the exact result')

  await clickText('Choose results')
  await page.select('select[aria-label="Use campaign for everyone"]', 'development-2025')
  await page.select('select[aria-label="Result for Priya Sharma"]', 'demo-person-1-leadership-0')
  await clickText('Done'); await page.waitForSelector('[role=dialog]', { hidden: true })
  assert((await page.$eval('[aria-label="Overall score comparison"]', (e) => e.innerText)).includes('Group mean 67.3'))
  await clickText('Choose results')
  await page.select('select[aria-label="Use campaign for everyone"]', 'leadership-hiring')
  await clickText('Done'); await page.waitForSelector('[role=dialog]', { hidden: true })
  assert((await mainText()).includes('No campaign results selected'))
  await clickText('Choose results')
  await page.select('select[aria-label="Use campaign for everyone"]', 'development-2026')
  await shot('result-selection')
  await clickText('Done'); await page.waitForSelector('[role=dialog]', { hidden: true })
  pass('Campaign and attempt selection recomputes means; absent campaign results stay empty')

  await page.select('select[aria-label="Snapshot measures"]', 'dimension-4')
  assert.equal(await page.$$eval('main [data-testid="snapshot-cards"] section', (nodes) => nodes.length), 3)
  assert((await page.$eval('[aria-label="Self-awareness comparison"]', (e) => e.innerText)).includes('n=3'))
  assert((await page.$eval('[aria-label="Self-awareness comparison"]', (e) => e.innerText)).includes('Not measured in this result'))
  await page.select('select[aria-label="Snapshot measures"]', 'overview')
  pass('Factor view adds real detail and excludes missing scores from its mean')

  await page.click('button[aria-label="Show score matrix"]')
  await clickLabel('Include all')
  assert.equal(await page.$$eval('main table', (nodes) => nodes.length), 2)
  const matrixText = await page.$$eval('main table', (nodes) => nodes.map((e) => e.innerText).join('\n'))
  assert(matrixText.includes('GROUP MEAN'))
  assert(!/20 Aug|2026/.test(matrixText), 'Snapshot cells do not repeat dates')
  assert.equal(await page.$$eval('main table tbody button', (nodes) => nodes.length), 0)
  await shot('compare-multi-assessment-matrix')
  pass('Matrix keeps assessment bases separate, shows mean differences and removes redundant dates and row clicks')

  await clickText('Export'); await page.waitForSelector('[role=dialog]')
  await clickLabel('Use anonymous labels'); await clickText('Download CSV')
  let file
  for (let n = 0; n < 60; n++) { file = (await readdir(downloads)).find((name) => name.endsWith('.csv')); if (file) break; await delay(100) }
  assert(file, 'CSV downloaded during this run')
  const csv = await readFile(resolve(downloads, file), 'utf8')
  assert(csv.includes('Person 1') && csv.includes('Workplace styles') && csv.includes('Leadership Index'))
  assert(csv.includes('Reference score') && csv.includes('Selected group mean') && csv.includes('"76","4"'))
  assert(!csv.includes('Priya') && !csv.includes('demo-person'))
  pass('Downloaded CSV includes exact reference values and sample sizes for both assessments, with anonymous identity')
  await page.evaluate(() => { window.__studioPrintCalled = false; window.print = () => { window.__studioPrintCalled = true } })
  await clickText('Print / save PDF'); await page.waitForFunction(() => window.__studioPrintCalled)
  await page.waitForSelector('[role=dialog]', { hidden: true })
  await page.pdf({ path: resolve(output, 'comparison-report.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true })
  pass('PDF report renders the chart, selected campaign provenance, means and an assessment-specific appendix')

  await clickText('Saved views'); await inputValue('View name', 'Review comparison'); await clickText('Save current view')
  await page.waitForSelector('[role=dialog]', { hidden: true })
  assert(await page.evaluate(() => localStorage.getItem('trajectas-studio-v2-demo').includes('Review comparison')))
  await clickText('Clear')
  assert((await mainText()).includes('Choose people to begin'))
  for (let n = 0; n < 8; n++) await (await page.$$('[aria-label="People selection"] button[aria-pressed]'))[n].click()
  assert.equal(await selectedCount(), 8)
  assert.equal(await page.$$eval('[aria-label="People selection"] button[disabled]', (nodes) => nodes.length), 2)
  await clickText('Saved views')
  for (const handle of await page.$$('[role=dialog] button')) if (await handle.evaluate((e) => e.textContent.includes('Review comparison'))) { await handle.click(); break }
  await page.waitForSelector('[role=dialog]', { hidden: true })
  assert.equal(await selectedCount(), 4)
  assert.equal(await page.$eval('select[aria-label="Reference"]', (e) => e.value), 'group')
  pass('Selection limits and saved views retain the chosen people, campaign results and reference')

  await navigate('individual')
  assert.equal(await chartCount(), 5)
  assert.equal(await page.$$eval('main svg circle[role=button]', (nodes) => nodes.length), 20)
  await shot('individual-desktop')
  pass('One person starts with five dimensions on the same timeline and a first/latest/change summary')
  await page.click('main details summary')
  await clickText('Overall only')
  assert.equal(await chartCount(), 1)
  await page.click('input[aria-label="Show Critical thinking"]')
  await page.click('input[aria-label="Show Overall score"]')
  assert.equal(await chartCount(), 1)
  await clickLabel('Show stored score intervals')
  await page.click('main svg circle[role=button]')
  const detail = await page.$eval('[role=dialog]', (e) => e.innerText)
  assert(detail.includes('Priya Sharma') && detail.includes('Critical thinking') && detail.includes('Stored interval'))
  await closeDialog()
  await clickText('Dimensions')
  await page.click('main details summary')
  pass('Measure selection changes the plotted series; factors show stored intervals and correct session detail')

  await page.select('select[aria-label="Reference"]', 'example-leaders')
  assert.equal(await page.$$eval('main svg [data-reference-line]', (nodes) => nodes.length), 5)
  await clickText('Difference')
  assert.equal(await chartCount(), 5)
  assert((await mainText()).includes('Illustrative reference'))
  assert((await mainText()).includes('n=240'))
  await shot('individual-reference-difference')
  await inputValue('History start', '2025-12-04')
  assert.equal(await page.$$eval('main svg circle[role=button]', (nodes) => nodes.length), 15)
  await inputValue('History start', '2026-09-01')
  assert((await mainText()).includes('Check the date range'))
  await inputValue('History start', '2025-09-17')
  pass('Version-labelled reference values stay fixed across history; difference mode and date validation work')

  await clickText('Export'); await clickLabel('Use anonymous labels')
  await page.evaluate(() => { window.__studioPrintCalled = false; window.print = () => { window.__studioPrintCalled = true } })
  await clickText('Print / save PDF'); await page.waitForFunction(() => window.__studioPrintCalled)
  await page.waitForSelector('[role=dialog]', { hidden: true })
  await page.pdf({ path: resolve(output, 'trajectory-report.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true })
  const report = await page.$eval('article', (e) => e.textContent)
  assert(!report.includes('Priya Sharma'))
  assert(report.includes('People leaders · example norm'))
  pass('Individual PDF preserves multiple measures and reference provenance without leaking anonymous names')

  // Exercise the concept navigation in the app, including after an export.
  await page.click('[aria-label="Design experiences"] button:nth-child(3)')
  await page.waitForFunction(() => new URL(location.href).searchParams.get('experience') === 'unified')
  await page.click('[aria-label="Analysis view"] button:nth-child(2)')
  assert.equal(await chartCount(), 4)
  await page.select('select[aria-label="Focus measure"]', 'dimension-1')
  await inputValue('History end', '2025-12-04')
  assert.equal(await page.$$eval('main svg circle[role=button]', (nodes) => nodes.length), 8)
  await page.click('[aria-label="Analysis view"] button:first-child')
  assert((await page.$eval('[aria-label="Overall score comparison"]', (e) => e.innerText)).includes('Group mean 76'))
  await page.click('[aria-label="Analysis view"] button:nth-child(2)')
  assert.equal(await page.$eval('select[aria-label="Focus measure"]', (e) => e.value), 'dimension-1')
  assert.equal(await page.$eval('input[aria-label="History end"]', (e) => e.value), '2025-12-04')
  await inputValue('History end', '2026-08-27')
  await shot('unified-time-desktop')
  pass('Unified views preserve their campaign results and history settings independently')
  for (const name of ['Amara Okafor', 'James Mitchell', 'Sofia Chen']) await page.click(`button[aria-label="Remove ${name}"]`)
  assert.equal(await chartCount(), 5)
  assert.equal(await page.$('select[aria-label="Focus measure"]'), null)
  assert.equal(await page.$eval('select[aria-label="Reference"]', (e) => e.value), 'none')
  pass('Unified trajectory switches to multiple measures when only one person remains')

  await page.click('button[aria-label="Toggle colour theme"]')
  await page.waitForFunction(() => document.documentElement.dataset.studioTheme === 'dark'); await delay(250)
  await shot('unified-dark')
  await page.click('[aria-label="Analysis view"] button:first-child')
  await clickText('Choose results')
  const modalBackground = await page.$eval('[role=dialog]', (e) => getComputedStyle(e).backgroundColor)
  const cardBackground = await page.$eval('[aria-label="Comparison profile"]', (e) => getComputedStyle(e).backgroundColor)
  assert.equal(modalBackground, cardBackground, 'Dark dialogs use the dark card surface')
  await shot('result-selection-dark'); await closeDialog()
  await page.click('button[aria-label="Toggle colour theme"]')
  await page.waitForFunction(() => document.documentElement.dataset.studioTheme === 'light'); await delay(250)
  pass('Dark and light themes cover chart, reference and result selection surfaces')

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await shot('unified-snapshot-mobile')
  let dimensions = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }))
  assert(dimensions.page <= dimensions.viewport, `Snapshot overflow: ${JSON.stringify(dimensions)}`)
  await page.click('[aria-label="Analysis view"] button:nth-child(2)')
  await page.waitForFunction(() => Number(document.querySelector('main svg').getAttribute('viewBox').split(' ')[2]) < 400)
  await shot('unified-mobile')
  const summaryRight = await page.$eval('main table', (e) => e.getBoundingClientRect().right)
  assert(summaryRight <= 390, 'First, latest and change columns remain visible on mobile')
  dimensions = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }))
  assert(dimensions.page <= dimensions.viewport, `History overflow: ${JSON.stringify(dimensions)}`)
  pass('Both snapshot and timeline work at 390px without document overflow')
  assert.deepEqual(errors, [], 'No browser runtime exceptions or console errors')
  pass('No browser runtime exceptions or console errors')
  await writeFile(resolve(output, 'browser-checks.json'), JSON.stringify({ checks, errors, downloads }, null, 2))
} finally { await browser.close() }
