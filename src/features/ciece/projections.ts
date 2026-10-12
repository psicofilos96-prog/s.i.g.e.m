/**
 * CIECE Lote 16 — Projeções e planejamento (núcleo puro; nunca grava, nunca vira fato).
 * Reaproveita: cenário sobre turmas reais = `scenarios/scenario-model.ts` (base congelada, promoção
 * só por writer canônico); demanda/cobertura docente real = `staffing/teacher-need.ts`.
 * Aqui: projeção de demanda por histórico, abertura/encerramento de turmas, ampliação de jornada e
 * necessidade de professores — toda saída é `nature: "projecao"`, com premissas, horizonte,
 * incerteza e versão. Parâmetro ausente ⇒ recusa, nunca valor presumido.
 */
export const PROJECTION_VERSION = 1;
export type Premise = { key: string; value: number | string; source: "usuario" | "regra-homologada" | "historico"; ref: string };
export type Projection<T> = { nature: "projecao"; official: false; label: string; version: number; method: string; horizon: string[]; premises: Premise[]; result: T; uncertainty: string[] } | { nature: "recusada"; reasons: string[] };

const refuse = (...reasons: string[]) => ({ nature: "recusada" as const, reasons });
const wrap = <T>(method: string, horizon: string[], premises: Premise[], result: T, uncertainty: string[]): Projection<T> =>
  ({ nature: "projecao", official: false, label: "PROJEÇÃO — não é matrícula nem necessidade constatada", version: PROJECTION_VERSION, method, horizon, premises, result, uncertainty });

/** Demanda: só histórico oficial com valor lido (null não entra), ≥3 anos consecutivos; tendência linear declarada com faixa = resíduo máximo. */
export function projectDemand(history: { year: number; value: number | null; source: string }[], horizonYears: number[]): Projection<{ year: number; central: number; low: number; high: number }[]> {
  const h = history.filter((x) => x.value !== null).sort((a, b) => a.year - b.year);
  const r: string[] = [];
  if (h.length < 3) r.push("historico-insuficiente(<3 anos lidos)");
  if (h.some((x, i) => i > 0 && x.year !== h[i - 1]!.year + 1)) r.push("historico-com-lacuna");
  if (!horizonYears.length) r.push("horizonte-nao-declarado");
  if (horizonYears.some((y) => h.length && y <= h[h.length - 1]!.year)) r.push("horizonte-nao-futuro");
  if (r.length) return refuse(...r);
  const n = h.length, mx = h.reduce((s, x) => s + x.year, 0) / n, my = h.reduce((s, x) => s + x.value!, 0) / n;
  const slope = h.reduce((s, x) => s + (x.year - mx) * (x.value! - my), 0) / h.reduce((s, x) => s + (x.year - mx) ** 2, 0);
  const at = (y: number) => my + slope * (y - mx);
  const resid = Math.max(...h.map((x) => Math.abs(x.value! - at(x.year))));
  const last = h[n - 1]!.year;
  return wrap("tendencia-linear-mmq", horizonYears.map(String), h.map((x) => ({ key: `historico:${x.year}`, value: x.value!, source: "historico", ref: x.source })),
    horizonYears.map((y) => { const c = Math.round(at(y)), w = Math.round(resid * (1 + (y - last) / n)); return { year: y, central: c, low: Math.max(0, c - w), high: c + w }; }),
    ["faixa = maior resíduo do histórico, ampliada com o horizonte", "não considera mudança de oferta, território ou política"]);
}

/** Turmas: capacidade por turma só por premissa explícita; mostra abrir/encerrar como hipótese. */
export function projectClasses(demand: { low: number; central: number; high: number }, currentClasses: number | null, capacity: Premise | null): Projection<{ needed: { low: number; central: number; high: number }; open: number; close: number }> {
  const cap = capacity && typeof capacity.value === "number" && capacity.value > 0 ? capacity.value : null;
  if (cap === null) return refuse("capacidade-por-turma-nao-declarada");
  if (currentClasses === null) return refuse("turmas-atuais-nao-lidas");
  const k = (v: number) => Math.ceil(v / cap);
  const c = k(demand.central);
  return wrap("divisao-por-capacidade-declarada", [], [capacity!], { needed: { low: k(demand.low), central: c, high: k(demand.high) }, open: Math.max(0, c - currentClasses), close: Math.max(0, currentClasses - c) }, ["arredondamento para cima por turma", "não considera multisseriação nem espaço físico"]);
}

/** Jornada/professores: carga semanal só da matriz válida; carga contratual só declarada; unidades distintas nunca somam. */
export function projectTeachers(input: { classes: number; matrix: { id: string; valid: boolean; weeklyUnits: number | null; unit: string } | null; extraUnitsPerClass?: Premise; contractualLoad: Premise & { unit?: string } | null }): Projection<{ demandUnits: number; teachers: number }> {
  const r: string[] = [];
  const m = input.matrix;
  if (!m) r.push("matriz-nao-informada"); else { if (!m.valid) r.push("matriz-nao-vigente-ou-nao-homologada"); if (m.weeklyUnits === null) r.push("carga-da-matriz-nao-literal"); }
  const cl = input.contractualLoad;
  if (!cl || typeof cl.value !== "number" || cl.value <= 0) r.push("carga-contratual-nao-declarada");
  else if (m && cl.unit && cl.unit !== m.unit) r.push("unidades-incompativeis(sem-regra-de-conversao)");
  if (r.length) return refuse(...r);
  const extra = typeof input.extraUnitsPerClass?.value === "number" ? input.extraUnitsPerClass.value : 0;
  const demandUnits = input.classes * (m!.weeklyUnits! + extra);
  const premises = [cl!, ...(input.extraUnitsPerClass ? [input.extraUnitsPerClass] : []), { key: "matriz", value: m!.id, source: "regra-homologada" as const, ref: m!.id }];
  return wrap("unidades-da-matriz/carga-contratual", [], premises, { demandUnits, teachers: Math.ceil(demandUnits / (cl!.value as number)) },
    ["não desconta professores atuais (ver teacher-need.ts)", "não considera habilitação por componente"]);
}

/** Cenário versionado: horizonte + premissas congeladas; nunca é lido por relatório oficial. */
export function scenarioRecord(p: { id: string; author: string; createdAt: string; projections: Projection<unknown>[] }) {
  const ok = p.projections.every((x) => x.nature === "projecao");
  return { ...p, version: PROJECTION_VERSION, publishable: false as const, status: ok ? "completo" : "com-recusas", officialUse: "proibido" as const };
}
