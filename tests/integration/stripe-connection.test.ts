import { describe, expect, it } from "vitest";
import { getStripeConnectionStatus } from "@/lib/stripe/account";

/**
 * Connectivity check for the Stripe integration. Self-skips in CI (no
 * STRIPE_SECRET_KEY), and runs locally against the test-mode key in
 * `.env.local`. Unlike the Supabase integration tests this opens no Supabase
 * client, so the production host-guard does not apply.
 */
const canRun = Boolean(process.env.STRIPE_SECRET_KEY);

describe.skipIf(!canRun)("stripe connection (integration)", () => {
  it("retrieves the connected account in test mode", async () => {
    const status = await getStripeConnectionStatus();

    expect(status.connected).toBe(true);
    expect(status.accountId).toMatch(/^acct_/);
    // Safety: this suite must never be pointed at a live key.
    expect(status.mode).toBe("test");
  }, 15_000);
});
