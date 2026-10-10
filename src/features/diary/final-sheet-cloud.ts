/**
 * Folha Final conectada (0289): turma, estudantes da turma (`class_enrollment_episodes` + encerramentos),
 * resultados avaliativos gravados (`assessment_entry_versions` vigentes) e regra de resultado homologada
 * (`final_sheet_rule_versions`). Tudo lido com a sessão do usuário (RLS). Atos (rascunho → conferência →
 * homologação → retificação/reabertura) só por `record_final_sheet_act`.
 */
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import type { Modality, ResultRule, SheetCell, SheetInput, SheetRow, SheetStudent } from "./final-sheet";
import { cellKey } from "./final-sheet";

export type ClassOption = { id: string; name: string; school: string; schoolId: string; year: string; stage: string | null };
export type EpisodeRow = { id: string; student_id: string; supersedes_id: string | null; valid_from: string };
export type EndingRow = { episode_id: string; ended_on: string; reason_label: string | null };
export type EntryRow = { id: string; logical_entry_id: string; version_number: number; instrument_id: string; student_id: string; period_id: string; value: unknown };
export type InstrumentRow = { id: string; period_id: string; definition: { curriculumRef?: { componentId?: string }; title?: string } | null };
export type RuleRow = { id: string; logical_id: string; version: number; label: string; scope: { modality?: string }; params: { passMark?: number; minAttendance?: number | null }; source_ref: string; status: string };
export type ActRow = { seq: number; action: string; rule_version_id: string | null; snapshot_sha256: string; reason: string | null; actor_id: string; created_at: string };

export const ACTION_LABEL: Record<string, string> = { rascunho: "Rascunho", conferencia: "Conferida", homologacao: "Homologada", retificacao: "Retificada", reabertura: "Reaberta" };
const KNOWN_ENDINGS = new Set(["Transferido", "Evadido", "Cancelado", "Falecido"]);

