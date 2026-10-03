/**
 * B4.2.4/B4.2.5 — Fonte tipada da resolução curricular (somente leitura).
 *
 * Única porta TS para `class_curricular_resolution_context_at`, `student_curricular_matrix_at`,
 * `class_specific_curricular_matrix_at` e `class_curricular_matrices_at`. Nenhuma escrita, nenhum
 * fallback de laboratório: sem sessão a tela nem chama esta fonte. Todo estado do banco é mapeado
 * explicitamente; estado desconhecido vira `nao-mapeado` (visível), nunca ausência nem sucesso.
 * `validOn` é obrigatório e `knownAt` é capturado UMA vez por carregamento (`captureKnownAt`) e
 * repassado a todas as chamadas relacionadas.
 */
import { supabase } from "@/integrations/supabase/client";

export type StateKind =
  | "resolvido" | "vinculo-especifico" | "contexto-ok"
  | "ausente" | "bloqueada" | "inconsistente" | "nao-aplicavel" | "nao-registrada" | "nao-mapeado";

/** Dicionário fechado dos estados atuais dos readers 0015/0016 (mensagem humana = apresentação). */
export const RESOLUTION_STATES = {
  "portao-resolvido": { kind: "contexto-ok", text: "Configuração da turma localizada." },
  "resolvida-por-posicao": { kind: "resolvido", text: "Matriz resolvida pela posição curricular do estudante." },
  "vinculo-especifico-vigente": { kind: "vinculo-especifico", text: "Vínculo específico da turma vigente." },
  "bloqueada:perfil-ausente": { kind: "bloqueada", text: "Não há perfil de correspondência homologado; o sistema não conclui qual matriz se aplica." },
  "inconsistente:perfil-ambiguo": { kind: "inconsistente", text: "Há mais de um perfil de correspondência homologado vigente; nada foi escolhido." },
  "bloqueada:natureza-nao-designada": { kind: "bloqueada", text: "O perfil não designa qual informação da oferta indica a natureza da turma." },
  "ausente:natureza-nao-registrada": { kind: "ausente", text: "A oferta da turma não registra a natureza nesta data." },
  "inconsistente:natureza-ambigua": { kind: "inconsistente", text: "A oferta registra mais de uma natureza na data; nada foi escolhido." },
  "bloqueada:natureza-nao-homologada": { kind: "bloqueada", text: "A natureza registrada na oferta não está homologada no catálogo." },
  "bloqueada:natureza-sem-portao": { kind: "bloqueada", text: "O perfil não define o tratamento para a natureza desta turma." },
  "inconsistente:portao-ambiguo": { kind: "inconsistente", text: "O perfil define mais de um tratamento para esta natureza; nada foi escolhido." },
  "inconsistente:associacao-explicita-em-turma-regular": { kind: "inconsistente", text: "Turma regular com vínculo específico homologado; o vínculo não é usado até a divergência ser resolvida." },
  "ausente:posicao": { kind: "ausente", text: "Posição curricular do estudante não registrada." },
  "bloqueada:chave-nao-designada": { kind: "bloqueada", text: "O perfil não define quais informações da posição formam a chave de correspondência." },
  "ausente:posicao-incompleta": { kind: "ausente", text: "A posição registrada não contém todas as informações exigidas pelo perfil." },
  "ausente:correspondencia": { kind: "ausente", text: "Não há correspondência homologada para esta posição." },
  "inconsistente:correspondencia-ambigua": { kind: "inconsistente", text: "Mais de uma correspondência homologada para esta posição; nada foi escolhido." },
  "ausente:matriz-vigente": { kind: "ausente", text: "A matriz indicada não tem versão vigente nesta data." },
  "bloqueada:matriz-nao-homologada": { kind: "bloqueada", text: "A versão vigente da matriz não está homologada." },
  "bloqueada:coluna-inexistente": { kind: "bloqueada", text: "A coluna indicada não existe na versão vigente da matriz." },
  "bloqueada:coluna-nao-referenciada": { kind: "bloqueada", text: "A coluna da matriz não referencia uma posição do catálogo." },
  "inconsistente:coluna-ref-divergente": { kind: "inconsistente", text: "A coluna da matriz referencia posição diferente da do estudante." },
  "bloqueada:aplicabilidade-nao-homologada": { kind: "bloqueada", text: "A matriz tem regras de aplicabilidade cuja interpretação ainda não foi homologada." },
  "nao-aplicavel:natureza": { kind: "nao-aplicavel", text: "A natureza da turma está fora da correspondência curricular." },
  "nao-aplicavel:ramo-especifico": { kind: "nao-aplicavel", text: "Turma com vínculo específico: a matriz é da turma, não do estudante." },
  "nao-aplicavel:ramo-regular": { kind: "nao-aplicavel", text: "Turma regular: não usa vínculo específico." },
  "nao-registrada:associacao-especifica": { kind: "nao-registrada", text: "Nenhum vínculo específico homologado para esta turma." },
  "inconsistente:associacao-ambigua": { kind: "inconsistente", text: "Mais de um vínculo específico homologado vigente; nada foi escolhido." },
  "bloqueada:matriz-sem-versao-vigente": { kind: "bloqueada", text: "A matriz do vínculo específico não tem versão vigente nesta data." },
  "bloqueada:elemento-da-fonte-inexistente": { kind: "bloqueada", text: "A coluna informada no vínculo específico não existe na versão vigente da matriz." },
} as const satisfies Record<string, { kind: StateKind; text: string }>;

