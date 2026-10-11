/**
 * Livro do Diário — leitura com a sessão de quem imprime (RLS decide). Uma consulta por fonte, paginada
 * acima de 1000 linhas; versão vigente de cada cadeia lógica. Nada é inventado: sem fonte, a célula fica "—".
 */
import { supabase } from "@/integrations/supabase/client";
import { readPages } from "@/lib/list-paging";
import { studentsFrom, type EndingRow, type EpisodeRow } from "../final-sheet-cloud";
import { heads } from "../diary-prints-cloud";
import { isModelColumn, type BookInput, type BookPeriod, type ExperienceEntry, type GradeEntry } from "./book";
import type { FamilyId } from "./families";

type Row = Record<string, unknown>;
type Db = { from: (t: string) => any };
const db = supabase as unknown as Db;

async function all(what: string, build: (f: number, t: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, max = 20000): Promise<Row[]> {
  const r = await readPages(build as never, max);
  if (r.error) throw new Error(`Não foi possível ler ${what} com o seu acesso.`);
  if (r.truncated) throw new Error(`Há mais ${what} do que o limite de impressão; filtre o período.`);
  return (r.data ?? []) as Row[];
}
const str = (x: unknown) => (x === null || x === undefined ? null : String(x));

export type ClassInfo = { id: string; name: string | null; school: string | null; stage: string | null; yearId: string | null; yearLabel: string | null };
export type PeriodOption = { id: string; label: string; from: string; to: string };

export async function readClassInfo(classId: string): Promise<ClassInfo> {
  const r = await db.from("institutional_classes").select("id,name,school_label_snapshot,stage_label_snapshot,academic_year_id,academic_year_label").eq("id", classId).limit(1);
  if (r.error) throw new Error("Não foi possível ler a turma com o seu acesso.");
  const c = (r.data ?? [])[0] as Row | undefined;
  if (!c) throw new Error("Turma não visível com o seu acesso.");
  return { id: classId, name: str(c["name"]), school: str(c["school_label_snapshot"]), stage: str(c["stage_label_snapshot"]), yearId: str(c["academic_year_id"]), yearLabel: str(c["academic_year_label"]) };
}

/** Períodos letivos cadastrados do ano da turma (sugestão editável; ausência ⇒ o usuário informa as datas). */
export async function readYearPeriods(yearId: string | null): Promise<PeriodOption[]> {
  if (!yearId) return [];
  const r = await db.from("institutional_academic_periods").select("id,label,starts_on,ends_on").eq("academic_year_id", yearId).order("starts_on").limit(50);
  if (r.error) return [];
  return ((r.data ?? []) as Row[]).filter((x) => x["starts_on"] && x["ends_on"]).map((x) => ({ id: String(x["id"]), label: String(x["label"] ?? "Período"), from: String(x["starts_on"]), to: String(x["ends_on"]) }));
}

const indexOf = (periods: readonly BookPeriod[], date: string | null) => (date ? periods.findIndex((p) => date >= p.from && date <= p.to) : -1);

export async function loadBookInput(a: { family: FamilyId; classId: string; componentId: string | null; periods: readonly BookPeriod[]; teacher: string | null; shift: string | null; rule: BookInput["rule"] }): Promise<{ input: BookInput; info: ClassInfo }> {
  const info = await readClassInfo(a.classId);
  const from = a.periods.reduce((m, p) => (p.from < m ? p.from : m), "9999-12-31");
  const to = a.periods.reduce((m, p) => (p.to > m ? p.to : m), "0000-01-01");
  const [eps, les, att, ins, ent, rep] = await Promise.all([
    all("as enturmações", (f, t) => db.from("class_enrollment_episodes").select("id,student_id,supersedes_id,valid_from").eq("class_id", a.classId).order("id").range(f, t), 5000),
    all("os registros de aula", (f, t) => db.from("lesson_record_versions").select("logical_record_id,version_number,lesson_date,component_id,facts").eq("class_id", a.classId).gte("lesson_date", from).lte("lesson_date", to).order("id").range(f, t)),
    all("as chamadas", (f, t) => db.from("attendance_record_versions").select("logical_attendance_id,lesson_logical_id,version_number,component_id,marks,eligible_student_ids").eq("class_id", a.classId).order("id").range(f, t)),
    all("os instrumentos", (f, t) => db.from("assessment_instruments").select("id,period_id,planned_on,definition").eq("class_id", a.classId).order("id").range(f, t), 5000),
    all("os resultados", (f, t) => db.from("assessment_entry_versions").select("logical_entry_id,version_number,instrument_id,student_id,value").eq("class_id", a.classId).order("id").range(f, t), 50000),
    all("os pareceres", (f, t) => db.from("descriptive_report_versions").select("logical_report_id,version_number,student_id,period_id,report_text,objective_ids,officialized_at").eq("class_id", a.classId).order("id").range(f, t), 10000),
  ]);
  const ids = eps.map((e) => String(e["id"]));
  const studentIds = [...new Set(eps.map((e) => String(e["student_id"])))];
  const [endings, names] = await Promise.all([
    ids.length ? all("os encerramentos", (f, t) => db.from("class_enrollment_episode_endings").select("episode_id,ended_on,reason_label").in("episode_id", ids).order("episode_id").range(f, t), 5000) : Promise.resolve([] as Row[]),
    studentIds.length ? all("os estudantes", (f, t) => db.from("institutional_students").select("id,display_name").in("id", studentIds).order("id").range(f, t), 5000) : Promise.resolve([] as Row[]),
  ]);
  const students = studentsFrom(eps as unknown as EpisodeRow[], endings as unknown as EndingRow[], new Map(names.map((r) => [String(r["id"]), String(r["display_name"] ?? "")])));

  const lessons = heads(les, (r) => String(r["logical_record_id"]), (r) => Number(r["version_number"]));
  const lessonOf = new Map(lessons.map((l) => [String(l["logical_record_id"]), l]));
  const contentOf = (facts: unknown) => { const f = (facts ?? {}) as { content?: string; contents?: Record<string, string> }; const t = [f.content, ...Object.values(f.contents ?? {})].filter(Boolean).join(" · "); return t || null; };
  const attendance = heads(att, (r) => String(r["logical_attendance_id"]), (r) => Number(r["version_number"])).flatMap((r) => {
    const l = lessonOf.get(String(r["lesson_logical_id"])); if (!l) return [];
    const eligible = ((r["eligible_student_ids"] ?? []) as string[]);
    return Object.values((r["marks"] ?? {}) as Record<string, Record<string, string>>).map((marks) => ({ componentId: str(r["component_id"]), date: String(l["lesson_date"]), marks, eligible }));
  });

  const periodIds = [...new Set([...ins.map((x) => str(x["period_id"])), ...rep.map((x) => str(x["period_id"]))].filter((x): x is string => !!x))];
  const pr = periodIds.length ? await db.from("institutional_academic_periods").select("id,starts_on").in("id", periodIds) : { data: [], error: null };
  const periodStart = new Map(((pr.data ?? []) as Row[]).map((x) => [String(x["id"]), str(x["starts_on"])]));

  const instruments = new Map(ins.map((x) => [String(x["id"]), x]));
  const unclassified: { id: string; title: string }[] = [];
  const instrumentMeta = new Map<string, { column: GradeEntry["column"]; componentId: string | null; periodIndex: number | null }>();
  for (const [id, x] of instruments) {
    const d = (x["definition"] ?? {}) as { modelColumn?: unknown; title?: string; appliedOn?: string; curriculumRef?: { componentId?: string } };
    const componentId = d.curriculumRef?.componentId ?? null;
    if (!isModelColumn(d.modelColumn)) { unclassified.push({ id, title: d.title ?? id }); continue; }
    const k = indexOf(a.periods, str(x["planned_on"]) ?? d.appliedOn ?? periodStart.get(String(x["period_id"])) ?? null);
    instrumentMeta.set(id, { column: d.modelColumn, componentId, periodIndex: d.modelColumn === "rf" ? null : k < 0 ? null : k });
  }
  const grades: GradeEntry[] = heads(ent, (r) => String(r["logical_entry_id"]), (r) => Number(r["version_number"])).flatMap((r) => {
    const m = instrumentMeta.get(String(r["instrument_id"])); if (!m || !m.componentId) return [];
    if (m.column !== "rf" && m.periodIndex === null) return [];
    const v = r["value"] as { kind?: string; value?: number } | null;
    const numeric = v?.kind === "numerica" && typeof v.value === "number";
    return [{ componentId: m.componentId, studentId: String(r["student_id"]), column: m.column, periodIndex: m.periodIndex, value: numeric ? v!.value! : null, notRecorded: v?.kind === "nao-registrado" }];
  });

  const objIds = [...new Set(rep.flatMap((r) => (r["objective_ids"] ?? []) as string[]))];
  const objs = objIds.length ? await db.from("curriculum_objectives").select("id,code").in("id", objIds) : { data: [] };
  const code = new Map(((objs.data ?? []) as Row[]).map((o) => [String(o["id"]), String(o["code"] ?? o["id"])]));
  const experiences: ExperienceEntry[] = heads(rep, (r) => String(r["logical_report_id"]), (r) => Number(r["version_number"])).flatMap((r) => {
    const k = indexOf(a.periods, periodStart.get(String(r["period_id"])) ?? str(r["officialized_at"])?.slice(0, 10) ?? null);
    if (k < 0) return [];
    return [{ periodIndex: k, studentId: String(r["student_id"]), objectiveCodes: ((r["objective_ids"] ?? []) as string[]).map((x) => code.get(x) ?? x), text: str(r["report_text"]) }];
  });

  const compIds = [...new Set([...attendance.map((x) => x.componentId), ...grades.map((g) => g.componentId), ...lessons.map((l) => str(l["component_id"])), a.componentId].filter((x): x is string => !!x))];
  const cr = compIds.length ? await db.from("institutional_curricular_components").select("id,label").in("id", compIds) : { data: [] };
  const label = new Map(((cr.data ?? []) as Row[]).map((c) => [String(c["id"]), String(c["label"] ?? c["id"])]));
  const components = compIds.filter((id) => !a.componentId || id === a.componentId || a.family !== "componente-fii-eja").map((id) => ({ id, label: label.get(id) ?? "Componente sem rótulo visível" }));

  const input: BookInput = {
    family: a.family,
    header: { school: info.school, className: info.name, stage: info.stage, shift: a.shift, teacher: a.teacher, yearLabel: info.yearLabel },
    components, componentId: a.componentId, periods: a.periods, students, attendance,
    lessons: lessons.map((l) => ({ componentId: str(l["component_id"]), date: String(l["lesson_date"]), content: contentOf(l["facts"]) })),
    grades, experiences, rule: a.rule, unclassified,
  };
  return { input, info };
}

/** Regras de resultado (Folha Final) visíveis com a sessão; a escolha da aplicável é `applicableRule`. */
export async function readResultRules() {
  const rows = await all("as regras de resultado", (f, t) => db.from("final_sheet_rule_versions").select("id,logical_id,version,label,scope,params,source_ref,status").order("id").range(f, t), 5000);
  return rows as unknown as import("../final-sheet-cloud").RuleRow[];
}
