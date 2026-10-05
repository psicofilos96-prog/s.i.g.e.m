/**
 * R5 — Fonte TS dos fatos E1–E4 (homologação de versão de matriz, perfil de
 * correspondência, correspondência posição→matriz e associação específica).
 *
 * - Escrita: SOMENTE os 7 RPCs canônicos (0059/0060). Nenhum INSERT de tabela.
 * - Leitura: readers bitemporais com validOn/knownAt explícitos; ledgers e
 *   versões só nas tabelas que a RLS libera a contas vinculadas.
 * - Capability na tela é UX; o banco é a autoridade. Sem capability de rede
 *   efetiva ⇒ nenhuma ação (fail closed), inclusive quando a política que a
 *   declara ainda está em rascunho.
 * - Nada aqui conhece etapa, jornada, natureza ou posição: esquemas e valores
 *   vêm de catálogos homologados; efeitos de portão são os do contrato SQL.
 */
import { supabase } from "@/integrations/supabase/client";
import type { EffectiveCapability } from "@/features/authority/session-authority";

export type R5Kind = "matrix" | "profile" | "correspondence" | "association";

export const R5_CAPABILITIES = {
  maintainMatrix: "manter-matrizes-curriculares",
  homologateMatrix: "homologar-matrizes-curriculares",
  maintainProfile: "manter-perfis-correspondencia-curricular",
  homologateProfile: "homologar-perfis-correspondencia-curricular",
  maintainCorrespondence: "manter-correspondencias-posicao-matriz",
  homologateCorrespondence: "homologar-correspondencias-posicao-matriz",
  maintainAssociation: "manter-associacoes-especificas-matriz",
  homologateAssociation: "homologar-associacoes-especificas-matriz",
} as const;

const HOMOLOGATE_CAP: Record<R5Kind, string> = {
  matrix: R5_CAPABILITIES.homologateMatrix,
  profile: R5_CAPABILITIES.homologateProfile,
  correspondence: R5_CAPABILITIES.homologateCorrespondence,
  association: R5_CAPABILITIES.homologateAssociation,
};
const MAINTAIN_CAP: Record<Exclude<R5Kind, "matrix">, string> = {
  profile: R5_CAPABILITIES.maintainProfile,
  correspondence: R5_CAPABILITIES.maintainCorrespondence,
  association: R5_CAPABILITIES.maintainAssociation,
};
export const HOMOLOGATE_RPC: Record<R5Kind, string> = {
  matrix: "homologate_curricular_matrix_version",
  profile: "homologate_correspondence_profile_version",
  correspondence: "homologate_position_matrix_correspondence_version",
  association: "homologate_class_specific_matrix_association_version",
};

/** Rede = capacidade efetiva sem escopo de escola/turma/período/componente. */
export const hasNetworkCapability = (caps: readonly EffectiveCapability[], capabilityId: string) =>
  caps.some((c) => c.capabilityId === capabilityId && c.schoolId === null && c.classId === null && c.periodId === null && c.componentId === null);
export const canHomologate = (caps: readonly EffectiveCapability[], kind: R5Kind) => hasNetworkCapability(caps, HOMOLOGATE_CAP[kind]);
export const canMaintain = (caps: readonly EffectiveCapability[], kind: Exclude<R5Kind, "matrix">) => hasNetworkCapability(caps, MAINTAIN_CAP[kind]);
export const homologateCapabilityOf = (kind: R5Kind) => HOMOLOGATE_CAP[kind];
export const maintainCapabilityOf = (kind: Exclude<R5Kind, "matrix">) => MAINTAIN_CAP[kind];

export const POLICY_PENDING_NOTE =
  "Esta operação depende de capacidade declarada numa versão da política de capacidades. Enquanto essa versão não for homologada por ato institucional, a operação aguarda a homologação da política e fica indisponível. Esta tela não homologa a política.";

export type R5ReadContext = { validOn: string; knownAt: string };
function requireCtx(c: R5ReadContext | null | undefined): R5ReadContext {
  if (!c || !c.validOn || !c.knownAt) throw new Error("r5:context-required");
  return c;
}

type Row = Record<string, unknown>;
type RpcResult = { data: unknown; error: { message: string } | null };
export type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
const defaultRpc: RpcFn = (fn, args) => (supabase.rpc as unknown as RpcFn)(fn, args);
const s = (v: unknown) => (v === null || v === undefined ? null : String(v));

