import { getCampaignById } from "@/app/actions/campaigns";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function CampaignResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const total = campaign.candidates.length;
  const byStatus = campaign.candidates.reduce<Record<string, number>>(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const funnelSteps = [
    { label: "Invited", count: total, color: "bg-muted-foreground" },
    {
      label: "Started",
      count: (byStatus["in_progress"] ?? 0) + (byStatus["completed"] ?? 0),
      color: "bg-blue-500",
    },
    {
      label: "Completed",
      count: byStatus["completed"] ?? 0,
      color: "bg-primary",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Completion funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Completion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No candidates invited yet.
            </p>
          ) : (
            <div className="space-y-3">
              {funnelSteps.map((step) => {
                const pct = total > 0 ? (step.count / total) * 100 : 0;
                return (
                  <div key={step.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>{step.label}</span>
                      <span className="text-muted-foreground">
                        {step.count} ({Math.round(pct)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${step.color} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-assessment breakdown */}
      {campaign.assessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Per-Assessment Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {campaign.assessments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{a.assessmentTitle}</p>
                    <Badge
                      variant="outline"
                      className="text-[10px] mt-0.5"
                    >
                      {a.assessmentStatus}
                    </Badge>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {a.isRequired ? "Required" : "Optional"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
