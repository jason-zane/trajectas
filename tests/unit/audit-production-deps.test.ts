/**
 * The `security` job's audit step went red three times in one day for reasons
 * that had nothing to do with the dependencies: a 400 from npm's retired
 * quick-audit endpoint and two 503s from the registry. `npm audit` exits 1 for
 * both a real advisory and an unreachable endpoint, so the job could not tell
 * the difference and everyone learned to re-run it.
 *
 * `scripts/audit-production-deps.mjs` draws that line. These tests pin the
 * classification, because the whole value of the wrapper is that a registry
 * outage never fails the build and a high-severity advisory always does — and
 * the two are only distinguishable by the shape of the JSON npm emits.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  auditWithRetry,
  backoffMs,
  classifyAuditRun,
  describeFailingAdvisories,
  hasFailingAdvisory,
  severityCounts,
} from '../../scripts/audit-production-deps.mjs'

/** The shape npm emits for a successful audit. */
const report = (counts: Record<string, number>, vulnerabilities = {}) =>
  JSON.stringify({
    auditReportVersion: 2,
    vulnerabilities,
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, ...counts },
      dependencies: {},
    },
  })

/** The shape npm emits when the audit endpoint answers with an HTTP error. */
const httpError = (statusCode: number, path = '/-/npm/v1/security/advisories/bulk') =>
  JSON.stringify({
    message: `${statusCode} Service Unavailable - POST https://registry.npmjs.org${path} - Service Unavailable`,
    method: 'POST',
    uri: `https://registry.npmjs.org${path}`,
    statusCode,
    body: { error: 'Service Unavailable' },
  })

/** The shape npm emits when the request never reached the registry at all. */
const networkError = (reason: string) =>
  JSON.stringify({
    message: `request to https://registry.npmjs.org/-/npm/v1/security/advisories/bulk failed, reason: ${reason}`,
    error: { summary: '', detail: '' },
  })

describe('classifyAuditRun', () => {
  it('reads a real report even though npm exits 1 alongside it', () => {
    const result = classifyAuditRun({ stdout: report({ high: 2 }), exitCode: 1 })
    expect(result.outcome).toBe('report')
    expect(severityCounts(result.report).high).toBe(2)
  })

  it('treats a 503 from the bulk endpoint as transport, not a finding', () => {
    expect(classifyAuditRun({ stdout: httpError(503), exitCode: 1 }).outcome).toBe('transport')
  })

  it.each([500, 502, 503, 504, 408, 429])('retries on %i', (status) => {
    expect(classifyAuditRun({ stdout: httpError(status), exitCode: 1 }).outcome).toBe('transport')
  })

  it.each(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'connect ECONNREFUSED 127.0.0.1:443', 'socket hang up'])(
    'treats %s as transport',
    (reason) => {
      expect(classifyAuditRun({ stdout: networkError(reason), exitCode: 1 }).outcome).toBe('transport')
    },
  )

  it('treats the retired quick-audit endpoint as transport whatever it answers', () => {
    // npm 10 only reaches this endpoint after the bulk request has already
    // failed, so its 400 "Invalid package tree" is a symptom, not a diagnosis.
    const stdout = JSON.stringify({
      message: '400 Bad Request - POST https://registry.npmjs.org/-/npm/v1/security/audits/quick - Invalid package tree',
      uri: 'https://registry.npmjs.org/-/npm/v1/security/audits/quick',
      statusCode: 400,
    })
    expect(classifyAuditRun({ stdout, exitCode: 1 }).outcome).toBe('transport')
  })

  it('fails closed on a 4xx from the bulk endpoint', () => {
    // A rejected payload is a real problem with what we sent. Retrying it just
    // hides it, and passing the job on it would be the `|| true` we refused.
    const result = classifyAuditRun({ stdout: httpError(400), exitCode: 1 })
    expect(result.outcome).toBe('unknown')
  })

  it.each([401, 403, 404])('fails closed on %i from the bulk endpoint', (status) => {
    expect(classifyAuditRun({ stdout: httpError(status), exitCode: 1 }).outcome).toBe('unknown')
  })

  it('fails closed on a local npm error that never mentions the audit endpoint', () => {
    const stdout = JSON.stringify({ message: 'ENOENT: no such file or directory, open package.json' })
    expect(classifyAuditRun({ stdout, exitCode: 1 }).outcome).toBe('unknown')
  })

  it('fails closed when npm produced no parseable output', () => {
    expect(classifyAuditRun({ stdout: '', exitCode: 137 }).outcome).toBe('unknown')
    expect(classifyAuditRun({ stdout: 'Killed', exitCode: 137 }).outcome).toBe('unknown')
  })

  it('treats a hung audit as transport', () => {
    // A request that never answers is the same outage as one that answers 503,
    // and without this the job would sit until the 15-minute job timeout.
    const result = classifyAuditRun({ stdout: '', exitCode: null, timedOut: true })
    expect(result.outcome).toBe('transport')
    expect(result.reason).toMatch(/did not answer/)
  })
})

