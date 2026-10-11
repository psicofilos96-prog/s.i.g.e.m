// Lote 05 Secretaria por unidade: movimentações datadas e transferências (núcleo puro).
// Gravação real só pelos writers canônicos (secretariat_reassign_class, secretariat_record_exit,
// secretariat_end_class_episode, record_student_movement); tipo de movimentação só homologado.

export type MovementKind = "mudanca-turma" | "mudanca-turno" | "remanejamento" | "transferencia-interna" | "transferencia-externa" | "recebimento" | "reclassificacao" | "progressao" | "retencao" | "conclusao" | "encerramento-legal";

/** Progressão/retenção/conclusão/reclassificação são efeitos acadêmicos: exigem registro oficial (fechamento/ato). */
const NEEDS_ACADEMIC_ACT: MovementKind[] = ["reclassificacao", "progressao", "retencao", "conclusao"];
const NEEDS_DESTINATION: MovementKind[] = ["mudanca-turma", "mudanca-turno", "remanejamento", "transferencia-interna"];

export interface MovementType { id: string; kind: MovementKind; homologated: boolean; capability: string }
export interface Movement { id: string; studentId: string; enrollmentId: string; typeId: string; effectiveOn: string; recordedAt: string; reason: string; origin: { schoolId: string; classId: string | null }; destination: { schoolId: string | null; classId: string | null; externalInstitution: string | null } | null; academicActRef: string | null; actorPrincipalId: string; human: boolean }

export interface ValidationCtx {
  types: Map<string, MovementType>;
  caps: Set<string>;
  enrollment: { id: string; studentId: string; schoolId: string; opened: string | null; closedOn: string | null } | null;
  history: Movement[]; // movimentações já registradas da matrícula
  today: string;
  retroactiveAllowedDays: number | null; // norma declarada; null = sem retroativo
}

export function validateMovement(m: Omit<Movement, "id" | "recordedAt">, ctx: ValidationCtx): string[] {
  const r: string[] = [];
  const t = ctx.types.get(m.typeId);
  if (!m.human) r.push("autor humano obrigatório");
  if (!t) r.push("tipo de movimentação inexistente");
  else {
    if (!t.homologated) r.push("tipo de movimentação não homologado");
    if (!ctx.caps.has(t.capability)) r.push("sem competência para esta movimentação");
    if (NEEDS_ACADEMIC_ACT.includes(t.kind) && !m.academicActRef) r.push("exige registro acadêmico oficial (fechamento/ato)");
    if (NEEDS_DESTINATION.includes(t.kind) && !m.destination?.classId) r.push("destino interno não informado");
    if (t.kind === "transferencia-externa" && m.destination?.classId) r.push("transferência externa não aloca turma no destino");
    if (t.kind === "recebimento" && !m.destination?.schoolId) r.push("escola recebedora não informada");
  }
  if (!m.reason.trim()) r.push("motivo obrigatório");
  const e = ctx.enrollment;
  if (!e) r.push("matrícula não encontrada");
  else {
    if (e.studentId !== m.studentId) r.push("matrícula de outro estudante");
    if (e.schoolId !== m.origin.schoolId) r.push("origem difere da escola da matrícula");
    if (!e.opened) r.push("início da matrícula não declarado: datar a movimentação é impossível");
    else if (m.effectiveOn < e.opened) r.push("data anterior ao início da matrícula");
    if (e.closedOn && m.effectiveOn > e.closedOn) r.push("matrícula já encerrada nessa data");
  }
  if (m.effectiveOn > ctx.today) r.push("data futura");
  else if (m.effectiveOn < ctx.today) {
    const days = (Date.parse(ctx.today) - Date.parse(m.effectiveOn)) / 86400000;
    if (ctx.retroactiveAllowedDays == null || days > ctx.retroactiveAllowedDays) r.push("retroativo além do permitido pela norma");
  }
  // datas conflitantes: mesma data com outra movimentação, ou depois de saída
  if (ctx.history.some((h) => h.effectiveOn === m.effectiveOn)) r.push("já existe movimentação nessa data");
  const exit = ctx.history.find((h) => ["transferencia-externa", "conclusao", "encerramento-legal"].includes(ctx.types.get(h.typeId)?.kind ?? "mudanca-turma"));
  if (exit && m.effectiveOn >= exit.effectiveOn) r.push("posterior à saída registrada");
  return r;
}

/** Linha do tempo: lacunas entre fim de turma e próximo início ficam explícitas. */
export interface Segment { classId: string; from: string; to: string | null }
export function trajectoryGaps(segments: Segment[]): { after: string; before: string }[] {
  const s = [...segments].sort((a, b) => a.from.localeCompare(b.from));
  const gaps: { after: string; before: string }[] = [];
  for (let i = 1; i < s.length; i++) {
    const prevEnd = s[i - 1]!.to;
    if (!prevEnd) continue;
    const next = new Date(prevEnd + "T00:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
    if (next.toISOString().slice(0, 10) < s[i]!.from) gaps.push({ after: prevEnd, before: s[i]!.from });
  }
  return gaps;
}
export function trajectoryOverlaps(segments: Segment[]): [string, string][] {
  const s = [...segments].sort((a, b) => a.from.localeCompare(b.from));
  const out: [string, string][] = [];
  for (let i = 1; i < s.length; i++) if ((s[i - 1]!.to ?? "9999-12-31") >= s[i]!.from) out.push([s[i - 1]!.classId, s[i]!.classId]);
  return out;
}

// ---------- Transferências ----------
/** Interna: mesmo studentId; origem encerra, destino constitui o próprio vínculo. Nunca cria estudante. */
export function internalTransferPlan(studentId: string, origin: { enrollmentId: string; schoolId: string }, dest: { schoolId: string; classId: string }, effectiveOn: string) {
  if (origin.schoolId === dest.schoolId) return { ok: false as const, code: "mesma-escola-use-remanejamento" };
  return { ok: true as const, value: { studentId, endOrigin: { enrollmentId: origin.enrollmentId, endsOn: effectiveOn }, destinationConstitutes: { schoolId: dest.schoolId, classId: dest.classId, startsOn: effectiveOn, newStudent: false } } };
}

/** Externa: registra saída e lista documentos a emitir; documento só se o tipo é compônível. */
export function externalTransferDocs(required: string[], composable: Set<string>) {
  return required.map((d) => ({ kind: d, status: composable.has(d) ? "emitivel" as const : "modelo-pendente" as const }));
}

/** Recebimento: origem declarada; documentos faltantes viram regularização, nunca dado presumido. */
export function receivingRecord(origin: { institution: string | null; schoolId: string | null }, receivedDocs: string[], required: string[]) {
  const missing = required.filter((d) => !receivedDocs.includes(d));
  return { originDeclared: !!(origin.institution || origin.schoolId), regularize: missing, originLabel: origin.institution ?? origin.schoolId ?? "origem não declarada" };
}
