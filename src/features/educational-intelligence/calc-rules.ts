/** Lote 17 — catálogo versionado de regras de cálculo (0376). O código só declara QUE tipo de regra
 * cada indicador derivado exige; valores (pesos, limiares, escalas, eixo×item) vêm só de regra homologada.
 * Sem regra: indicador bloqueado com "regra pendente"; o lançamento bruto nunca é afetado. */
import type { CellValue, ReportDefinition } from "@/features/reports/report-engine";

export type RuleKind = "instrumento" | "matriz" | "rubrica" | "parametro" | "peso" | "escala" | "correspondencia-eixo-item" | "limiar" | "formula";
export const RULE_KIND_LABEL: Record<RuleKind, string> = { instrumento: "Instrumento", matriz: "Matriz", rubrica: "Rubrica", parametro: "Parâmetro", peso: "Pesos",
  escala: "Escala", "correspondencia-eixo-item": "Correspondência eixo × item", limiar: "Limiar", formula: "Fórmula" };

export type CalcRule = { id: string; logical_id: string; version: number; program_key: string; edition_label: string; rule_kind: RuleKind; rule_key: string;
  payload: Record<string, unknown>; source_ref: string; reason: string | null; author_user_id: string; recorded_at: string };
export type RuleHomologation = { rule_version_id: string; decision: "homologado" | "revogado"; recorded_at: string };

/** Indicadores derivados e os tipos de regra que exigem (estrutura, não valor). */
export const DERIVED_INDICATORS: readonly { key: string; label: string; program: string; requires: readonly RuleKind[] }[] = [
  { key: "pt-resultado-geral", label: "Produção Textual — resultado geral", program: "producao-textual", requires: ["rubrica", "peso", "formula"] },
  { key: "pt-criterio-limiar", label: "Produção Textual — critério de 90%", program: "producao-textual", requires: ["limiar"] },
  { key: "saber-ler-por-eixo", label: "Saber Ler — desempenho por eixo", program: "saber-ler", requires: ["correspondencia-eixo-item"] },
  { key: "saber-ler-faixa", label: "Saber Ler — faixa de percentual", program: "saber-ler", requires: ["escala"] },
  { key: "local-nota-ponderada", label: "Diagnóstica/Formativa — nota ponderada", program: "diagnostica", requires: ["peso", "formula"] },
  { key: "simula-por-descritor", label: "Simula SAEB — acerto por descritor", program: "simula-saeb", requires: ["matriz", "correspondencia-eixo-item"] },
  { key: "intervencao-limiar", label: "Intervenção — limiar de domínio", program: "rede", requires: ["limiar"] },
];

export function validateRule(kind: RuleKind, payload: Record<string, unknown>, source: string): string[] {
  const e: string[] = [];
  if (source.trim().length < 3) e.push("Fonte documental obrigatória.");
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (kind === "peso") { const w = payload["weights"] as Record<string, unknown> | undefined; if (!w || !Object.keys(w).length || Object.values(w).some((x) => !num(x) || (x as number) < 0)) e.push("Pesos: objeto { critério: número ≥ 0 }."); }
  if (kind === "limiar" && (!num(payload["value"]) || !["<", "<=", ">", ">="].includes(String(payload["comparison"])))) e.push("Limiar: { value: número, comparison: <, <=, > ou >= }.");
  if (kind === "escala" && (!num(payload["min"]) || !num(payload["max"]) || (payload["min"] as number) >= (payload["max"] as number))) e.push("Escala: { min, max } com min < max.");
  if (kind === "correspondencia-eixo-item") { const m = payload["map"]; if (!m || typeof m !== "object" || !Object.keys(m).length) e.push("Correspondência: { map: { item: eixo } }."); }
  if (kind === "formula" && !["soma-ponderada", "media", "soma", "proporcao"].includes(String(payload["kind"]))) e.push("Fórmula: só soma-ponderada, media, soma ou proporcao.");
  return e;
}

/** Versão vigente homologada: última versão do lógico cuja última decisão é "homologado". */
export function homologatedRules(rules: CalcRule[], homs: RuleHomologation[]): CalcRule[] {
  const last = new Map<string, RuleHomologation>();
  for (const h of [...homs].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))) last.set(h.rule_version_id, h);
  const head = new Map<string, CalcRule>();
  for (const r of rules) { const c = head.get(r.logical_id); if (!c || r.version > c.version) head.set(r.logical_id, r); }
  return [...head.values()].filter((r) => last.get(r.id)?.decision === "homologado");
}

export type IndicatorReadiness = { key: string; label: string; status: "pronto" | "regra-pendente" | "ambiguo"; missing: RuleKind[]; rules: CalcRule[] };
export function indicatorReadiness(key: string, edition: string, homologated: CalcRule[]): IndicatorReadiness {
  const ind = DERIVED_INDICATORS.find((i) => i.key === key);
  if (!ind) return { key, label: key, status: "regra-pendente", missing: [], rules: [] };
  const scoped = homologated.filter((r) => r.program_key === ind.program && r.edition_label === edition);
  const missing: RuleKind[] = []; const used: CalcRule[] = []; let ambiguous = false;
  for (const k of ind.requires) {
    const rs = scoped.filter((r) => r.rule_kind === k);
    if (rs.length === 0) missing.push(k); else if (rs.length > 1) ambiguous = true; else used.push(rs[0]!);
  }
  return { key, label: ind.label, status: missing.length ? "regra-pendente" : ambiguous ? "ambiguo" : "pronto", missing, rules: used };
}

/** Guarda para dashboards/relatórios: devolve o valor derivado só com indicador pronto; senão null + motivo. Lançamento bruto não passa por aqui. */
export function guardDerived<T>(r: IndicatorReadiness, compute: (rules: CalcRule[]) => T): { value: T | null; reason: string | null } {
  if (r.status === "pronto") return { value: compute(r.rules), reason: null };
  return { value: null, reason: r.status === "ambiguo" ? "Mais de uma regra homologada do mesmo tipo para a edição." : `Regra pendente: ${r.missing.map((m) => RULE_KIND_LABEL[m]).join(", ")}.` };
}

export const RULES_REPORT: ReportDefinition = {
  id: "aa-catalogo-regras", version: 1, title: "Catálogo de regras de cálculo — Acompanhamento e Avaliação", description: "Projeção de aa_calc_rule_versions.",
  source: "aa_calc_rule_versions", params: [],
  columns: [{ id: "programa", label: "Programa", kind: "text" }, { id: "edicao", label: "Edição", kind: "text" }, { id: "tipo", label: "Tipo", kind: "text" },
    { id: "chave", label: "Chave", kind: "text" }, { id: "versao", label: "Versão", kind: "number" }, { id: "situacao", label: "Situação", kind: "text" }, { id: "fonte", label: "Fonte", kind: "text" }],
  formats: ["xlsx", "pdf", "csv"], reproducible: false, syncRowLimit: 1000,
};
export const rulesReportRows = (rules: CalcRule[], homologated: Set<string>): Record<string, CellValue>[] =>
  rules.map((r) => ({ programa: r.program_key, edicao: r.edition_label, tipo: RULE_KIND_LABEL[r.rule_kind], chave: r.rule_key, versao: r.version,
    situacao: homologated.has(r.id) ? "Homologada" : "Não homologada", fonte: r.source_ref }));
