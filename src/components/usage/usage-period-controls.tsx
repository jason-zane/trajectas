"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  adjacentUsageMonth,
  usagePeriodQuery,
  type UsagePeriod,
  type UsagePeriodPreset,
} from "@/lib/usage/period";
import type { UsageClientRef, UsagePartnerRef } from "@/lib/usage/report";

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function UsagePeriodControls({
  period,
  clientOptions,
  partnerOptions,
  selectedClient,
  selectedPartner,
}: {
  period: UsagePeriod;
  clientOptions?: UsageClientRef[];
  partnerOptions?: UsagePartnerRef[];
  selectedClient?: string;
  selectedPartner?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [preset, setPreset] = useState<UsagePeriodPreset>(period.preset);
  const [month, setMonth] = useState(period.month);
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);

  function navigate(changes: Record<string, string | undefined>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of new URLSearchParams(usagePeriodQuery(period)))
      params.set(key, value);
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() =>
      router.push(`${pathname}?${params.toString()}`, { scroll: false }),
    );
  }
  function apply(next: UsagePeriodPreset) {
    navigate({
      period: next,
      month: next === "month" ? month : undefined,
      from: next === "custom" ? from : undefined,
      to: next === "custom" ? to : undefined,
    });
  }
  const monthView = ["this-month", "last-month", "month"].includes(
    period.preset,
  );

  return (
    <div className="space-y-3" aria-busy={pending}>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          apply(preset);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="usage-period">Period</Label>
          <select
            id="usage-period"
            className={SELECT_CLASS}
            value={preset}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.value as UsagePeriodPreset;
              setPreset(next);
              if (next !== "custom" && next !== "month") apply(next);
            }}
          >
            <option value="this-month">This month</option>
            <option value="last-month">Last month</option>
            <option value="month">Choose month</option>
            <option value="quarter">This quarter</option>
            <option value="custom">Custom dates</option>
            <option value="all">All time</option>
          </select>
        </div>
        {preset === "month" ? (
          <div className="space-y-1.5">
            <Label htmlFor="usage-month">Month</Label>
            <Input
              id="usage-month"
              type="month"
              min="2000-01"
              value={month}
              required
              disabled={pending}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
        ) : null}
        {preset === "custom" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="usage-from">From</Label>
              <Input
                id="usage-from"
                type="date"
                min="2000-01-01"
                value={from}
                required
                disabled={pending}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usage-to">To (inclusive)</Label>
              <Input
                id="usage-to"
                type="date"
                min={from || "2000-01-01"}
                value={to}
                required
                disabled={pending}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
          </>
        ) : null}
        {preset === "custom" || preset === "month" ? (
          <Button type="submit" disabled={pending}>
            {pending ? "Loading…" : "Apply period"}
          </Button>
        ) : null}
        {monthView ? (
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous month"
              disabled={pending}
              onClick={() =>
                navigate({
                  period: "month",
                  month: adjacentUsageMonth(period, -1),
                  from: undefined,
                  to: undefined,
                })
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next month"
              disabled={pending}
              onClick={() =>
                navigate({
                  period: "month",
                  month: adjacentUsageMonth(period, 1),
                  from: undefined,
                  to: undefined,
                })
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
        {partnerOptions ? (
          <div className="space-y-1.5">
            <Label htmlFor="usage-partner">Partner</Label>
            <select
              id="usage-partner"
              className={`${SELECT_CLASS} max-w-64`}
              value={selectedPartner ?? ""}
              disabled={pending}
              onChange={(event) =>
                navigate({ partner: event.target.value, client: undefined })
              }
            >
              <option value="">All partners and direct clients</option>
              {partnerOptions.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {clientOptions ? (
          <div className="space-y-1.5">
            <Label htmlFor="usage-client">Client</Label>
            <select
              id="usage-client"
              className={`${SELECT_CLASS} max-w-64`}
              value={selectedClient ?? ""}
              disabled={pending}
              onChange={(event) => navigate({ client: event.target.value })}
            >
              <option value="">All clients</option>
              {clientOptions
                .filter(
                  (client) =>
                    !selectedPartner || client.partnerId === selectedPartner,
                )
                .map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
      </form>
      <p className="text-sm text-muted-foreground" role="status">
        {pending ? (
          "Loading usage…"
        ) : (
          <>
            {period.label}
            {period.isOpen && period.preset !== "all"
              ? " · To date"
              : ""} ·{" "}
            {period.from && period.preset !== "custom"
              ? `${period.from} to ${period.to} · `
              : ""}
            UTC
          </>
        )}
      </p>
      {period.error ? (
        <Alert variant="warning">
          <AlertDescription>{period.error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
