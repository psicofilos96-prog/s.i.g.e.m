/**
 * B4.6.10 — Calendário central (Lovable Cloud) por trás dos comandos do editor original.
 *
 * - Ler: `calendar_network_sources_at` (instante do servidor) → `calendar_list_at` → `calendar_presentation_at`; o
 *   calendário do editor vem do snapshot imutável da versão (`presentation.editorCalendar`). Erro de leitura é erro
 *   visível, nunca troca silenciosa por cópia local.
 * - Salvar: `save_network_calendar` (uma transação sobre os writers existentes), com a versão-base esperada; outra
 *   versão no meio ⇒ conflito por extenso.
 * - Homologar: `homologate_network_calendar` (norma exclusiva + homologação da versão), com a última decisão esperada.
 * - Dias e efeitos vêm do motor do editor (`resolveCalendar` via `buildImportPlan`): NULL de efeito permanece NULL.
 */
import { supabase } from "@/integrations/supabase/client";
import { buildImportPlan, sha256Hex } from "./calendar-browser-import";
import { CalendarWriteRefused, writeRefusalText } from "./institutional-calendar-writers";
import type { NetworkCalendar } from "./calendar-types";

export type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
const defaultRpc: Rpc = (fn, args) => supabase.rpc(fn as "calendar_list_at", args as never) as never;

export type CentralHomologation = { recordId: string; sequence: number; decision: "homologada" | "revogada"; effectiveFrom: string };
export type CentralVersion = { versionId: string; version: number; validFrom: string; recordedAt: string; actId: string; lastHomologation: CentralHomologation | null };
export type CentralEntry = {
  sourceKey: string; calendarId: string; latest: CentralVersion;
  /** Última versão homologada (pode ser anterior à última versão salva). */
  homologated: CentralVersion | null;
  history: CentralVersion[];
  calendar: NetworkCalendar;
  pendingContext: string | null;
};
export type CentralRead =
  | { kind: "acesso-negado" }
  | { kind: "lido"; audience: "construcao" | "homologados"; knownAt: string; entries: CentralEntry[] };

export class CentralReadError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

async function rpcCall(rpc: Rpc, fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new CentralReadError(`Leitura do banco falhou (${fn}): ${error.message ?? "erro"}`);
  return data;
}

/** Contrato fechado: decisão só "homologada" ou "revogada"; qualquer outra coisa é recusada, nunca inferida. */
function parseHomologation(h: unknown): CentralHomologation | null {
  if (h === null || h === undefined) return null;
  if (!isObj(h)) throw new CentralReadError("Resposta inesperada do banco (homologação).");
  const decision = h["decision"];
  if (decision !== "homologada" && decision !== "revogada") throw new CentralReadError(`Situação de homologação desconhecida no banco: ${String(decision)}.`);
  return { recordId: String(h["recordId"]), sequence: Number(h["sequence"]), decision, effectiveFrom: String(h["effectiveFrom"]) };
}

function parseVersion(v: Record<string, unknown>): CentralVersion {
  const h = v["lastHomologation"];
  return {
    versionId: String(v["versionId"]), version: Number(v["version"]), validFrom: String(v["validFrom"]), recordedAt: String(v["recordedAt"]), actId: String(v["actId"]),
    lastHomologation: parseHomologation(h),
  };
}

