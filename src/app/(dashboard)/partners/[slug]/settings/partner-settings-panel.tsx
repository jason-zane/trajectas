"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { togglePartnerBranding } from "@/app/actions/partner-entitlements";

interface PartnerSettingsPanelProps {
  partnerId: string;
  partnerSlug: string;
  canCustomizeBranding: boolean;
}

export function PartnerSettingsPanel({
  partnerId,
  canCustomizeBranding: initialValue,
}: PartnerSettingsPanelProps) {
  const router = useRouter();
  const [canCustomizeBranding, setCanCustomizeBranding] =
    useState(initialValue);
  const [isPending, startTransition] = useTransition();

  function handleBrandingToggle(checked: boolean) {
    setCanCustomizeBranding(checked); // optimistic
    startTransition(async () => {
      const result = await togglePartnerBranding(partnerId, checked);
      if ("error" in result) {
        setCanCustomizeBranding(!checked); // revert
        toast.error(result.error);
        return;
      }
      toast.success(
        checked
          ? "Custom branding enabled"
          : "Custom branding disabled"
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-foreground/[0.06] space-y-6">
        <h2 className="text-section font-semibold">Feature Flags</h2>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Custom Branding</p>
            <p className="text-sm text-muted-foreground">
              Allow this partner and their clients to customise their own brand
              settings.
            </p>
          </div>
          <Switch
            checked={canCustomizeBranding}
            onCheckedChange={handleBrandingToggle}
            disabled={isPending}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Even when disabled, you can still configure branding for this partner on
        the Branding tab.
      </p>
    </div>
  );
}
