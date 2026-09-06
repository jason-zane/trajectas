import { connection } from "next/server"
import { getContentSources } from '@/app/actions/content-sources'
import { ContentSourcesList } from './content-sources-list'

export default async function ContentSourcesSettingsPage() {
  await connection()
  const sources = await getContentSources()
  return <ContentSourcesList sources={sources} />
}
