// @vitest-environment jsdom

import { act } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScrollReveal } from "@/components/scroll-reveal";

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ScrollReveal", () => {
  it("renders immediately when reduced motion is preferred", () => {
    mockMatchMedia(true);

    render(<ScrollReveal>Visible immediately</ScrollReveal>);
    const wrapper = screen.getByText("Visible immediately");

    expect(wrapper).toHaveStyle({ opacity: "1", transform: "translateY(0)" });
  });

  it("reveals content once the observer reports an intersection", () => {
    mockMatchMedia(false);

    let callback: IntersectionObserverCallback | undefined;
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();

    class MockIntersectionObserver {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }

      observe = observe;
      unobserve = unobserve;
      disconnect = disconnect;
    }

    vi.stubGlobal(
      "IntersectionObserver",
      MockIntersectionObserver as unknown as typeof IntersectionObserver
    );

    render(<ScrollReveal>Reveal on scroll</ScrollReveal>);
    const wrapper = screen.getByText("Reveal on scroll");

    expect(wrapper).toHaveStyle({ opacity: "0" });
    expect(observe).toHaveBeenCalledTimes(1);

    act(() => {
      callback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(unobserve).toHaveBeenCalledTimes(1);
    expect(wrapper).toHaveStyle({ opacity: "1", transform: "translateY(0)" });
  });
});
