// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { NetworkGraph } from "@/app/(dashboard)/generate/[runId]/network-graph"
import type { GeneratedItem } from "@/types/database"

function createItem(overrides: Partial<GeneratedItem>): GeneratedItem {
  return {
    id: "item-1",
    generationRunId: "run-1",
    constructId: "construct-a",
    stem: "Kept item",
    reverseScored: false,
    rationale: "reason",
    embedding: [],
    communityId: 1,
    initialCommunityId: 1,
    finalCommunityId: 1,
    wtoMax: 0.05,
    bootStability: 0.94,
    isRedundant: false,
    isUnstable: false,
    isAccepted: false,
    created_at: "2026-04-01T00:00:00.000Z",
    removalStage: "kept",
    removalSweep: undefined,
    ...overrides,
  }
}

describe("NetworkGraph", () => {
  it("shows the retained network by default and can switch back to the initial full pool", () => {
    const items: GeneratedItem[] = [
      createItem({ id: "kept", stem: "Kept item" }),
      createItem({
        id: "redundant",
        stem: "Removed by UVA",
        isRedundant: true,
        communityId: 1,
        initialCommunityId: 1,
        finalCommunityId: undefined,
        removalStage: "uva",
        removalSweep: 1,
      }),
      createItem({
        id: "unstable",
        constructId: "construct-b",
        stem: "Removed by boot",
        isUnstable: true,
        communityId: 2,
        initialCommunityId: 2,
        finalCommunityId: undefined,
        removalStage: "boot_ega",
        removalSweep: 1,
      }),
    ]

    render(
      <NetworkGraph
        items={items}
        constructIds={["construct-a", "construct-b"]}
        constructNameMap={new Map([
          ["construct-a", "Construct A"],
          ["construct-b", "Construct B"],
        ])}
        onItemClick={() => {}}
      />,
    )

    expect(screen.getByRole("button", { name: "Final (1)" })).toBeInTheDocument()
    expect(screen.queryByLabelText("Removed by UVA")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Removed by boot")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Kept item")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Initial (3)" }))

    expect(screen.getByLabelText("Kept item")).toBeInTheDocument()
    expect(screen.getByLabelText("Removed by UVA")).toBeInTheDocument()
    expect(screen.getByLabelText("Removed by boot")).toBeInTheDocument()
  })
})
