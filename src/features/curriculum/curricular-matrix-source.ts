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
  if (m.includes("base-superseded")) return "Outra versão foi registrada antes; recarregue e confira o histórico.";
  if (m.includes("reason-required")) return "Informe o motivo da nova versão.";
  if (m.includes("ambiguous")) return "Há mais de uma versão candidata nesta data; a leitura foi recusada.";
  if (m.includes("context-required") || m.includes("valid-on-required") || m.includes("known-at-required"))
    return "A consulta exige data de validade e instante de conhecimento explícitos.";
  return "Operação recusada; nada foi gravado.";
}
