// SIGEM 2.0 A&A Lote 13 — Planos de intervenção pedagógica. Núcleo puro sobre a cadeia
// canônica já existente (aa_intervention_versions/events, writers aa_record_intervention*
// da 0369). Define o fluxo, quem age em cada etapa e o monitoramento de efetividade;
// a efetivação continua só nos writers canônicos.

export const STAGES = ["diagnostico", "proposta", "analise", "plano", "execucao", "evidencia", "monitoramento", "reavaliacao", "encerrado"] as const;
export type Stage = (typeof STAGES)[number];
export type Actor = { personId: string; role: "docente" | "orientacao" | "aa" | "direcao"; capabilities: ReadonlySet<string> };

// Quem é autor de cada etapa: A&A monitora, não executa nem aprova pela OP.
const OWNER: Record<Stage, Actor["role"][]> = {
  diagnostico: ["aa", "docente", "orientacao"], proposta: ["docente", "orientacao"], analise: ["orientacao"],
  plano: ["docente", "orientacao"], execucao: ["docente", "orientacao"], evidencia: ["docente", "orientacao"],
  monitoramento: ["aa", "orientacao"], reavaliacao: ["aa", "docente", "orientacao"], encerrado: ["orientacao"],
};
export const CAP = "registrar-intervencao-pedagogica";

export type Plan = { objective: string; skills: string[]; audience: { scope: "turma" | "grupo" | "estudante"; ref: string } | null; strategies: string[]; responsibles: string[]; resources: string[]; due: string | null };

export function validatePlan(p: Plan): string[] {
  const g: string[] = [];
  if (!p.objective.trim()) g.push("objetivo");
  if (!p.skills.length) g.push("habilidades");
  if (!p.audience) g.push("público");
  if (!p.strategies.length) g.push("estratégias");
  if (!p.responsibles.length) g.push("responsáveis");
  if (!p.due) g.push("prazo");
  return g;
}

export type Event = { seq: number; stage: Stage; by: string; at: string; note: string };

export function advance(p: { events: Event[]; expectedSeq: number; to: Stage; actor: Actor; at: string; note: string; plan: Plan | null; analysisApproved?: boolean }): { ok: true; event: Event } | { ok: false; reason: string } {
  const last = p.events[p.events.length - 1];
  if ((last?.seq ?? 0) !== p.expectedSeq) return { ok: false, reason: "base desatualizada: outro registro chegou antes" };
  if (!p.actor.capabilities.has(CAP)) return { ok: false, reason: `falta capability ${CAP}` };
  if (!OWNER[p.to].includes(p.actor.role)) return { ok: false, reason: `etapa ${p.to} não é atribuição de ${p.actor.role}` };
  const from = last?.stage ?? null;
  const iFrom = from ? STAGES.indexOf(from) : -1, iTo = STAGES.indexOf(p.to);
  const loop = from === "monitoramento" && (p.to === "execucao" || p.to === "evidencia") || from === "reavaliacao" && p.to === "plano";
  if (!(iTo === iFrom + 1 || loop)) return { ok: false, reason: `transição ${from ?? "início"} → ${p.to} fora do fluxo` };
  if (p.to === "plano") { const gaps = p.plan ? validatePlan(p.plan) : ["plano"]; if (gaps.length) return { ok: false, reason: `plano incompleto: ${gaps.join(", ")}` }; if (!p.analysisApproved) return { ok: false, reason: "plano exige análise competente aprovada" }; }
  if (!p.note.trim()) return { ok: false, reason: "registro exige descrição" };
  if (p.to === "encerrado" && from !== "reavaliacao") return { ok: false, reason: "encerramento só após reavaliação" };
  return { ok: true, event: { seq: p.expectedSeq + 1, stage: p.to, by: p.actor.personId, at: p.at, note: p.note } };
}

export function currentStage(events: Event[]): Stage | null { return events[events.length - 1]?.stage ?? null; }

/** Efetividade: só entre medidas comparáveis (mesma escala e habilidade); sem limiar, só descreve. */
export function effectiveness(before: { scaleKey: string; skill: string; rate: number | null } | null, after: { scaleKey: string; skill: string; rate: number | null } | null, minGain: { value: number; ruleRef: string } | null) {
  if (!before || !after) return { state: "sem-reavaliacao" as const };
  if (before.scaleKey !== after.scaleKey || before.skill !== after.skill) return { state: "nao-comparavel" as const, reason: "escala ou habilidade diferente" };
  if (before.rate === null || after.rate === null) return { state: "nao-apurado" as const };
  const delta = after.rate - before.rate;
  if (!minGain) return { state: "descrito" as const, delta, note: "sem critério homologado de efetividade: variação apenas descrita" };
  return { state: delta >= minGain.value ? "atingiu-criterio" as const : "nao-atingiu-criterio" as const, delta, ruleRef: minGain.ruleRef, note: "variação não prova causa da intervenção" };
}

export function overdue(plan: Plan, stage: Stage | null, today: string) { return !!plan.due && stage !== "encerrado" && today > plan.due; }
