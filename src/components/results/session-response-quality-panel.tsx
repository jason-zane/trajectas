import { getSessionResponseQuality } from '@/lib/dal/response-quality'
import { ResponseQualityDetailPanel } from './response-quality-detail'
import { EmptyState } from '@/components/empty-state'

export async function SessionResponseQualityPanel({ sessionId }: { sessionId: string }) {
  let detail;
  try {
    detail = await getSessionResponseQuality(sessionId)
  } catch {
    return <EmptyState title="Response quality unavailable" description="The checks could not be loaded for this attempt. No quality conclusion is available." />
  }
  return <ResponseQualityDetailPanel sessionId={sessionId} detail={detail} />
}
