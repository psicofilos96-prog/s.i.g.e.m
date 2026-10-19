// Relatório PNAE de apoio: refeições servidas por escola/dia/turno, Adesão Real e Total Bruto.
// Lê as contagens que o Diário da Cozinha grava em count_basis; contagem ausente fica "não informado", nunca zero.
import type { CellValue, ReportDefinition } from "@/features/reports/report-engine";

export interface ExecRow { executed_on: string; meal_slot_value_id: string; meals_total: number | null; count_basis: string | null; students_present: number | null; followed: boolean | null }

const pick = (basis: string | null, label: string): number | null => {
  if (!basis) return null;
  const m = new RegExp(`${label}:\\s*(\\d+)`).exec(basis);
  return m ? Number(m[1]) : null;
};

export function parseCounts(basis: string | null) {
  return { first: pick(basis, "1ª refeição a alunos"), repeats: pick(basis, "repetições"), staff: pick(basis, "servidores") };
}

/** Adesão = 1ª refeição ÷ presentes, com teto de 100%; sem um dos lados, null. */
export function adhesionPct(first: number | null, present: number | null): number | null {
  if (first == null || present == null || present <= 0) return null;
  return Math.min(100, Math.round((first / present) * 1000) / 10);
}

export function servedMealsRows(rows: ExecRow[], slotLabel: (v: string) => string): Record<string, CellValue>[] {
  return [...rows].sort((a, b) => a.executed_on.localeCompare(b.executed_on) || a.meal_slot_value_id.localeCompare(b.meal_slot_value_id)).map((r) => {
    const c = parseCounts(r.count_basis);
    return {
      date: r.executed_on, slot: slotLabel(r.meal_slot_value_id),
      present: r.students_present, first: c.first, repeats: c.repeats, staff: c.staff,
      total: r.meals_total, adhesion: adhesionPct(c.first, r.students_present),
      followed: r.followed == null ? "não informado" : r.followed ? "sim" : "não/parcial",
    };
  });
}

/** Totais do período: soma só o que foi informado; conta quantos registros faltaram para cada grandeza. */
export function servedMealsTotals(rows: Record<string, CellValue>[]) {
  const sum = (k: string) => { let s = 0, missing = 0; for (const r of rows) { const v = r[k]; if (typeof v === "number") s += v; else missing++; } return { sum: s, missing }; };
  const first = sum("first"), present = sum("present");
  return { days: new Set(rows.map((r) => r["date"])).size, total: sum("total"), first, repeats: sum("repeats"), staff: sum("staff"), present,
    adhesion: first.missing === 0 && present.missing === 0 ? adhesionPct(first.sum, present.sum) : null };
}

export const REFEICOES_PNAE: ReportDefinition = {
  id: "refeicoes-servidas-pnae", version: 1, title: "Refeições servidas e adesão — apoio PNAE",
  description: "Do Diário da Cozinha. Adesão Real = 1ª refeição ÷ presentes (máx. 100%). Total bruto = alunos + repetições + servidores. Demonstrativo de apoio, não é transmissão ao FNDE.",
  source: "meal_executions_at", params: [{ id: "from", label: "De", type: "date", required: true }, { id: "to", label: "Até", type: "date", required: true }],
  columns: [
    { id: "date", label: "Data", kind: "date" }, { id: "slot", label: "Refeição/turno", kind: "text" },
    { id: "present", label: "Presentes", kind: "number" }, { id: "first", label: "1ª refeição", kind: "number" },
    { id: "repeats", label: "Repetições", kind: "number" }, { id: "staff", label: "Servidores", kind: "number" },
    { id: "total", label: "Total bruto", kind: "number" }, { id: "adhesion", label: "Adesão (%)", kind: "number" },
    { id: "followed", label: "Cardápio cumprido", kind: "text" },
  ],
  formats: ["xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
};
