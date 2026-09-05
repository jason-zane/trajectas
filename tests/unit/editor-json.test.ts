import { describe, expect, it } from 'vitest'
import { sanitizeEditorJson } from '@/lib/security/editor-json'

describe('legacy email editor JSON boundary', () => {
  it('removes nested JSON-origin prototype keys without changing legitimate document content', () => {
    const input = JSON.parse('{"type":"doc","content":[{"type":"image","attrs":{"src":"https://example.com/image.png","__proto__":{"data-inherited":"unexpected"},"constructor":{"prototype":{"data-inherited":"unexpected"}}}}]}')
    const safe = sanitizeEditorJson(input)
    expect(safe).toEqual({ type: 'doc', content: [{ type: 'image', attrs: { src: 'https://example.com/image.png' } }] })
    expect(Object.getPrototypeOf(safe.content[0].attrs)).toBe(Object.prototype)
    expect(safe.content[0].attrs['data-inherited']).toBeUndefined()
    expect(Object.hasOwn(input.content[0].attrs, '__proto__')).toBe(true)
  })
})
