/**
 * B4.1 — Fonte institucional da Matriz Curricular.
 *
 * Leitura só pelos readers bitemporais do banco (`curricular_matrices_at`,
 * `curricular_matrix_items_at`, `curricular_matrix_applicability_at`) com
 * `validOn` e `knownAt` explícitos. Escrita só por `record_curricular_matrix_version`
 * (capability `manter-matrizes-curriculares`, rede). Nenhum fixture entra aqui:
 * `curriculum-data.ts`/`matrix-draft.ts` são laboratório sem sessão.
 * Ausência permanece ausência: sem quantidade ⇒ `null`, nunca 0.
 */
import { supabase } from "@/integrations/supabase/client";
import type { EffectiveCapability } from "@/features/authority/session-authority";

export const MATRIX_CAPABILITY = "manter-matrizes-curriculares" as const;
/** Esquemas de catálogo reservados (vazios até homologação institucional). */
export const MATRIX_UNIT_SCHEME = "unidade-de-carga-da-matriz" as const;
export const MATRIX_ELEMENT_SCHEME = "elemento-de-matriz-curricular" as const;

export type MatrixReadContext = { validOn: string; knownAt: string };

export const canMaintainMatrices = (caps: readonly EffectiveCapability[]) =>
  caps.some((c) => c.capabilityId === MATRIX_CAPABILITY && c.schoolId === null);

export type InstitutionalMatrix = {
  matrixId: string; versionId: string; version: number;
  changeKind: "constituicao" | "sucessao" | "retificacao";
  officialName: string; validFrom: string; validUntil: string | null; effectiveUntil: string | null;
  actRef: string; recordedAt: string;
};

export type MatrixItemRef =
  | { kind: "componente"; componentId: string; labelSnapshot: string }
  | { kind: "elemento"; schemeId: string; valueId: string; valueVersion: number };

export type InstitutionalMatrixItem = {
  versionId: string; itemKey: string; position: number; reference: MatrixItemRef;
  /** `null` = nenhuma carga registrada (nunca zero presumido). */
  load: { quantity: number; unitValueId: string; unitValueVersion: number } | null;
};

export type InstitutionalMatrixApplicability =
  | { dimension: "ano-letivo"; academicYearId: string }
  | { dimension: "escola"; schoolId: string }
  | { dimension: "atributo"; schemeId: string; valueId: string; valueVersion: number };

