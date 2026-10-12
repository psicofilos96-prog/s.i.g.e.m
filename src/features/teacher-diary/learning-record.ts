/**
 * Docente LOTE 11 — Ficha de aprendizagem e recuperação (projeção pura).
 *
 * Ficha e painel só COMPÕEM fatos já lidos das fontes donas (frequência do Diário,
 * resultados da Pauta, vínculos de habilidade, observações de acompanhamento), dentro
 * das atribuições do professor. Plano de recuperação/intervenção é proposta enviada ao
 * writer canônico do A&A (`aa_record_intervention`), nunca tabela própria. Texto
 * clínico é recusado; ausência nunca vira zero.
 */
export type AttendanceFact = { studentId: string; date: string; mark: "Presente" | "Ausente" };
export type ResultFact = { studentId: string; instrumentId: string; date: string; value: number | string | null; skillIds: readonly string[] };
export type ObservationFact = { studentId: string; date: string; authorId: string; text: string };

export type LearningRecord = {
  studentId: string;
  attendance: { present: number; absent: number; rate: number | null }; // rate só com denominador > 0
  skills: { skillId: string; assessedTimes: number; lastValue: number | string | null }[];
  evolution: { date: string; value: number }[]; // apenas numéricos, em ordem de data
  observations: ObservationFact[];
  limitations: string[];
};

export function learningRecord(
  studentId: string,
  window: { start: string; end: string },
  src: { attendance: readonly AttendanceFact[] | null; results: readonly ResultFact[] | null; observations: readonly ObservationFact[] | null },
): LearningRecord {
  const inWin = (d: string) => d >= window.start && d <= window.end;
  const limitations: string[] = [];
  const att = (src.attendance ?? []).filter((a) => a.studentId === studentId && inWin(a.date));
  if (src.attendance === null) limitations.push("Frequência não lida.");
  const present = att.filter((a) => a.mark === "Presente").length;
  const absent = att.filter((a) => a.mark === "Ausente").length;
  const rate = present + absent > 0 ? present / (present + absent) : null;
  if (src.attendance !== null && rate === null) limitations.push("Sem chamadas concluídas no período.");

  if (src.results === null) limitations.push("Resultados não lidos.");
  const res = (src.results ?? []).filter((r) => r.studentId === studentId && inWin(r.date)).sort((a, b) => a.date.localeCompare(b.date));
  const bySkill = new Map<string, { n: number; last: number | string | null }>();
  for (const r of res) for (const s of r.skillIds) {
    const cur = bySkill.get(s) ?? { n: 0, last: null };
    bySkill.set(s, { n: cur.n + (r.value === null ? 0 : 1), last: r.value ?? cur.last });
  }
  const evolution = res.filter((r): r is ResultFact & { value: number } => typeof r.value === "number").map((r) => ({ date: r.date, value: r.value }));
  if (res.some((r) => typeof r.value === "string")) limitations.push("Resultados conceituais/descritivos não entram no gráfico de evolução.");
  if (src.observations === null) limitations.push("Observações não lidas.");
  return {
    studentId,
    attendance: { present, absent, rate },
    skills: [...bySkill].map(([skillId, v]) => ({ skillId, assessedTimes: v.n, lastValue: v.last })).sort((a, b) => a.skillId.localeCompare(b.skillId)),
    evolution,
    observations: (src.observations ?? []).filter((o) => o.studentId === studentId && inWin(o.date)),
    limitations,
  };
}

/** Painel da turma: contagens por habilidade, sem ranking nem nomes; grupo pequeno só com política. */
export function classPanel(records: readonly LearningRecord[], suppressionThreshold: number | null) {
  const skills = new Map<string, number>();
  for (const r of records) for (const s of r.skills) if (s.assessedTimes > 0) skills.set(s.skillId, (skills.get(s.skillId) ?? 0) + 1);
  const rates = records.map((r) => r.attendance.rate).filter((x): x is number => x !== null);
  return {
    students: records.length,
    attendanceRate: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
    withoutAttendanceData: records.length - rates.length,
    skills: [...skills].map(([skillId, assessedStudents]) => ({
      skillId,
      assessedStudents: suppressionThreshold !== null && assessedStudents < suppressionThreshold ? null : assessedStudents,
    })).sort((a, b) => a.skillId.localeCompare(b.skillId)),
    suppressionPolicy: suppressionThreshold === null ? "sem política de divulgação" : `grupos < ${suppressionThreshold} ocultos`,
  };
}

// ---------- Plano de recuperação/intervenção (proposta ao writer do A&A) ----------
export type InterventionProposal = {
  studentIds: readonly string[];
  objectives: readonly string[];
  skillIds: readonly string[];
  responsibleIds: readonly string[];
  actions: readonly { description: string; due: string | null }[];
  reassessOn: string | null;
  evidenceRefs: readonly string[]; // ids de resultado/atividade/aula, nunca arquivo clínico
};

const CLINICAL = /\b(CID|laudo|diagn[oó]stic|TDAH|TEA|autis|transtorno|medica[cç])/i;

export function validateIntervention(p: InterventionProposal, ctx: { myStudents: readonly string[]; hasCapability: boolean }): string[] {
  const e: string[] = [];
  if (!ctx.hasCapability) e.push("Você não tem autorização para registrar intervenção pedagógica nesta escola.");
  if (!p.studentIds.length) e.push("Escolha ao menos um estudante.");
  if (p.studentIds.some((s) => !ctx.myStudents.includes(s))) e.push("Só estudantes das suas turmas podem entrar no plano.");
  if (!p.objectives.some((o) => o.trim())) e.push("Defina ao menos um objetivo.");
  if (!p.responsibleIds.length) e.push("Indique quem é responsável.");
  if (!p.actions.length) e.push("Descreva ao menos uma ação.");
  const texts = [...p.objectives, ...p.actions.map((a) => a.description)];
  if (texts.some((t) => CLINICAL.test(t))) e.push("O plano é pedagógico: não registre diagnóstico, laudo ou medicação. Encaminhe à Inclusão quando necessário.");
  if (p.reassessOn === null) e.push("Defina quando será a reavaliação.");
  return e;
}

/** Reavaliação compara apenas resultados numéricos da mesma habilidade, antes × depois; sem par ⇒ indeterminado. */
export function reassessment(results: readonly ResultFact[], studentId: string, skillId: string, planStart: string): { before: number | null; after: number | null; change: "melhorou" | "manteve" | "piorou" | "indeterminado" } {
  const nums = results.filter((r) => r.studentId === studentId && r.skillIds.includes(skillId) && typeof r.value === "number").sort((a, b) => a.date.localeCompare(b.date));
  const before = [...nums].reverse().find((r) => r.date < planStart)?.value as number | undefined;
  const after = [...nums].reverse().find((r) => r.date >= planStart)?.value as number | undefined;
  if (before === undefined || after === undefined) return { before: before ?? null, after: after ?? null, change: "indeterminado" };
  return { before, after, change: after > before ? "melhorou" : after < before ? "piorou" : "manteve" };
}
