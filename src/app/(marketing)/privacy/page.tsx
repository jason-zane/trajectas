import { notFound } from 'next/navigation'
import { getPublishedWebsitePrivacy } from '@/lib/dal/public-privacy'
import { PublicPage } from '../components/public-page'

export const metadata = { title:'Privacy | Trajectas' }
export default async function PrivacyPage() {
  const policy = await getPublishedWebsitePrivacy()
  if (!policy) notFound()
  return <PublicPage label="Privacy" title={policy.title} intro={`Version ${policy.version} · Published ${new Date(policy.publishedAt).toLocaleDateString('en-AU',{timeZone:'Australia/Sydney'})}`}>
    <article className="px-container px-reading space-y-6 pb-16">{policy.body.split(/\n\s*\n/).map((paragraph,index)=><p key={index} className="whitespace-pre-line">{paragraph}</p>)}</article>
  </PublicPage>
}
