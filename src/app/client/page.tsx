import { redirect } from "next/navigation";

export default function ClientPortalRootPage() {
  redirect("/client/dashboard");
}
