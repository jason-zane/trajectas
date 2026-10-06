// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientDetailShell } from "@/app/(dashboard)/clients/[slug]/client-detail-shell";

const navigation = vi.hoisted(() => ({ path: "", query: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.path,
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
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

function showShell() {
  render(
    <ClientDetailShell
      client={{
        id: "client",
        slug: "direct",
        name: "Direct client",
        isActive: true,
        created_at: "2026-01-01",
      }}
      isPlatformAdmin
    >
      <div>Content</div>
    </ClientDetailShell>,
  );
}
beforeEach(() => {
  navigation.path = "/clients/direct/usage";
  navigation.query = "";
});

describe("client Usage and Billing navigation", () => {
  it("keeps this month when leaving the default Usage view", () => {
    showShell();
    expect(screen.getByRole("tab", { name: "Billing" })).toHaveAttribute(
      "href",
      "/clients/direct/billing?period=this-month",
    );
  });
  it("keeps last month when leaving the default Billing view", () => {
    navigation.path = "/clients/direct/billing";
    showShell();
    expect(screen.getByRole("tab", { name: "Usage" })).toHaveAttribute(
      "href",
      "/clients/direct/usage?period=last-month",
    );
  });
  it("preserves an explicit historical month without carrying unrelated filters", () => {
    navigation.query = "period=month&month=2026-03&client=elsewhere";
    showShell();
    expect(screen.getByRole("tab", { name: "Billing" })).toHaveAttribute(
      "href",
      "/clients/direct/billing?period=month&month=2026-03",
    );
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute(
      "href",
      "/clients/direct/details",
    );
  });
  it("retains each destination's own default when arriving from Overview", () => {
    navigation.path = "/clients/direct/overview";
    showShell();
    expect(screen.getByRole("tab", { name: "Usage" })).toHaveAttribute(
      "href",
      "/clients/direct/usage",
    );
    expect(screen.getByRole("tab", { name: "Billing" })).toHaveAttribute(
      "href",
      "/clients/direct/billing",
    );
  });
});
