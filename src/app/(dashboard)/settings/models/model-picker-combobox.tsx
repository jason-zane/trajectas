"use client"

/**
 * ModelPickerCombobox
 *
 * A searchable, sortable, filterable combobox for picking an OpenRouter model.
 * Replaces the plain <Select> on the AI Models settings page.
 *
 * Features:
 *  - Text search across name and model ID
 *  - Sort by name / cheapest input price / largest context window
 *  - Provider filter chips (Anthropic, OpenAI, Google, …)
 *  - Per-row: name, provider badge, in/out price, context length
 */

import { useState, useMemo } from "react"
import { ChevronsUpDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { OpenRouterModel } from "@/types/generation"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SortKey = "name" | "price_asc" | "ctx_desc"

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  price_asc: "Cheapest",
  ctx_desc: "Largest ctx",
}

function providerSlug(modelId: string): string {
  return modelId.split("/")[0] ?? "other"
}

function fmtPrice(raw: string): string {
  const n = parseFloat(raw) * 1_000_000
  if (!isFinite(n) || n === 0) return "free"
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

function fmtCtx(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`
  return `${Math.round(n / 1000)}k`
}

// Derive a stable set of providers (sorted alpha) from the model list
function extractProviders(models: OpenRouterModel[]): string[] {
  return Array.from(new Set(models.map((m) => providerSlug(m.id)))).sort()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ModelPickerComboboxProps {
  value: string
  onChange: (modelId: string) => void
  models: OpenRouterModel[]
  disabled?: boolean
}

export function ModelPickerCombobox({
  value,
  onChange,
  models,
  disabled,
}: ModelPickerComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("name")
  const [providerFilter, setProviderFilter] = useState("all")

  const providers = useMemo(() => extractProviders(models), [models])

  const displayed = useMemo(() => {
    let list = [...models]

    // Provider filter
    if (providerFilter !== "all") {
      list = list.filter((m) => providerSlug(m.id) === providerFilter)
    }

    // Text search — name or id
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q),
      )
    }

    // Sort
    if (sort === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sort === "price_asc") {
      list.sort(
        (a, b) =>
          parseFloat(a.pricing?.prompt ?? "9999") -
          parseFloat(b.pricing?.prompt ?? "9999"),
      )
    } else if (sort === "ctx_desc") {
      list.sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))
    }

    return list
  }, [models, search, sort, providerFilter])

  const selectedModel = models.find((m) => m.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Trigger */}
      <PopoverTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-left transition-colors",
              "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              "disabled:cursor-not-allowed disabled:opacity-50",
              open && "ring-2 ring-primary/30",
            )}
          />
        }
      >
        <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
          <span className="font-medium truncate w-full">
            {selectedModel?.name ?? value}
          </span>
          {selectedModel && (selectedModel.pricing || selectedModel.context_length) && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {selectedModel.pricing && (
                <span>{fmtPrice(selectedModel.pricing.prompt)}/M in · {fmtPrice(selectedModel.pricing.completion)}/M out</span>
              )}
              {selectedModel.context_length && (
                <span>· {fmtCtx(selectedModel.context_length)} ctx</span>
              )}
            </span>
          )}
        </div>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      {/* Panel */}
      <PopoverContent
        className="w-[400px] p-0 overflow-hidden"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          {/* Search */}
          <CommandInput
            placeholder="Search models…"
            value={search}
            onValueChange={setSearch}
          />

          {/* Toolbar: sort + provider filters */}
          <div className="flex flex-col gap-2 border-b border-border/60 px-2 py-2">
            {/* Sort chips */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[11px] text-muted-foreground mr-0.5 shrink-0">Sort</span>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSort(key)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px] transition-colors",
                    sort === key
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {SORT_LABELS[key]}
                </button>
              ))}
            </div>

            {/* Provider chips */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[11px] text-muted-foreground mr-0.5 shrink-0">Provider</span>
              {["all", ...providers].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProviderFilter(p)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px] capitalize transition-colors",
                    providerFilter === p
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {p === "all" ? "All" : p}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <CommandList className="max-h-64">
            <CommandEmpty className="py-6 text-sm text-center text-muted-foreground">
              No models match.
            </CommandEmpty>
            <CommandGroup>
              {displayed.map((model) => {
                const isSelected = model.id === value
                const slug = providerSlug(model.id)
                return (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    onSelect={(v) => {
                      onChange(v)
                      setOpen(false)
                    }}
                    data-checked={isSelected}
                    className="flex items-start gap-2 py-2"
                  >
                    <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-sm truncate leading-tight">
                          {model.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="shrink-0 py-0 px-1.5 text-[10px] capitalize leading-tight"
                        >
                          {slug}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {model.pricing ? (
                          <>
                            <span>{fmtPrice(model.pricing.prompt)}/M in</span>
                            <span>·</span>
                            <span>{fmtPrice(model.pricing.completion)}/M out</span>
                          </>
                        ) : (
                          <span>no pricing data</span>
                        )}
                        {model.context_length && (
                          <>
                            <span>·</span>
                            <span>{fmtCtx(model.context_length)} ctx</span>
                          </>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>

          {/* Result count footer */}
          <CommandSeparator />
          <div className="px-3 py-1.5">
            <span className="text-[11px] text-muted-foreground">
              {displayed.length} of {models.length} models
            </span>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
