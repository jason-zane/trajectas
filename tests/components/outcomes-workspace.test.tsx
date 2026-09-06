// @vitest-environment jsdom
import { render, screen, within, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { OutcomeScatterPlot } from "@/components/outcomes/scatter-plot";
import { reportDraftSchema } from "@/lib/outcomes/validation";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OutcomeWorkspace } from "@/components/outcomes/workspace";
import { OutcomeAnalysisPanel } from "@/components/outcomes/analysis-panel";
import { outcomeRunFixture } from "../fixtures/business-outcomes";
import { saveOutcomeReportDraftAction } from "@/app/actions/outcomes";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/outcomes", () => ({
  getOutcomeRunsAction: vi.fn(),
  saveOutcomeStudyAction: vi.fn(),
  runOutcomeStudyAction: vi.fn(),
  publishOutcomeReportAction: vi.fn(),
  revokeOutcomeReportAction: vi.fn(),
  saveOutcomeReportDraftAction: vi.fn(),
}));
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  vi.mocked(saveOutcomeReportDraftAction).mockResolvedValue({ data: 1 });
});
function runFixture() {
  const run = outcomeRunFixture();
  run.input.config.metrics.push({
    ...run.input.config.metrics[0],
    id: "engagement",
    label: "Employee engagement",
  });
  run.result!.results.push({
    ...structuredClone(run.result!.results[0]),
    metricId: "engagement",
  });
  return run;
}
function workspace(
  overrides: Partial<ComponentProps<typeof OutcomeWorkspace>> = {},
) {
  const run = runFixture();
  return (
    <OutcomeWorkspace
      drafts={[]}
      study={{
        id: "study",
        clientId: "client",
        clientName: "Example",
        title: "Outcome evidence",
        question: "Which capabilities matter?",
        config: run.input.config,
        revision: 1,
        createdAt: run.createdAt,
      }}
      campaigns={[]}
      predictors={run.input.predictors}
      imports={[]}
      runs={[run]}
      reports={[]}
      {...overrides}
    />
  );
}
describe("Business Outcomes evidence workflow", () => {
  it("drills from the complete matrix into a KPI, model and traceable estimate", async () => {
    const user = userEvent.setup(),
      run = runFixture(),
      onReport = vi.fn();
    render(
      <OutcomeAnalysisPanel
        run={run}
        runs={[run]}
        setRunId={vi.fn()}
        campaigns={[]}
        onReport={onReport}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: /Empathy against Customer satisfaction/,
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: /Empathy against Employee engagement/,
      }),
    );
    expect(screen.getByLabelText("Business measure")).toHaveValue("engagement");
    await user.click(screen.getByRole("button", { name: "Spearman ρ" }));
    expect(
      screen.getByRole("button", {
        name: /Empathy against Employee engagement, spearman/,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Regression" }));
    expect(
      screen.getByRole("heading", { name: "Full coefficient table" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Std. β" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Private context category").length,
    ).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "KPI estimate" }));
    const shift = screen.getByLabelText(/^Hypothetical score difference/);
    await user.clear(shift);
    await user.type(shift, "-1");
    expect(screen.getByText("3 × -1 = -3 points")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Use this finding in the report" }),
    );
    expect(onReport).toHaveBeenCalledWith({
      metricId: "engagement",
      predictorId: "p",
      shift: -1,
    });
  });
  it("keeps report section choices on save and protects an edited draft during handoff", async () => {
    const user = userEvent.setup();
    render(workspace());
    await user.click(screen.getByRole("tab", { name: /Executive report/ }));
    const headline = screen.getByLabelText("Executive headline");
    await user.clear(headline);
    await user.type(headline, "Reviewed executive headline");
    await user.click(
      screen.getByRole("checkbox", { name: "Technical appendix" }),
    );
    await user.click(screen.getByRole("button", { name: "Save report draft" }));
    await waitFor(() =>
      expect(saveOutcomeReportDraftAction).toHaveBeenCalled(),
    );
    expect(
      vi.mocked(saveOutcomeReportDraftAction).mock.calls[0][3],
    ).toMatchObject({
      headline: "Reviewed executive headline",
      sections: { technical: false },
    });
    await user.type(headline, " — unsaved");
    await user.click(screen.getByRole("tab", { name: /Analysis/ }));
    await user.selectOptions(
      screen.getByLabelText("Business measure"),
      "engagement",
    );
    await user.click(screen.getByRole("button", { name: "KPI estimate" }));
    await user.click(
      screen.getByRole("button", { name: "Use this finding in the report" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("Use a different finding in the report?"),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("tab", { name: /Executive report/ }));
    expect(headline).toHaveValue("Reviewed executive headline — unsaved");
    await user.click(screen.getByRole("tab", { name: /Analysis/ }));
    await user.click(screen.getByRole("button", { name: "KPI estimate" }));
    await user.click(
      screen.getByRole("button", { name: "Use this finding in the report" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Use selected finding",
      }),
    );
    expect(
      screen.getByRole("tab", { name: /Executive report/ }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Lead business measure")).toHaveValue(
      "engagement",
    );
    expect(
      screen.getByRole("checkbox", { name: "Technical appendix" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Include a modelled KPI scenario" }),
    ).toBeChecked();
  });
  it("does not replay a finding request over saved edits after switching runs", async () => {
    const user = userEvent.setup(),
      first = runFixture(),
      second = { ...runFixture(), id: "second-run" };
    const runs = [first, second];
    const view = render(workspace({ runs }));
    await user.click(screen.getByRole("tab", { name: /Analysis/ }));
    await user.click(screen.getByRole("button", { name: "KPI estimate" }));
    await user.click(
      screen.getByRole("button", { name: "Use this finding in the report" }),
    );
    await user.clear(screen.getByLabelText("Executive headline"));
    await user.type(
      screen.getByLabelText("Executive headline"),
      "Saved finding with reviewed wording",
    );
    await user.click(screen.getByRole("button", { name: "Save report draft" }));
    await waitFor(() =>
      expect(saveOutcomeReportDraftAction).toHaveBeenCalled(),
    );
    const draft = reportDraftSchema.parse(
      vi.mocked(saveOutcomeReportDraftAction).mock.calls[0][3],
    );
    view.rerender(
      workspace({ runs, drafts: [{ runId: first.id, draft, revision: 1 }] }),
    );
    await user.click(screen.getByRole("tab", { name: /Analysis/ }));
    await user.selectOptions(screen.getByLabelText("Analysis run"), second.id);
    await user.selectOptions(screen.getByLabelText("Analysis run"), first.id);
    await user.click(screen.getByRole("tab", { name: /Executive report/ }));
    expect(screen.getByLabelText("Executive headline")).toHaveValue(
      "Saved finding with reviewed wording",
    );
    expect(
      screen.getByRole("button", { name: "Save report draft" }),
    ).toBeDisabled();
  });
  it("lets keyboard users inspect and clear chart observations", async () => {
    const user = userEvent.setup();
    render(
      <OutcomeScatterPlot
        points={[
          { x: 1, y: 65 },
          { x: 5, y: 75 },
        ]}
        xLabel="Score"
        yLabel="Outcome"
        total={2}
      />,
    );
    screen.getByRole("img").focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Score: 1");
    await user.keyboard("{End}");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Outcome: 75");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
