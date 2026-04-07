import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared with vi.hoisted so they are available
// inside vi.mock() factory functions (Vitest hoists vi.mock calls to the top).
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const mailyRender = vi.fn()
  const reactEmailRender = vi.fn()
  const sanitize = vi.fn((input: string) => input)
  return { mailyRender, reactEmailRender, sanitize }
})

vi.mock('@maily-to/render', () => ({
  // The Maily constructor returns an object whose .render points to the
  // hoisted mock function. We re-apply this in beforeEach because
  // vitest.config `mockReset: true` resets mock implementations.
  // Must use a regular function (not arrow) so `new Maily()` works.
  Maily: vi.fn().mockImplementation(function (this: unknown) {
    return { render: mocks.mailyRender }
  }),
}))

vi.mock('@react-email/components', () => ({
  render: mocks.reactEmailRender,
  Body: ({ children }: { children: unknown }) => children,
  Container: ({ children }: { children: unknown }) => children,
  Head: () => null,
  Html: ({ children }: { children: unknown }) => children,
  Hr: () => null,
  Img: () => null,
  Preview: ({ children }: { children: unknown }) => children,
  Section: ({ children }: { children: unknown }) => children,
  Text: ({ children }: { children: unknown }) => children,
}))

vi.mock('isomorphic-dompurify', () => ({
  default: { sanitize: mocks.sanitize },
  sanitize: mocks.sanitize,
}))

// ---------------------------------------------------------------------------
// Import module under test and mocked modules (AFTER mocks)
// ---------------------------------------------------------------------------

import { substituteVariables, renderEmailHtml } from '@/lib/email/render'
import { Maily } from '@maily-to/render'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const sampleBrand = {
  name: 'Acme Corp',
  logoUrl: null,
  primaryColor: '#3b82f6',
  textColor: '#111827',
  footerTextColor: '#6b7280',
}

const sampleEditorJson = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello!' }] }],
}

// ---------------------------------------------------------------------------
// substituteVariables
// ---------------------------------------------------------------------------

describe('substituteVariables', () => {
  it('replaces known {{key}} placeholders with their values', () => {
    const result = substituteVariables('Hello, {{name}}!', { name: 'Jordan' })
    expect(result).toBe('Hello, Jordan!')
  })

  it('replaces multiple different keys in one string', () => {
    const result = substituteVariables('{{greeting}}, {{name}}!', {
      greeting: 'Hi',
      name: 'Alex',
    })
    expect(result).toBe('Hi, Alex!')
  })

  it('preserves unknown {{unknown}} placeholders unchanged', () => {
    const result = substituteVariables('Hello, {{unknown}}!', { name: 'Jordan' })
    expect(result).toBe('Hello, {{unknown}}!')
  })

  it('handles an empty variables map without error', () => {
    const result = substituteVariables('No variables here.', {})
    expect(result).toBe('No variables here.')
  })

  it('replaces the same key multiple times', () => {
    const result = substituteVariables('{{x}} and {{x}}', { x: 'foo' })
    expect(result).toBe('foo and foo')
  })
})

// ---------------------------------------------------------------------------
// renderEmailHtml
// ---------------------------------------------------------------------------

describe('renderEmailHtml', () => {
  beforeEach(() => {
    // mockReset: true in vitest.config resets mock implementations between tests,
    // so we must re-apply the Maily constructor implementation each time.
    // Must use a function (not arrow) so `new` works in the module under test.
    vi.mocked(Maily).mockImplementation(function (this: unknown) {
      return { render: mocks.mailyRender } as unknown as InstanceType<typeof Maily>
    })

    // Default sanitize passthrough
    mocks.sanitize.mockImplementation((input: string) => input)
  })

  it('returns html and text from the full pipeline', async () => {
    mocks.mailyRender.mockResolvedValueOnce('<p>Hello from Maily</p>')
    // render() is called twice: once for HTML, once for plain text
    mocks.reactEmailRender
      .mockResolvedValueOnce('<html>Final HTML</html>')
      .mockResolvedValueOnce('Final plain text')

    const result = await renderEmailHtml({
      editorJson: sampleEditorJson,
      variables: {},
      brand: sampleBrand,
    })

    expect(result.html).toBe('<html>Final HTML</html>')
    expect(result.text).toBe('Final plain text')
  })

  it('sanitizes the Maily-rendered HTML via DOMPurify', async () => {
    mocks.mailyRender.mockResolvedValueOnce('<p>Hello</p>')
    mocks.reactEmailRender
      .mockResolvedValueOnce('<html></html>')
      .mockResolvedValueOnce('')

    await renderEmailHtml({
      editorJson: sampleEditorJson,
      variables: {},
      brand: sampleBrand,
    })

    expect(mocks.sanitize).toHaveBeenCalledWith('<p>Hello</p>', expect.any(Object))
  })

  it('substitutes merge variables in rendered body', async () => {
    mocks.mailyRender.mockResolvedValueOnce('<p>Hello, {{firstName}}!</p>')
    // render() is called twice: once for HTML (returns the bodyHtml), once for plain text
    mocks.reactEmailRender.mockImplementation(
      async (element: { props: { bodyHtml: string } }) =>
        element.props.bodyHtml,
    )

    const result = await renderEmailHtml({
      editorJson: sampleEditorJson,
      variables: { firstName: 'Taylor' },
      brand: sampleBrand,
    })

    expect(result.html).toContain('Taylor')
    expect(result.html).not.toContain('{{firstName}}')
    mocks.reactEmailRender.mockReset()
  })

  it('passes brand props through to the frame', async () => {
    mocks.mailyRender.mockResolvedValueOnce('<p>Content</p>')
    mocks.reactEmailRender
      .mockResolvedValueOnce('<html></html>')
      .mockResolvedValueOnce('')

    await renderEmailHtml({
      editorJson: sampleEditorJson,
      variables: {},
      brand: {
        name: 'Custom Brand',
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#ff0000',
        textColor: '#000000',
        footerTextColor: '#999999',
      },
    })

    // render() is called twice: once for HTML, once for plain text
    expect(mocks.reactEmailRender).toHaveBeenCalledTimes(2)
  })
})
