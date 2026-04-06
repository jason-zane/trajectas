import { Megaphone, Users, ClipboardList, UserCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type ClientStatsProps = {
  activeCampaignCount: number;
  totalParticipants: number;
  assignedAssessmentCount: number;
  teamMemberCount: number;
};

export function ClientStats(props: ClientStatsProps) {
  const cards = [
    {
      label: "Active Campaigns",
      value: props.activeCampaignCount,
      icon: Megaphone,
    },
    {
      label: "Total Participants",
      value: props.totalParticipants,
      icon: Users,
    },
    {
      label: "Assigned Assessments",
      value: props.assignedAssessmentCount,
      icon: ClipboardList,
    },
    {
      label: "Team Members",
      value: props.teamMemberCount,
      icon: UserCircle,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {label}
                </p>
                <p className="text-3xl font-bold">{value}</p>
              </div>
              <Icon className="size-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
