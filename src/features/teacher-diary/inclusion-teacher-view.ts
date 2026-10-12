/**
 * Docente LOTE 14 — AEE e inclusão na visão do professor (projeção pura).
 *
 * Fonte única: NEI (`nei_*`, `aee_services`, PAEE/PEI) e `inclusion_teaching_support_flags`.
 * O professor regente recebe só orientações pedagógicas marcadas como liberadas para
 * a turma/estudante dele, sem CID, laudo, dimensão clínica nem autoria; o docente AEE
 * escreve só PAEE e registros AEE pelos writers do NEI. Nada aqui grava: adaptação de
 * atividade é referência a orientação vigente, nunca plano paralelo.
 */
export type NeiGuidance = {
  guidanceId: string;
  studentId: string;
  validFrom: string;
  validUntil?: string | null;
  releasedToTeachers: boolean;
  kind: "acessibilidade" | "recurso" | "estrategia" | "adaptacao-atividade" | string;
  text: string;
  // campos que nunca podem sair para o regente:
  cid?: string; report?: string; clinicalDimension?: string; authorId?: string;
};

export type TeacherGuidance = { guidanceId: string; studentId: string; kind: string; text: string; validFrom: string };

const CLINICAL = /\b(CID|F\d{2}|laudo|diagn[oó]stic|medica[cç])/i;

/** Projeção para o regente: só estudante das próprias turmas, liberada, vigente, sem campos clínicos. */
export function guidanceForTeacher(
  all: readonly NeiGuidance[],
  ctx: { myStudents: readonly string[]; date: string },
): { items: TeacherGuidance[]; withheld: number } {
  let withheld = 0;
  const items: TeacherGuidance[] = [];
  for (const g of all) {
    const vigente = g.validFrom <= ctx.date && (!g.validUntil || g.validUntil >= ctx.date);
    if (!ctx.myStudents.includes(g.studentId) || !g.releasedToTeachers || !vigente) continue;
    if (CLINICAL.test(g.text)) { withheld++; continue; } // falha fechada: texto com menção clínica não sai
    items.push({ guidanceId: g.guidanceId, studentId: g.studentId, kind: g.kind, text: g.text, validFrom: g.validFrom });
  }
  return { items, withheld };
}

/** Adaptação na atividade só referencia orientação vigente do mesmo estudante. */
export function linkAdaptation(activityStudents: readonly string[], guidanceId: string, visible: readonly TeacherGuidance[]): { ok: true; ref: string } | { ok: false; reason: string } {
  const g = visible.find((x) => x.guidanceId === guidanceId);
  if (!g) return { ok: false, reason: "Orientação não disponível para você." };
  if (!activityStudents.includes(g.studentId)) return { ok: false, reason: "A orientação é de outro estudante." };
  return { ok: true, ref: `nei-guidance:${g.guidanceId}` };
}

/** Docente AEE: o que pode escrever, derivado da concessão NEI vigente; nunca PEI nem clínico. */
export function aeeWritable(grant: { role: "aee" | "tecnico" | "coordenacao"; schoolId: string; validUntil?: string | null } | null, schoolId: string, date: string): readonly string[] {
  if (!grant || grant.schoolId !== schoolId || (grant.validUntil && grant.validUntil < date)) return [];
  if (grant.role === "aee") return ["paee", "sessao-aee", "registro-aee"];
  return []; // demais papéis escrevem pelas telas próprias do NEI
}

/** Trilha de acesso: toda leitura de orientação pelo regente gera evento sem conteúdo. */
export function accessEvent(actorId: string, studentId: string, at: string, purpose: string): { actorId: string; studentId: string; at: string; purpose: string } {
  if (!purpose.trim()) throw new Error("Finalidade de acesso obrigatória.");
  return { actorId, studentId, at, purpose };
}
