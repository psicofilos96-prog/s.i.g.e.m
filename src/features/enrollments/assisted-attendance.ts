// Matrículas L21 — atendimento presencial assistido + fluxos por etapa (EI, Fundamental, EJA semestral, estudante adulto).
// O atendente é assistente identificado (writer `enr_assisted_submit`, migration 0474), nunca autor: o requerente presente declara ciência.
// Regras de etapa reusam early-childhood (L17) e fundamental-eja (L18); idades-limite vêm SÓ de regra homologada, nunca do código.
import { classifyChild, type EiGroupingRule, type GroupResult } from "./early-childhood";
import { periodWindows, type OfferRegime, type ResolvedCalendar } from "./fundamental-eja";

export const ASSISTED_CHANNELS = ["presencial-secretaria-escolar", "presencial-central-de-matriculas", "presencial-itinerante"] as const;
export const EVIDENCE_KINDS = ["documento-identificacao-conferido", "comprovante-residencia-conferido", "termo-ciencia-assinado", "outro-documento-conferido"] as const;
export type AssistedChannel = (typeof ASSISTED_CHANNELS)[number];
export interface Evidence { kind: (typeof EVIDENCE_KINDS)[number]; sha256: string }

export interface AssistedInput {
  attendantPersonId: string | null;
  channel: string;
  requesterPresent: boolean;
  requesterAcknowledged: boolean;
  evidences: readonly Evidence[];
}

/** Pré-validação espelhando o writer; o banco revalida tudo (fonte da verdade). */
export function checkAssisted(i: AssistedInput): { ok: true } | { ok: false; reason: string } {
  if (!i.attendantPersonId) return { ok: false, reason: "sem-pessoa" };
  if (!(ASSISTED_CHANNELS as readonly string[]).includes(i.channel)) return { ok: false, reason: "canal-invalido" };
  if (!i.requesterPresent || !i.requesterAcknowledged) return { ok: false, reason: "requerente-ausente" };
  if (i.evidences.length > 20) return { ok: false, reason: "evidencia-invalida" };
  for (const e of i.evidences)
    if (!(EVIDENCE_KINDS as readonly string[]).includes(e.kind) || !/^[0-9a-f]{64}$/.test(e.sha256)) return { ok: false, reason: "evidencia-invalida" };
  return { ok: true };
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Regra homologada de autorrepresentação (idade civil e idade mínima EJA são dado, não código). */
export interface RepresentationRule { version: number; selfRepresentationAgeYears: number | null; ejaMinAgeYears: number | null; homologatedBy: string | null }

export type StageKind = "educacao-infantil" | "fundamental" | "eja";
export interface StageFlowInput {
  stageKind: StageKind | null;
  requesterKind: "responsavel" | "estudante-adulto";
  birthDate: string | null;
  referenceDate: string; // data de corte/início do ciclo
  rule: RepresentationRule | null;
  eiRules?: readonly EiGroupingRule[];
  offer?: OfferRegime;
  calendar?: ResolvedCalendar | null;
}
export type StageFlow =
  | { ok: true; stageKind: StageKind; group?: GroupResult; windows?: readonly { periodId: string; from: string; to: string }[] }
  | { ok: false; reason: string };

export function ageYears(birth: string, at: string): number {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [ay, am, ad] = at.split("-").map(Number);
  return ay! - by! - (am! < bm! || (am === bm && ad! < bd!) ? 1 : 0);
}

export function resolveStageFlow(i: StageFlowInput): StageFlow {
  if (!i.stageKind) return { ok: false, reason: "etapa-nao-declarada" };
  if (!i.birthDate) return { ok: false, reason: "nascimento-ausente" };
  const homologated = i.rule && i.rule.homologatedBy ? i.rule : null;
  const age = ageYears(i.birthDate, i.referenceDate);
  if (i.requesterKind === "estudante-adulto") {
    if (!homologated || homologated.selfRepresentationAgeYears == null) return { ok: false, reason: "sem-regra-de-autorrepresentacao" };
    if (age < homologated.selfRepresentationAgeYears) return { ok: false, reason: "estudante-nao-autorrepresentavel" };
  }
  if (i.stageKind === "educacao-infantil") {
    if (i.requesterKind === "estudante-adulto") return { ok: false, reason: "etapa-incompativel-com-requerente" };
    const group = classifyChild(i.birthDate, i.eiRules ?? [], i.referenceDate);
    if (group.status !== "ok") return { ok: false, reason: `ei-${group.status}` };
    return { ok: true, stageKind: "educacao-infantil", group };
  }
  if (i.stageKind === "eja") {
    if (!homologated || homologated.ejaMinAgeYears == null) return { ok: false, reason: "sem-regra-de-idade-eja" };
    if (age < homologated.ejaMinAgeYears) return { ok: false, reason: "abaixo-da-idade-eja" };
  }
  if (!i.offer) return { ok: false, reason: "oferta-ausente" };
  if (i.stageKind === "eja" && i.offer.regime !== "semestral" && i.offer.regime !== "anual") return { ok: false, reason: "regime-nao-declarado" };
  const w = periodWindows(i.offer, i.calendar ?? null);
  if (!w.ok) return { ok: false, reason: w.reason };
  return { ok: true, stageKind: i.stageKind, windows: w.windows };
}
