/**
 * Gestão de Pessoas L16 — Dimensionamento não docente.
 * Área (direção, secretaria, orientação, mediação, alimentação, apoio,
 * administração...) é rótulo aberto. Quantitativo de referência só existe por
 * CRITÉRIO configurado: versão, fundamento documental, homologação, vigência
 * e fórmula de lista fechada (fixo / por-faixa / por-unidade). Sem critério
 * homologado ⇒ "sem critério", nunca número presumido.
 */

export type Formula =
  | Readonly<{ type: "fixo"; quantity: number }>
  | Readonly<{ type: "por-unidade"; driver: string; perUnits: number; minimum: number | null; rounding: "cima" | "baixo" }>
  | Readonly<{ type: "por-faixa"; driver: string; bands: readonly { upTo: number | null; quantity: number }[] }>;

export type SizingCriterion = Readonly<{
  id: string; area: string; version: number; formula: Formula; basis: string | null;
  validFrom: string; validUntil: string | null; homologated: boolean; scope: "rede" | readonly string[]; // escolas
}>;

export type SizingResult = Readonly<{
  schoolId: string; area: string;
  reference: number | null; current: number | null; difference: number | null;
  state: "calculado" | "sem-criterio" | "criterio-ambiguo" | "driver-ausente" | "quadro-nao-lido";
  criterionRef: string | null; driverValue: number | null;
}>;

export type CriterionProblem = "sem-fundamento" | "faixas-invalidas" | "parametro-invalido" | "intervalo-invalido";

export function validateCriterion(c: SizingCriterion): CriterionProblem[] {
  const out: CriterionProblem[] = [];
  if (c.homologated && !c.basis?.trim()) out.push("sem-fundamento");
  if (c.validUntil && c.validUntil < c.validFrom) out.push("intervalo-invalido");
  const f = c.formula;
  if (f.type === "fixo" && !(Number.isInteger(f.quantity) && f.quantity >= 0)) out.push("parametro-invalido");
  if (f.type === "por-unidade" && !(f.perUnits > 0) ) out.push("parametro-invalido");
  if (f.type === "por-faixa") {
    const ok = f.bands.length > 0 && f.bands.every((b, i) => b.quantity >= 0 && (i === f.bands.length - 1 ? true : b.upTo !== null && (i === 0 || b.upTo > (f.bands[i - 1]!.upTo ?? Infinity))));
    if (!ok) out.push("faixas-invalidas");
  }
  return out;
}

const applies = (c: SizingCriterion, schoolId: string, day: string) =>
  c.homologated && c.validFrom <= day && (c.validUntil === null || c.validUntil >= day) && (c.scope === "rede" || c.scope.includes(schoolId));

export function evaluate(f: Formula, drivers: (name: string) => number | null): { value: number | null; driver: number | null } {
  if (f.type === "fixo") return { value: f.quantity, driver: null };
  const d = drivers(f.driver);
  if (d === null) return { value: null, driver: null };
  if (f.type === "por-unidade") {
    const raw = d / f.perUnits;
    const v = f.rounding === "cima" ? Math.ceil(raw) : Math.floor(raw);
    return { value: f.minimum !== null ? Math.max(f.minimum, v) : v, driver: d };
  }
  const band = f.bands.find((b) => b.upTo === null || d <= b.upTo);
  return { value: band ? band.quantity : null, driver: d };
}

export function sizeArea(
  schoolId: string, area: string, day: string,
  criteria: readonly SizingCriterion[],
  drivers: (name: string) => number | null,
  current: number | null, // quadro em exercício na área (L04); null = não lido
): SizingResult {
  const base = { schoolId, area, current };
  const cs = criteria.filter((c) => c.area === area && applies(c, schoolId, day) && validateCriterion(c).length === 0);
  // escopo de escola prevalece sobre rede
  const specific = cs.filter((c) => c.scope !== "rede");
  const pool = specific.length ? specific : cs;
  if (pool.length === 0) return { ...base, reference: null, difference: null, state: "sem-criterio", criterionRef: null, driverValue: null };
  if (pool.length > 1) return { ...base, reference: null, difference: null, state: "criterio-ambiguo", criterionRef: null, driverValue: null };
  const c = pool[0]!;
  const r = evaluate(c.formula, drivers);
  const ref = `${c.id}@${c.version}`;
  if (r.value === null) return { ...base, reference: null, difference: null, state: "driver-ausente", criterionRef: ref, driverValue: null };
  if (current === null) return { ...base, reference: r.value, difference: null, state: "quadro-nao-lido", criterionRef: ref, driverValue: r.driver };
  return { ...base, reference: r.value, difference: current - r.value, state: "calculado", criterionRef: ref, driverValue: r.driver };
}

/** Áreas sugeridas na interface; lista aberta, não limite do domínio. */
export const SUGGESTED_AREAS = ["direcao", "secretaria", "orientacao", "mediacao", "alimentacao", "apoio", "administracao"] as const;
