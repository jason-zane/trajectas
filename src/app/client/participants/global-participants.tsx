"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { ScrollReveal } from "@/components/scroll-reveal";
import { usePortal } from "@/components/portal-context";
import type { CampaignWithMeta, OrganizationParticipant } from "@/app/actions/campaigns";

// ---------------------------------------------------------------------------
// Status styling
// ---------------------------------------------------------------------------

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

const STATUSES = [
  "invited",
  "registered",
  "in_progress",
  "completed",
  "withdrawn",
  "expired",
] as const;

const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function displayName(p: OrganizationParticipant) {
  if (p.firstName || p.lastName) {
    return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  }
  return p.email;
}

function initials(p: OrganizationParticipant) {
  return (p.firstName?.[0] ?? p.email[0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface GlobalParticipantsProps {
  participants: OrganizationParticipant[];
  campaigns: CampaignWithMeta[];
}

export function GlobalParticipants({
  participants,
  campaigns,
}: GlobalParticipantsProps) {
  const { href } = usePortal();

  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Derive unique campaigns that actually have participants
  const campaignOptions = useMemo(() => {
    const ids = new Set(participants.map((p) => p.campaignId));
    return campaigns.filter((c) => ids.has(c.id));
  }, [participants, campaigns]);

  // Filter
  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return participants.filter((p) => {
      if (campaignFilter !== "all" && p.campaignId !== campaignFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (term) {
        const name = displayName(p).toLowerCase();
        const email = p.email.toLowerCase();
        if (!name.includes(term) && !email.includes(term)) return false;
      }
      return true;
    });
  }, [participants, search, campaignFilter, statusFilter]);

  const displayed = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <PageHeader
        eyebrow="Participants"
        title="All Participants"
        description="Showing participants across all campaigns. The same person may appear multiple times if enrolled in more than one campaign."
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={campaignFilter}
          onValueChange={(val) => {
            setCampaignFilter(val as string);
            setVisibleCount(PAGE_SIZE);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="All campaigns" />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="all">All campaigns</SelectItem>
            {campaignOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val as string);
            setVisibleCount(PAGE_SIZE);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Count summary */}
      <p className="text-caption text-muted-foreground -mt-4">
        Showing {displayed.length} of {filtered.length} participant
        {filtered.length !== 1 ? "s" : ""}
        {filtered.length !== participants.length &&
          ` (${participants.length} total)`}
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <Users className="size-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {participants.length === 0
                ? "No participants yet. Participants will appear here once they've been invited to a campaign."
                : "No participants match the current filters."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.06] overflow-hidden">
          {/* Table header */}
          <div className="border-b px-4 py-2.5 flex items-center gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="w-10" />
            <div className="flex-1 min-w-0">Participant</div>
            <div className="w-40 hidden md:block">Campaign</div>
            <div className="w-24 text-center">Status</div>
            <div className="w-24 text-right hidden sm:block">Enrolled</div>
            <div className="w-16 text-right hidden sm:block">Report</div>
          </div>

          {/* Rows */}
          {displayed.map((p, index) => (
            <ScrollReveal key={`${p.id}-${index}`} delay={index * 40}>
              <div className="flex items-center gap-4 border-b last:border-0 px-4 py-3 transition-colors hover:bg-muted/50 group">
                {/* Avatar */}
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary transition-shadow duration-300 group-hover:shadow-[0_0_12px_var(--primary)]">
                  {initials(p)}
                </div>

                {/* Name + Email */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {displayName(p)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.email}
                  </p>
                </div>

                {/* Campaign */}
                <div className="w-40 hidden md:block">
                  <Link
                    href={href(`/campaigns/${p.campaignId}`)}
                    className="text-xs text-primary hover:underline truncate block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {p.campaignTitle}
                  </Link>
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

                {/* Enrolled date */}
                <div className="w-24 text-right hidden sm:block">
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeDate(p.created_at)}
                  </span>
                </div>

                {/* Report link */}
                <div className="w-16 text-right hidden sm:block">
                  {p.status === "completed" ? (
                    <Link
                      href={href(`/campaigns/${p.campaignId}/results`)}
                      className="text-xs text-primary hover:underline whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View &rarr;
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">&mdash;</span>
                  )}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-3 py-1.5"
          >
            Show more ({filtered.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
