/**
 * Família L11–L22 — comunicados, mensagens, reuniões, alimentação, OP, NEI, documentos,
 * atualização cadastral, solicitações, participação/biblioteca, notificações e UX móvel.
 * Núcleos puros: pedido da família vira protocolo para a escola; nunca altera fato oficial.
 */
import type { FamilySection } from "./family-portal";

// ---------- L11 comunicados segmentados ----------
export interface Notice { id: string; audience: { schools: string[] | "rede"; classes: string[] | null }; publishedAt: string | null; cancelled: boolean }
export function noticesFor(n: readonly Notice[], ctx: { school: string; classId: string | null; publishedOnOrBefore: string }) {
  return n.filter((x) => x.publishedAt && x.publishedAt <= ctx.publishedOnOrBefore && !x.cancelled
    && (x.audience.schools === "rede" || x.audience.schools.includes(ctx.school))
    && (x.audience.classes === null || (ctx.classId !== null && x.audience.classes.includes(ctx.classId))));
}

// ---------- L12 mensagens ----------
export function validateMessage(text: string): string[] {
  const e: string[] = [];
  if (!text.trim() || text.length > 2000) e.push("Mensagem vazia ou longa demais.");
  if (/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(text)) e.push("Não envie CPF por mensagem.");
  return e;
}
/** Mensagem vai para a caixa institucional da escola, nunca para conta pessoal de servidor. */
export const messageRecipient = (school: string) => ({ kind: "caixa-institucional" as const, school });

// ---------- L13 reuniões e atendimentos ----------
export interface Slot { id: string; start: string; capacity: number; booked: number }
export function canBook(s: Slot, now: string): string | null {
  if (s.start <= now) return "Horário já passou.";
  if (s.booked >= s.capacity) return "Horário sem vaga.";
  return null;
}

// ---------- L14 alimentação ----------
export interface MenuDay { date: string; items: string[]; published: boolean }
export const familyMenu = (m: readonly MenuDay[]) => m.filter((d) => d.published);
/** Necessidade alimentar segue pela declaração de saúde (NFAM.2): canal privado, nunca mensagem comum. */
export const dietaryChannel = () => ({ via: "record_family_health_declaration" as const, requiresSection: "saude" as FamilySection });

// ---------- L15 OP / L16 NEI ----------
export interface Guidance { source: "op" | "nei"; text: string; sharedWithFamily: boolean; clinical: boolean }
/** Só conteúdo marcado para partilha; conteúdo clínico nunca sai do NEI. */
export const familyGuidance = (g: readonly Guidance[]) => g.filter((x) => x.sharedWithFamily && !x.clinical).map(({ source, text }) => ({ source, text }));

// ---------- L17 documentos / L19 solicitações ----------
export const REQUEST_KINDS = ["declaracao-de-matricula", "historico-escolar", "transferencia", "segunda-via-carteirinha", "atualizacao-cadastral", "atendimento", "outro"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export interface FamilyRequest { kind: RequestKind; studentId: string; text: string; idempotencyKey: string }
export function validateRequest(r: FamilyRequest): string[] {
  const e: string[] = [];
  if (!REQUEST_KINDS.includes(r.kind)) e.push("Tipo de solicitação desconhecido.");
  if (r.idempotencyKey.length < 16) e.push("Chave de envio inválida.");
  if (r.kind === "outro" && !r.text.trim()) e.push("Descreva a solicitação.");
  return e;
}
export type RequestEvent = { seq: number; kind: "aberta" | "em-analise" | "atendida" | "indeferida" | "cancelada"; reason: string | null };
/** Estado é projeção do ledger; indeferimento exige motivo; seq contínuo. */
export function requestState(ev: readonly RequestEvent[]) {
  const ok = ev.every((e, i) => e.seq === i + 1) && ev[0]?.kind === "aberta" && ev.every((e) => e.kind !== "indeferida" || !!e.reason);
  return ok ? ev.at(-1)!.kind : ("inconsistente" as const);
}

// ---------- L18 atualização cadastral ----------
export const UPDATABLE_FIELDS = ["telefone", "endereco", "contato-de-emergencia", "nome-social"] as const;
export function cadastralUpdate(field: string, value: string) {
  if (!(UPDATABLE_FIELDS as readonly string[]).includes(field)) return { ok: false as const, reason: "Campo só alterável pela Secretaria com documento." };
  if (!value.trim()) return { ok: false as const, reason: "Informe o novo valor." };
  return { ok: true as const, effect: "pedido-para-validacao" as const, appliesImmediately: false };
}

// ---------- L20 participação / biblioteca ----------
export interface Material { title: string; published: boolean; audience: "familias" | "interno" }
export const familyLibrary = (m: readonly Material[]) => m.filter((x) => x.published && x.audience === "familias");

// ---------- L21 notificações ----------
export interface Pref { category: string; optional: boolean; enabled: boolean }
export const shouldNotify = (p: Pref | undefined, mandatory: boolean) => mandatory || (p?.enabled ?? true);
/** Texto externo (push/SMS) é genérico: nunca nome, nota, frequência ou saúde. */
export const externalSummary = () => "Há uma nova informação da escola no SIGEM Família.";

// ---------- L22 UX móvel e baixo consumo ----------
export const MOBILE_BUDGET = { pageSize: 20, imageMaxKb: 150, offlineCache: false } as const;
export const pageOf = <T,>(rows: readonly T[], page: number) => rows.slice(page * MOBILE_BUDGET.pageSize, (page + 1) * MOBILE_BUDGET.pageSize);
