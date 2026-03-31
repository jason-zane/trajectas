"use client"

import { CheckSquare2, ChevronDown, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface LibrarySelectionToolbarProps {
  className?: string
  selectionMode: boolean
  selectedCount: number
  visibleCount: number
  allVisibleSelected: boolean
  itemLabel: string
  itemLabelPlural: string
  deleting?: boolean
  confirmOpen: boolean
  onConfirmOpenChange: (open: boolean) => void
  onToggleSelectionMode: () => void
  onToggleAllVisible: () => void
  onClearSelection: () => void
  onConfirmDelete: () => void
}

export function LibrarySelectionToolbar({
  className,
  selectionMode,
  selectedCount,
  visibleCount,
  allVisibleSelected,
  itemLabel,
  itemLabelPlural,
  deleting = false,
  confirmOpen,
  onConfirmOpenChange,
  onToggleSelectionMode,
  onToggleAllVisible,
  onClearSelection,
  onConfirmDelete,
}: LibrarySelectionToolbarProps) {
  const hasVisibleRows = visibleCount > 0

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
        <Button
          variant={selectionMode ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleSelectionMode}
        >
          <CheckSquare2 className="size-4" />
          {selectionMode ? "Done" : "Select"}
        </Button>

        {selectionMode ? (
          <>
            <Badge variant="secondary" className="h-8 rounded-full px-3 text-[11px] font-medium">
              {selectedCount} {selectedCount === 1 ? itemLabel : itemLabelPlural} selected
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    Actions
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={onToggleAllVisible} disabled={!hasVisibleRows}>
                  {allVisibleSelected ? "Deselect visible" : "Select visible"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onClearSelection} disabled={selectedCount === 0}>
                  Clear selection
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onConfirmOpenChange(true)}
                  disabled={selectedCount === 0}
                >
                  <Trash2 className="size-4" />
                  Delete selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={onConfirmOpenChange}
        title={`Delete ${selectedCount} ${selectedCount === 1 ? itemLabel : itemLabelPlural}?`}
        description={`This will remove the selected ${selectedCount === 1 ? itemLabel : itemLabelPlural} from the active library views. You can restore them later if needed.`}
        confirmLabel="Delete selected"
        variant="destructive"
        onConfirm={onConfirmDelete}
        loading={deleting}
      />
    </>
  )
}
