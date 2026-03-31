// @vitest-environment jsdom

import { act } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimatedNumber } from "@/components/animated-number";

describe("AnimatedNumber", () => {
  let frameTime = 0;
  let frameQueue: FrameRequestCallback[] = [];

  function flushFrame(time: number) {
    frameTime = time;
    const callback = frameQueue.shift();
    if (!callback) {
      throw new Error("Expected a queued animation frame.");
    }
    callback(time);
  }

  beforeEach(() => {
    frameTime = 0;
    frameQueue = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        frameQueue.push(callback);
        return frameQueue.length;
      })
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(performance, "now").mockImplementation(() => frameTime);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the initial value without scheduling a new animation", () => {
    render(<AnimatedNumber value={12} />);

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("animates from the previous value to the next value", () => {
    const { rerender } = render(<AnimatedNumber value={10} duration={100} />);

    rerender(<AnimatedNumber value={40} duration={100} />);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    act(() => {
      flushFrame(50);
    });
    expect(screen.getByText("36")).toBeInTheDocument();

    act(() => {
      flushFrame(100);
    });
    expect(screen.getByText("40")).toBeInTheDocument();
  });
});
