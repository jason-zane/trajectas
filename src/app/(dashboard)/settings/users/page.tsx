import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { listStaffUsers } from "@/lib/auth/staff-auth";
import { requireAdminScope } from "@/lib/auth/authorization";
import { InviteUserForm } from "@/app/(dashboard)/settings/users/invite-user-form";
import {
  revokeInviteAction,
  revokeMembershipAction,
  setStaffUserActiveStateAction,
} from "@/app/actions/staff-users";

function formatRole(role: string) {
  return role.replace(/_/g, " ");
}

export default async function SettingsUsersPage() {
  await requireAdminScope();
  const db = createAdminClient();
  const [{ data: partners }, { data: clients }, directory] = await Promise.all([
    db
      .from("partners")
      .select("id, name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    db
      .from("organizations")
      .select("id, name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    listStaffUsers(),
  ]);

  const partnerMembershipsByProfile = new Map<string, Array<Record<string, unknown>>>();
  for (const membership of directory.partnerMemberships) {
    const profileId = String(membership.profile_id);
    const existing = partnerMembershipsByProfile.get(profileId) ?? [];
    existing.push(membership as Record<string, unknown>);
    partnerMembershipsByProfile.set(profileId, existing);
  }

  const clientMembershipsByProfile = new Map<string, Array<Record<string, unknown>>>();
  for (const membership of directory.clientMemberships) {
    const profileId = String(membership.profile_id);
    const existing = clientMembershipsByProfile.get(profileId) ?? [];
    existing.push(membership as Record<string, unknown>);
    clientMembershipsByProfile.set(profileId, existing);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Users"
        description="Manage staff invites, active accounts, and workspace memberships."
      />

      <InviteUserForm partners={partners ?? []} clients={clients ?? []} />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Staff accounts</CardTitle>
            <CardDescription>
              Active and inactive staff profiles with their current workspace memberships.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {directory.profiles.map((profile) => {
              const partnerMemberships =
                partnerMembershipsByProfile.get(String(profile.id)) ?? [];
              const clientMemberships =
                clientMembershipsByProfile.get(String(profile.id)) ?? [];
              return (
                <div
                  key={String(profile.id)}
                  className="space-y-3 rounded-xl border border-border/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        {String(profile.display_name ?? "").trim() || String(profile.email)}
                      </p>
                      <p className="text-sm text-muted-foreground">{String(profile.email)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={profile.is_active ? "default" : "secondary"}>
                        {profile.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">{formatRole(String(profile.role))}</Badge>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {partnerMemberships.map((membership) => (
                      <div key={String(membership.id)} className="flex items-center justify-between gap-3">
                        <span>
                          Partner membership · {String(membership.role)}
                          {membership.revoked_at ? " · revoked" : ""}
                        </span>
                        {!membership.revoked_at ? (
                          <form action={revokeMembershipAction}>
                            <input type="hidden" name="membershipId" value={String(membership.id)} />
                            <input type="hidden" name="membershipType" value="partner" />
                            <Button size="sm" type="submit" variant="outline">
                              Revoke
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                    {clientMemberships.map((membership) => (
                      <div key={String(membership.id)} className="flex items-center justify-between gap-3">
                        <span>
                          Client membership · {String(membership.role)}
                          {membership.revoked_at ? " · revoked" : ""}
                        </span>
                        {!membership.revoked_at ? (
                          <form action={revokeMembershipAction}>
                            <input type="hidden" name="membershipId" value={String(membership.id)} />
                            <input type="hidden" name="membershipType" value="client" />
                            <Button size="sm" type="submit" variant="outline">
                              Revoke
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                    {partnerMemberships.length === 0 && clientMemberships.length === 0 ? (
                      <p>No active workspace memberships.</p>
                    ) : null}
                  </div>
                  <form action={setStaffUserActiveStateAction}>
                    <input type="hidden" name="profileId" value={String(profile.id)} />
                    <input
                      type="hidden"
                      name="isActive"
                      value={profile.is_active ? "false" : "true"}
                    />
                    <Button size="sm" type="submit" variant={profile.is_active ? "outline" : "default"}>
                      {profile.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </form>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
            <CardDescription>
              Open invites remain valid until accepted, revoked, or expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {directory.invites.map((invite) => (
              <div
                key={invite.id}
                className="space-y-2 rounded-xl border border-border/70 p-4 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{invite.email}</p>
                    <p className="text-muted-foreground">
                      {formatRole(invite.role)} · {invite.tenantType}
                    </p>
                  </div>
                  <Badge variant={invite.acceptedAt ? "default" : invite.revokedAt ? "secondary" : "outline"}>
                    {invite.acceptedAt
                      ? "Accepted"
                      : invite.revokedAt
                        ? "Revoked"
                        : invite.isExpired
                          ? "Expired"
                          : "Pending"}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  Expires {new Date(invite.expiresAt).toLocaleString()}
                </p>
                {!invite.acceptedAt && !invite.revokedAt ? (
                  <form action={revokeInviteAction}>
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <Button size="sm" type="submit" variant="outline">
                      Revoke invite
                    </Button>
                  </form>
                ) : null}
              </div>
            ))}
            {directory.invites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invites yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