function requireContext(ctx: MatrixReadContext | null | undefined): MatrixReadContext {
  if (!ctx || !ctx.validOn || !ctx.knownAt) throw new Error("matrix:context-required");
  return ctx;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export function mapMatrixRow(r: Row): InstitutionalMatrix {
  return {
    matrixId: String(r["matrix_id"]), versionId: String(r["version_id"]), version: Number(r["version"]),
    changeKind: r["change_kind"] as InstitutionalMatrix["changeKind"], officialName: String(r["official_name"]),
    validFrom: String(r["valid_from"]), validUntil: str(r["valid_until"]), effectiveUntil: str(r["effective_until"]),
    actRef: String(r["originating_act_ref"]), recordedAt: String(r["created_at"]),
  };
}

export function mapItemRow(r: Row): InstitutionalMatrixItem {
  const reference: MatrixItemRef = r["component_id"]
    ? { kind: "componente", componentId: String(r["component_id"]), labelSnapshot: String(r["component_label_snapshot"] ?? "") }
    : { kind: "elemento", schemeId: String(r["element_scheme_id"]), valueId: String(r["element_value_id"]), valueVersion: Number(r["element_value_version"]) };
  const q = r["quantity"];
  const load = q === null || q === undefined || r["unit_value_id"] == null
    ? null
    : { quantity: Number(q), unitValueId: String(r["unit_value_id"]), unitValueVersion: Number(r["unit_value_version"]) };
  return { versionId: String(r["version_id"]), itemKey: String(r["item_key"]), position: Number(r["position"]), reference, load };
}

export function mapApplicabilityRow(r: Row): InstitutionalMatrixApplicability {
  if (r["dimension"] === "ano-letivo") return { dimension: "ano-letivo", academicYearId: String(r["academic_year_id"]) };
  if (r["dimension"] === "escola") return { dimension: "escola", schoolId: String(r["school_id"]) };
  return { dimension: "atributo", schemeId: String(r["scheme_id"]), valueId: String(r["value_id"]), valueVersion: Number(r["value_version"]) };
}

/** Rótulo de carga: ausência é dita por extenso, nunca vira número. */
export function describeLoad(item: InstitutionalMatrixItem, unitLabel?: string | null): string {
  if (!item.load) return "Carga não registrada";
  return `${item.load.quantity.toLocaleString("pt-BR")} ${unitLabel ?? item.load.unitValueId}`;
}

const rpc = supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

export async function loadInstitutionalMatrices(ctx: MatrixReadContext): Promise<InstitutionalMatrix[]> {
  const c = requireContext(ctx);
  const { data, error } = await rpc("curricular_matrices_at", { _on: c.validOn, _known_at: c.knownAt });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(mapMatrixRow);
}

export async function loadInstitutionalMatrixDetail(matrixId: string, ctx: MatrixReadContext) {
  const c = requireContext(ctx);
  const [m, i, a] = await Promise.all([
    rpc("curricular_matrices_at", { _on: c.validOn, _known_at: c.knownAt }),
    rpc("curricular_matrix_items_at", { _matrix: matrixId, _on: c.validOn, _known_at: c.knownAt }),
    rpc("curricular_matrix_applicability_at", { _matrix: matrixId, _on: c.validOn, _known_at: c.knownAt }),
  ]);
  const err = m.error ?? i.error ?? a.error;
  if (err) throw new Error(err.message);
  const matrix = ((m.data ?? []) as Row[]).map(mapMatrixRow).find((x) => x.matrixId === matrixId) ?? null;
  return {
    matrix,
    items: matrix ? ((i.data ?? []) as Row[]).map(mapItemRow) : [],
    applicability: matrix ? ((a.data ?? []) as Row[]).map(mapApplicabilityRow) : [],
  };
}

/**
 * B4.1.2 — Quadro da matriz (grupos × linhas × colunas × células), transcrito do
 * documento-fonte. `text` é evidência literal (X, --, *, número): o sistema não
 * atribui significado a símbolo nenhum. `number` só existe quando o texto é
 * literalmente um número. Célula ausente = nada transcrito (nunca vazio = zero).
 */
export type MatrixLayoutColumn = { key: string; parent: string | null; header: string };
export type MatrixLayoutGroup = { key: string; parent: string | null; label: string };
export type MatrixLayoutRow = { key: string; group: string | null; role: "item" | "total" | "rotulo"; item: string | null; label: string | null };
export type MatrixLayoutCell = { row: string; column: string; text: string; number: number | null };
export type MatrixLayout = {
  versionId: string;
  source: { act: string; locator: string; page: string | null; sha256: string | null };
  columns: MatrixLayoutColumn[]; groups: MatrixLayoutGroup[]; rows: MatrixLayoutRow[];
  cells: MatrixLayoutCell[]; notes: { key: string; marker: string | null; text: string }[];
};

export function mapLayout(raw: unknown): MatrixLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const arr = (k: string) => (Array.isArray(r[k]) ? (r[k] as Row[]) : []);
  const src = (r["source"] ?? {}) as Row;
  return {
    versionId: String(r["version_id"]),
    source: { act: String(src["act"] ?? ""), locator: String(src["locator"] ?? ""), page: str(src["page"]), sha256: str(src["sha256"]) },
    columns: arr("columns").map((c) => ({ key: String(c["key"]), parent: str(c["parent"]), header: String(c["header"]) })),
    groups: arr("groups").map((g) => ({ key: String(g["key"]), parent: str(g["parent"]), label: String(g["label"]) })),
    rows: arr("rows").map((x) => ({ key: String(x["key"]), group: str(x["group"]), role: x["role"] as MatrixLayoutRow["role"], item: str(x["item"]), label: str(x["label"]) })),
    cells: arr("cells").map((c) => ({ row: String(c["row"]), column: String(c["column"]), text: String(c["text"]),
      number: c["number"] === null || c["number"] === undefined ? null : Number(c["number"]) })),
    notes: arr("notes").map((n) => ({ key: String(n["key"]), marker: str(n["marker"]), text: String(n["text"]) })),
  };
}

