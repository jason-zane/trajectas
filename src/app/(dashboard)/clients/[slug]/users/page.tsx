import { notFound } from "next/navigation";
import { getClientBySlug } from "@/app/actions/clients";
import { ClientTeamPanel } from "@/components/client-team-panel";

export default async function ClientUsersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  return (
    <ClientTeamPanel
      clientId={client.id}
      userProfileHref={(userId) => `/users/${userId}`}
    />
  );
}
