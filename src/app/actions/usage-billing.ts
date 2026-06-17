"use server";

import { revalidatePath } from "next/cache";

import { requireAdminScope } from "@/lib/auth/authorization";
import { logAuditEventSafe } from "@/lib/auth/support-sessions";
import { setClientUsagePricing } from "@/lib/dal/usage-billing";

export interface SetUsagePricingActionInput {
  clientId: string;
  enabled: boolean;
  unitPriceCents: number;
}

export type SetUsagePricingActionResult = { success: true } | { error: string };

export async function setClientUsagePricingAction(
  input: SetUsagePricingActionInput,
): Promise<SetUsagePricingActionResult> {
  try {
    const scope = await requireAdminScope();

    if (!input.clientId) return { error: "Missing client." };
    if (input.enabled && input.unitPriceCents <= 0) {
      return { error: "Set a per-unit price above zero to enable usage billing." };
    }

    await setClientUsagePricing({
      clientId: input.clientId,
      enabled: input.enabled,
      unitPriceCents: Math.max(0, Math.round(input.unitPriceCents)),
    });

    await logAuditEventSafe({
      actorProfileId: scope.actor?.id ?? null,
      eventType: "billing.usage_pricing_updated",
      targetTable: "billing_accounts",
      clientId: input.clientId,
      metadata: {
        enabled: input.enabled,
        unitPriceCents: input.unitPriceCents,
      },
    });

    revalidatePath("/business/usage");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not update usage pricing.",
    };
  }
}
