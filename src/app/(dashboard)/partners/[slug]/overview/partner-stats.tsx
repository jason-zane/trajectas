import { Building2, Megaphone, Users, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type PartnerStatsProps = {
  clientCount: number;
  activeCampaignCount: number;
  partnerMemberCount: number;
  totalAssessmentsAssigned: number;
};

export function PartnerStats(props: PartnerStatsProps) {
  const cards = [
    {
      label: "Clients",
      value: props.clientCount,
      icon: Building2,
    },
    {
      label: "Active Campaigns",
      value: props.activeCampaignCount,
      icon: Megaphone,
    },
    {
      label: "Partner Members",
      value: props.partnerMemberCount,
      icon: Users,
    },
    {
      label: "Assessments Assigned",
      value: props.totalAssessmentsAssigned,
      icon: ClipboardList,
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