export type ResolutionStateId = keyof typeof RESOLUTION_STATES;
export type DescribedState = { id: string; kind: StateKind; text: string; known: boolean };

export function describeState(id: string | null): DescribedState {
  const raw = id ?? "(vazio)";
  const hit = (RESOLUTION_STATES as Record<string, { kind: StateKind; text: string }>)[raw];
  if (hit) return { id: raw, kind: hit.kind, text: hit.text, known: true };
  if (import.meta.env.DEV) console.error(`[curricular-resolution] estado não mapeado: ${raw}`);
  return { id: raw, kind: "nao-mapeado", text: `Estado não reconhecido pela tela (${raw}); trate como não concluído.`, known: false };
}

export type ResolutionTime = { validOn: string; knownAt: string };
/** Um instante por carregamento: todas as leituras relacionadas usam o mesmo knownAt. */
export const captureKnownAt = (now: () => Date = () => new Date()): string => now().toISOString();

type RpcResult = { data: unknown; error: { message: string } | null };
type Client = typeof supabase;
const rpc = (client: Client, fn: string, args: Record<string, unknown>): Promise<RpcResult> =>
  (client.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<RpcResult>)(fn, args);

function assertTime(t: ResolutionTime) {
  if (!t.validOn) throw new Error("resolution:valid-on-required");
  if (!t.knownAt) throw new Error("resolution:known-at-required");
}
async function call<T>(client: Client, fn: string, args: Record<string, unknown>): Promise<T[]> {
  const r = await rpc(client, fn, args);
  if (r.error) throw new Error(r.error.message); // ambiguidade/cadeia inválida: fail-closed, nunca ausência
  return (r.data ?? []) as T[];
}

// ---- Contexto da turma ------------------------------------------------------
export type ClassContext = { classId: string; state: DescribedState; gateEffect: string | null; profileId: string | null; offeringVersionId: string | null };
type RawContext = { class_id: string; context_state: string; gate_effect: string | null; profile_id: string | null; offering_version_id: string | null };
export async function readClassContext(classId: string, t: ResolutionTime, client = supabase): Promise<ClassContext | null> {
  assertTime(t);
  const rows = await call<RawContext>(client, "class_curricular_resolution_context_at", { _class_id: classId, _on: t.validOn, _known_at: t.knownAt });
  const r = rows[0];
  return r ? { classId: r.class_id, state: describeState(r.context_state), gateEffect: r.gate_effect, profileId: r.profile_id, offeringVersionId: r.offering_version_id } : null;
}

// ---- Por estudante ------------------------------------------------------------
export type StudentResolution = {
  allocationId: string; studentId: string; classId: string; state: DescribedState; positionVersionId: string | null;
  matrixId: string | null; matrixVersionId: string | null; columnKey: string | null;
  correspondenceId: string | null; associationState: DescribedState | null;
};
type RawStudent = {
  allocation_id: string; student_id: string; class_id: string; resolution_state: string; position_version_id: string | null;
  matrix_id: string | null; matrix_version_id: string | null; column_key: string | null; correspondence_id: string | null; association_state: string | null;
};
export function mapStudentRow(r: RawStudent): StudentResolution {
  const state = describeState(r.resolution_state);
  const resolved = state.kind === "resolvido";
  return {
    allocationId: r.allocation_id, studentId: r.student_id, classId: r.class_id, state, positionVersionId: r.position_version_id,
    // matriz só é exibida como do estudante quando resolvida por posição
    matrixId: resolved ? r.matrix_id : null, matrixVersionId: resolved ? r.matrix_version_id : null, columnKey: resolved ? r.column_key : null,
    correspondenceId: r.correspondence_id, associationState: r.association_state ? describeState(r.association_state) : null,
  };
}
export async function readStudentResolutions(school: string, classId: string, t: ResolutionTime, client = supabase): Promise<StudentResolution[]> {
  assertTime(t);
  const rows = await call<RawStudent>(client, "student_curricular_matrix_at", { _school: school, _class_id: classId, _on: t.validOn, _known_at: t.knownAt });
  return rows.map(mapStudentRow);
}