/** Colunas-folha (as que recebem células), na ordem do documento. */
export function leafColumns(layout: MatrixLayout): MatrixLayoutColumn[] {
  // Pré-ordem da árvore: alinha com os cabeçalhos aninhados em qualquer profundidade.
  const out: MatrixLayoutColumn[] = [];
  const walk = (parent: string | null) => {
    for (const c of layout.columns.filter((x) => x.parent === parent)) {
      if (layout.columns.some((x) => x.parent === c.key)) walk(c.key); else out.push(c);
    }
  };
  walk(null);
  return out;
}

/** Texto da célula como transcrito; `null` = nada transcrito (exibido como ausência, nunca 0). */
export function cellText(layout: MatrixLayout, row: string, column: string): string | null {
  return layout.cells.find((c) => c.row === row && c.column === column)?.text ?? null;
}

export async function loadInstitutionalMatrixLayout(matrixId: string, ctx: MatrixReadContext): Promise<MatrixLayout | null> {
  const c = requireContext(ctx);
  const { data, error } = await rpc("curricular_matrix_layout_at", { _matrix: matrixId, _on: c.validOn, _known_at: c.knownAt });
  if (error) throw new Error(error.message);
  return mapLayout(data);
}

/** B4.1.3 — histórico completo de versões (append-only; leitura direta permitida a contas vinculadas). */
export type MatrixVersionHistoryEntry = {
  versionId: string; version: number; changeKind: InstitutionalMatrix["changeKind"]; officialName: string;
  validFrom: string; validUntil: string | null; reason: string | null; actRef: string; recordedAt: string; supersedesId: string | null;
};

export async function loadMatrixHistory(matrixId: string): Promise<MatrixVersionHistoryEntry[]> {
  const { data, error } = await supabase
    .from("curricular_matrix_versions")
    .select("id, version, change_kind, official_name, valid_from, valid_until, change_reason, originating_act_ref, created_at, supersedes_id")
    .eq("matrix_id", matrixId)
    .order("version", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    versionId: r.id, version: r.version, changeKind: r.change_kind as InstitutionalMatrix["changeKind"], officialName: r.official_name,
    validFrom: r.valid_from, validUntil: r.valid_until, reason: r.change_reason, actRef: r.originating_act_ref,
    recordedAt: r.created_at, supersedesId: r.supersedes_id,
  }));
}

/** Componentes oficiais (B2.3) na data, por ID canônico. */
export async function loadComponentsAt(on: string) {
  const { data, error } = await supabase.rpc("curricular_components_at", { _on: on });
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ id: c.component_id, name: c.official_name, active: c.is_active, version: c.version }));
}

/** Valores homologados de qualquer catálogo (aberto). Vazio ⇒ a operação dependente fica bloqueada. */
export async function loadHomologatedValues(scheme: string, on: string) {
  const { data, error } = await supabase.rpc("homologated_attribute_values", { _scheme: scheme, _on: on });
  if (error) throw new Error(error.message);
  return (data ?? []).map((v) => ({ scheme: v.scheme_id, value: v.value_id, version: v.version, label: v.label }));
}

/** Único caminho de gravação da UI: writer canônico de 11 argumentos (B4.1.2). */
export async function recordMatrixVersion(args: Record<string, unknown>): Promise<{ matrixId: string; versionId: string; version: number }> {
  const { data, error } = await rpc("record_curricular_matrix_version", args);
  if (error) throw new Error(error.message);
  const r = data as Row;
  return { matrixId: String(r["matrix_id"]), versionId: String(r["version_id"]), version: Number(r["version"]) };
}

