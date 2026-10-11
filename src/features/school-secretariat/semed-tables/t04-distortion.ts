/**
 * TSEMED.4 — Tabela 04 (distorção série × idade). Motor puro: idade na data de referência da regra,
 * faixa etária da coluna, matriz com um estudante por vez e indicador pela idade mínima de distorção
 * declarada por linha na regra registrada (`semed_t04_rule_versions`). Sem regra ⇒ sem indicador.
 */
import { SEMED_TABLES_2026, type Values } from "./semed-catalog";

const grid = SEMED_TABLES_2026.find((d) => d.code === "04")!.sections.find((s) => s.kind === "grid")!;
if (grid.kind !== "grid") throw new Error("catálogo 04 sem matriz");
export const T04_ROWS = grid.rows;
export const T04_COLS = grid.cols;

/** Idade completa em anos na data de referência (aniversário no próprio dia conta). */
export function ageAt(birth: string, ref: string): number | null {
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth), r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ref);
  if (!b || !r) return null;
  let a = Number(r[1]) - Number(b[1]);
  if (Number(r[2]) * 100 + Number(r[3]) < Number(b[2]) * 100 + Number(b[3])) a--;
  return a < 0 ? null : a;
}

/** Coluna da faixa etária e sua idade inicial. */
export function bucketOf(age: number): { key: string; from: number } {
  if (age <= 1) return { key: "a0-1", from: 0 };
  if (age <= 19) return { key: `a${age}`, from: age };
  for (const [lo, hi] of [[20, 24], [25, 29], [30, 34], [35, 39], [40, 49], [50, 59]] as const) if (age <= hi) return { key: `a${lo}-${hi}`, from: lo };
  return { key: "a60", from: 60 };
}
export const bucketFrom = (colKey: string): number => Number(/^a(\d+)/.exec(colKey)![1]);

export type StudentFact = { studentId: string; birthDate: string | null; rowKey: string | null };
export type Apuracao = { cells: Record<string, number>; counted: number; withoutBirth: number; withoutRow: number; duplicates: number };

/** Monta a matriz; o mesmo estudante nunca entra duas vezes (duplicata é contada e descartada). */
export function buildMatrix(facts: readonly StudentFact[], ref: string): Apuracao {
  const seen = new Set<string>(); const cells: Record<string, number> = {};
  let counted = 0, withoutBirth = 0, withoutRow = 0, duplicates = 0;
  for (const f of facts) {
    if (seen.has(f.studentId)) { duplicates++; continue; }
    seen.add(f.studentId);
    const age = f.birthDate ? ageAt(f.birthDate, ref) : null;
    if (age === null) { withoutBirth++; continue; }
    if (!f.rowKey || !T04_ROWS.some((r) => r.key === f.rowKey)) { withoutRow++; continue; }
    const k = `m.${f.rowKey}.${bucketOf(age).key}`; cells[k] = (cells[k] ?? 0) + 1; counted++;
  }
  return { cells, counted, withoutBirth, withoutRow, duplicates };
}

/** Valor final: ajuste justificado SUBSTITUI a célula apurada (nunca soma). */
export function mergeAdjusted(computed: Record<string, number>, adjustments: readonly { cell_key: string; value: number | null; created_at: string }[]): Values {
  const out: Record<string, number | null> = { ...computed };
  for (const a of [...adjustments].sort((x, y) => x.created_at.localeCompare(y.created_at))) out[a.cell_key] = a.value;
  return out;
}

export type DistortionRow = { rowKey: string; label: string; total: number | null; distorted: number | null; pct: number | null; threshold: number | null };

/** Distorção da linha = estudantes em faixas cuja idade inicial ≥ idade mínima declarada na regra. */
export function distortion(v: Values, thresholds: Readonly<Record<string, number>> | null): DistortionRow[] {
  return T04_ROWS.map((r) => {
    const vals = T04_COLS.map((c) => ({ from: bucketFrom(c.key), v: v[`m.${r.key}.${c.key}`] }));
    const present = vals.filter((x): x is { from: number; v: number } => typeof x.v === "number");
    const total = present.length ? present.reduce((a, b) => a + b.v, 0) : null;
    const t = thresholds?.[r.key] ?? null;
    if (t === null || total === null) return { rowKey: r.key, label: r.label, total, distorted: null, pct: null, threshold: t };
    // Faixa agregada que atravessa o limiar (ex.: 20–24 com limiar 22) não se divide: fica fora e torna o indicador indeterminado.
    if (present.some((x) => x.v > 0 && x.from < t && upper(x.from) >= t)) return { rowKey: r.key, label: r.label, total, distorted: null, pct: null, threshold: t };
    const distorted = present.filter((x) => x.from >= t).reduce((a, b) => a + b.v, 0);
    return { rowKey: r.key, label: r.label, total, distorted, pct: total === 0 ? null : Math.round((distorted / total) * 1000) / 10, threshold: t };
  });
}
function upper(from: number): number { const i = T04_COLS.findIndex((c) => bucketFrom(c.key) === from); const n = T04_COLS[i + 1]; return n ? bucketFrom(n.key) - 1 : 200; }
