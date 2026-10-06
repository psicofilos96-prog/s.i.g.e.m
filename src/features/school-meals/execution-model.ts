// NAE.5 — modelo puro da execução diária: planejado ≠ executado, refeições ≠ alunos, adesão só por definição
// homologada, baixa teórica inexistente sem regra, completude da competência como fatos (nunca percentual inventado).
export const ADHESION_BLOCK = "ADHESION_METRIC — BLOCKED_BY_HOMOLOGATED_RULE";
export const THEORETICAL_DEBIT_BLOCK = "THEORETICAL_STOCK_DEBIT — BLOCKED_BY_HOMOLOGATED_RULE";
export const CALENDAR_UNRESOLVED = "Calendário aplicável não resolvido: o dia não é presumido letivo.";

export interface Execution {
  followed: boolean | null; deviation: string | null; meals_total: number | null; count_basis: string | null;
  students_present: number | null; students_present_source: string | null; planned_menu_ref: string | null;
}

/** Situação planejado × executado. Nunca afirma que seguiu sem registro explícito. */
export function plannedVsExecuted(e: Execution | null): "sem-registro" | "seguido" | "desvio" | "nao-informado" {
  if (!e) return "sem-registro";
  if (e.followed === true) return "seguido";
  if (e.followed === false) return "desvio";
  return "nao-informado";
}

/** Fatos brutos lado a lado. Refeições nunca são rotuladas "alunos atendidos"; ausência ≠ zero. */
export function servedFacts(e: Execution | null) {
  return {
    mealsLabel: "Refeições servidas (pode incluir repetições e servidores, conforme a base declarada)",
    meals: e?.meals_total ?? null,
    basis: e?.count_basis ?? null,
    studentsLabel: "Alunos presentes (outra medida)",
    students: e?.students_present ?? null,
    studentsSource: e?.students_present_source ?? null,
  };
}

export interface AdhesionDefinition { status: "homologada"; numerador: string; denominador: string; formula: string }
/** Adesão só com definição homologada; sem ela, indisponível — nunca refeições×100/alunos. */
export function adhesion(def: AdhesionDefinition | null): { state: "unavailable"; code: string } | { state: "defined"; def: AdhesionDefinition } {
  if (!def || def.status !== "homologada") return { state: "unavailable", code: "ADHESION_METRIC_PENDING" };
  return { state: "defined", def };
}

/** A ficha técnica nunca gera movimento: só o consumo observado declarado vira linhas para o writer. */
export function consumptionLines(observed: { item: string; unit: string; quantity: number; lot?: string | null }[]) {
  return observed.filter((l) => l.quantity > 0).map((l, i) => ({ line_key: `l${i + 1}`, item: l.item, unit: l.unit, quantity: l.quantity, lot: l.lot ?? null }));
}

export type AreaState = number | "UNKNOWN";
export const COMPLETENESS_AREAS = ["pedidos", "recebimentos", "movimentos", "execucao", "inventario", "ocorrencias", "divergencias"] as const;
export type Area = (typeof COMPLETENESS_AREAS)[number];
/** Completude: contagens por área; fonte ilegível = UNKNOWN. Nenhum percentual e nenhum bloqueio de correção histórica. */
export function competenceChecklist(counts: Partial<Record<Area, AreaState>>) {
  return COMPLETENESS_AREAS.map((a) => ({ area: a, value: counts[a] ?? "UNKNOWN" as AreaState }));
}

export function executionMessage(raw: string): string {
  const m: Record<string, string> = {
    "meal:duplicate-use-rectification": "Já existe registro para esta refeição neste dia; use retificação.",
    "meal:deviation-required": "Informe o que foi servido no lugar do planejado.",
    "meal:students-source-required": "Informe de onde vem o número de alunos presentes.",
    "meal:category-not-homologated": "Categoria de refeição não homologada.",
    "meal:breakdown-total-mismatch": "A soma das categorias difere do total.",
    "meal:execution-in-future": "Não é possível registrar execução futura.",
    "meal:model-not-homologated": "Modelo operacional não homologado.",
    "meal:consumption-correct-in-stock-ledger": "Correção de consumo é feita no estoque.",
    "meal:base-superseded": "Este registro já foi corrigido por outra pessoa. Recarregue.",
  };
  const k = Object.keys(m).find((x) => raw.includes(x));
  if (k) return m[k]!;
  if (raw.includes("capability:")) return "Sem permissão para esta escola nesta data.";
  return "Não foi possível concluir.";
}
