/**
 * Centro de Operações — L09: bens permanentes (migrations 0414/0415).
 * Identidade `ops_assets` com código interno SIGEM-BEM-######## gerado no banco; tombamento OFICIAL é evento próprio,
 * registrado só com fonte (sistema/livro municipal) e documento juntado, único na rede e nunca gerado pelo SIGEM.
 * Categoria só de catálogo versionado aprovado por pessoa ≠ autor; estado só dos valores da categoria.
 * Escola/ambiente/responsável/estado/documentos são eventos append-only; estado atual é projeção.
 * Não há valor contábil, depreciação, empenho ou nota: o SIGEM não concorre com o cadastro contábil municipal.
 */
export type AssetEventKind = "localizacao" | "responsavel" | "estado" | "tombamento-oficial" | "documento" | "baixa";
export interface AssetEvent { seq: number; kind: AssetEventKind; on: string; actorPerson: string; schoolId?: string; spaceId?: string | null;
  engagementId?: string; condition?: string; officialTag?: string; officialSource?: string; hasDoc?: boolean; note?: string }
export interface AssetIdentity { internalCode: string; categoryKey: string; description: string; origin: string; originRef: string; incorporatedOn: string }

export interface AssetProjection {
  internalCode: string; officialTag: string | null; tagState: "tombado" | "sem-tombamento-oficial";
  schoolId: string | null; spaceId: string | null; responsibleEngagement: string | null; condition: string | null;
  documents: number; writtenOff: boolean; history: AssetEvent[];
}

export function projectAsset(id: AssetIdentity, events: readonly AssetEvent[]): { ok: true; asset: AssetProjection } | { ok: false; reason: string } {
  const ev = [...events].sort((a, b) => a.seq - b.seq);
  if (ev[0]?.kind !== "localizacao") return { ok: false, reason: "sem-localizacao-inicial" };
  const p: AssetProjection = { internalCode: id.internalCode, officialTag: null, tagState: "sem-tombamento-oficial", schoolId: null, spaceId: null,
    responsibleEngagement: null, condition: null, documents: 0, writtenOff: false, history: ev };
  for (const [i, e] of ev.entries()) {
    if (e.seq !== i + 1) return { ok: false, reason: "cadeia-com-lacuna" };
    if (!e.actorPerson) return { ok: false, reason: "evento-sem-pessoa" };
    if (p.writtenOff) return { ok: false, reason: "evento-apos-baixa" };
    if (e.kind === "localizacao") {
      if (e.schoolId !== p.schoolId) p.responsibleEngagement = null; // responsável não migra de escola
      p.schoolId = e.schoolId ?? null; p.spaceId = e.spaceId ?? null;
    }
    if (e.kind === "responsavel") p.responsibleEngagement = e.engagementId ?? null;
    if (e.kind === "estado") p.condition = e.condition ?? null;
    if (e.kind === "documento") p.documents++;
    if (e.kind === "tombamento-oficial") {
      if (!e.officialSource?.trim() || !e.hasDoc) return { ok: false, reason: "tombamento-sem-fonte-ou-documento" };
      p.officialTag = e.officialTag ?? null; p.tagState = "tombado";
    }
    if (e.kind === "baixa") { if (!e.hasDoc || (e.note ?? "").trim().length < 10) return { ok: false, reason: "baixa-sem-fundamento" }; p.writtenOff = true; }
  }
  return { ok: true, asset: p };
}

/** Código interno nunca é apresentado como tombamento oficial. */
export const displayTag = (a: AssetProjection) => a.officialTag ? `Tombamento ${a.officialTag}` : `Sem tombamento oficial (código interno ${a.internalCode})`;

/** Campos contábeis proibidos no cadastro (concorreriam com a contabilidade municipal). */
export const ACCOUNTING_FIELDS = ["valor", "valor_aquisicao", "depreciacao", "valor_contabil", "empenho", "nota_fiscal", "conta_contabil"] as const;
export const ASSET_WRITERS = ["register_ops_asset_category", "approve_ops_asset_category", "incorporate_ops_asset", "record_ops_asset_event"] as const;
