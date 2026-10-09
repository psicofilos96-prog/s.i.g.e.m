/**
 * NMAP.FINAL.1 — Estrutura IV em cinco grupos (Recebidos, Transferidos, Evadidos,
 * Desistentes/Cancelados, Remanejados) e reconciliação II × IV. Puro.
 *
 * Decisão institucional: remanejamento é evento próprio, nunca rotulado como
 * transferência/novo/evasão/cancelamento; cada evento cai em exatamente UM grupo;
 * o grupo Remanejados EXPLICA o movimento e não soma/subtrai o total — o total vem
 * do estado canônico da alocação na data (célula de matrícula). Grupos 1–4 dependem
 * de tipos de movimentação homologados mapeados pela regra da competência; sem
 * esse mapeamento o grupo fica "sem-regra" (nunca zero).
 */
import type { MapCell } from "./map-domain";

export const IV_GROUPS = [
  { id: "recebidos", label: "1. Recebidos", sign: 1 },
  { id: "transferidos", label: "2. Transferidos", sign: -1 },
  { id: "evadidos", label: "3. Evadidos", sign: -1 },
  { id: "cancelados", label: "4. Desistentes/Cancelados", sign: -1 },
  { id: "remanejados", label: "5. Remanejados", sign: 0 },
] as const;
export type IVGroup = (typeof IV_GROUPS)[number]["id"];

/** Evento canônico já lido: movimentação homologada OU encerramento de enturmação por remanejamento. */
export type MovementEvent = Readonly<{
  id: string; studentId: string; effectiveOn: string;
  source: "student_movement_events" | "class_enrollment_episode_endings";
  movementTypeId: string | null;          // só para student_movement_events
  endingReason: string | null;            // só para encerramentos ("remanejamento")
  origin: string | null; destination: string | null;  // turma/escola quando disponível
  stage: string | null;
}>;

/** Regra (dado configurado na map_competence_rule): tipo homologado → grupo. */
export type IVGroupRule = Readonly<Partial<Record<Exclude<IVGroup, "remanejados">, readonly string[]>> & { remanejamentoTypeIds?: readonly string[] }>;

export type Classified = Readonly<{ byGroup: Record<IVGroup, MovementEvent[]>; unclassified: MovementEvent[]; conflicts: { event: MovementEvent; groups: IVGroup[] }[] }>;

export function classifyMovements(events: readonly MovementEvent[], rule: IVGroupRule | null, window: { from: string; to: string }): Classified {
  const byGroup = { recebidos: [], transferidos: [], evadidos: [], cancelados: [], remanejados: [] } as Record<IVGroup, MovementEvent[]>;
  const unclassified: MovementEvent[] = []; const conflicts: Classified["conflicts"] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (e.effectiveOn < window.from || e.effectiveOn > window.to) continue;
    const key = `${e.source}:${e.id}`; if (seen.has(key)) continue; seen.add(key);
    if (e.source === "class_enrollment_episode_endings") {
      if (e.endingReason === "remanejamento") byGroup.remanejados.push(e); // encerramento comum não é movimentação do Mapa
      continue;
    }
    const hits: IVGroup[] = [];
    if (e.movementTypeId && rule?.remanejamentoTypeIds?.includes(e.movementTypeId)) hits.push("remanejados");
    for (const g of ["recebidos", "transferidos", "evadidos", "cancelados"] as const)
      if (e.movementTypeId && rule?.[g]?.includes(e.movementTypeId)) hits.push(g);
    if (hits.length === 1) byGroup[hits[0]!].push(e);
    else if (hits.length > 1) conflicts.push({ event: e, groups: hits });
    else unclassified.push(e);
  }
  return { byGroup, unclassified, conflicts };
}

/** Remanejamento entre unidades: o encerramento (endings) e o movimento homologado podem descrever o MESMO aluno no mesmo dia — conta uma vez. */
export function dedupeRemanejados(list: readonly MovementEvent[]): MovementEvent[] {
  const k = new Map<string, MovementEvent>();
  for (const e of list) { const key = `${e.studentId}@${e.effectiveOn}`; if (!k.has(key) || e.source === "student_movement_events") k.set(key, e); }
  return [...k.values()];
}

const cell = (cellId: string, label: string, p: Partial<MapCell>): MapCell => ({
  cellId, sectionId: "entrada-saida", label, origin: "calculado", state: "disponivel", value: null, unit: "alunos",
  reference: null, source: "student_movement_events + class_enrollment_episode_endings", recordRefs: [], ruleRef: null, coverage: null, notes: [], ...p,
});

