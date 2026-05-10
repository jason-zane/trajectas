import { describe, expect, it } from 'vitest'

import {
  detectBrandAssetMimeType,
  validateBrandAssetFile,
} from '@/lib/brand-assets/file-validation'

describe('brand asset validation', () => {
  it('detects PNG and JPEG signatures', () => {
    expect(
      detectBrandAssetMimeType(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
      )
    ).toBe('image/png')
    expect(detectBrandAssetMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg'
    )
  })

  it('rejects files whose bytes do not match the declared type', async () => {
    const file = new File(['<svg onload=alert(1)>'], 'logo.png', {
      type: 'image/png',
    })

    await expect(validateBrandAssetFile(file)).resolves.toEqual({
      error: 'File contents must match the declared PNG or JPEG type',
    })
  })

  it('canonicalizes valid JPEG uploads to jpg extension', async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00])], 'logo.jpeg', {
      type: 'image/jpeg',
    })

    await expect(validateBrandAssetFile(file)).resolves.toEqual({
      mimeType: 'image/jpeg',
      extension: 'jpg',
    })
  })
})
