/**
 * Rede/Matrículas/Vagas L06 — Processos (campanhas) de matrícula.
 * Tipos: matrícula inicial, renovação, pré-matrícula, transferência, espera (lista aberta por configuração).
 * Campanha = versões append-only (edital, público, período, escolas, critérios, documentos) +
 * ledger de estado rascunho → revisão → autorizada → publicada → encerrada (devolução → rascunho).
 * Sem regra local presumida: critério só por referência a versão homologada; documento só do catálogo;
 * nenhum default de prazo, público ou critério. Conteúdo muda só em rascunho, como nova versão.
 */
export interface CampaignContent {
  kind: string; editalRef: string | null; audience: readonly string[]; // IDs de público homologados
  periodFrom: string; periodTo: string; schoolIds: readonly string[];
  criteria: { criterionId: string; version: number } | null; documentIds: readonly string[];
}
export interface CampaignVersion { campaignId: string; version: number; content: CampaignContent; authorPersonId: string; reason: string; at: string }
export type CampaignState = "rascunho" | "revisao" | "autorizada" | "publicada" | "encerrada";
export type CampaignAction = "enviar-revisao" | "devolver" | "autorizar" | "publicar" | "encerrar";
export interface CampaignEvent { campaignId: string; seq: number; action: CampaignAction; to: CampaignState; onVersion: number; personId: string; reason: string; actRef: string | null; at: string }

export interface Catalogs {
  kinds: readonly string[]; audiences: readonly string[]; documents: readonly string[];
  criteria: readonly { criterionId: string; version: number; homologated: boolean; kinds: readonly string[] }[];
  /** escolas cuja oferta está publicada/em funcionamento (L02) no período */ schoolsWithOffer: readonly string[];
}
export interface CActor { personId: string | null; isHuman: boolean; isTechnicalExecutor?: boolean; capabilities: readonly string[] }
export type CampaignCompetence = Partial<Record<CampaignAction | "redigir", string>>;
/** Tipos que, por decisão homologada, exigem critério de prioridade (ex.: espera). Vem de configuração. */
export interface CampaignPolicy { kindsRequiringCriteria: readonly string[]; kindsRequiringEdital: readonly string[] }

const lastOf = (ev: readonly CampaignEvent[], a: CampaignAction) => [...ev].reverse().find((e) => e.action === a);
type R<T> = { ok: true; value: T } | { ok: false; reason: string; issues?: string[] };
const human = (a: CActor) => a.isHuman && !!a.personId && !a.isTechnicalExecutor;
const gate = (a: CActor, cap: string | undefined, what: string): string | null =>
  !human(a) ? "Exige pessoa natural; executor técnico não atua em campanha." : !cap ? `Competência para "${what}" não configurada.` : !a.capabilities.includes(cap) ? `Falta a capacidade ${cap}.` : null;

export function contentIssues(c: CampaignContent, cat: Catalogs, pol: CampaignPolicy): string[] {
  const out: string[] = [];
  if (!cat.kinds.includes(c.kind)) out.push(`Tipo "${c.kind}" não configurado.`);
  if (c.periodTo < c.periodFrom) out.push("Período inválido.");
  if (c.schoolIds.length === 0) out.push("Nenhuma escola.");
  for (const s of c.schoolIds) if (!cat.schoolsWithOffer.includes(s)) out.push(`Escola ${s} sem oferta publicada no período.`);
  if (c.audience.length === 0) out.push("Público não declarado.");
  for (const a of c.audience) if (!cat.audiences.includes(a)) out.push(`Público ${a} fora do catálogo.`);
  for (const d of c.documentIds) if (!cat.documents.includes(d)) out.push(`Documento ${d} fora do catálogo.`);
  if (pol.kindsRequiringEdital.includes(c.kind) && !c.editalRef?.trim()) out.push("Edital obrigatório para este tipo.");
  if (c.criteria) {
    const cr = cat.criteria.find((x) => x.criterionId === c.criteria!.criterionId && x.version === c.criteria!.version);
    if (!cr) out.push("Critério não encontrado.");
    else { if (!cr.homologated) out.push("Critério não homologado."); if (!cr.kinds.includes(c.kind)) out.push("Critério não se aplica a este tipo."); }
  } else if (pol.kindsRequiringCriteria.includes(c.kind)) out.push("Critério homologado obrigatório para este tipo.");
  return out;
}

export const campaignState = (ev: readonly CampaignEvent[]): CampaignState => ev.at(-1)?.to ?? "rascunho";

