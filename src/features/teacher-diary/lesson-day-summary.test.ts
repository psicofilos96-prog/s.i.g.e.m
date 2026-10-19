import { describe, expect, it } from "vitest";
import { lessonDaySummary } from "./lesson-day-summary";
import type { LessonRow, SlotRow } from "./diary-w-source";

const lesson = (logical: string, blocks: string[], date = "2026-10-19") => ({ logical_record_id: logical, lesson_date: date, schedule_block_ids: blocks }) as LessonRow;
const slot = (id: string, state = "utilizavel") => ({ block_id: id, block_state: state }) as SlotRow;
describe("daily lesson facts without invented workload", () => {
  it("keeps unread sources unknown independently", () => {
    expect(lessonDaySummary("2026-10-19", null, [slot("a")])).toEqual({ recordedLessons: null, plannedBlocks: 1, recordedPlannedBlocks: null, unlinkedLessons: null });
    expect(lessonDaySummary("2026-10-19", [lesson("one", ["a"])], null)).toEqual({ recordedLessons: 1, plannedBlocks: null, recordedPlannedBlocks: null, unlinkedLessons: 0 });
  });
  it("counts one record covering two blocks separately", () => {
    expect(lessonDaySummary("2026-10-19", [lesson("one", ["a", "b"])], [slot("a"), slot("b")])).toEqual({ recordedLessons: 1, plannedBlocks: 2, recordedPlannedBlocks: 2, unlinkedLessons: 0 });
  });
  it("deduplicates block links and excludes other dates", () => {
    expect(lessonDaySummary("2026-10-19", [lesson("one", ["a", "a"]), lesson("two", ["a"]), lesson("old", ["b"], "2026-10-18")], [slot("a"), slot("a"), slot("b")])).toEqual({ recordedLessons: 2, plannedBlocks: 2, recordedPlannedBlocks: 1, unlinkedLessons: 0 });
  });
  it("preserves unlinked records without inventing missed classes", () => {
    expect(lessonDaySummary("2026-10-19", [lesson("one", []), lesson("two", ["outside"])], [slot("a"), slot("outside", "indisponivel")])).toEqual({ recordedLessons: 2, plannedBlocks: 1, recordedPlannedBlocks: 0, unlinkedLessons: 1 });
  });
  it("zero requires read empty sources", () => {
    expect(lessonDaySummary("2026-10-19", [], [])).toEqual({ recordedLessons: 0, plannedBlocks: 0, recordedPlannedBlocks: 0, unlinkedLessons: 0 });
  });
  it("refuses conflicting current versions", () => {
    expect(() => lessonDaySummary("2026-10-19", [lesson("same", []), lesson("same", ["a"])], [])).toThrow("diary-summary-conflicting-lessons");
  });
});