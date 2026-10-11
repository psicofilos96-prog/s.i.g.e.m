// SIGEM 2.0 — Lote 1/4: Central de atendimento, protocolos e pré-matrícula (núcleo puro).
// Protocolo = pedido registrado; nunca é matrícula, transferência nem documento.
// Estado é projeção do ledger de eventos; nada derivável é gravado.

export interface ProtocolType { id: string; label: string; homologated: boolean; deadlineBusinessDays: number | null }
export type ProtocolEventKind = "aberto" | "encaminhado" | "respondido" | "concluido" | "cancelado";
export interface ProtocolEvent { seq: number; kind: ProtocolEventKind; at: string; actorPrincipalId: string; schoolId: string; note?: string; targetSchoolId?: string }
export interface Protocol { id: string; schoolId: string; typeId: string; requesterHmac: string | null; studentId: string | null; events: ProtocolEvent[] }

export type Refusal = { ok: false; code: string };
export type Ok<T> = { ok: true; value: T };

const TERMINAL: ProtocolEventKind[] = ["concluido", "cancelado"];
const NEXT: Record<ProtocolEventKind, ProtocolEventKind[]> = {
  aberto: ["encaminhado", "respondido", "concluido", "cancelado"],
  encaminhado: ["respondido", "concluido", "cancelado"],
  respondido: ["encaminhado", "concluido", "cancelado"],
  concluido: [], cancelado: [],
};

/** Abre protocolo: tipo só homologado; requerente só por HMAC (CPF em texto é recusado). */
export function openProtocol(input: { id: string; schoolId: string; type: ProtocolType | undefined; requester: string | null; studentId: string | null; at: string; actorPrincipalId: string }): Ok<Protocol> | Refusal {
  if (!input.type) return { ok: false, code: "protocol:type-unknown" };
  if (!input.type.homologated) return { ok: false, code: "protocol:type-not-homologated" };
  if (input.requester && /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(input.requester)) return { ok: false, code: "protocol:plain-cpf" };
  if (!input.actorPrincipalId) return { ok: false, code: "protocol:actor-required" };
  return { ok: true, value: { id: input.id, schoolId: input.schoolId, typeId: input.type.id, requesterHmac: input.requester, studentId: input.studentId,
    events: [{ seq: 1, kind: "aberto", at: input.at, actorPrincipalId: input.actorPrincipalId, schoolId: input.schoolId }] } };
}

export function protocolState(p: Protocol): ProtocolEventKind { return p.events[p.events.length - 1]!.kind; }

/** Acrescenta evento com base esperada; escola só age sobre o próprio protocolo ou o encaminhado a ela. */
export function appendProtocolEvent(p: Protocol, ev: Omit<ProtocolEvent, "seq">, expectedSeq: number): Ok<Protocol> | Refusal {
  const head = p.events[p.events.length - 1]!;
  if (head.seq !== expectedSeq) return { ok: false, code: "protocol:stale-base" };
  if (!NEXT[head.kind].includes(ev.kind)) return { ok: false, code: "protocol:transition-invalid" };
  const holder = currentHolder(p);
  if (ev.schoolId !== holder) return { ok: false, code: "protocol:not-in-scope" };
  if (ev.kind === "encaminhado" && !ev.targetSchoolId) return { ok: false, code: "protocol:target-required" };
  if (ev.kind === "cancelado" && !ev.note?.trim()) return { ok: false, code: "protocol:reason-required" };
  return { ok: true, value: { ...p, events: [...p.events, { ...ev, seq: head.seq + 1 }] } };
}

export function currentHolder(p: Protocol): string {
  for (let i = p.events.length - 1; i >= 0; i--) if (p.events[i]!.kind === "encaminhado") return p.events[i]!.targetSchoolId!;
  return p.schoolId;
}

/** Prazo só com dias úteis configurados no tipo E calendário lido; senão null (não apurado). */
export function protocolDue(p: Protocol, type: ProtocolType, businessDays: string[] | null): string | null {
  if (type.deadlineBusinessDays == null || !businessDays) return null;
  const opened = p.events[0]!.at.slice(0, 10);
  const after = businessDays.filter((d) => d > opened).sort();
  return after[type.deadlineBusinessDays - 1] ?? null;
}

export function isOverdue(p: Protocol, due: string | null, today: string): boolean | null {
  if (due == null) return null;
  return !TERMINAL.includes(protocolState(p)) && today > due;
}

// ---------- Pré-matrícula ----------
export interface PreEnrollment { id: string; schoolId: string; protocolId: string; desiredOfferRef: string | null; status: "solicitada" | "convertida" | "recusada"; draftId: string | null }

/** Conversão só vira RASCUNHO da matrícula guiada (enrollment_draft_*), nunca matrícula direta. */
export function convertPreEnrollment(pre: PreEnrollment, draftId: string | null): Ok<PreEnrollment> | Refusal {
  if (pre.status !== "solicitada") return { ok: false, code: "pre:not-open" };
  if (!draftId) return { ok: false, code: "pre:draft-required" };
  return { ok: true, value: { ...pre, status: "convertida", draftId } };
}

/** Fila da pré-matrícula só com critério homologado; sem ele, ordem não é exibida. */
export function preEnrollmentOrder(list: PreEnrollment[], criterionHomologated: boolean): PreEnrollment[] | null {
  return criterionHomologated ? list.filter((p) => p.status === "solicitada") : null;
}
