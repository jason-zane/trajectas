import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { resolveSessionActor } from "@/lib/auth/actor"
import { createAdminClient } from "@/lib/supabase/admin"
import { ProfileForm } from "./profile-form"

export default async function ProfilePage() {
  const actor = await resolveSessionActor()

  if (!actor) {
    redirect("/login?next=/profile")
  }

  const db = createAdminClient()
  const { data: deletionState } = await db
    .from("profiles")
    .select("deletion_requested_at, scheduled_deletion_at")
    .eq("id", actor.id)
    .single()

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" />
      <ProfileForm
        email={actor.email}
        displayName={actor.displayName}
        scheduledDeletionAt={deletionState?.scheduled_deletion_at ?? null}
      />
    </div>
  )
}
