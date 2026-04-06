import { getPartnerBySlug } from "@/app/actions/partners";
import { notFound } from "next/navigation";
import { PartnerDetailShell } from "./partner-detail-shell";

export default async function PartnerDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const partner = await getPartnerBySlug(slug, {
    includeArchived: true,
  });
  if (!partner) notFound();

  return (
    <PartnerDetailShell partner={partner}>
      {children}
    </PartnerDetailShell>
  );
}
