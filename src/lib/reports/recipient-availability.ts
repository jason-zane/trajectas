import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/** Recheck revocation when a released report is read, downloaded or emailed. */
export async function isReportRecipientAvailable(participantId: string, campaignId?: string | null) {
  let query = createAdminClient().from('campaign_participants')
    .select('id, campaigns!inner(deleted_at, client_id, clients(deleted_at))')
    .eq('id', participantId).is('deleted_at', null).not('status', 'in', '(withdrawn,expired)')
    .is('campaigns.deleted_at', null);
  if (campaignId) query = query.eq('campaign_id', campaignId);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return false;
  const campaign = Array.isArray(data.campaigns) ? data.campaigns[0] : data.campaigns;
  const client = Array.isArray(campaign?.clients) ? campaign.clients[0] : campaign?.clients;
  return Boolean(campaign && (!campaign.client_id || (client && client.deleted_at == null)));
}
