import { afterEach, describe, expect, it, vi } from "vitest";
import { attendanceCountSchema, pendingRowsSchema, readPendingWithDeadline } from "./my-pending-source";
afterEach(() => vi.useRealTimers());
describe("teacher pending readers", () => {
  it.each([null, undefined, "0", -1, 0.5])( "does not infer attendance count from missing/invalid data %s", (value) => {
    expect(attendanceCountSchema.safeParse(value).success).toBe(false);
  });
  it("accepts an explicitly observed zero", () => expect(attendanceCountSchema.parse(0)).toBe(0));
  it("rejects partial work rows rather than treating missing counts as zero", () => {
    expect(pendingRowsSchema.safeParse([{ subject_kind: "plano", em_analise: 1 }]).success).toBe(false);
    expect(pendingRowsSchema.parse([{ subject_kind: "plano", em_analise: 1, ajuste_solicitado: 2 }])).toHaveLength(1);
  });
  it("stalled read rejects after 15000ms", async () => {
    vi.useFakeTimers();
    const result = expect(readPendingWithDeadline(() => new Promise(() => {}))).rejects.toThrow("teacher-pending-timeout");
    await vi.advanceTimersByTimeAsync(15_000); await result;
  });
});