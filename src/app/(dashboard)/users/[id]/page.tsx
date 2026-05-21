import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { UserActionsMenu } from "@/components/users/user-actions-menu";
import { UserActivityCard } from "@/components/users/user-activity-card";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserDetail } from "@/app/actions/user-management";
import { UserDetailClient } from "./user-detail-client";

type TenantOption = {
  id: string;
  name: string;
};

function formatDeletionDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const [user, partnersResult, clientsResult, deletionStateResult] = await Promise.all([
    getUserDetail(id),
    db
      .from("partners")
      .select("id, name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    db
      .from("clients")
      .select("id, name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    db
      .from("profiles")
      .select("scheduled_deletion_at")
      .eq("id", id)
      .single(),
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

  const scheduledDeletionAt = deletionStateResult.data?.scheduled_deletion_at ?? null;
  const hasPendingDeletion = Boolean(scheduledDeletionAt);

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
      >
        <UserActionsMenu
          targetProfileId={user.id}
          targetEmail={user.email}
          hasPendingDeletion={hasPendingDeletion}
        />
      </PageHeader>

      {hasPendingDeletion ? (
        <div className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge variant="destructive">Pending deletion</Badge>
            <p className="text-sm">
              Scheduled to be permanently removed on{" "}
              <strong>{formatDeletionDate(scheduledDeletionAt!)}</strong>.
            </p>
          </div>
          <p className="text-caption text-muted-foreground">
            Use the Actions menu to cancel.
          </p>
        </div>
      ) : null}

      <UserDetailClient user={user} partners={partners} clients={clients} />

      <UserActivityCard profileId={user.id} limit={10} />
    </div>
  );
}
