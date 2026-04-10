"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateReportSnapshot } from "@/app/actions/reports";

export type GenerateReportDialogTemplate = {
  id: string;
  name: string;
  description?: string;
};

interface GenerateReportDialogProps {
  sessionId: string;
  templates: GenerateReportDialogTemplate[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AudienceType = "participant" | "hr_manager" | "consultant";
type NarrativeMode = "derived" | "ai_enhanced";

export function GenerateReportDialog({
  sessionId,
  templates,
  open,
  onOpenChange,
}: GenerateReportDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [templateId, setTemplateId] = useState<string>("");
  const [audienceType, setAudienceType] = useState<AudienceType>("participant");
  const [narrativeMode, setNarrativeMode] = useState<NarrativeMode>("derived");

  function handleSubmit() {
    if (!templateId) {
      toast.error("Please choose a template");
      return;
    }

    startTransition(async () => {
      const result = await generateReportSnapshot({
        sessionId,
        templateId,
        audienceType,
        narrativeMode,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Report generation queued");
      onOpenChange(false);
      router.refresh();
      setTemplateId("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate report</DialogTitle>
          <DialogDescription>
            Pick a template and audience. The report will appear in the Reports tab once generated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
            <Select
              value={templateId}
              onValueChange={(v) => setTemplateId(v ?? "")}
            >
              <SelectTrigger id="template">
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audience">Audience</Label>
            <Select
              value={audienceType}
              onValueChange={(v) => setAudienceType((v ?? "participant") as AudienceType)}
            >
              <SelectTrigger id="audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="participant">Participant</SelectItem>
                <SelectItem value="hr_manager">HR Manager</SelectItem>
                <SelectItem value="consultant">Consultant</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="narrative">Narrative mode</Label>
            <Select
              value={narrativeMode}
              onValueChange={(v) => setNarrativeMode((v ?? "derived") as NarrativeMode)}
            >
              <SelectTrigger id="narrative">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="derived">Derived (template defaults)</SelectItem>
                <SelectItem value="ai_enhanced">AI-enhanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !templateId}>
            {isPending ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
