export const BRAND_ASSET_MAX_FILE_SIZE = 2 * 1024 * 1024

export type BrandAssetMimeType = 'image/png' | 'image/jpeg'

const MIME_EXTENSIONS: Record<BrandAssetMimeType, 'png' | 'jpg'> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function isBrandAssetMimeType(value: string): value is BrandAssetMimeType {
  return value === 'image/png' || value === 'image/jpeg'
}

export function getBrandAssetExtension(mimeType: BrandAssetMimeType) {
  return MIME_EXTENSIONS[mimeType]
}

export function detectBrandAssetMimeType(bytes: Uint8Array): BrandAssetMimeType | null {
  if (
    bytes.length >= PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
  ) {
    return 'image/png'
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  return null
}

export async function validateBrandAssetFile(file: File) {
  if (!isBrandAssetMimeType(file.type)) {
    return { error: 'File must be PNG or JPEG' } as const
  }

  if (file.size <= 0) {
    return { error: 'File must not be empty' } as const
  }

  if (file.size > BRAND_ASSET_MAX_FILE_SIZE) {
    return { error: 'File must be under 2MB' } as const
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const detectedMimeType = detectBrandAssetMimeType(header)

  if (!detectedMimeType || detectedMimeType !== file.type) {
    return { error: 'File contents must match the declared PNG or JPEG type' } as const
  }

  return {
    mimeType: detectedMimeType,
    extension: getBrandAssetExtension(detectedMimeType),
  } as const
}
