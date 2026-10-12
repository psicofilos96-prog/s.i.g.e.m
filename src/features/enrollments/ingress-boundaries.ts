/**
 * SIGEM Matrículas L02 — fronteiras de domínio e contratos de integração.
 * Organização da Rede é dona da OFERTA AUTORIZADA; Matrículas é dona de INSCRIÇÃO/DISTRIBUIÇÃO/RESERVA;
 * Secretaria é dona da MATRÍCULA OFICIAL (writers B3). Cada contrato só passa referências + versão esperada;
 * nenhum domínio grava fato de outro. Invariantes transacionais são verificadas aqui e repetidas nos writers.
 */
import { offerAcceptsEnrollment, type OfferEvent, type OfferIdentity } from "./school-offer-lifecycle";

export type Domain = "organizacao-da-rede" | "matriculas" | "secretaria";

/** Fatos e módulos por dono. Teste estático garante que módulos de Matrículas não importam writers de outro dono. */
export const OWNERSHIP: Readonly<Record<Domain, { facts: readonly string[]; modules: readonly string[] }>> = {
  "organizacao-da-rede": { facts: ["oferta", "capacidade-autorizada", "quadro-de-vagas"], modules: ["school-offer-lifecycle", "capacity-model", "class-planning", "vacancy-board"] },
  matriculas: { facts: ["campanha", "inscricao", "solicitacao", "distribuicao", "reserva", "lista-de-espera", "confirmacao-do-responsavel"],
    modules: ["enrollment-campaigns", "pre-registration", "vacancy-requests", "distribution-engine", "reservation-ledger", "waiting-list", "ingress-boundaries"] },
  secretaria: { facts: ["estudante", "matricula", "participacao", "enturmacao", "movimentacao"], modules: ["official-confirmation", "temporal-allocation", "transfer-flow"] },
};

/** Writers do banco de cada dono (nome de função SQL). Matrículas nunca chama os de Secretaria/Rede diretamente. */
export const FOREIGN_WRITERS: readonly string[] = [
  "record_school_enrollment", "record_cycle_participation", "record_class_enrollment_episode", "end_class_enrollment_episode",
  "record_student_movement", "record_class_capacity", "register_institutional_student",
];

/* ---------- Contrato 1: Rede → Matrículas (oferta consumível) ---------- */
export type OfferRef = Readonly<{ offerId: string; offerSeq: number; schoolId: string; axes: Readonly<Record<string, string>>; authorizedSeats: number | null; knownAt: string }>;

/** Matrículas só consome oferta publicada/em funcionamento na data, com vagas autorizadas lidas; congela seq lido. */
export function consumeOffer(base: OfferIdentity, events: readonly OfferEvent[], authorizedSeats: number | null, on: string, knownAt: string): { ok: true; ref: OfferRef } | { ok: false; reason: string } {
  if (!offerAcceptsEnrollment(base, events, on)) return { ok: false, reason: "Oferta não publicada ou fora do período." };
  if (authorizedSeats == null) return { ok: false, reason: "Vagas autorizadas não lidas: Matrículas não presume capacidade." };
  return { ok: true, ref: { offerId: base.offerId, offerSeq: events.length, schoolId: base.schoolId, axes: base.axes, authorizedSeats, knownAt } };
}

/* ---------- Contrato 2: Matrículas → Secretaria (pedido de matrícula) ---------- */
export type EnrollmentHandoff = Readonly<{
  kind: "pedido-de-matricula"; handoffKey: string; protocolNumber: string; reservationId: string; reservationVersion: number;
  offer: OfferRef; candidatePersonId: string | null; confirmedByGuardianAt: string; writes: readonly never[];
}>;

