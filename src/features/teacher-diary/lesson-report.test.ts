import { describe, expect, it } from "vitest";
import { lessonReport } from "./lesson-report";
import type { LessonRow, MyDiary } from "./diary-w-source";
const diary = { assignment_id: "regencia", substitution_id: null } as MyDiary;
const lesson = (id: string, date: string): LessonRow => ({
  lesson_version_id: id, logical_record_id: id, version_number: 2, lesson_date: date,
  facts: { content: "Frações", observation: "Texto longo " .repeat(1000) }, schedule_block_ids: [], period_id: null,
  recorded_as: "titular", attendance_version_id: "private", attendance_version_number: 1,
  marks: { aula: { "private-student": "Ausente" } }, eligible_student_ids: ["private-student"], reference_item_ids: [], reference_edition_ids: [],
});
describe("teacher lesson report data boundary", () => {
  it("exports recorded lesson versions without student marks or identities", () => {
    const result = lessonReport(diary, [lesson("v2", "2026-03-03"), lesson("v1", "2026-03-02")]);
    expect(result.rows.map((r) => r[0])).toEqual(["2026-03-02", "2026-03-03"]);
    expect(result.rows[0]?.[3]).toBe(2); expect(JSON.stringify(result)).not.toContain("private-student");
    expect(result.rows[0]?.[2]).toBe("Texto longo ".repeat(1000));
  });
  it("refuses unread and conflicting current-version sources", () => {
    expect(() => lessonReport(diary, null)).toThrow();
    expect(() => lessonReport(diary, [lesson("same", "2026-03-02"), lesson("same", "2026-03-03")])).toThrow();
  });
  it("preserves missing content as null rather than zero", () => {
    const row = lesson("v", "2026-03-02"); row.facts = {};
    expect(lessonReport(diary, [row]).rows[0]?.slice(1, 3)).toEqual([null, null]);
  });
});