describe('hasFailingAdvisory', () => {
  it('passes a report with only moderate findings', () => {
    // The repo currently sits here: dozens of moderate advisories, zero high.
    expect(hasFailingAdvisory(JSON.parse(report({ moderate: 37 })))).toBe(false)
  })

  it.each(['high', 'critical'])('fails a report with a %s finding', (severity) => {
    expect(hasFailingAdvisory(JSON.parse(report({ [severity]: 1 })))).toBe(true)
  })

  it('names the offending package and its advisory', () => {
    const parsed = JSON.parse(
      report(
        { high: 1 },
        {
          next: {
            name: 'next',
            severity: 'high',
            range: '<15.4.7',
            fixAvailable: { name: 'next', version: '15.4.7', isSemVerMajor: false },
            via: [{ title: 'Next.js cache poisoning', url: 'https://example.test/advisory' }],
          },
          lodash: { name: 'lodash', severity: 'moderate', range: '<4.17.21', via: [] },
        },
      ),
    )
    const lines = describeFailingAdvisories(parsed).join('\n')
    expect(lines).toContain('next')
    expect(lines).toContain('Next.js cache poisoning')
    expect(lines).toContain('next@15.4.7')
    expect(lines).not.toContain('lodash')
  })
})

describe('auditWithRetry', () => {
  const wait = () => Promise.resolve()

  it('retries a transport failure and returns the report once the registry recovers', async () => {
    const run = vi
      .fn()
      .mockReturnValueOnce({ stdout: httpError(503), stderr: '', exitCode: 1 })
      .mockReturnValueOnce({ stdout: httpError(503), stderr: '', exitCode: 1 })
      .mockReturnValueOnce({ stdout: report({ moderate: 3 }), stderr: '', exitCode: 0 })

    const result = await auditWithRetry({ run, wait })
    expect(result.outcome).toBe('report')
    expect(result.attempts).toBe(3)
  })

  it('gives up as transport after exhausting its attempts', async () => {
    const run = vi.fn().mockReturnValue({ stdout: httpError(503), stderr: '', exitCode: 1 })
    const result = await auditWithRetry({ run, wait, attempts: 4 })
    expect(result.outcome).toBe('transport')
    expect(run).toHaveBeenCalledTimes(4)
  })

  it('does not retry a real report, clean or not', async () => {
    const run = vi.fn().mockReturnValue({ stdout: report({ critical: 1 }), stderr: '', exitCode: 1 })
    const result = await auditWithRetry({ run, wait })
    expect(result.outcome).toBe('report')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('carries npm’s exit code through, so a clean report that still failed can be caught', async () => {
    const run = vi.fn().mockReturnValue({ stdout: report({ moderate: 2 }), stderr: '', exitCode: 1 })
    const result = await auditWithRetry({ run, wait })
    expect(result.outcome).toBe('report')
    expect(hasFailingAdvisory(result.report)).toBe(false)
    expect(result.exitCode).toBe(1)
  })

  it('retries a hung attempt and succeeds on the next one', async () => {
    const run = vi
      .fn()
      .mockReturnValueOnce({ stdout: '', stderr: '', exitCode: null, timedOut: true })
      .mockReturnValueOnce({ stdout: report({ moderate: 1 }), stderr: '', exitCode: 0 })

    const result = await auditWithRetry({ run, wait })
    expect(result.outcome).toBe('report')
    expect(result.attempts).toBe(2)
  })

  it('does not retry a failure it cannot classify', async () => {
    const run = vi.fn().mockReturnValue({ stdout: '', stderr: 'boom', exitCode: 1 })
    const result = await auditWithRetry({ run, wait })
    expect(result.outcome).toBe('unknown')
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('backoffMs', () => {
  it('grows exponentially and stays inside the cap', () => {
    const mid = () => 0.5
    expect(backoffMs(1, { random: mid })).toBe(3_000)
    expect(backoffMs(2, { random: mid })).toBe(9_000)
    expect(backoffMs(3, { random: mid })).toBe(27_000)
    expect(backoffMs(4, { random: mid })).toBe(30_000)
  })

  it('never exceeds the cap even at maximum jitter', () => {
    expect(backoffMs(9, { random: () => 1 })).toBe(30_000)
  })
})
