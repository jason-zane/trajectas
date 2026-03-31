// @vitest-environment jsdom

import { act } from "@testing-library/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoSave } from "@/hooks/use-auto-save";

function Harness({
  initialValue = "Draft",
  delay = 500,
  enabled = true,
  onSave = vi.fn().mockResolvedValue({ success: true }),
}: {
  initialValue?: string;
  delay?: number;
  enabled?: boolean;
  onSave?: (value: string) => Promise<unknown>;
}) {
  const { value, status, handleChange, handleBlur, retry, isDirty } = useAutoSave({
    initialValue,
    delay,
    enabled,
    onSave,
  });

  return (
    <div>
      <input aria-label="auto-save-field" value={value} onChange={handleChange} onBlur={handleBlur} />
      <button type="button" onClick={retry}>
        Retry
      </button>
      <output data-testid="status">{status}</output>
      <output data-testid="dirty">{isDirty ? "dirty" : "clean"}</output>
    </div>
  );
}

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces a save and clears dirty state after success", async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });
    render(<Harness delay={400} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("auto-save-field"), {
      target: { value: "Published" },
    });

    expect(screen.getByTestId("dirty")).toHaveTextContent("dirty");

    await act(async () => {
      vi.advanceTimersByTime(399);
    });
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith("Published");
    expect(screen.getByTestId("status")).toHaveTextContent("saved");
    expect(screen.getByTestId("dirty")).toHaveTextContent("clean");

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
  });

  it("saves immediately on blur and can retry after an error", async () => {
    const onSave = vi
      .fn()
      .mockResolvedValueOnce({ error: "Nope" })
      .mockResolvedValueOnce({ success: true });

    render(<Harness delay={5000} onSave={onSave} />);

    const field = screen.getByLabelText("auto-save-field");
    fireEvent.change(field, { target: { value: "Needs review" } });

    await act(async () => {
      fireEvent.blur(field);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("error");
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("status")).toHaveTextContent("saved");
  });

  it("does not save while disabled", async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });
    render(<Harness enabled={false} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("auto-save-field"), {
      target: { value: "Ignored" },
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId("dirty")).toHaveTextContent("dirty");
  });
});
