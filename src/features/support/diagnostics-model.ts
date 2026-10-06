// AV — diagnóstico operacional puro. Nada aqui concede acesso, executa SQL ou contorna writer.
export const CANONICAL_PROJECT_REF = "crfqhyqkujhhlbiyhdbc";
export const EXTERNAL_MONITORING = "EXTERNAL_MONITORING_PROVIDER_PENDING" as const;

export type CheckState = "ok" | "falha" | "nao-verificavel";
export type Check = Readonly<{ id: string; label: string; state: CheckState; detail: string }>;

export function environmentCheck(projectRef: string | undefined): Check {
  if (!projectRef) return { id: "ambiente", label: "Ambiente canônico", state: "falha", detail: "Projeto do banco não configurado." };
  return projectRef === CANONICAL_PROJECT_REF
    ? { id: "ambiente", label: "Ambiente canônico", state: "ok", detail: "O app aponta para o banco canônico do SIGEM." }
    : { id: "ambiente", label: "Ambiente canônico", state: "falha", detail: "O app NÃO aponta para o banco canônico." };
}

/** Lista de migrations esperadas vem do repositório; a contagem aplicada não é legível pela sessão. */
export function migrationsCheck(expectedFiles: readonly string[]): Check {
  const n = expectedFiles.filter((f) => /\/\d{4}_[^/]+\.sql$/.test(f)).length;
  const last = [...expectedFiles].sort().at(-1)?.split("/").pop() ?? "—";
  return { id: "migrations", label: "Migrations esperadas", state: n > 0 ? "nao-verificavel" : "falha", detail: `${n} no repositório; última ${last}. A aplicação no banco é conferida pelo CI e pela plataforma, não por esta tela.` };
}

export function probeCheck(id: string, label: string, r: { ok: boolean; ms: number } | null): Check {
  if (!r) return { id, label, state: "nao-verificavel", detail: "Não executado." };
  return r.ok ? { id, label, state: "ok", detail: `Respondeu em ${Math.round(r.ms)} ms.` } : { id, label, state: "falha", detail: "Não respondeu; tente de novo." };
}

export const BLOCKED_DEPENDENCIES: readonly { id: string; label: string }[] = [
  { id: "EDUCACENSO_LAYOUT", label: "Layout oficial do Educacenso" },
  { id: "DP_FILE_CONTRACT_PENDING", label: "Planilha oficial do DP externo (contrato só com arquivo real)" },
  { id: "MENU_CONTENT", label: "Cardápios institucionais" },
  { id: "INVENTORY_CATALOG_PENDING", label: "Catálogo de estoque" },
  { id: "ATTACHMENTS_PENDING", label: "Anexos de comunicados" },
  { id: "EXTERNAL_DELIVERY_PROVIDER_PENDING", label: "Provedor de envio externo" },
  { id: "DATA_RETENTION_POLICY_PENDING", label: "Política de retenção de dados" },
  { id: EXTERNAL_MONITORING, label: "Provedor externo de monitoramento/alertas" },
];

/** Integrações sem decisão institucional: não são arquivos aguardados. */
export const UNDEFINED_INTEGRATIONS: readonly { id: string; label: string }[] = [
  { id: "EXTERNAL_INTEGRATION_UNDEFINED", label: "GPE — integração histórica sem contrato" },
];

export type TechFailure = Readonly<{ at: string; source: string; category: string; correlationId: string }>;
const MAX = 20;
const buffer: TechFailure[] = [];
/** Falhas técnicas recentes da sessão: só fonte, categoria, horário e código — nunca mensagem ou conteúdo. */
export function recordTechFailure(f: TechFailure) { buffer.unshift({ at: f.at, source: f.source, category: f.category, correlationId: f.correlationId }); buffer.length = Math.min(buffer.length, MAX); }
export function recentTechFailures(): readonly TechFailure[] { return [...buffer]; }

/** Executor técnico nunca é apresentado como pessoa. */
export function actorKind(a: { personId?: string | null; technicalOperationId?: string | null }): "pessoa" | "executor-tecnico" | "desconhecido" {
  if (a.personId) return "pessoa";
  if (a.technicalOperationId) return "executor-tecnico";
  return "desconhecido";
}
