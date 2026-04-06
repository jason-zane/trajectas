import { getClientBySlug } from "@/app/actions/clients";
import { notFound } from "next/navigation";
import { ClientDetailShell } from "./client-detail-shell";

export default async function ClientDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug, {
    includeArchived: true,
  });
  if (!client) notFound();

  return (
    <ClientDetailShell client={client}>
      {children}
    </ClientDetailShell>
  );
}
