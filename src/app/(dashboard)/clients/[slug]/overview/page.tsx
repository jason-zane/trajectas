import { notFound, redirect } from "next/navigation";
import { getClientBySlug, getClientStats, getRecentClientCampaigns } from "@/app/actions/clients";
import {
  canManageClient,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { ClientOverview } from "./client-overview";

export default async function ClientOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [client, scope] = await Promise.all([
    getClientBySlug(slug, { includeArchived: true }),
    resolveAuthorizedScope(),
  ]);
  if (!client) notFound();
  if (!canManageClient(scope, client.id, client.partnerId)) {
    redirect("/unauthorized?reason=client-directory");
  }

  const [stats, recentCampaigns, partnerInfo] = await Promise.all([
    getClientStats(client.id),
    getRecentClientCampaigns(client.id),
    client.partnerId
      ? createSupabaseClient().then((db) =>
          db
            .from("partners")
            .select("name, slug")
            .eq("id", client.partnerId!)
            .single()
            .then(({ data }) =>
              data ? { name: data.name as string, slug: data.slug as string } : undefined
            )
        )
      : Promise.resolve(undefined),
  ]);

  return (
    <ClientOverview
      client={client}
      partnerName={partnerInfo?.name}
      partnerSlug={partnerInfo?.slug}
      stats={stats}
      recentCampaigns={recentCampaigns}
    />
  );
}