// ---------------------------------------------------------------------------
// Ledger de homologação (comum a E1–E4)
// ---------------------------------------------------------------------------
export type HomologationEntry = {
  id: string; sequence: number; decision: "homologada" | "revogada"; effectiveFrom: string;
  actRef: string; reason: string | null; recordedAt: string; supersedesId: string | null;
};
export type HomologationHead = { headId: string | null; state: "sem-homologacao" | "homologada" | "revogada" };

export function mapLedgerRow(r: Row): HomologationEntry {
  const d = r["decision"];
  if (d !== "homologada" && d !== "revogada") throw new Error("r5:unknown-decision");
  return {
    id: String(r["homologation_id"] ?? r["id"]), sequence: Number(r["sequence"]), decision: d,
    effectiveFrom: String(r["effective_from"]), actRef: String(r["homologation_act_ref"]), reason: s(r["reason"]),
    recordedAt: String(r["recorded_at"] ?? r["created_at"]), supersedesId: s(r["supersedes_id"]),
  };
}

/** Cabeça = maior sequência. Sequências repetidas ⇒ cadeia ambígua (falha fechada). */
export function ledgerHead(entries: readonly HomologationEntry[]): HomologationHead {
  if (entries.length === 0) return { headId: null, state: "sem-homologacao" };
  const sorted = [...entries].sort((a, b) => b.sequence - a.sequence);
  if (sorted.length > 1 && sorted[0]!.sequence === sorted[1]!.sequence) throw new Error("r5:ambiguous-chain");
  return { headId: sorted[0]!.id, state: sorted[0]!.decision };
}

const LEDGER: Record<Exclude<R5Kind, "matrix">, { table: string; col: string }> = {
  profile: { table: "curricular_correspondence_profile_homologations", col: "profile_version_id" },
  correspondence: { table: "curricular_position_matrix_correspondence_homologations", col: "correspondence_version_id" },
  association: { table: "class_specific_matrix_association_homologations", col: "association_version_id" },
};

type FromFn = (t: string) => {
  select: (c: string) => {
    in: (c: string, v: string[]) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: Row[] | null; error: { message: string } | null }> };
  };
};
const from = (t: string) => (supabase.from as unknown as FromFn)(t);

/** E1 usa o reader de histórico; E2–E4 leem o ledger liberado pela RLS. */
export async function loadLedger(kind: R5Kind, versionId: string, knownAt: string, rpc: RpcFn = defaultRpc): Promise<HomologationEntry[]> {
  if (kind === "matrix") {
    if (!knownAt) throw new Error("r5:context-required");
    const { data, error } = await rpc("curricular_matrix_homologation_history", { _version_id: versionId, _known_at: knownAt });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[]).map(mapLedgerRow).sort((a, b) => a.sequence - b.sequence);
  }
  const l = LEDGER[kind];
  const { data, error } = await from(l.table).select("id, sequence, decision, effective_from, homologation_act_ref, reason, created_at, supersedes_id")
    .in(l.col, [versionId]).order("sequence", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).filter((r) => String(r["created_at"]) <= knownAt).map(mapLedgerRow);
}

export type HomologationInput = {
  versionId: string; expectedHeadId: string | null; decision: "homologada" | "revogada";
  effectiveFrom: string; actRef: string; reason: string | null;
};

/** Validação local espelha o contrato; o banco revalida tudo. */
export function validateHomologation(i: HomologationInput, head: HomologationHead): string | null {
  if (!i.effectiveFrom) return "effective-from-required";
  if (!i.actRef.trim()) return "act-required";
  if (i.decision === "homologada" && head.state === "homologada") return "already-homologated";
  if (i.decision === "revogada" && head.state !== "homologada") return "nothing-to-revoke";
  if ((head.headId !== null || i.decision === "revogada") && !(i.reason ?? "").trim()) return "reason-required";
  return null;
}
export const reasonRequired = (decision: "homologada" | "revogada", head: HomologationHead) => head.headId !== null || decision === "revogada";

export function homologationPayload(i: HomologationInput): Record<string, unknown> {
  return {
    _version_id: i.versionId, _expected_head_id: i.expectedHeadId, _decision: i.decision,
    _effective_from: i.effectiveFrom, _act_ref: i.actRef.trim(), _reason: (i.reason ?? "").trim() || null,
  };
}

