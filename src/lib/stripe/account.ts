import "server-only";
import { getStripe, getStripeMode } from "./client";

/** UI-safe snapshot of the connected Stripe account. Contains no secrets. */
export interface StripeConnectionStatus {
  /** True if the account was retrieved successfully (the API call succeeded). */
  connected: boolean;
  /** Derived from the key prefix, not the account. */
  mode: "test" | "live" | "unknown";
  accountId: string;
  businessName: string | null;
  country: string | null;
  defaultCurrency: string | null;
  /** Whether the account can accept live charges (false until onboarding completes). */
  chargesEnabled: boolean;
  /** Whether account onboarding/details have been submitted to Stripe. */
  detailsSubmitted: boolean;
}

/**
 * Retrieve the connected Stripe account and return a UI-safe status DTO.
 *
 * `accounts.retrieveCurrent()` returns the account the API key authenticates
 * as. Throws if the call fails (e.g. an invalid or revoked key), so callers can
 * surface a clear "not connected" state.
 */
export async function getStripeConnectionStatus(): Promise<StripeConnectionStatus> {
  const account = await getStripe().accounts.retrieveCurrent();
  return {
    connected: true,
    mode: getStripeMode(),
    accountId: account.id,
    businessName:
      account.business_profile?.name ??
      account.settings?.dashboard?.display_name ??
      null,
    country: account.country ?? null,
    defaultCurrency: account.default_currency ?? null,
    chargesEnabled: account.charges_enabled,
    detailsSubmitted: account.details_submitted,
  };
}
