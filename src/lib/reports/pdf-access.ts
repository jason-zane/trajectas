import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { postgresUuid } from '@/lib/validations/uuid'

/**
 * Internal report-PDF storage access. These helpers bypass RLS via the admin
 * client and perform NO authorization of their own, so they must never be
 * exported from a `'use server'` module — callers are responsible for either
 * having already authorized the snapshot (server actions) or running in a
 * trusted system context (consultant-notification background path, which has
 * no user session). Enforced by tests/architecture/admin-actions-authz.test.ts.
 */

/**
 * pdf_url now stores a private storage path (e.g. "reports/<id>.pdf").
 * This helper generates a short-lived signed URL for download.
 * Returns undefined if no PDF has been generated yet.
 *
 * Only ever pass `pdf_url` values read from a `report_snapshots` row — never
 * caller-supplied input.
 */
export async function getSignedReportPdfUrl(
  storagePath: string | undefined | null,
  expiresInSeconds = 3600,
): Promise<string | undefined> {
  if (!storagePath) return undefined

  // If it's a legacy full URL (starts with http), return as-is for backwards compat
  if (storagePath.startsWith('http')) return storagePath

  const db = createAdminClient()
  const { data, error } = await db.storage
    .from('reports')
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    console.warn('[reports] Failed to create signed URL for', storagePath, error?.message)
    return undefined
  }

  return data.signedUrl
}

/**
 * Download a snapshot PDF as base64 ready to attach to an email.
 * Returns null when no PDF is available.
 */
export async function downloadSnapshotPdfBase64(
  snapshotId: string,
): Promise<{ filename: string; content: string } | null> {
  if (!postgresUuid().safeParse(snapshotId).success) return null
  const db = createAdminClient()
  const { data, error } = await db
    .from('report_snapshots')
    .select('pdf_url')
    .eq('id', snapshotId)
    .maybeSingle()
  if (error || !data?.pdf_url) return null
  const storagePath = String(data.pdf_url)
  if (storagePath.startsWith('http')) {
    try {
      const resp = await fetch(storagePath)
      if (!resp.ok) return null
      const buffer = Buffer.from(await resp.arrayBuffer())
      return { filename: `report-${snapshotId}.pdf`, content: buffer.toString('base64') }
    } catch {
      return null
    }
  }
  const download = await db.storage.from('reports').download(storagePath)
  if (download.error || !download.data) return null
  const buffer = Buffer.from(await download.data.arrayBuffer())
  return { filename: `report-${snapshotId}.pdf`, content: buffer.toString('base64') }
}