export async function recordHomologation(kind: R5Kind, i: HomologationInput, rpc: RpcFn = defaultRpc) {
  const { data, error } = await rpc(HOMOLOGATE_RPC[kind], homologationPayload(i));
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Row;
  return { homologationId: String(r["homologation_id"]), sequence: Number(r["sequence"]) };
}

// ---------------------------------------------------------------------------
// Versões (encadeamento comum)
// ---------------------------------------------------------------------------
export type ChangeKind = "constituicao" | "sucessao" | "retificacao";
export type VersionStep = { baseVersionId: string | null; changeKind: ChangeKind };
type VersionCommon = {
  versionId: string; version: number; changeKind: ChangeKind; validFrom: string; validUntil: string | null;
  reason: string | null; actRef: string; recordedAt: string; supersedesId: string | null;
};
export type CatalogRef = { scheme: string; value: string; version: number };
export const GATE_EFFECTS = ["matching-regular", "associacao-explicita", "fora-de-correspondencia"] as const;
export type GateEffect = (typeof GATE_EFFECTS)[number];

export type ProfileVersion = VersionCommon & {
  profileId: string; positionKeySchemes: string[]; natureSchemeId: string | null;
  natureGates: { value: string; version: number; effect: GateEffect }[]; applicabilityRule: CatalogRef | null;
};
export type CorrespondenceVersion = VersionCommon & {
  correspondenceId: string; profileId: string; targetMatrixId: string; targetColumnKey: string; keys: CatalogRef[];
};
export type AssociationVersion = VersionCommon & {
  associationId: string; classId: string; targetMatrixId: string; targetColumnKey: string | null;
};

function common(r: Row, actCol = "originating_act_ref"): VersionCommon {
  return {
    versionId: String(r["id"]), version: Number(r["version"]), changeKind: r["change_kind"] as ChangeKind,
    validFrom: String(r["valid_from"]), validUntil: s(r["valid_until"]), reason: s(r["change_reason"]),
    actRef: String(r[actCol]), recordedAt: String(r["created_at"]), supersedesId: s(r["supersedes_id"]),
  };
}

/** Agrupa por identidade lógica, versões em ordem crescente; knownAt corta o futuro. */
export function groupByOwner<T extends VersionCommon>(rows: readonly T[], owner: (t: T) => string, knownAt: string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) if (r.recordedAt <= knownAt) out.set(owner(r), [...(out.get(owner(r)) ?? []), r]);
  for (const v of out.values()) v.sort((a, b) => a.version - b.version);
  return out;
}

/** Base esperada = última versão conhecida; nunca uma versão do passado. */
export function nextStep(existing: readonly VersionCommon[] | null, kind: "sucessao" | "retificacao" | null): VersionStep {
  if (!existing || existing.length === 0) return { baseVersionId: null, changeKind: "constituicao" };
  if (!kind) throw new Error("r5:change-kind-required");
  return { baseVersionId: existing[existing.length - 1]!.versionId, changeKind: kind };
}

type SelectAll = (t: string) => { select: (c: string) => Promise<{ data: Row[] | null; error: { message: string } | null }> };
const selectAll = async (t: string, c = "*") => {
  const { data, error } = await (supabase.from as unknown as SelectAll)(t).select(c);
  if (error) throw new Error(error.message);
  return data ?? [];
};

export async function loadProfiles(knownAt: string): Promise<Map<string, ProfileVersion[]>> {
  const [vs, keys, gates] = await Promise.all([
    selectAll("curricular_correspondence_profile_versions"),
    selectAll("curricular_correspondence_profile_position_keys"),
    selectAll("curricular_correspondence_profile_nature_gates"),
  ]);
  return groupByOwner(vs.map((r) => {
    const id = String(r["id"]);
    const g = gates.filter((x) => x["profile_version_id"] === id);
    return {
      ...common(r), profileId: String(r["profile_id"]),
      positionKeySchemes: keys.filter((k) => k["profile_version_id"] === id).map((k) => String(k["scheme_id"])).sort(),
      natureSchemeId: g[0] ? String(g[0]["scheme_id"]) : null,
      natureGates: g.map((x) => ({ value: String(x["value_id"]), version: Number(x["value_version"]), effect: x["effect"] as GateEffect })),
      applicabilityRule: r["applicability_rule_scheme_id"]
        ? { scheme: String(r["applicability_rule_scheme_id"]), value: String(r["applicability_rule_value_id"]), version: Number(r["applicability_rule_value_version"]) }
        : null,
    };
  }), (p) => p.profileId, knownAt);
}

