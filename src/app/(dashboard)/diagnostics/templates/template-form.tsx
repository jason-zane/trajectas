"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  createDiagnosticTemplate,
  updateDiagnosticTemplate,
  deleteDiagnosticTemplate,
} from "@/app/actions/diagnostics";

interface TemplateFormProps {
  mode: "create" | "edit";
  templateId?: string;
  initialData?: {
    name: string;
    description?: string;
    isActive: boolean;
  };
}

export function TemplateForm({
  mode,
  templateId,
  initialData,
}: TemplateFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    const result =
      mode === "edit" && templateId
        ? await updateDiagnosticTemplate(templateId, formData)
        : await createDiagnosticTemplate(formData);

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
    if (!templateId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    await deleteDiagnosticTemplate(templateId);
  }

  const title =
    mode === "create" ? "Create Template" : "Edit Template";
  const subtitle =
    mode === "create"
      ? "Define a reusable diagnostic template that determines which dimensions are measured."
      : `Update the details for \u201c${initialData?.name}\u201d.`;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <Breadcrumbs className="mb-4" />
        <PageHeader title={title} description={subtitle} />
      </div>

      <form action={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
            <CardDescription>
              {mode === "create"
                ? "Provide the basic information for this template."
                : "Update the information for this template."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                name="name"
                placeholder="e.g. Leadership 360"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                A clear name that describes the purpose of this diagnostic
                template.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                name="description"
                placeholder="Describe what this diagnostic template measures and when it should be used..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-24"
              />
              <p className="text-xs text-muted-foreground">
                A rich description that explains the purpose, scope, and
                intended audience.
              </p>
            </div>

            {mode === "edit" && (
              <>
                <Separator />

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="template-active">Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Inactive templates cannot be used for new sessions.
                    </p>
                  </div>
                  <Switch
                    id="template-active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
              </>
            )}

            <input
              type="hidden"
              name="isActive"
              value={isActive ? "true" : "false"}
            />
          </CardContent>
        </Card>

        <div
          className={`sticky bottom-0 flex items-center ${mode === "edit" ? "justify-between" : "justify-end"} gap-3 py-4 mt-6 bg-background/80 backdrop-blur-sm -mx-4 px-4 border-t border-border/50`}
        >
          {mode === "edit" && templateId && (
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
                : "Delete Template"}
            </Button>
          )}
          <div className="flex items-center gap-3">
            <Link href="/diagnostics/templates">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending
                ? mode === "create"
                  ? "Creating..."
                  : "Saving..."
                : mode === "create"
                  ? "Create Template"
                  : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
