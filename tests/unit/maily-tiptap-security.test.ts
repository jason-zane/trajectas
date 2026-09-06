// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

type TiptapCore = Pick<typeof import('@tiptap/core'), 'mergeAttributes'>

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const appRequire = createRequire(import.meta.url)
// Resolve from Maily's actual entry. A top-level Tiptap import would test the
// separate v3 copy and could miss a vulnerable v2 copy used by the email editor.
const mailyRequire = createRequire(appRequire.resolve('@maily-to/core'))
const nestedCoreEntry = mailyRequire.resolve('@tiptap/core')
const nestedCoreRoot = resolve(dirname(nestedCoreEntry), '..')
const nestedPackage = JSON.parse(
  readFileSync(resolve(nestedCoreRoot, 'package.json'), 'utf8'),
) as { name: string; version: string; module: string }
const { DOMSerializer, Schema } = mailyRequire('@tiptap/pm/model') as typeof import('@tiptap/pm/model')

function untrustedAttributes() {
  return JSON.parse(
    '{"__proto__":{"data-inherited-canary":"present","src":"invalid-canary","onerror":"canary"}}',
  ) as Record<string, unknown>
}

function renderImage(attributes: Record<string, unknown>) {
  const schema = new Schema({
    nodes: {
      doc: { content: 'image' },
      image: { toDOM: () => ['img', attributes] },
      text: {},
    },
  })
  const content = schema.node('doc', null, [schema.node('image')])
  return DOMSerializer.fromSchema(schema)
    .serializeFragment(content.content, { document })
    .firstChild as HTMLImageElement
}

it('targets the lockfile-installed Maily Tiptap 2 dependency, not the separate top-level Tiptap 3', () => {
  const lock = JSON.parse(readFileSync(resolve(projectRoot, 'package-lock.json'), 'utf8')) as {
    packages: Record<string, { version: string }>
  }
  const lockKey = relative(projectRoot, nestedCoreRoot).split(sep).join('/')
  expect(nestedCoreEntry).not.toBe(appRequire.resolve('@tiptap/core'))
  expect(nestedPackage.name).toBe('@tiptap/core')
  expect(nestedPackage.version).toMatch(/^2\./)
  expect(lock.packages[lockKey]?.version).toBe(nestedPackage.version)
})

describe.each(['CommonJS', 'ES module'] as const)('Maily nested Tiptap %s security', (build) => {
  let core: TiptapCore

  beforeAll(async () => {
    core = build === 'CommonJS'
      ? mailyRequire('@tiptap/core') as TiptapCore
      : await import(pathToFileURL(resolve(nestedCoreRoot, nestedPackage.module)).href) as TiptapCore
  })

  it('keeps JSON-origin prototype keys from creating inherited attributes', () => {
    const input = untrustedAttributes()
    const attributes = core.mergeAttributes({ class: 'image' }, input, { title: 'Kept' })
    expect(Object.getPrototypeOf(attributes)).toBe(Object.prototype)
    expect(attributes['data-inherited-canary']).toBeUndefined()
    expect(attributes.src).toBeUndefined()
    expect(attributes.onerror).toBeUndefined()
    expect(attributes.title).toBe('Kept')
    expect(Object.hasOwn(input, '__proto__')).toBe(true)
  })

  it('cannot turn prototype-provided values into ProseMirror DOM attributes', () => {
    // Exercise the actual downstream serializer from the advisory, without the
    // application's sanitizer masking a regression in the nested dependency.
    const image = renderImage(core.mergeAttributes(untrustedAttributes()))
    expect(image.tagName).toBe('IMG')
    expect(image.hasAttribute('data-inherited-canary')).toBe(false)
    expect(image.hasAttribute('src')).toBe(false)
    expect(image.hasAttribute('onerror')).toBe(false)
    expect(image.getAttributeNames().some((name) => /^on/i.test(name))).toBe(false)
  })

  it('preserves legitimate class, style, and image attributes', () => {
    const attributes = core.mergeAttributes(
      { class: 'one two', style: 'color: red; font-size: 12px', title: 'Before' },
      { class: 'two three', style: 'color: blue', title: 'After', src: 'https://example.invalid/image.png', alt: 'Example' },
    )
    const image = renderImage(attributes)
    expect(image.className).toBe('one two three')
    expect(image.style.color).toBe('blue')
    expect(image.style.fontSize).toBe('12px')
    expect(image.title).toBe('After')
    expect(image.getAttribute('src')).toBe('https://example.invalid/image.png')
    expect(image.alt).toBe('Example')
  })
})