export function humanMatrixError(message: string): string {
  const m = message ?? "";
  if (m.includes("capability:manter-matrizes-curriculares")) return "Sua atuação vigente não concede manter matrizes curriculares com alcance de rede.";
  if (m.includes("session-required")) return "Entre com sua conta institucional.";
  if (m.includes("unit-not-homologated")) return "Não há unidade de carga homologada; a carga não pode ser registrada.";
  if (m.includes("unit-required")) return "Quantidade sem unidade não é aceita.";
  if (m.includes("quantity-required")) return "Unidade sem quantidade não é aceita.";
  if (m.includes("item-element-not-homologated")) return "Não há elemento de matriz homologado para esse item.";
  if (m.includes("component-not-found")) return "Componente curricular inexistente.";
  if (m.includes("component-inactive-in-validity")) return "O componente não está ativo em toda a vigência da matriz.";
  if (m.includes("applicability-value-not-homologated")) return "O valor de aplicabilidade não está homologado.";
  if (m.includes("school-inactive")) return "A unidade escolar não está ativa em toda a vigência da matriz.";
  if (m.includes("academic-year-inactive")) return "O ano letivo não está ativo em toda a vigência da matriz.";
  if (m.includes("retification-must-start-after-predecessor")) return "A retificação apagaria a versão anterior; o início deve ser posterior ao dela.";
  if (m.includes("base-superseded")) return "Outra versão foi registrada antes; recarregue e confira o histórico.";
  if (m.includes("reason-required")) return "Informe o motivo da nova versão.";
  if (m.includes("name-required")) return "Informe o nome oficial da matriz.";
  if (m.includes("valid-from-required")) return "Informe o início da vigência.";
  if (m.includes("ends-before-start")) return "O término não pode ser anterior ao início.";
  if (m.includes("act-required")) return "Informe o ato que origina a versão.";
  if (m.includes("succession-must-start-after-base")) return "A sucessão deve começar depois do início da versão anterior.";
  if (m.includes("layout-cell-text-required")) return "Célula transcrita não pode ficar só com espaços.";
  if (m.includes("item-key")) return "Chave de item inválida ou repetida.";
  if (m.includes("not-found") && m.includes("matrix:not-found")) return "Matriz inexistente.";
  if (m.includes("academic-year-not-found")) return "Ano letivo inexistente.";
  if (m.includes("school-not-found")) return "Unidade escolar inexistente.";
  if (m.includes("applicability-duplicate")) return "Aplicabilidade repetida.";
  if (m.includes("layout-quantity-belongs-to-cells")) return "Com quadro, a carga é registrada nas células, não no item.";
  if (m.includes("layout-item-without-row")) return "Todo item da matriz precisa de uma linha no quadro.";
  if (m.includes("layout-source-locator-required")) return "Informe o anexo/trecho do ato de onde o quadro foi transcrito.";
  if (m.includes("layout-unit-without-number")) return "Unidade só pode acompanhar um número transcrito.";
  if (m.includes("layout-column-ref-not-homologated")) return "O valor de catálogo da coluna não está homologado.";
  if (m.includes("layout-reference-not-found")) return "O quadro referencia linha, coluna, grupo ou item inexistente.";
  if (m.includes("layout-key-duplicate")) return "Chave ou célula repetida no quadro.";
  if (m.includes("layout-")) return "Quadro da matriz incompleto ou inválido; nada foi gravado.";
  if (m.includes("ambiguous")) return "Há mais de uma versão candidata nesta data; a leitura foi recusada.";
  if (m.includes("context-required") || m.includes("valid-on-required") || m.includes("known-at-required"))
    return "A consulta exige data de validade e instante de conhecimento explícitos.";
  return "Operação recusada; nada foi gravado.";
}
