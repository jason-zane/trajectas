'use server'
import { ZodError } from 'zod'
import { revalidatePath, updateTag } from 'next/cache'
import * as privacy from '@/lib/dal/privacy'
import { AuthorizationError, AuthenticationRequiredError } from '@/lib/auth/authorization'

async function run<T>(work: () => Promise<T>, refresh = true): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await work()
    if (refresh) { revalidatePath('/settings/privacy'); revalidatePath('/privacy'); updateTag('experience');updateTag('public-privacy') }
    return { ok: true, data }
  } catch (error) {
    if (error instanceof privacy.PrivacyAdminError) return { ok: false, error: error.message }
    if (error instanceof AuthorizationError || error instanceof AuthenticationRequiredError) return { ok: false, error: 'An authorised platform administrator is required.' }
    if (error instanceof ZodError) return { ok: false, error: 'Review the required fields and their permitted values.' }
    return { ok: false, error: 'The privacy operation is unavailable. Retry or review the operation before continuing.' }
  }
}
export async function findPrivacyParticipantsAction(email: string) { return run(() => privacy.findPrivacyParticipants(email), false) }
export async function previewParticipantDeletionAction(id: string) { return run(() => privacy.previewParticipantDeletion(id), false) }
export async function requestParticipantDeletionAction(input: Parameters<typeof privacy.requestParticipantDeletion>[0]) { return run(() => privacy.requestParticipantDeletion(input)) }
export async function approveParticipantDeletionAction(id: string, confirmation: string) { return run(() => privacy.approveParticipantDeletion(id,confirmation)) }
export async function confirmDeletionProviderTaskAction(input: Parameters<typeof privacy.confirmDeletionProviderTask>[0]) { return run(() => privacy.confirmDeletionProviderTask(input)) }
export async function createRetentionPolicyDraftAction(input: unknown) { return run(() => privacy.createRetentionPolicyDraft(input)) }
export async function updateRetentionPolicyDraftAction(id:string,input:unknown) {return run(()=>privacy.updateRetentionPolicyDraft(id,input))}
export async function activateRetentionPolicyAction(id: string, confirmation: string) { return run(() => privacy.activateRetentionPolicy(id,confirmation)) }
export async function createPrivacyNoticeDraftAction(input: unknown) { return run(() => privacy.createPrivacyNoticeDraft(input)) }
export async function updatePrivacyNoticeDraftAction(id: string,input: unknown) { return run(() => privacy.updatePrivacyNoticeDraft(id,input)) }
export async function publishPrivacyNoticeAction(id: string,hash: string,confirmation: string) { return run(() => privacy.publishPrivacyNotice(id,hash,confirmation)) }
export async function setCampaignPrivacyAction(input: unknown) { return run(() => privacy.setCampaignPrivacy(input)) }
export async function createPrivacyHoldAction(input: unknown) { return run(() => privacy.createPrivacyHold(input)) }
export async function releasePrivacyHoldAction(id: string,confirmation: string) { return run(() => privacy.releasePrivacyHold(id,confirmation)) }
export async function getParticipantResearchSessionsAction(id: string) { return run(() => privacy.getParticipantResearchSessions(id), false) }
export async function extractRestrictedResearchCaseAction(input: Parameters<typeof privacy.extractRestrictedResearchCase>[0]) { return run(() => privacy.extractRestrictedResearchCase(input)) }
export async function publishReviewedNormAction(input: Parameters<typeof privacy.publishReviewedNorm>[0]) { return run(() => privacy.publishReviewedNorm(input)) }
export async function restrictParticipantResearchAction(id:string) {return run(()=>privacy.restrictParticipantResearch(id))}
