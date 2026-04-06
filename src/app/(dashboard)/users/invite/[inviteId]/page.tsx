import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getInviteDetail } from "@/app/actions/user-management";
import { InviteDetailClient } from "./invite-detail-client";

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatExpiry(expiresAt: string) {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const diffMs = expiry - now;
  const diffDays = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24));

  if (diffMs >= 0) {
    if (diffDays <= 1) return "Expires within 1 day";
    return `Expires in ${diffDays} days`;
  }

  if (diffDays <= 1) return "Expired within 1 day";
  return `Expired ${diffDays} days ago`;
}

function getRoleLabel(role: string) {
  switch (role) {
    case "platform_admin":
      return "Platform Admin";
    case "partner_admin":
      return "Partner Admin";
    case "partner_member":
      return "Partner Member";
    case "client_admin":
      return "Client Admin";
    case "client_member":
      return "Client Member";
    default:
      return role.replace(/_/g, " ");
  }
}

function getTenantLabel(tenantType: string) {
  switch (tenantType) {
    case "partner":
      return "Partner";
    case "client":
      return "Client";
    default:
      return "Platform";
  }
}

export default async function InviteDetailPage({
  params,
}: {
  params: Promise<{ inviteId: string }>;
}) {
  const { inviteId } = await params;
  const invite = await getInviteDetail(inviteId);

  if (!invite) {
    notFound();
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <Link
        href="/users"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All Users
      </Link>

      <PageHeader
        eyebrow="People"
        title={invite.email}
        description="Pending invite details, including expiry, intended role, and tenant scope."
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline">{getRoleLabel(invite.role)}</Badge>
          <Badge variant="outline">{getTenantLabel(invite.tenantType)}</Badge>
        </div>
      </PageHeader>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-foreground">Invite status</p>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-sm text-muted-foreground">
                {formatExpiry(invite.expiresAt)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Intended role
              </p>
              <p className="font-medium text-foreground">{getRoleLabel(invite.role)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Tenant
              </p>
              <p className="font-medium text-foreground">
                {invite.tenantName ?? "Platform"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Created
              </p>
              <p className="font-medium text-foreground">{formatDate(invite.createdAt)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Expires
              </p>
              <p className="font-medium text-foreground">{formatDate(invite.expiresAt)}</p>
            </div>
          </div>

          <InviteDetailClient invite={invite} />
        </CardContent>
      </Card>
    </div>
  );
}
