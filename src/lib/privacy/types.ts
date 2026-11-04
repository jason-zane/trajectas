import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

export const objectReferenceSchema = z.object({
  bucket: z.enum(['reports', 'outcome-sources']),
  path: z.string().min(1).max(2048),
})
export const deletionManifestSchema = z.object({
  version: z.literal(1),
  participantIds: z.array(postgresUuid()),
  sessionIds: z.array(postgresUuid()),
  snapshotIds: z.array(postgresUuid()),
  objects: z.array(objectReferenceSchema),
  blockers: z.array(z.object({ kind: z.string(), id: postgresUuid() })),
  counts: z.record(z.string(), z.number().int().nonnegative()),
})
export type DeletionManifest = z.infer<typeof deletionManifestSchema>
export type ObjectReference = z.infer<typeof objectReferenceSchema>

export function safeObjectPath(path: string): boolean {
  return !path.startsWith('/') && !path.includes('\\') && !/[\u0000-\u001f]/.test(path)
    && !path.includes('://') && path.split('/').every(part => part !== '..' && part !== '.' && part !== '')
}

export function dataLifecycleMode(): 'plan' | 'execute' {
  return process.env.DATA_LIFECYCLE_MODE === 'execute' ? 'execute' : 'plan'
}
