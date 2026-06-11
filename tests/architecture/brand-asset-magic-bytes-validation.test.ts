/**
 * Architectural guard: brand asset upload route must validate magic bytes, not just MIME type.
 *
 * The security fix (F-002 regression) requires that brand asset uploads validate
 * file contents against known magic byte signatures, preventing clients from uploading
 * malicious payloads (e.g., HTML, scripts) renamed as PNG/JPEG files.
 *
 * This test ensures the route imports and calls detectBrandAssetMimeType.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const UPLOAD_ROUTE = join(ROOT, 'src', 'app', 'api', 'brand-assets', 'upload', 'route.ts')

describe('brand asset upload route magic byte validation', () => {
  it('imports and uses detectBrandAssetMimeType to validate file contents', () => {
    const source = readFileSync(UPLOAD_ROUTE, 'utf8')

    // Check that the validator is imported
    expect(source).toMatch(/import.*detectBrandAssetMimeType.*from\s+['"]@\/lib\/brand-assets\/file-validation['"]/)

    // Check that it is called in the route
    expect(source).toMatch(/detectBrandAssetMimeType\s*\(/)

    // Check that the detected type is stored/used (not the client-supplied file.type)
    expect(source).toMatch(/contentType:\s*detectedMimeType/)

    // Ensure we're validating that bytes match declared type
    expect(source).toMatch(/file\.type\s+!==\s+detectedMimeType/)
  })
})
