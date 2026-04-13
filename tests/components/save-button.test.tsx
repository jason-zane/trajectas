// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SaveButton } from "@/components/save-button"

describe("SaveButton", () => {
  it("renders idle label by default", () => {
    render(<SaveButton state="idle" onClick={vi.fn()} />)
    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled()
  })

  it("shows saving label and is disabled while saving", () => {
    render(<SaveButton state="saving" onClick={vi.fn()} />)
    const btn = screen.getByRole("button", { name: /saving/i })
    expect(btn).toBeDisabled()
  })

  it("shows saved label and is disabled in saved state", () => {
    render(<SaveButton state="saved" onClick={vi.fn()} />)
    expect(screen.getByRole("button", { name: /saved/i })).toBeDisabled()
  })

  it("shows Save Changes and is enabled in error state", () => {
    render(<SaveButton state="error" onClick={vi.fn()} />)
    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled()
  })

  it("calls onClick when clicked in idle state", async () => {
    const onClick = vi.fn()
    render(<SaveButton state="idle" onClick={onClick} />)
    await userEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("respects disabled prop", () => {
    render(<SaveButton state="idle" onClick={vi.fn()} disabled />)
    expect(screen.getByRole("button")).toBeDisabled()
  })
})
