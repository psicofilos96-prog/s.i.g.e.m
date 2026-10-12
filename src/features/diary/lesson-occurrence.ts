/**
 * Docente LOTE 04 — Situação da aula no Diário de Classe (projeção pura).
 *
 * A situação (prevista / realizada / não realizada / reposta / substituída) NUNCA é
 * persistida: deriva da aula prevista na grade publicada + da versão vigente do
 * registro (cadeia `lesson-versions.ts`) + de atos de ocorrência declarados.
 * Conteúdo, habilidades, metodologia etc. continuam só em `LessonFacts`; aqui nada
 * é copiado, para não haver segunda verdade.
 */
import type { LessonRecordVersion } from "./lesson-versions";

export type PlannedLesson = {
  slotKey: string; // aula prevista (data + bloco) na grade publicada
  date: string;
  assignmentId: string;
  classId: string;
  componentId: string;
  titularProfessionalId: string;
};

/** Ato de ocorrência: fato declarado por alguém, com autoria e motivo. */
export type LessonOccurrenceAct =
  | { kind: "nao-realizada"; slotKey: string; agentId: string; actedAt: string; reason: string }
  | { kind: "reposicao"; slotKey: string; replacesSlotKey: string; agentId: string; actedAt: string }
  | { kind: "substituicao"; slotKey: string; substituteProfessionalId: string; agentId: string; actedAt: string };

export type LessonSituation =
  | "Prevista"
  | "Realizada"
  | "Não realizada"
  | "Reposta"
  | "Substituída"
  | "Inconsistente";

export type LessonSituationView = {
  situation: LessonSituation;
  /** Quem registrou a versão vigente (autoria real), quando houver registro. */
  author?: string;
  version?: number;
  rectified: boolean;
  notes: string[];
};

const concluded = (v?: LessonRecordVersion) => v?.status === "Concluída";

/**
 * Deriva a situação. Regras:
 * - Sem registro concluído e sem ato ⇒ "Prevista" (prevista nunca vira ministrada por data).
 * - Registro concluído ⇒ "Realizada"; se o docente for substituto declarado ⇒ "Substituída".
 * - Ato "não realizada" exige motivo; junto com registro concluído ⇒ "Inconsistente".
 * - Aula prevista apontada por reposição concluída ⇒ "Reposta" (a original continua não realizada no histórico).
 * - Registro de autor diferente do titular sem ato de substituição ⇒ "Inconsistente" (falha fechada).
 */
export function lessonSituation(
  planned: PlannedLesson,
  current: LessonRecordVersion | undefined,
  acts: readonly LessonOccurrenceAct[],
  recordsBySlot: ReadonlyMap<string, LessonRecordVersion | undefined> = new Map(),
): LessonSituationView {
  const mine = acts.filter((a) => a.slotKey === planned.slotKey);
  const notDone = mine.find((a) => a.kind === "nao-realizada");
  const subst = mine.find((a) => a.kind === "substituicao");
  const notes: string[] = [];
  const base = {
    author: current?.facts.professionalId,
    version: current?.version,
    rectified: Boolean(current?.rectification),
  };

  if (notDone && !notDone.reason.trim()) {
    return { ...base, situation: "Inconsistente", notes: ["Aula marcada como não realizada sem motivo declarado."] };
  }
  if (notDone && concluded(current)) {
    return { ...base, situation: "Inconsistente", notes: ["Há registro concluído e declaração de não realização para a mesma aula."] };
  }
  if (notDone) {
    const repo = acts.find(
      (a) => a.kind === "reposicao" && a.replacesSlotKey === planned.slotKey && concluded(recordsBySlot.get(a.slotKey)),
    );
    if (repo) return { ...base, situation: "Reposta", notes: [`Reposta na aula ${repo.slotKey}.`] };
    return { ...base, situation: "Não realizada", notes: [`Motivo: ${notDone.reason}`] };
  }
  if (!concluded(current)) {
    if (current) notes.push("Registro em elaboração; a aula continua prevista até a conclusão.");
    return { ...base, situation: "Prevista", notes };
  }
  const author = current!.facts.professionalId;
  if (author !== planned.titularProfessionalId) {
    if (subst?.kind === "substituicao" && subst.substituteProfessionalId === author) {
      return { ...base, situation: "Substituída", notes: ["Registrada por substituto declarado."] };
    }
    return { ...base, situation: "Inconsistente", notes: ["Registro de outro docente sem substituição declarada."] };
  }
  if (current!.facts.assignmentId !== planned.assignmentId || current!.facts.date !== planned.date) {
    return { ...base, situation: "Inconsistente", notes: ["Registro não corresponde à atribuição/data da aula prevista."] };
  }
  if (base.rectified) notes.push(`Retificada (versão ${current!.version}).`);
  return { ...base, situation: "Realizada", notes };
}

/** Pode registrar: só o titular ou o substituto declarado, e nunca sobre aula declarada não realizada. */
export function canRegisterLesson(
  planned: PlannedLesson,
  professionalId: string,
  acts: readonly LessonOccurrenceAct[],
): { allowed: boolean; reason?: string } {
  const mine = acts.filter((a) => a.slotKey === planned.slotKey);
  if (mine.some((a) => a.kind === "nao-realizada")) return { allowed: false, reason: "Aula declarada como não realizada." };
  if (professionalId === planned.titularProfessionalId) return { allowed: true };
  if (mine.some((a) => a.kind === "substituicao" && a.substituteProfessionalId === professionalId)) return { allowed: true };
  return { allowed: false, reason: "Sem atribuição nem substituição declarada para esta aula." };
}
