import { callRpc } from "@/lib/rpc-call";
import { parseBoundary, z } from "@/lib/runtime-shape";

const count = z.number().int().nonnegative();
export const pendingRowsSchema = z.array(z.object({ subject_kind: z.string(), em_analise: count, ajuste_solicitado: count }));
export const attendanceCountSchema = count;
export const PENDING_READ_TIMEOUT_MS = 15_000;

/** Read-only; a late answer cannot replace the rejected attempt. No personal data in errors. */
export async function readPendingWithDeadline<T>(read: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([read(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("teacher-pending-timeout")), PENDING_READ_TIMEOUT_MS);
    })]);
  } finally { clearTimeout(timer); }
}

export const readMyWorkPending = () => readPendingWithDeadline(async () =>
  parseBoundary(pendingRowsSchema, await callRpc<unknown>("my_teacher_work_pending"), "teacher-work-pending"));
export const readMyMissingAttendance = () => readPendingWithDeadline(async () =>
  parseBoundary(attendanceCountSchema, await callRpc<unknown>("my_lessons_without_attendance", { _days: 14 }), "teacher-missing-attendance"));