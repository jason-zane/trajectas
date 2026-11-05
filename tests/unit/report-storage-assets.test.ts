import { describe, expect, it } from 'vitest'
import { resolveReportStorageAssets } from '@/lib/reports/storage-assets'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'
import type { ResolvedBlockData } from '@/lib/reports/types'

const source = 'https://rwpfwfcaxoevnvtkdmkx.supabase.co'
const destination = 'https://sydney-fixture.supabase.co'
const asset = '/storage/v1/object/public/brand-assets/client/logo%20dark.svg?v=2#logo'

function snapshot(url = source + asset): ResolvedBlockData[] {
  return [{
    blockId: 'synthetic-report', type: 'custom', order: 0,
    data: { slug: '5brains', payload: { secondaryLogoUrl: url, score: 67, content: url } },
    resolvedBrandTheme: { ...DEFAULT_REPORT_THEME, secondaryLogoUrl: url },
  }]
}

function freeze(value: unknown): void {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
}

describe('historical report storage assets', () => {
  it('renders copied logos from the active project while preserving frozen report content', () => {
    const blocks = snapshot()
    const original = JSON.stringify(blocks)
    freeze(blocks)

    const rendered = resolveReportStorageAssets(blocks, destination)

    expect(rendered[0].data.payload).toEqual({
      secondaryLogoUrl: destination + asset, score: 67, content: source + asset,
    })
    expect(rendered[0].resolvedBrandTheme?.secondaryLogoUrl).toBe(destination + asset)
    expect(JSON.stringify(blocks)).toBe(original)
  })

  it('also resolves standard report cover logos and transformed public images', () => {
    const path = '/storage/v1/render/image/public/brand-assets/logo.png?width=200'
    const blocks: ResolvedBlockData[] = [{
      blockId: 'cover', type: 'cover_page', order: 0,
      data: { primaryLogoUrl: source + path, secondaryLogoUrl: source + asset },
    }]
    expect(resolveReportStorageAssets(blocks, destination)[0].data).toEqual({
      primaryLogoUrl: destination + path, secondaryLogoUrl: destination + asset,
    })
  })

  it.each([
    undefined, '', 'invalid', source, destination + '/auth/v1',
    'http://remote.example', 'https://user:password@sydney-fixture.supabase.co',
    destination + '?token=synthetic', destination + '#fragment',
  ])('leaves snapshots unchanged when the active project is absent, unchanged or invalid: %s', (target) => {
    const blocks = snapshot()
    expect(resolveReportStorageAssets(blocks, target)).toBe(blocks)
  })

  it.each([
    'https://another-project.supabase.co' + asset,
    'https://rwpfwfcaxoevnvtkdmkx.supabase.co.attacker.example' + asset,
    'https://user@rwpfwfcaxoevnvtkdmkx.supabase.co' + asset,
    'http://rwpfwfcaxoevnvtkdmkx.supabase.co' + asset,
    source + '/storage/v1/object/sign/brand-assets/logo.png?token=synthetic',
    source + '/storage/v1/object/public/reports/report.pdf',
    source + '/storage/v1/object/public/brand-assets/',
    '/relative/logo.svg', 'data:image/png;base64,synthetic',
  ])('preserves URLs outside the historical public branding boundary: %s', (url) => {
    const blocks = snapshot(url)
    expect(resolveReportStorageAssets(blocks, destination)).toBe(blocks)
  })

  it('supports isolated local rehearsal without changing unrelated blocks', () => {
    const blocks = snapshot()
    const untouched: ResolvedBlockData = { blockId: 'text', type: 'custom_text', order: 1, data: { content: 'Preserved' } }
    blocks.push(untouched)
    const rendered = resolveReportStorageAssets(blocks, 'http://127.0.0.1:56551')
    expect(rendered[0].resolvedBrandTheme?.secondaryLogoUrl).toBe('http://127.0.0.1:56551' + asset)
    expect(rendered[1]).toBe(untouched)
  })
})
