// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SectionCard } from "@/components/section-card"

describe("SectionCard", () => {
  it("renders title and children", () => {
    render(
      <SectionCard title="Profile">
        <p>Body content</p>
      </SectionCard>
    )
    expect(screen.getByText("Profile")).toBeInTheDocument()
    expect(screen.getByText("Body content")).toBeInTheDocument()
  })

  it("renders description when provided", () => {
    render(
      <SectionCard title="Profile" description="Update your details">
        <p>Body</p>
      </SectionCard>
    )
    expect(screen.getByText("Update your details")).toBeInTheDocument()
  })

  it("does not render description element when not provided", () => {
    render(<SectionCard title="Profile"><p>Body</p></SectionCard>)
    // No second text element in the header
    expect(screen.queryByText(/update your/i)).not.toBeInTheDocument()
  })

  it("renders action in header when provided", () => {
    render(
      <SectionCard title="Profile" action={<button>Toggle</button>}>
        <p>Body</p>
      </SectionCard>
    )
    expect(screen.getByRole("button", { name: "Toggle" })).toBeInTheDocument()
  })

  it("renders footer when provided", () => {
    render(
      <SectionCard title="Profile" footer={<button>Save</button>}>
        <p>Body</p>
      </SectionCard>
    )
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument()
  })

  it("does not render footer when not provided", () => {
    render(<SectionCard title="Profile"><p>Body</p></SectionCard>)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
