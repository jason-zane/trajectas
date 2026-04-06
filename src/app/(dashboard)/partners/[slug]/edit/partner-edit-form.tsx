"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { deletePartner, restorePartner, updatePartner } from "@/app/actions/partners";
import type { Partner } from "@/types/database";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type SaveState = "idle" | "saving" | "saved";

export function PartnerEditForm({ partner }: { partner: Partner }) {
  const router = useRouter();
  const [name, setName] = useState(partner.name);
  const [slug, setSlug] = useState(partner.slug);
  const [slugTouched, setSlugTouched] = useState(true);
  const [isActive, setIsActive] = useState(partner.isActive);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = saveState === "saving";
  const [initialState, setInitialState] = useState(() => ({
    name: partner.name,
    slug: partner.slug,
    isActive: partner.isActive,
  }));

  const isDirty =
    name !== initialState.name ||
    slug !== initialState.slug ||
    isActive !== initialState.isActive;

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
    const result = await updatePartner(partner.id, formData);
    if (result?.error) {
      const errors = result.error;
      const msg =
        typeof errors === "object" && "_form" in errors
          ? (errors as Record<string, string[]>)._form?.[0]
          : Object.values(errors).flat().join(", ");
      setError(msg ?? "Validation failed");
      setSaveState("idle");
      return;
    }

    if (result && "success" in result) {
      toast.success("Changes saved");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
      setInitialState({ name, slug, isActive });
      if (result.slug !== partner.slug) {
        router.replace(`/partners/${result.slug}/overview`, { scroll: false });
      }
    }
  }

  async function handleDelete() {
    if (partner.deletedAt) {
      setDeleting(true);
      const result = await restorePartner(partner.id);
      if (result && "error" in result) {
        toast.error(
          typeof result.error === "string" ? result.error : "Failed to restore"
        );
        setDeleting(false);
        return;
      }

      toast.success("Partner restored");
      router.refresh();
      setDeleting(false);
      return;
    }

    setDeleting(true);
    setShowDeleteDialog(false);
    const result = await deletePartner(partner.id);
    if (result && "error" in result) {
      toast.error(
        typeof result.error === "string" ? result.error : "Failed to archive"
      );
      setDeleting(false);
      return;
    }

    let undone = false;
    const timer = setTimeout(() => {
      if (!undone) router.push("/directory?tab=partners");
    }, 5000);

    toast.success("Partner archived", {
      action: {
        label: "Undo",
        onClick: async () => {
          undone = true;
          clearTimeout(timer);
          await restorePartner(partner.id);
          toast.success("Partner restored");
          setDeleting(false);
        },
      },
      duration: 5000,
    });
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {partner.deletedAt ? (
        <p className="text-xs font-medium text-destructive">
          This partner is currently archived.
        </p>
      ) : null}

      <form action={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Partner Details</CardTitle>
            <CardDescription>
              Update the information for this partner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={handleNameChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                name="slug"
                value={slug}
                onChange={handleSlugChange}
                required
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive partners cannot be assigned new clients.
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

        <div className="mt-8 flex items-center justify-between">
          {partner.deletedAt ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              Restore Partner
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleting}
            >
              <Trash2 className="size-4" />
              Archive Partner
            </Button>
          )}
          <div className="flex items-center gap-3">
            <Link href="/directory?tab=partners">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending ? "Saving..." : saveState === "saved" ? "Saved" : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Archive Partner"
        description={`This will archive "${partner.name}". You can undo this action for a few seconds after archiving.`}
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />

      <ConfirmDialog
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) cancelNavigation();
        }}
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
