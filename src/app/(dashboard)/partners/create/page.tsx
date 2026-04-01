import { redirect } from "next/navigation";
import { PartnerCreateForm } from "./partner-create-form";
import { canManagePartnerDirectory, resolveAuthorizedScope } from "@/lib/auth/authorization";

export default async function CreatePartnerPage() {
  const scope = await resolveAuthorizedScope();

  if (!canManagePartnerDirectory(scope)) {
    redirect("/unauthorized?reason=partner-directory");
  }

  return <PartnerCreateForm />;
}
