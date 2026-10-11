// A&A Lote 13 — Diagnóstica, Formativa, Simula SAEB e Produção Textual (projeções puras; o banco valida e grava).
import { diagnosticBand } from "./methodology-rules";

export type LcProgram = "diagnostica" | "formativa" | "simula-saeb" | "producao-textual";
export const PROGRAM_LABEL: Record<LcProgram, string> = { diagnostica: "Diagnóstica", formativa: "Formativa", "simula-saeb": "Simula SAEB", "producao-textual": "Produção Textual" };
export const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "TEC"] as const;
export type LcItem = { n: number; ref_kind: "bncc" | "descritor"; ref_code: string; scoring: "binario" | "rubrica"; max?: number };
export type LcCriterion = { key: string; label: string; max: number };
export type LcFormula = { kind: "soma-ponderada"; weights: Record<string, number>; source: string };
export type LcInstrument = { id: string; logical_id: string; version: number; program_key: LcProgram; edition_year: number; round_label: string;
  grade: string; area: "LP" | "MAT"; matrix_ref: string; items: LcItem[]; criteria: LcCriterion[]; general_formula: LcFormula | null;
  source_ref: string; author_user_id: string; recorded_at: string };
export type LcHomologation = { instrument_version_id: string; decision: "homologado" | "revogado"; recorded_at: string };
export type ResultValue = number | "nao-aplicado";
export type LcEntry = { id: string; logical_id: string; version: number; instrument_version_id: string; school_id: string; class_id: string; student_id: string;
  presence: "presente" | "ausente" | "nao-registrado"; results: Record<string, ResultValue>; author_user_id: string; recorded_at: string };
export type LcReview = { entry_version_id: string; decision: "conferido" | "devolvido" | "homologado"; recorded_at: string };

const D_CODE = /^D\d{1,3}$/i;
const BNCC_CODE = /^EF\d{2}(LP|MA)\d{2}$|^EF\d{2}\d{2}(LP|MA)\d{2}$|^EF(15|35|67|69|89)(LP|MA)\d{2}$/i;

export function validateInstrumentDraft(d: { program: LcProgram; grade: string; area: string; round: string; matrix: string; source: string;
  items: LcItem[]; criteria: LcCriterion[]; formula: LcFormula | null }): string[] {
  const e: string[] = [];
  if (!(GRADES as readonly string[]).includes(d.grade)) e.push("Ano inválido (1º–9º ou TEC).");
  if (d.area !== "LP" && d.area !== "MAT") e.push("Área deve ser LP ou Matemática.");
  if (!d.round.trim()) e.push("Informe a edição/rodada.");
  if (d.matrix.trim().length < 3) e.push("Informe a matriz de referência (versão).");
  if (d.source.trim().length < 3) e.push("Informe a fonte.");
  if (d.program === "simula-saeb" && d.grade !== "4" && d.grade !== "8") e.push("Simula SAEB é só 4º ou 8º ano.");
  if (d.program === "producao-textual") {
    if (!["3", "4", "5", "6", "7", "8", "9", "TEC"].includes(d.grade)) e.push("Produção Textual é 3º–9º ou TEC.");
    if (d.area !== "LP") e.push("Produção Textual é de Língua Portuguesa.");
    if (d.criteria.length !== 3) e.push("Produção Textual exige exatamente três critérios.");
    if (d.items.length) e.push("Produção Textual usa critérios, não itens.");
    for (const c of d.criteria) if (!c.key.trim() || !c.label.trim() || !(c.max > 0)) e.push(`Critério "${c.label || c.key}": chave, nome e máximo obrigatórios.`);
    if (d.formula) {
      if (d.formula.source.trim().length < 3) e.push("Fórmula geral sem fonte documentada.");
      for (const c of d.criteria) if (typeof d.formula.weights[c.key] !== "number") e.push(`Fórmula sem peso para "${c.key}".`);
    }
  } else {
    if (!d.items.length) e.push("Informe ao menos um item.");
    if (d.criteria.length || d.formula) e.push("Critérios/fórmula só em Produção Textual.");
    const ns = new Set<number>();
    for (const it of d.items) {
      if (!Number.isInteger(it.n) || it.n < 1 || ns.has(it.n)) e.push(`Item ${it.n}: número inválido ou repetido.`);
      ns.add(it.n);
      if (d.program === "simula-saeb" && it.ref_kind !== "descritor") e.push(`Item ${it.n}: Simula SAEB usa descritor D.`);
      if (it.ref_kind === "descritor" && !D_CODE.test(it.ref_code)) e.push(`Item ${it.n}: descritor deve ser "D" + número.`);
      if (it.ref_kind === "bncc" && !BNCC_CODE.test(it.ref_code)) e.push(`Item ${it.n}: código BNCC malformado.`);
      if (it.scoring === "rubrica" && !(Number(it.max) > 0)) e.push(`Item ${it.n}: rubrica exige pontuação máxima.`);
    }
  }
  return e;
}

