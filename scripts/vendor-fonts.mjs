#!/usr/bin/env node
/**
 * Re-vendor the self-hosted webfonts in `src/app/fonts/`.
 *
 * Why this exists
 * ---------------
 * We used to load these three families with `next/font/google`, which fetches
 * the CSS from fonts.googleapis.com and the .woff2 files from fonts.gstatic.com
 * at build time. The gstatic edge intermittently 404s the exact hashed URLs CI
 * asks for, Turbopack then fails to resolve the font module, and the dev server
 * never boots — taking the `quality` and `e2e-smoke` jobs down with it.
 *
 * So the .woff2 files live in the repo and the layouts use `next/font/local`.
 * Builds never touch the network. This script is the (manual, occasional) way
 * to refresh them.
 *
 * What it does
 * ------------
 * Replays the *exact* Google Fonts requests the old `next/font/google` calls
 * made — same URL construction, same browser User-Agent (so we get .woff2),
 * via Next's own bundled helpers — keeps the `latin` and `latin-ext` subset
 * faces, and writes the unique files to `src/app/fonts/`.
 *
 * Google serves a single variable .woff2 per (family, subset, style) and pins
 * each requested weight with a `font-weight` descriptor, so the whole set
 * collapses to eight files. The `src` arrays in the layouts mirror the
 * @font-face blocks Google emitted, one entry per weight.
 *
 * Subsets: see SUBSETS below, and the block comment in `src/app/layout.tsx`
 * for which subsets are deliberately NOT vendored and what each would cost.
 *
 * Run with:  node scripts/vendor-fonts.mjs
 *
 * It also prints the `unicode-range` Google declares for each subset. Those
 * strings are copied verbatim into the `declarations` of every localFont call
 * — they are load-bearing, not decoration: latin and latin-ext faces share a
 * font-family, so without a range they have identical matching descriptors
 * and the later @font-face silently shadows the earlier one. If a printed
 * range no longer matches the source, update the source.
 *
 * If the expected-files check below fails, Google has changed what it serves.
 * Do not "fix" it by loosening the check — read the diff it prints and update
 * both this script and the `src` arrays in:
 *   src/app/layout.tsx
 *   src/app/(marketing)/layout.tsx
 *   src/app/(marketing)/page.tsx
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const GOOGLE = 'next/dist/compiled/@next/font/dist/google'
const { getFontAxes } = require(`${GOOGLE}/get-font-axes.js`)
const { getGoogleFontsUrl } = require(`${GOOGLE}/get-google-fonts-url.js`)
const { fetchResource } = require(`${GOOGLE}/fetch-resource.js`)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'src/app/fonts')

/**
 * Vendored subsets. `latin-ext` is not optional decoration: this is a hiring
 * platform and candidate/client names are largely European, so Wałęsa,
 * Ștefan, Kovačević and Krišjānis must not render half in the real face and
 * half in metric-adjusted Arial. See src/app/layout.tsx for the subsets we
 * deliberately drop and their byte cost.
 */
const SUBSETS = ['latin', 'latin-ext']

/** The `next/font/google` calls this replaces, one per call site. */
const CALLS = [
  { site: 'src/app/layout.tsx --font-sans', family: 'Plus Jakarta Sans', weights: ['variable'], styles: ['normal'] },
  { site: 'src/app/layout.tsx --font-mono', family: 'Geist Mono', weights: ['variable'], styles: ['normal'] },
  { site: 'src/app/layout.tsx --font-serif', family: 'Source Serif 4', weights: ['400', '600'], styles: ['normal', 'italic'] },
  { site: 'src/app/(marketing)/layout.tsx --font-display', family: 'Plus Jakarta Sans', weights: ['400', '500', '600', '700', '800'], styles: ['normal'] },
  { site: 'src/app/(marketing)/layout.tsx --font-mono', family: 'Geist Mono', weights: ['300', '400', '500'], styles: ['normal'] },
  { site: 'src/app/(marketing)/page.tsx --font-serif', family: 'Source Serif 4', weights: ['400', '500', '600'], styles: ['normal', 'italic'] },
]

