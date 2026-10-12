/**
 * OP por escola — LOTE 12 (recuperação da aprendizagem).
 * Recuperação NÃO é cadeia nova: é um plano de intervenção (`aa_intervention_*`, Lote 11) com público
 * estudante/grupo, habilidade e período, cujas atividades são as atividades docentes de recuperação
 * (Docente L09: `activities-materials`, recuperação aponta a original) e cuja reavaliação usa
 * `reassessment` do Docente (L11). Sinaliza continuar/revisar com evidência; nunca promove, retém
 * nem fecha período — isso é do Conselho/fechamento com regra homologada.
 */
import { reassessment, validateIntervention, type ResultFact, type InterventionProposal } from "@/features/teacher-diary/learning-record";

export interface RecoveryActivity { activityId: string; originalActivityId: string | null; classId: string; skillIds: string[]; date: string; authorPersonId: string; realized: boolean }
export interface RecoveryCase {
  interventionLogicalId: string; schoolId: string; classId: string; periodId: string; periodTo: string;
  audience: { scope: "estudante" | "grupo"; studentIds: string[] }; skillIds: string[];
  responsiblePersonIds: string[]; startedOn: string; reassessOn: string | null; activityIds: string[];
}

const DECISION = /\b(promov|promo[çc]|ret[ée]n|retid|reprov|aprovad[oa]|fechament|nota final|m[ée]dia final|conselho decide)/i;
export function guardRecoveryText(t: string): string | null {
  return DECISION.test(t) ? "Recuperação sinaliza continuidade ou revisão; promoção, retenção e fechamento são do Conselho e do fechamento com regra homologada." : null;
}

/** Validação da criação: reaproveita a validação do Docente + exige período, habilidade e atividade vinculada. */
export function validateRecovery(c: RecoveryCase, ctx: { myStudents: string[]; hasCapability: boolean; activities: RecoveryActivity[]; objective: string }): string[] {
  const proposal: InterventionProposal = {
    studentIds: c.audience.studentIds, objectives: [ctx.objective], skillIds: c.skillIds, responsibleIds: c.responsiblePersonIds,
    actions: c.activityIds.map((id) => ({ description: `Atividade ${id}`, due: c.reassessOn })), reassessOn: c.reassessOn, evidenceRefs: c.activityIds,
  };
  const e = validateIntervention(proposal, ctx);
  if (c.audience.scope === "estudante" && c.audience.studentIds.length !== 1) e.push("Recuperação individual tem exatamente um estudante.");
  if (c.audience.scope === "grupo" && c.audience.studentIds.length < 2) e.push("Grupo exige ao menos dois estudantes.");
  if (!c.skillIds.length) e.push("Indique a habilidade a recuperar.");
  if (c.reassessOn && c.reassessOn < c.startedOn) e.push("Reavaliação anterior ao início.");
  const acts = ctx.activities.filter((a) => c.activityIds.includes(a.activityId));
  if (acts.length !== c.activityIds.length) e.push("Atividade de recuperação não encontrada nos registros docentes.");
  if (acts.some((a) => a.classId !== c.classId)) e.push("Atividade de outra turma.");
  if (acts.some((a) => !a.skillIds.some((s) => c.skillIds.includes(s)))) e.push("Atividade não trabalha a habilidade do plano.");
  const g = guardRecoveryText(ctx.objective); if (g) e.push(g);
  return e;
}

export type Signal = "continuar" | "revisar-estrategia" | "concluir-ciclo" | "sem-evidencia";
export interface StudentSignal { studentId: string; skillId: string; signal: Signal; evidence: { before: number | null; after: number | null; change: string; activitiesRealized: number }; note: string }

/** Sinal por estudante × habilidade: só com evidência (atividade realizada + reavaliação comparável). */
export function recoverySignals(c: RecoveryCase, results: ResultFact[], activities: RecoveryActivity[], today: string): StudentSignal[] {
  const realized = activities.filter((a) => c.activityIds.includes(a.activityId) && a.realized).length;
  return c.audience.studentIds.flatMap((sid) => c.skillIds.map((sk): StudentSignal => {
    const r = reassessment(results, sid, sk, c.startedOn);
    const ev = { ...r, activitiesRealized: realized };
    if (realized === 0) return { studentId: sid, skillId: sk, signal: "sem-evidencia", evidence: ev, note: "Nenhuma atividade de recuperação realizada registrada." };
    if (r.change === "indeterminado") return { studentId: sid, skillId: sk, signal: c.reassessOn && today > c.reassessOn ? "sem-evidencia" : "continuar", evidence: ev, note: c.reassessOn && today > c.reassessOn ? "Reavaliação vencida sem resultado comparável registrado." : "Aguardando reavaliação." };
    if (r.change === "melhorou") return { studentId: sid, skillId: sk, signal: "concluir-ciclo", evidence: ev, note: "Avanço observado na habilidade; decisão de encerrar o ciclo é do responsável. Variação não prova causa." };
    return { studentId: sid, skillId: sk, signal: "revisar-estrategia", evidence: ev, note: "Sem avanço observado após atividades realizadas; revisar estratégia." };
  }));
}

/** Ação proposta a partir do sinal: sempre sugestão a humano competente, nunca ato automático. */
export function proposedAction(s: StudentSignal): { kind: "nova-versao-do-plano" | "registrar-reavaliacao" | "encerrar-ciclo" | "nenhuma"; automatic: false; who: "responsavel" } {
  const kind = s.signal === "revisar-estrategia" ? "nova-versao-do-plano" : s.signal === "sem-evidencia" ? "registrar-reavaliacao" : s.signal === "concluir-ciclo" ? "encerrar-ciclo" : "nenhuma";
  return { kind, automatic: false, who: "responsavel" };
}

/** Atividade de recuperação de professor só conta se é da autoria do responsável docente e aponta original quando houver. */
export function activityProvenance(a: RecoveryActivity, c: RecoveryCase): string[] {
  const p: string[] = [];
  if (!c.responsiblePersonIds.includes(a.authorPersonId)) p.push("Atividade de autor fora dos responsáveis do plano.");
  if (a.date < c.startedOn || a.date > c.periodTo) p.push("Atividade fora do período do plano.");
  return p;
}

/** Central: contagem de casos e sinais por escola, 1–4 suprimido; nenhum estudante. */
export function centralRecovery(signals: StudentSignal[]) {
  const by: Record<Signal, number> = { continuar: 0, "revisar-estrategia": 0, "concluir-ciclo": 0, "sem-evidencia": 0 };
  for (const s of signals) by[s.signal]++;
  return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v > 0 && v < 5 ? "suprimido" : v]));
}
