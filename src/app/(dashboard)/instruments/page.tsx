import { listInstrumentBuilds } from '@/app/actions/instrument'
import { InstrumentsPageClient } from './instruments-page-client'

export default async function InstrumentsPage() {
  const builds = await listInstrumentBuilds()
  return <InstrumentsPageClient builds={builds} />
}
