import { describe, expect, it } from 'vitest'
import { detectBrandAssetMimeType } from '@/lib/brand-assets/file-validation'

describe('brand asset magic byte validation', () => {
  it('detects valid PNG files by magic bytes', () => {
    // PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00])
    expect(detectBrandAssetMimeType(pngBytes)).toBe('image/png')
  })

  it('detects valid JPEG files by magic bytes', () => {
    // JPEG magic bytes: 0xFF 0xD8 0xFF
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
    expect(detectBrandAssetMimeType(jpegBytes)).toBe('image/jpeg')
  })

  it('rejects HTML/script payloads even if named as PNG', () => {
    // HTML magic bytes: 0x3C 0x21 (< and !)
    const htmlBytes = new Uint8Array([0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45, 0x20, 0x68, 0x74])
    expect(detectBrandAssetMimeType(htmlBytes)).toBeNull()
  })

  it('rejects files with mismatched type and content (PNG bytes with JPEG extension)', () => {
    // PNG magic bytes sent as if it were JPEG
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00])
    const detected = detectBrandAssetMimeType(pngBytes)
    expect(detected).toBe('image/png')
    // If client claimed it was JPEG, it would not match
    expect(detected).not.toBe('image/jpeg')
  })

  it('rejects JPEG bytes sent as PNG', () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
    const detected = detectBrandAssetMimeType(jpegBytes)
    expect(detected).toBe('image/jpeg')
    // If client claimed it was PNG, it would not match
    expect(detected).not.toBe('image/png')
  })

  it('returns null for empty or unknown file signatures', () => {
    const emptyBytes = new Uint8Array([])
    expect(detectBrandAssetMimeType(emptyBytes)).toBeNull()

    const unknownBytes = new Uint8Array([0x00, 0x00, 0x00, 0x00])
    expect(detectBrandAssetMimeType(unknownBytes)).toBeNull()

    const textBytes = new Uint8Array([0x54, 0x65, 0x78, 0x74])
    expect(detectBrandAssetMimeType(textBytes)).toBeNull()
  })
})
