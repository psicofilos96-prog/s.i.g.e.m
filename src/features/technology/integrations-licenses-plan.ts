// SIGEM Tecnologia L22 — integrações, contratos, licenças e plano anual (migration 0495).
// Integração = leitura de fonte canônica de outro setor (nunca cópia); contrato = juntada no SIGEM Documentos;
// licença = versão com contrato; uso = acessos ativos (L16); plano anual = versão aprovada por pessoa ≠ autor.

export interface TechIntegration {
  sector: string;
  source: string;
  direction: "leitura" | "referencia";
  purpose: string;
}

export const TECH_INTEGRATIONS: readonly TechIntegration[] = [
  { sector: "Gestão de Pessoas", source: "institutional_engagements", direction: "leitura", purpose: "atuação vigente de solicitante, técnico e tomador" },
  { sector: "Patrimônio", source: "ops_assets", direction: "referencia", purpose: "equipamento é bem patrimonial (L11/L21)" },
  { sector: "Infraestrutura", source: "ops_spaces", direction: "referencia", purpose: "laboratórios e ambientes" },
  { sector: "Documentos", source: "admin_case_events", direction: "referencia", purpose: "contratos, termos e evidências juntados" },
  { sector: "Desenvolvimento", source: "dev_classes", direction: "referencia", purpose: "formação em tecnologia educacional" },
  { sector: "Orientação", source: "tech_accessibility_declarations", direction: "leitura", purpose: "recursos de acessibilidade conferidos; nenhum dado do estudante" },
  { sector: "Direção", source: "ops_requests", direction: "leitura", purpose: "chamados da escola sob RLS de quem consulta" },
  { sector: "Gestão Central", source: "tech_annual_plan_versions", direction: "leitura", purpose: "plano anual aprovado e painéis da rede" },
];

export const PLAN_ACTION_KINDS = ["aquisicao", "manutencao", "formacao", "conectividade", "seguranca", "inovacao", "licenciamento", "infraestrutura"] as const;
export const PLAN_REF_SOURCES = ["ops_assets", "ops_spaces", "ops_requests", "tech_changes", "tech_digital_service_versions", "tech_innovation_projects", "dev_classes", "admin_case_files", "tech_connectivity_links"] as const;

export interface PlanAction { title: string; kind: string; refs?: { source: string; id: string }[]; [k: string]: unknown }

export function planActionProblems(actions: PlanAction[]): string[] {
  const out: string[] = [];
  if (actions.length < 1 || actions.length > 200) out.push("quantidade-de-acoes");
  actions.forEach((a, i) => {
    if ((a.title ?? "").length < 5) out.push(`acao-${i}-titulo`);
    if (!(PLAN_ACTION_KINDS as readonly string[]).includes(a.kind)) out.push(`acao-${i}-tipo`);
    if ("cost" in a || "budget" in a || "valor" in a) out.push(`acao-${i}-valor-sem-fonte-contabil`);
    for (const r of a.refs ?? []) if (!(PLAN_REF_SOURCES as readonly string[]).includes(r.source) || r.id.length < 3) out.push(`acao-${i}-referencia`);
  });
  return out;
}

export interface PlanVersion { id: string; year: number; version: number; personId: string }
export interface PlanApproval { planVersionId: string; personId: string }

/** Vigente = última versão do ano, se aprovada por pessoa ≠ autor. Sem fallback. */
export function currentPlan(year: number, versions: PlanVersion[], approvals: PlanApproval[]): PlanVersion | null {
  const last = versions.filter((v) => v.year === year).sort((a, b) => b.version - a.version)[0];
  if (!last) return null;
  const ok = approvals.some((a) => a.planVersionId === last.id && a.personId !== last.personId);
  return ok ? last : null;
}

export interface LicenseVersion { serviceKey: string; version: number; kind: string; seats: number | null; validFrom: string; validUntil: string | null }

export type LicenseState =
  | { state: "sem-licenca" }
  | { state: "fora-de-vigencia"; license: LicenseVersion }
  | { state: "vigente"; license: LicenseVersion; inUse: number; available: number | null; overUse: boolean };

/** Uso = acessos ativos (L16) ao serviço; ilimitada (rede/livre) não tem saldo. */
export function licenseState(serviceKey: string, on: string, versions: LicenseVersion[], activeAccesses: number): LicenseState {
  const last = versions.filter((v) => v.serviceKey === serviceKey).sort((a, b) => b.version - a.version)[0];
  if (!last) return { state: "sem-licenca" };
  if (on < last.validFrom || (last.validUntil !== null && on > last.validUntil)) return { state: "fora-de-vigencia", license: last };
  const available = last.seats === null ? null : last.seats - activeAccesses;
  return { state: "vigente", license: last, inUse: activeAccesses, available, overUse: available !== null && available < 0 };
}
