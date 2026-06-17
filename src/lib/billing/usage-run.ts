import "server-only";

import {
  computeUsageAmountCents,
  previousMonthPeriod,
} from "@/lib/billing/usage-period";
import {
  countCompletedAssessmentsInPeriod,
  getUsageSnapshotForPeriod,
  linkSnapshotInvoice,
  listUsageBillingAccounts,
  recordUsageSnapshot,
} from "@/lib/dal/usage-billing";
import { createUsageInvoice } from "@/lib/stripe/invoices";
import { logActionError } from "@/lib/security/action-errors";

export interface UsageRunResult {
  period: string;
  accounts: number;
  invoiced: number;
  skipped: number;
  errors: number;
  details: Array<Record<string, unknown>>;
}

/**
 * Bill the just-closed month for every usage-enabled account. Idempotent: the
 * per-period snapshot is written *before* the invoice, so a re-run (or a crash
 * mid-loop) can never double-charge — an already-snapshotted period is skipped.
 * If invoicing then fails, the snapshot survives with a null invoice_id and is
 * visible for follow-up rather than silently re-billed. `now` is injected so the
 * run is unit-testable.
 */
export async function runUsageBilling(now: Date): Promise<UsageRunResult> {
  const period = previousMonthPeriod(now);
  const accounts = await listUsageBillingAccounts();
  const result: UsageRunResult = {
    period: period.label,
    accounts: accounts.length,
    invoiced: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  for (const account of accounts) {
    if (!account.clientId) {
      result.skipped += 1;
      continue;
    }
    try {
      const existing = await getUsageSnapshotForPeriod(
        account.id,
        period.start,
        period.end,
      );
      if (existing) {
        result.skipped += 1;
        result.details.push({ account: account.id, status: "already_billed" });
        continue;
      }

      const quantity = await countCompletedAssessmentsInPeriod(
        account.clientId,
        period.start,
        period.end,
      );
      const amountCents = computeUsageAmountCents(
        quantity,
        account.usageUnitPriceCents,
      );

      // Freeze the period first — reserves it so a retry can't double-charge.
      const snapshot = await recordUsageSnapshot({
        billingAccountId: account.id,
        periodStart: period.start,
        periodEnd: period.end,
        unit: account.usageUnit,
        quantity,
        unitPriceCents: account.usageUnitPriceCents,
        amountCents,
      });

      if (quantity <= 0) {
        result.skipped += 1;
        result.details.push({ account: account.id, status: "no_usage" });
        continue;
      }

      const invoice = await createUsageInvoice(
        account,
        {
          description: `Assessments completed — ${period.label}`,
          quantity,
          unitAmountCents: account.usageUnitPriceCents,
        },
        `Usage for ${period.label}`,
      );
      await linkSnapshotInvoice(snapshot.id, invoice.id);
      result.invoiced += 1;
      result.details.push({
        account: account.id,
        quantity,
        invoiceId: invoice.id,
      });
    } catch (err) {
      result.errors += 1;
      logActionError("cron.usage-billing", err);
      result.details.push({
        account: account.id,
        error: err instanceof Error ? err.message : "failed",
      });
    }
  }

  return result;
}
