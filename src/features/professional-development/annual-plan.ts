/**
 * SIGEM Desenvolvimento L05 — Plano Anual de Formação (projeção pura; banco = 0433).
 * Estado e monitoramento derivam do ledger; meta sem observação fica "não monitorada", nunca zero.
 */
export type PlanEventKind = "proposta" | "analise" | "devolucao" | "aprovacao" | "publicacao" | "monitoramento";
export type PlanEvent = Readonly<{ seq: number; kind: PlanEventKind; actorPerson: string; goalItemId: string | null; observedValue: number | null; createdAt: string }>;
export type PlanItem = Readonly<{ id: string; kind: "eixo" | "publico" | "meta" | "marco"; text: string; targetValue: number | null; targetUnit: string | null; dueOn: string | null }>;
export type PlanState = "rascunho" | "proposta" | "em-analise" | "devolvida" | "aprovada" | "publicada" | "cadeia-invalida";

const NEXT: Record<string, readonly PlanEventKind[]> = {
  "": ["proposta"], proposta: ["analise"], analise: ["devolucao", "aprovacao"], devolucao: [], aprovacao: ["publicacao"],
  publicacao: ["monitoramento"], monitoramento: ["monitoramento"],
};

export function planState(events: readonly PlanEvent[]): PlanState {
  const s = [...events].sort((a, b) => a.seq - b.seq);
  let prev = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i]!.seq !== i + 1 || !NEXT[prev]!.includes(s[i]!.kind)) return "cadeia-invalida";
    prev = s[i]!.kind;
  }
  return ({ "": "rascunho", proposta: "proposta", analise: "em-analise", devolucao: "devolvida", aprovacao: "aprovada", publicacao: "publicada", monitoramento: "publicada" } as const)[prev as ""]!;
}

export const allowedNext = (events: readonly PlanEvent[]): readonly PlanEventKind[] => {
  if (planState(events) === "cadeia-invalida") return [];
  const last = [...events].sort((a, b) => b.seq - a.seq)[0];
  return NEXT[last?.kind ?? ""]!;
};

/** Segregação espelhada do banco: autor não analisa/aprova; analista não aprova. */
export function segregationOk(kind: PlanEventKind, actor: string, author: string, events: readonly PlanEvent[]): boolean {
  if (kind === "proposta") return actor === author;
  if (kind === "analise" || kind === "devolucao") return actor !== author;
  if (kind === "aprovacao") return actor !== author && !events.some((e) => e.kind === "analise" && e.actorPerson === actor);
  return true;
}

/** Conteúdo mínimo: eixo e público; meta com valor exige unidade; marco exige data. */
export function contentProblems(items: readonly Omit<PlanItem, "id">[], diagnosis: string): string[] {
  const p: string[] = [];
  if (diagnosis.trim().length < 20) p.push("Resumo do diagnóstico é obrigatório.");
  if (!items.some((i) => i.kind === "eixo")) p.push("Informe ao menos um eixo.");
  if (!items.some((i) => i.kind === "publico")) p.push("Informe ao menos um público.");
  for (const i of items) {
    if ((i.targetValue == null) !== (i.targetUnit == null)) p.push(`Meta "${i.text}": valor e unidade andam juntos.`);
    if (i.kind === "marco" && !i.dueOn) p.push(`Marco "${i.text}" precisa de data.`);
  }
  return p;
}

export interface GoalMonitor { goalId: string; text: string; target: number | null; unit: string | null; latest: number | null; at: string | null; status: "nao-monitorada" | "sem-alvo" | "atingida" | "em-andamento" }
export function monitorGoals(items: readonly PlanItem[], events: readonly PlanEvent[]): GoalMonitor[] {
  return items.filter((i) => i.kind === "meta").map((g) => {
    const obs = events.filter((e) => e.kind === "monitoramento" && e.goalItemId === g.id && e.observedValue != null).sort((a, b) => b.seq - a.seq)[0];
    const latest = obs?.observedValue ?? null;
    const status = latest == null ? "nao-monitorada" : g.targetValue == null ? "sem-alvo" : latest >= g.targetValue ? "atingida" : "em-andamento";
    return { goalId: g.id, text: g.text, target: g.targetValue, unit: g.targetUnit, latest, at: obs?.createdAt ?? null, status };
  });
}
