/**
 * Frente X — necessidade de professor como projeção pura.
 * necessário ≠ ofertado ≠ coberto ≠ atribuído; ausência ⇒ null com motivo, nunca 0.
 * Conversões de unidade (hora-relógio/hora-aula/bloco/aula semanal) só por regra declarada (dado), nunca no código.
 */
import type { ClassInput, ClassResult } from "./staffing-model";

export type Num = Readonly<{ value: number | null; reason: string | null }>;
const known = (value: number): Num => ({ value, reason: null });
const unknown = (reason: string): Num => ({ value: null, reason });

/** Item da matriz aplicável à turma, como lido de curricular_matrix_items_at. */
export type MatrixItem = Readonly<{ matrixVersionId: string; itemKey: string; componentId: string | null; quantity: number | null; unitValueId: string | null }>;
/** Contexto curricular da turma (class_curricular_matrices_at). null = leitura falhou. */
export type ClassCurriculum = Readonly<{ classId: string; matrixVersionIds: readonly string[]; items: readonly MatrixItem[] | null }> | null;

/** Regra de conversão homologada: unidade da matriz → aulas semanais. Sem regra ⇒ não calculável. */
export type UnitRule = Readonly<{ unitValueId: string; weeklyLessonsPerUnit: number; ruleRef: string }>;

export type DemandCell = Readonly<{ classId: string; componentId: string | null; itemKey: string | null; literal: string | null; weeklyLessons: Num; refs: readonly string[] }>;
export type ClassDemand = Readonly<{ classId: string; state: "calculavel" | "parcial" | "nao-calculavel"; reason: string | null; cells: readonly DemandCell[] }>;

export function classDemand(classId: string, cur: ClassCurriculum, rules: readonly UnitRule[]): ClassDemand {
  const none = (reason: string): ClassDemand => ({ classId, state: "nao-calculavel", reason, cells: [] });
  if (!cur || cur.items == null) return none("Matriz aplicável não pôde ser lida.");
  if (cur.matrixVersionIds.length === 0) return none("Nenhuma matriz homologada aplicável à turma.");
  // Multietapa: várias matrizes aplicáveis não são somadas; a demanda depende da organização real da oferta.
  if (new Set(cur.matrixVersionIds).size > 1) return none("Mais de uma matriz aplicável (turma multietapa): a demanda depende da organização real da oferta, não da soma das matrizes.");
  const cells = cur.items.map((i): DemandCell => {
    const refs = [`matriz:${i.matrixVersionId}`, `item:${i.itemKey}`];
    const literal = i.quantity == null ? null : `${i.quantity} ${i.unitValueId ?? "(sem unidade)"}`;
    if (i.quantity == null) return { classId, componentId: i.componentId, itemKey: i.itemKey, literal, weeklyLessons: unknown("Item sem carga numérica literal na matriz."), refs };
    const ruleHits = rules.filter((r) => r.unitValueId === i.unitValueId);
    if (ruleHits.length !== 1) return { classId, componentId: i.componentId, itemKey: i.itemKey, literal,
      weeklyLessons: unknown(ruleHits.length === 0 ? `Unidade "${i.unitValueId ?? "ausente"}" sem regra homologada de conversão para aulas semanais.` : "Regras de conversão conflitantes para a unidade."), refs };
    return { classId, componentId: i.componentId, itemKey: i.itemKey, literal, weeklyLessons: known(i.quantity * ruleHits[0]!.weeklyLessonsPerUnit), refs: [...refs, `regra:${ruleHits[0]!.ruleRef}`] };
  });
  const k = cells.filter((c) => c.weeklyLessons.value != null).length;
  return { classId, state: cells.length > 0 && k === cells.length ? "calculavel" : k > 0 ? "parcial" : "nao-calculavel",
    reason: k === cells.length && cells.length > 0 ? null : "Há itens cuja carga não converte em aulas semanais.", cells };
}

/** Carga contratual: só a fonte funcional (RH) declara. Hoje não há fonte canônica ⇒ unknown. */
export type ContractualLoad =
  | Readonly<{ state: "known"; minutes: number; sourceRef: string }>
  | Readonly<{ state: "unknown"; reason: string }>
  | Readonly<{ state: "incompatible-unit"; unit: string; reason: string }>
  | Readonly<{ state: "not-applicable"; reason: string }>;
export const NO_FUNCTIONAL_SOURCE: ContractualLoad = { state: "unknown", reason: "Sem fonte funcional canônica de carga contratual." };

