"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, Loader2, RotateCcw, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { createPromptVersion, activatePromptVersion, type PromptVersionRow } from "@/app/actions/prompts"
import type { AIPromptPurpose } from "@/types/database"

interface PromptDetailEditorProps {
  purpose: AIPromptPurpose
  label: string
  versions: PromptVersionRow[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function PromptDetailEditor({
  purpose,
  label,
  versions,
}: PromptDetailEditorProps) {
  const router = useRouter()
  const activeVersion = versions.find((v) => v.isActive)
  const activeContent = activeVersion?.content ?? ""

  const [draft, setDraft] = useState(activeContent)
  const [persistedDraft, setPersistedDraft] = useState(activeContent)
  const [isPending, startTransition] = useTransition()
  const [activatingId, setActivatingId] = useState<string | null>(null)

  const isDirty = draft.trim() !== persistedDraft.trim()

  function handleSave() {
    startTransition(async () => {
      const result = await createPromptVersion(purpose, draft, activeVersion?.name)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setPersistedDraft(draft)
      toast.success(`${label} prompt saved as new active version`)
      router.refresh()
    })
  }

  function handleActivate(versionId: string, version: number) {
    setActivatingId(versionId)
    startTransition(async () => {
      const result = await activatePromptVersion(purpose, versionId)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        const activated = versions.find((v) => v.id === versionId)
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
    toast.success("Restored to editor — save to activate")
  }

  return (
    <div className="space-y-6">
      {/* Editor */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">System Prompt</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeVersion
                  ? `Currently on v${activeVersion.version}`
                  : "No active version — configure below"}
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={!draft.trim() || !isDirty || isPending}
              size="sm"
            >
              {isPending && !activatingId ? (
                <>
                  <Loader2 className="size-3 animate-spin mr-1.5" />
                  Saving...
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
            placeholder={`Configure the ${label.toLowerCase()} system prompt...`}
            className="min-h-64 font-mono text-xs leading-relaxed"
          />
          {isDirty && (
            <p className="text-xs text-amber-500 mt-2">
              Unsaved changes — save to create a new active version.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Version history */}
      <div>
        <h3 className="text-sm font-semibold mb-3">
          Version History
          <span className="ml-1.5 text-muted-foreground font-normal">
            ({versions.length})
          </span>
        </h3>

        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No versions yet. Save a prompt above to create the first version.</p>
        ) : (
          <div className="space-y-2">
            {versions.map((version) => (
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
                      className={version.isActive ? "border-primary/30 text-primary" : ""}
                    >
                      v{version.version}
                    </Badge>
                    {version.isActive && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20" variant="outline">
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
                          disabled={isPending}
                        >
                          <RotateCcw className="size-3 mr-1" />
                          Restore to editor
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => handleActivate(version.id, version.version)}
                          disabled={isPending}
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
    </div>
  )
}
