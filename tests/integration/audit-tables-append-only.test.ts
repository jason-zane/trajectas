import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createAdminClient,
  createTestUser,
  canRun,
} from './_helpers/rls-fixture'

describe('Audit tables append-only enforcement', () => {
  describe.skipIf(!canRun)('audit_events', () => {
    let adminClient: ReturnType<typeof createAdminClient>
    let testUserId: string
    let userClient: ReturnType<typeof createAdminClient>

    beforeAll(async () => {
      adminClient = createAdminClient()
      const result = await createTestUser(adminClient, {
        email: `audit-test-${Date.now()}@example.com`,
        role: 'consultant',
      })
      testUserId = result.userId
      userClient = result.client
    })

    afterAll(async () => {
      if (testUserId) {
        await adminClient.auth.admin.deleteUser(testUserId)
      }
    })

    it('should allow INSERT via service_role', async () => {
      const { data, error } = await adminClient.from('audit_events').insert({
        actor_profile_id: testUserId,
        event_type: 'test_event',
        target_table: 'test_table',
        target_id: null,
        metadata: {},
      })
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('should reject UPDATE from authenticated user', async () => {
      // First insert a row as service_role
      const insertResult = await adminClient
        .from('audit_events')
        .insert({
          actor_profile_id: testUserId,
          event_type: 'test_update_attempt',
          metadata: {},
        })
        .select('id')
        .single()
      expect(insertResult.error).toBeNull()
      const insertedId = insertResult.data?.id

      // Now try to update it as authenticated user
      const { error: updateError } = await userClient
        .from('audit_events')
        .update({ metadata: { tampered: true } })
        .eq('id', insertedId)

      // Should fail with permission error (RLS blocks it before trigger) or append-only trigger
      expect(updateError).not.toBeNull()
      expect(updateError?.message).toMatch(/append-only|mutation not allowed|permission denied/i)
    })

    it('should reject DELETE from authenticated user', async () => {
      // First insert a row as service_role
      const insertResult = await adminClient
        .from('audit_events')
        .insert({
          actor_profile_id: testUserId,
          event_type: 'test_delete_attempt',
          metadata: {},
        })
        .select('id')
        .single()
      expect(insertResult.error).toBeNull()
      const insertedId = insertResult.data?.id

      // Now try to delete it as authenticated user
      const { error: deleteError } = await userClient
        .from('audit_events')
        .delete()
        .eq('id', insertedId)

      // Should fail with permission error (RLS blocks it before trigger) or append-only trigger
      expect(deleteError).not.toBeNull()
      expect(deleteError?.message).toMatch(/append-only|mutation not allowed|permission denied/i)
    })
  })

  describe.skipIf(!canRun)('error_events', () => {
    let adminClient: ReturnType<typeof createAdminClient>
    let testUserId: string
    let userClient: ReturnType<typeof createAdminClient>

    beforeAll(async () => {
      adminClient = createAdminClient()
      const result = await createTestUser(adminClient, {
        email: `error-test-${Date.now()}@example.com`,
        role: 'consultant',
      })
      testUserId = result.userId
      userClient = result.client
    })

    afterAll(async () => {
      if (testUserId) {
        await adminClient.auth.admin.deleteUser(testUserId)
      }
    })

    it('should allow INSERT via service_role (reportError path)', async () => {
      const { data, error } = await adminClient.from('error_events').insert({
        severity: 'error',
        source: 'test_source',
        message: 'test error message',
        fingerprint: 'test_source:test error message',
        context: {},
      })
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('should reject UPDATE from authenticated user', async () => {
      // First insert a row as service_role
      const insertResult = await adminClient
        .from('error_events')
        .insert({
          severity: 'warning',
          source: 'test_update_attempt',
          message: 'test message',
          fingerprint: 'test_update_attempt:test message',
          context: {},
        })
        .select('id')
        .single()
      expect(insertResult.error).toBeNull()
      const insertedId = insertResult.data?.id

      // Try to update as authenticated user
      const { error: updateError } = await userClient
        .from('error_events')
        .update({ alerted: true })
        .eq('id', insertedId)

      // Should fail with permission error (RLS blocks it before trigger) or append-only trigger
      expect(updateError).not.toBeNull()
      expect(updateError?.message).toMatch(/append-only|mutation not allowed|permission denied/i)
    })

    it('should reject DELETE from authenticated user', async () => {
      // First insert a row as service_role
      const insertResult = await adminClient
        .from('error_events')
        .insert({
          severity: 'fatal',
          source: 'test_delete_attempt',
          message: 'test message',
          fingerprint: 'test_delete_attempt:test message',
          context: {},
        })
        .select('id')
        .single()
      expect(insertResult.error).toBeNull()
      const insertedId = insertResult.data?.id

      // Try to delete as authenticated user
      const { error: deleteError } = await userClient
        .from('error_events')
        .delete()
        .eq('id', insertedId)

      // Should fail with permission error (RLS blocks it before trigger) or append-only trigger
      expect(deleteError).not.toBeNull()
      expect(deleteError?.message).toMatch(/append-only|mutation not allowed|permission denied/i)
    })
  })

  describe.skipIf(!canRun)('account_deletion_audit', () => {
    let adminClient: ReturnType<typeof createAdminClient>
    let testUserId: string
    let userClient: ReturnType<typeof createAdminClient>

    beforeAll(async () => {
      adminClient = createAdminClient()
      const result = await createTestUser(adminClient, {
        email: `deletion-test-${Date.now()}@example.com`,
        role: 'consultant',
      })
      testUserId = result.userId
      userClient = result.client
    })

    afterAll(async () => {
      if (testUserId) {
        await adminClient.auth.admin.deleteUser(testUserId)
      }
    })

    it('should allow INSERT via service_role (cron path)', async () => {
      const { data, error } = await adminClient
        .from('account_deletion_audit')
        .insert({
          profile_id: testUserId,
          email: 'test@example.com',
          deletion_requested_at: new Date().toISOString(),
          reason: 'user_requested',
        })
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('should reject UPDATE from authenticated user', async () => {
      // First insert a row as service_role
      const insertResult = await adminClient
        .from('account_deletion_audit')
        .insert({
          profile_id: testUserId,
          email: 'test_update@example.com',
          deletion_requested_at: new Date().toISOString(),
          reason: 'user_requested',
        })
        .select('id')
        .single()
      expect(insertResult.error).toBeNull()
      const insertedId = insertResult.data?.id

      // Try to update as authenticated user
      const { error: updateError } = await userClient
        .from('account_deletion_audit')
        .update({ reason: 'modified' })
        .eq('id', insertedId)

      // Should fail with permission error (RLS blocks it before trigger) or append-only trigger
      expect(updateError).not.toBeNull()
      expect(updateError?.message).toMatch(/append-only|mutation not allowed|permission denied/i)
    })

    it('should reject DELETE from authenticated user', async () => {
      // First insert a row as service_role
      const insertResult = await adminClient
        .from('account_deletion_audit')
        .insert({
          profile_id: testUserId,
          email: 'test_delete@example.com',
          deletion_requested_at: new Date().toISOString(),
          reason: 'user_requested',
        })
        .select('id')
        .single()
      expect(insertResult.error).toBeNull()
      const insertedId = insertResult.data?.id

      // Try to delete as authenticated user
      const { error: deleteError } = await userClient
        .from('account_deletion_audit')
        .delete()
        .eq('id', insertedId)

      // Should fail with permission error (RLS blocks it before trigger) or append-only trigger
      expect(deleteError).not.toBeNull()
      expect(deleteError?.message).toMatch(/append-only|mutation not allowed|permission denied/i)
    })
  })
})
