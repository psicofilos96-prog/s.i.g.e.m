/**
 * Docente LOTE 13 — Perfil de trabalho por segmento (projeção pura, sem norma no código).
 *
 * Generalista (anos iniciais), especialista (anos finais) e EJA semestral NÃO são
 * cargos nem enums do motor: o arranjo é derivado das atribuições lidas e da
 * organização de períodos declarada da turma (`class_period_organization_at`). A
 * granularidade da chamada (por aula ou por dia) vem da regra homologada; sem regra,
 * não há chamada. Semestre nunca é convertido em ano.
 */
export type Assignment = { assignmentId: string; classId: string; componentId: string; start: string; end?: string | null };
export type PeriodOrganization = {
  classId: string;
  cycleKind: "anual" | "semestral" | string; // declarado; aberto
  periods: readonly { periodId: string; label: string; start: string; end: string }[];
};
export type AttendanceRule = { granularity: "por-aula" | "por-dia"; ruleId: string; version: number } | null;

export type WorkArrangement = "unidocente" | "multicomponente" | "componente-unico";

const activeOn = (a: Assignment, d: string) => a.start <= d && (!a.end || a.end >= d);

/** Arranjo por turma, derivado das atribuições vigentes: muitos componentes na mesma turma ⇒ unidocente. */
export function arrangementByClass(assignments: readonly Assignment[], date: string): Map<string, WorkArrangement> {
  const byClass = new Map<string, Set<string>>();
  for (const a of assignments.filter((x) => activeOn(x, date))) {
    byClass.set(a.classId, (byClass.get(a.classId) ?? new Set()).add(a.componentId));
  }
  const totalClasses = byClass.size;
  const out = new Map<string, WorkArrangement>();
  for (const [cls, comps] of byClass) out.set(cls, comps.size > 1 ? "unidocente" : totalClasses > 1 ? "multicomponente" : "componente-unico");
  return out;
}

/** Layout sugerido da tela: por turma (generalista) ou por componente×turma (especialista). */
export function homeLayout(arr: Map<string, WorkArrangement>): "por-turma" | "por-componente-turma" {
  return [...arr.values()].every((v) => v === "unidocente") ? "por-turma" : "por-componente-turma";
}

/** Período vigente da turma na data, conforme organização declarada (semestre continua semestre). */
export function currentPeriod(org: PeriodOrganization | null, date: string): { periodId: string; label: string; cycleKind: string } | { error: string } {
  if (!org) return { error: "A organização de períodos desta turma não foi declarada." };
  const p = org.periods.filter((x) => x.start <= date && x.end >= date);
  if (p.length === 0) return { error: "A data não está em nenhum período da turma." };
  if (p.length > 1) return { error: "Mais de um período cobre esta data; a organização precisa ser corrigida." };
  return { periodId: p[0]!.periodId, label: p[0]!.label, cycleKind: org.cycleKind };
}

/** Janela do ciclo = do início do 1º ao fim do último período declarado; nunca 1º de jan. a 31 de dez. presumidos. */
export function cycleWindow(org: PeriodOrganization): { start: string; end: string } {
  const s = [...org.periods].sort((a, b) => a.start.localeCompare(b.start));
  return { start: s[0]!.start, end: s[s.length - 1]!.end };
}

/** Unidades de chamada do dia: por aula (cada bloco) ou por dia (uma), segundo a regra. */
export function attendanceUnits(rule: AttendanceRule, blocksOfDay: readonly string[]): { units: string[] } | { error: string } {
  if (!rule) return { error: "Não há regra de frequência homologada; a chamada não pode ser aberta." };
  if (blocksOfDay.length === 0) return { units: [] };
  return { units: rule.granularity === "por-aula" ? [...blocksOfDay] : ["dia"] };
}

/** Fechamento por período: só períodos encerrados até a data; leitura histórica não depende do ciclo atual. */
export function closablePeriods(org: PeriodOrganization, date: string): string[] {
  return org.periods.filter((p) => p.end < date).map((p) => p.periodId);
}
