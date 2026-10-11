/**
 * Lote 09 (Expansão) — Formação continuada: núcleo puro.
 * Participante é pessoa canônica do servidor; formação continuada NUNCA vira titulação oficial
 * (`professional_qualifications`). Certificado externo só conta após validação humana.
 */

export type Offering = Readonly<{ id: string; seats: number | null; hours: number | null; minAttendancePct: number | null }>;
export type Enrollment = Readonly<{ personId: string; at: string; state: "inscrita" | "espera" | "cancelada" }>;

/** Vagas: confirmadas até o limite pela ordem de inscrição; resto em espera. Sem limite configurado ⇒ não decide. */
export function seatAllocation(o: Offering, enrollments: readonly Enrollment[]) {
  if (o.seats == null) return { ok: false as const, reason: "vagas-nao-configuradas" };
  const active = [...new Map(enrollments.filter((e) => e.state !== "cancelada").map((e) => [e.personId, e])).values()]
    .sort((a, b) => a.at.localeCompare(b.at) || a.personId.localeCompare(b.personId));
  return { ok: true as const, confirmed: active.slice(0, o.seats).map((e) => e.personId), waitlist: active.slice(o.seats).map((e) => e.personId) };
}

/** Frequência: só sessões realizadas contam no denominador; sem sessão ⇒ null. */
export function attendancePct(sessions: readonly { held: boolean; present: boolean | null }[]) {
  const held = sessions.filter((s) => s.held);
  if (!held.length || held.some((s) => s.present == null)) return null;
  return Math.round((held.filter((s) => s.present).length / held.length) * 1000) / 10;
}

/** Certificado só com carga horária e frequência mínima configuradas e atingidas. */
export function certificateEligibility(o: Offering, pct: number | null) {
  if (o.hours == null) return { ok: false as const, reason: "carga-horaria-nao-configurada" };
  if (o.minAttendancePct == null) return { ok: false as const, reason: "frequencia-minima-nao-configurada" };
  if (pct == null) return { ok: false as const, reason: "frequencia-nao-apurada" };
  if (pct < o.minAttendancePct) return { ok: false as const, reason: "frequencia-insuficiente" };
  return { ok: true as const, hours: o.hours };
}

/** Certificado externo: reconhecido só com validação humana por pessoa diferente de quem enviou. */
export function externalRecognized(c: { submittedBy: string; validatedBy: string | null; decision: "aceito" | "recusado" | null }) {
  return c.decision === "aceito" && c.validatedBy != null && c.validatedBy !== c.submittedBy;
}

/** Histórico: soma só horas de certificados emitidos ou externos reconhecidos; nunca grava titulação. */
export function individualHours(items: readonly { kind: "interno" | "externo"; hours: number; recognized: boolean }[]) {
  return items.filter((i) => i.kind === "interno" || i.recognized).reduce((s, i) => s + i.hours, 0);
}

/** Verificação pública do certificado: só metadados mínimos (sem CPF, sem matrícula funcional). */
export const certificatePublicView = (c: Record<string, unknown>) =>
  Object.fromEntries(["codigo", "curso", "cargaHoraria", "emitidoEm", "situacao"].filter((k) => k in c).map((k) => [k, c[k]]));