/** Episódio vigente = não substituído; encerramento vira situação só se o motivo for um dos rótulos do modelo; senão "Encerrado". */
export function studentsFrom(episodes: readonly EpisodeRow[], endings: readonly EndingRow[], names: ReadonlyMap<string, string>): SheetStudent[] {
  const superseded = new Set(episodes.map((e) => e.supersedes_id).filter(Boolean));
  const heads = episodes.filter((e) => !superseded.has(e.id));
  const end = new Map(endings.map((x) => [x.episode_id, x]));
  const byStudent = new Map<string, SheetStudent>();
  for (const e of [...heads].sort((a, b) => a.valid_from.localeCompare(b.valid_from))) {
    const x = end.get(e.id);
    const status = !x ? "Ativo" : x.reason_label && KNOWN_ENDINGS.has(x.reason_label) ? x.reason_label : "Encerrado";
    byStudent.set(e.student_id, { id: e.student_id, name: names.get(e.student_id) ?? "Estudante sem nome visível", status });
  }
  return [...byStudent.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Nota do período por componente só quando há EXATAMENTE um resultado numérico vigente; vários instrumentos ⇒ composição pendente (nunca soma aqui). */
export function cellsFrom(entries: readonly EntryRow[], instruments: readonly InstrumentRow[], periods: readonly string[]) {
  const comp = new Map(instruments.map((i) => [i.id, i.definition?.curriculumRef?.componentId ?? null]));
  const head = new Map<string, EntryRow>();
  for (const e of entries) { const h = head.get(e.logical_entry_id); if (!h || e.version_number > h.version_number) head.set(e.logical_entry_id, e); }
  const groups = new Map<string, number[]>();
  const notes: string[] = [];
  for (const e of head.values()) {
    const c = comp.get(e.instrument_id); if (!c) continue;
    const v = e.value as { kind?: string; value?: number } | null;
    if (v?.kind !== "numerica" || typeof v.value !== "number") continue;
    const k = `${e.student_id}|${c}|${e.period_id}`; groups.set(k, [...(groups.get(k) ?? []), v.value]);
  }
  const cells: Record<string, SheetCell> = {};
  for (const [k, vals] of groups) {
    const [s, c, p] = k.split("|") as [string, string, string];
    const idx = periods.indexOf(p); if (idx < 0) continue;
    const key = cellKey(s, c);
    const cell = cells[key] ?? { periodGrades: periods.map(() => null), finalRecovery: null, lessonsGiven: null, absences: null };
    if (vals.length === 1) cell.periodGrades[idx] = vals[0]!;
    else notes.push("Há período com mais de um instrumento: a composição da nota do período vem da Avaliação do período e não é somada aqui.");
    cells[key] = cell;
  }
  const components = [...new Set([...comp.values()].filter((x): x is string => !!x))].map((id) => ({ id, label: id }));
  return { cells, components, notes: [...new Set(notes)] };
}

/** Regra aplicável: exatamente uma cabeça homologada para a modalidade; zero ou várias ⇒ null (sem resultado). */
export function applicableRule(rules: readonly RuleRow[], modality: Modality): { rule: ResultRule | null; issue: string | null } {
  const heads = new Map<string, RuleRow>();
  for (const r of rules) { const h = heads.get(r.logical_id); if (!h || r.version > h.version) heads.set(r.logical_id, r); }
  const ok = [...heads.values()].filter((r) => r.status === "homologada" && r.scope?.modality === modality && typeof r.params?.passMark === "number");
  if (ok.length === 0) return { rule: null, issue: "Nenhuma regra de resultado homologada para esta modalidade: médias e frequência aparecem, o resultado não." };
  if (ok.length > 1) return { rule: null, issue: "Mais de uma regra homologada para esta modalidade: resultado não emitido até a ambiguidade ser resolvida." };
  const r = ok[0]!;
  return { rule: { id: r.id, label: `${r.label} v${r.version}`, passMark: r.params.passMark!, minAttendance: r.params.minAttendance ?? null, sourceRef: r.source_ref }, issue: null };
}

export function sheetSnapshot(input: SheetInput, rows: readonly SheetRow[]) {
  return { modality: input.modality, periods: input.periods, components: input.components, rule: input.rule ?? null,
    rows: rows.map((r) => ({ student: r.student.id, status: r.student.status, overall: r.overall, components: r.components.map((c) => ({ id: c.id, g: c.periodGrades, avg: c.average, rf: c.finalRecovery, att: c.attendance, res: c.result })) })) };
}
export async function sha256(o: unknown): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(o)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

const q = async <T,>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> => { const r = await p; if (r.error) throw new Error(r.error.message); return (r.data ?? []) as T; };

export const readClasses = () => q<{ id: string; name: string; school_id: string; school_label_snapshot: string | null; academic_year_label: string | null; stage_label_snapshot: string | null }[]>(
  supabase.from("institutional_classes").select("id,name,school_id,school_label_snapshot,academic_year_label,stage_label_snapshot").order("name").limit(1000),
).then((r) => r.map((c): ClassOption => ({ id: c.id, name: c.name, schoolId: c.school_id, school: c.school_label_snapshot ?? "Escola sem nome visível", year: c.academic_year_label ?? "—", stage: c.stage_label_snapshot })));

export async function readClassSheet(classId: string) {
  const episodes = await q<EpisodeRow[]>(supabase.from("class_enrollment_episodes").select("id,student_id,supersedes_id,valid_from").eq("class_id", classId).limit(1000));
  const ids = episodes.map((e) => e.id);
  const [endings, students, instruments, entries, rules, acts] = await Promise.all([
    ids.length ? q<EndingRow[]>(supabase.from("class_enrollment_episode_endings").select("episode_id,ended_on,reason_label").in("episode_id", ids)) : Promise.resolve([] as EndingRow[]),
    episodes.length ? q<{ id: string; display_name: string }[]>(supabase.from("institutional_students").select("id,display_name").in("id", [...new Set(episodes.map((e) => e.student_id))])) : Promise.resolve([]),
    q<InstrumentRow[]>(supabase.from("assessment_instruments").select("id,period_id,definition").eq("class_id", classId)),
    q<EntryRow[]>(supabase.from("assessment_entry_versions").select("id,logical_entry_id,version_number,instrument_id,student_id,period_id,value").eq("class_id", classId).limit(1000)),
    q<RuleRow[]>(supabase.from("final_sheet_rule_versions").select("id,logical_id,version,label,scope,params,source_ref,status")),
    q<ActRow[]>(supabase.from("final_sheet_acts").select("seq,action,rule_version_id,snapshot_sha256,reason,actor_id,created_at").eq("class_id", classId).order("seq")),
  ]);
  return { episodes, endings, names: new Map(students.map((s) => [s.id, s.display_name])), instruments, entries, rules, acts, truncated: episodes.length >= 1000 || entries.length >= 1000 };
}

export const recordAct = (a: { classId: string; expectedSeq: number; action: string; ruleId: string | null; snapshot: unknown; sha: string; reason: string | null }) =>
  callRpc<number>("record_final_sheet_act", { _class: a.classId, _expected_seq: a.expectedSeq, _action: a.action, _rule: a.ruleId, _snapshot: a.snapshot, _sha: a.sha, _reason: a.reason });

const MSG: Record<string, string> = {
  CAPABILITY_REQUIRED: "Sua conta não tem permissão para registrar a Folha Final desta escola.",
  STALE_BASE: "Outra pessoa registrou um ato antes: recarregue.",
  CONFERENCE_REQUIRED: "Homologar exige conferência registrada antes.",
  HOMOLOGATION_SAME_ACTOR: "Quem conferiu não pode homologar.",
  SNAPSHOT_CHANGED_SINCE_CONFERENCE: "Os dados mudaram desde a conferência: confira de novo.",
  RULE_NOT_HOMOLOGATED: "Sem regra de resultado homologada: não é possível homologar.",
  RULE_SUPERSEDED: "A regra foi substituída por versão mais nova.",
  PENDING_ROWS: "Há estudantes com resultado pendente.",
  REOPEN_REQUIRED: "Folha homologada: para alterar, registre reabertura ou retificação com motivo.",
  NOTHING_TO_REOPEN: "Só é possível reabrir ou retificar uma folha homologada.",
  REASON_REQUIRED: "Informe o motivo (mínimo 5 caracteres).",
};
export const actMessage = (raw: string) => Object.entries(MSG).find(([k]) => raw.includes(k))?.[1] ?? "Não foi possível registrar o ato.";
