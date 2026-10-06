/** Outstanding invitations remain unaccepted and unrevoked after expiry. */
export const OUTSTANDING_INVITE_LIMIT = 1000
export const PENDING_INVITE_ERROR = 'An invite is already pending for this email address'
export const EXISTING_INVITE_ERROR = 'An active invite already exists for this person with this role. Resend it or revoke it before sending a new one.'

export type InviteStatus = 'pending' | 'expired' | 'accepted' | 'revoked'

export function getInviteStatus(
  invite: { expiresAt: string; acceptedAt?: string | null; revokedAt?: string | null },
  now = Date.now(),
): InviteStatus {
  if (invite.revokedAt) return 'revoked'
  if (invite.acceptedAt) return 'accepted'
  return new Date(invite.expiresAt).getTime() <= now ? 'expired' : 'pending'
}
