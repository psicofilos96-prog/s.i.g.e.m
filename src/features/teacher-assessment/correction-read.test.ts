import { afterEach, describe, expect, it, vi } from "vitest";
import { CORRECTION_READ_TIMEOUT_MS, readCorrectionKeys, readCorrectionWithDeadline } from "./correction-read";
afterEach(() => vi.useRealTimers());
describe("correction read safety", () => {
  it("rejects an unresponsive read after 15 seconds", async () => {
    vi.useFakeTimers();
    const read = readCorrectionWithDeadline(() => new Promise(() => {}));
    const check = expect(read).rejects.toThrow("correction-read-timeout");
    expect(CORRECTION_READ_TIMEOUT_MS).toBe(15_000);
    await vi.advanceTimersByTimeAsync(15_000); await check;
  });
  it("deduplicates keys and keeps absent answers absent", async () => {
    const read = vi.fn(async (id: string) => id === "a" ? [{ answer: ["B"] }] : []);
    expect(await readCorrectionKeys(["a", "a", "missing"], read)).toEqual(new Map([["a", "B"]]));
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("limits concurrent key reads and preserves canonical values", async () => {
    let active = 0, peak = 0;
    const keys = await readCorrectionKeys(Array.from({ length: 17 }, (_, i) => String(i)), async (id) => {
      active++; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 1)); active--; return [{ answer: id }];
    });
    expect(peak).toBe(6); expect(keys.size).toBe(17); expect(keys.get("16")).toBe("16");
  });
  it("fails the whole key read instead of turning errors into missing keys", async () => {
    await expect(readCorrectionKeys(["a"], async () => { throw new Error("denied"); })).rejects.toThrow("denied");
  });
});