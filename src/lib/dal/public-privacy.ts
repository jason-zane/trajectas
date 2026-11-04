import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

/** Public projection only: draft text and internal decisions are never returned. */
export const getPublishedWebsitePrivacy = unstable_cache(async () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  try {
    const {data,error} = await createAdminClient().from('privacy_notice_versions')
      .select('title,body,version,published_at').eq('audience','website').eq('status','published')
      .order('published_at',{ascending:false}).limit(1).maybeSingle()
    if(error) return null
    return data ? { title:String(data.title),body:String(data.body),version:String(data.version),publishedAt:String(data.published_at) } : null
  } catch { return null }
}, ['published-website-privacy-v1'], { tags:['public-privacy'],revalidate:60 })
