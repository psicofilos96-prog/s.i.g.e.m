// SIGEM 2.0 — Lote complementar 08: Secretaria ↔ Família (núcleo puro).
// Reaproveita: comunicados (`communication/`, leitura ≠ ciência), autorizações (`guardian_authorizations`, v3),
// notificações (`emit_notification_event`). Aqui só regras de solicitações, retirada/representação, justificativas e recibos.

export interface GuardianAuth { personId: string; studentId: string; sections: string[]; from: string; to: string | null; revokedOn: string | null; restricted: boolean }

/** Vínculo vigente na seção; inexistente/expirado/revogado/outro educando respondem igual (sem enumeração). */
export function guardianAllowed(auths: GuardianAuth[], personId: string, studentId: string, section: string, on: string): { ok: true } | { ok: false; code: "family:not-authorized" } {
  const ok = auths.some((a) => a.personId === personId && a.studentId === studentId && !a.restricted && a.sections.includes(section)
    && a.from <= on && (a.to == null || on <= a.to) && (a.revokedOn == null || on < a.revokedOn));
  return ok ? { ok: true } : { ok: false, code: "family:not-authorized" };
}

export type RequestKind = "solicitacao" | "justificativa-ausencia" | "retirada" | "representacao";
export interface FamilyRequest { id: string; kind: RequestKind; studentId: string; schoolId: string; byPersonId: string; createdOn: string;
  attachments: string[]; events: { type: "respondida" | "deferida" | "indeferida" | "revogada"; by: string; on: string; reason?: string }[] }

const SECTION: Record<RequestKind, string> = { solicitacao: "comunicados", "justificativa-ausencia": "frequencia", retirada: "retirada", representacao: "representacao" };

export function openRequest(r: Omit<FamilyRequest, "events">, auths: GuardianAuth[], homologatedJustificationTypes: string[] | null, justificationType?: string) {
  const g = guardianAllowed(auths, r.byPersonId, r.studentId, SECTION[r.kind], r.createdOn);
  if (!g.ok) return g;
  if (r.attachments.some((p) => !p.startsWith(`familia-anexos/${r.schoolId}/${r.studentId}/`))) return { ok: false as const, code: "family:attachment-not-private" };
  if (r.kind === "justificativa-ausencia" && (!homologatedJustificationTypes || !justificationType || !homologatedJustificationTypes.includes(justificationType)))
    return { ok: false as const, code: "family:justification-type-not-homologated" };
  return { ok: true as const, request: { ...r, events: [] } as FamilyRequest, protocol: `PRT-${r.schoolId}-${r.id}` };
}

/** Só a escola da matrícula age; indeferir/revogar exigem motivo; justificativa nunca altera o Diário (só é referência). */
export function act(r: FamilyRequest, ev: FamilyRequest["events"][number], actorSchoolId: string) {
  if (actorSchoolId !== r.schoolId) return { ok: false as const, code: "family:other-school" };
  if ((ev.type === "indeferida" || ev.type === "revogada") && !ev.reason?.trim()) return { ok: false as const, code: "family:reason-required" };
  if (r.events.some((e) => e.type === "revogada")) return { ok: false as const, code: "family:already-revoked" };
  return { ok: true as const, request: { ...r, events: [...r.events, ev] } };
}

/** Retirada vale só se deferida, não revogada e a pessoa retirante está declarada. */
export function pickupAllowed(r: FamilyRequest, pickupPersonId: string, declared: string[]) {
  return r.kind === "retirada" && declared.includes(pickupPersonId) && r.events.some((e) => e.type === "deferida") && !r.events.some((e) => e.type === "revogada");
}

/** Entrega por canal: sem provedor ⇒ "sem-provedor"; lido só com confirmação; ciência só por ato explícito. */
export function deliveryState(d: { channel: "portal" | "email" | "sms" | "push"; providerConfigured: boolean; delivered: boolean; readConfirmedOn: string | null; acknowledgedOn: string | null }) {
  if (d.channel !== "portal" && !d.providerConfigured) return "sem-provedor";
  if (d.acknowledgedOn) return "ciente";
  if (d.readConfirmedOn) return "lido";
  return d.delivered ? "entregue-sem-confirmacao-de-leitura" : "nao-entregue";
}

/** Recibo: só do ato registrado, com protocolo; texto externo genérico (LGPD). */
export function receipt(r: FamilyRequest, protocol: string) {
  const last = r.events.at(-1);
  return { protocol, kind: r.kind, status: last?.type ?? "aberta", on: last?.on ?? r.createdOn, externalSummary: "Há uma nova mensagem da escola no SIGEM." };
}
