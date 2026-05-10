import { describe, expect, it } from 'vitest'

import { getWebhookUrlSafetyError } from '@/lib/integrations/url-security'

describe('webhook URL safety', () => {
  it('allows public HTTPS webhook destinations', () => {
    expect(getWebhookUrlSafetyError('https://hooks.example.com/events')).toBeNull()
  })

  it('rejects embedded credentials and non-HTTPS public destinations', () => {
    expect(getWebhookUrlSafetyError('https://user:pass@hooks.example.com/events')).toBe(
      'Webhook URL must not include embedded credentials.'
    )
    expect(getWebhookUrlSafetyError('http://hooks.example.com/events')).toBe(
      'Webhook URL must use HTTPS.'
    )
  })

  it('rejects localhost, private network, and metadata destinations by default', () => {
    const blocked = [
      'https://localhost/events',
      'https://127.0.0.1/events',
      'https://10.1.2.3/events',
      'https://172.16.0.1/events',
      'https://192.168.1.10/events',
      'https://169.254.169.254/latest/meta-data',
      'https://metadata.google.internal/computeMetadata/v1',
      'https://[::1]/events',
      'https://[fd00::1]/events',
      'https://[fe80::1]/events',
    ]

    for (const url of blocked) {
      expect(getWebhookUrlSafetyError(url)).toBe(
        'Webhook URL must not target localhost, private network, or cloud metadata hosts.'
      )
    }
  })

  it('allows localhost only when local webhook URLs are explicitly enabled', () => {
    expect(
      getWebhookUrlSafetyError('http://localhost:3000/events', { allowLocalUrls: true })
    ).toBeNull()
    expect(
      getWebhookUrlSafetyError('https://127.0.0.1:3000/events', { allowLocalUrls: true })
    ).toBeNull()
    expect(
      getWebhookUrlSafetyError('http://192.168.1.10/events', { allowLocalUrls: true })
    ).toBe('Webhook URL must not target localhost, private network, or cloud metadata hosts.')
  })
})
