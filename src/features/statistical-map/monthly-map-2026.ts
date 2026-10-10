/**
 * Mapa Estatístico MENSAL 2026. Chave: escola + ano + mês (+ versão da apuração congelada).
 * O Censo é referência/fotografia, nunca prova da situação de um mês: cada mês é lido na sua
 * data de referência a partir dos episódios de enturmação, matrículas e encerramentos datados.
 * Mês anterior à primeira evidência datada ⇒ "não apurado"; mês não encerrado ⇒ provisório.
 */
import type { CellValue, ReportDefinition } from "@/features/reports/report-engine";

export const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] as const;
export type MonthStatus = "apurado" | "nao-apurado" | "mes-nao-encerrado";
export const STATUS_LABEL: Record<MonthStatus, string> = {
  apurado: "Apurado pelos registros",
  "nao-apurado": "Não apurado — dados históricos insuficientes",
  "mes-nao-encerrado": "Mês não encerrado — provisório",
};

export const MEASURES = [
  ["distinct_students", "Alunos distintos"], ["school_enrollments", "Matrículas escolares (datadas)"],
  ["undated_enrollments", "Matrículas sem data de início"], ["bonds", "Enturmações (total)"],
  ["regular_bonds", "Enturmações regulares"], ["aee_bonds", "Enturmações AEE"], ["aee_students", "Alunos em AEE"],
  ["aee_only_students", "Alunos só em AEE"], ["classes_with_students", "Turmas com alunos"],
  ["entries_in_month", "Entradas no mês"], ["exits_in_month", "Saídas no mês"],
] as const;
export type MeasureKey = (typeof MEASURES)[number][0];

export type MonthlyRow = {
  school_id: string; inep: string | null; school_name: string | null; reference_date: string; earliest_evidence: string | null;
  status: MonthStatus;
} & Record<MeasureKey, number | null>;

export type Closure = { school_id: string; map_month: number; version: number; kind: "apuracao" | "revisao"; reference_date: string; measures: Record<string, unknown>; digest: string; reason: string | null; created_at: string };

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

/** Fora de "apurado", nenhum número é exposto: mês sem histórico não vira zero nem cópia de outro mês. */
export function normalizeMonthly(raw: Record<string, unknown>[]): MonthlyRow[] {
  return raw.map((r) => {
    const status = (["apurado", "nao-apurado", "mes-nao-encerrado"].includes(String(r["status"])) ? r["status"] : "nao-apurado") as MonthStatus;
    const row = { school_id: String(r["school_id"]), inep: (r["inep"] as string) ?? null, school_name: (r["school_name"] as string) ?? null,
      reference_date: String(r["reference_date"]), earliest_evidence: (r["earliest_evidence"] as string) ?? null, status } as MonthlyRow;
    for (const [k] of MEASURES) row[k] = status === "nao-apurado" ? null : num(r[k]);
    // matrícula sem data de início não pode ser afirmada como vigente no mês
    if (row.status !== "nao-apurado" && (row.undated_enrollments ?? 0) > 0 && row.school_enrollments === 0) row.school_enrollments = null;
    return row;
  });
}

/** Versão vigente da apuração congelada por escola/mês (maior versão). */
export function latestClosures(rows: Closure[]): Map<string, Closure> {
  const m = new Map<string, Closure>();
  for (const c of rows) { const k = `${c.school_id}:${c.map_month}`; const p = m.get(k); if (!p || c.version > p.version) m.set(k, c); }
  return m;
}

/** O mapa exibido: congelado quando houver apuração (alterações posteriores não reescrevem), vivo caso contrário. */
export function effectiveRow(live: MonthlyRow, closure: Closure | undefined): MonthlyRow & { frozen: Closure | null; driftFromFrozen: MeasureKey[] } {
  if (!closure) return { ...live, frozen: null, driftFromFrozen: [] };
  const frozen = { ...live, reference_date: closure.reference_date, status: "apurado" as MonthStatus };
  const drift: MeasureKey[] = [];
  for (const [k] of MEASURES) { frozen[k] = num(closure.measures[k]); if (live.status === "apurado" && live[k] !== frozen[k]) drift.push(k); }
  return { ...frozen, frozen: closure, driftFromFrozen: drift };
}

/** Consolidação da rede: soma só escolas apuradas; alunos distintos por escola não somam como alunos da rede. */
export function networkMonth(rows: MonthlyRow[]) {
  const ok = rows.filter((r) => r.status !== "nao-apurado");
  const totals = {} as Record<MeasureKey, number | null>;
  for (const [k] of MEASURES) totals[k] = ok.length === 0 || ok.some((r) => r[k] === null) ? null : ok.reduce((t, r) => t + (r[k] as number), 0);
  return { schools: rows.length, apuradas: ok.length, naoApuradas: rows.length - ok.length, complete: ok.length === rows.length && rows.length > 0, totals };
}

/** Comparativo entre dois meses; qualquer lado não apurado ⇒ diferença indisponível (null), nunca 0. */
export function compareMonths(a: Record<MeasureKey, number | null>, b: Record<MeasureKey, number | null>) {
  return MEASURES.map(([k, label]) => ({ key: k, label, a: a[k], b: b[k], delta: a[k] === null || b[k] === null ? null : (b[k] as number) - (a[k] as number) }));
}

export function referenceDate(month: number): string {
  const d = new Date(Date.UTC(2026, month, 0));
  return d.toISOString().slice(0, 10);
}

export const MONTHLY_REPORT: ReportDefinition = {
  id: "mapa-mensal-2026", version: 1, title: "Mapa Estatístico mensal 2026", description: "Mapa por escola e mês de referência, lido com a sessão de quem gera.",
  source: "monthly_map_2026_live + monthly_map_2026_closures", params: [], formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 5000,
  columns: [
    { id: "inep", label: "INEP", kind: "text" }, { id: "school", label: "Escola", kind: "text" }, { id: "situacao", label: "Situação do mês", kind: "text" },
    ...MEASURES.map(([id, label]) => ({ id, label, kind: "number" as const })),
  ],
};
export function monthlyCells(rows: (MonthlyRow & { frozen?: Closure | null })[]): Record<string, CellValue>[] {
  return rows.map((r) => {
    const o: Record<string, CellValue> = { inep: r.inep, school: r.school_name,
      situacao: r.frozen ? `Apuração v${r.frozen.version} congelada` : STATUS_LABEL[r.status] };
    for (const [k] of MEASURES) o[k] = r[k];
    return o;
  });
}
