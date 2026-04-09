// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssessmentsDataTable } from "@/app/(dashboard)/assessments/assessments-data-table";
import { CampaignsTable } from "@/app/(dashboard)/campaigns/campaigns-table";
import { ClientUsersTable } from "@/app/(dashboard)/clients/[slug]/users/client-users-table";
import { ClientDirectoryTable } from "@/app/(dashboard)/directory/client-directory-table";
import { PartnerUsersTable } from "@/app/(dashboard)/partners/[slug]/users/partner-users-table";
import { PartnerDirectoryTable } from "@/app/(dashboard)/directory/partner-directory-table";
import { ParticipantsTable } from "@/app/(dashboard)/participants/participants-table";
import { ReportTemplatesTable } from "@/app/(dashboard)/report-templates/report-templates-table";
import { UsersTable } from "@/app/(dashboard)/users/users-table";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/app/actions/clients", () => ({
  changeClientMemberRole: vi.fn(),
  deleteClient: vi.fn(),
  removeClientMember: vi.fn(),
  restoreClient: vi.fn(),
}));

vi.mock("@/app/actions/partners", () => ({
  changePartnerMemberRole: vi.fn(),
  deletePartner: vi.fn(),
  removePartnerMember: vi.fn(),
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

vi.mock("@/app/actions/staff-users", () => ({
  revokeInviteById: vi.fn(),
  toggleUserActiveState: vi.fn(),
}));

vi.mock("@/app/actions/user-management", () => ({
  resendInvite: vi.fn(),
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

  it("renders users rows with profile and invite links plus action menus", () => {
    render(
      <UsersTable
        users={[
          {
            type: "profile",
            id: "user-1",
            email: "jordan@example.com",
            displayName: "Jordan Admin",
            role: "platform_admin",
            isActive: true,
            createdAt: "2026-04-01T00:00:00.000Z",
            partnerMemberships: [],
            clientMemberships: [],
          } as never,
          {
            type: "invite",
            id: "invite-1",
            email: "invitee@example.com",
            role: "partner_admin",
            tenantType: "partner",
            tenantId: "partner-1",
            tenantName: "Alliance",
            expiresAt: "2026-04-15T00:00:00.000Z",
            createdAt: "2026-04-02T00:00:00.000Z",
          } as never,
        ]}
      />
    );

    expect(screen.getByRole("link", { name: "Open Jordan Admin" })).toHaveAttribute(
      "href",
      "/users/user-1"
    );
    expect(
      screen.getByRole("button", { name: "Open actions for Jordan Admin" })
    ).toBeVisible();

    expect(screen.getByRole("link", { name: "Open invitee@example.com" })).toHaveAttribute(
      "href",
      "/users/invite/invite-1"
    );
    expect(
      screen.getByRole("button", { name: "Open actions for invitee@example.com" })
    ).toBeVisible();
  });

  it("renders client and partner user membership rows with user links and action menus", () => {
    render(
      <>
        <ClientUsersTable
          clientId="client-1"
          members={[
            {
              membershipId: "client-member-1",
              userId: "user-1",
              email: "jordan@example.com",
              firstName: "Jordan",
              lastName: "Admin",
              role: "admin",
              addedAt: "2026-04-01T00:00:00.000Z",
            } as never,
          ]}
        />
        <PartnerUsersTable
          partnerId="partner-1"
          members={[
            {
              membershipId: "partner-member-1",
              userId: "user-2",
              email: "parker@example.com",
              firstName: "Parker",
              lastName: "Member",
              role: "member",
              addedAt: "2026-04-02T00:00:00.000Z",
            } as never,
          ]}
        />
      </>
    );

    expect(screen.getByRole("link", { name: "Open Jordan Admin" })).toHaveAttribute(
      "href",
      "/users/user-1"
    );
    expect(
      screen.getByRole("button", { name: "Open actions for Jordan Admin" })
    ).toBeVisible();

    expect(screen.getByRole("link", { name: "Open Parker Member" })).toHaveAttribute(
      "href",
      "/users/user-2"
    );
    expect(
      screen.getByRole("button", { name: "Open actions for Parker Member" })
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