/** Output filename, keyed by `family|subset|style`. */
const FILENAMES = {
  'Plus Jakarta Sans|latin|normal': 'plus-jakarta-sans-latin-variable.woff2',
  'Plus Jakarta Sans|latin-ext|normal': 'plus-jakarta-sans-latin-ext-variable.woff2',
  'Geist Mono|latin|normal': 'geist-mono-latin-variable.woff2',
  'Geist Mono|latin-ext|normal': 'geist-mono-latin-ext-variable.woff2',
  'Source Serif 4|latin|normal': 'source-serif-4-latin-variable.woff2',
  'Source Serif 4|latin|italic': 'source-serif-4-latin-variable-italic.woff2',
  'Source Serif 4|latin-ext|normal': 'source-serif-4-latin-ext-variable.woff2',
  'Source Serif 4|latin-ext|italic': 'source-serif-4-latin-ext-variable-italic.woff2',
}

/** Split a Google Fonts CSS response into `{ subset, props }` records. */
function parseFaces(css) {
  const faces = []
  let subset = ''
  let current = null
  for (const rawLine of css.split('\n')) {
    const line = rawLine.trim()
    const comment = /^\/\* (.+?) \*\/$/.exec(line)
    if (comment) {
      subset = comment[1]
      continue
    }
    if (line === '@font-face {') {
      current = { subset, props: {} }
      continue
    }
    if (!current) continue
    if (line === '}') {
      faces.push(current)
      current = null
      continue
    }
    const prop = /^([a-z-]+):\s*(.*);$/.exec(line)
    if (prop) current.props[prop[1]] = prop[2]
  }
  return faces
}

async function main() {
  /** filename -> { url, range, faces: string[] } */
  const wanted = new Map()
  /** `family|subset` -> unicode-range, for the printout at the end. */
  const ranges = new Map()

  for (const { site, family, weights, styles } of CALLS) {
    const axes = getFontAxes(family, weights, styles, undefined)
    const url = getGoogleFontsUrl(family, axes, 'swap')
    const css = (await fetchResource(url, false)).toString('utf8').split('body {', 1)[0]

    const kept = parseFaces(css).filter((f) => SUBSETS.includes(f.subset))
    for (const subset of SUBSETS) {
      if (!kept.some((f) => f.subset === subset)) {
        throw new Error(`No \`${subset}\` faces for ${family} (${url})`)
      }
    }

    for (const face of kept) {
      const style = face.props['font-style'] ?? 'normal'
      const weight = face.props['font-weight']
      const range = face.props['unicode-range']
      const fileUrl = /url\((.+?)\)/.exec(face.props.src)?.[1]
      if (!fileUrl) throw new Error(`No src url in @font-face for ${family} (${url})`)
      if (!range) throw new Error(`No unicode-range for ${family} ${face.subset} (${url})`)

      const filename = FILENAMES[`${family}|${face.subset}|${style}`]
      if (!filename) {
        throw new Error(`Unexpected face ${family} ${face.subset} ${style} — update FILENAMES`)
      }

      const rangeKey = `${family}|${face.subset}`
      const knownRange = ranges.get(rangeKey)
      if (knownRange && knownRange !== range) {
        throw new Error(`${rangeKey}: inconsistent unicode-range (${knownRange} vs ${range})`)
      }
      ranges.set(rangeKey, range)

      const existing = wanted.get(filename)
      if (existing && existing.url !== fileUrl) {
        throw new Error(
          `${filename}: Google now serves more than one file for ${family} ${face.subset} ` +
            `${style} (${existing.url} vs ${fileUrl}). ` +
            `The layouts assume one variable file per subset per style.`
        )
      }
      wanted.set(filename, {
        url: fileUrl,
        range,
        faces: [...(existing?.faces ?? []), `${site} — ${style} ${weight}`],
      })
    }
  }

  const unexpected = [...wanted.keys()].filter((f) => !Object.values(FILENAMES).includes(f))
  const missing = Object.values(FILENAMES).filter((f) => !wanted.has(f))
  if (unexpected.length || missing.length) {
    throw new Error(`Expected file set changed. Unexpected: ${unexpected}. Missing: ${missing}.`)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  let total = 0
  for (const [filename, { url, faces }] of [...wanted].sort()) {
    const buffer = await fetchResource(url, false)
    if (buffer.subarray(0, 4).toString('latin1') !== 'wOF2') {
      throw new Error(`${url} did not return a woff2 file`)
    }
    fs.writeFileSync(path.join(OUT_DIR, filename), buffer)
    total += buffer.length
    console.log(`${filename}  ${buffer.length} bytes  <- ${url}`)
    for (const face of faces) console.log(`    ${face}`)
  }
  console.log(`\n${wanted.size} files, ${total} bytes total, written to src/app/fonts/`)

  console.log('\nunicode-range values — these must match the `declarations` in the layouts:')
  for (const [key, range] of [...ranges].sort()) console.log(`  ${key}\n    ${range}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
