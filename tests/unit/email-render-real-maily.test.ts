// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATES } from '@/lib/email/default-templates'
import { renderEmailHtml } from '@/lib/email/render'

const brand = {
  name: 'Trajectas',
  logoUrl: null,
  primaryColor: '#000000',
  textColor: '#111827',
  footerTextColor: '#6b7280',
}

describe('assessment reminder through real Maily', () => {
  it('renders saved variable nodes, raw handlebars and the assessment link', async () => {
    const result = await renderEmailHtml({
      editorJson: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES.assessment_reminder)),
      variables: {
        participantFirstName: 'Jason',
        campaignTitle: 'Leadership Assessment',
        assessmentUrl: 'https://app.trajectas.com/assess/test-token',
        daysRemaining: '7',
      },
      brand,
    })

    const document = new DOMParser().parseFromString(result.html, 'text/html')
    expect(document.querySelector('h2')?.textContent).toBe('Reminder: Leadership Assessment')
    expect(document.body.textContent).toContain('Hi Jason,')
    expect(document.body.textContent).toContain('You have 7 days remaining.')
    expect(result.text).toContain('REMINDER: LEADERSHIP ASSESSMENT')
    expect(result.text).toContain('Hi Jason,')
    expect(result.text).toContain('assessment Leadership Assessment')
    expect(result.text).toContain('You have 7 days remaining.')
    expect(result.html).toContain('href="https://app.trajectas.com/assess/test-token"')
    expect(result.html).not.toContain('{{campaignTitle}}')
  })

  it('keeps variable nodes and raw handlebars escaped without double escaping', async () => {
    const campaignTitle = '<img src=x onerror=alert(1)> & Leadership'
    const participantFirstName = '<script>alert(1)</script> & Jason'
    const result = await renderEmailHtml({
      editorJson: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES.assessment_reminder)),
      variables: {
        participantFirstName,
        campaignTitle,
        assessmentUrl: 'https://app.trajectas.com/assess/test-token?x=1&y=2',
        daysRemaining: '7',
      },
      brand,
      previewText: 'Hi {{participantFirstName}}',
    })

    const document = new DOMParser().parseFromString(result.html, 'text/html')
    expect(document.querySelector('h2')?.textContent).toBe(`Reminder: ${campaignTitle}`)
    expect(document.querySelector('strong')?.textContent).toBe(campaignTitle)
    expect(document.body.textContent).toContain(`Hi ${participantFirstName},`)
    expect(document.querySelector('script, [onerror]')).toBeNull()
    expect(result.html).toContain('&lt;script&gt;')
    expect(result.html).not.toContain('&amp;lt;script')
    expect(result.text).toContain(`Hi ${participantFirstName},`)
  })

  it('uses Maily node fallbacks while leaving unknown raw handlebars intact', async () => {
    const result = await renderEmailHtml({
      editorJson: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES.assessment_reminder)),
      variables: { assessmentUrl: 'https://app.trajectas.com/assess/test-token' },
      brand,
    })

    const document = new DOMParser().parseFromString(result.html, 'text/html')
    expect(document.querySelector('h2')?.textContent).toBe('Reminder: Assessment')
    expect(document.body.textContent).toContain('Hi there,')
    expect(document.body.textContent).toContain('You have a few days remaining.')
    expect(document.querySelector('strong')?.textContent).toBe('{{campaignTitle}}')
  })
})
