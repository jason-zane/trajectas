import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserDetail } from "@/app/actions/user-management";
import { UserDetailClient } from "./user-detail-client";

type TenantOption = {
  id: string;
  name: string;
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, partnersResult, clientsResult] = await Promise.all([
    getUserDetail(id),
    (async () => {
      const db = createAdminClient();
      return db
        .from("partners")
        .select("id, name")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name", { ascending: true });
    })(),
    (async () => {
      const db = createAdminClient();
      return db
        .from("clients")
        .select("id, name")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name", { ascending: true });
    })(),
  ]);

  if (!user) {
    notFound();
  }

  if (partnersResult.error) {
    throw new Error(partnersResult.error.message);
  }

  if (clientsResult.error) {
    throw new Error(clientsResult.error.message);
  }

  const partners = (partnersResult.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
  })) satisfies TenantOption[];

  const clients = (clientsResult.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
  })) satisfies TenantOption[];

  return (
    <div className="space-y-8">
      <Link
        href="/users"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to users
      </Link>

      <PageHeader
        eyebrow="People"
        title={user.displayName ?? user.email}
        description={user.email}
      />

      <UserDetailClient user={user} partners={partners} clients={clients} />
    </div>
  );
}
