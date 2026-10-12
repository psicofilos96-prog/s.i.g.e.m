/**
 * OP por escola — LOTE 11 (planos de intervenção integrados).
 * Reaproveita o MESMO plano institucional de A&A/Docente: cadeia `aa_intervention_versions/events` (0369)
 * e o fluxo `aa-intervention-flow.ts` (diagnóstico→proposta→análise→plano→execução→evidência→
 * monitoramento→reavaliação→encerrado). Aqui só a camada da Orientação: articula, valida análise por pessoa
 * competente ≠ proponente, controla versões com justificativa, e garante que docente execute só nas próprias
 * atribuições e que A&A só analise/monitore. Efetivação continua nos writers canônicos.
 */
import { advance, validatePlan, currentStage, type Actor, type Event, type Plan, type Stage } from "@/features/educational-intelligence/aa-intervention-flow";
import { decideOpAccess, type OpAccessRequest } from "./op-designations";

export interface PlanVersion { logicalId: string; version: number; plan: Plan; authorPersonId: string; at: string; justification: string | null; classId: string | null }
export interface AnalysisAct { seq: number; versionRef: number; byPersonId: string; decision: "aprovada" | "devolvida"; reason: string; capability: string }
export const ANALYSIS_CAP = "analisar-intervencao-pedagogica";

/** Cadeia de versões: seq contínuo, nova versão exige justificativa, autor humano; nunca sobrescreve. */
export function projectPlanVersions(vs: PlanVersion[]): { current: PlanVersion | null; history: PlanVersion[]; problems: string[] } {
  const h = [...vs].sort((a, b) => a.version - b.version);
  const p: string[] = [];
  if (!h.every((v, i) => v.version === i + 1)) p.push("Versões com sequência descontínua.");
  if (h.slice(1).some((v) => !v.justification?.trim())) p.push("Nova versão sem justificativa.");
  if (new Set(h.map((v) => v.logicalId)).size > 1) p.push("Versões de planos diferentes misturadas.");
  return { current: h.at(-1) ?? null, history: h, problems: p };
}

/** Análise competente da versão vigente: pessoa ≠ autor da versão, com capacidade; devolver exige motivo. */
export function analysisState(current: PlanVersion | null, acts: AnalysisAct[]): { approved: boolean; reason: string } {
  if (!current) return { approved: false, reason: "Sem proposta registrada." };
  const last = [...acts].filter((a) => a.versionRef === current.version).sort((a, b) => b.seq - a.seq)[0];
  if (!last) return { approved: false, reason: "Proposta aguardando análise competente." };
  if (last.byPersonId === current.authorPersonId) return { approved: false, reason: "Autor não analisa a própria proposta." };
  if (last.capability !== ANALYSIS_CAP) return { approved: false, reason: "Análise sem capacidade homologada." };
  if (last.decision === "devolvida") return { approved: false, reason: last.reason || "Devolvida sem motivo (inválida)." };
  return { approved: true, reason: "" };
}

export interface OpStepRequest {
  events: Event[]; expectedSeq: number; to: Stage; actor: Actor; at: string; note: string;
  versions: PlanVersion[]; analyses: AnalysisAct[]; idempotencyKey: string; seenKeys: string[];
  /** atribuições docentes vigentes do ator (turmas) — docente só executa nas próprias */
  actorClassIds: string[]; access: Omit<OpAccessRequest, "action" | "granularity" | "personId">;
}

export function planInterventionStep(r: OpStepRequest): { ok: true; duplicate: boolean; event: Event | null } | { ok: false; reason: string } {
  if (r.seenKeys.includes(r.idempotencyKey)) return { ok: true, duplicate: true, event: null };
  if (!r.access.personNatural) return { ok: false, reason: "Executor técnico não registra etapa de intervenção." };
  const vs = projectPlanVersions(r.versions);
  if (vs.problems.length) return { ok: false, reason: vs.problems.join(" ") };
  const cur = vs.current;
  if (r.actor.role === "orientacao") {
    const acc = decideOpAccess({ ...r.access, personId: r.actor.personId, action: "registrar", granularity: "individual" });
    if (!acc.ok) return { ok: false, reason: acc.reason };
  }
  if (r.actor.role === "docente" && ["execucao", "evidencia"].includes(r.to) && cur?.classId && !r.actorClassIds.includes(cur.classId))
    return { ok: false, reason: "Docente executa só nas próprias atribuições." };
  if (r.actor.role === "aa" && !["diagnostico", "monitoramento", "reavaliacao"].includes(r.to))
    return { ok: false, reason: "A&A analisa e monitora; não executa nem decide pela escola." };
  const an = analysisState(cur, r.analyses);
  const res = advance({ events: r.events, expectedSeq: r.expectedSeq, to: r.to, actor: r.actor, at: r.at, note: r.note, plan: cur?.plan ?? null, analysisApproved: an.approved });
  if (!res.ok) return { ok: false, reason: r.to === "plano" && !an.approved ? `${res.reason} (${an.reason})` : res.reason };
  return { ok: true, duplicate: false, event: res.event };
}

/** Nova versão do plano: só com base esperada e justificativa; quem não é autor não edita, propõe nova versão própria. */
export function proposeVersion(vs: PlanVersion[], next: Omit<PlanVersion, "version">, expectedVersion: number): { ok: true; version: PlanVersion } | { ok: false; reason: string } {
  const { current } = projectPlanVersions(vs);
  if ((current?.version ?? 0) !== expectedVersion) return { ok: false, reason: "Outra versão chegou antes; recarregue." };
  if (current && !next.justification?.trim()) return { ok: false, reason: "Nova versão exige justificativa." };
  const gaps = validatePlan(next.plan);
  if (current && gaps.length) return { ok: false, reason: `Plano incompleto: ${gaps.join(", ")}.` };
  return { ok: true, version: { ...next, version: expectedVersion + 1 } };
}

/** Histórico unificado: versões, análises e etapas, cada um com autor; nada reescrito. */
export function interventionHistory(vs: PlanVersion[], analyses: AnalysisAct[], events: Event[]) {
  return [
    ...vs.map((v) => ({ at: v.at, by: v.authorPersonId, what: `Versão ${v.version}${v.justification ? ` — ${v.justification}` : ""}` })),
    ...analyses.map((a) => ({ at: `v${a.versionRef}`, by: a.byPersonId, what: `Análise ${a.decision}: ${a.reason}` })),
    ...events.map((e) => ({ at: e.at, by: e.by, what: `${e.stage}: ${e.note}` })),
  ];
}

export { currentStage };
