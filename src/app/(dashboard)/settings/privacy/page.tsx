import { PageHeader } from '@/components/page-header'
import { getPrivacyDashboard, getPrivacyCampaigns, getResearchWorkbench } from '@/lib/dal/privacy'
import { dataLifecycleMode } from '@/lib/privacy/types'
import { PrivacySettings } from './privacy-settings'

export const dynamic = 'force-dynamic'
export default async function PrivacyPage() {
  const [dashboard, campaigns, research] = await Promise.all([getPrivacyDashboard(), getPrivacyCampaigns(), getResearchWorkbench()])
  return <div className="space-y-8"><PageHeader eyebrow="Platform settings" title="Privacy and retention" description="Review notices, retention rules, legal holds and disposal evidence." />
    <PrivacySettings dashboard={dashboard} campaigns={campaigns} research={research} mode={dataLifecycleMode()} />
  </div>
}
