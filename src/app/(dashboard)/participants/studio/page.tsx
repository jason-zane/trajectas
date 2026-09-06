import { redirect } from 'next/navigation'
import { requireAdminScope } from '@/lib/auth/authorization'

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ ids?: string; experience?: string; lens?: string }> }) {
  await requireAdminScope()
  const params = await searchParams
  const query = new URLSearchParams()
  if (params.ids) query.set('ids', params.ids)
  query.set('lens', params.lens === 'time' || params.experience === 'individual' ? 'time' : 'snapshot')
  redirect(`/participants/unified?${query}`)
}
