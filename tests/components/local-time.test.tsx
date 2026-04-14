// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocalTime } from "@/components/local-time";

describe("LocalTime", () => {
  it("renders fallback when iso is null", () => {
    const { container } = render(<LocalTime iso={null} fallback="—" />);
    expect(container.textContent).toBe("—");
  });

  it("renders fallback when iso is undefined", () => {
    const { container } = render(<LocalTime iso={undefined} fallback="N/A" />);
    expect(container.textContent).toBe("N/A");
  });

  it("renders content when iso is provided", () => {
    const iso = "2026-04-10T12:00:00Z";
    const { container } = render(<LocalTime iso={iso} format="date-time" />);
    // Server-render emits iso string as placeholder until client effect runs
    expect(container.textContent?.length).toBeGreaterThan(0);
  });

  it("applies className prop", () => {
    const { container } = render(
      <LocalTime iso={null} fallback="—" className="text-red-500" />
    );
    expect(container.querySelector(".text-red-500")).toBeTruthy();
  });
});
