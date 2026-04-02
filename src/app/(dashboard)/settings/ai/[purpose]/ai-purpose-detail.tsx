"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  Check,
  Clock,
  Loader2,
  RotateCcw,
  Settings2,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ModelPickerCombobox } from "@/app/(dashboard)/settings/models/model-picker-combobox"
import { updateModelForPurpose } from "@/app/actions/model-config"
import {
  createPromptVersion,
  activatePromptVersion,
  type PromptVersionRow,
} from "@/app/actions/prompts"
import type { ModelConfigRow } from "@/app/actions/model-config"
import { PURPOSE_META } from "@/lib/ai/purpose-meta"
import type { AIPromptPurpose } from "@/types/database"
import type { OpenRouterModel } from "@/types/generation"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AiPurposeDetailProps {
  purpose: AIPromptPurpose
  currentModelConfig: ModelConfigRow | null
  promptVersions: PromptVersionRow[]
  availableModels: OpenRouterModel[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiPurposeDetail({
  purpose,
  currentModelConfig,
  promptVersions,
  availableModels,
}: AiPurposeDetailProps) {
  const router = useRouter()
  const purposeMeta = PURPOSE_META[purpose]
  const Icon = purposeMeta.icon
  const isEmbedding = purpose === "embedding"

  // ---- Model section state ----
  const [selectedModel, setSelectedModel] = useState(
    currentModelConfig?.modelId ?? "",
  )
  const [persistedModel, setPersistedModel] = useState(
    currentModelConfig?.modelId ?? "",
  )
  const [modelSaveState, setModelSaveState] = useState<
    "idle" | "saving" | "saved"
  >("idle")
  const [isModelPending, startModelTransition] = useTransition()
  const [isChangingModel, setIsChangingModel] = useState(!currentModelConfig)
  const isModelDirty = selectedModel !== persistedModel

  // ---- Prompt section state ----
  const activeVersion = promptVersions.find((v) => v.isActive)
  const activeContent = activeVersion?.content ?? ""
  const [draft, setDraft] = useState(activeContent)
  const [persistedDraft, setPersistedDraft] = useState(activeContent)
  const [promptSaveState, setPromptSaveState] = useState<
    "idle" | "saving" | "saved"
  >("idle")
  const [isPromptPending, startPromptTransition] = useTransition()
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const isPromptDirty = draft.trim() !== persistedDraft.trim()

  // ---- Model handlers ----
  function handleModelSave() {
    if (!selectedModel) return
    startModelTransition(async () => {
      setModelSaveState("saving")
      const result = await updateModelForPurpose(purpose, selectedModel)
      if ("error" in result) {
        toast.error(result.error)
        setModelSaveState("idle")
      } else {
        setPersistedModel(selectedModel)
        toast.success(`${purposeMeta.label} model updated`)
        setModelSaveState("saved")
        setIsChangingModel(false)
        router.refresh()
        setTimeout(() => setModelSaveState("idle"), 2000)
      }
    })
  }

  // ---- Prompt handlers ----
  function handlePromptSave() {
    startPromptTransition(async () => {
      setPromptSaveState("saving")
      const result = await createPromptVersion(
        purpose,
        draft,
        activeVersion?.name,
      )
      if ("error" in result) {
        toast.error(result.error)
        setPromptSaveState("idle")
        return
      }
      setPersistedDraft(draft)
      toast.success(`${purposeMeta.label} prompt saved as new active version`)
      setPromptSaveState("saved")
      router.refresh()
      setTimeout(() => setPromptSaveState("idle"), 2000)
    })
  }

  function handleActivate(versionId: string, version: number) {
    setActivatingId(versionId)
    startPromptTransition(async () => {
      const result = await activatePromptVersion(purpose, versionId)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        const activated = promptVersions.find((v) => v.id === versionId)
        if (activated) {
          setDraft(activated.content)
          setPersistedDraft(activated.content)
        }
        toast.success(`Activated v${version}`)
        router.refresh()
      }
      setActivatingId(null)
    })
  }

  function handleRestore(content: string) {
    setDraft(content)
    toast.success("Restored to editor -- save to activate")
  }

  // Find the display name for the currently configured model
  const currentModelDisplayName = currentModelConfig
    ? availableModels.find((m) => m.id === currentModelConfig.modelId)?.name ??
      currentModelConfig.modelId
    : null

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      {/* Back link + header */}
      <div>
        <Link
          href="/settings/ai"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          AI Configuration
        </Link>
        <PageHeader eyebrow="AI Configuration" title={purposeMeta.label}>
          <div
            className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
            style={
              { "--glow-color": purposeMeta.glowColor } as React.CSSProperties
            }
          >
            <Icon className="size-5" />
          </div>
        </PageHeader>
        <p className="text-body text-muted-foreground mt-2 max-w-lg">
          {purposeMeta.description}
        </p>
      </div>

      {/* Model section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="size-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Model</p>
            </div>
            {currentModelConfig && !isChangingModel && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsChangingModel(true)}
              >
                Change
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isChangingModel ? (
            <div className="flex flex-col gap-3">
              <ModelPickerCombobox
                value={selectedModel}
                onChange={setSelectedModel}
                models={availableModels}
                disabled={isModelPending}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-caption text-muted-foreground">
                  {currentModelConfig
                    ? `Currently: ${currentModelDisplayName}`
                    : "No model configured yet"}
                </p>
                <div className="flex items-center gap-2">
                  {currentModelConfig && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedModel(persistedModel)
                        setIsChangingModel(false)
                      }}
                      disabled={isModelPending}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleModelSave}
                    disabled={
                      !selectedModel ||
                      !isModelDirty ||
                      isModelPending ||
                      modelSaveState === "saved"
                    }
                  >
                    {isModelPending || modelSaveState === "saving" ? (
                      <>
                        <Loader2 className="size-3 animate-spin mr-1.5" />
                        Saving...
                      </>
                    ) : modelSaveState === "saved" ? (
                      <>
                        <Check className="size-3 mr-1.5" />
                        Saved
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">
                  {currentModelDisplayName ?? "Not configured"}
                </p>
                {currentModelConfig && (
                  <p className="text-caption text-muted-foreground">
                    via {currentModelConfig.providerName}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System prompt section */}
      {isEmbedding ? (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  No system prompt for embeddings
                </p>
                <p className="text-caption text-muted-foreground mt-1">
                  Embedding models convert text into vector representations. They
                  do not accept a system prompt -- only the input text to embed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Prompt editor */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">System Prompt</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeVersion
                      ? `Currently on v${activeVersion.version}`
                      : "No active version -- configure below"}
                  </p>
                </div>
                <Button
                  onClick={handlePromptSave}
                  disabled={
                    !draft.trim() ||
                    !isPromptDirty ||
                    isPromptPending ||
                    promptSaveState === "saved"
                  }
                  size="sm"
                >
                  {promptSaveState === "saving" ? (
                    <>
                      <Loader2 className="size-3 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : promptSaveState === "saved" ? (
                    <>
                      <Check className="size-3 mr-1.5" />
                      Saved
                    </>
                  ) : (
                    "Save as new version"
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Configure the ${purposeMeta.label.toLowerCase()} system prompt...`}
                className="min-h-64 font-mono text-xs leading-relaxed"
              />
              {isPromptDirty && (
                <p className="text-xs text-amber-500 mt-2">
                  Unsaved changes -- save to create a new active version.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Version history */}
          <div>
            <h3 className="text-sm font-semibold mb-3">
              Version History
              <span className="ml-1.5 text-muted-foreground font-normal">
                ({promptVersions.length})
              </span>
            </h3>

            {promptVersions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No versions yet. Save a prompt above to create the first
                version.
              </p>
            ) : (
              <div className="space-y-2">
                {promptVersions.map((version) => (
                  <div
                    key={version.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      version.isActive
                        ? "border-primary/30 bg-primary/[0.03]"
                        : "border-border bg-card hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge
                          variant="outline"
                          className={
                            version.isActive
                              ? "border-primary/30 text-primary"
                              : ""
                          }
                        >
                          v{version.version}
                        </Badge>
                        {version.isActive && (
                          <Badge
                            className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            variant="outline"
                          >
                            <Check className="size-3 mr-1" />
                            Active
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatDate(version.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!version.isActive && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => handleRestore(version.content)}
                              disabled={isPromptPending}
                            >
                              <RotateCcw className="size-3 mr-1" />
                              Restore to editor
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() =>
                                handleActivate(version.id, version.version)
                              }
                              disabled={isPromptPending}
                            >
                              {activatingId === version.id ? (
                                <Loader2 className="size-3 animate-spin mr-1" />
                              ) : (
                                <Check className="size-3 mr-1" />
                              )}
                              Activate
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <pre className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4 leading-relaxed">
                      {version.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
