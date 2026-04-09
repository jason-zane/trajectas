"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  updateClient,
  deleteClient,
  restoreClient,
} from "@/app/actions/clients";
import type { Client } from "@/types/database";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type SaveState = "idle" | "saving" | "saved";
const PLATFORM_OWNED_VALUE = "__platform__";

function formatOwnershipDisplay(
  value: string | null,
  partners: Array<{ id: string; name: string }>
): string {
  if (!value || value === PLATFORM_OWNED_VALUE) {
    return "Trajectas (platform-owned)";
  }
  const partner = partners.find((p) => p.id === value);
  return partner?.name ?? "Unknown";
}

export function ClientDetailsForm({
  client,
  partnerOptions = [],
  canAssignPartner = false,
}: {
  client: Client;
  partnerOptions?: Array<{ id: string; name: string }>;
  canAssignPartner?: boolean;
}) {
  const router = useRouter();

  const [name, setName] = useState(client.name);
  const [slug, setSlug] = useState(client.slug);
  const [slugTouched, setSlugTouched] = useState(true);
  const [industry, setIndustry] = useState(client.industry ?? "");
  const [sizeRange, setSizeRange] = useState(client.sizeRange ?? "");
  const [partnerId, setPartnerId] = useState(
    client.partnerId ?? PLATFORM_OWNED_VALUE
  );
  const [isActive, setIsActive] = useState(client.isActive);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = saveState === "saving";

  const [initialState, setInitialState] = useState(() => ({
    name: client.name,
    slug: client.slug,
    industry: client.industry ?? "",
    sizeRange: client.sizeRange ?? "",
    partnerId: client.partnerId ?? PLATFORM_OWNED_VALUE,
  }));

  const isDirty =
    name !== initialState.name ||
    slug !== initialState.slug ||
    industry !== initialState.industry ||
    sizeRange !== initialState.sizeRange ||
    partnerId !== initialState.partnerId;

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

  // --- Build FormData helper ---
  function buildFormData(
    overrides: Partial<{
      name: string;
      slug: string;
      industry: string;
      sizeRange: string;
      partnerId: string;
      isActive: boolean;
    }>
  ) {
    const fd = new FormData();
    fd.set("name", overrides.name ?? name);
    fd.set("slug", overrides.slug ?? slug);
    fd.set("industry", overrides.industry ?? industry);
    fd.set("sizeRange", overrides.sizeRange ?? sizeRange);
    const pid = overrides.partnerId ?? partnerId;
    fd.set("partnerId", pid === PLATFORM_OWNED_VALUE ? "" : pid);
    fd.set("isActive", String(overrides.isActive ?? isActive));
    return fd;
  }

  // --- Zone 2: explicit save for structural fields ---
  async function handleSubmit(formData: FormData) {
    setSaveState("saving");
    setError(null);

    // Ensure partnerId is correctly set
    formData.set(
      "partnerId",
      partnerId === PLATFORM_OWNED_VALUE ? "" : partnerId
    );

    const result = await updateClient(client.id, formData);
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
      setInitialState({ name, slug, industry, sizeRange, partnerId });
      if (result.slug !== client.slug) {
        router.replace(`/clients/${result.slug}/details`, { scroll: false });
      }
    }
  }

  // --- Zone 1: immediate toggle for active ---
  async function handleToggleActive(checked: boolean) {
    setIsActive(checked);
    const fd = buildFormData({ isActive: checked });
    const result = await updateClient(client.id, fd);
    if (result && "error" in result) {
      setIsActive(!checked);
      toast.error("Failed to update status");
    } else {
      toast.success(checked ? "Client activated" : "Client deactivated");
    }
  }

  // --- Delete / Restore ---
  async function handleDelete() {
    if (client.deletedAt) {
      setDeleting(true);
      const result = await restoreClient(client.id);
      if (result && "error" in result) {
        toast.error(
          typeof result.error === "string" ? result.error : "Failed to restore"
        );
        setDeleting(false);
        return;
      }
      toast.success("Client restored");
      router.refresh();
      setDeleting(false);
      return;
    }

    setDeleting(true);
    setShowDeleteDialog(false);
    const result = await deleteClient(client.id);
    if (result && "error" in result) {
      toast.error(
        typeof result.error === "string" ? result.error : "Failed to archive"
      );
      setDeleting(false);
      return;
    }

    let undone = false;
    const timer = setTimeout(() => {
      if (!undone) router.push("/directory?tab=clients");
    }, 5000);

    toast.success("Client archived", {
      action: {
        label: "Undo",
        onClick: async () => {
          undone = true;
          clearTimeout(timer);
          await restoreClient(client.id);
          toast.success("Client restored");
          setDeleting(false);
        },
      },
      duration: 5000,
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {client.deletedAt ? (
        <p className="text-xs font-medium text-destructive">
          This client is currently archived.
        </p>
      ) : null}

      {/* ── Profile Card (Zone 2) ── */}
      <form action={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Core client identity and classification.
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
                placeholder="e.g. Acme Corporation"
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
                placeholder="acme-corporation"
                value={slug}
                onChange={handleSlugChange}
                required
              />
              <p className="text-xs text-muted-foreground">
                URL-safe identifier.
              </p>
            </div>

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

            {/* ── Ownership section ── */}
            {canAssignPartner ? (
              <div className="space-y-2">
                <Label htmlFor="partnerId">Ownership</Label>
                <Select
                  value={partnerId}
                  onValueChange={(value) =>
                    setPartnerId(value ?? PLATFORM_OWNED_VALUE)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {formatOwnershipDisplay(partnerId, partnerOptions)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PLATFORM_OWNED_VALUE}>
                      Trajectas (platform-owned)
                    </SelectItem>
                    {partnerOptions.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Platform-owned clients can be assigned to a partner later.
                </p>
              </div>
            ) : client.partnerId ? (
              <div className="space-y-2">
                <Label>Ownership</Label>
                <p className="text-sm text-muted-foreground">
                  Managed by{" "}
                  <Link
                    href={`/partners`}
                    className="text-primary underline underline-offset-4 hover:text-primary/80"
                  >
                    partner organisation
                  </Link>
                </p>
              </div>
            ) : null}

            {/* Hidden inputs for form submission */}
            <input
              type="hidden"
              name="partnerId"
              value={partnerId === PLATFORM_OWNED_VALUE ? "" : partnerId}
            />
            <input
              type="hidden"
              name="isActive"
              value={isActive ? "true" : "false"}
            />

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={!name.trim() || pending}>
                {pending
                  ? "Saving..."
                  : saveState === "saved"
                    ? "Saved"
                    : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* ── Danger Zone Card ── */}
      <Card className="border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <CardTitle>Danger Zone</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="active">Active</Label>
              <p className="text-xs text-muted-foreground">
                Inactive clients are hidden from assessments and campaigns.
              </p>
            </div>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={handleToggleActive}
            />
          </div>

          <div className="border-t pt-4">
            {client.deletedAt ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                Restore Client
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
                Archive Client
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Dialogs ── */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Archive Client"
        description={`This will archive "${client.name}". You can undo this action for a few seconds after archiving.`}
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
