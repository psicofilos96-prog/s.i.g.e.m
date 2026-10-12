/**
 * L04 Permanência — comunicações legalmente exigidas (fluxo SEPARADO dos alertas L03).
 * A obrigação nasce de norma configurada (texto vigente conferido por pessoa, com data
 * de conferência), nunca de constante no código: a redação da LDB (art. 12, VIII) e as
 * normas locais mudam e o percentual não é presumido aqui.
 * Envio só existe com comprovação (protocolo/recibo/ofício com hash) registrada por
 * pessoa natural; sem prova a comunicação continua PENDENTE — nunca "enviada".
 */
import type { Monitoring } from "./attendance-monitoring";

export type Recipient = string; // aberto: ex. conselho-tutelar, ministerio-publico, autoridade-judiciaria
export interface LegalObligation {
  id: string; version: number; normRef: string; normTextExcerpt: string;
  verifiedByPerson: string; verifiedOn: string; // conferência da redação vigente
  approvedByPerson: string | null; decisionRef: string | null;
  validFrom: string; validTo: string | null;
  absenceRateAbove: number | null; // fração sobre aulas com lançamento; null = não configurado
  minMarked: number | null;
  recipients: readonly Recipient[];
  responsibleEngagementRole: string | null; // rótulo da atuação responsável, nunca cargo
  deadlineDays: number | null; // só se a norma declarar
}

export type ObligationState =
  | { kind: "aplicavel"; obligation: LegalObligation }
  | { kind: "bloqueado"; reason: string };

export function resolveObligation(list: readonly LegalObligation[], on: string, maxVerificationAgeDays: number | null): ObligationState {
  const valid = list.filter((o) => o.validFrom <= on && (o.validTo === null || on <= o.validTo));
  if (valid.length === 0) return { kind: "bloqueado", reason: "Nenhuma norma de comunicação vigente configurada." };
  if (valid.length > 1) return { kind: "bloqueado", reason: "Mais de uma norma vigente; decidir qual se aplica." };
  const o = valid[0]!;
  if (!o.normTextExcerpt.trim() || o.normRef.trim().length < 3) return { kind: "bloqueado", reason: "Redação da norma não registrada." };
  if (!o.approvedByPerson || !o.decisionRef || o.approvedByPerson === o.verifiedByPerson)
    return { kind: "bloqueado", reason: "Configuração sem aprovação por pessoa distinta de quem conferiu a norma." };
  if (maxVerificationAgeDays === null) return { kind: "bloqueado", reason: "Periodicidade de reconferência da norma não definida." };
  const age = (Date.parse(on) - Date.parse(o.verifiedOn)) / 86_400_000;
  if (!(age >= 0 && age <= maxVerificationAgeDays)) return { kind: "bloqueado", reason: "Redação vigente precisa ser reconferida." };
  if (o.absenceRateAbove === null || o.minMarked === null || !(o.absenceRateAbove > 0 && o.absenceRateAbove < 1))
    return { kind: "bloqueado", reason: "Limiar legal não configurado." };
  if (o.recipients.length === 0) return { kind: "bloqueado", reason: "Destinatários legais não configurados." };
  if (!o.responsibleEngagementRole) return { kind: "bloqueado", reason: "Responsável pela comunicação não definido." };
  return { kind: "aplicavel", obligation: o };
}

export type Pendency =
  | { kind: "exigida"; obligationId: string; version: number; recipients: Recipient[]; responsible: string; dueOn: string | null; idempotencyKey: string; rate: number }
  | { kind: "nao-exigida" }
  | { kind: "indeterminada"; reason: string };

const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);

export function legalPendency(subjectRef: string, m: Monitoring, st: ObligationState, on: string): Pendency {
  if (st.kind === "bloqueado") return { kind: "indeterminada", reason: st.reason };
  const o = st.obligation;
  if (m.status !== "ok" || m.rate === null) return { kind: "indeterminada", reason: "Frequência não apurável (calendário, vigência ou lançamentos)." };
  if (m.marked < o.minMarked!) return { kind: "indeterminada", reason: "Lançamentos abaixo da base mínima configurada." };
  if (m.rate <= o.absenceRateAbove!) return { kind: "nao-exigida" };
  return { kind: "exigida", obligationId: o.id, version: o.version, recipients: [...o.recipients], responsible: o.responsibleEngagementRole!,
    dueOn: o.deadlineDays === null ? null : addDays(on, o.deadlineDays), rate: m.rate,
    idempotencyKey: `perm-legal|${o.id}|v${o.version}|${subjectRef}|${on.slice(0, 7)}` };
}

export interface DispatchProof {
  recipient: Recipient; channel: string; sentOn: string; evidenceRef: string; evidenceSha256: string;
  registeredByPerson: string; personIsNatural: boolean; registeredOn: string;
}
export type DispatchStatus = { recipient: Recipient; status: "comprovada" | "pendente" | "vencida"; proof: DispatchProof | null };

/** Registro de envio: recusa sem prova, data futura, autor técnico ou destinatário fora da obrigação. */
export function validateProof(p: DispatchProof, pend: Extract<Pendency, { kind: "exigida" }>): string | null {
  if (!p.personIsNatural) return "Envio só é registrado por pessoa natural.";
  if (!pend.recipients.includes(p.recipient)) return "Destinatário fora da obrigação.";
  if (!/^[0-9a-f]{64}$/.test(p.evidenceSha256) || p.evidenceRef.trim().length < 3) return "Comprovação ausente: envio não pode ser registrado.";
  if (p.sentOn > p.registeredOn) return "Data de envio posterior ao registro.";
  if (!p.channel.trim()) return "Canal não informado.";
  return null;
}

export function dispatchBoard(pend: Extract<Pendency, { kind: "exigida" }>, proofs: readonly DispatchProof[], today: string): DispatchStatus[] {
  return pend.recipients.map((r) => {
    const proof = proofs.find((p) => p.recipient === r && validateProof(p, pend) === null) ?? null;
    if (proof) return { recipient: r, status: "comprovada", proof };
    return { recipient: r, status: pend.dueOn !== null && today > pend.dueOn ? "vencida" : "pendente", proof: null };
  });
}

/** O fluxo legal nunca consome nem produz alerta preventivo: tipos disjuntos por construção. */
export const LEGAL_FLOW_KIND = "comunicacao-legal" as const;
