import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { resolveSessionActor } from "@/lib/auth/actor"
import { ProfileForm } from "./profile-form"

export default async function ProfilePage() {
  const actor = await resolveSessionActor()

  if (!actor) {
    redirect("/login?next=/profile")
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" />
      <ProfileForm email={actor.email} displayName={actor.displayName} />
    </div>
  )
}
