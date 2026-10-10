/**
 * R3 — Inspetores de alimentação, amostras com cadeia de custódia e leitura mínima do CAE.
 * Puro: a elegibilidade decide sobre fatos já lidos (atuação vigente + função); nada é
 * atribuído aqui. Sem prova de função/vigência a pessoa não é elegível.
 */
export type Candidate = { personId: string; schoolId: string; functionLabel: string | null; engagementFrom: string | null; engagementUntil: string | null; termSignedAt: string | null };
export const MIN_INSPECTORS = 2;
const COOK = /merend|cozinh|manipulador/i;

export function inspectorEligibility(c: Candidate, on: string) {
  const reasons: string[] = [];
  if (!c.functionLabel) reasons.push("Função não comprovada");
  else if (COOK.test(c.functionLabel)) reasons.push("Merendeiro/manipulador não pode ser inspetor");
  if (!c.engagementFrom || c.engagementFrom > on || (c.engagementUntil && c.engagementUntil < on)) reasons.push("Sem atuação vigente na data");
  if (!c.termSignedAt) reasons.push("Termo de compromisso não assinado");
  return { eligible: reasons.length === 0, reasons };
}

export function schoolInspectionStatus(schoolId: string, designated: readonly Candidate[], on: string) {
  const valid = designated.filter((c) => c.schoolId === schoolId && inspectorEligibility(c, on).eligible);
  return { schoolId, valid: valid.length, state: valid.length >= MIN_INSPECTORS ? ("completa" as const) : ("pendente" as const), missing: Math.max(0, MIN_INSPECTORS - valid.length) };
}

export type CustodyEvent = { kind: "coleta" | "lacre" | "guarda" | "envio" | "recebimento" | "descarte"; at: string; byPersonId: string };
export type Sample = { id: string; schoolId: string; preparation: string; lot: string | null; servedOn: string | null; events: readonly CustodyEvent[] };
const ORDER: CustodyEvent["kind"][] = ["coleta", "lacre", "guarda", "envio", "recebimento", "descarte"];

export function custodyCheck(s: Sample) {
  const issues: string[] = [];
  if (!s.lot) issues.push("Lote não informado");
  if (!s.servedOn) issues.push("Data de preparo não informada");
  if (s.events[0]?.kind !== "coleta") issues.push("Cadeia não começa pela coleta");
  for (let i = 1; i < s.events.length; i++) {
    const a = s.events[i - 1]!, b = s.events[i]!;
    if (b.at < a.at) issues.push(`Evento ${b.kind} anterior a ${a.kind}`);
    if (ORDER.indexOf(b.kind) < ORDER.indexOf(a.kind)) issues.push(`Ordem inválida: ${a.kind} → ${b.kind}`);
  }
  return { ok: issues.length === 0, issues };
}

export function sampleLabel(s: Sample) {
  return [`Amostra ${s.id}`, `Preparação: ${s.preparation}`, `Lote: ${s.lot ?? "não informado"}`, `Preparo: ${s.servedOn ?? "não informado"}`].join("\n");
}

/** CAE: só agregados e situação; nunca restrição, laudo, diagnóstico ou pessoa. Sem autorização de perfil, nada. */
const CAE_FIELDS = ["schoolId", "competence", "mealsServed", "menuPublished", "nonconformities", "inspectionState"] as const;
export function caeView(authorized: boolean, rows: readonly Record<string, unknown>[]) {
  if (!authorized) return { state: "sem-permissao" as const, rows: [] };
  return { state: "ok" as const, rows: rows.map((r) => Object.fromEntries(CAE_FIELDS.map((k) => [k, r[k] ?? null]))) };
}

/** Cardápio e cronograma só entram em revisão nutricional; nunca publicados aqui. */
export function prepareForNutritionReview(menu: { id: string; status?: string }) {
  return { ...menu, status: "em-revisao-nutricional" as const, published: false as const };
}