export async function loadCorrespondences(knownAt: string): Promise<Map<string, CorrespondenceVersion[]>> {
  const [ids, vs, keys] = await Promise.all([
    selectAll("curricular_position_matrix_correspondences"),
    selectAll("curricular_position_matrix_correspondence_versions"),
    selectAll("curricular_position_matrix_correspondence_keys"),
  ]);
  const prof = new Map(ids.map((r) => [String(r["id"]), String(r["profile_id"])]));
  return groupByOwner(vs.map((r) => {
    const id = String(r["id"]);
    return {
      ...common(r), correspondenceId: String(r["correspondence_id"]), profileId: prof.get(String(r["correspondence_id"])) ?? "",
      targetMatrixId: String(r["target_matrix_id"]), targetColumnKey: String(r["target_column_key"]),
      keys: keys.filter((k) => k["correspondence_version_id"] === id)
        .map((k) => ({ scheme: String(k["scheme_id"]), value: String(k["value_id"]), version: Number(k["value_version"]) }))
        .sort((a, b) => a.scheme.localeCompare(b.scheme)),
    };
  }), (c) => c.correspondenceId, knownAt);
}

export async function loadAssociations(knownAt: string): Promise<Map<string, AssociationVersion[]>> {
  const [ids, vs] = await Promise.all([
    selectAll("class_specific_matrix_associations"),
    selectAll("class_specific_matrix_association_versions"),
  ]);
  const cls = new Map(ids.map((r) => [String(r["id"]), String(r["class_id"])]));
  return groupByOwner(vs.map((r) => ({
    ...common(r, "specific_act_ref"), associationId: String(r["association_id"]), classId: cls.get(String(r["association_id"])) ?? "",
    targetMatrixId: String(r["target_matrix_id"]), targetColumnKey: s(r["target_column_key"]),
  })), (a) => a.associationId, knownAt);
}

/** Estado vigente na data pelos readers bitemporais oficiais (só leitura). */
export async function loadEffectiveStates(kind: Exclude<R5Kind, "matrix">, ctx: R5ReadContext, rpc: RpcFn = defaultRpc) {
  const c = requireCtx(ctx);
  const fn = { profile: "curricular_correspondence_profiles_at", correspondence: "curricular_position_matrix_correspondences_at",
    association: "class_specific_matrix_associations_at" }[kind];
  const { data, error } = await rpc(fn, { _on: c.validOn, _known_at: c.knownAt });
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as Row[]).map((r) => [String(r["version_id"]), String(r["homologation_state"] ?? "")]));
}

export async function loadMatrixHomologationStates(ctx: R5ReadContext, rpc: RpcFn = defaultRpc) {
  const c = requireCtx(ctx);
  const { data, error } = await rpc("curricular_matrix_homologation_state_at", { _on: c.validOn, _known_at: c.knownAt });
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as Row[]).map((r) => [String(r["version_id"]), String(r["homologation_state"] ?? "")]));
}

// ---------------------------------------------------------------------------
// Payloads exatos dos writers E2/E3/E4
// ---------------------------------------------------------------------------
type Validity = { validFrom: string; validUntil: string | null; reason: string | null; actRef: string };

export type ProfileInput = VersionStep & Validity & {
  profileId: string | null; positionKeySchemes: string[]; natureSchemeId: string | null;
  natureGates: { value: string; version: number; effect: GateEffect }[]; applicabilityRule: CatalogRef | null;
};
export function profilePayload(i: ProfileInput): Record<string, unknown> {
  return {
    _profile: i.profileId, _base_version_id: i.baseVersionId, _change_kind: i.changeKind,
    _valid_from: i.validFrom, _valid_until: i.validUntil, _reason: (i.reason ?? "").trim() || null, _act_ref: i.actRef.trim(),
    _position_key_schemes: [...i.positionKeySchemes], _nature_scheme_id: i.natureSchemeId,
    _nature_gates: i.natureGates.map((g) => ({ value: g.value, version: g.version, effect: g.effect })),
    _applicability_rule: i.applicabilityRule ? { scheme: i.applicabilityRule.scheme, value: i.applicabilityRule.value, version: i.applicabilityRule.version } : null,
  };
}

