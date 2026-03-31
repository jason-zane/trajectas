'use server'

import { cookies } from 'next/headers'
import type { TenantType } from '@/lib/auth/types'
import type { WorkspaceSurface } from '@/lib/surfaces'
import {
  ACTIVE_CONTEXT_COOKIE,
  PREVIEW_CONTEXT_COOKIE,
  encodeActiveContext,
  encodePreviewContext,
  getActiveContextCookieOptions,
  getPreviewContextCookieOptions,
} from '@/lib/auth/active-context'
import {
  assertAdminOnly,
  AuthorizationError,
  canAccessClient,
  canAccessPartner,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { logAuditEvent, startSupportSession } from '@/lib/auth/support-sessions'

type ContextTargetInput = {
  surface: WorkspaceSurface
  tenantType?: TenantType
  tenantId?: string
  membershipId?: string
}

export async function clearActiveWorkspaceContext() {
  const cookieStore = await cookies()
  cookieStore.delete(ACTIVE_CONTEXT_COOKIE)
  cookieStore.delete(PREVIEW_CONTEXT_COOKIE)
  return { success: true as const }
}

export async function setActiveWorkspaceContext(input: ContextTargetInput) {
  const scope = await resolveAuthorizedScope()
  const cookieStore = await cookies()
  const isPreviewSelection = scope.isLocalDevelopmentBypass && !scope.actor

  if (input.surface === 'admin' && !input.tenantType && !input.tenantId) {
    cookieStore.delete(ACTIVE_CONTEXT_COOKIE)
    cookieStore.delete(PREVIEW_CONTEXT_COOKIE)
    return { success: true as const, surface: 'admin' as const }
  }

  if (input.tenantType && !input.tenantId) {
    return { error: 'A tenant ID is required when setting tenant context.' }
  }

  if (input.tenantType === 'partner' && input.tenantId && !canAccessPartner(scope, input.tenantId)) {
    return { error: 'You do not have access to that partner context.' }
  }

  if (input.tenantType === 'client' && input.tenantId && !canAccessClient(scope, input.tenantId)) {
    return { error: 'You do not have access to that client context.' }
  }

  const nextContext = {
    surface: input.surface,
    tenantType: input.tenantType,
    tenantId: input.tenantId,
    membershipId: input.membershipId,
  }

  if (isPreviewSelection) {
    if (input.surface !== 'partner' && input.surface !== 'client') {
      return { error: 'Local preview is only available for partner and client portals.' }
    }

    const previewContext = {
      surface: input.surface,
      tenantType: input.tenantType,
      tenantId: input.tenantId,
      membershipId: input.membershipId,
    }

    cookieStore.delete(ACTIVE_CONTEXT_COOKIE)
    cookieStore.set(
      PREVIEW_CONTEXT_COOKIE,
      encodePreviewContext(previewContext),
      getPreviewContextCookieOptions()
    )
  } else {
    cookieStore.delete(PREVIEW_CONTEXT_COOKIE)
    cookieStore.set(
      ACTIVE_CONTEXT_COOKIE,
      encodeActiveContext(nextContext),
      getActiveContextCookieOptions()
    )
  }

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'workspace_context.updated',
    partnerId: input.tenantType === 'partner' ? input.tenantId ?? null : null,
    clientId: input.tenantType === 'client' ? input.tenantId ?? null : null,
    metadata: {
      surface: input.surface,
      tenantType: input.tenantType ?? null,
      membershipId: input.membershipId ?? null,
      isLocalDevelopmentBypass: scope.isLocalDevelopmentBypass,
    },
  })

  return {
    success: true as const,
    surface: input.surface,
    tenantType: input.tenantType ?? null,
    tenantId: input.tenantId ?? null,
  }
}

export async function startAuditedSupportLaunch(input: {
  targetSurface: 'partner' | 'client'
  targetTenantId: string
  reason: string
}) {
  const scope = await resolveAuthorizedScope()

  try {
    assertAdminOnly(scope)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!scope.actor) {
    return { error: 'An authenticated admin actor is required for support launch.' }
  }

  const supportSession = await startSupportSession({
    actorProfileId: scope.actor.id,
    targetSurface: input.targetSurface,
    targetTenantId: input.targetTenantId,
    reason: input.reason,
  })

  const cookieStore = await cookies()
  cookieStore.set(
    ACTIVE_CONTEXT_COOKIE,
    encodeActiveContext({
      surface: input.targetSurface,
      tenantType: input.targetSurface,
      tenantId: input.targetTenantId,
      supportSessionId: supportSession.id,
    }),
    getActiveContextCookieOptions()
  )
  cookieStore.delete(PREVIEW_CONTEXT_COOKIE)

  return {
    success: true as const,
    supportSessionId: supportSession.id,
    sessionKey: supportSession.sessionKey,
    targetSurface: input.targetSurface,
    targetTenantId: input.targetTenantId,
  }
}
