/**
 * TSEMED.11 — Tabela 11: apuração por gênero (regras puras de exibição).
 * Gênero só do sexo registrado na identidade do estudante, mapeado por regra da rede; nunca por nome ou suposição.
 * "Não informado" e "fora do mapa" ficam explícitos e fora das colunas oficiais Masculino/Feminino.
 */
import type { Block } from "./semed-export";
import { colTotal, type Values } from "./semed-catalog";

export type T11Totals = Partial<Record<"masc" | "fem" | "nao_informado" | "fora_do_mapa" | "total" | "sem_data", number>>;
export type T11Apur = { rule_version: number | null; cutoff: string | null; totals: T11Totals; gaps: string[] };
export const T11_GAP: Record<string, string> = {
  "regra-ausente": "a rede ainda não registrou a data de corte e o mapa do campo sexo do cadastro",
  "matriculas-sem-data-de-inicio": "há matrículas sem data de início: não se sabe se estavam válidas na data de corte",
  "sexo-nao-informado": "há estudantes sem sexo registrado no cadastro (contados como não informado, nunca atribuídos)",
  "sexo-fora-do-mapa": "há valores de sexo do cadastro sem correspondência no layout oficial (Masculino/Feminino)",
  "turmas-sem-ano-etapa": "turmas sem ano/etapa registrados: a apuração sai só pelo total da escola",
};

/** Apuração completa = dá para comparar com o digitado sem presumir nada. */
export function t11Complete(a: T11Apur | null): boolean {
  const t = a?.totals ?? {};
  return !!a?.rule_version && (t.sem_data ?? 1) === 0 && (t.nao_informado ?? 1) === 0 && (t.fora_do_mapa ?? 1) === 0;
}

export type T11Compare = { col: "masc" | "fem"; label: string; typed: number | null; apurado: number | null; status: "confere" | "divergente" | "não apurado" };
export function t11Compare(v: Values, rows: readonly { key: string }[], a: T11Apur | null): T11Compare[] {
  const full = t11Complete(a);
  return (["masc", "fem"] as const).map((col) => {
    const typed = colTotal(v, "m", col, rows); const ap = full ? (a!.totals[col] ?? null) : null;
    return { col, label: col === "masc" ? "Masculino" : "Feminino", typed, apurado: ap, status: ap === null ? "não apurado" : (typed ?? 0) === ap ? "confere" : "divergente" };
  });
}

export function t11Blocks(v: Values, rows: readonly { key: string }[], a: T11Apur | null): Block[] {
  const t = a?.totals ?? {}; const s = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n);
  const out: Block[] = [{ title: `APURAÇÃO PELO CADASTRO (regra ${a?.rule_version ? `v${a.rule_version}, corte ${a.cutoff}` : "não registrada"}) — total da escola`, head: ["Coluna", "Total informado", "Apurado", "Situação"],
    body: t11Compare(v, rows, a).map((c) => [c.label, s(c.typed), s(c.apurado), c.status === "divergente" ? "DIVERGENTE" : c.status]) }];
  if (a?.rule_version) out.push({ title: "DIFERENÇAS ENTRE CADASTRO E LAYOUT OFICIAL", head: ["Item", "Estudantes"],
    body: [["Matrícula válida na data de corte", s(t.total)], ["Sexo não informado no cadastro", s(t.nao_informado)], ["Sexo fora de Masculino/Feminino", s(t.fora_do_mapa)], ["Matrículas sem data de início", s(t.sem_data)]] });
  if (a?.gaps.length) out.push({ title: "LACUNAS DA APURAÇÃO", head: ["Lacuna"], body: a.gaps.map((g) => [T11_GAP[g] ?? g]) });
  return out;
}
