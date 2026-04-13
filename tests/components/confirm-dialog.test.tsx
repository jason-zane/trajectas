// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

const base = {
  open: true,
  onOpenChange: vi.fn(),
  title: "Delete item",
  description: "This cannot be undone.",
  onConfirm: vi.fn(),
}

describe("ConfirmDialog", () => {
  it("shows default loading label when loading and no loadingLabel provided", () => {
    render(<ConfirmDialog {...base} loading confirmLabel="Delete" />)
    expect(screen.getByRole("button", { name: /please wait/i })).toBeInTheDocument()
  })

  it("shows custom loadingLabel when provided", () => {
    render(
      <ConfirmDialog {...base} loading confirmLabel="Delete" loadingLabel="Deleting…" />
    )
    expect(screen.getByRole("button", { name: /deleting/i })).toBeInTheDocument()
    expect(screen.queryByText(/please wait/i)).not.toBeInTheDocument()
  })

  it("shows confirmLabel when not loading", () => {
    render(<ConfirmDialog {...base} confirmLabel="Delete" />)
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument()
  })
})