// ---- Vínculo específico da turma ----------------------------------------------
export type SpecificLink = { state: DescribedState; matrixId: string | null; matrixVersionId: string | null; columnKey: string | null; associationId: string | null };
type RawSpecific = { resolution_state: string; matrix_id: string | null; matrix_version_id: string | null; column_key: string | null; association_id: string | null };
export async function readSpecificResolution(classId: string, t: ResolutionTime, client = supabase): Promise<SpecificLink | null> {
  assertTime(t);
  const rows = await call<RawSpecific>(client, "class_specific_curricular_matrix_at", { _class_id: classId, _on: t.validOn, _known_at: t.knownAt });
  const r = rows[0];
  return r ? { state: describeState(r.resolution_state), matrixId: r.matrix_id, matrixVersionId: r.matrix_version_id, columnKey: r.column_key, associationId: r.association_id } : null;
}

// ---- Resumo da turma (B4.2.5) -------------------------------------------------
export type RawSummaryRow = {
  result_kind: string; class_id: string; valid_on: string; known_at: string; context_state: string | null; gate_effect: string | null;
  state: string | null; matrix_id: string | null; matrix_version_id: string | null; matrix_homologation_id: string | null;
  allocation_count: number | null; total_allocations: number | null; resolved_allocations: number | null;
  column_keys: string[] | null; correspondence_ids: string[] | null;
  association_id: string | null; association_version_id: string | null; association_homologation_id: string | null;
};
export type SummaryMatrix = { matrixId: string; matrixVersionId: string; allocationCount: number; columnKeys: string[]; correspondenceIds: string[] };
export type ClassSummary =
  | { access: "negado"; classId: string; validOn: string; knownAt: string }
  | {
      access: "permitido"; classId: string; validOn: string; knownAt: string;
      context: DescribedState; gateEffect: string | null;
      coverage: { total: number; resolved: number };
      matrices: SummaryMatrix[];
      unresolved: { state: DescribedState; count: number }[];
      specificLink: (SpecificLink & { origin: "vinculo-especifico" }) | null;
      unknownKinds: string[];
    };

export function mapSummaryRows(rows: RawSummaryRow[], t: ResolutionTime, classId: string): ClassSummary {
  if (rows.some((r) => r.result_kind === "access-denied") || rows.length === 0) {
    return { access: "negado", classId, validOn: t.validOn, knownAt: t.knownAt };
  }
  const ctx = rows.find((r) => r.result_kind === "context");
  const sp = rows.find((r) => r.result_kind === "specific-link");
  const known = new Set(["context", "matrix", "unresolved-state", "specific-link"]);
  const unknownKinds = [...new Set(rows.map((r) => r.result_kind).filter((k) => !known.has(k)))];
  if (unknownKinds.length && import.meta.env.DEV) console.error(`[curricular-resolution] result_kind não mapeado: ${unknownKinds.join(", ")}`);
  return {
    access: "permitido", classId, validOn: t.validOn, knownAt: t.knownAt,
    context: describeState(ctx?.context_state ?? null), gateEffect: ctx?.gate_effect ?? null,
    coverage: { total: ctx?.total_allocations ?? 0, resolved: ctx?.resolved_allocations ?? 0 },
    matrices: rows.filter((r) => r.result_kind === "matrix").map((r) => ({
      matrixId: r.matrix_id!, matrixVersionId: r.matrix_version_id!, allocationCount: r.allocation_count ?? 0,
      columnKeys: r.column_keys ?? [], correspondenceIds: r.correspondence_ids ?? [],
    })),
    unresolved: rows.filter((r) => r.result_kind === "unresolved-state").map((r) => ({ state: describeState(r.state), count: r.allocation_count ?? 0 })),
    specificLink: sp ? {
      origin: "vinculo-especifico", state: describeState(sp.state), matrixId: sp.matrix_id, matrixVersionId: sp.matrix_version_id,
      columnKey: sp.column_keys?.[0] ?? null, associationId: sp.association_id,
    } : null,
    unknownKinds,
  };
}

export async function readClassSummary(school: string, classId: string, t: ResolutionTime, client = supabase): Promise<ClassSummary> {
  assertTime(t);
  const rows = await call<RawSummaryRow>(client, "class_curricular_matrices_at", { _school: school, _class_id: classId, _on: t.validOn, _known_at: t.knownAt });
  return mapSummaryRows(rows, t, classId);
}

/** Nomes oficiais das versões de matriz (rótulo humano; ID fica como detalhe). */
export async function readMatrixVersionNames(versionIds: string[], client = supabase): Promise<Map<string, string>> {
  const ids = [...new Set(versionIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const r = await client.from("curricular_matrix_versions").select("id, official_name, version").in("id", ids);
  if (r.error) throw new Error(r.error.message);
  return new Map((r.data ?? []).map((v) => [v.id, `${v.official_name} (versão ${v.version})`]));
}
