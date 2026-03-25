"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/page-header";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  createAssessment,
  updateAssessment,
  deleteAssessment,
} from "@/app/actions/assessments";
import type { Assessment } from "@/types/database";

interface AssessmentFormProps {
  assessment?: Assessment;
  organizations: { id: string; name: string }[];
}

export function AssessmentForm({
  assessment,
  organizations,
}: AssessmentFormProps) {
  const isEditing = !!assessment;

  const [title, setTitle] = useState(assessment?.title ?? "");
  const [description, setDescription] = useState(
    assessment?.description ?? ""
  );
  const [organizationId, setOrganizationId] = useState(
    assessment?.organizationId ?? ""
  );
  const [scoringMethod, setScoringMethod] = useState(
    assessment?.scoringMethod ?? "ctt"
  );
  const [itemSelectionStrategy, setItemSelectionStrategy] = useState(
    assessment?.itemSelectionStrategy ?? "fixed"
  );
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(
    assessment?.timeLimitMinutes?.toString() ?? ""
  );
  const [creationMode, setCreationMode] = useState(
    assessment?.creationMode ?? "manual"
  );
  const [status, setStatus] = useState(assessment?.status ?? "draft");
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    const result = isEditing
      ? await updateAssessment(assessment.id, formData)
      : await createAssessment(formData);

    if (result?.error) {
      const errors = result.error;
      const msg =
        typeof errors === "object" && "_form" in errors
          ? (errors as Record<string, string[]>)._form?.[0]
          : Object.values(errors).flat().join(", ");
      setError(msg ?? "Validation failed");
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!assessment) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    await deleteAssessment(assessment.id);
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <Breadcrumbs className="mb-4" />
        <PageHeader
          title={isEditing ? "Edit Assessment" : "Create Assessment"}
          description={
            isEditing
              ? `Update the details for \u201c${assessment.title}\u201d.`
              : "Configure a new psychometric assessment instrument."
          }
        />
      </div>

      <form action={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Assessment Details</CardTitle>
            <CardDescription>
              {isEditing
                ? "Update the information for this assessment."
                : "Provide the basic information for this assessment. You can add competencies after creation."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                placeholder="e.g. Leadership Potential Assessment"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                A clear, descriptive title for this assessment.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe the purpose and scope of this assessment..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-24"
              />
              <p className="text-xs text-muted-foreground">
                A rich description explaining the assessment&apos;s purpose and
                target audience.
              </p>
            </div>

            {/* Organisation */}
            <div className="space-y-2">
              <Label htmlFor="organizationId">Organisation</Label>
              <Select
                value={organizationId}
                onValueChange={(v) => v !== null && setOrganizationId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an organisation">
                    {(value: string) =>
                      organizations.find((o) => o.id === value)?.name ?? value
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="organizationId" value={organizationId} />
              <p className="text-xs text-muted-foreground">
                The organisation this assessment belongs to.
              </p>
            </div>

            <Separator />

            {/* Scoring Method */}
            <div className="space-y-2">
              <Label htmlFor="scoringMethod">Scoring Method</Label>
              <Select
                value={scoringMethod}
                onValueChange={(v) => v !== null && setScoringMethod(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select scoring method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ctt">CTT (Classical Test Theory)</SelectItem>
                  <SelectItem value="irt">IRT (Item Response Theory)</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="scoringMethod" value={scoringMethod} />
              <p className="text-xs text-muted-foreground">
                Algorithm used to convert responses into scores.
              </p>
            </div>

            {/* Item Selection Strategy */}
            <div className="space-y-2">
              <Label htmlFor="itemSelectionStrategy">
                Item Selection Strategy
              </Label>
              <Select
                value={itemSelectionStrategy}
                onValueChange={(v) => v !== null && setItemSelectionStrategy(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="rule_based">Rule-based</SelectItem>
                  <SelectItem value="cat">CAT (Adaptive)</SelectItem>
                </SelectContent>
              </Select>
              <input
                type="hidden"
                name="itemSelectionStrategy"
                value={itemSelectionStrategy}
              />
              <p className="text-xs text-muted-foreground">
                How items are selected for candidates during the assessment.
              </p>
            </div>

            {/* Time Limit */}
            <div className="space-y-2">
              <Label htmlFor="timeLimitMinutes">
                Time Limit (minutes)
              </Label>
              <Input
                id="timeLimitMinutes"
                name="timeLimitMinutes"
                type="number"
                min={0}
                placeholder="Leave empty for unlimited"
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Maximum time allowed in minutes. Leave empty for no time limit.
              </p>
            </div>

            {/* Creation Mode */}
            <div className="space-y-2">
              <Label htmlFor="creationMode">Creation Mode</Label>
              <Select
                value={creationMode}
                onValueChange={(v) => v !== null && setCreationMode(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select creation mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="ai_generated">AI Generated</SelectItem>
                  <SelectItem value="org_choice">Org Choice</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="creationMode" value={creationMode} />
              <p className="text-xs text-muted-foreground">
                How the assessment content was or will be created.
              </p>
            </div>

            {/* Status (visible in edit mode) */}
            {isEditing && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(v) => v !== null && setStatus(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="status" value={status} />
                  <p className="text-xs text-muted-foreground">
                    Only active assessments can be delivered to candidates.
                  </p>
                </div>
              </>
            )}

            {/* Hidden status for create mode */}
            {!isEditing && (
              <input type="hidden" name="status" value="draft" />
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div
          className={`flex items-center ${isEditing ? "justify-between" : "justify-end"} mt-8`}
        >
          {isEditing && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="size-4" />
              {confirmDelete
                ? deleting
                  ? "Deleting..."
                  : "Confirm Delete"
                : "Delete Assessment"}
            </Button>
          )}
          <div className="flex items-center gap-3">
            <Link href="/assessments">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={!title.trim() || !organizationId || pending}
            >
              {pending
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Assessment"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