export const isHomologated = (id: string, h: LcHomologation[]) =>
  h.filter((x) => x.instrument_version_id === id).sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1)).at(-1)?.decision === "homologado";
export function heads<T extends { logical_id: string; version: number }>(rows: T[]): T[] {
  const m = new Map<string, T>(); for (const r of rows) { const c = m.get(r.logical_id); if (!c || c.version < r.version) m.set(r.logical_id, r); } return [...m.values()];
}
export function entryState(h: LcEntry, rv: LcReview[]) {
  return rv.filter((r) => r.entry_version_id === h.id).sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1)).at(-1)?.decision ?? "rascunho";
}

const maxOf = (it: LcItem) => (it.scoring === "binario" ? 1 : Number(it.max));
/** Percentual de pontos: ausência de registro e "não aplicado" ficam fora; ausente ⇒ null, nunca zero. */
export function itemScore(entry: Pick<LcEntry, "presence" | "results">, items: LcItem[]) {
  if (entry.presence !== "presente") return { pct: null as number | null, counted: 0, missing: items.length };
  let got = 0, max = 0, counted = 0, missing = 0;
  for (const it of items) { const v = entry.results[String(it.n)]; if (v === undefined) { missing++; continue; } if (v === "nao-aplicado") continue; got += v; max += maxOf(it); counted++; }
  return { pct: max ? (got / max) * 100 : null, counted, missing };
}

/** Agrupamento por habilidade/descritor: só itens com registro; n = estudantes presentes com algum item da habilidade. */
export function bySkill(entries: LcEntry[], inst: LcInstrument) {
  const codes = [...new Set(inst.items.map((i) => i.ref_code.toUpperCase()))];
  const present = heads(entries.filter((e) => e.instrument_version_id === inst.id)).filter((e) => e.presence === "presente");
  return codes.map((code) => {
    const its = inst.items.filter((i) => i.ref_code.toUpperCase() === code);
    const vals = present.map((e) => itemScore(e, its).pct).filter((x): x is number => x != null);
    const mean = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null;
    return { code, kind: its[0]!.ref_kind, items: its.map((i) => i.n), n: vals.length, mean, band: mean == null ? null : diagnosticBand(mean) };
  });
}

/** Produção Textual: critérios separados; resultado geral só com fórmula configurada e todos os critérios registrados. */
export function textResult(entry: Pick<LcEntry, "presence" | "results">, inst: Pick<LcInstrument, "criteria" | "general_formula">) {
  const criteria = inst.criteria.map((c) => { const v = entry.presence === "presente" ? entry.results[c.key] : undefined; return { key: c.key, label: c.label, value: typeof v === "number" ? v : null, max: c.max }; });
  if (entry.presence !== "presente") return { criteria, general: null, reason: "Estudante não presente." };
  if (!inst.general_formula) return { criteria, general: null, reason: "Resultado geral não configurado: fórmula e pesos não documentados." };
  if (criteria.some((c) => c.value == null)) return { criteria, general: null, reason: "Critério sem registro; resultado geral não calculado." };
  const w = inst.general_formula.weights;
  return { criteria, general: criteria.reduce((s, c) => s + (c.value as number) * w[c.key]!, 0), reason: null };
}

/** Comparação só entre instrumentos compatíveis. */
export function compatible(a: LcInstrument, b: LcInstrument): { ok: true } | { ok: false; reason: string } {
  if (a.program_key !== b.program_key) return { ok: false, reason: "Programas diferentes." };
  if (a.area !== b.area || a.grade !== b.grade) return { ok: false, reason: "Ano ou área diferentes." };
  if (a.matrix_ref !== b.matrix_ref) return { ok: false, reason: "Matrizes diferentes." };
  if (a.program_key === "producao-textual") {
    const ka = a.criteria.map((c) => `${c.key}:${c.max}`).join("|"), kb = b.criteria.map((c) => `${c.key}:${c.max}`).join("|");
    if (ka !== kb) return { ok: false, reason: "Critérios diferentes." };
    if (JSON.stringify(a.general_formula) !== JSON.stringify(b.general_formula)) return { ok: false, reason: "Fórmula geral diferente." };
  } else {
    const ka = new Set(a.items.map((i) => `${i.ref_code.toUpperCase()}:${i.scoring}`)), kb = new Set(b.items.map((i) => `${i.ref_code.toUpperCase()}:${i.scoring}`));
    if (![...ka].some((k) => kb.has(k))) return { ok: false, reason: "Nenhuma habilidade com mesma correção em comum." };
  }
  return { ok: true };
}
