import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DIARY_SAVE_TIMEOUT_MS, useDiarySave } from "./use-diary-save";

afterEach(() => { cleanup(); vi.useRealTimers(); });
const version = "12345678-1234-4234-8234-123456789012";
describe("Diary writer confirmation", () => {
  it("sends once on repeated clicks and confirms a version identifier", async () => {
    let resolve: (id: string) => void = () => {};
    const write = vi.fn(() => new Promise<string>((r) => { resolve = r; }));
    const confirmed = vi.fn(); const { result } = renderHook(() => useDiarySave(confirmed));
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.submit(write); void result.current.submit(write); });
    expect(write).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(version); await pending; });
    expect(confirmed).toHaveBeenCalledTimes(1);
  });
  it("bounds the wait at 15 seconds and retries the original payload, never a replacement", async () => {
    vi.useFakeTimers(); const confirmed = vi.fn();
    const original = vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValueOnce(version);
    const replacement = vi.fn().mockResolvedValue(version);
    const { result } = renderHook(() => useDiarySave(confirmed));
    act(() => { void result.current.submit(original); });
    await act(async () => { await vi.advanceTimersByTimeAsync(DIARY_SAVE_TIMEOUT_MS); });
    expect(DIARY_SAVE_TIMEOUT_MS).toBe(15_000); expect(result.current.status).toBe("unknown");
    expect(confirmed).not.toHaveBeenCalled(); expect(result.current.locked).toBe(true);
    await act(async () => { await result.current.submit(replacement); });
    expect(original).toHaveBeenCalledTimes(2); expect(replacement).not.toHaveBeenCalled(); expect(confirmed).toHaveBeenCalledTimes(1);
  });
  it("does not confirm a malformed server response", async () => {
    const confirmed = vi.fn(); const { result } = renderHook(() => useDiarySave(confirmed));
    await act(async () => { await result.current.submit(async () => ""); });
    expect(result.current.status).toBe("unknown"); expect(confirmed).not.toHaveBeenCalled();
  });
  it("preserves editing after a declared server rejection without calling success", async () => {
    const confirmed = vi.fn(); const { result } = renderHook(() => useDiarySave(confirmed));
    await act(async () => { await result.current.submit(async () => { throw new Error("diary:stale-head"); }); });
    expect(result.current.locked).toBe(false); expect(result.current.message).toContain("Recarregue"); expect(confirmed).not.toHaveBeenCalled();
  });
  it("ignores confirmation after the account workspace unmounts", async () => {
    let resolve: (id: string) => void = () => {}; const confirmed = vi.fn();
    const { result, unmount } = renderHook(() => useDiarySave(confirmed));
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.submit(() => new Promise((r) => { resolve = r; })); });
    unmount(); await act(async () => { resolve(version); await pending; });
    expect(confirmed).not.toHaveBeenCalled();
  });
});