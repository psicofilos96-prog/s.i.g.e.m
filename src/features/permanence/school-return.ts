// L14 — Retorno à escola e acolhimento (migration 0402).
// O retorno é um FATO do caso que referencia matrícula/enturmação oficiais já
// existentes; nunca cria presença, matrícula, enturmação nem alteração acadêmica.

export interface OfficialEpisode {
  id: string; studentId: string; schoolId: string; enrollmentId: string; classId: string;
  validFrom: string; endedOn: string | null; superseded: boolean;
}
export interface ReturnInput {
  caseStudentId: string; caseSchoolId: string; caseOpenedOn: string;
  returnedOn: string; today: string; episode: OfficialEpisode | null;
  welcomeNote: string | null; idempotencyKey: string;
}
export type ReturnIssue = "invalid-date" | "no-official-allocation" | "welcome-note-too-short" | "missing-key";

export function returnIssues(i: ReturnInput): ReturnIssue[] {
  const out: ReturnIssue[] = [];
  if (!i.idempotencyKey.trim()) out.push("missing-key");
  if (i.returnedOn > i.today || i.returnedOn < i.caseOpenedOn) out.push("invalid-date");
  const e = i.episode;
  if (!e || e.studentId !== i.caseStudentId || e.schoolId !== i.caseSchoolId || e.validFrom > i.returnedOn
      || e.superseded || (e.endedOn !== null && e.endedOn < i.returnedOn)) out.push("no-official-allocation");
  if (i.welcomeNote !== null && i.welcomeNote.trim() !== "" && i.welcomeNote.trim().length < 10) out.push("welcome-note-too-short");
  return out;
}

/** O efeito do registro é só o próprio fato; nenhum writer acadêmico é chamado. */
export const RETURN_WRITES = ["permanence_returns"] as const;
export const RETURN_NEVER_WRITES = [
  "attendance_record_versions", "cycle_participations", "class_enrollment_episodes", "academic_standing_versions",
] as const;

export function recordReturn(rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>,
  caseId: string, i: ReturnInput) {
  const issues = returnIssues(i);
  if (issues.length) return Promise.resolve({ ok: false as const, issues });
  return rpc("record_permanence_return", {
    _case: caseId, _returned_on: i.returnedOn, _episode: i.episode!.id,
    _welcome_note: i.welcomeNote, _key: i.idempotencyKey,
  }).then((r) => r.error ? { ok: false as const, issues: [] as ReturnIssue[], error: r.error.message } : { ok: true as const, id: String(r.data) });
}
