/**
 * Motor genérico de tramitação. A definição é DADO versionado e homologado; o motor só conhece
 * estados, transições, capability e escopo — nunca um fluxo específico, cargo ou cadeia hierárquica.
 * O banco (`apply_workflow_transition`) é a autoridade; este módulo espelha as mesmas regras para a tela.
 */

export type TransitionKind = "transicao" | "cancelamento" | "reabertura" | "conclusao";
export type Transition = Readonly<{
  id: string; from: string; to: string; capability: string; label?: string;
  kind?: TransitionKind; requiresComment?: boolean;
  /** Papel apenas descritivo, quando configurado; nunca autoriza. */
  responsibleLabel?: string;
}>;
export type WorkflowDefinition = Readonly<{
  states: readonly string[]; initial: string; startCapability: string;
  terminal?: readonly string[]; transitions: readonly Transition[];
}>;
export type WorkflowEvent = Readonly<{
  id: string; seq: number; transitionId: string | null; fromState: string | null; toState: string;
  comment: string | null; attachmentRef: string | null; dueOn: string | null; actor: string; recordedAt: string;
}>;

const CAP = /^[a-z0-9][a-z0-9-]{1,99}$/;
export function definitionIssue(d: WorkflowDefinition): string | null {
  if (d.states.length < 2) return "states";
  if (!d.states.includes(d.initial)) return "initial";
  if (!CAP.test(d.startCapability ?? "")) return "start-capability";
  if (d.transitions.length === 0) return "transitions";
  const ids = new Set<string>();
  for (const t of d.transitions) {
    if (!/^[a-z0-9-]{2,80}$/.test(t.id)) return "transition-id";
    if (ids.has(t.id)) return "transition-duplicate"; ids.add(t.id);
    if (!d.states.includes(t.from) || !d.states.includes(t.to)) return "transition-state";
    if (!CAP.test(t.capability)) return "transition-capability"; // sem curinga
  }
  return null;
}

/** Cabeça = maior seq; sequência deve ser contínua desde 1, senão a cadeia é inválida. */
export function currentEvent(events: readonly WorkflowEvent[]): WorkflowEvent | null {
  const s = [...events].sort((a, b) => a.seq - b.seq);
  if (s.length === 0 || s.some((e, i) => e.seq !== i + 1)) return null;
  return s[s.length - 1]!;
}

export const isTerminal = (d: WorkflowDefinition, state: string) =>
  (d.terminal ?? []).includes(state) || !d.transitions.some((t) => t.from === state);

export function availableTransitions(d: WorkflowDefinition, state: string, caps: ReadonlySet<string>) {
  return d.transitions.filter((t) => t.from === state && caps.has(t.capability));
}

export type TransitionRequest = Readonly<{ transitionId: string; expectedSeq: number; idempotencyKey: string; comment?: string | null; dueOn?: string | null }>;
export type TransitionOutcome =
  | { ok: true; event: Omit<WorkflowEvent, "id" | "actor" | "recordedAt">; replay: boolean }
  | { ok: false; reason: "invalid-transition" | "capability-missing" | "stale-seq" | "comment-required" | "broken-chain" };

/** Espelho puro da regra do banco: idempotência antes da concorrência; nada é inferido. */
export function applyTransition(d: WorkflowDefinition, events: readonly (WorkflowEvent & { idempotencyKey?: string })[],
  caps: ReadonlySet<string>, r: TransitionRequest): TransitionOutcome {
  const dup = events.find((e) => e.idempotencyKey === r.idempotencyKey);
  if (dup) return { ok: true, replay: true, event: dup };
  const head = currentEvent(events); if (!head) return { ok: false, reason: "broken-chain" };
  if (head.seq !== r.expectedSeq) return { ok: false, reason: "stale-seq" };
  const t = d.transitions.find((x) => x.id === r.transitionId);
  if (!t || t.from !== head.toState) return { ok: false, reason: "invalid-transition" };
  if (!caps.has(t.capability)) return { ok: false, reason: "capability-missing" };
  if (t.requiresComment && !(r.comment ?? "").trim()) return { ok: false, reason: "comment-required" };
  return { ok: true, replay: false, event: { seq: head.seq + 1, transitionId: t.id, fromState: head.toState, toState: t.to,
    comment: (r.comment ?? "").trim() || null, attachmentRef: null, dueOn: r.dueOn ?? null } };
}

/** Prazo nunca tem default: só existe se algum evento o declarou. Vencido só com data de referência explícita. */
export function dueOf(events: readonly WorkflowEvent[]): string | null {
  const s = [...events].sort((a, b) => b.seq - a.seq).find((e) => e.dueOn != null);
  return s?.dueOn ?? null;
}
export const isOverdue = (due: string | null, today: string) => due != null && due < today;

export type Pending = Readonly<{
  instanceId: string; workflowKey: string; title: string; schoolId: string | null; subjectRef: string;
  state: string; seq: number; dueOn: string | null; openedBy: string; mine: boolean; canAct: boolean; terminal: boolean;
}>;
export type PendingFilter = Readonly<{ view: "minhas" | "setor" | "historico"; workflowKey?: string | null; schoolId?: string | null; overdueOn?: string | null }>;

/** "Minhas" = posso agir agora; "setor" = abertas no escopo legível; "histórico" = encerradas. */
export function filterPendings(items: readonly Pending[], f: PendingFilter) {
  return items.filter((p) =>
    (f.view === "historico" ? p.terminal : !p.terminal) &&
    (f.view !== "minhas" || p.canAct) &&
    (!f.workflowKey || p.workflowKey === f.workflowKey) &&
    (!f.schoolId || p.schoolId === f.schoolId) &&
    (!f.overdueOn || isOverdue(p.dueOn, f.overdueOn)));
}

/**
 * Integrações previstas (sem definição semeada): cada módulo registra a SUA definição homologada
 * quando houver necessidade real. Nenhum aprovador ou cadeia é presumido aqui.
 */
export const INTEGRATION_POINTS = [
  { key: "retificacao", explain: "Pedido de retificação de fato oficial; a mudança continua no writer canônico." },
  { key: "solicitacao-escola-rede", explain: "Solicitação da escola à rede." },
  { key: "revisao-de-importacao", explain: "Revisão de lote com divergência antes da confirmação." },
  { key: "publicacao", explain: "Publicação de documento ou configuração." },
] as const;
