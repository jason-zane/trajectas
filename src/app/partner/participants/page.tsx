import { PageHeader } from "@/components/page-header";
import { getParticipants } from "@/app/actions/participants";
import { ParticipantsTable } from "./participants-table";

export default async function PartnerParticipantsPage() {
  const { data: participants, total } = await getParticipants();
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Participants"
        title="Participants"
        description={`${total} participant${total !== 1 ? "s" : ""} across all campaigns.`}
      />
      <ParticipantsTable participants={participants} />
    </div>
  );
}
