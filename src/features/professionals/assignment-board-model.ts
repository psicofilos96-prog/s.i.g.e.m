/**
 * Gestão de Pessoas L12 — Modelo do quadro visual de atribuições.
 * Projeção pura sobre NeedLine (L10), candidatos (L07) e eventos de atribuição (L11).
 * Selecionar/arrastar só monta uma INTENÇÃO local de proposta; nunca grava, nunca
 * formaliza. Enviar exige writer configurado + capacidade de "proposta"; o resto
 * do fluxo (análise, validação, formalização) segue nas etapas próprias.
 */
import type { NeedLine } from "./teacher-need-engine";
import type { AStage } from "./class-assignment-flow";

export type Candidate = Readonly<{ personId: string; linkLogicalId: string; label: string; ineligibility: readonly string[] }>;
export type ProposalSummary = Readonly<{ assignmentId: string; classId: string; componentId: string; personLabel: string; stage: AStage | "cancelada"; blockIds: readonly string[] }>;

export type Cell = Readonly<{
  key: string; schoolId: string; classId: string; componentId: string;
  demanded: number | null; covered: number | null; uncovered: number | null;
  status: "coberta" | "descoberta" | "indeterminada";
  openBlockIds: readonly string[];
  proposals: readonly ProposalSummary[];
}>;

export const cellKey = (classId: string, componentId: string) => `${classId}::${componentId}`;

export function buildBoard(lines: readonly NeedLine[], proposals: readonly ProposalSummary[]): Cell[] {
  return lines.map((l) => {
    const k = cellKey(l.classId, l.componentId);
    const status: Cell["status"] = l.uncovered === null ? "indeterminada" : l.uncovered > 0 ? "descoberta" : "coberta";
    return {
      key: k, schoolId: l.schoolId, classId: l.classId, componentId: l.componentId,
      demanded: l.needed, covered: l.assigned, uncovered: l.uncovered, status, openBlockIds: l.unassignedBlockIds,
      proposals: proposals.filter((p) => cellKey(p.classId, p.componentId) === k && p.stage !== "cancelada" && p.stage !== "encerramento" && p.stage !== "vigencia"),
    };
  });
}

export type Filters = Readonly<{ schoolId?: string; classId?: string; componentId?: string; status?: Cell["status"] }>;
export const filterBoard = (cells: readonly Cell[], f: Filters) =>
  cells.filter((c) => (!f.schoolId || c.schoolId === f.schoolId) && (!f.classId || c.classId === f.classId) && (!f.componentId || c.componentId === f.componentId) && (!f.status || c.status === f.status));

/** Intenção local: só existe no navegador da sessão, sem efeito institucional. */
export type ProposalIntent = Readonly<{ cellKey: string; personId: string; linkLogicalId: string; blockIds: readonly string[]; kind: "intencao-local" }>;

export type IntentRefusal = "celula-sem-blocos-abertos" | "candidato-inelegivel" | "bloco-nao-aberto" | "celula-indeterminada";

export function makeIntent(cell: Cell, cand: Candidate, blockIds: readonly string[]): { intent: ProposalIntent | null; refusal: IntentRefusal | null } {
  if (cell.status === "indeterminada") return { intent: null, refusal: "celula-indeterminada" };
  if (cell.openBlockIds.length === 0) return { intent: null, refusal: "celula-sem-blocos-abertos" };
  if (cand.ineligibility.length) return { intent: null, refusal: "candidato-inelegivel" };
  if (blockIds.length === 0 || blockIds.some((b) => !cell.openBlockIds.includes(b))) return { intent: null, refusal: "bloco-nao-aberto" };
  return { intent: { cellKey: cell.key, personId: cand.personId, linkLogicalId: cand.linkLogicalId, blockIds, kind: "intencao-local" }, refusal: null };
}

/** Envio só como PROPOSTA, e só com writer e capacidade; nunca há ação de formalizar no quadro. */
export function submitState(hasWriter: boolean, canPropose: boolean): { enabled: boolean; reason: string | null } {
  if (!hasWriter) return { enabled: false, reason: "O registro de propostas ainda não está disponível no banco." };
  if (!canPropose) return { enabled: false, reason: "Sua conta não tem permissão vigente para propor atribuições." };
  return { enabled: true, reason: null };
}

export function totals(cells: readonly Cell[]) {
  const sum = (k: "demanded" | "covered" | "uncovered") => (cells.some((c) => c[k] === null) ? null : cells.reduce((a, c) => a + (c[k] as number), 0));
  return { demanded: sum("demanded"), covered: sum("covered"), uncovered: sum("uncovered"), indeterminate: cells.filter((c) => c.status === "indeterminada").length };
}
