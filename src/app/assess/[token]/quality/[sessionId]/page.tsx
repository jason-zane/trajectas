import { redirect } from 'next/navigation'
import { validateAccessToken } from '@/app/actions/assess'
import { getQualitySupplement } from '@/app/actions/response-quality'
import { getCachedEffectiveBrand } from '@/lib/dal/brand'
import { getCachedEffectiveExperience } from '@/app/actions/experience'
import { getPostSectionsUrl } from '@/lib/experience/flow-router'
import { QualitySupplementRunner } from '@/components/assess/quality-supplement-runner'
import { BrandedMessage } from '@/components/errors/branded-message'

export default async function QualitySupplementPage({ params }: { params: Promise<{ token: string; sessionId: string }> }) {
  const { token, sessionId } = await params
  const validation = await validateAccessToken(token)
  if (!validation.data) redirect('/assess/expired')
  const { sessions, assessments, campaign } = validation.data
  const session = sessions.find(s => s.id === sessionId)
  if (!session || session.status !== 'in_progress') redirect(`/assess/${token}`)
  const result = await getQualitySupplement(token, sessionId)
  if ('error' in result) return <BrandedMessage eyebrow="Assessment" title="Unable to load the final statements" description={result.error} />
  if (!result.module) redirect(`/assess/${token}/section/0`)
  const [brand, experience] = await Promise.all([getCachedEffectiveBrand(campaign.clientId, campaign.id), getCachedEffectiveExperience(campaign.id)])
  const assessmentIndex = assessments.findIndex(a => a.assessmentId === session.assessmentId)
  const nextUrl = assessmentIndex >= 0 && assessmentIndex + 1 < assessments.length
    ? `/assess/${token}/assessment-intro/${assessmentIndex + 1}` : getPostSectionsUrl(experience, token)
  return <QualitySupplementRunner token={token} sessionId={sessionId} module={result.module} nextUrl={nextUrl} brandName={brand.name} brandLogoUrl={brand.logoUrl} />
}
