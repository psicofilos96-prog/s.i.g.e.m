import type { Block, OfficialMapDoc } from "./map-official-model";
export type MapTable = Extract<Block, { kind: "table" }>;
const numeric = (value: string | undefined): number | null => {
  if (!value || !/^\d[\d.]*$/.test(value)) return null;
  const n = Number(value.replaceAll(".", ""));
  return Number.isFinite(n) ? n : null;
};
const add = (a: number | null, b: number | null) => a === null || b === null ? null : a + b;
export function movementSummary(doc: OfficialMapDoc) {
  const table = doc.sections.find((s) => s.id === "II")?.blocks.find((b): b is MapTable => b.kind === "table" && b.cols.some((c) => c.label === "Total"));
  const value = (label: string) => numeric(table?.rows.find((r) => r.cells[0] === label)?.cells.at(-1));
  return { previous: value("Matrícula do mês anterior"), entries: add(value("Alunos novos"), value("Transferências recebidas")), exits: add(value("Transferências expedidas"), value("Evadidos")), current: value("Total") };
}
export function enrollmentSummary(doc: OfficialMapDoc) {
  const table = doc.sections.find((s) => s.id === "III")?.blocks.find((b): b is MapTable => b.kind === "table" && b.caption === "Total de alunos na escola");
  const row = table?.rows[0];
  return { total: numeric(row?.cells.at(-1)), shifts: table?.cols.slice(1, -1).map((c, i) => ({ label: c.label, value: numeric(row?.cells[i + 1]) })) ?? [] };
}