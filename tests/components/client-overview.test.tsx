// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClientOverview } from "@/app/(dashboard)/clients/[slug]/overview/client-overview";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/enter-portal-button", () => ({
  EnterPortalButton: ({
    tenantType,
    tenantId,
    tenantName,
  }: {
    tenantType: "client" | "partner";
    tenantId: string;
    tenantName: string;
  }) => (
    <button
      type="button"
      data-tenant-type={tenantType}
      data-tenant-id={tenantId}
      data-tenant-name={tenantName}
    >
      {tenantType === "client" ? "Enter Client Portal" : "Enter Partner Portal"}
    </button>
  ),
}));

describe("ClientOverview", () => {
  it("uses the audited enter-portal button instead of a direct client dashboard link", () => {
    render(
      <ClientOverview
        client={
          {
            id: "client-1",
            slug: "northwind",
            name: "Northwind",
            created_at: "2026-04-01T00:00:00.000Z",
            isActive: true,
            partnerId: null,
          } as never
        }
        stats={{
          activeCampaignCount: 3,
          totalParticipants: 24,
          assignedAssessmentCount: 5,
          reportsGenerated: 8,
        }}
        recentCampaigns={[]}
      />
    );

    const button = screen.getByRole("button", { name: "Enter Client Portal" });
    expect(button).toHaveAttribute("data-tenant-type", "client");
    expect(button).toHaveAttribute("data-tenant-id", "client-1");
    expect(button).toHaveAttribute("data-tenant-name", "Northwind");

    expect(screen.queryByRole("link", { name: /enter portal/i })).toBeNull();
    expect(document.querySelector('a[href="/client/dashboard"]')).toBeNull();
  });
});
