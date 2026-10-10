/**
 * LOTE 2/14 — Ficha escolar do aluno (2026). Projeção pura de leituras feitas com a sessão (RLS decide o alcance).
 * Nada é gravado; campo ausente é `null` e aparece como "não informado"; situação nunca é inferida além do fato
 * (vigente = episódio sem encerramento), porque aprovação/conclusão exige regra homologada.
 */
import { supabase } from "@/integrations/supabase/client";

export type Source = "carga-educacenso-2026" | "registro-sigem";
export type EnrollmentRow = { id: string; school_id: string; opened_on: string | null; institutional_number: string | null; technical_operation_id: string | null; supersedes_id: string | null };
export type EpisodeRow = { id: string; enrollment_id: string; school_id: string; class_id: string; class_label_snapshot: string | null; valid_from: string | null; supersedes_id: string | null; ending: { ended_on: string; reason_label: string | null } | null };
export type ClassRow = { id: string; name: string | null; code: string | null; school_label_snapshot: string | null; academic_year_label: string | null; stage_label_snapshot: string | null };
export type DeclRow = { class_id: string; field: string; value_text: string | null };
export type DayRow = { class_id: string | null; stage_literal: string | null; schedule_literal: string | null; weekly_load_literal: string | null };

export type Section<T> = { state: "ok"; value: T } | { state: "unavailable" };

export type StudentRecord = {
  id: string; name: string; identifier: string | null;
  enrollments: Array<{
    id: string; schoolId: string; schoolLabel: string | null; openedOn: string | null; number: string | null; source: Source;
    classes: Array<{
      episodeId: string; classId: string; label: string; year: string | null; stage: string | null; classType: string | null;
      aee: boolean; schedule: string | null; weeklyLoad: string | null; validFrom: string | null;
      situation: { kind: "vigente" } | { kind: "encerrado"; on: string; reason: string | null };
    }>;
  }>;
  missing: string[];
};

/** Mantém só a versão vigente de cada cadeia (linha que nenhuma outra substitui). */
export function heads<T extends { id: string; supersedes_id: string | null }>(rows: T[]): T[] {
  const superseded = new Set(rows.map((r) => r.supersedes_id).filter(Boolean));
  return rows.filter((r) => !superseded.has(r.id));
}

export function buildStudentRecord(input: {
  student: { id: string; display_name: string; institutional_identifier: string | null };
  enrollments: EnrollmentRow[]; episodes: EpisodeRow[]; classes: ClassRow[]; decls: DeclRow[]; days: DayRow[];
}): StudentRecord {
  const cls = new Map(input.classes.map((c) => [c.id, c]));
  const decl = (classId: string, field: string) => input.decls.find((d) => d.class_id === classId && d.field === field)?.value_text?.trim() || null;
  const day = (classId: string) => input.days.find((d) => d.class_id === classId) ?? null;
  const eps = heads(input.episodes);
  const enrollments = heads(input.enrollments).map((e) => {
    const mine = eps.filter((p) => p.enrollment_id === e.id);
    const schoolLabel = mine.map((p) => cls.get(p.class_id)?.school_label_snapshot).find(Boolean) ?? null;
    return {
      id: e.id, schoolId: e.school_id, schoolLabel, openedOn: e.opened_on, number: e.institutional_number,
      source: (e.technical_operation_id ? "carga-educacenso-2026" : "registro-sigem") as Source,
      classes: mine.map((p) => {
        const c = cls.get(p.class_id);
        const classType = decl(p.class_id, "Tipo de turma");
        const d = day(p.class_id);
        return {
          episodeId: p.id, classId: p.class_id,
          label: c?.name ?? c?.code ?? p.class_label_snapshot ?? "Turma (nome não visível)",
          year: c?.academic_year_label ?? null,
          stage: decl(p.class_id, "Etapa de ensino") ?? c?.stage_label_snapshot ?? d?.stage_literal ?? null,
          classType, aee: !!classType && /AEE|atendimento educacional especializado/i.test(classType),
          schedule: d?.schedule_literal ?? null, weeklyLoad: d?.weekly_load_literal ?? null, validFrom: p.valid_from,
          situation: p.ending ? { kind: "encerrado" as const, on: p.ending.ended_on, reason: p.ending.reason_label } : { kind: "vigente" as const },
        };
      }),
    };
  });
  const missing: string[] = [];
  if (!input.student.institutional_identifier) missing.push("Código institucional");
  if (enrollments.some((e) => !e.openedOn)) missing.push("Data de ingresso na escola (a fonte não declara)");
  if (enrollments.flatMap((e) => e.classes).some((c) => !c.validFrom)) missing.push("Início na turma (a fonte não declara)");
  missing.push("Data de nascimento, filiação, responsáveis e documentos (não fazem parte desta ficha)");
  return { id: input.student.id, name: input.student.display_name, identifier: input.student.institutional_identifier, enrollments, missing };
}

/** Lê com a sessão; recusa de RLS = aluno inexistente para quem consulta (null). */
export async function loadStudentRecord(id: string, signal?: AbortSignal): Promise<StudentRecord | null> {
  const s = await supabase.from("institutional_students").select("id, display_name, institutional_identifier").eq("id", id).maybeSingle().abortSignal(signal as AbortSignal);
  if (s.error) throw new Error("leitura-aluno");
  if (!s.data) return null;
  const [en, ep] = await Promise.all([
    supabase.from("school_enrollments").select("id, school_id, opened_on, institutional_number, technical_operation_id, supersedes_id").eq("student_id", id).abortSignal(signal as AbortSignal),
    supabase.from("class_enrollment_episodes").select("id, enrollment_id, school_id, class_id, class_label_snapshot, valid_from, supersedes_id, class_enrollment_episode_endings(ended_on, reason_label)").eq("student_id", id).abortSignal(signal as AbortSignal),
  ]);
  if (en.error || ep.error) throw new Error("leitura-matriculas");
  const episodes: EpisodeRow[] = (ep.data ?? []).map((r) => {
    const end = (r.class_enrollment_episode_endings as unknown as Array<{ ended_on: string; reason_label: string | null }> | null)?.[0] ?? null;
    return { id: r.id, enrollment_id: r.enrollment_id, school_id: r.school_id, class_id: r.class_id, class_label_snapshot: r.class_label_snapshot, valid_from: r.valid_from, supersedes_id: r.supersedes_id, ending: end };
  });
  const classIds = [...new Set(episodes.map((e) => e.class_id))];
  const [c, d, o] = classIds.length ? await Promise.all([
    supabase.from("institutional_classes").select("id, name, code, school_label_snapshot, academic_year_label, stage_label_snapshot").in("id", classIds).abortSignal(signal as AbortSignal),
    supabase.from("class_census_declarations").select("class_id, field, value_text").in("class_id", classIds).in("field", ["Tipo de turma", "Etapa de ensino"]).abortSignal(signal as AbortSignal),
    supabase.from("student_school_day_observations").select("class_id, stage_literal, schedule_literal, weekly_load_literal").eq("student_id", id).abortSignal(signal as AbortSignal),
  ]) : [{ data: [] }, { data: [] }, { data: [] }] as const;
  return buildStudentRecord({
    student: s.data, enrollments: (en.data ?? []) as EnrollmentRow[], episodes,
    classes: ((c as { data: ClassRow[] | null }).data ?? []), decls: ((d as { data: DeclRow[] | null }).data ?? []), days: ((o as { data: DayRow[] | null }).data ?? []),
  });
}
