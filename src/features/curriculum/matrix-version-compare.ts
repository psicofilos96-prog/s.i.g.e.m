import type { InstitutionalMatrixItem } from "./curricular-matrix-source";

/** NCURR.1 — comparação pura entre duas versões lidas pelos readers canônicos. */
export type ItemChange =
  | { kind: "incluido"; itemKey: string; after: InstitutionalMatrixItem }
  | { kind: "retirado"; itemKey: string; before: InstitutionalMatrixItem }
  | { kind: "carga-alterada"; itemKey: string; before: InstitutionalMatrixItem; after: InstitutionalMatrixItem }
  | { kind: "referencia-alterada"; itemKey: string; before: InstitutionalMatrixItem; after: InstitutionalMatrixItem };

const refKey = (i: InstitutionalMatrixItem) =>
  i.reference.kind === "componente" ? `c:${i.reference.componentId}` : `e:${i.reference.schemeId}:${i.reference.valueId}@${i.reference.valueVersion}`;
const loadKey = (i: InstitutionalMatrixItem) =>
  i.load ? `${i.load.quantity}|${i.load.unitValueId}@${i.load.unitValueVersion}` : "sem-carga";

export function compareMatrixVersions(before: readonly InstitutionalMatrixItem[], after: readonly InstitutionalMatrixItem[]): ItemChange[] {
  const b = new Map(before.map((i) => [i.itemKey, i]));
  const a = new Map(after.map((i) => [i.itemKey, i]));
  const out: ItemChange[] = [];
  for (const [k, x] of b) if (!a.has(k)) out.push({ kind: "retirado", itemKey: k, before: x });
  for (const [k, y] of a) {
    const x = b.get(k);
    if (!x) { out.push({ kind: "incluido", itemKey: k, after: y }); continue; }
    if (refKey(x) !== refKey(y)) out.push({ kind: "referencia-alterada", itemKey: k, before: x, after: y });
    else if (loadKey(x) !== loadKey(y)) out.push({ kind: "carga-alterada", itemKey: k, before: x, after: y });
  }
  return out.sort((p, q) => p.itemKey.localeCompare(q.itemKey));
}

/** Texto da carga: ausência é "Ainda não configurado", nunca zero. */
export function loadLabel(i: InstitutionalMatrixItem): string {
  return i.load ? String(i.load.quantity) : "Ainda não configurado";
}