export function buildHandoff(i: { protocolNumber: string; reservationId: string; reservationVersion: number; reservationState: "ativa" | "confirmada" | "cancelada" | "vencida";
  offer: OfferRef; candidatePersonId: string | null; confirmedByGuardianAt: string | null }): { ok: true; handoff: EnrollmentHandoff } | { ok: false; reason: string } {
  if (!/^PROT-\d{4}-\d+$/.test(i.protocolNumber)) return { ok: false, reason: "Protocolo deve ser o protocolo único do SIGEM Documentos." };
  if (i.reservationState !== "confirmada") return { ok: false, reason: "Só reserva confirmada gera pedido à Secretaria." };
  if (!i.confirmedByGuardianAt) return { ok: false, reason: "Falta manifestação do responsável." };
  return { ok: true, handoff: { kind: "pedido-de-matricula", handoffKey: `${i.protocolNumber}:${i.reservationId}:${i.reservationVersion}`, protocolNumber: i.protocolNumber,
    reservationId: i.reservationId, reservationVersion: i.reservationVersion, offer: i.offer, candidatePersonId: i.candidatePersonId, confirmedByGuardianAt: i.confirmedByGuardianAt, writes: [] } };
}

/* ---------- Contrato 3: Secretaria → Matrículas (retorno do fato oficial) ---------- */
export type OfficialReturn = Readonly<{ handoffKey: string; outcome: "matriculado" | "recusado"; enrollmentId: string | null; reason: string | null; personId: string }>;

/** Reserva só é consumida com referência a matrícula gravada pelo writer B3; recusa devolve a vaga só por evento explícito. */
export function applyOfficialReturn(r: OfficialReturn, handoff: EnrollmentHandoff, enrollmentExists: (id: string) => boolean | null):
  { ok: true; reservationEvent: "consumida" | "liberada" } | { ok: false; reason: string } {
  if (r.handoffKey !== handoff.handoffKey) return { ok: false, reason: "Retorno de outro pedido." };
  if (r.outcome === "recusado") return r.reason && r.reason.trim().length >= 10 ? { ok: true, reservationEvent: "liberada" } : { ok: false, reason: "Recusa exige motivo." };
  if (!r.enrollmentId) return { ok: false, reason: "Matriculado exige referência da matrícula oficial." };
  const ex = enrollmentExists(r.enrollmentId);
  if (ex == null) return { ok: false, reason: "Matrícula não lida: reserva permanece." };
  if (!ex) return { ok: false, reason: "Matrícula referenciada não existe." };
  return { ok: true, reservationEvent: "consumida" };
}

/* ---------- Invariantes transacionais (repetidas nos writers com lock) ---------- */
export type SeatLedger = Readonly<{ authorized: number | null; occupants: number | null; activeReservations: number | null; version: number }>;

/** Reserva nova: compare-and-set na versão lida e soma nunca acima do autorizado; qualquer parcela não lida recusa. */
export function canReserve(l: SeatLedger, expectedVersion: number): { ok: true; nextVersion: number } | { ok: false; reason: string } {
  if (l.version !== expectedVersion) return { ok: false, reason: "Versão do quadro mudou: releia." };
  if (l.authorized == null || l.occupants == null || l.activeReservations == null) return { ok: false, reason: "Parcela do quadro não lida." };
  if (l.occupants + l.activeReservations + 1 > l.authorized) return { ok: false, reason: "Sem vaga autorizada disponível." };
  return { ok: true, nextVersion: l.version + 1 };
}

/** Um estudante (ou candidato) só pode ter uma reserva ativa por campanha e nunca reserva onde já ocupa. */
export function uniquenessProblems(existing: readonly { campaignId: string; key: string; state: string }[], next: { campaignId: string; key: string }, alreadyEnrolledThere: boolean): string[] {
  const p: string[] = [];
  if (existing.some((e) => e.campaignId === next.campaignId && e.key === next.key && (e.state === "ativa" || e.state === "confirmada"))) p.push("Já existe reserva ativa nesta campanha.");
  if (alreadyEnrolledThere) p.push("Estudante já ocupa vaga nesta oferta.");
  return p;
}
