'use server'

import { z } from 'zod'
import { getParticipantQualityModule, saveParticipantQualityAnswer, recordResponseQualityReview } from '@/lib/dal/response-quality'
import { logActionError } from '@/lib/security/action-errors'
import { QUALITY_QUESTIONS, type QualityModuleForRunner } from '@/lib/instrument/ipip-neo-120/response-quality'

const participantInput = z.object({ token: z.string().min(1).max(2048), sessionId: z.uuid() })

export async function getQualitySupplement(token: string, sessionId: string): Promise<{ module: QualityModuleForRunner | null } | { error: string }> {
  const parsed = participantInput.safeParse({ token, sessionId })
  if (!parsed.success) return { error: 'Invalid access' } as const
  try { return { module: await getParticipantQualityModule(token, sessionId) } }
  catch (error) { logActionError('responseQuality.load', error); return { error: 'Unable to load the final statements. Please refresh or reopen your assessment link.' } as const }
}

export async function saveQualitySupplementAnswer(input: { token: string; sessionId: string; questionId: string; value: number; revision: number }): Promise<{ saved: { answers: Record<string, number>; revision: number } } | { error: string }> {
  const parsed = participantInput.extend({ questionId: z.string().refine(id => QUALITY_QUESTIONS.some(q => q.id === id)), value: z.number().int().min(1).max(5), revision: z.number().int().min(0).max(100000) }).safeParse(input)
  if (!parsed.success) return { error: 'Invalid response' } as const
  try { return { saved: await saveParticipantQualityAnswer(parsed.data) } }
  catch (error) { logActionError('responseQuality.save', error); return { error: error instanceof Error ? error.message : 'Unable to save your answer' } as const }
}

export async function reviewResponseQuality(input: { sessionId: string; resultId: string; reviewId: string; decision: 'accepted' | 'follow_up' | 'reassessment'; notes: string }): Promise<{ success: true } | { error: string }> {
  const parsed = z.object({ sessionId: z.uuid(), resultId: z.uuid(), reviewId: z.uuid(), decision: z.enum(['accepted','follow_up','reassessment']), notes: z.string().trim().min(10).max(2000) }).safeParse(input)
  if (!parsed.success) return { error: 'Choose a decision and enter a review note of 10–2,000 characters.' } as const
  try { await recordResponseQualityReview(parsed.data); return { success: true } as const }
  catch (error) { logActionError('responseQuality.review', error); return { error: 'Unable to save this review. Check your access and try again.' } as const }
}
