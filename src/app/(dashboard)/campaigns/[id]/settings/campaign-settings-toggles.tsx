"use client";

import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toggleCampaignSetting } from "@/app/actions/campaigns";

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`pointer-events-none inline-block size-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export function CampaignSettingsToggles({
  campaignId,
  allowResume,
  showProgress,
  randomizeAssessmentOrder,
}: {
  campaignId: string;
  allowResume: boolean;
  showProgress: boolean;
  randomizeAssessmentOrder: boolean;
}) {
  async function handleToggle(field: string, value: boolean) {
    const result = await toggleCampaignSetting(campaignId, field, value);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Setting updated`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidate Experience</CardTitle>
        <CardDescription>
          Controls how candidates interact with the campaign.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Toggle
          label="Allow Resume"
          description="Candidates can leave and return to continue where they left off."
          checked={allowResume}
          onChange={(v) => handleToggle("allow_resume", v)}
        />
        <Toggle
          label="Show Progress"
          description="Display a progress bar during the assessment."
          checked={showProgress}
          onChange={(v) => handleToggle("show_progress", v)}
        />
        <Toggle
          label="Randomize Assessment Order"
          description="Present assessments in a random order to each candidate."
          checked={randomizeAssessmentOrder}
          onChange={(v) => handleToggle("randomize_assessment_order", v)}
        />
      </CardContent>
    </Card>
  );
}
