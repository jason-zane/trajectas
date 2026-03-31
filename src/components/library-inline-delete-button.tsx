"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface LibraryInlineDeleteButtonProps {
  itemLabel: string
  itemName: string
  restoreLabel?: string
  onDelete: () => Promise<{ error?: string; success?: boolean } | void>
  onRestore?: () => Promise<{ error?: string; success?: boolean } | void>
}

export function LibraryInlineDeleteButton({
  itemLabel,
  itemName,
  restoreLabel,
  onDelete,
  onRestore,
}: LibraryInlineDeleteButtonProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await onDelete()
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }

      setOpen(false)
      if (!onRestore) {
        toast.success(`${itemLabel} deleted`)
        return
      }

      toast.success(`${itemLabel} deleted`, {
        action: {
          label: restoreLabel ?? "Undo",
          onClick: async () => {
            const restoreResult = await onRestore()
            if (restoreResult && "error" in restoreResult && restoreResult.error) {
              toast.error(restoreResult.error)
              return
            }

            toast.success(`${itemLabel} restored`)
          },
        },
        duration: 5000,
      })
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-8 rounded-full border border-border/70 bg-background/88 text-muted-foreground shadow-sm backdrop-blur transition-all hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(true)
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${itemLabel.toLowerCase()}?`}
        description={`This will delete ${itemName} from the active library views. You can restore it later if needed.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  )
}
