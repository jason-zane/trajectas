"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AutoSaveIndicator } from "@/components/auto-save-indicator";
import { SectionCard } from "@/components/section-card";
import { SaveButton, type SaveState } from "@/components/save-button";
import {
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { slugify } from "@/lib/utils";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useAutoSave } from "@/hooks/use-auto-save";
import {
  deletePartner,
  restorePartner,
  updatePartner,
} from "@/app/actions/partners";
import type { Partner } from "@/types/database";

/**
 * Build a minimal FormData from the current partner + overridden fields.
 * Used by auto-save and toggle to call updatePartner without a full form submit.
 */
function buildFormData(
  partner: Partner,
  overrides: Partial<{
    name: string;
    slug: string;
    isActive: boolean;
    description: string;
    website: string;
    contactEmail: string;
    notes: string;
  }>
) {
  const fd = new FormData();
  fd.set("name", overrides.name ?? partner.name);
  fd.set("slug", overrides.slug ?? partner.slug);
  fd.set("isActive", String(overrides.isActive ?? partner.isActive));
  fd.set("description", overrides.description ?? partner.description ?? "");
  fd.set("website", overrides.website ?? partner.website ?? "");
  fd.set("contactEmail", overrides.contactEmail ?? partner.contactEmail ?? "");
  fd.set("notes", overrides.notes ?? partner.notes ?? "");
  return fd;
}

export function PartnerDetailsForm({ partner }: { partner: Partner }) {
  const router = useRouter();
  const [name, setName] = useState(partner.name);
  const [slug, setSlug] = useState(partner.slug);
  const [slugTouched, setSlugTouched] = useState(true);
  const [website, setWebsite] = useState(partner.website ?? "");
  const [contactEmail, setContactEmail] = useState(
    partner.contactEmail ?? ""
  );
  const [isActive, setIsActive] = useState(partner.isActive);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = saveState === "saving";
  const [initialState, setInitialState] = useState(() => ({
    name: partner.name,
    slug: partner.slug,
    website: partner.website ?? "",
    contactEmail: partner.contactEmail ?? "",
  }));

  const isDirty =
    name !== initialState.name ||
    slug !== initialState.slug ||
    website !== initialState.website ||
    contactEmail !== initialState.contactEmail;

  const { showDialog, confirmNavigation, cancelNavigation } =
    useUnsavedChanges(isDirty);

  // --- Auto-save: description ---
  const description = useAutoSave({
    initialValue: partner.description ?? "",
    onSave: async (val) => {
      const fd = buildFormData(partner, { description: val });
      return updatePartner(partner.id, fd);
    },
  });

  // --- Auto-save: notes ---
  const notes = useAutoSave({
    initialValue: partner.notes ?? "",
    onSave: async (val) => {
      const fd = buildFormData(partner, { notes: val });
      return updatePartner(partner.id, fd);
    },
  });

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

  // --- Zone 2: explicit save for name, slug, website, contactEmail ---
  async function handleSubmit(formData: FormData) {
    setSaveState("saving");
    setError(null);

    // Inject current auto-save values so they aren't wiped out
    formData.set("description", description.value);
    formData.set("notes", notes.value);

    const result = await updatePartner(partner.id, formData);
    if (result?.error) {
      const errors = result.error;
      const msg =
        typeof errors === "object" && "_form" in errors
          ? (errors as Record<string, string[]>)._form?.[0]
          : Object.values(errors).flat().join(", ");
      setError(msg ?? "Validation failed");
      setSaveState("error");
      return;
    }

    if (result && "success" in result) {
      toast.success("Changes saved");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
      setInitialState({ name, slug, website, contactEmail });
      if (result.slug !== partner.slug) {
        router.replace(`/partners/${result.slug}/details`, { scroll: false });
      }
    }
  }

  // --- Zone 1: immediate toggle for active ---
  async function handleToggleActive(checked: boolean) {
    setIsActive(checked);
    const fd = buildFormData(partner, {
      isActive: checked,
      description: description.value,
      notes: notes.value,
    });
    const result = await updatePartner(partner.id, fd);
    if (result && "error" in result) {
      setIsActive(!checked);
      toast.error("Failed to update status");
    } else {
      toast.success(checked ? "Partner activated" : "Partner deactivated");
    }
  }

  // --- Delete / Restore ---
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
    <div className="space-y-6 max-w-3xl">
      {partner.deletedAt ? (
        <p className="text-xs font-medium text-destructive">
          This partner is currently archived.
        </p>
      ) : null}

      {/* ── Profile Card (Zone 2 + Zone 3 description) ── */}
      <form action={handleSubmit}>
        <SectionCard
          title="Profile"
          description="Core partner identity and contact information."
          footer={
            <SaveButton
              state={saveState}
              onClick={(e) => {
                e.preventDefault();
                const form = (e.target as HTMLElement).closest("form");
                if (form) {
                  const submitEvent = new Event("submit", { bubbles: true });
                  form.dispatchEvent(submitEvent);
                }
              }}
              disabled={!name.trim()}
            />
          }
        >
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description</Label>
              <AutoSaveIndicator
                status={description.status}
                onRetry={description.retry}
              />
            </div>
            <Textarea
              id="description"
              rows={3}
              placeholder="A brief description of this partner..."
              value={description.value}
              onChange={description.handleChange}
              onBlur={description.handleBlur}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              name="website"
              type="url"
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              placeholder="contact@partner.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>

          {/* Hidden inputs so auto-save fields survive form submission */}
          <input type="hidden" name="isActive" value={String(isActive)} />
          <input
            type="hidden"
            name="description"
            value={description.value}
          />
          <input type="hidden" name="notes" value={notes.value} />
        </SectionCard>
      </form>

      {/* ── Notes Card (Zone 3 auto-save) ── */}
      <SectionCard
        title="Internal Notes"
        description="Notes visible only to platform administrators."
        action={
          <AutoSaveIndicator
            status={notes.status}
            onRetry={notes.retry}
          />
        }
      >
        <Textarea
          id="notes"
          rows={4}
          placeholder="Add internal notes about this partner..."
          value={notes.value}
          onChange={notes.handleChange}
          onBlur={notes.handleBlur}
          className="resize-none"
        />
      </SectionCard>

      {/* ── Danger Zone Card ── */}
      <SectionCard
        title="Danger Zone"
        className="border-destructive/30"
        action={
          <AlertTriangle className="size-4 text-destructive" />
        }
      >
        <div className="space-y-6">
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
              onCheckedChange={handleToggleActive}
            />
          </div>

          <div className="border-t pt-4">
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
          </div>
        </div>
      </SectionCard>

      {/* ── Dialogs ── */}
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
