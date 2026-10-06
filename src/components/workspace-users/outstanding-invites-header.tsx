"use client";

import { Button } from "@/components/ui/button";
import { getInviteStatus, OUTSTANDING_INVITE_LIMIT } from "@/lib/invite-status";

export type OutstandingInviteFilter = "all" | "pending" | "expired";

export function OutstandingInvitesHeader({
  invites,
  filter,
  onFilterChange,
}: {
  invites: { expiresAt: string }[];
  filter: OutstandingInviteFilter;
  onFilterChange: (filter: OutstandingInviteFilter) => void;
}) {
  const pendingCount = invites.filter(invite => getInviteStatus(invite) === "pending").length;
  const counts = { all: invites.length, pending: pendingCount, expired: invites.length - pendingCount };

  return (
    <div className="space-y-2">
      <h3 className="text-section">Outstanding invitations</h3>
      <p className="text-caption">
        Pending invitations can be accepted. Expired invitations cannot be accepted,
        but still remain outstanding until explicitly resolved.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Invitation status">
        {(["all", "pending", "expired"] as const).map(value => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filter === value ? "default" : "outline"}
            aria-pressed={filter === value}
            onClick={() => onFilterChange(value)}
          >
            {value === "all" ? "All" : value === "pending" ? "Pending" : "Expired"} ({counts[value]})
          </Button>
        ))}
      </div>
      {invites.length >= OUTSTANDING_INVITE_LIMIT && (
        <p className="text-caption">
          Showing the most recent {OUTSTANDING_INVITE_LIMIT.toLocaleString()} outstanding invitations.
        </p>
      )}
    </div>
  );
}
