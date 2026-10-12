/**
 * LOTE 17 — Meu histórico e fechamento (núcleo puro).
 * Histórico: fatos autorados pela pessoa, filtráveis por escola/turma/componente/período,
 * preservados após o fim do vínculo (autoria não depende de atuação vigente).
 * Pré-fechamento: lista pendências de fontes lidas; fonte não lida bloqueia (nunca zero).
 * Submissão/encerramento/reabertura: ledger com seq esperado e idempotência; competência
 * só por capacidade declarada; reabertura exige motivo e cria nova versão. Nenhuma
 * homologação humana é simulada: sem capacidade, o ato é recusado.
 */

export type FactKind = "aula" | "chamada" | "nota" | "recuperacao" | "documento";
export interface AuthoredFact {
  id: string; kind: FactKind; authorPersonId: string;
  schoolId: string; classId: string; componentId: string | null; periodId: string; date: string;
}
export interface HistoryFilter { schoolId?: string; classId?: string; componentId?: string; periodId?: string }

export function myHistory(personId: string, facts: AuthoredFact[], f: HistoryFilter = {}): AuthoredFact[] {
  return facts
    .filter((x) => x.authorPersonId === personId)
    .filter((x) => (!f.schoolId || x.schoolId === f.schoolId) && (!f.classId || x.classId === f.classId)
      && (!f.componentId || x.componentId === f.componentId) && (!f.periodId || x.periodId === f.periodId))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));
}

/** Fonte = null significa não lida/negada. */
export interface PreClosingSources {
  expectedLessons: string[] | null; recordedLessons: string[] | null;
  expectedAttendance: string[] | null; concludedAttendance: string[] | null;
  pendingGrades: number | null; pendingRecovery: number | null; pendingDocuments: number | null;
}
export interface Pending { kind: FactKind; detail: string }
export interface PreClosing { ready: boolean; pendings: Pending[]; blockers: string[] }

export function preClosing(s: PreClosingSources): PreClosing {
  const blockers: string[] = []; const pendings: Pending[] = [];
  const diff = (kind: FactKind, exp: string[] | null, got: string[] | null, label: string) => {
    if (exp === null || got === null) { blockers.push(`Fonte de ${label} não lida: não é possível afirmar que está completa.`); return; }
    const done = new Set(got);
    for (const k of exp) if (!done.has(k)) pendings.push({ kind, detail: `${label} pendente: ${k}` });
  };
  diff("aula", s.expectedLessons, s.recordedLessons, "registro de aula");
  diff("chamada", s.expectedAttendance, s.concludedAttendance, "chamada");
  const count = (kind: FactKind, n: number | null, label: string) => {
    if (n === null) blockers.push(`Fonte de ${label} não lida: não é possível afirmar que está completa.`);
    else if (n > 0) pendings.push({ kind, detail: `${n} ${label} pendente(s)` });
  };
  count("nota", s.pendingGrades, "notas");
  count("recuperacao", s.pendingRecovery, "recuperações");
  count("documento", s.pendingDocuments, "documentos");
  return { ready: blockers.length === 0 && pendings.length === 0, pendings, blockers };
}

export type ClosingAct = "submeter" | "encerrar" | "devolver" | "reabrir";
export interface ClosingEvent { seq: number; act: ClosingAct; actorPersonId: string; reason: string | null; version: number; key: string }
export type ClosingState = "aberto" | "submetido" | "encerrado";

export function closingState(events: ClosingEvent[]): { state: ClosingState; version: number } {
  let state: ClosingState = "aberto"; let version = 1;
  for (const e of events) {
    if (e.act === "submeter") state = "submetido";
    else if (e.act === "encerrar") state = "encerrado";
    else if (e.act === "devolver") state = "aberto";
    else { state = "aberto"; version = e.version; }
  }
  return { state, version };
}

const ALLOWED: Record<ClosingAct, ClosingState> = { submeter: "aberto", encerrar: "submetido", devolver: "submetido", reabrir: "encerrado" };

export interface ActRequest {
  act: ClosingAct; actorPersonId: string | null; actorCapabilities: string[];
  ownerPersonId: string; expectedSeq: number; reason?: string; idempotencyKey: string;
  /** capacidades declaradas pela política homologada; ausente ⇒ falha fechada. */
  policy: { closeCapability: string; reopenCapability: string } | null;
  preClosing?: PreClosing;
}

export function applyClosingAct(events: ClosingEvent[], r: ActRequest):
  { ok: true; event: ClosingEvent; replay: boolean } | { ok: false; reason: string } {
  const dup = events.find((e) => e.key === r.idempotencyKey);
  if (dup) return { ok: true, event: dup, replay: true };
  if (!r.actorPersonId) return { ok: false, reason: "Ato exige pessoa natural autenticada." };
  if (events.length !== r.expectedSeq) return { ok: false, reason: "Base desatualizada: recarregue antes de agir." };
  const { state, version } = closingState(events);
  if (ALLOWED[r.act] !== state) return { ok: false, reason: `Ato "${r.act}" não admitido no estado ${state}.` };
  const reason = r.reason?.trim() || null;
  if (r.act === "submeter") {
    if (r.actorPersonId !== r.ownerPersonId) return { ok: false, reason: "Só o docente autor submete o próprio diário." };
    if (!r.preClosing?.ready) return { ok: false, reason: "Pré-fechamento com pendências ou fontes não lidas." };
  } else {
    if (!r.policy) return { ok: false, reason: "Sem política homologada de fechamento: nada é encerrado." };
    const cap = r.act === "reabrir" ? r.policy.reopenCapability : r.policy.closeCapability;
    if (!r.actorCapabilities.includes(cap)) return { ok: false, reason: `Falta a capacidade ${cap}.` };
    if (r.actorPersonId === r.ownerPersonId) return { ok: false, reason: "O autor não encerra, devolve nem reabre o próprio diário." };
    if ((r.act === "reabrir" || r.act === "devolver") && !reason) return { ok: false, reason: "Motivo obrigatório." };
  }
  const event: ClosingEvent = {
    seq: events.length + 1, act: r.act, actorPersonId: r.actorPersonId, reason,
    version: r.act === "reabrir" ? version + 1 : version, key: r.idempotencyKey,
  };
  return { ok: true, event, replay: false };
}
