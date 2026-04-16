// @vitest-environment jsdom

import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ForceLightTheme } from "@/components/force-light-theme";

describe("ForceLightTheme", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
  });

  it("removes the dark class from <html> on mount", () => {
    document.documentElement.classList.add("dark");
    render(<ForceLightTheme />);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("restores the dark class on unmount when it was set before mount", () => {
    document.documentElement.classList.add("dark");
    const { unmount } = render(<ForceLightTheme />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    unmount();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("");
  });

  it("does not add the dark class on unmount if it was not set before mount", () => {
    // html is already light
    const { unmount } = render(<ForceLightTheme />);
    unmount();

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("renders nothing visible", () => {
    const { container } = render(<ForceLightTheme />);
    expect(container.firstChild).toBeNull();
  });
});
