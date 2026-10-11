/**
 * Tabela 06 — apuração por eventos reais (espelha `semed_t06_compute`/`semed_t06_guard`).
 * Coluna só é "determinada" quando o banco devolve número; ausente = não apurado, nunca zero.
 */
import { colTotal, type Values } from "./semed-catalog";

export const T06_COLS = ["inicial", "recebidos", "transferencia", "cancelamento", "evasao", "aprovados", "reprovados"] as const;
export type T06Col = (typeof T06_COLS)[number];
export type T06Totals = Partial<Record<T06Col | "final", number>>;
export type T06Divergence = { col: T06Col; typed: number | null; computed: number };

/** Divergências entre o total digitado e a apuração determinada (a trava do banco usa a mesma regra). */
export function t06Divergences(v: Values, rows: readonly { key: string }[], totals: T06Totals): T06Divergence[] {
  const out: T06Divergence[] = [];
  for (const col of T06_COLS) {
    const computed = totals[col];
    if (typeof computed !== "number") continue;
    const typed = colTotal(v, "m", col, rows);
    if ((typed ?? 0) !== computed) out.push({ col, typed, computed });
  }
  return out;
}

export const T06_GAP: Record<string, string> = {
  "regra-ausente": "A rede ainda não registrou a regra da Tabela 06 (datas de matrícula inicial/final e tipos de movimentação e situação de cada coluna).",
  "matriculas-sem-data-de-inicio": "Há matrículas sem data de início registrada: matrícula inicial, recebidos e matrícula final não são apurados.",
  "movimentacao-sem-coluna-na-regra": "Há movimentações cujo tipo não foi associado a uma coluna pela regra: as saídas não são apuradas.",
  "saida-sem-tipo-de-movimentacao": "Há encerramentos de matrícula sem evento de movimentação: a saída não é classificada (evasão nunca é presumida).",
  "resultado-sem-fechamento": "Nenhum fechamento de ciclo registrado: aprovados e reprovados não são contados antes do fechamento.",
  "resultado-parcial": "Há situações acadêmicas sem fechamento ou sem coluna na regra: aprovados e reprovados não são apurados.",
  "resultado-diverge-da-matricula-final": "Aprovados + reprovados diferem da matrícula final apurada.",
  "ano-etapa-sem-oferta-registrada": "As turmas não têm ano/etapa na oferta: a apuração é só do total da escola, não por ano.",
};
