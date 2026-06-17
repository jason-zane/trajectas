import "server-only";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/**
 * Lazily-instantiated, server-only Stripe client.
 *
 * Mirrors the Resend provider pattern (`src/lib/email/provider.ts`): read the
 * secret from the environment on first use and throw a clear error if it is
 * missing, rather than crashing at import time. The `STRIPE_SECRET_KEY` never
 * leaves the server — this module imports `server-only` so it can never be
 * bundled into a Client Component.
 *
 * `apiVersion` is intentionally omitted: the installed SDK pins a default
 * version, so the pin moves deliberately with dependency bumps. We can switch
 * to an explicit pin once the billing surface stabilises.
 */
export function getStripe(): Stripe {
  if (!stripeClient) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    stripeClient = new Stripe(apiKey, {
      appInfo: { name: "Trajectas", url: "https://trajectas.com" },
      maxNetworkRetries: 2,
    });
  }
  return stripeClient;
}

/**
 * Coarse mode derived from the key prefix, for UI badges and guardrails
 * (e.g. refusing destructive test fixtures against a live key). Handles both
 * standard (`sk_`) and restricted (`rk_`) keys.
 */
export function getStripeMode(): "test" | "live" | "unknown" {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  return "unknown";
}
