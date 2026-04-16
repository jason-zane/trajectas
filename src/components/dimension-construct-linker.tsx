"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  linkConstructToDimension,
  unlinkConstructFromDimension,
  updateDimensionConstructLink,
} from "@/app/actions/dimension-constructs"

export type LinkRow = {
  id: string
  otherId: string
  otherName: string
  weight: number
}

export type LinkerOption = { id: string; name: string }

interface DimensionConstructLinkerProps {
  direction: "from-dimension" | "from-construct"
  entityId: string // dimension_id or construct_id (the "from" side)
  links: LinkRow[]
  availableOptions: LinkerOption[] // the opposite-side entities available to link
}

export function DimensionConstructLinker({
  direction,
  entityId,
  links,
  availableOptions,
}: DimensionConstructLinkerProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedNew, setSelectedNew] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const linkedIds = new Set(links.map((l) => l.otherId))
  const unlinkedOptions = availableOptions.filter((o) => !linkedIds.has(o.id))
  const filtered = search
    ? unlinkedOptions.filter((o) =>
        o.name.toLowerCase().includes(search.toLowerCase()),
      )
    : unlinkedOptions

  const otherLabel = direction === "from-dimension" ? "construct" : "dimension"
  const otherLabelPlural =
    direction === "from-dimension" ? "constructs" : "dimensions"

  async function handleLinkMany() {
    if (selectedNew.size === 0) return
    setSaving(true)
    try {
      for (const otherId of selectedNew) {
        const dimensionId = direction === "from-dimension" ? entityId : otherId
        const constructId = direction === "from-dimension" ? otherId : entityId
        await linkConstructToDimension(dimensionId, constructId, 1.0, 0)
      }
      toast.success(`Linked ${selectedNew.size} ${otherLabelPlural}.`)
      setDialogOpen(false)
      setSelectedNew(new Set())
      setSearch("")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to link.")
    } finally {
      setSaving(false)
    }
  }

  async function handleUnlink(otherId: string) {
    try {
      const dimensionId = direction === "from-dimension" ? entityId : otherId
      const constructId = direction === "from-dimension" ? otherId : entityId
      await unlinkConstructFromDimension(dimensionId, constructId)
      toast.success(`Unlinked ${otherLabel}.`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unlink.")
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{links.length} linked</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="size-3.5 mr-1" /> Link {otherLabel}
        </Button>
      </div>

      {links.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No {otherLabelPlural} linked yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <span className="text-sm font-medium flex-1">{link.otherName}</span>
              <WeightEditor link={link} />
              <button
                type="button"
                onClick={() => handleUnlink(link.otherId)}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                aria-label="Unlink"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Link {otherLabelPlural} to this{" "}
              {direction === "from-dimension" ? "dimension" : "construct"}
            </DialogTitle>
          </DialogHeader>

          <Input
            placeholder={`Search ${otherLabelPlural}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="max-h-80 overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {unlinkedOptions.length === 0
                  ? `All ${otherLabelPlural} are already linked.`
                  : "No matches."}
              </p>
            ) : (
              filtered.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedNew.has(opt.id)}
                    onCheckedChange={() => {
                      setSelectedNew((prev) => {
                        const next = new Set(prev)
                        if (next.has(opt.id)) next.delete(opt.id)
                        else next.add(opt.id)
                        return next
                      })
                    }}
                  />
                  <span className="text-sm">{opt.name}</span>
                </label>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLinkMany}
              disabled={saving || selectedNew.size === 0}
            >
              {saving ? "Linking..." : `Link ${selectedNew.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function WeightEditor({ link }: { link: LinkRow }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(link.weight)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateDimensionConstructLink(link.id, { weight: value })
      toast.success("Weight updated.")
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Pencil className="size-3" /> weight: {link.weight.toFixed(1)}
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-2">
        <div className="space-y-1">
          <label className="text-xs font-medium">Weight</label>
          <Input
            type="number"
            step="0.1"
            min="0.01"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
