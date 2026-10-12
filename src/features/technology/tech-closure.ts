// SIGEM Tecnologia L24 — matriz de fechamento. Status técnico apenas: "implementado-tecnico" | "parcial" | "bloqueado".
// Nunca "homologado": homologação institucional, capabilities atribuídas e E2E autenticado não foram realizados.
// As 49 seções/18 critérios dependem do documento da especificação, ausente no projeto (SPEC_STATUS): não são inventados.
import { SPEC_STATUS } from "./technology-audit";

export const TECH_CLOSURE_BASE_SHA = "84d6a0d5";

export type ClosureStatus = "implementado-tecnico" | "parcial" | "bloqueado";

export interface LotEvidence {
  lot: number;
  area: string;
  files: readonly string[];
  migrations: readonly string[];
  status: ClosureStatus;
  pending: string;
}

const T = "src/features/technology/";
const L = (lot: number, area: string, mod: string, migrations: string[], status: ClosureStatus, pending: string, extra: string[] = []): LotEvidence =>
  ({ lot, area, files: [`${T}${mod}.ts`, `${T}${mod}.test.ts`, ...extra], migrations, status, pending });

export const TECH_LOTS: readonly LotEvidence[] = [
  L(1, "Auditoria e fontes canônicas", "technology-audit", [], "parcial", "documento da especificação"),
  L(2, "Núcleo ITSM", "itsm-core", ["0477"], "parcial", "capabilities"),
  L(3, "Painel operacional", "tech-dashboard", [], "parcial", "fontes de equipamentos/conectividade/projetos", [`${T}tech-dashboard-page.tsx`, "src/routes/painel-de-tecnologia.tsx"]),
  L(4, "Central de chamados", "ticket-center", ["0478"], "parcial", "categorias aprovadas"),
  L(5, "Fluxo do chamado", "ticket-flow", ["0479"], "parcial", "capabilities"),
  L(6, "Prazos e SLA", "sla", ["0480"], "bloqueado", "política de SLA aprovada"),
  L(7, "Fila de suporte", "support-queue", ["0481"], "parcial", "grupos reais"),
  L(8, "Atendimentos", "service-sessions", ["0482"], "parcial", "equipes"),
  L(9, "Recorrência", "recurrence", ["0483"], "bloqueado", "regra aprovada"),
  L(10, "Controle de mudanças", "change-control", ["0484", "0485"], "parcial", "capabilities"),
  L(11, "Inventário de equipamentos", "equipment-inventory", ["0486"], "bloqueado", "categoria tecnológica aprovada"),
  L(12, "Ciclo de vida", "equipment-lifecycle", [], "bloqueado", "regra de vida útil"),
  L(13, "Conectividade", "connectivity", ["0487"], "parcial", "contratos e medições"),
  L(14, "Mapa de conectividade", "connectivity-map", [], "bloqueado", "coordenadas e limiar"),
  L(15, "Catálogo digital", "digital-catalog", ["0488"], "parcial", "serviços cadastrados"),
  L(16, "Pedidos de acesso", "access-requests", ["0489"], "parcial", "periodicidade de revisão"),
  L(17, "Incidentes de segurança", "security-incidents", ["0490"], "parcial", "regra de notificação"),
  L(18, "Backups e restauração", "backups", ["0491"], "parcial", "planos reais"),
  L(19, "Conhecimento técnico", "tech-knowledge", ["0492"], "bloqueado", "mínimo de respostas"),
  L(20, "Recursos pedagógicos", "pedagogical-resources", ["0493"], "bloqueado", "rubrica aprovada"),
  L(21, "Inovação, laboratórios, empréstimos", "innovation-labs-loans", ["0494"], "parcial", "categorias e capabilities"),
  L(22, "Integrações, licenças, plano anual", "integrations-licenses-plan", ["0495"], "parcial", "contratos e capabilities"),
  L(23, "Relatórios e fichas", "tech-reports", [], "parcial", "decisões dos relatórios bloqueados", [`${T}tech-reports-page.tsx`, "src/routes/relatorios-de-tecnologia.tsx"]),
  L(24, "Fechamento", "tech-closure", ["0496"], "parcial", "E2E autenticado e homologação", ["supabase/tests/tech24_technology_rls.sql"]),
];

export const NOT_PERFORMED = [
  "E2E autenticado (nenhuma conta tem capabilities de tecnologia)",
  "concorrência real entre sessões",
  "homologação institucional de políticas, regras e categorias",
  "atribuição de capabilities",
] as const;

export interface SpecMatrix { sections: number; criteria: number; mapped: false; reason: string }
export const SPEC_MATRIX: SpecMatrix = { sections: SPEC_STATUS.sectionsExpected, criteria: SPEC_STATUS.criteriaExpected, mapped: false, reason: SPEC_STATUS.note };

export function closureProblems(exists: (p: string) => boolean, migrationExists: (prefix: string) => boolean): string[] {
  const out: string[] = [];
  for (const l of TECH_LOTS) {
    for (const f of l.files) if (!exists(f)) out.push(`L${l.lot}:arquivo:${f}`);
    for (const m of l.migrations) if (!migrationExists(m)) out.push(`L${l.lot}:migration:${m}`);
    if ((l.status as string) === "homologado") out.push(`L${l.lot}:homologado`);
  }
  return out;
}
