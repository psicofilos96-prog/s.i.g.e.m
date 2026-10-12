/**
 * PERFIL MEDIADOR — LOTE 02 Designações e acesso temporal (núcleo puro).
 *
 * Reaproveita a cadeia canônica `inclusion_mediation_assignments` (registro/retificação/
 * encerramento, append-only, gravada só por `record_inclusion_mediation` com
 * `manter-mediacao-escolar` e guarda de sobreposição/atuação vigente no banco).
 * Este núcleo projeta a cadeia em designações vigentes e decide o acesso por
 * vínculo × estudante × função × período × operação; tudo falha fechado.
 */
import { effectiveCompetences, type FunctionConfig } from "./mediator-architecture";

export interface MediationRow {
  id: string; logical_id: string; version: number; supersedes_id: string | null;
  event_kind: "registro" | "retificacao" | "encerramento";
  school_id: string; student_id: string; class_id: string | null;
  mediator_engagement_id: string; valid_from: string; valid_to: string | null; reason: string | null;
}
export interface EngagementRef { id: string; personId: string; schoolId: string; from: string; to: string | null }
/** Função de apoio da designação: até decisão institucional fica fora do banco (null ⇒ sem competência). */
export type FunctionOf = (logicalId: string) => string | null;

export interface Designation {
  logicalId: string; version: number; personId: string; engagementId: string; functionId: string | null;
  schoolId: string; studentId: string; classId: string | null; from: string; to: string | null; closed: boolean;
}

/** Cabeça de cada cadeia; cadeia inválida (dois sucessores, versão saltada) é recusada inteira. */
export function projectDesignations(rows: MediationRow[], engagements: EngagementRef[], functionOf: FunctionOf):
  { designations: Designation[]; rejected: string[] } {
  const byLogical = new Map<string, MediationRow[]>();
  for (const r of rows) byLogical.set(r.logical_id, [...(byLogical.get(r.logical_id) ?? []), r]);
  const designations: Designation[] = []; const rejected: string[] = [];
  for (const [lid, chain] of byLogical) {
    const sorted = [...chain].sort((a, b) => a.version - b.version);
    const ok = sorted.every((r, i) => r.version === i + 1 && (i === 0 ? r.supersedes_id === null : r.supersedes_id === sorted[i - 1]!.id));
    if (!ok) { rejected.push(lid); continue; }
    const head = sorted[sorted.length - 1]!;
    const eng = engagements.find((e) => e.id === head.mediator_engagement_id);
    if (!eng || eng.schoolId !== head.school_id) { rejected.push(lid); continue; }
    designations.push({
      logicalId: lid, version: head.version, personId: eng.personId, engagementId: eng.id, functionId: functionOf(lid),
      schoolId: head.school_id, studentId: head.student_id, classId: head.class_id,
      from: head.valid_from, to: head.valid_to, closed: head.event_kind === "encerramento",
    });
  }
  return { designations, rejected };
}

const activeOn = (d: Designation, e: EngagementRef | undefined, date: string) =>
  !!e && d.from <= date && (d.to === null || date <= d.to) && e.from <= date && (e.to === null || date <= e.to)
  && (!d.closed || (d.to !== null && date <= d.to));

/** Estudantes acompanhados na data (mesma regra do reader `inclusion_my_mediated_students`). */
export function myStudentsOn(personId: string, ds: Designation[], engagements: EngagementRef[], date: string) {
  return ds.filter((d) => d.personId === personId && activeOn(d, engagements.find((e) => e.id === d.engagementId), date))
    .map((d) => ({ studentId: d.studentId, schoolId: d.schoolId, classId: d.classId, logicalId: d.logicalId }));
}

/** Acesso a uma operação: designação vigente × função homologada × competência da operação. */
export function canOperate(p: {
  personId: string; studentId: string; schoolId: string; date: string; operation: string;
  designations: Designation[]; engagements: EngagementRef[]; configs: FunctionConfig[];
}): { ok: boolean; reason: string } {
  const live = p.designations.filter((d) => d.personId === p.personId && d.studentId === p.studentId && d.schoolId === p.schoolId
    && activeOn(d, p.engagements.find((e) => e.id === d.engagementId), p.date));
  if (live.length === 0) return { ok: false, reason: "Sem designação vigente para este estudante, escola e data." };
  const withFn = live.filter((d) => d.functionId);
  if (withFn.length === 0) return { ok: false, reason: "Designação sem função de apoio declarada: nenhuma operação liberada." };
  const { competences } = effectiveCompetences({
    configs: p.configs, personId: p.personId, schoolId: p.schoolId, studentId: p.studentId, date: p.date,
    designations: withFn.map((d) => ({ personId: d.personId, functionId: d.functionId!, engagementId: d.engagementId, schoolId: d.schoolId, studentIds: [d.studentId], from: d.from, to: d.to })),
  });
  return competences.includes(p.operation) ? { ok: true, reason: "" } : { ok: false, reason: `A função não inclui "${p.operation}".` };
}

/** Substituição: novo vínculo para o substituto no período; o titular não perde a designação fora dele. */
export interface SubstitutionPlan { kind: "registro"; school: string; student: string; class: string | null; mediatorEngagement: string; from: string; to: string; reason: string }
export function planSubstitution(holder: Designation, substituteEngagement: EngagementRef, from: string, to: string, reason: string):
  { ok: true; plan: SubstitutionPlan } | { ok: false; reason: string } {
  if (!reason.trim()) return { ok: false, reason: "Motivo obrigatório." };
  if (from > to) return { ok: false, reason: "Período inválido." };
  if (substituteEngagement.schoolId !== holder.schoolId) return { ok: false, reason: "Substituto sem atuação na escola do estudante." };
  if (substituteEngagement.id === holder.engagementId) return { ok: false, reason: "Substituto é o próprio titular." };
  if (from < holder.from || (holder.to !== null && to > holder.to)) return { ok: false, reason: "Substituição fora do período do titular." };
  if (substituteEngagement.from > from || (substituteEngagement.to !== null && substituteEngagement.to < to)) return { ok: false, reason: "Atuação do substituto não cobre o período." };
  return { ok: true, plan: { kind: "registro", school: holder.schoolId, student: holder.studentId, class: holder.classId, mediatorEngagement: substituteEngagement.id, from, to, reason: reason.trim() } };
}

/** Histórico: todas as versões em ordem, inclusive encerradas (nunca apagadas). */
export function designationHistory(rows: MediationRow[], logicalId: string) {
  return rows.filter((r) => r.logical_id === logicalId).sort((a, b) => a.version - b.version)
    .map((r) => ({ version: r.version, kind: r.event_kind, from: r.valid_from, to: r.valid_to, classId: r.class_id, reason: r.reason }));
}

/** Tradução de recusas do writer canônico (nunca código cru na tela). */
export const WRITER_ERRORS: Record<string, string> = {
  "inclusion:mediator-engagement-not-active": "O profissional não tem atuação vigente na data inicial.",
  "inclusion:mediation-overlap": "Já existe designação deste profissional para o estudante no período.",
  "inclusion:base-superseded": "A designação foi alterada por outra pessoa; recarregue.",
  "inclusion:already-closed": "Designação já encerrada.",
  "inclusion:valid-to-required": "Encerramento exige data final.",
  "inclusion:student-not-in-school": "Estudante sem matrícula nesta escola.",
  "inclusion:class-not-in-school": "Turma não pertence à escola.",
  "inclusion:mediator-not-in-school": "Profissional sem atuação nesta escola.",
};