export type CorrespondenceInput = VersionStep & Validity & {
  correspondenceId: string | null; profileId: string | null; targetMatrixId: string; targetColumnKey: string; keys: CatalogRef[];
};
export function correspondencePayload(i: CorrespondenceInput): Record<string, unknown> {
  return {
    _correspondence: i.correspondenceId, _profile_id: i.profileId, _base_version_id: i.baseVersionId, _change_kind: i.changeKind,
    _valid_from: i.validFrom, _valid_until: i.validUntil, _reason: (i.reason ?? "").trim() || null, _act_ref: i.actRef.trim(),
    _target_matrix_id: i.targetMatrixId, _target_column_key: i.targetColumnKey,
    _keys: i.keys.map((k) => ({ scheme: k.scheme, value: k.value, version: k.version })),
  };
}

export type AssociationInput = VersionStep & Validity & {
  associationId: string | null; classId: string | null; targetMatrixId: string; targetColumnKey: string | null;
};
export function associationPayload(i: AssociationInput): Record<string, unknown> {
  return {
    _association: i.associationId, _class_id: i.classId, _base_version_id: i.baseVersionId, _change_kind: i.changeKind,
    _valid_from: i.validFrom, _valid_until: i.validUntil, _reason: (i.reason ?? "").trim() || null,
    _specific_act_ref: i.actRef.trim(), _target_matrix_id: i.targetMatrixId, _target_column_key: i.targetColumnKey,
  };
}

async function call(fn: string, args: Record<string, unknown>, rpc: RpcFn) {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return (data ?? {}) as Row;
}
export const recordProfileVersion = (i: ProfileInput, rpc: RpcFn = defaultRpc) => call("record_correspondence_profile_version", profilePayload(i), rpc);
export const recordCorrespondenceVersion = (i: CorrespondenceInput, rpc: RpcFn = defaultRpc) => call("record_position_matrix_correspondence_version", correspondencePayload(i), rpc);
export const recordAssociationVersion = (i: AssociationInput, rpc: RpcFn = defaultRpc) => call("record_class_specific_matrix_association_version", associationPayload(i), rpc);

// ---------------------------------------------------------------------------
// Humanização (nunca esconde autorização, concorrência, sobreposição ou ato)
// ---------------------------------------------------------------------------
const SUBJECT: Record<string, string> = {
  "matrix-homologation": "versão de matriz", "profile-homologation": "versão do perfil",
  "correspondence-homologation": "versão da correspondência", "association-homologation": "versão da associação",
  profile: "perfil", correspondence: "correspondência", association: "associação específica",
};

