'use server'
import { revalidatePath } from 'next/cache'
import { releaseReviewedWebhookBacklog } from '@/lib/dal/webhook-backlog'
export async function releaseWebhookBacklogAction(clientId: string,ids: unknown): Promise<{ count:number }|{ error:string }> {
  try {
    const count = await releaseReviewedWebhookBacklog(clientId,ids)
    revalidatePath('/','layout')
    return {count}
  } catch (error) { return {error:error instanceof Error?error.message:'Unable to release saved webhook events.'} }
}
