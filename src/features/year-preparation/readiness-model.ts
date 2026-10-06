// AY — central de preparação de 2027. Puro: só deriva estados de leituras já feitas.
// Nunca grava, nunca abre ano, nunca concede capacidade. Pesos não homologados ⇒ sem percentual.
export type ReadinessState = "READY" | "PENDING" | "BLOCKED" | "NOT_APPLICABLE" | "UNKNOWN";

/** Resultado de uma leitura com a sessão do próprio usuário (RLS). Negado/erro nunca vira zero. */
export type Probe = { kind: "count"; n: number } | { kind: "denied" } | { kind: "error" } | { kind: "not-read" };

export type ItemDef = Readonly<{
  id: string;
  domain: string;
  label: string;
  to: string;
  probe: string | null; // chave da leitura; null = dependência externa estática
  /** Dependências técnicas necessárias (não obrigatoriedade institucional). */
  dependsOn: readonly string[];
  readyReason: string;
  pendingReason: string;
  externalBlock?: string; // código de bloqueio externo (fonte, regra, integração)
  /** annual = só registros do ano-alvo contam; timeless = pré-requisito institucional sem ano. */
  scope: "annual" | "timeless";
}>;

export const ITEMS: readonly ItemDef[] = [
  { id: "ano", domain: "Ano letivo", label: "Ano letivo 2027 cadastrado", to: "/administracao", probe: "year2027", dependsOn: [], readyReason: "Existe versão do ano 2027.", pendingReason: "Cadastrar o ano 2027 em Administração.", scope: "annual" },
  { id: "abertura", domain: "Ano letivo", label: "2027 aberto por ato humano", to: "/administracao", probe: "year2027State", dependsOn: ["ano", "calendario", "capacidades"], readyReason: "2027 tem estado operacional registrado.", pendingReason: "Abertura é ato explícito e separado; esta tela não abre o ano.", scope: "annual" },
  { id: "calendario", domain: "Calendário", label: "Calendário 2027 homologado", to: "/calendario-escolar", probe: "calendarHomologations" /* sem leitura direta: lido só no módulo */, dependsOn: ["ano"], readyReason: "Há homologação de calendário registrada.", pendingReason: "A Supervisão homologa o calendário 2027.", scope: "annual" },
  { id: "escolas", domain: "Escolas", label: "Cadastro das unidades (sem ano)", to: "/unidades", probe: "schools", dependsOn: [], readyReason: "Unidades cadastradas; cadastro não pertence a um ano.", pendingReason: "Nenhuma unidade legível.", scope: "timeless" },
  { id: "matrizes", domain: "Currículo", label: "Matrizes aplicáveis a 2027 homologadas", to: "/matrizes-curriculares", probe: "matrixHomologations", dependsOn: ["ano"], readyReason: "Há homologação registrada para matriz com aplicabilidade em 2027.", pendingReason: "Declarar aplicabilidade em 2027 e homologar as matrizes.", scope: "annual" },
  { id: "turmas", domain: "Turmas", label: "Turmas de 2027", to: "/turmas", probe: "classes", dependsOn: ["escolas", "ano"], readyReason: "Há turmas do ano 2027.", pendingReason: "Cadastrar as turmas de 2027 (turmas de 2026 não contam).", scope: "annual" },
  { id: "oferta", domain: "Turmas", label: "Oferta das turmas de 2027", to: "/turmas", probe: "offerings", dependsOn: ["turmas"], readyReason: "Há oferta declarada em turma de 2027.", pendingReason: "Declarar a oferta das turmas de 2027.", scope: "annual" },
  { id: "grade", domain: "Turmas", label: "Grade horária das turmas de 2027", to: "/horarios/turmas", probe: "schedules", dependsOn: ["turmas", "matrizes"], readyReason: "Há grade em turma de 2027.", pendingReason: "Registrar as grades das turmas de 2027.", scope: "annual" },
  { id: "alunos", domain: "Estudantes", label: "Cadastro de estudantes (sem ano)", to: "/alunos", probe: "students", dependsOn: [], readyReason: "Identidades de estudantes na base; não indica matrícula em 2027.", pendingReason: "Nenhum estudante legível.", scope: "timeless" },
  { id: "matriculas", domain: "Estudantes", label: "Matrículas e enturmação 2027", to: "/matriculas", probe: null, dependsOn: ["abertura", "turmas", "alunos"], readyReason: "", pendingReason: "Só após a abertura de 2027 pelos writers da Secretaria.", scope: "annual" },
  { id: "atuacoes", domain: "Profissionais", label: "Atuações vigentes em 2027", to: "/administracao", probe: "engagements", dependsOn: [], readyReason: "Há atuação com vigência que alcança 2027.", pendingReason: "Registrar atuações reais (REAL_ROLE_ASSIGNMENT_PENDING).", scope: "annual" },
  { id: "capacidades", domain: "Capacidades", label: "Política de capacidades vigente em 2027", to: "/central-de-acessos", probe: "homologatedPolicies", dependsOn: ["atuacoes"], readyReason: "Há política homologada com vigência que alcança 2027.", pendingReason: "Homologar a política de capacidades.", scope: "annual" },
  { id: "familia", domain: "Família", label: "Autorizações de responsáveis", to: "/autorizacoes-familia", probe: "guardianAuthorizations", dependsOn: ["alunos", "capacidades"], readyReason: "Há autorizações registradas.", pendingReason: "Conceder autorizações explícitas (opcional por escola).", scope: "timeless" },
  { id: "censo", domain: "Censo", label: "Layout oficial do Educacenso", to: "/censo-escolar", probe: null, dependsOn: [], readyReason: "", pendingReason: "", externalBlock: "EDUCACENSO_LAYOUT — BLOCKED_BY_OFFICIAL_SOURCE", scope: "timeless" },
  { id: "dp", domain: "Profissionais", label: "Planilha oficial do DP externo (fonte de dados funcionais)", to: "/importacoes", probe: null, dependsOn: [], readyReason: "", pendingReason: "", externalBlock: "DP_FILE_CONTRACT_PENDING — BLOCKED_BY_SOURCE_FILE", scope: "timeless" },
  { id: "bncc", domain: "Currículo", label: "BNCC/SAEB", to: "/referencias-curriculares", probe: null, dependsOn: [], readyReason: "", pendingReason: "", externalBlock: "Fonte curricular externa não carregada", scope: "timeless" },
  { id: "regras", domain: "Regras", label: "Regras de avaliação, publicação e alertas", to: "/regras-avaliativas", probe: null, dependsOn: [], readyReason: "", pendingReason: "", externalBlock: "Regra institucional não homologada", scope: "timeless" },
  { id: "modelos", domain: "Documentos", label: "Modelos oficiais de documentos", to: "/secretaria", probe: null, dependsOn: [], readyReason: "", pendingReason: "", externalBlock: "OFFICIAL_TEMPLATES_PENDING", scope: "timeless" },
];

