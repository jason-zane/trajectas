import { redirect } from "next/navigation";

export default function PartnersPage() {
  redirect("/directory?tab=partners");
}