/** Lê o calendário central visível para a conta (construção: todas as versões; demais: só homologadas). */
export async function readCentralCalendars(rpc: Rpc = defaultRpc): Promise<CentralRead> {
  const src = await rpcCall(rpc, "calendar_network_sources_at", { _known_at: null });
  if (!isObj(src) || src["contract"] !== "b4.6.10/1") throw new CentralReadError("Resposta inesperada do banco (fontes).");
  if (src["state"] === "access-denied") return { kind: "acesso-negado" };
  const knownAt = String(src["knownAt"]);
  const audience = src["audience"] === "construcao" ? "construcao" : "homologados";
  const sources = Array.isArray(src["sources"]) ? (src["sources"] as Record<string, unknown>[]) : [];
  if (!sources.length) return { kind: "lido", audience, knownAt, entries: [] };
  const list = await rpcCall(rpc, "calendar_list_at", { _known_at: knownAt });
  if (!isObj(list) || list["state"] !== "lido" || !Array.isArray(list["versions"])) throw new CentralReadError("Resposta inesperada do banco (versões).");
  const versions = (list["versions"] as Record<string, unknown>[]);
  const entries: CentralEntry[] = [];
  for (const s of sources) {
    const calendarId = String(s["calendarId"]);
    const mine = versions.filter((v) => v["calendarId"] === calendarId).map(parseVersion).sort((a, b) => a.version - b.version);
    if (!mine.length) continue;
    const homologated = [...mine].reverse().find((v) => v.lastHomologation?.decision === "homologada") ?? null;
    // Construção abre a última versão salva; consulta abre só a homologada.
    const shown = audience === "construcao" ? mine[mine.length - 1]! : homologated;
    if (!shown) continue;
    const pr = await rpcCall(rpc, "calendar_presentation_at", { _version_id: shown.versionId, _on: shown.validFrom, _known_at: knownAt });
    if (!isObj(pr) || pr["state"] !== "lido" || !isObj(pr["snapshot"])) throw new CentralReadError("A apresentação salva da versão não pôde ser lida.");
    const presentation = (pr["snapshot"] as Record<string, unknown>)["presentation"];
    const editor = isObj(presentation) ? presentation["editorCalendar"] : null;
    if (!isObj(editor) || typeof editor["id"] !== "string") throw new CentralReadError("A versão salva não contém o calendário do editor.");
    const cal = editor as unknown as NetworkCalendar;
    entries.push({
      sourceKey: String(s["sourceKey"]), calendarId, latest: mine[mine.length - 1]!, homologated, history: mine,
      calendar: audience === "construcao" ? cal : { ...cal, status: "homologado", homologatedAt: shown.lastHomologation?.effectiveFrom, homologatedBy: "Supervisão Escolar" },
      pendingContext: null,
    });
  }
  return { kind: "lido", audience, knownAt, entries };
}

/** Monta o pedido de gravação a partir do calendário do editor (dias resolvidos pelo motor do editor). */
export const REFERENCE_SOURCE_NOTE =
  "Calendário 2027 registrado no código-fonte do projeto, reconhecido pelo usuário como o calendário real (decisão expressa de 2026-10-04).";

export function buildCentralPayload(cal: NetworkCalendar, p: { sourceKind: "referencia-codigo" | "importacao-navegador" | "edicao-institucional"; actRef: string; reason: string | null; digest: string }) {
  const plan = buildImportPlan(cal);
  return {
    year: cal.year, title: cal.title, actRef: p.actRef, reason: p.reason,
    periods: cal.periods.map((x) => ({ key: x.id, name: x.name, start: x.start, end: x.end })),
    dayTypes: plan.types.map((t) => ({ code: t.code, label: t.label, effect: t.countsAsSchoolDay, councilRole: t.councilRole })),
    days: plan.days.map((d) => ({ day: d.day, code: d.code })),
    events: plan.days.filter((d) => d.label).map((d) => ({ starts_on: d.day, ends_on: d.day, label: d.label, code: d.code })),
    sourceKind: p.sourceKind,
    ...(p.sourceKind === "referencia-codigo" ? { declaredByUserNote: REFERENCE_SOURCE_NOTE } : {}),
    sourceEntryId: cal.id, digest: p.digest, raw: cal,
    presentation: { ...plan.presentation, contract: "b4.6.10/editor-1", editorCalendar: cal },
  };
}

export const CENTRAL_ERROR_TEXT: Record<string, string> = {
  "calendar:base-superseded": "Outra versão foi salva no banco depois que você abriu este calendário. Recarregue a página para ver a versão mais recente antes de salvar. Nada foi gravado no banco.",
  "calendar-homologation:base-superseded": "A situação de homologação mudou no banco enquanto a página estava aberta. Recarregue antes de homologar.",
  "calendar-homologation:repeated-decision": "Esta versão já está homologada.",
};
export function centralErrorText(e: unknown): string {
  const raw = e instanceof CalendarWriteRefused ? e.code : e instanceof Error ? e.message : String(e);
  const code = Object.keys(CENTRAL_ERROR_TEXT).find((k) => raw.includes(k));
  if (code) return CENTRAL_ERROR_TEXT[code]!;
  const text = CENTRAL_REFUSAL_TEXT.find(([k]) => raw.includes(k))?.[1] ?? (e instanceof CalendarWriteRefused ? e.message : writeRefusalText(raw));
  // Recusa sem tradução: o motivo técnico aparece por extenso, nunca escondido atrás de texto genérico.
  return text.startsWith("O registro não foi aceito") ? `${text} Motivo informado pelo sistema: ${raw}` : text;
}