export function writeVersion(campaignId: string, versions: readonly CampaignVersion[], events: readonly CampaignEvent[], content: CampaignContent, actor: CActor,
  input: { reason: string; at: string; expectedVersion: number }, comp: CampaignCompetence): R<CampaignVersion> {
  const g = gate(actor, comp.redigir, "redigir"); if (g) return { ok: false, reason: g };
  if (campaignState(events) !== "rascunho") return { ok: false, reason: "Conteúdo só muda em rascunho; publicada exige nova campanha ou devolução." };
  const last = versions.filter((v) => v.campaignId === campaignId).at(-1)?.version ?? 0;
  if (input.expectedVersion !== last) return { ok: false, reason: "Base desatualizada." };
  if (!input.reason.trim()) return { ok: false, reason: "Motivo obrigatório." };
  return { ok: true, value: { campaignId, version: last + 1, content, authorPersonId: actor.personId!, reason: input.reason.trim(), at: input.at } };
}

const FLOW: Record<CampaignAction, { from: CampaignState; to: CampaignState }> = {
  "enviar-revisao": { from: "rascunho", to: "revisao" }, devolver: { from: "revisao", to: "rascunho" },
  autorizar: { from: "revisao", to: "autorizada" }, publicar: { from: "autorizada", to: "publicada" }, encerrar: { from: "publicada", to: "encerrada" },
};

export function actOnCampaign(campaignId: string, versions: readonly CampaignVersion[], events: readonly CampaignEvent[], action: CampaignAction, actor: CActor,
  input: { reason: string; at: string; expectedSeq: number; actRef?: string | null | undefined }, comp: CampaignCompetence, cat: Catalogs, pol: CampaignPolicy): R<CampaignEvent> {
  const g = gate(actor, comp[action], action); if (g) return { ok: false, reason: g };
  const last = events.at(-1)?.seq ?? 0;
  if (input.expectedSeq !== last) return { ok: false, reason: "Base desatualizada." };
  if (FLOW[action].from !== campaignState(events)) return { ok: false, reason: `"${action}" não admitida em ${campaignState(events)}.` };
  if (!input.reason.trim()) return { ok: false, reason: "Motivo obrigatório." };
  const v = versions.filter((x) => x.campaignId === campaignId).at(-1);
  if (!v) return { ok: false, reason: "Campanha sem conteúdo." };
  if (action === "enviar-revisao" || action === "autorizar" || action === "publicar") {
    const issues = contentIssues(v.content, cat, pol);
    if (issues.length) return { ok: false, reason: "Pendências impedem.", issues };
  }
  if (action === "autorizar") {
    if (!input.actRef?.trim()) return { ok: false, reason: "Autorização exige ato." };
    const authors = versions.filter((x) => x.campaignId === campaignId).map((x) => x.authorPersonId);
    if (authors.includes(actor.personId!)) return { ok: false, reason: "Quem redigiu não autoriza." };
  }
  if (action === "publicar" && lastOf(events, "autorizar")?.onVersion !== v.version) return { ok: false, reason: "Versão publicada difere da autorizada." };
  return { ok: true, value: { campaignId, seq: last + 1, action, to: FLOW[action].to, onVersion: v.version, personId: actor.personId!, reason: input.reason.trim(), actRef: input.actRef?.trim() || null, at: input.at } };
}

/** Campanha aceita pedido só publicada, no período, para escola e tipo declarados. Devolve a versão publicada. */
export function campaignAccepts(versions: readonly CampaignVersion[], events: readonly CampaignEvent[], kind: string, schoolId: string, on: string): { ok: boolean; version: number | null; reason?: string } {
  if (campaignState(events) !== "publicada") return { ok: false, version: null, reason: "Campanha não publicada." };
  const pubV = lastOf(events, "publicar")!.onVersion;
  const c = versions.find((v) => v.version === pubV)!.content;
  if (c.kind !== kind) return { ok: false, version: pubV, reason: "Tipo diferente." };
  if (!c.schoolIds.includes(schoolId)) return { ok: false, version: pubV, reason: "Escola fora da campanha." };
  if (on < c.periodFrom || on > c.periodTo) return { ok: false, version: pubV, reason: "Fora do período." };
  return { ok: true, version: pubV };
}

/** Documentos exigidos vêm só da versão publicada; pendência não bloqueia direito, só é listada. */
export function missingDocuments(versions: readonly CampaignVersion[], events: readonly CampaignEvent[], delivered: readonly string[]): string[] | null {
  const pub = lastOf(events, "publicar"); if (!pub) return null;
  return versions.find((v) => v.version === pub.onVersion)!.content.documentIds.filter((d) => !delivered.includes(d));
}