export type ItemStatus = Readonly<{ id: string; state: ReadinessState; reason: string }>;

function own(def: ItemDef, p: Probe | undefined): ItemStatus {
  if (def.externalBlock) return { id: def.id, state: "BLOCKED", reason: `Dependência externa: ${def.externalBlock}.` };
  if (def.probe === null) return { id: def.id, state: "PENDING", reason: def.pendingReason };
  if (!p || p.kind === "not-read") return { id: def.id, state: "UNKNOWN", reason: "Não lido." };
  if (p.kind === "denied") return { id: def.id, state: "UNKNOWN", reason: "Sua conta não pode ler esta fonte; isso não significa ausência." };
  if (p.kind === "error") return { id: def.id, state: "UNKNOWN", reason: "Falha ao ler a fonte." };
  return p.n > 0 ? { id: def.id, state: "READY", reason: def.readyReason } : { id: def.id, state: "PENDING", reason: `${def.pendingReason} (nenhum registro visível para a sua conta).` };
}

/** Item só fica READY se todas as dependências técnicas estiverem READY; senão vira BLOCKED pela dependência. */
export function evaluate(probes: Readonly<Record<string, Probe>>, items: readonly ItemDef[] = ITEMS): ItemStatus[] {
  const byId = new Map(items.map((d) => [d.id, d]));
  const memo = new Map<string, ItemStatus>();
  const visit = (id: string, stack: string[]): ItemStatus => {
    const hit = memo.get(id);
    if (hit) return hit;
    if (stack.includes(id)) throw new Error(`readiness:cycle:${[...stack, id].join(">")}`);
    const def = byId.get(id);
    if (!def) throw new Error(`readiness:unknown-dependency:${id}`);
    const base = own(def, def.probe ? probes[def.probe] : undefined);
    const notReady = def.dependsOn.map((d) => visit(d, [...stack, id])).filter((s) => s.state !== "READY" && s.state !== "NOT_APPLICABLE");
    const res: ItemStatus = base.state === "READY" && notReady.length > 0
      ? { id, state: "BLOCKED", reason: `Depende de: ${notReady.map((s) => byId.get(s.id)!.label).join(", ")}.` }
      : base;
    memo.set(id, res);
    return res;
  };
  return items.map((d) => visit(d.id, []));
}

/** Contagem por domínio e estado — nunca percentual, porque pesos não são homologados. */
export function summarize(statuses: readonly ItemStatus[], items: readonly ItemDef[] = ITEMS): Record<string, Partial<Record<ReadinessState, number>>> {
  const dom = new Map(items.map((d) => [d.id, d.domain]));
  const out: Record<string, Partial<Record<ReadinessState, number>>> = {};
  for (const s of statuses) { const d = dom.get(s.id)!; const row = (out[d] ??= {}); row[s.state] = (row[s.state] ?? 0) + 1; }
  return out;
}
