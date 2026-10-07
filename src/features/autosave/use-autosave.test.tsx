import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAutosave } from "./use-autosave";

describe("useAutosave (N10.2.3)", () => {
  it("salva a última versão após o debounce e faz flush ao desmontar", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => {});
    const { rerender, unmount } = renderHook(({ v }) => useAutosave(v, save, { enabled: true, debounceMs: 500 }), { initialProps: { v: "a" } });
    rerender({ v: "b" }); rerender({ v: "c" });
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith("c");
    rerender({ v: "d" });
    unmount();
    await act(async () => { await Promise.resolve(); });
    expect(save).toHaveBeenLastCalledWith("d");
    vi.useRealTimers();
  });
  it("não salva quando desabilitado (registro concluído)", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => {});
    const { rerender } = renderHook(({ v }) => useAutosave(v, save, { enabled: false, debounceMs: 10 }), { initialProps: { v: "a" } });
    rerender({ v: "b" });
    await act(async () => { vi.advanceTimersByTime(50); });
    expect(save).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
