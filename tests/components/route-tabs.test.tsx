// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { RouteTabs } from "@/components/route-tabs"

// Mock next/link to render a plain anchor in tests
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const tabs = [
  { label: "Overview", segment: "overview" },
  { label: "Settings", segment: "settings" },
  { label: "Reports", segment: "reports" },
]

describe("RouteTabs", () => {
  it("renders all tab labels", () => {
    render(
      <RouteTabs tabs={tabs} basePath="/clients/acme" activeSegment="overview" />
    )
    expect(screen.getByText("Overview")).toBeInTheDocument()
    expect(screen.getByText("Settings")).toBeInTheDocument()
    expect(screen.getByText("Reports")).toBeInTheDocument()
  })

  it("marks the active tab with aria-current", () => {
    render(
      <RouteTabs tabs={tabs} basePath="/clients/acme" activeSegment="settings" />
    )
    const settingsLink = screen.getByRole("tab", { name: "Settings" })
    expect(settingsLink).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("tab", { name: "Overview" })).not.toHaveAttribute("aria-current")
  })

  it("builds correct hrefs from basePath + segment", () => {
    render(
      <RouteTabs tabs={tabs} basePath="/clients/acme" activeSegment="overview" />
    )
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("href", "/clients/acme/overview")
    expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute("href", "/clients/acme/settings")
  })

  it("renders badge content when provided", () => {
    const tabsWithBadge = [
      ...tabs,
      { label: "Issues", segment: "issues", badge: <span data-testid="badge">3</span> },
    ]
    render(
      <RouteTabs tabs={tabsWithBadge} basePath="/clients/acme" activeSegment="overview" />
    )
    expect(screen.getByTestId("badge")).toBeInTheDocument()
  })

  it("supports keyboard navigation between tabs with arrow keys", async () => {
    render(
      <RouteTabs tabs={tabs} basePath="/clients/acme" activeSegment="overview" />
    )
    const overviewLink = screen.getByRole("tab", { name: "Overview" })
    overviewLink.focus()
    expect(document.activeElement).toBe(overviewLink)

    await userEvent.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Settings" }))

    await userEvent.keyboard("{ArrowLeft}")
    expect(document.activeElement).toBe(overviewLink)
  })
})