/** Carga atribuída por VÍNCULO/atuação (nunca somada entre vínculos), a partir de blocos com regência ou substituição válida. */
export type EngagementLoad = Readonly<{ personId: string; engagementId: string; classes: number; components: number; blocks: number; minutes: number; conflicts: number;
  contractual: ContractualLoad; balanceMinutes: Num }>;
export type ScheduleRow = Readonly<{ personId: string; engagementId: string; classId: string; componentKey: string | null; blockId: string; minutes: number; conflict: boolean }>;

export function engagementLoads(rows: readonly ScheduleRow[], contractual: (engagementId: string) => ContractualLoad = () => NO_FUNCTIONAL_SOURCE): EngagementLoad[] {
  const m = new Map<string, ScheduleRow[]>();
  for (const r of rows) m.set(r.engagementId, [...(m.get(r.engagementId) ?? []), r]);
  return [...m].map(([engagementId, rs]) => {
    const c = contractual(engagementId); const minutes = rs.reduce((s, r) => s + r.minutes, 0);
    const balance = c.state === "known" ? known(c.minutes - minutes) : unknown(c.reason);
    return { personId: rs[0]!.personId, engagementId, classes: new Set(rs.map((r) => r.classId)).size, components: new Set(rs.map((r) => `${r.classId}|${r.componentKey}`)).size,
      blocks: new Set(rs.map((r) => r.blockId)).size, minutes, conflicts: rs.filter((r) => r.conflict).length, contractual: c, balanceMinutes: balance };
  });
}

/** Painel X: sete grandezas separadas. Qualquer parcela ausente fica null com motivo. */
export type NeedSummary = Readonly<{
  necessarias: Num; ofertadas: Num; cobertas: Num; descobertas: Num; cargaAtribuidaMin: Num; cargaContratualMin: Num; saldoMin: Num;
  coverageDeficitIsNotContractualDeficit: true;
}>;

export function needSummary(demands: readonly ClassDemand[], offer: readonly ClassResult[], loads: readonly EngagementLoad[]): NeedSummary {
  const nec = demands.length === 0 ? unknown("Sem turmas.") : demands.every((d) => d.state === "calculavel")
    ? known(demands.flatMap((d) => d.cells).reduce((s, c) => s + c.weeklyLessons.value!, 0))
    : unknown(`${demands.filter((d) => d.state !== "calculavel").length} turma(s) com demanda não calculável.`);
  const unreadable = offer.filter((r) => r.state === "grade-ilegivel" || r.state === "regencia-ilegivel").length;
  const cells = offer.flatMap((r) => r.cells);
  const ofe = unreadable ? unknown(`${unreadable} turma(s) sem leitura de grade/regência.`) : known(cells.reduce((s, c) => s + c.lessons, 0));
  // Cobertura em blocos (aulas) — conta substituição válida (V a projeta nos responsáveis do bloco).
  const cob = unreadable ? unknown(ofe.reason!) : known(cells.reduce((s, c) => s + (c.demandMinutes === 0 ? 0 : Math.round(c.lessons * ((c.coveredMinutes ?? 0) / c.demandMinutes))), 0));
  const des = ofe.value == null || cob.value == null ? unknown("Ofertadas ou cobertas indisponíveis.") : known(ofe.value - cob.value);
  const atr = unreadable ? unknown(ofe.reason!) : known(loads.reduce((s, l) => s + l.minutes, 0));
  const allKnown = loads.length > 0 && loads.every((l) => l.contractual.state === "known");
  const con = allKnown ? known(loads.reduce((s, l) => s + (l.contractual.state === "known" ? l.contractual.minutes : 0), 0))
    : unknown(loads.length === 0 ? "Sem vínculos com carga atribuída." : "Carga contratual desconhecida para ao menos um vínculo.");
  const sal = con.value != null && atr.value != null ? known(con.value - atr.value) : unknown("Saldo não calculável sem carga contratual conhecida e compatível.");
  return { necessarias: nec, ofertadas: ofe, cobertas: cob, descobertas: des, cargaAtribuidaMin: atr, cargaContratualMin: con, saldoMin: sal, coverageDeficitIsNotContractualDeficit: true };
}

/** Cenário: cópia isolada; nunca retorna nem altera os inputs reais. */
export type NeedScenario = Readonly<{ label: string; extraClasses: readonly ClassInput[] }>;
export function applyScenario(real: readonly ClassInput[], s: NeedScenario): { label: string; simulated: true; inputs: ClassInput[] } {
  return { label: `SIMULAÇÃO: ${s.label}`, simulated: true, inputs: [...real.map((c) => ({ ...c })), ...s.extraClasses] };
}
