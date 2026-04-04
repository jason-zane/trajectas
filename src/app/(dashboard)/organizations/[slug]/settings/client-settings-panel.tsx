"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleClientBranding } from "@/app/actions/client-entitlements";

interface ClientSettingsPanelProps {
  organizationId: string;
  canCustomizeBranding: boolean;
}

export function ClientSettingsPanel({
  organizationId,
  canCustomizeBranding: initialValue,
}: ClientSettingsPanelProps) {
  const router = useRouter();
  const [canCustomizeBranding, setCanCustomizeBranding] =
    useState(initialValue);
  const [isPending, startTransition] = useTransition();

  function handleBrandingToggle(checked: boolean) {
    setCanCustomizeBranding(checked); // optimistic
    startTransition(async () => {
      const result = await toggleClientBranding(organizationId, checked);
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
              Allow this client to customise their own brand settings in their
              portal
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
        Even when disabled, you can still configure branding for this client on
        the Branding tab.
      </p>
    </div>
  );
}
