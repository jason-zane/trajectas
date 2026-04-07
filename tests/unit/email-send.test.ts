import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — all declared with vi.hoisted() so they are available inside
// vi.mock() factory functions (Vitest hoists vi.mock calls to the top).
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const resolveTemplate = vi.fn()
  const getEffectiveBrand = vi.fn()
  const renderEmailHtml = vi.fn()
  const sendHtmlEmail = vi.fn()

  // Provide a real substituteVariables implementation
  const substituteVariables = vi.fn(
    (text: string, vars: Record<string, string>) =>
      text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? _),
  )

  return { resolveTemplate, getEffectiveBrand, renderEmailHtml, substituteVariables, sendHtmlEmail }
})

vi.mock('@/lib/email/template-registry', () => ({
  resolveTemplate: mocks.resolveTemplate,
}))

vi.mock('@/app/actions/brand', () => ({
  getEffectiveBrand: mocks.getEffectiveBrand,
}))

vi.mock('@/lib/email/render', () => ({
  renderEmailHtml: mocks.renderEmailHtml,
  substituteVariables: mocks.substituteVariables,
}))

vi.mock('@/lib/email/provider', () => ({
  sendHtmlEmail: mocks.sendHtmlEmail,
}))

// ---------------------------------------------------------------------------
// Import module under test (AFTER mocks)
// ---------------------------------------------------------------------------

import { sendEmail } from '@/lib/email/send'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const platformTemplate = {
  id: 'tmpl-platform-1',
  type: 'magic_link' as const,
  scope_type: 'platform' as const,
  scope_id: null,
  subject: 'Sign in to {{brandName}}',
  preview_text: null,
  editor_json: { type: 'doc', content: [] },
  html_cache: '<p>Sign in</p>',
  is_active: true,
}

const clientTemplate = {
  ...platformTemplate,
  id: 'tmpl-client-1',
  scope_type: 'client' as const,
  scope_id: 'client-xyz',
  subject: 'Client: Sign in to {{brandName}}',
}

