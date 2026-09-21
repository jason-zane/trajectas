// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RoleBuilder } from "@/app/(marketing)/build/role-builder";
import type { ArchitectMatchResult } from "@/types/architect";
import type { Brief } from "@/types/ai";
import type { PublicBuildSession } from "@/lib/public-builds/session";

const actions = vi.hoisted(() => ({ startBuild: vi.fn(), rankBuild: vi.fn(), createBuild: vi.fn(), getPublicBuildSession: vi.fn(), extractRoleTextUpload: vi.fn(), requestCode: vi.fn(), verifyCode: vi.fn() }));
vi.mock("@/app/actions/public-builds", () => actions);
vi.mock("@/app/actions/public-builds-session", () => actions);
const brief: Brief = { roleTitle: "Operations Manager", function: "Operations", level: "mid_manager", outcome: "selection", outcomeIntent: "selection", responsibilities: ["Coordinate teams", "Manage delivery"], contextSignals: [], technicalRequirements: [], confidence: "high" };
const ranking: ArchitectMatchResult = { summary: "A role focused on delivery.", recommendedCount: { minimum: 4, optimal: 6, maximum: 8 }, consideredCount: 8, eligibleFactors: [], categories: [], picks: Array.from({ length: 8 }, (_, i) => ({ factorId: `factor-${i}`, factorName: `Capability ${i + 1}`, rank: i + 1, relevanceScore: 90 - i, reasoning: "Relevant to delivery.", definition: "A capability definition.", indicatorsLow: "Needs support with delivery.", indicatorsMid: "Delivers in familiar situations.", indicatorsHigh: "Delivers in complex situations.", availableItems: 6, categoryId: null, categoryName: null, categoryKey: null, dimensionId: null, dimensionName: null })) };
const rankedSession: PublicBuildSession = { email: "test@example.com", build: { id: "build-1", roleTitle: "Operations Manager", pdText: "Coordinate teams and manage delivery.", brief, ranking, picks: null, status: "ranked", token: null } };

