import { DataTableLoading } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";

export default function ClientParticipantsLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Participants"
        title="All Participants"
        description="Showing participants across all campaigns."
      />

      <DataTableLoading columnCount={3} filterCount={2} rowCount={8} />
    </div>
  );
}
