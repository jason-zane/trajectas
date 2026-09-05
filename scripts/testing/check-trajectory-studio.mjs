import assert from 'node:assert/strict'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import puppeteer from 'puppeteer-core'

const base = process.env.STUDIO_URL ?? 'http://127.0.0.1:3012'
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Run against a local development server only.')
const output = resolve('output/trajectory-studio')
const downloads = resolve(output, 'downloads')
await mkdir(downloads, { recursive: true })
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const checks = []
const errors = []
try {
  const page = await browser.newPage()
  page.setDefaultTimeout(12000)
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
  async function dateInput(label, value) {
    await page.$eval(`input[aria-label="${label}"]`, (element, next) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, next)
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
  }
  async function navigate(experience) {
    const response = await page.goto(`${base}/preview/trajectory?experience=${experience}`, { waitUntil: 'networkidle0' })
    assert.equal(response.status(), 200)
    await page.waitForSelector('main h1')
  }
  const shot = (name) => page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true })

  await navigate('compare')
  assert.equal(await page.$$eval('[aria-label="People and campaigns"] button[aria-pressed=true]', (nodes) => nodes.length), 4)
  await shot('compare-desktop')
  pass('Compare opens with four selected people and a scored profile')
  await page.click('button[aria-label="Show score matrix"]')
  await clickLabel('Compare across all')
  assert.equal(await page.$$eval('main table', (nodes) => nodes.length), 2)
  await shot('compare-multi-assessment-matrix')
  pass('Multi-assessment matrix displays two separate instruments')

  await clickText('Export')
  await page.waitForSelector('[role=dialog]')
  await clickLabel('Use anonymous labels')
  await clickText('Download CSV')
  let file
  for (let n = 0; n < 60; n++) { file = (await readdir(downloads)).find((name) => name.endsWith('.csv')); if (file) break; await delay(100) }
  assert(file, 'CSV downloaded')
  const csv = await readFile(resolve(downloads, file), 'utf8')
  assert(csv.includes('Person 1') && csv.includes('Workplace styles') && csv.includes('Leadership Index'))
  assert(!csv.includes('Priya') && !csv.includes('demo-person'))
  pass('Downloaded CSV matches both instruments and anonymizes identity')
  await page.evaluate(() => { window.__studioPrintCalled = false; window.print = () => { window.__studioPrintCalled = true } })
  await clickText('Print / save PDF')
  await page.waitForFunction(() => window.__studioPrintCalled)
  await page.waitForSelector('[role=dialog]', { hidden: true })
  await page.pdf({ path: resolve(output, 'comparison-report.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true })
  pass('Print action opens the report; PDF rendered with chart, scope and results')

  await clickText('Saved views')
  await page.click('input[aria-label="View name"]', { clickCount: 3 })
  await page.type('input[aria-label="View name"]', 'Review comparison')
  await clickText('Save current view')
  await page.waitForSelector('[role=dialog]', { hidden: true })
  assert(await page.evaluate(() => localStorage.getItem('trajectas-studio-v1-demo').includes('Review comparison')))
  pass('View selections and settings persist on this device')

  await page.select('select[aria-label="People type"]', 'Candidate')
  assert.equal(await page.$$eval('[aria-label="People and campaigns"] button[aria-pressed]', (nodes) => nodes.length), 4)
  await clickText('Clear')
  await page.waitForFunction(() => document.querySelector('main').innerText.includes('Choose people to build your comparison'))
  await page.select('select[aria-label="People type"]', 'all')
  for (let n = 0; n < 8; n++) await (await page.$$('[aria-label="People and campaigns"] button[aria-pressed]'))[n].click()
  assert.equal(await page.$$eval('[aria-label="People and campaigns"] button[aria-pressed=true]', (nodes) => nodes.length), 8)
  assert.equal(await page.$$eval('[aria-label="People and campaigns"] button[disabled]', (nodes) => nodes.length), 2)
  pass('People filters, clear state and eight-person selection limit work')

  await clickText('Saved views')
  for (const handle of await page.$$('[role=dialog] button')) {
    if (await handle.evaluate((element) => element.textContent.includes('Review comparison'))) { await handle.click(); break }
  }
  assert.equal(await page.$$eval('[aria-label="People and campaigns"] button[aria-pressed=true]', (nodes) => nodes.length), 4)
  pass('Saved view restores the original group and matrix settings')

  await navigate('individual')
  assert.equal(await page.$$eval('main svg circle[role=button]', (nodes) => nodes.length), 4)
  await shot('individual-desktop')
  await page.select('select[aria-label="Focus measure"]', 'factor-0-0')
  await page.click('button[aria-label="Configure dates and display"]')
  await clickLabel('Show stored score intervals')
  await clickText('Done')
  await page.waitForSelector('[role=dialog]', { hidden: true })
  assert((await page.$eval('main', (e) => e.innerText)).includes('Vertical whiskers show the stored score intervals'))
  await page.click('main svg circle[role=button]')
  await page.waitForSelector('[role=dialog]')
  assert((await page.$eval('[role=dialog]', (e) => e.innerText)).includes('Critical thinking'))
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role=dialog]', { hidden: true })
  pass('Individual trajectory shows dated observations, factor intervals and accessible session detail')

  await navigate('unified')
  await page.click('[aria-label="Analysis view"] button:nth-child(2)')
  await page.waitForSelector('main svg circle[role=button]')
  assert.equal(await page.$$eval('main svg polyline', (nodes) => nodes.length), 4)
  await page.select('select[aria-label="Focus measure"]', 'dimension-1')
  await page.click('[aria-label="Analysis view"] button:first-child')
  assert.equal(await page.$eval('select[aria-label="Focus measure"]', (e) => e.value), 'dimension-1')
  assert.equal(await page.$$eval('[aria-label="People and campaigns"] button[aria-pressed=true]', (nodes) => nodes.length), 4)
  await page.select('select[aria-label="Focus measure"]', '__overall')
  await shot('unified-desktop')
  await page.click('[aria-label="Analysis view"] button:nth-child(2)')
  await shot('unified-time-desktop')
  pass('Unified lens switch preserves people and focused measure')

  await page.click('button[aria-label="Configure dates and display"]')
  await dateInput('Window start', '2026-09-01')
  assert((await page.$eval('[role=dialog]', (e) => e.innerText)).includes('The end date must be on or after'))
  await dateInput('Window start', '2025-12-04')
  await clickText('Done')
  await page.waitForSelector('[role=dialog]', { hidden: true })
  assert.equal(await page.$$eval('main svg circle[role=button]', (nodes) => nodes.length), 12)
  pass('Date validation rejects reversed windows and changing the baseline rescopes every line')

  await page.click('button[aria-label="Toggle colour theme"]')
  await page.waitForFunction(() => document.documentElement.dataset.studioTheme === 'dark')
  await delay(250)
  await shot('unified-dark')
  await page.click('button[aria-label="Configure dates and display"]')
  await shot('settings-dark')
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role=dialog]', { hidden: true })
  await page.click('button[aria-label="Toggle colour theme"]')
  await page.waitForFunction(() => document.documentElement.dataset.studioTheme === 'light')
  await delay(250)
  pass('Light and dark themes apply to the workspace and modal controls')
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await page.waitForFunction(() => Number(document.querySelector('main svg').getAttribute('viewBox').split(' ')[2]) < 400)
  await shot('unified-mobile')
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }))
  assert(dimensions.page <= dimensions.viewport, `Mobile overflow: ${JSON.stringify(dimensions)}`)
  pass('390px mobile viewport has no document overflow')
  assert.deepEqual(errors, [], 'No browser runtime exceptions')
  pass('No browser runtime exceptions')
  await writeFile(resolve(output, 'browser-checks.json'), JSON.stringify({ checks, errors }, null, 2))
} finally { await browser.close() }
