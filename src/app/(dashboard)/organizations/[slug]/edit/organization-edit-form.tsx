"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  updateOrganization,
  deleteOrganization,
  restoreOrganization,
} from "@/app/actions/organizations";
import type { Organization } from "@/types/database";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type SaveState = "idle" | "saving" | "saved";

export function OrganizationEditForm({ organization }: { organization: Organization }) {
  const router = useRouter();

  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug);
  const [slugTouched, setSlugTouched] = useState(true);
  const [industry, setIndustry] = useState(organization.industry ?? "");
  const [sizeRange, setSizeRange] = useState(organization.sizeRange ?? "");
  const [isActive, setIsActive] = useState(organization.isActive);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = saveState === "saving";

  // --- Structural dirty tracking ---
  const initialStructural = useRef({
    name: organization.name,
    slug: organization.slug,
    industry: organization.industry ?? "",
    sizeRange: organization.sizeRange ?? "",
    isActive: organization.isActive,
  });

  const isDirty =
    name !== initialStructural.current.name ||
    slug !== initialStructural.current.slug ||
    industry !== initialStructural.current.industry ||
    sizeRange !== initialStructural.current.sizeRange ||
    isActive !== initialStructural.current.isActive;

  const { showDialog, confirmNavigation, cancelNavigation } =
    useUnsavedChanges(isDirty);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setName(value);
      if (!slugTouched) {
        setSlug(slugify(value));
      }
    },
    [slugTouched]
  );

  const handleSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSlugTouched(true);
      setSlug(slugify(e.target.value));
    },
    []
  );

  async function handleSubmit(formData: FormData) {
    setSaveState("saving");
    setError(null);
    const result = await updateOrganization(organization.id, formData);
    if (result?.error) {
      const errors = result.error;
      const msg =
        typeof errors === "object" && "_form" in errors
          ? (errors as Record<string, string[]>)._form?.[0]
          : Object.values(errors).flat().join(", ");
      setError(msg ?? "Validation failed");
      setSaveState("idle");
    } else if (result && "success" in result) {
      toast.success("Changes saved");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
      initialStructural.current = { name, slug, industry, sizeRange, isActive };
      if (result.slug !== organization.slug) {
        router.replace(`/organizations/${result.slug}/edit`, { scroll: false });
      }
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setShowDeleteDialog(false);
    const result = await deleteOrganization(organization.id);
    if (result && "error" in result) {
      toast.error(
        typeof result.error === "string" ? result.error : "Failed to delete"
      );
      setDeleting(false);
      return;
    }

    let undone = false;
    const timer = setTimeout(() => {
      if (!undone) router.push("/organizations");
    }, 5000);

    toast.success("Organisation deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          undone = true;
          clearTimeout(timer);
          await restoreOrganization(organization.id);
          toast.success("Organisation restored");
          setDeleting(false);
        },
      },
      duration: 5000,
    });
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <Link
          href="/organizations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="size-3.5" />
          Back to Organisations
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit Organisation
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Update the details for &ldquo;{organization.name}&rdquo;.
        </p>
      </div>

      <Separator />

      {/* Form */}
      <form action={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Organisation Details</CardTitle>
            <CardDescription>
              Update the information for this organisation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Acme Corporation"
                value={name}
                onChange={handleNameChange}
                required
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                name="slug"
                placeholder="acme-corporation"
                value={slug}
                onChange={handleSlugChange}
                required
              />
              <p className="text-xs text-muted-foreground">
                URL-safe identifier.
              </p>
            </div>

            {/* Industry */}
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                name="industry"
                placeholder="e.g. Financial Services"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Optional industry vertical for benchmark grouping.
              </p>
            </div>

            {/* Size Range */}
            <div className="space-y-2">
              <Label htmlFor="sizeRange">Size Range</Label>
              <Input
                id="sizeRange"
                name="sizeRange"
                placeholder="e.g. 50-200"
                value={sizeRange}
                onChange={(e) => setSizeRange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Approximate headcount bracket.
              </p>
            </div>

            <Separator />

            {/* Active toggle */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive organisations are hidden from assessments and diagnostics.
                </p>
              </div>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
            <input
              type="hidden"
              name="isActive"
              value={isActive ? "true" : "false"}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between mt-8">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={deleting}
          >
            <Trash2 className="size-4" />
            Delete Organisation
          </Button>
          <div className="flex items-center gap-3">
            <Link href="/organizations">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending ? "Saving..." : saveState === "saved" ? "Saved" : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Organisation"
        description={`This will soft-delete "${organization.name}". You can undo this action for a few seconds after deletion.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />

      {/* Unsaved changes dialog */}
      <ConfirmDialog
        open={showDialog}
        onOpenChange={(open) => { if (!open) cancelNavigation(); }}
        title="Unsaved changes"
        description="You have unsaved changes. Are you sure you want to leave? Your changes will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={confirmNavigation}
      />
    </div>
  );
}
