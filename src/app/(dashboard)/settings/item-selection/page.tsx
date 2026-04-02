import { redirect } from "next/navigation";

export default function ItemSelectionRedirect() {
  redirect("/assessments?tab=rules");
}