const defaultBrand = {
  name: 'Acme Corp',
  primaryColor: '#2d6a5a',
  accentColor: '#c9a962',
  emailStyles: {
    textColor: '#1a1a1a',
    highlightColor: '#2d6a5a',
    footerTextColor: '#737373',
  },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: platform template found
    mocks.resolveTemplate.mockResolvedValue(platformTemplate)

    // Default: brand resolved with emailStyles
    mocks.getEffectiveBrand.mockResolvedValue(defaultBrand)

    // Default: render succeeds
    mocks.renderEmailHtml.mockResolvedValue({
      html: '<html>Final</html>',
      text: 'Final text',
    })

    // Default: send succeeds
    mocks.sendHtmlEmail.mockResolvedValue({ data: { id: 'msg-1' }, error: null })

    // Reset EMAIL_FROM env
    delete process.env.EMAIL_FROM
  })

  // -------------------------------------------------------------------------
  // 1. Happy path — resolves, renders, sends with substituted subject
  // -------------------------------------------------------------------------
  it('resolves template, renders, and sends with correct substituted subject', async () => {
    await sendEmail({
      type: 'magic_link',
      to: 'user@example.com',
      variables: { brandName: 'Acme Corp', signInUrl: 'https://example.com/auth' },
    })

    expect(mocks.resolveTemplate).toHaveBeenCalledWith('magic_link', expect.any(Object))
    expect(mocks.renderEmailHtml).toHaveBeenCalledTimes(1)
    expect(mocks.sendHtmlEmail).toHaveBeenCalledTimes(1)

    const sendCall = mocks.sendHtmlEmail.mock.calls[0][0]
    // subject should have {{brandName}} substituted
    expect(sendCall.subject).toBe('Sign in to Acme Corp')
    expect(sendCall.to).toBe('user@example.com')
    expect(sendCall.html).toBe('<html>Final</html>')
    expect(sendCall.text).toBe('Final text')
  })

  // -------------------------------------------------------------------------
  // 2. Throws when no template found at any level
  // -------------------------------------------------------------------------
  it('throws when no template found at any level', async () => {
    mocks.resolveTemplate.mockResolvedValue(null)

    await expect(
      sendEmail({
        type: 'magic_link',
        to: 'user@example.com',
        variables: {},
      }),
    ).rejects.toThrow('No email template found for type magic_link')
  })

  // -------------------------------------------------------------------------
  // 3. Passes correct scope to template resolution and brand resolution
  // -------------------------------------------------------------------------
  it('passes correct scope to template resolution and brand resolution', async () => {
    await sendEmail({
      type: 'assessment_invite',
      to: 'participant@example.com',
      variables: { participantFirstName: 'Jordan', campaignTitle: 'Q4 Campaign' },
      scopeClientId: 'client-xyz',
      scopePartnerId: 'partner-abc',
      scopeCampaignId: 'campaign-123',
    })

    // Template resolution gets client and partner IDs
    expect(mocks.resolveTemplate).toHaveBeenCalledWith('assessment_invite', {
      clientId: 'client-xyz',
      partnerId: 'partner-abc',
    })

    // Brand resolution gets clientId and campaignId
    expect(mocks.getEffectiveBrand).toHaveBeenCalledWith('client-xyz', 'campaign-123')
  })

  // -------------------------------------------------------------------------
  // 4. Sets from display name to brand name
  // -------------------------------------------------------------------------
  it('sets from display name to brand name', async () => {
    process.env.EMAIL_FROM = 'noreply@mail.example.com'

    await sendEmail({
      type: 'magic_link',
      to: 'user@example.com',
      variables: {},
    })

    const sendCall = mocks.sendHtmlEmail.mock.calls[0][0]
    // from should include brand name as display name
    expect(sendCall.from).toContain('Acme Corp')
    expect(sendCall.from).toContain('noreply@mail.example.com')
  })

  // -------------------------------------------------------------------------
  // 5. Fallback tier 1: client-scoped template render fails → retry with platform default
  // -------------------------------------------------------------------------
  it('re-resolves platform default and retries render when client-scoped template render fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // First resolve returns a client-scoped template
    mocks.resolveTemplate.mockResolvedValueOnce(clientTemplate)
    // Second resolve (platform fallback) returns platform template
    mocks.resolveTemplate.mockResolvedValueOnce(platformTemplate)

    // First render (client template) throws
    mocks.renderEmailHtml.mockRejectedValueOnce(new Error('Maily render failed'))
    // Second render (platform fallback) succeeds
    mocks.renderEmailHtml.mockResolvedValueOnce({
      html: '<html>Platform Fallback</html>',
      text: 'Platform fallback text',
    })

    await sendEmail({
      type: 'magic_link',
      to: 'user@example.com',
      variables: { brandName: 'Acme' },
      scopeClientId: 'client-xyz',
    })

    // Should have attempted render twice
    expect(mocks.renderEmailHtml).toHaveBeenCalledTimes(2)

    // Should have re-resolved with empty scope (platform default)
    expect(mocks.resolveTemplate).toHaveBeenCalledTimes(2)
    expect(mocks.resolveTemplate).toHaveBeenLastCalledWith('magic_link', {})

    // Should have logged a warning
    expect(warnSpy).toHaveBeenCalled()

    // Should send successfully with platform fallback HTML
    const sendCall = mocks.sendHtmlEmail.mock.calls[0][0]
    expect(sendCall.html).toBe('<html>Platform Fallback</html>')

    warnSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // 6. Fallback tier 2: platform default render also fails → sends plain-text fallback
  // -------------------------------------------------------------------------
  it('sends plain-text fallback with variables inlined when platform render also fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // First resolve returns client-scoped template
    mocks.resolveTemplate.mockResolvedValueOnce(clientTemplate)
    // Second resolve returns platform template
    mocks.resolveTemplate.mockResolvedValueOnce(platformTemplate)

    // Both renders fail
    mocks.renderEmailHtml.mockRejectedValueOnce(new Error('Maily render failed'))
    mocks.renderEmailHtml.mockRejectedValueOnce(new Error('Platform render also failed'))

    await sendEmail({
      type: 'magic_link',
      to: 'user@example.com',
      variables: { brandName: 'Acme', signInUrl: 'https://example.com/login' },
      scopeClientId: 'client-xyz',
    })

    // Should still send
    expect(mocks.sendHtmlEmail).toHaveBeenCalledTimes(1)

    const sendCall = mocks.sendHtmlEmail.mock.calls[0][0]
    // Plain-text fallback: should contain variable key=value pairs
    expect(sendCall.text).toContain('brandName=Acme')
    expect(sendCall.text).toContain('signInUrl=https://example.com/login')
    // HTML should be a basic <p>-wrapped version
    expect(sendCall.html).toContain('<p>')

    // Should have logged a warning and an error
    expect(warnSpy).toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // 7. Logs render failures
  // -------------------------------------------------------------------------
  it('logs render failures with console.warn and console.error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Client template that fails render
    mocks.resolveTemplate.mockResolvedValueOnce(clientTemplate)
    // Platform template for fallback
    mocks.resolveTemplate.mockResolvedValueOnce(platformTemplate)

    // Both renders fail
    mocks.renderEmailHtml.mockRejectedValueOnce(new Error('render error 1'))
    mocks.renderEmailHtml.mockRejectedValueOnce(new Error('render error 2'))

    await sendEmail({
      type: 'magic_link',
      to: 'user@example.com',
      variables: {},
      scopeClientId: 'client-xyz',
    })

    // Tier 1 failure: console.warn
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('tmpl-client-1'),
      expect.any(Error),
    )

    // Tier 2 failure: console.error (message contains "Platform" or "platform")
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Platform'), expect.any(Error))

    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })
})
