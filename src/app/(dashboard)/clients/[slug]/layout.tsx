import { notFound } from "next/navigation";

import { getClientBySlug } from "@/app/actions/clients";
import { resolveAuthorizedScope } from "@/lib/auth/authorization";
import { ClientDetailShell } from "./client-detail-shell";

export default async function ClientDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [client, scope] = await Promise.all([
    getClientBySlug(slug, { includeArchived: true }),
    resolveAuthorizedScope(),
  ]);
  if (!client) notFound();

  return (
    <ClientDetailShell client={client} isPlatformAdmin={scope.isPlatformAdmin}>
      {children}
    </ClientDetailShell>
  );
}
