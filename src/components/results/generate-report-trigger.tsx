"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GenerateReportDialog,
  type GenerateReportDialogTemplate,
} from "./generate-report-dialog";

interface GenerateReportTriggerProps {
  sessionId: string;
  templates: GenerateReportDialogTemplate[];
}

export function GenerateReportTrigger({
  sessionId,
  templates,
}: GenerateReportTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <FileText className="size-4" />
        Generate Report
      </Button>
      <GenerateReportDialog
        sessionId={sessionId}
        templates={templates}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
