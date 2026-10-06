export type UsageSearchParams = Record<string, string | string[] | undefined>;
export type UsagePeriodPreset =
  | "this-month"
  | "last-month"
  | "month"
  | "quarter"
  | "custom"
  | "all";

export interface UsagePeriod {
  preset: UsagePeriodPreset;
  start: string | null;
  /** Exclusive, UTC. */
  end: string | null;
  from: string;
  to: string;
  month: string;
  label: string;
  isOpen: boolean;
  error: string | null;
}

export function singleParam(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

const DAY = 86_400_000;
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const monthOnly = (date: Date) => date.toISOString().slice(0, 7);

function validDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) &&
    dateOnly(date) === value &&
    date.getUTCFullYear() >= 2000
    ? date
    : null;
}

/** One definition shared by pages, charts, exports and billing estimates. */
export function resolveUsagePeriod(
  params: UsageSearchParams,
  now = new Date(),
  defaultPreset: "this-month" | "last-month" = "this-month",
): UsagePeriod {
  const requested = singleParam(params.period) ?? defaultPreset;
  let preset: UsagePeriodPreset = "this-month";
  let start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  let end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  let error: string | null = null;
  if (requested === "all") {
    return {
      preset: "all",
      start: null,
      end: null,
      from: "",
      to: "",
      month: monthOnly(start),
      label: "All time",
      isOpen: true,
      error: null,
    };
  }
  if (requested === "last-month") {
    preset = requested;
    end = start;
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  } else if (requested === "this-month") {
    preset = requested;
  } else if (requested === "quarter") {
    preset = requested;
    const quarter = Math.floor(now.getUTCMonth() / 3) * 3;
    start = new Date(Date.UTC(now.getUTCFullYear(), quarter, 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), quarter + 3, 1));
  } else if (requested === "month") {
    const month = singleParam(params.month);
    const date = validDate(month ? `${month}-01` : undefined);
    if (date && /^\d{4}-\d{2}$/.test(month!)) {
      preset = requested;
      start = date;
      end = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
      );
    } else error = "Choose a valid month. Showing this month instead.";
  } else if (requested === "custom") {
    const from = validDate(singleParam(params.from));
    const to = validDate(singleParam(params.to));
    if (from && to && from <= to) {
      preset = requested;
      start = from;
      end = new Date(to.getTime() + DAY);
    } else
      error =
        "Choose valid start and end dates, with the end on or after the start. Showing this month instead.";
  } else error = "Choose a valid period. Showing this month instead.";

  const to = new Date(end.getTime() - DAY);
  const isOpen = end.getTime() > now.getTime();
  const label =
    preset === "custom"
      ? `${dateOnly(start)} – ${dateOnly(to)}`
      : preset === "quarter"
        ? `Q${Math.floor(start.getUTCMonth() / 3) + 1} ${start.getUTCFullYear()}`
        : new Intl.DateTimeFormat("en-AU", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(start);
  return {
    preset,
    start: start.toISOString(),
    end: end.toISOString(),
    from: dateOnly(start),
    to: dateOnly(to),
    month: monthOnly(start),
    label,
    isOpen,
    error,
  };
}

export function usagePeriodQuery(period: UsagePeriod): string {
  const params = new URLSearchParams({ period: period.preset });
  if (period.preset === "month") params.set("month", period.month);
  if (period.preset === "custom") {
    params.set("from", period.from);
    params.set("to", period.to);
  }
  return params.toString();
}

export function adjacentUsageMonth(
  period: UsagePeriod,
  direction: -1 | 1,
): string {
  const date = new Date(`${period.month}-01T00:00:00Z`);
  return monthOnly(
    new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + direction, 1),
    ),
  );
}
