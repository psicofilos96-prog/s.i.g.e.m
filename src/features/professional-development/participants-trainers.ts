/**
 * SIGEM Desenvolvimento L11 — participantes e formadores (projeção pura; banco = 0440).
 * Formador = designação temporal de pessoa canônica: interno com atuação que cobre a janela; externo sem atuação,
 * que só lê a própria turma durante a vigência. Histórico do participante segue a pessoa, nunca a lotação.
 */
export type Designation = Readonly<{ id: string; classId: string; personId: string; nature: "interno" | "externo";
  validFrom: string; validUntil: string; endedOn: string | null }>;

/** Vigente na data: dentro da janela e antes do encerramento (encerramento é exclusivo). */
export function activeOn(d: Designation, on: string): boolean {
  return d.validFrom <= on && on <= d.validUntil && (d.endedOn == null || on < d.endedOn);
}

/** Espelha `dev_is_active_trainer`: acesso do formador é só à turma onde está vigente hoje. */
export function trainerCanRead(designations: readonly Designation[], personId: string, classId: string, today: string): boolean {
  return designations.some((d) => d.personId === personId && d.classId === classId && activeOn(d, today));
}

export function designationProblems(i: { designator: string; personId: string; naturalPerson: boolean;
  engagement: { personId: string; validFrom: string; validUntil: string | null } | null; hasAnyEngagementInWindow: boolean;
  from: string; until: string; classStartsOn: string; classEndsOn: string; basis: string;
  existing: readonly Designation[]; classId: string }): string[] {
  const p: string[] = [];
  if (i.designator === i.personId) p.push("Ninguém designa a si mesmo.");
  if (!i.naturalPerson) p.push("Formador precisa ser pessoa natural do cadastro canônico.");
  if (i.until < i.from) p.push("Período inválido.");
  if (i.from < i.classStartsOn || i.until > i.classEndsOn) p.push("Designação fora do período da turma.");
  if (i.basis.trim().length < 10) p.push("Informe o fundamento (10+ caracteres).");
  if (i.engagement) {
    if (i.engagement.personId !== i.personId || i.engagement.validFrom > i.from || (i.engagement.validUntil != null && i.engagement.validUntil < i.until))
      p.push("A atuação não pertence à pessoa ou não cobre todo o período.");
  } else if (i.hasAnyEngagementInWindow) p.push("Pessoa com atuação no período deve ser designada como interna.");
  const overlap = i.existing.some((d) => d.classId === i.classId && d.personId === i.personId &&
    d.validFrom <= i.until && (d.endedOn ? prevDay(d.endedOn) : d.validUntil) >= i.from && (d.endedOn ? prevDay(d.endedOn) : d.validUntil) >= d.validFrom);
  if (overlap) p.push("Já existe designação dessa pessoa nessa turma no período.");
  return p;
}

function prevDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10);
}

export type HistoryRow = Readonly<{ enrollmentId: string; courseTitle: string; functionalLinkId: string | null; schoolAtRequest: string | null; lastEvent: string | null }>;

/** Histórico por pessoa: mudança de lotação nunca remove nem reatribui linhas; a escola do pedido é só fotografia. */
export function personHistory(rows: readonly HistoryRow[], currentSchool: string | null) {
  return rows.map((r) => ({ ...r, movedSinceRequest: r.schoolAtRequest != null && currentSchool != null && r.schoolAtRequest !== currentSchool }));
}
