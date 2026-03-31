"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  Check,
  Loader2,
  Info,
  ListFilter,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollReveal } from "@/components/scroll-reveal"
import { upsertItemSelectionRules } from "@/app/actions/item-selection-rules"
import type { ItemSelectionRule } from "@/types/database"

type RuleDraft = {
  minConstructs: number
  maxConstructs: number | null
  itemsPerConstruct: number
}

type SaveState = "idle" | "saving" | "saved"

interface RulesEditorProps {
  initialRules: ItemSelectionRule[]
}

export function RulesEditor({ initialRules }: RulesEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [error, setError] = useState<string | null>(null)

  const [rules, setRules] = useState<RuleDraft[]>(() =>
    initialRules.length > 0
      ? initialRules.map((r) => ({
          minConstructs: r.minConstructs,
          maxConstructs: r.maxConstructs,
          itemsPerConstruct: r.itemsPerConstruct,
        }))
      : [{ minConstructs: 1, maxConstructs: null, itemsPerConstruct: 10 }]
  )

  const [savedRules, setSavedRules] = useState<string>(JSON.stringify(rules))
  const isDirty = JSON.stringify(rules) !== savedRules

  function updateRule(index: number, updates: Partial<RuleDraft>) {
    setRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...updates } : r))
    )
  }

  function addRule() {
    setRules((prev) => {
      const last = prev[prev.length - 1]
      const newMin = last?.maxConstructs != null ? last.maxConstructs + 1 : (last?.minConstructs ?? 0) + 1
      // Make previous last rule bounded if it was open-ended
      const updated = prev.map((r, i) =>
        i === prev.length - 1 && r.maxConstructs === null
          ? { ...r, maxConstructs: newMin - 1 }
          : r
      )
      return [
        ...updated,
        { minConstructs: newMin, maxConstructs: null, itemsPerConstruct: 6 },
      ]
    })
  }

  function removeRule(index: number) {
    if (rules.length <= 1) return
    setRules((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    setError(null)
    setSaveState("saving")
    startTransition(async () => {
      const payload = rules.map((r, i) => ({
        minConstructs: r.minConstructs,
        maxConstructs: r.maxConstructs,
        itemsPerConstruct: r.itemsPerConstruct,
        displayOrder: i,
      }))

      const result = await upsertItemSelectionRules(payload)

      if (result?.error) {
        const errors = result.error
        const msg =
          typeof errors === "object" && "_form" in errors
            ? (errors as Record<string, string[]>)._form?.[0]
            : "Validation failed — check that rules are contiguous and non-overlapping."
        setError(msg)
        toast.error(msg)
        setSaveState("idle")
      } else {
        toast.success("Item selection rules updated")
        setSavedRules(JSON.stringify(rules))
        setSaveState("saved")
        router.refresh()
        setTimeout(() => setSaveState("idle"), 2000)
      }
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ListFilter className="size-4" />
            </div>
            <div>
              <CardTitle>Construct-Based Rules</CardTitle>
              <CardDescription>
                Define how many items to select per construct based on the total number of constructs in the assessment. Lower values = fewer items per construct for larger assessments.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.map((rule, index) => (
            <ScrollReveal key={index} delay={index * 60}>
              <div className="flex items-end gap-3 rounded-xl border border-border/60 bg-card p-4">
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs">Min Constructs</Label>
                  <Input
                    type="number"
                    min={1}
                    value={rule.minConstructs}
                    onChange={(e) =>
                      updateRule(index, {
                        minConstructs: Number(e.target.value) || 1,
                      })
                    }
                    className="h-9 text-sm tabular-nums"
                  />
                </div>

                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs">
                    Max Constructs
                    {index === rules.length - 1 && (
                      <span className="text-muted-foreground ml-1">(blank = no limit)</span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={rule.maxConstructs ?? ""}
                    onChange={(e) =>
                      updateRule(index, {
                        maxConstructs: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    placeholder={index === rules.length - 1 ? "∞" : ""}
                    className="h-9 text-sm tabular-nums"
                  />
                </div>

                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs">Items per Construct</Label>
                  <Input
                    type="number"
                    min={1}
                    value={rule.itemsPerConstruct}
                    onChange={(e) =>
                      updateRule(index, {
                        itemsPerConstruct: Number(e.target.value) || 1,
                      })
                    }
                    className="h-9 text-sm tabular-nums"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRule(index)}
                  disabled={rules.length <= 1}
                  className="shrink-0"
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            </ScrollReveal>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRule}
            className="w-full"
          >
            <Plus className="size-3.5" />
            Add Rule
          </Button>

          <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
            <Info className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Rules must cover a contiguous range starting from 1. The last rule can leave &ldquo;Max Constructs&rdquo; blank to mean &ldquo;and above&rdquo;. When no rules match, all items are selected (current behaviour).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save bar */}
      <div className="flex items-center justify-end gap-3">
        <Button
          onClick={handleSave}
          disabled={!isDirty || isPending || saveState === "saved"}
        >
          {isPending || saveState === "saving" ? (
            <>
              <Loader2 className="size-3 animate-spin mr-1.5" />
              Saving…
            </>
          ) : saveState === "saved" ? (
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
  )
}
