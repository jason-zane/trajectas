import { PageHeader } from "@/components/page-header";
import { requireAdminScope } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { listUsersForAdmin } from "@/app/actions/user-management";
import { InviteDialog } from "./invite-dialog";
import { UsersTable } from "./users-table";

export default async function UsersPage() {
  await requireAdminScope();

  const db = createAdminClient();
  const [{ data: partners }, { data: clients }, users] = await Promise.all([
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
    listUsersForAdmin(),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        eyebrow="People"
        title="Users"
        description="Manage staff accounts, pending invites, and workspace memberships."
      >
        <InviteDialog partners={partners ?? []} clients={clients ?? []} />
      </PageHeader>

      <UsersTable users={users} />
    </div>
  );
}