export function humanR5Error(message: string): string {
  const m = message ?? "";
  const cap = /capability:([a-z0-9-]+)/.exec(m);
  if (cap) return `Sua atuação vigente não concede "${cap[1]}" com alcance de rede. Se a capacidade consta de política ainda não homologada, a operação aguarda essa homologação. Nada foi gravado.`;
  if (m.includes("session-required")) return "Entre com sua conta institucional vinculada a uma atuação vigente.";
  const p = /^(?:.*?)([a-z]+(?:-homologation)?):([a-z-]+)/.exec(m);
  const subj = p ? (SUBJECT[p[1]!] ?? "registro") : "registro";
  const code = p?.[2] ?? "";
  switch (code) {
    case "stale-head": return `Outra decisão de homologação foi registrada para esta ${subj} depois que você abriu a tela. Recarregue e confira o histórico; nada foi gravado.`;
    case "base-superseded": return `Outra versão desta ${subj} foi registrada antes. Recarregue e parta da versão mais recente; nada foi gravado.`;
    case "already-homologated": return `Esta ${subj} já está homologada; não há nova homologação a registrar.`;
    case "nothing-to-revoke": return `Esta ${subj} não está homologada; não há homologação a revogar.`;
    case "effective-before-head": return "A vigência da decisão não pode ser anterior à da decisão vigente no histórico.";
    case "effective-from-required": return "Informe a data a partir da qual a decisão produz efeito.";
    case "act-required": return "Informe a referência do ato institucional. Sem ato, nada é registrado.";
    case "reason-required": return "Informe o motivo: ele é exigido para revogação, para nova decisão após outra e para nova versão.";
    case "invalid-decision": return "Decisão inválida; somente homologação ou revogação.";
    case "target-not-found": case "target-required": return `A ${subj} indicada não existe.`;
    case "not-found": return `A ${subj} indicada não existe.`;
    case "invalid-change-kind": return "Tipo de mudança inválido para o estado atual (constituição só sem versão anterior; sucessão ou retificação depois).";
    case "valid-from-required": return "Informe o início da vigência.";
    case "ends-before-start": return "O término não pode ser anterior ao início.";
    case "succession-must-start-after-base": return "A sucessão deve começar depois do início da versão anterior.";
    case "retification-must-start-after-predecessor": return "A retificação apagaria a versão anterior; o início deve ser posterior ao dela.";
    case "overlap": case "overlaps-other-profile": return `Já existe outra ${subj} efetiva que se sobrepõe a esta vigência. A sobreposição tornaria a leitura ambígua; nada foi gravado.`;
    case "position-key-required": return "Informe ao menos um esquema de chave de posição.";
    case "position-key-invalid": return "Esquema de chave de posição com identificador inválido.";
    case "position-key-duplicate": return "Esquema de chave de posição repetido.";
    case "nature-scheme-invalid": return "Esquema do eixo de natureza com identificador inválido.";
    case "nature-gates-required": return "Os portões de natureza devem ser uma lista (vazia é permitida).";
    case "gates-without-nature-axis": return "Portões exigem um esquema de eixo de natureza.";
    case "gate-effect-invalid": return "Efeito de portão inválido.";
    case "gate-value-not-homologated": return "O valor do portão não está homologado em toda a vigência.";
    case "gate-duplicate": return "Portão repetido para o mesmo valor.";
    case "applicability-rule-not-homologated": return "O valor da regra de aplicabilidade não está homologado em toda a vigência.";
    case "key-value-not-homologated": return "Um valor da chave de posição não está homologado em toda a vigência.";
    case "key-schemes-mismatch": return "A chave deve trazer exatamente os esquemas declarados no perfil.";
    case "matrix-not-found": return "A matriz curricular alvo não existe.";
    case "column-required": return "Informe a coluna da matriz alvo.";
    case "column-invalid": return "Coluna da matriz com identificador inválido.";
    case "profile-required": return "Escolha o perfil de correspondência.";
    case "profile-immutable": return "Uma correspondência não troca de perfil; crie outra correspondência.";
    case "profile-without-version": return "O perfil escolhido ainda não tem versão registrada.";
    case "class-not-found": return "A turma indicada não existe.";
    case "class-immutable": return "Uma associação específica não troca de turma; crie outra associação.";
    case "ambiguous-chain": return "O histórico de homologação é ambíguo; a operação foi recusada.";
    case "change-kind-required": return "Escolha se a nova versão é sucessão ou retificação.";
    case "context-required": return "A consulta exige data de validade e instante de conhecimento explícitos.";
  }
  if (m.includes("ambiguous")) return "Há mais de um registro candidato nesta data; a leitura foi recusada.";
  return "Operação recusada; nada foi gravado.";
}

export function decisionLabel(state: HomologationHead["state"] | string): string {
  if (state === "homologada") return "Homologada";
  if (state === "revogada") return "Homologação revogada";
  return "Sem homologação";
}

// ---------------------------------------------------------------------------
// Opções canônicas: só valores de catálogo homologados vigentes na data.
// ---------------------------------------------------------------------------
type CatalogLike = { schemeId: string; values: { valueId: string; versions: { version: number; label: string; status: string; validFrom: string | null }[] }[] }[];
export type CatalogOption = CatalogRef & { label: string };
export function homologatedOptions(schemes: CatalogLike, on: string): Map<string, CatalogOption[]> {
  const out = new Map<string, CatalogOption[]>();
  for (const sc of schemes) {
    const opts: CatalogOption[] = [];
    for (const v of sc.values) {
      const best = v.versions.filter((x) => x.status === "homologada" && x.validFrom !== null && x.validFrom <= on)
        .sort((a, b) => b.version - a.version)[0];
      if (best) opts.push({ scheme: sc.schemeId, value: v.valueId, version: best.version, label: best.label });
    }
    if (opts.length) out.set(sc.schemeId, opts);
  }
  return out;
}
