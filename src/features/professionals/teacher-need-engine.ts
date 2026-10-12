/**
 * Gestão de Pessoas L10 — Motor versionado de Necessidade de Professores.
 * Entrada: linhas da oferta (L09), atribuições vigentes, habilitações e candidatos
 * avaliados pela elegibilidade (L07). Saída por linha: necessárias / ofertadas
 * (blocos na grade) / atribuídas / descobertas, e pacotes de demanda descoberta.
 * NUNCA calcula "nº de professores" por divisão de aulas pela jornada nominal:
 * necessidade é a lista de pacotes descobertos com seus requisitos e horários.
 * Complementa `staffing/teacher-need.ts` (resumo por vínculo) sem duplicá-lo.
 */
import type { OfferLine } from "./offer-plan";

export const NEED_METHODOLOGY = Object.freeze({
  key: "necessidade-professores",
  version: 1,
  steps: [
    "necessárias = carga semanal da matriz vigente (hora-aula do item)",
    "ofertadas = blocos da grade vigente do componente",
    "atribuídas = blocos com regência vigente na data",
    "descobertas = necessárias − atribuídas, só se ambas conhecidas",
    "pacote descoberto = componente × turma × blocos sem regência + habilitação exigida",
    "sem divisão por jornada nominal; contagem de pessoas não é produzida",
  ],
});

export type Assignment = Readonly<{ assignmentId: string; classId: string; componentId: string; blockIds: readonly string[]; personId: string; validFrom: string; validUntil: string | null }>;

export type NeedLine = Readonly<{
  classId: string; schoolId: string; componentId: string;
  needed: number | null; offered: number | null; assigned: number | null; uncovered: number | null;
  unassignedBlockIds: readonly string[];
  assignmentRefs: readonly string[];
  inheritedGaps: readonly string[];
  methodology: `${string}@${number}`;
}>;

const on = (a: { validFrom: string; validUntil: string | null }, d: string) => a.validFrom <= d && (a.validUntil === null || a.validUntil >= d);

export function needLine(l: OfferLine, assignments: readonly Assignment[], day: string): NeedLine {
  const as = assignments.filter((a) => a.classId === l.classId && a.componentId === l.componentId && on(a, day));
  const blocks = l.provenance.scheduleBlockIds;
  const assignedBlocks = new Set(as.flatMap((a) => a.blockIds).filter((b) => blocks.includes(b)));
  const offered = l.scheduledBlocks;
  const assigned = offered === null ? null : assignedBlocks.size;
  const needed = l.weeklyClassHours;
  return {
    classId: l.classId, schoolId: l.schoolId, componentId: l.componentId,
    needed, offered, assigned,
    uncovered: needed !== null && assigned !== null ? Math.max(0, needed - assigned) : null,
    unassignedBlockIds: blocks.filter((b) => !assignedBlocks.has(b)),
    assignmentRefs: as.map((a) => a.assignmentId),
    inheritedGaps: l.gaps,
    methodology: `${NEED_METHODOLOGY.key}@${NEED_METHODOLOGY.version}`,
  };
}

export type UncoveredPackage = Readonly<{
  schoolId: string; classId: string; componentId: string; uncoveredClassHours: number;
  blockIds: readonly string[]; requiredQualification: string; eligibleCandidates: number | null;
}>;

/** Pacotes descobertos; candidatos elegíveis só se a avaliação foi feita (null = não avaliado). */
export function uncoveredPackages(lines: readonly NeedLine[], eligibleCount?: (componentId: string, blockIds: readonly string[]) => number | null): UncoveredPackage[] {
  return lines.filter((l) => (l.uncovered ?? 0) > 0).map((l) => ({
    schoolId: l.schoolId, classId: l.classId, componentId: l.componentId, uncoveredClassHours: l.uncovered!,
    blockIds: l.unassignedBlockIds, requiredQualification: l.componentId,
    eligibleCandidates: eligibleCount ? eligibleCount(l.componentId, l.unassignedBlockIds) : null,
  }));
}

export type NeedAggregate = Readonly<{ key: string; needed: number | null; offered: number | null; assigned: number | null; uncovered: number | null; lines: number; indeterminate: number }>;

/** Agregado por escola ou componente: total só fecha sem linha indeterminada. */
export function aggregate(lines: readonly NeedLine[], by: "schoolId" | "componentId"): NeedAggregate[] {
  const m = new Map<string, { needed: number | null; offered: number | null; assigned: number | null; uncovered: number | null; lines: number; indeterminate: number }>();
  const add = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b);
  for (const l of lines) {
    const k = l[by];
    const t = m.get(k) ?? { needed: 0, offered: 0, assigned: 0, uncovered: 0, lines: 0, indeterminate: 0 };
    t.needed = add(t.needed, l.needed); t.offered = add(t.offered, l.offered);
    t.assigned = add(t.assigned, l.assigned); t.uncovered = add(t.uncovered, l.uncovered);
    t.lines++; if (l.needed === null || l.assigned === null) t.indeterminate++;
    m.set(k, t);
  }
  return [...m].map(([key, v]) => ({ key, ...v })).sort((a, b) => a.key.localeCompare(b.key));
}
