import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Wand2, Gauge, Coins, Lock } from "lucide-react";
import { getPublicBuildsAdminSummary } from "@/app/actions/public-builds-admin";
import { PublicBuildsTable } from "./public-builds-table";

const MODE_LABEL: Record<string, string> = {
  off: "Off",
  closed: "Closed (invite code)",
  open: "Open",
};

export default async function PublicBuildsPage() {
  const summary = await getPublicBuildsAdminSummary();

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        title="Public Role Builder"
        description="The funnel, cost meter, and lead list for the public /build tool."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          icon={Wand2}
          label="Builds today"
          value={`${summary.buildsToday} / ${summary.dailyCap}`}
        />
        <StatCard
          icon={Lock}
          label="Mode"
          value={MODE_LABEL[summary.mode] ?? summary.mode}
        />
        <StatCard
          icon={Coins}
          label="Tokens today"
          value={summary.tokensToday.toLocaleString("en-AU")}
        />
        <StatCard icon={Gauge} label="Total runs" value={summary.runs.length} />
      </div>

      <PublicBuildsTable runs={summary.runs} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wand2;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
