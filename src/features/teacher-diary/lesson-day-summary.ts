import type { LessonRow, SlotRow } from "./diary-w-source";

/** A lesson record and a timetable block are different units; no workload inferred. */
export function lessonDaySummary(on: string, lessons: readonly LessonRow[] | null, slots: readonly SlotRow[] | null) {
  const day = lessons?.filter((lesson) => lesson.lesson_date === on) ?? null;
  if (day && new Set(day.map((lesson) => lesson.logical_record_id)).size !== day.length) throw new Error("diary-summary-conflicting-lessons");
  const planned = slots ? new Set(slots.filter((slot) => slot.block_state === "utilizavel").map((slot) => slot.block_id)) : null;
  const linked = day ? new Set(day.flatMap((lesson) => lesson.schedule_block_ids)) : null;
  return {
    recordedLessons: day?.length ?? null,
    plannedBlocks: planned?.size ?? null,
    recordedPlannedBlocks: planned && linked ? [...planned].filter((id) => linked.has(id)).length : null,
    unlinkedLessons: day?.filter((lesson) => lesson.schedule_block_ids.length === 0).length ?? null,
  };
}