/** Células da Estrutura IV. events=null ⇒ fonte não lida (indeterminado). */
export function structureIVCells(events: readonly MovementEvent[] | null, rule: IVGroupRule | null, window: { from: string; to: string }): MapCell[] {
  if (events === null) return IV_GROUPS.map((g) => cell(`iv-${g.id}`, g.label, { state: "indeterminado", notes: ["Movimentações não puderam ser lidas."] }));
  const cl = classifyMovements(events, rule, window);
  const out = IV_GROUPS.map((g) => {
    const list = g.id === "remanejados" ? dedupeRemanejados(cl.byGroup.remanejados) : cl.byGroup[g.id];
    const ruled = g.id === "remanejados" || (rule?.[g.id as Exclude<IVGroup, "remanejados">]?.length ?? 0) > 0;
    if (!ruled) return cell(`iv-${g.id}`, g.label, { state: "sem-regra", notes: ["Regra ainda não homologada: a regra da competência não declara quais tipos de movimentação homologados compõem este grupo."] });
    return cell(`iv-${g.id}`, g.label, {
      value: list.length, reference: window, recordRefs: list.map((e) => `${e.source}:${e.id}`),
      notes: g.id === "remanejados" ? ["Explica a movimentação; não soma nem subtrai o total — o total vem da alocação vigente na data."] : [],
      ...(g.id === "remanejados" ? { groups: list.map((e) => ({ key: `${e.origin ?? "origem não informada"} → ${e.destination ?? "destino não informado"} (${e.effectiveOn})`, value: 1, state: "disponivel" })) } : {}),
    });
  });
  if (cl.unclassified.length) out.push(cell("iv-nao-classificados", "Movimentações sem grupo na regra", { state: "indeterminado", value: cl.unclassified.length, notes: ["Tipo homologado não mapeado para nenhum grupo; revise a regra."] }));
  if (cl.conflicts.length) out.push(cell("iv-conflitos", "Movimentações em mais de um grupo", { state: "indeterminado", value: cl.conflicts.length, notes: ["A regra mapeia o mesmo tipo para dois grupos; nada foi contado em dobro."] }));
  return out;
}

export type Reconciliation = Readonly<{ state: "reconciliado" | "divergente" | "indeterminado"; expected: number | null; actual: number | null; difference: number | null; reason: string }>;

/**
 * II × IV: anterior + recebidos − transferidos − evadidos − cancelados + saldo de remanejamentos entre
 * unidades (entrada − saída nesta escola) = matrícula atual (estado canônico). Remanejamento interno de turma = 0.
 */
export function reconcileIIxIV(a: { previous: number | null; current: number | null; iv: readonly MapCell[]; schoolId: string; remanejados: readonly MovementEvent[] }): Reconciliation {
  const v = (id: IVGroup) => { const c = a.iv.find((x) => x.cellId === `iv-${id}`); return c?.state === "disponivel" && typeof c.value === "number" ? c.value : null; };
  if (a.previous === null) return { state: "indeterminado", expected: null, actual: a.current, difference: null, reason: "Sem matrícula do mês anterior herdada." };
  if (a.current === null) return { state: "indeterminado", expected: null, actual: null, difference: null, reason: "Matrícula atual indisponível." };
  const parts = (["recebidos", "transferidos", "evadidos", "cancelados"] as const).map((g) => v(g));
  if (parts.some((x) => x === null)) return { state: "indeterminado", expected: null, actual: a.current, difference: null, reason: "Algum grupo da Estrutura IV está sem regra ou sem leitura." };
  const crossIn = a.remanejados.filter((e) => e.destination === a.schoolId && e.origin !== a.schoolId).length;
  const crossOut = a.remanejados.filter((e) => e.origin === a.schoolId && e.destination !== a.schoolId).length;
  const [r, t, e, c] = parts as number[];
  const expected = a.previous + r! - t! - e! - c! + crossIn - crossOut;
  const diff = a.current - expected;
  return { state: diff === 0 ? "reconciliado" : "divergente", expected, actual: a.current, difference: diff,
    reason: diff === 0 ? "Movimentação explica a matrícula atual." : "A movimentação registrada não explica a matrícula atual; confira ou ajuste com motivo." };
}
