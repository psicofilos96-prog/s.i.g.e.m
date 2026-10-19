import { parseBoundary, z } from "@/lib/runtime-shape";
import { readLessons, readMyDiaries, readRoster, readSlots, type MyDiary } from "./diary-w-source";

export const DIARY_READ_TIMEOUT_MS = 15_000;
export async function readDiaryWithDeadline<T>(read: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([read(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("diary-read-timeout")), DIARY_READ_TIMEOUT_MS);
    })]);
  } finally { clearTimeout(timer); }
}
const text = z.string();
const id = text.min(1);
const diaries = z.array(z.object({
  role: z.enum(["titular", "substituto"]), assignment_id: id, substitution_id: id.nullable(),
  class_id: id, school_id: id, academic_year_id: id, year_state: text.nullable(), engagement_id: id,
  matrix_id: text.nullable(), item_key: text.nullable(), component_id: text.nullable(), component_label: text.nullable(),
  effective_from: id, effective_until: text.nullable(), assignment_state: text.nullable(),
}));
const slots = z.array(z.object({ block_id: id, block_key: text, starts_at: text, ends_at: text, block_state: text }));
const roster = z.array(z.object({ student_id: id, display_name: text, allocation_valid_from: text, allocation_ended_on: text.nullable() }));
const marks = z.record(text, z.record(text, z.enum(["Presente", "Ausente"])));
const lessons = z.array(z.object({
  lesson_version_id: id, logical_record_id: id, version_number: z.number().int().positive(), lesson_date: id,
  facts: z.object({ content: text.optional(), observation: text.optional() }), schedule_block_ids: z.array(id),
  period_id: text.nullable(), recorded_as: z.enum(["titular", "substituto"]), attendance_version_id: text.nullable(),
  attendance_version_number: z.number().int().positive().nullable(), marks: marks.nullable(),
  eligible_student_ids: z.array(id).nullable(), reference_item_ids: z.array(id), reference_edition_ids: z.array(id),
}));
type Assignment = Pick<MyDiary, "assignment_id" | "substitution_id">;
export const readDiariesSafely = (on: string, knownAt: string) => readDiaryWithDeadline(async () =>
  parseBoundary(diaries, await readMyDiaries(on, knownAt), "teacher-diaries"));
export const readSlotsSafely = (diary: Assignment, on: string) => readDiaryWithDeadline(async () =>
  parseBoundary(slots, await readSlots(diary, on), "teacher-diary-slots"));
export const readLessonsSafely = (diary: Assignment) => readDiaryWithDeadline(async () =>
  parseBoundary(lessons, await readLessons(diary), "teacher-diary-lessons"));
export const readRosterSafely = (diary: Assignment, on: string) => readDiaryWithDeadline(async () =>
  parseBoundary(roster, await readRoster(diary, on), "teacher-diary-roster"));