beforeEach(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); }; vi.clearAllMocks(); sessionStorage.clear(); vi.stubGlobal("scrollTo", vi.fn()); });
describe("public role builder", () => {
  it("makes the invite requirement explicit and hides it for open access", () => {
    const { rerender } = render(<RoleBuilder inviteRequired initialSession={{ email: null, build: null }} />);
    expect(screen.getByLabelText("Invitation code")).toBeRequired();
    expect(screen.getByText(/invitation-only during preview/)).toBeVisible();
    rerender(<RoleBuilder inviteRequired={false} initialSession={{ email: null, build: null }} />);
    expect(screen.queryByLabelText("Invitation code")).not.toBeInTheDocument();
  });
  it("updates question counts and prevents creation below four selections", () => {
    render(<RoleBuilder inviteRequired initialSession={rankedSession} />);
    expect(screen.getByText("36")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Focused · 4" }));
    expect(screen.getByText("24")).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: /Capability 1 / }));
    expect(screen.getByRole("button", { name: /Create my assessment/ })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Select 1 more capability");
    fireEvent.click(screen.getByRole("checkbox", { name: /Capability 5 / }));
    expect(screen.getByRole("button", { name: /Create my assessment/ })).toBeEnabled();
  });
  it("preserves manual swaps when choosing the same or a longer assessment", () => {
    render(<RoleBuilder inviteRequired initialSession={rankedSession} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Capability 1 / }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Capability 7 / }));
    fireEvent.click(screen.getByRole("button", { name: "Core · 6" }));
    expect(screen.getByRole("checkbox", { name: /Capability 1 / })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Capability 7 / })).toBeChecked();
    expect(JSON.parse(sessionStorage.getItem("trajectas:role-picks:test@example.com:build-1")!)).toContain("factor-6");
    fireEvent.click(screen.getByRole("button", { name: "Extended · 8" }));
    expect(screen.getByRole("checkbox", { name: /Capability 7 / })).toBeChecked();
  });
  it("restores adjusted selections for this verified email and build", () => {
    sessionStorage.setItem("trajectas:role-picks:test@example.com:build-1", JSON.stringify(["factor-1", "factor-2", "factor-3", "factor-6"]));
    render(<RoleBuilder inviteRequired initialSession={rankedSession} />);
    expect(screen.getByRole("checkbox", { name: /Capability 1 / })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Capability 7 / })).toBeChecked();
    expect(screen.getByText("24")).toBeVisible();
  });
  it("restores the owned description when editing a resumed build", () => {
    render(<RoleBuilder inviteRequired initialSession={rankedSession} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit role" }));
    expect(screen.getByLabelText("Role title")).toHaveValue("Operations Manager");
    expect(screen.getByLabelText("Position description")).toHaveValue("Coordinate teams and manage delivery.");
  });
  it("explains behaviours and lets visitors search ranked alternatives", () => {
    render(<RoleBuilder inviteRequired initialSession={rankedSession} />);
    fireEvent.click(screen.getByRole("button", { name: "Explore Capability 1" }));
    expect(screen.getAllByText("Delivers in complex situations.")[0]).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close capability details" }));
    expect(screen.getByRole("heading", { name: "Other capabilities to consider" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Find an alternative"), { target: { value: "Capability 8" } });
    expect(screen.queryByRole("checkbox", { name: /Capability 7 / })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Capability 8 / }));
    expect(screen.getByRole("checkbox", { name: /Capability 8 / })).toBeChecked();
  });
  it("reports real stages and reveals the role only after extraction returns", async () => {
    let finishRead!: (value: unknown) => void;
    let finishMatch!: (value: unknown) => void;
    actions.startBuild.mockReturnValue(new Promise(resolve => { finishRead = resolve; }));
    actions.rankBuild.mockReturnValue(new Promise(resolve => { finishMatch = resolve; }));
    render(<RoleBuilder inviteRequired initialSession={{ email: "test@example.com", build: null }} />);
    fireEvent.change(screen.getByLabelText("Role title"), { target: { value: "Operations Manager" } });
    fireEvent.change(screen.getByLabelText("Position description"), { target: { value: "Coordinate teams and manage delivery." } });
    fireEvent.click(screen.getByRole("button", { name: /Find relevant capabilities/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Read the role");
    expect(actions.rankBuild).not.toHaveBeenCalled();
    await act(async () => { finishRead({ buildId: "build-1", brief, cached: false }); });
    expect(screen.getByRole("status")).toHaveTextContent("Match relevant capabilities");
    expect(screen.getByText("Coordinate teams")).toBeVisible();
    await act(async () => { finishMatch(ranking); });
    expect(screen.getByRole("heading", { name: "A focused assessment for your role." })).toBeVisible();
  });
  it("offers direct access even when delivery fails and removes the conflicting build-another action", async () => {
    actions.createBuild.mockResolvedValue({ token: "private-token", emailSent: false });
    render(<RoleBuilder inviteRequired initialSession={rankedSession} />);
    fireEvent.click(screen.getByRole("button", { name: /Create my assessment/ }));
    await waitFor(() => expect(screen.getByRole("link", { name: /Take my assessment/ })).toHaveAttribute("href", "/assess/private-token"));
    expect(screen.getByRole("status")).toHaveTextContent("couldn’t deliver the email");
    expect(screen.queryByRole("button", { name: /Build another/ })).not.toBeInTheDocument();
  });
  it("recovers a created assessment after an uncertain response instead of creating twice", async () => {
    actions.createBuild.mockRejectedValue(new Error("offline"));
    actions.getPublicBuildSession.mockResolvedValue({ ...rankedSession, build: { ...rankedSession.build, status: "created", token: "existing-token", picks: ranking.picks.slice(0, 6).map(p => p.factorId) } });
    render(<RoleBuilder inviteRequired initialSession={rankedSession} />);
    fireEvent.click(screen.getByRole("button", { name: /Create my assessment/ }));
    await screen.findByRole("button", { name: "Check progress" });
    fireEvent.click(screen.getByRole("button", { name: "Check progress" }));
    await waitFor(() => expect(screen.getByRole("link", { name: /Continue to assessment/ })).toHaveAttribute("href", "/assess/existing-token"));
    expect(actions.createBuild).toHaveBeenCalledTimes(1);
  });
  it("keeps the role text when extraction returns an error", async () => {
    actions.startBuild.mockResolvedValue({ error: "Unable to read that position description." });
    render(<RoleBuilder inviteRequired initialSession={{ email: "test@example.com", build: null }} />);
    fireEvent.change(screen.getByLabelText("Role title"), { target: { value: "Operations Manager" } });
    fireEvent.change(screen.getByLabelText("Position description"), { target: { value: "Coordinate delivery." } });
    fireEvent.click(screen.getByRole("button", { name: /Find relevant capabilities/ }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Position description")).toHaveValue("Coordinate delivery.");
  });
});
