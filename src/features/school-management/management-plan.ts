// SIGEM 2.0 — Direção, Lote 09: plano de gestão, PPP, agenda e documentos institucionais (núcleo puro).
// Versões append-only com base esperada; validação/aprovação por pessoa distinta da autora e com capacidade;
// GED, numeração, assinatura e PDF A4 continuam em document-studio/ged-core e report-engine.

export interface PlanAction { id: string; description: string; responsibleEngagementId: string | null; due: string | null; resources: string | null; indicatorKey: string | null }
export interface PlanGoal { id: string; objective: string; target: string; indicatorKey: string | null; baseline: number | null; actions: PlanAction[] }
export interface PlanVersion { planId: string; version: number; schoolId: string; year: number; diagnosisRefs: string[]; goals: PlanGoal[]; authorId: string; reason: string }

/** Nova versão: base = última, autor humano, motivo, diagnóstico só por referência a achados reais. */
export function recordPlanVersion(chain: PlanVersion[], v: Omit<PlanVersion, "version">, expectedVersion: number, isNaturalPerson: boolean) {
  const head = chain.at(-1)?.version ?? 0;
  if (head !== expectedVersion) return { ok: false as const, code: "plano:base-desatualizada" };
  if (!isNaturalPerson) return { ok: false as const, code: "plano:autor-humano-obrigatorio" };
  if (!v.reason.trim()) return { ok: false as const, code: "plano:motivo-obrigatorio" };
  return { ok: true as const, chain: [...chain, { ...v, version: head + 1 }] };
}

/** Resultado de meta só com indicador lido; sem leitura ⇒ "não apurado", nunca atingido/zero. */
export function goalResult(g: PlanGoal, reading: number | null, targetValue: number | null) {
  if (!g.indicatorKey || reading == null || targetValue == null) return { state: "nao-apurado" as const };
  return { state: reading >= targetValue ? ("atingida" as const) : ("nao-atingida" as const), reading, targetValue, baseline: g.baseline };
}

/** Ações sem responsável ou sem prazo ficam listadas como pendência, nunca recebem valor presumido. */
export function planGaps(v: PlanVersion) {
  return v.goals.flatMap((g) => g.actions.flatMap((a) => [!a.responsibleEngagementId && { action: a.id, gap: "sem responsável" }, !a.due && { action: a.id, gap: "sem prazo" }].filter(Boolean)));
}

// ── PPP: participação e validação real ──
export interface PppVersion { id: string; version: number; participants: { personId: string; segment: string }[]; validations: { by: string; capability: string; on: string }[]; authorId: string }
export function validatePpp(p: PppVersion, by: string, caps: string[], requiredCapability: string | null, on: string) {
  if (!requiredCapability) return { ok: false as const, code: "ppp:rito-de-validacao-nao-homologado" };
  if (!caps.includes(requiredCapability)) return { ok: false as const, code: "ppp:sem-competencia" };
  if (by === p.authorId) return { ok: false as const, code: "ppp:autovalidacao" };
  if (!p.participants.length) return { ok: false as const, code: "ppp:sem-participacao-registrada" };
  if (p.validations.some((x) => x.by === by)) return { ok: true as const, ppp: p, idempotent: true };
  return { ok: true as const, ppp: { ...p, validations: [...p.validations, { by, capability: requiredCapability, on }] }, idempotent: false };
}

// ── Agenda ──
export type AgendaKind = "reuniao" | "conselho" | "visita" | "formacao" | "evento";
export interface AgendaItem { id: string; schoolId: string; kind: AgendaKind; date: string; title: string; tasks: { id: string; engagementId: string; done: boolean }[]; minuteRef: string | null }
/** Conselho na agenda nunca cria sessão nem ata: registro só por referência ao módulo colegiado. */
export function attachRecord(a: AgendaItem, ref: string, refKind: "ata-colegiada" | "registro-simples") {
  if (a.kind === "conselho" && refKind !== "ata-colegiada") return { ok: false as const, code: "agenda:conselho-exige-ata-do-colegiado" };
  return { ok: true as const, item: { ...a, minuteRef: ref } };
}

// ── Documentos institucionais ──
export type DocKind = "ata" | "oficio" | "memorando" | "comunicado" | "relatorio";
export type DocState = "rascunho" | "em-revisao" | "aprovado" | "devolvido";
export interface InstDoc { id: string; kind: DocKind; schoolId: string; authorId: string; version: number; events: { to: DocState; by: string; reason?: string }[] }
const DOC_NEXT: Record<DocState, DocState[]> = { rascunho: ["em-revisao"], "em-revisao": ["aprovado", "devolvido"], devolvido: ["em-revisao"], aprovado: [] };
export const docState = (d: InstDoc): DocState => d.events.at(-1)?.to ?? "rascunho";

/** Aprovação só por competência declarada para o tipo; aprovador ≠ autor; ata exige deliberação registrada; aprovado é imutável. */
export function transitionDoc(d: InstDoc, to: DocState, by: string, caps: string[], approvalCapability: Partial<Record<DocKind, string>>, opts: { reason?: string; deliberationRef?: string } = {}) {
  if (!DOC_NEXT[docState(d)].includes(to)) return { ok: false as const, code: "doc:transicao-invalida" };
  if (to === "aprovado" || to === "devolvido") {
    const need = approvalCapability[d.kind];
    if (!need) return { ok: false as const, code: "doc:competencia-nao-declarada" };
    if (!caps.includes(need)) return { ok: false as const, code: "doc:sem-competencia" };
    if (by === d.authorId) return { ok: false as const, code: "doc:autoaprovacao" };
  }
  if (to === "devolvido" && !opts.reason?.trim()) return { ok: false as const, code: "doc:motivo-obrigatorio" };
  if (to === "aprovado" && d.kind === "ata" && !opts.deliberationRef) return { ok: false as const, code: "doc:ata-sem-deliberacao" };
  return { ok: true as const, doc: { ...d, events: [...d.events, { to, by, ...(opts.reason ? { reason: opts.reason } : {}) }] } as InstDoc };
}

/** Assinatura: só o próprio signatário, só em documento aprovado; simples nunca é rotulada qualificada sem evidência. */
export function sign(d: InstDoc, signerId: string, sessionUserId: string, evidence: { icpBrasil: boolean }) {
  if (signerId !== sessionUserId) return { ok: false as const, code: "assinatura:so-o-proprio-signatario" };
  if (docState(d) !== "aprovado") return { ok: false as const, code: "assinatura:documento-nao-aprovado" };
  return { ok: true as const, signature: { docId: d.id, version: d.version, signerId, level: evidence.icpBrasil ? ("qualificada" as const) : ("simples" as const) } };
}
