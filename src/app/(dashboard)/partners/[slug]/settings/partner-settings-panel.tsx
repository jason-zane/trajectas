"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { togglePartnerBranding } from "@/app/actions/partner-entitlements";
import {
  getPartnerBandScheme,
  updatePartnerBandScheme,
} from "@/app/actions/partners";
import { getPlatformBandScheme } from "@/app/actions/platform-settings";
import { BandSchemeEditor } from "@/components/band-scheme-editor/band-scheme-editor";
import { SchemePreview } from "@/components/band-scheme-editor/scheme-preview";
import { DEFAULT_3_BAND_SCHEME, type BandScheme } from "@/lib/reports/band-scheme";

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
  const [canCustomizeBranding, setCanCustomizeBranding] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  function handleBrandingToggle(checked: boolean) {
    setCanCustomizeBranding(checked);
    startTransition(async () => {
      const result = await togglePartnerBranding(partnerId, checked);
      if ("error" in result) {
        setCanCustomizeBranding(!checked);
        toast.error(result.error);
        return;
      }
      toast.success(
        checked ? "Custom branding enabled" : "Custom branding disabled",
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

      <BandSchemeSection partnerId={partnerId} />

      <p className="text-sm text-muted-foreground">
        Even when disabled, you can still configure branding for this partner on
        the Branding tab.
      </p>
    </div>
  );
}

function BandSchemeSection({ partnerId }: { partnerId: string }) {
  const [partnerScheme, setPartnerScheme] = useState<BandScheme | null>(null);
  const [platformScheme, setPlatformScheme] = useState<BandScheme | null>(null);
  const [mode, setMode] = useState<"inherit" | "override">("inherit");
  const [draft, setDraft] = useState<BandScheme | null>(null);
  const [isValid, setIsValid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getPartnerBandScheme(partnerId), getPlatformBandScheme()]).then(
      ([p, plat]) => {
        setPartnerScheme(p);
        setPlatformScheme(plat ?? DEFAULT_3_BAND_SCHEME);
        setMode(p ? "override" : "inherit");
        setLoaded(true);
      },
    );
  }, [partnerId]);

  async function handleSave() {
    setSaving(true);
    const scheme = mode === "inherit" ? null : draft;
    const result = await updatePartnerBandScheme(partnerId, scheme);
    setSaving(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    setPartnerScheme(scheme);
    toast.success("Band scheme saved");
  }

  if (!loaded || !platformScheme) {
    return (
      <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-foreground/[0.06]">
        <p className="text-sm text-muted-foreground">Loading band scheme…</p>
      </div>
    );
  }

  const inherited = platformScheme;
  const current = partnerScheme ?? inherited;

  return (
    <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-foreground/[0.06] space-y-6">
      <div>
        <h2 className="text-section font-semibold">Band Scheme</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The band configuration used in reports for this partner. Inherits from
          the platform default unless overridden.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={mode === "inherit"}
            onChange={() => setMode("inherit")}
          />
          Use platform default
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={mode === "override"}
            onChange={() => setMode("override")}
          />
          Override
        </label>
      </div>

      {mode === "inherit" ? (
        <SchemePreview scheme={inherited} />
      ) : (
        <BandSchemeEditor
          initial={current}
          onChange={(s, valid) => {
            setDraft(s);
            setIsValid(valid);
          }}
        />
      )}

      <Button
        onClick={handleSave}
        disabled={saving || (mode === "override" && !isValid)}
      >
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
