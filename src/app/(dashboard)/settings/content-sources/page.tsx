import { getContentSources } from '@/app/actions/content-sources'
import { ContentSourcesList } from './content-sources-list'

export default async function ContentSourcesSettingsPage() {
  const sources = await getContentSources()
  return <ContentSourcesList sources={sources} />
}
