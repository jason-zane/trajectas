import { redirect } from "next/navigation";

export default async function SettingsReportBuilderRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/report-templates/${id}/builder`);
}
