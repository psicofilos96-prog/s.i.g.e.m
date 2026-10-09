/**
 * NDIARY.FINAL.2 — leitura das impressões do Diário com a sessão do usuário (RLS decide).
 * Uma consulta por fonte, sem N+1: versões são reduzidas à cabeça de cada cadeia lógica.
 */
import { supabase } from "@/integrations/supabase/client";
import { reviewsOf } from "@/features/teacher-review/teacher-work-review";
import type { DiaryPrintData } from "./diary-prints";
import { readPages } from "@/lib/list-paging";

/** Lê tudo em páginas; impressão incompleta é recusada, nunca impressa como se fosse total. */
async function all(build: (f: number, t: number) => PromiseLike<Q>, max: number): Promise<Q> {
  const r = await readPages(build as never, max);
  if (r.truncated) return { data: null, error: { message: "truncated" } };
  return r as Q;
}

/** Mantém só a maior versão de cada chave lógica. */
export function heads<T>(rows: readonly T[], key: (r: T) => string, version: (r: T) => number): T[] {
  const m = new Map<string, T>();
  for (const r of rows) { const k = key(r); const c = m.get(k); if (!c || version(c) < version(r)) m.set(k, r); }
  return [...m.values()];
}

type Q = { data: unknown[] | null; error: { message: string } | null };
const ok = (r: Q, what: string) => { if (r.error) throw new Error(`Não foi possível ler ${what} com o seu acesso.`); return (r.data ?? []) as Record<string, unknown>[]; };
const s = (x: unknown) => (x === null || x === undefined ? null : String(x));

function contentOf(facts: unknown): string | null {
  const f = (facts ?? {}) as { contents?: Record<string, string> };
  const text = Object.values(f.contents ?? {}).filter(Boolean).join(" · ");
  return text || null;
}

export async function loadDiaryPrintData(a: { classId: string; assignmentId: string | null; period: { id: string | null; label: string | null; from: string; to: string } }): Promise<DiaryPrintData> {
  const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, p: object) => any };
  const [cls, eps, les, att, pl, ass] = await Promise.all([
    db.from("institutional_classes").select("name, school_label_snapshot").eq("id", a.classId).limit(1),
    all((f, t) => db.from("class_enrollment_episodes").select("student_id").eq("class_id", a.classId).order("id").range(f, t), 1000),
    all((f, t) => db.from("lesson_record_versions").select("logical_record_id, version_number, lesson_date, facts").eq("class_id", a.classId).gte("lesson_date", a.period.from).lte("lesson_date", a.period.to).order("id").range(f, t), 5000),
    all((f, t) => db.from("attendance_record_versions").select("logical_attendance_id, lesson_logical_id, version_number, marks").eq("class_id", a.classId).order("id").range(f, t), 5000),
    all((f, t) => db.from("teaching_plan_versions").select("plan_id, version, title, status, covers_from, covers_until").eq("class_id", a.classId).order("id").range(f, t), 2000),
    all((f, t) => db.from("assessment_entry_versions").select("logical_entry_id, version_number, instrument_id, student_id, value_label, value, period_id").eq("class_id", a.classId).order("id").range(f, t), 20000),
  ]);
  const c = ok(cls, "a turma")[0] ?? {};
  const studentIds = [...new Set(ok(eps, "a enturmação").map((r) => String(r["student_id"])))];
  const names = studentIds.length ? ok(await db.from("institutional_students").select("id, display_name").in("id", studentIds), "os estudantes") : [];
  const nameOf = new Map(names.map((r) => [String(r["id"]), s(r["display_name"])]));
  const lessons = heads(ok(les, "os registros de aula"), (r) => String(r["logical_record_id"]), (r) => Number(r["version_number"])).map((r) => ({
    logicalId: String(r["logical_record_id"]), date: String(r["lesson_date"]), version: Number(r["version_number"]),
    quantity: Number(((r["facts"] ?? {}) as { quantity?: number }).quantity ?? 0), content: contentOf(r["facts"]),
  }));
  const dateOf = new Map(lessons.map((l) => [l.logicalId, l.date]));
  const attendance = heads(ok(att, "a frequência"), (r) => String(r["logical_attendance_id"]), (r) => Number(r["version_number"]))
    .filter((r) => dateOf.has(String(r["lesson_logical_id"])))
    .flatMap((r) => Object.entries((r["marks"] ?? {}) as Record<string, Record<string, string>>).map(([slot, marks]) => ({
      lessonLogicalId: `${r["lesson_logical_id"]}#${slot}`, date: dateOf.get(String(r["lesson_logical_id"]))!, marks })));
  const plans = heads(ok(pl, "o planejamento"), (r) => String(r["plan_id"]), (r) => Number(r["version"])).map((r) => ({
    title: s(r["title"]), status: s(r["status"]), from: s(r["covers_from"]), until: s(r["covers_until"]), version: Number(r["version"]) }));
  const assessments = heads(ok(ass, "as avaliações"), (r) => String(r["logical_entry_id"]), (r) => Number(r["version_number"]))
    .filter((r) => !a.period.id || r["period_id"] === a.period.id)
    .map((r) => ({ instrument: String(r["instrument_id"]), studentId: String(r["student_id"]), value: s(r["value_label"] ?? r["value"]) }));
  let closing: DiaryPrintData["closing"] = { state: null, orientacaoAt: null, direcaoAt: null };
  if (a.assignmentId && a.period.id) {
    const st = await db.rpc("teacher_diary_state_at", { _assignment: a.assignmentId, _period: a.period.id });
    if (st.error) throw new Error("Não foi possível ler a situação de fechamento do período.");
    const row = (st.data ?? [])[0];
    if (row) closing = { state: s(row.state), orientacaoAt: s(row.orientacao_approved_at), direcaoAt: s(row.direcao_approved_at) };
  }
  const reviews: DiaryPrintData["reviews"] = [];
  for (const p of heads(ok(pl, "o planejamento"), (r) => String(r["plan_id"]), (r) => Number(r["version"])).slice(0, 20)) {
    const ev = await reviewsOf("plano", String(p["plan_id"])).catch(() => []);
    for (const e of ev) reviews.push({ subject: `Plano: ${s(p["title"]) ?? "sem título"}`, event: e.event, at: e.recorded_at, comment: e.comment });
  }
  return {
    school: s(c["school_label_snapshot"]), className: s(c["name"]),
    period: { label: a.period.label, from: a.period.from, to: a.period.to },
    students: studentIds.map((id) => ({ id, name: nameOf.get(id) ?? null })).sort((x, y) => (x.name ?? "").localeCompare(y.name ?? "", "pt-BR")),
    lessons, attendance, plans, assessments, closing, reviews,
  };
}
