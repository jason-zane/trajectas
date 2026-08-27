// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AppSidebar } from "@/components/app-sidebar"
import { PortalProvider } from "@/components/portal-context"
import { SidebarProvider } from "@/components/ui/sidebar"

const pathname = vi.hoisted(() => ({ current: "/dashboard" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}))

function renderSidebar() {
  return render(
    <SidebarProvider>
      <PortalProvider initialPortal="admin" routePrefix="">
        <AppSidebar />
      </PortalProvider>
    </SidebarProvider>
  )
}

/** Base UI marks the open panel with data-open; closed panels lack it. */
function panelFor(label: string) {
  const trigger = screen.getByRole("button", { name: new RegExp(`^${label}$`, "i") })
  const group = trigger.closest('[data-slot="sidebar-group"]')
  return group?.querySelector('[data-slot="sidebar-group-panel"]') ?? null
}

function isOpen(label: string) {
  return panelFor(label)?.hasAttribute("data-open") ?? false
}

beforeEach(() => {
  pathname.current = "/dashboard"
  document.cookie = "sidebar_sections_admin=; path=/; max-age=0"
})

afterEach(() => {
  document.cookie = "sidebar_sections_admin=; path=/; max-age=0"
})

describe("AppSidebar structure", () => {
  it("groups the library around taxonomy only", () => {
    renderSidebar()
    const panel = panelFor("Library")
    expect(panel).not.toBeNull()
    const links = within(panel as HTMLElement).getAllByRole("link")
    expect(links.map((l) => l.textContent?.trim())).toEqual([
      "Dimensions",
      "Factors",
      "Constructs",
      "Items",
      "Item Formats",
    ])
  })

  it("puts the instrument factories and their evidence together", async () => {
    const user = userEvent.setup()
    renderSidebar()
    await user.click(screen.getByRole("button", { name: /^instrument development$/i }))
    const panel = panelFor("Instrument Development")
    const links = within(panel as HTMLElement).getAllByRole("link")
    expect(links.map((l) => l.textContent?.trim())).toEqual([
      "Instruments",
      "Cognitive Items",
      "Psychometrics",
    ])
    expect(
      within(panel as HTMLElement).getByRole("link", { name: /^cognitive items$/i })
    ).toHaveAttribute("href", "/cognitive-items")
  })

  it("points Dashboard at the workspace, not the marketing home", () => {
    renderSidebar()
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard"
    )
  })

  it("links diagnostics templates at their real route", async () => {
    const user = userEvent.setup()
    renderSidebar()
    await user.click(screen.getByRole("button", { name: /^org diagnostics$/i }))
    expect(screen.getByRole("link", { name: /^templates$/i })).toHaveAttribute(
      "href",
      "/diagnostics/templates"
    )
  })

  it("no longer renders disabled coming-soon rows", async () => {
    const user = userEvent.setup()
    renderSidebar()
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /^org diagnostics$/i }))
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
    const sessions = screen.getByRole("link", { name: /^sessions$/i })
    expect(sessions).toHaveAttribute("href", "/diagnostics")
    expect(sessions).not.toHaveAttribute("aria-disabled")
  })

  it("keeps a collapsed section's links out of the accessibility tree", () => {
    renderSidebar()
    expect(
      screen.queryByRole("link", { name: /^matching engine$/i })
    ).not.toBeInTheDocument()
  })

  it("surfaces the previously orphaned report archive", () => {
    renderSidebar()
    expect(screen.getByRole("link", { name: /^reports$/i })).toHaveAttribute(
      "href",
      "/reports"
    )
  })

  it("drops Architect, which is a modal on the assessments page", () => {
    renderSidebar()
    expect(screen.queryByRole("link", { name: /architect/i })).not.toBeInTheDocument()
  })

  it("labels the settings back-link with where it actually goes", () => {
    pathname.current = "/settings/brand"
    renderSidebar()
    const back = screen.getByRole("link", { name: /back to dashboard/i })
    expect(back).toHaveAttribute("href", "/dashboard")
    expect(screen.queryByText(/back to platform/i)).not.toBeInTheDocument()
  })

  it("keeps Chat reachable from the footer", () => {
    renderSidebar()
    expect(screen.getByRole("link", { name: /^chat$/i })).toHaveAttribute("href", "/chat")
  })
})

describe("AppSidebar collapsing", () => {
  it("opens the everyday sections and closes the specialist ones", () => {
    renderSidebar()
    expect(isOpen("Library")).toBe(true)
    expect(isOpen("Assessments")).toBe(true)
    expect(isOpen("Delivery")).toBe(true)
    expect(isOpen("Insights")).toBe(true)

    expect(isOpen("Instrument Development")).toBe(false)
    expect(isOpen("Org Diagnostics")).toBe(false)
    expect(isOpen("Clients & People")).toBe(false)
    expect(isOpen("Business")).toBe(false)
  })

  it("toggles a section and remembers it in a cookie", async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByRole("button", { name: /^library$/i }))
    expect(isOpen("Library")).toBe(false)
    expect(document.cookie).toContain("sidebar_sections_admin")
    expect(decodeURIComponent(document.cookie)).toContain('"Library":false')

    await user.click(screen.getByRole("button", { name: /^library$/i }))
    expect(isOpen("Library")).toBe(true)
  })

  it("restores remembered state on mount", () => {
    document.cookie = `sidebar_sections_admin=${encodeURIComponent(
      JSON.stringify({ Business: true, Library: false })
    )}; path=/`
    renderSidebar()
    expect(isOpen("Business")).toBe(true)
    expect(isOpen("Library")).toBe(false)
  })

  it("ignores a corrupt cookie rather than throwing", () => {
    document.cookie = "sidebar_sections_admin=not-json; path=/"
    expect(() => renderSidebar()).not.toThrow()
    expect(isOpen("Library")).toBe(true)
  })

  it("opens the section holding the current page", () => {
    // Business defaults closed, but you are standing inside it.
    pathname.current = "/business/invoices"
    renderSidebar()
    expect(isOpen("Business")).toBe(true)
  })

  it("still lets you collapse the section you are standing in", async () => {
    const user = userEvent.setup()
    pathname.current = "/business/invoices"
    renderSidebar()
    expect(isOpen("Business")).toBe(true)

    await user.click(screen.getByRole("button", { name: /^business$/i }))
    expect(isOpen("Business")).toBe(false)
  })
})
