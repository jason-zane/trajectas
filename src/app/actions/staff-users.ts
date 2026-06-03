'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdminScope } from '@/lib/auth/authorization'
import {
  createStaffInvite,
  reissueInviteLink,
  revokeInvite,
  revokeMembership,
  setProfileActiveState,
} from '@/lib/auth/staff-auth'
import { sendStaffInviteEmail } from '@/lib/auth/staff-invite-email'

type InviteFormState =
  | {
      success?: string
      error?: string
      fields?: Record<string, string[]>
      inviteLink?: string
      /** Set when the invite collided with an existing active invite. */
      duplicate?: { inviteId: string }
    }
  | undefined

export async function createStaffInviteAction(
  _state: InviteFormState,
  formData: FormData
): Promise<InviteFormState> {
  const scope = await requireAdminScope()
  const result = await createStaffInvite({
    email: String(formData.get('email') ?? ''),
    tenantType: String(formData.get('tenantType') ?? 'platform') as
      | 'platform'
      | 'partner'
      | 'client',
    tenantId: String(formData.get('tenantId') ?? '') || undefined,
    role: String(formData.get('role') ?? 'platform_admin') as
      | 'platform_admin'
      | 'partner_admin'
      | 'partner_member'
      | 'client_admin'
      | 'client_member',
    invitedByProfileId: scope.actor?.id ?? '',
  })

  if ('error' in result) {
    return {
      fields: result.error,
      error: result.error._form?.[0],
      duplicate: result.duplicate,
    }
  }

  const { inviteLink } = await sendStaffInviteEmail({
    email: result.data.email,
    inviteToken: result.inviteToken,
    tenantType: result.data.tenantType,
    tenantId: result.data.tenantId,
  })

  revalidatePath('/users')

  return {
    success: `Invite email sent to ${result.data.email}.`,
    inviteLink,
  }
}

const inviteActionSchema = z.object({
  inviteId: z.uuid(),
})

export async function revokeInviteAction(formData: FormData) {
  const scope = await requireAdminScope()
  const parsed = inviteActionSchema.safeParse({
    inviteId: formData.get('inviteId'),
  })

  if (!parsed.success) {
    return
  }

  await revokeInvite(parsed.data.inviteId, scope.actor?.id ?? '')
  revalidatePath('/users')
}

export async function revokeInviteById(inviteId: string) {
  try {
    const scope = await requireAdminScope()
    const parsedInviteId = inviteActionSchema.parse({ inviteId })

    await revokeInvite(parsedInviteId.inviteId, scope.actor?.id ?? '')
    revalidatePath('/users')
    revalidatePath(`/users/invite/${parsedInviteId.inviteId}`)

    return { success: true as const }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to revoke invite.',
    }
  }
}

/**
 * Mint a fresh shareable accept link for an existing pending invite (any
 * scope), for the "copy the link and send it myself" flow. Rotates the token,
 * so any previously sent link for this invite stops working. Does not email.
 */
export async function reissueInviteLinkById(
  inviteId: string
): Promise<{ inviteLink: string } | { error: string }> {
  try {
    const scope = await requireAdminScope()
    const { inviteId: parsedInviteId } = inviteActionSchema.parse({ inviteId })

    const result = await reissueInviteLink(parsedInviteId, scope.actor?.id ?? null)
    if ('error' in result) return result

    revalidatePath('/users')
    revalidatePath(`/users/invite/${parsedInviteId}`)
    return result
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to re-issue invite link.',
    }
  }
}

const membershipActionSchema = z.object({
  membershipId: z.uuid(),
  membershipType: z.enum(['partner', 'client']),
})

export async function revokeMembershipAction(formData: FormData) {
  const scope = await requireAdminScope()
  const parsed = membershipActionSchema.safeParse({
    membershipId: formData.get('membershipId'),
    membershipType: formData.get('membershipType'),
  })

  if (!parsed.success) {
    return
  }

  await revokeMembership({
    membershipId: parsed.data.membershipId,
    membershipType: parsed.data.membershipType,
    actorProfileId: scope.actor?.id ?? '',
  })
  revalidatePath('/users')
}

export async function revokeMembershipById(
  membershipId: string,
  membershipType: 'partner' | 'client',
  profileId: string
) {
  try {
    const scope = await requireAdminScope()
    const parsed = membershipActionSchema.parse({
      membershipId,
      membershipType,
    })

    await revokeMembership({
      membershipId: parsed.membershipId,
      membershipType: parsed.membershipType,
      actorProfileId: scope.actor?.id ?? '',
    })
    revalidatePath('/users')
    revalidatePath(`/users/${profileId}`)

    return { success: true as const }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Failed to revoke membership.',
    }
  }
}

const activeStateSchema = z.object({
  profileId: z.uuid(),
  isActive: z.enum(['true', 'false']),
})

export async function setStaffUserActiveStateAction(formData: FormData) {
  const scope = await requireAdminScope()
  const parsed = activeStateSchema.safeParse({
    profileId: formData.get('profileId'),
    isActive: formData.get('isActive'),
  })

  if (!parsed.success) {
    return
  }

  await setProfileActiveState({
    profileId: parsed.data.profileId,
    isActive: parsed.data.isActive === 'true',
    actorProfileId: scope.actor?.id ?? '',
  })
  revalidatePath('/users')
}

export async function toggleUserActiveState(profileId: string, isActive: boolean) {
  try {
    const scope = await requireAdminScope()
    const parsed = activeStateSchema.parse({
      profileId,
      isActive: String(isActive),
    })

    await setProfileActiveState({
      profileId: parsed.profileId,
      isActive: parsed.isActive === 'true',
      actorProfileId: scope.actor?.id ?? '',
    })
    revalidatePath('/users')
    revalidatePath(`/users/${parsed.profileId}`)

    return { success: true as const }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update user active state.',
    }
  }
}