const CENTRAL_REFUSAL_TEXT: ReadonlyArray<readonly [string, string]> = [
  ["period:overlap", "Os períodos deste calendário se sobrepõem a períodos já salvos para ele. Nada foi gravado."],
  ["calendar:period-outside-organization", "Um período pertence a outro calendário. Nada foi gravado."],
  ["period:invalid-dates", "Um período termina antes de começar. Nada foi gravado."],
  ["period:outside-year", "Um período está fora do ano letivo. Nada foi gravado."],
  ["calendar:reference-content-outside-year", "Há dias marcados fora do ano letivo. Nada foi gravado."],
];

async function write(rpc: Rpc, fn: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new CalendarWriteRefused(String(error.message ?? "erro"));
  if (!isObj(data)) throw new CalendarWriteRefused("resposta-inesperada");
  return data;
}

/** Ato truthful: comando do editor exercido pela conta autenticada; o setor/autoria é a atuação gravada no próprio ato (recorded_via_engagement_id), nunca texto fixo (BQ.0: o texto fixo atribuía à Supervisão atos do Administrador Geral). */
export const editorActRef = (verb: "Salvar" | "Homologar", at = new Date()) =>
  `Comando “${verb}” do editor do calendário exercido pela conta autenticada em ${at.toISOString()} (autoria: atuação registrada no próprio ato)`;

export async function saveCentralCalendar(p: {
  cal: NetworkCalendar; sourceKey: string; expectedBaseVersionId: string | null;
  sourceKind: "referencia-codigo" | "importacao-navegador" | "edicao-institucional"; reason: string | null;
  /** Ausente: o banco preserva a aplicabilidade da versão-base. Lista (mesmo vazia): substitui a declaração. */
  applicability?: ApplicabilityScope[];
}, rpc: Rpc = defaultRpc) {
  const digest = await sha256Hex(JSON.stringify(p.cal));
  const payload = buildCentralPayload(p.cal, { sourceKind: p.sourceKind, actRef: editorActRef("Salvar"), reason: p.reason, digest });
  const body = p.applicability ? { ...payload, applicability: p.applicability } : payload;
  const r = await write(rpc, "save_network_calendar", { _source_key: p.sourceKey, _expected_base_version_id: p.expectedBaseVersionId, _payload: body });
  return { calendarId: String(r["calendarId"]), versionId: String(r["versionId"]), version: Number(r["version"]) };
}

export async function homologateCentralCalendar(p: { versionId: string; expectedLastHomologationId: string | null }, rpc: Rpc = defaultRpc) {
  const r = await write(rpc, "homologate_network_calendar", {
    _version_id: p.versionId, _expected_last_homologation_id: p.expectedLastHomologationId, _act_ref: editorActRef("Homologar"), _reason: null,
  });
  return { recordId: String(r["recordId"]), sequence: Number(r["sequence"]) };
}

// ---- Aplicabilidade declarada (B4.6.10): só opções reais do banco; nada sugerido nem inferido. ----
export type ApplicabilityCondition = {
  kind: "escola" | "valor-de-eixo" | "alocacao" | "posicao-curricular";
  school_id?: string | null; scheme_id?: string | null; value_id?: string | null; value_version?: number | null;
  allocation_logical_id?: string | null; position_logical_id?: string | null;
};
export type ApplicabilityScope = { scope_key: string; label: string | null; window_from: string; window_until: string; conditions: ApplicabilityCondition[] };
export type ApplicabilityOptions = {
  schools: { schoolId: string; name: string; active: boolean }[];
  axisValues: { schemeId: string; valueId: string; version: number; label: string }[];
  pending: string | null;
  scopes: ApplicabilityScope[];
};

export async function readApplicabilityOptions(versionId: string, rpc: Rpc = defaultRpc): Promise<ApplicabilityOptions | "acesso-negado"> {
  const d = await rpcCall(rpc, "calendar_applicability_options_at", { _version_id: versionId });
  if (!isObj(d) || d["contract"] !== "b4.6.10/aplicabilidade-1") throw new CentralReadError("Resposta inesperada do banco (aplicabilidade).");
  if (d["state"] === "access-denied") return "acesso-negado";
  const arr = (k: string) => (Array.isArray(d[k]) ? (d[k] as unknown[]) : []);
  return {
    schools: arr("schools") as ApplicabilityOptions["schools"],
    axisValues: arr("axisValues") as ApplicabilityOptions["axisValues"],
    pending: typeof d["pending"] === "string" ? d["pending"] : null,
    scopes: (arr("scopes") as ApplicabilityScope[]).map((s) => ({ ...s, conditions: s.conditions ?? [] })),
  };
}

/** Referência padrão quando a base é a decisão do proprietário: o campo continua editável, mas nunca exige ato externo. */
export const OWNER_DECISION_ACT_REF = "Decisão do proprietário do SIGEM";
