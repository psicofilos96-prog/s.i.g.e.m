/**
 * L07 Permanência — fluxo de acompanhamento configurável.
 * Reaproveita o motor único de Tramitação (`workflow_definitions`/`start_workflow`/
 * `apply_workflow_transition`, 0090): o fluxo é DEFINIÇÃO versionada e homologada,
 * nunca código; o motor dá seq esperado, idempotência, capability e trilha append-only.
 * Aqui só: esqueleto em RASCUNHO (não gravado nem homologado), regras extras de
 * conformidade do fluxo de permanência e projeção do histórico (avanço/retorno/reabertura).
 */
import { definitionIssue, currentEvent, type WorkflowDefinition, type WorkflowEvent, type Transition } from "@/features/workflows/workflow-model";

export const PERMANENCE_STAGES = ["identificacao", "verificacao", "acolhimento", "analise", "plano", "encaminhamento", "retorno", "permanencia", "encerramento"] as const;
export const WORKFLOW_KEY = "permanencia-acompanhamento";

/** Esqueleto: capacidades são marcadores a substituir pela decisão institucional; nunca registrado automaticamente. */
export function draftFollowUpDefinition(cap: (stage: string) => string): { status: "rascunho-nao-homologado"; definition: WorkflowDefinition } {
  const S = PERMANENCE_STAGES; const t: Transition[] = [];
  for (let i = 0; i < S.length - 1; i++) {
    t.push({ id: `avancar-${S[i]}`, from: S[i]!, to: S[i + 1]!, capability: cap(S[i + 1]!), kind: S[i + 1] === "encerramento" ? "conclusao" : "transicao", requiresComment: S[i + 1] === "encerramento" });
    if (i > 0) t.push({ id: `retornar-${S[i]}`, from: S[i]!, to: S[i - 1]!, capability: cap(S[i]!), requiresComment: true });
  }
  t.push({ id: "reabrir", from: "encerramento", to: "acolhimento", capability: cap("reabertura"), kind: "reabertura", requiresComment: true });
  return { status: "rascunho-nao-homologado", definition: { states: [...S], initial: "identificacao", startCapability: cap("identificacao"), terminal: [], transitions: t } };
}

/** Conformidade extra exigida do fluxo de permanência (além de `definitionIssue`). */
export function followUpIssues(d: WorkflowDefinition): string[] {
  const out: string[] = [];
  const base = definitionIssue(d); if (base) out.push(`motor:${base}`);
  const idx = (s: string) => d.states.indexOf(s);
  for (const x of d.transitions) {
    const back = idx(x.to) < idx(x.from) && x.kind !== "reabertura";
    if (back && !x.requiresComment) out.push(`retorno-sem-justificativa:${x.id}`);
    if (x.kind === "reabertura" && !x.requiresComment) out.push(`reabertura-sem-justificativa:${x.id}`);
    if (x.kind === "conclusao" && !x.requiresComment) out.push(`encerramento-sem-justificativa:${x.id}`);
  }
  if (!d.transitions.some((x) => x.kind === "conclusao")) out.push("sem-encerramento");
  if (d.transitions.some((x) => x.kind === "conclusao") && !d.transitions.some((x) => x.kind === "reabertura")) out.push("sem-reabertura");
  return out;
}

/** Instância vinculada ao caso canônico do AA; chave estável impede dois fluxos para o mesmo caso. */
export const caseSubjectRef = (caseId: string) => `aa-outreach-case:${caseId}`;
export const startKey = (definitionId: string, caseId: string) => `perm-flow|${definitionId}|${caseId}`;

export type Movement = "inicio" | "avanco" | "retorno" | "reabertura" | "encerramento";
export interface HistoryItem { seq: number; from: string | null; to: string; movement: Movement; comment: string | null; actor: string; at: string }

export function projectHistory(d: WorkflowDefinition, events: readonly WorkflowEvent[]): { ok: true; current: string; items: HistoryItem[]; reopenings: number } | { ok: false; reason: "cadeia-invalida" | "sem-eventos" } {
  if (events.length === 0) return { ok: false, reason: "sem-eventos" };
  const head = currentEvent(events); if (!head) return { ok: false, reason: "cadeia-invalida" };
  const byId = new Map(d.transitions.map((t) => [t.id, t]));
  const items = [...events].sort((a, b) => a.seq - b.seq).map((e): HistoryItem => {
    const t = e.transitionId ? byId.get(e.transitionId) : undefined;
    const movement: Movement = !e.transitionId ? "inicio" : t?.kind === "reabertura" ? "reabertura" : t?.kind === "conclusao" ? "encerramento"
      : e.fromState !== null && d.states.indexOf(e.toState) < d.states.indexOf(e.fromState) ? "retorno" : "avanco";
    return { seq: e.seq, from: e.fromState, to: e.toState, movement, comment: e.comment, actor: e.actor, at: e.recordedAt };
  });
  return { ok: true, current: head.toState, items, reopenings: items.filter((i) => i.movement === "reabertura").length };
}
