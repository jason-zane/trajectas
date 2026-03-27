"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  GripVertical,
  Trash2,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addAssessmentToCampaign,
  removeAssessmentFromCampaign,
} from "@/app/actions/campaigns";

type LinkedAssessment = {
  id: string;
  campaignId: string;
  assessmentId: string;
  displayOrder: number;
  isRequired: boolean;
  assessmentTitle: string;
  assessmentStatus: string;
  created_at: string;
};

type AvailableAssessment = {
  id: string;
  title: string;
  status: string;
};

export function CampaignAssessmentsList({
  campaignId,
  linkedAssessments,
  allAssessments,
}: {
  campaignId: string;
  linkedAssessments: LinkedAssessment[];
  allAssessments: AvailableAssessment[];
}) {
  const [showPicker, setShowPicker] = useState(false);

  const linkedIds = new Set(linkedAssessments.map((a) => a.assessmentId));
  const available = allAssessments.filter((a) => !linkedIds.has(a.id));

  async function handleAdd(assessmentId: string) {
    const result = await addAssessmentToCampaign(campaignId, assessmentId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Assessment added");
    setShowPicker(false);
  }

  async function handleRemove(assessmentId: string) {
    const result = await removeAssessmentFromCampaign(
      campaignId,
      assessmentId,
    );
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Assessment removed");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {linkedAssessments.length}{" "}
          {linkedAssessments.length === 1 ? "assessment" : "assessments"}
        </h3>
        <Button size="sm" onClick={() => setShowPicker(true)}>
          <Plus className="size-4" />
          Add Assessment
        </Button>
      </div>

      {linkedAssessments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No assessments linked yet. Add assessments to include them in this
            campaign.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {linkedAssessments.map((la, index) => (
            <Card key={la.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <GripVertical className="size-4 text-muted-foreground/50 cursor-grab" />
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                  <ClipboardList className="size-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {la.assessmentTitle}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px]">
                      {la.assessmentStatus}
                    </Badge>
                    {la.isRequired && (
                      <span className="text-[10px] text-muted-foreground">
                        Required
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  #{index + 1}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(la.assessmentId)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Picker dialog */}
      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Assessment</DialogTitle>
          </DialogHeader>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              All active assessments are already linked.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {available.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleAdd(a.id)}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                    <ClipboardList className="size-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{a.title}</span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
