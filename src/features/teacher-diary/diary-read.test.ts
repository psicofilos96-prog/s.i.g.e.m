import { afterEach, describe, expect, it, vi } from "vitest";
import { DIARY_READ_TIMEOUT_MS, readDiaryWithDeadline, readDiariesSafely, readLessonsSafely, readRosterSafely, readSlotsSafely } from "./diary-read";
const reads = vi.hoisted(() => ({ diaries: vi.fn(), lessons: vi.fn(), roster: vi.fn(), slots: vi.fn() }));
vi.mock("./diary-w-source", () => ({ readMyDiaries: reads.diaries, readLessons: reads.lessons, readRoster: reads.roster, readSlots: reads.slots }));
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
describe("teacher diary reads", () => {
  it("stops a hanging read after 15 seconds", async () => {
    vi.useFakeTimers();
    const result = readDiaryWithDeadline(() => new Promise(() => {}));
    const failure = expect(result).rejects.toThrow("diary-read-timeout");
    expect(DIARY_READ_TIMEOUT_MS).toBe(15_000);
    await vi.advanceTimersByTimeAsync(15_000); await failure;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("clears the deadline on success", async () => {
    vi.useFakeTimers(); expect(await readDiaryWithDeadline(async () => 7)).toBe(7); expect(vi.getTimerCount()).toBe(0);
  });
  const assignment = { assignment_id: "a", substitution_id: null };
  it.each([
    ["diaries", () => readDiariesSafely("2026-10-19", "2026-10-19T12:55:00Z")],
    ["lessons", () => readLessonsSafely(assignment)],
    ["roster", () => readRosterSafely(assignment, "2026-10-19")],
    ["slots", () => readSlotsSafely(assignment, "2026-10-19")],
  ] as const)("rejects malformed %s rather than showing empty data", async (name, read) => {
    reads[name].mockResolvedValue([{ unexpected: true }]); await expect(read()).rejects.toThrow();
  });
  it("preserves an explicit empty source", async () => {
    reads.roster.mockResolvedValue([]); expect(await readRosterSafely(assignment, "2026-10-19")).toEqual([]);
  });
  it("does not convert a failed source to zero rows", async () => {
    reads.lessons.mockRejectedValue(new Error("denied")); await expect(readLessonsSafely(assignment)).rejects.toThrow("denied");
  });
});
