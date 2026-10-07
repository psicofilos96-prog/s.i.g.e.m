// N4.4.2 — Organização do Censo por domínio (escolas/turmas/alunos/profissionais).
// Projeção pura sobre a fotografia imutável: não calcula fato novo nem aplica regra do INEP.
import type { ReportDefinition, CellValue } from "@/features/reports/report-engine";
import type { CompareRow, SnapshotContent } from "./census-cycle";

export const CENSUS_DOMAINS = ["escolas", "turmas", "alunos", "profissionais"] as const;
export type CensusDomain = (typeof CENSUS_DOMAINS)[number];
export const DOMAIN_LABEL: Record<CensusDomain, string> = { escolas: "Escolas", turmas: "Turmas", alunos: "Alunos", profissionais: "Profissionais" };

/** Medidas de cada domínio (só as já produzidas pelo banco; a lista de escolas é o próprio domínio "escolas"). */
export const DOMAIN_MEASURES: Record<CensusDomain, readonly string[]> = {
  escolas: [],
  turmas: ["turmas", "enturmacoes_vigentes"],
  alunos: ["vinculos_ativos", "enturmacoes_vigentes", "posicoes_curriculares"],
  profissionais: ["lotacoes_profissionais"],
};

/** Regra estrutural → domínio. Regra desconhecida cai em "escolas" só para não sumir; nunca é descartada. */
export function ruleDomain(rule: string): CensusDomain {
  if (rule.includes("escola-sem-cadastro")) return "escolas";
  if (rule.includes("em-turma") || rule.startsWith("turma")) return "turmas";
  if (rule.startsWith("vinculo") || rule.startsWith("enturmacao")) return "alunos";
  if (rule.includes("lotacao") || rule.includes("profissional")) return "profissionais";
  return "escolas";
}

export type DomainCoverage = { domain: CensusDomain; known: number; unknown: number; findings: number };
export function domainCoverage(c: SnapshotContent): DomainCoverage[] {
  return CENSUS_DOMAINS.map((d) => {
    let known = 0, unknown = 0;
    if (d === "escolas") { for (const s of c.schools) (s.active ? known++ : unknown++); }
    else for (const s of c.schools) for (const m of DOMAIN_MEASURES[d]) { const v = s.measures[m]; if (!v || v.value === null) unknown++; else known++; }
    const findings = c.findings.filter((f) => ruleDomain(f.rule) === d).reduce((n, f) => n + f.count, 0);
    return { domain: d, known, unknown, findings };
  });
}

/** Fonte externa recebida duas vezes (mesmo hash) é o mesmo registro: o banco devolve o existente. */
export function isRepeatedImport(imports: readonly { source_sha256: string }[], sha: string): boolean {
  return imports.some((i) => i.source_sha256 === sha);
}

export const CENSUS_SNAPSHOT_REPORT: ReportDefinition = {
  id: "censo-fotografia-por-escola", version: 1, title: "Censo Escolar — fotografia por escola",
  description: "Medidas da fotografia vigente do ciclo; desconhecido nunca vira zero.",
  source: "census_snapshot_content", params: [],
  columns: [
    { id: "escola", label: "Escola", kind: "text" },
    { id: "ativa", label: "Cadastro ativo", kind: "text" },
    { id: "vinculos_ativos", label: "Vínculos ativos", kind: "number" },
    { id: "turmas", label: "Turmas", kind: "number" },
    { id: "enturmacoes_vigentes", label: "Enturmações vigentes", kind: "number" },
    { id: "posicoes_curriculares", label: "Posições curriculares", kind: "number" },
    { id: "lotacoes_profissionais", label: "Lotações profissionais", kind: "number" },
    { id: "inconsistencias", label: "Inconsistências estruturais", kind: "number" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
};

export function snapshotReportRows(c: SnapshotContent, names: ReadonlyMap<string, string>): Record<string, CellValue>[] {
  return c.schools.map((s) => {
    const row: Record<string, CellValue> = { escola: names.get(s.school_id) ?? "Escola sem nome registrado", ativa: s.active ? "sim" : "não" };
    for (const k of ["vinculos_ativos", "turmas", "enturmacoes_vigentes", "posicoes_curriculares", "lotacoes_profissionais"]) row[k] = s.measures[k]?.value ?? null;
    row["inconsistencias"] = c.findings.filter((f) => f.school_id === s.school_id).reduce((n, f) => n + f.count, 0);
    return row;
  });
}

export const CENSUS_RECONCILIATION_REPORT: ReportDefinition = {
  id: "censo-reconciliacao", version: 1, title: "Censo Escolar — reconciliação com fonte externa",
  description: "Comparação da fotografia com a fonte agregada recebida; nada é corrigido automaticamente.",
  source: "census_compare", params: [],
  columns: [
    { id: "escola", label: "Escola", kind: "text" }, { id: "medida", label: "Medida", kind: "text" },
    { id: "sigem", label: "SIGEM", kind: "number" }, { id: "fonte", label: "Fonte", kind: "number" }, { id: "situacao", label: "Situação", kind: "text" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 20000,
};

export function reconciliationRows(rows: readonly CompareRow[], names: ReadonlyMap<string, string>, measureLabel: Record<string, string>, categoryLabel: Record<string, string>): Record<string, CellValue>[] {
  return rows.map((r) => ({
    escola: names.get(r.school_id) ?? "Escola sem nome registrado", medida: measureLabel[r.measure] ?? r.measure,
    sigem: r.sigem_value, fonte: r.source_value, situacao: categoryLabel[r.category] ?? r.category,
  }));
}
