"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { useAutoSave } from "@/hooks/use-auto-save"
import { AutoSaveIndicator } from "@/components/auto-save-indicator"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  createCampaign,
  updateCampaign,
  deleteCampaign,
  restoreCampaign,
  updateCampaignField,
} from "@/app/actions/campaigns"
import type { Campaign } from "@/types/database"
import type { Client } from "@/types/database"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

interface CampaignFormProps {
  mode: "create" | "edit"
  campaign?: Campaign
  clients?: Client[]
  /** Pre-set org ID (hides the org selector, e.g. client portal) */
  defaultClientId?: string
  /** Route prefix for redirects (e.g. "/client") */
  routePrefix?: string
}

export function CampaignForm({
  mode,
  campaign,
  clients = [],
  defaultClientId,
  routePrefix = "",
}: CampaignFormProps) {
  const router = useRouter()

  // --- Structural fields (Zone 2 — explicit save) ---
  const [title, setTitle] = useState(campaign?.title ?? "")
  const [slug, setSlug] = useState(campaign?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(mode === "edit")
  const [clientId, setClientId] = useState(
    defaultClientId ?? campaign?.clientId ?? "",
  )
  const [opensAt, setOpensAt] = useState(
    campaign?.opensAt ? campaign.opensAt.slice(0, 16) : "",
  )
  const [closesAt, setClosesAt] = useState(
    campaign?.closesAt ? campaign.closesAt.slice(0, 16) : "",
  )

  // --- Create-mode-only local state for description ---
  const [createDescription, setCreateDescription] = useState(
    campaign?.description ?? "",
  )

  // --- Auto-save for description (Zone 3 — edit mode only) ---
  const descriptionAutoSave = useAutoSave({
    initialValue: campaign?.description ?? "",
    onSave: (val) => updateCampaignField(campaign!.id, "description", val),
    enabled: mode === "edit" && !!campaign,
  })

  // --- Save button state ---
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [errors, setErrors] = useState<Record<string, any>>({})

  // --- Dirty check ---
  const isDirty =
    mode === "create"
      ? title.length > 0
      : title !== (campaign?.title ?? "") ||
        slug !== (campaign?.slug ?? "") ||
        clientId !== (campaign?.clientId ?? "") ||
        opensAt !==
          (campaign?.opensAt ? campaign.opensAt.slice(0, 16) : "") ||
        closesAt !==
          (campaign?.closesAt ? campaign.closesAt.slice(0, 16) : "")

  const { showDialog, confirmNavigation, cancelNavigation } =
    useUnsavedChanges(isDirty)

  // --- Submit handler ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})

    const payload = {
      title,
      slug,
      description: mode === "create" ? createDescription : undefined,
      clientId: clientId || undefined,
      opensAt: opensAt ? new Date(opensAt).toISOString() : undefined,
      closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
      allowResume: true,
      showProgress: true,
      randomizeAssessmentOrder: false,
    }

    const result =
      mode === "create"
        ? await createCampaign(payload)
        : await updateCampaign(campaign!.id, payload)

    setSaving(false)

    if ("error" in result && result.error) {
      setErrors(result.error)
      toast.error("Please fix the errors above")
      return
    }

    if (mode === "create") {
      toast.success("Campaign created")
      router.replace(`${routePrefix}/campaigns/${result.id}`)
    } else {
      toast.success("Campaign saved")
      setSaveState("saved")
      setTimeout(() => setSaveState("idle"), 2000)
    }
  }

  // --- Delete ---
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  async function handleDelete() {
    const result = await deleteCampaign(campaign!.id)
    if (result?.error) {
      toast.error(result.error)
      return
    }

    toast.success("Campaign deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          await restoreCampaign(campaign!.id)
          toast.success("Campaign restored")
        },
      },
      duration: 5000,
    })
    router.push(`${routePrefix}/campaigns`)
  }

  const saveLabel =
    saving ? "Saving..." : saveState === "saved" ? "Saved" : "Save Changes"

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
        <PageHeader
          eyebrow="Campaigns"
          title={mode === "create" ? "New Campaign" : campaign!.title}
          description={
            mode === "create"
              ? "Set up a new campaign to deploy assessments to participants."
              : "Edit campaign details."
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
            <CardDescription>
              Core information about this campaign.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (!slugTouched) setSlug(slugify(e.target.value))
                }}
                placeholder="Q2 2026 Leadership Assessment"
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title[0]}</p>
              )}
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setSlugTouched(true)
                }}
                placeholder="q2-2026-leadership"
              />
              {errors.slug && (
                <p className="text-xs text-destructive">{errors.slug[0]}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              {mode === "edit" ? (
                <>
                  <Textarea
                    id="description"
                    value={descriptionAutoSave.value}
                    onChange={descriptionAutoSave.handleChange}
                    onBlur={descriptionAutoSave.handleBlur}
                    placeholder="Campaign purpose and context..."
                    rows={3}
                  />
                  <AutoSaveIndicator
                    status={descriptionAutoSave.status}
                    onRetry={descriptionAutoSave.retry}
                  />
                </>
              ) : (
                <Textarea
                  id="description"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Campaign purpose and context..."
                  rows={3}
                />
              )}
            </div>

            {/* Client */}
            {clients.length > 0 && !defaultClientId && (
              <div className="space-y-1.5">
                <Label htmlFor="clientId">Client</Label>
                <select
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">None (platform-wide)</option>
                  {clients.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Access Window */}
        <Card>
          <CardHeader>
            <CardTitle>Access Window</CardTitle>
            <CardDescription>
              When participants can access the campaign. Leave blank for no
              restrictions.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="opensAt">Opens At</Label>
              <Input
                id="opensAt"
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="closesAt">Closes At</Label>
              <Input
                id="closesAt"
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Form errors */}
        {errors._form && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {errors._form.map((msg: string, i: number) => (
              <p key={i}>{msg}</p>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving || saveState === "saved"}>
            {mode === "create" ? "Create Campaign" : saveLabel}
          </Button>

          {mode === "edit" && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </form>

      {/* Unsaved changes dialog */}
      <ConfirmDialog
        open={showDialog}
        title="Unsaved changes"
        description="You have unsaved changes. Are you sure you want to leave?"
        confirmLabel="Leave"
        onConfirm={confirmNavigation}
        onOpenChange={(open) => { if (!open) cancelNavigation() }}
      />

      {/* Delete confirmation dialog */}
      {mode === "edit" && (
        <ConfirmDialog
          open={showDeleteDialog}
          title="Delete campaign"
          description={`Are you sure you want to delete "${campaign!.title}"? This can be undone.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={handleDelete}
          onOpenChange={setShowDeleteDialog}
        />
      )}
    </>
  )
}
