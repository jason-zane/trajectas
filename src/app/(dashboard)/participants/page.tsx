import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ScrollReveal } from "@/components/scroll-reveal";
import { getParticipants } from "@/app/actions/participants";

const statusVariant: Record<
  string,
  "secondary" | "default" | "outline" | "destructive"
> = {
  invited: "secondary",
  registered: "outline",
  in_progress: "default",
  completed: "default",
  withdrawn: "destructive",
  expired: "outline",
};

const statusLabel: Record<string, string> = {
  invited: "Invited",
  registered: "Registered",
  in_progress: "In Progress",
  completed: "Completed",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

export default async function ParticipantsPage() {
  const { data: participants, total } = await getParticipants();

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Participants"
        title="Participants"
        description={`${total} participant${total !== 1 ? "s" : ""} across all campaigns.`}
      />

      {participants.length === 0 ? (
        <EmptyState
          title="No participants yet"
          description="Participants will appear here once they've been invited to a campaign."
        />
      ) : (
        <div className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.06] overflow-hidden">
          {/* Table header */}
          <div className="border-b px-4 py-2.5 flex items-center gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="w-10" />
            <div className="flex-1 min-w-0">Participant</div>
            <div className="w-40 hidden md:block">Campaign</div>
            <div className="w-24 text-center">Status</div>
            <div className="w-24 text-center hidden sm:block">Progress</div>
            <div className="w-28 text-right hidden lg:block">Last Activity</div>
          </div>

          {/* Table rows */}
          {participants.map((p, index) => (
            <ScrollReveal key={p.id} delay={index * 40}>
              <Link
                href={`/participants/${p.id}`}
                className="flex items-center gap-4 border-b last:border-0 px-4 py-3 transition-colors hover:bg-muted/50 group"
              >
                {/* Avatar */}
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary transition-shadow duration-300 group-hover:shadow-[0_0_12px_var(--primary)]">
                  {(p.firstName?.[0] ?? p.email[0]).toUpperCase()}
                </div>

                {/* Name + Email */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {p.firstName || p.lastName
                      ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()
                      : p.email}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.email}
                  </p>
                </div>

                {/* Campaign */}
                <div className="w-40 hidden md:block">
                  <p className="text-xs text-muted-foreground truncate">
                    {p.campaignTitle}
                  </p>
                </div>

                {/* Status */}
                <div className="w-24 flex justify-center">
                  <Badge
                    variant={statusVariant[p.status] ?? "secondary"}
                    className="text-[10px]"
                  >
                    {statusLabel[p.status] ?? p.status}
                  </Badge>
                </div>

                {/* Progress */}
                <div className="w-24 text-center hidden sm:block">
                  <span className="text-xs text-muted-foreground">
                    {p.completedSessionCount}/{p.sessionCount} done
                  </span>
                </div>

                {/* Last activity */}
                <div className="w-28 text-right hidden lg:block">
                  <span className="text-xs text-muted-foreground">
                    {p.lastActivity
                      ? formatRelativeDate(p.lastActivity)
                      : "—"}
                  </span>
                </div>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      )}
    </div>
  );
}
