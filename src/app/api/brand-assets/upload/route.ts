import { NextRequest, NextResponse } from 'next/server'
import {
  assertAdminOnly,
  AuthenticationRequiredError,
  AuthorizationError,
  canManageClient,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg'])
const ALLOWED_OWNER_TYPES = new Set(['platform', 'partner', 'client', 'campaign'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Sanitise filename: lowercase, strip non-alphanumeric, truncate. */
function sanitiseFilename(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || 'png'
  const base = name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `${base || 'logo'}.${ext}`
}

export async function POST(request: NextRequest) {
  try {
    // Auth first — don't leak field requirements to unauthenticated callers
    const scope = await resolveAuthorizedScope()

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const ownerType = formData.get('ownerType') as string | null
    const ownerId = formData.get('ownerId') as string | null

    if (!file || !ownerType || !ownerId) {
      return NextResponse.json(
        { error: 'Missing required fields: file, ownerType, ownerId' },
        { status: 400 }
      )
    }

    if (!ALLOWED_OWNER_TYPES.has(ownerType)) {
      return NextResponse.json(
        { error: 'Invalid ownerType. Must be one of: platform, partner, client, campaign' },
        { status: 400 }
      )
    }

    if (!UUID_RE.test(ownerId)) {
      return NextResponse.json(
        { error: 'Invalid ownerId. Must be a valid UUID' },
        { status: 400 }
      )
    }

    // Contextual authorization — client admins can upload for their client
    if (ownerType === 'client') {
      if (!canManageClient(scope, ownerId)) {
        throw new AuthorizationError('Not authorized to manage this client')
      }
    } else {
      assertAdminOnly(scope)
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'File must be PNG or JPEG' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File must be under 2MB' },
        { status: 400 }
      )
    }

    const db = createAdminClient()
    const filename = sanitiseFilename(file.name)
    const storagePath = `${ownerType}/${ownerId}/${Date.now()}-${filename}`

    const { error: uploadError } = await db.storage
      .from('brand-assets')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Brand asset upload failed:', uploadError)
      return NextResponse.json(
        { error: 'Upload failed' },
        { status: 500 }
      )
    }

    const { data: urlData } = db.storage
      .from('brand-assets')
      .getPublicUrl(storagePath)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Brand asset upload error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
