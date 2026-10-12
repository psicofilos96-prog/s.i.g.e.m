// L16 Tecnologia — pedidos de acesso a serviços do catálogo L15 (0489). Estado é projeção do ledger;
// revisão só vence se houver periodicidade DECLARADA (sem regra ⇒ "sem prazo de revisão"). Nunca concede capability do SIGEM.
export type AccessKind = "analise" | "aprovacao" | "indeferimento" | "revisao-manter" | "revogacao";
export type AccessState = "solicitado" | "em-analise" | "ativo" | "indeferido" | "revogado";
export interface AccessEvent { seq: number; kind: AccessKind; personId: string; at: string }

const NEXT: Record<string, AccessKind[]> = { "": ["analise"], analise: ["aprovacao", "indeferimento"], aprovacao: ["revisao-manter", "revogacao"], "revisao-manter": ["revisao-manter", "revogacao"] };
const STATE: Record<AccessKind, AccessState> = { analise: "em-analise", aprovacao: "ativo", "revisao-manter": "ativo", indeferimento: "indeferido", revogacao: "revogado" };

const last = (ev: readonly AccessEvent[]) => [...ev].sort((a, b) => b.seq - a.seq)[0];
export const accessState = (ev: readonly AccessEvent[]): AccessState => { const l = last(ev); return l ? STATE[l.kind] : "solicitado"; };

export function canRecord(req: { requesterPerson: string; beneficiaryPerson: string }, ev: readonly AccessEvent[], kind: AccessKind, actor: string) {
  if (!(NEXT[last(ev)?.kind ?? ""] ?? []).includes(kind)) return "transicao-invalida" as const;
  if (kind !== "analise" && (actor === req.requesterPerson || actor === req.beneficiaryPerson)) return "conflito-de-interesse" as const;
  return null;
}

export function reviewStatus(ev: readonly AccessEvent[], reviewEveryDays: number | null, today: string) {
  if (accessState(ev) !== "ativo") return null;
  if (reviewEveryDays == null) return "sem prazo de revisão (periodicidade não declarada)";
  const base = last(ev)!.at.slice(0, 10);
  const due = new Date(Date.parse(base) + reviewEveryDays * 86_400_000).toISOString().slice(0, 10);
  return today > due ? `revisão vencida desde ${due}` : `revisão até ${due}`;
}
