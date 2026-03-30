import { z } from 'zod'

// Postgres accepts UUIDs that are structurally valid hex groups even when they
// do not encode an RFC version/variant. Some seeded reference rows use that
// broader shape, so UI validation needs to match the database rather than the
// stricter RFC-only `z.string().uuid()` helper.
const POSTGRES_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function postgresUuid(message = 'Invalid UUID') {
  return z.string().regex(POSTGRES_UUID_PATTERN, message)
}
