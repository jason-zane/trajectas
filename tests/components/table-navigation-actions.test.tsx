// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssessmentsDataTable } from "@/app/(dashboard)/assessments/assessments-data-table";
import { CampaignsTable } from "@/app/(dashboard)/campaigns/campaigns-table";
import { ClientDirectoryTable } from "@/app/(dashboard)/directory/client-directory-table";
import { PartnerDirectoryTable } from "@/app/(dashboard)/directory/partner-directory-table";
import { ParticipantsTable } from "@/app/(dashboard)/participants/participants-table";
import { ReportTemplatesTable } from "@/app/(dashboard)/report-templates/report-templates-table";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/app/actions/clients", () => ({
  deleteClient: vi.fn(),
  restoreClient: vi.fn(),
}));

vi.mock("@/app/actions/partners", () => ({
  deletePartner: vi.fn(),
  restorePartner: vi.fn(),
}));

vi.mock("@/app/actions/campaigns", () => ({
  deleteCampaign: vi.fn(),
}));

vi.mock("@/app/actions/assessments", () => ({
  deleteAssessment: vi.fn(),
}));

vi.mock("@/app/actions/reports", () => ({
  cloneReportTemplate: vi.fn(),
  createReportTemplate: vi.fn(),
  deleteReportTemplate: vi.fn(),
  toggleReportTemplateActive: vi.fn(),
}));

function enableReducedMotion() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  enableReducedMotion();
  router.push.mockReset();
  router.refresh.mockReset();
});

describe("table navigation and actions", () => {
  it("renders client and partner directory rows with real links and action menus", () => {
    render(
      <>
        <ClientDirectoryTable
          clients={[
            {
              id: "client-1",
              slug: "northwind",
              name: "Northwind",
              partnerName: "Alliance",
              isActive: true,
              deletedAt: null,
              industry: "Manufacturing",
              assessmentCount: 4,
              sessionCount: 18,
            } as never,
          ]}
        />
        <PartnerDirectoryTable
          partners={[
            {
              id: "partner-1",
              slug: "alliance",
              name: "Alliance",
              isActive: true,
              deletedAt: null,
              clientCount: 7,
            } as never,
          ]}
        />
      </>
    );

    expect(screen.getByRole("link", { name: "Open Northwind" })).toHaveAttribute(
      "href",
      "/clients/northwind/overview"
    );
    expect(screen.getByRole("button", { name: "Open actions for Northwind" })).toBeVisible();

    expect(screen.getByRole("link", { name: "Open Alliance" })).toHaveAttribute(
      "href",
      "/partners/alliance/edit"
    );
    expect(screen.getByRole("button", { name: "Open actions for Alliance" })).toBeVisible();
  });

  it("renders campaign, participant, and assessment rows with links and action menus", () => {
    render(
      <>
        <CampaignsTable
          campaigns={[
            {
              id: "campaign-1",
              title: "Q2 Leadership Rollout",
              clientName: "Northwind",
              status: "active",
              assessmentCount: 2,
              participantCount: 12,
              completedCount: 6,
              opensAt: "2026-04-01T00:00:00.000Z",
              closesAt: "2026-04-30T00:00:00.000Z",
              created_at: "2026-03-20T00:00:00.000Z",
            } as never,
          ]}
        />
        <ParticipantsTable
          participants={[
            {
              id: "participant-1",
              campaignId: "campaign-1",
              campaignTitle: "Q2 Leadership Rollout",
              campaignSlug: "q2-leadership-rollout",
              firstName: "Avery",
              lastName: "Stone",
              email: "avery@example.com",
              status: "in_progress",
              sessionCount: 3,
              completedSessionCount: 1,
              lastActivity: "2026-04-08T10:00:00.000Z",
            } as never,
          ]}
        />
        <AssessmentsDataTable
          assessments={[
            {
              id: "assessment-1",
              title: "Leadership Baseline",
              status: "active",
              creationMode: "manual",
              factorCount: 9,
            } as never,
          ]}
        />
      </>
    );

    expect(
      screen.getByRole("link", { name: "Open Q2 Leadership Rollout" })
    ).toHaveAttribute("href", "/campaigns/campaign-1/overview");
    expect(
      screen.getByRole("button", { name: "Open actions for Q2 Leadership Rollout" })
    ).toBeVisible();

    expect(screen.getByRole("link", { name: "Open Avery Stone" })).toHaveAttribute(
      "href",
      "/participants/participant-1"
    );
    expect(
      screen.getByRole("button", { name: "Open actions for Avery Stone" })
    ).toBeVisible();

    expect(
      screen.getByRole("link", { name: "Open Leadership Baseline" })
    ).toHaveAttribute("href", "/assessments/assessment-1/edit");
    expect(
      screen.getByRole("button", { name: "Open actions for Leadership Baseline" })
    ).toBeVisible();
  });

  it("renders report template rows with a builder link and action menu", () => {
    render(
      <ReportTemplatesTable
        templates={[
          {
            id: "template-1",
            name: "Consultant Narrative",
            description: "Executive-ready narrative template",
            reportType: "self_report",
            displayLevel: "factor",
            isActive: true,
            blocks: [],
          } as never,
        ]}
      />
    );

    expect(
      screen.getByRole("link", { name: "Open Consultant Narrative" })
    ).toHaveAttribute("href", "/report-templates/template-1/builder");
    expect(
      screen.getByRole("button", { name: "Open actions for Consultant Narrative" })
    ).toBeVisible();
  });
});
