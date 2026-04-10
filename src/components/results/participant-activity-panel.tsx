import { Activity, Mail, Play, CheckCircle2 } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import { ScrollReveal } from "@/components/scroll-reveal";
import { EmptyState } from "@/components/empty-state";
import type { ActivityEvent } from "@/app/actions/participants";

interface ParticipantActivityPanelProps {
  activity: ActivityEvent[];
}

const EVENT_ICONS: Record<string, typeof Activity> = {
  invited: Mail,
  started: Play,
  session_started: Play,
  session_completed: CheckCircle2,
  completed: CheckCircle2,
};

const EVENT_DOT_CLASSES: Record<string, string> = {
  invited: "bg-muted-foreground/50",
  started: "bg-primary",
  session_started: "bg-brand",
  session_completed: "bg-primary",
  completed: "bg-emerald-500",
};

export function ParticipantActivityPanel({
  activity,
}: ParticipantActivityPanelProps) {
  if (activity.length === 0) {
    return (
      <EmptyState
        variant="default"
        title="No activity yet"
        description="Events will appear here as the participant progresses."
      />
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-4">
        {activity.map((event, index) => {
          const Icon = EVENT_ICONS[event.type] ?? Activity;
          const dotClass = EVENT_DOT_CLASSES[event.type] ?? "bg-muted-foreground/50";
          return (
            <ScrollReveal key={`${event.type}-${event.timestamp}-${index}`} delay={index * 40}>
              <div className="relative flex items-start gap-4 pl-0">
                <div
                  className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${dotClass}`}
                >
                  <Icon className="size-4 text-white" />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <p className="font-medium text-sm">{event.label}</p>
                  <p className="text-caption text-muted-foreground">
                    <LocalTime iso={event.timestamp} format="date-time" />
                    {event.detail && ` · ${event.detail}`}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </div>
  );
}
