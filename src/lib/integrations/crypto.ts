import crypto from 'crypto'

import { IntegrationApiError } from '@/lib/integrations/errors'

function loadCipherKey(): Buffer {
  const value = process.env.INTEGRATIONS_CONFIG_ENCRYPTION_KEY
  if (!value) {
    throw new IntegrationApiError(
      500,
      'integration_encryption_not_configured',
      'Integration encryption is not configured.'
    )
  }

  const trimmed = value.trim()
  const hexPattern = /^[0-9a-fA-F]{64}$/
  const base64Pattern = /^[A-Za-z0-9+/=]+$/

  if (hexPattern.test(trimmed)) {
    return Buffer.from(trimmed, 'hex')
  }

  if (base64Pattern.test(trimmed)) {
    const buffer = Buffer.from(trimmed, 'base64')
    if (buffer.length === 32) {
      return buffer
    }
  }

  throw new IntegrationApiError(
    500,
    'integration_encryption_invalid',
    'Integration encryption configuration is invalid.'
  )
}

export function encryptIntegrationSecret(secret: string): string {
  const key = loadCipherKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

export function decryptIntegrationSecret(ciphertext: string): string {
  const key = loadCipherKey()
  const [ivPart, tagPart, dataPart] = ciphertext.split('.')
  if (!ivPart || !tagPart || !dataPart) {
    throw new IntegrationApiError(
      500,
      'integration_secret_invalid',
      'Stored integration secret is invalid.'
    )
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivPart, 'base64url')
  )
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
