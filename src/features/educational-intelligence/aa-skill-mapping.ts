/**
 * SIGEM 2.0 — A&A Lote 03: habilidade curricular ↔ referência avaliativa.
 * Projeção pura sobre os readers canônicos do repositório curricular
 * (`curricular_reference_relations_at`, `curricular_reference_no_correspondence_at`).
 * Nunca grava; nunca infere equivalência; avaliações históricas ficam presas
 * à edição/relação vigente na data em que foram aplicadas.
 */
import type { RelationAt, NoCorrespondenceAt, HomologationState } from "@/features/curricular-reference/reference-source";

export type MappingKind = "direta" | "parcial" | "tematica" | "nao-estabelecida";
export type SourceFamily = "bncc" | "curriculo-local" | "matriz-institucional" | "saeb" | "outra";

/** Natureza do banco → tipo. Natureza desconhecida nunca vira "direta". */
export const NATURE_TO_KIND: Readonly<Record<string, MappingKind>> = {
  equivalente: "direta", direta: "direta",
  parcial: "parcial", "contem": "parcial", "contida-em": "parcial",
  tematica: "tematica", relacionada: "tematica", proxima: "tematica",
};

export type Mapping = {
  itemId: string; otherItemId: string | null; otherCode: string | null; otherSource: string;
  kind: MappingKind; justification: string | null; source: string | null;
  validFrom: string; validated: boolean; validation: HomologationState; relationId: string | null;
  notice: string | null;
};

export type MappingInput = {
  itemId: string; knownAt: string;
  relations: readonly RelationAt[] | null;           // null = não lido
  noCorrespondence: readonly NoCorrespondenceAt[] | null;
};

export type MappingResult =
  | { state: "nao-lido"; reason: string }
  | { state: "lido"; knownAt: string; mappings: Mapping[] };

export function projectMappings(i: MappingInput): MappingResult {
  if (!i.relations || !i.noCorrespondence) return { state: "nao-lido", reason: "relações ou ausências não lidas — nada é presumido" };
  const out: Mapping[] = [];
  for (const r of i.relations) {
    const mapped = NATURE_TO_KIND[r.nature];
    const kind: MappingKind = mapped ?? "tematica";
    const validated = r.homologation === "homologada";
    out.push({
      itemId: i.itemId, otherItemId: r.other_item_id, otherCode: r.other_code, otherSource: r.other_source_id,
      kind, justification: r.justification, source: r.official_locator ?? r.other_edition_label,
      validFrom: r.recorded_at, validated, validation: r.homologation, relationId: r.relation_id,
      notice: !mapped ? `natureza "${r.nature}" sem tipo declarado — exibida só como temática, nunca equivalência`
        : !validated ? "proposta não validada por instância competente — não usar como equivalência"
        : r.justification ? null : "validada sem justificativa registrada",
    });
  }
  for (const n of i.noCorrespondence) {
    out.push({
      itemId: i.itemId, otherItemId: null, otherCode: null, otherSource: n.target_source_id,
      kind: "nao-estabelecida", justification: n.justification, source: null,
      validFrom: n.recorded_at, validated: n.homologation === "homologada", validation: n.homologation, relationId: null,
      notice: "ausência de correspondência avaliada — não é item fictício",
    });
  }
  return { state: "lido", knownAt: i.knownAt, mappings: out };
}

/** Só relações diretas e homologadas podem sustentar equivalência operacional. */
export const usableAsEquivalence = (m: Mapping) => m.kind === "direta" && m.validated && !!m.justification;

/** Proposta para o writer canônico; o núcleo só valida o pedido, nunca grava. */
export type MappingProposal = { itemId: string; otherItemId: string | null; targetSource: string; kind: MappingKind; justification: string; sourceLocator: string; validFrom: string; authorPersonId: string | null };
export type ProposalCheck = { ok: true; writer: "record_curricular_reference_relation" | "record_curricular_reference_no_correspondence" } | { ok: false; reasons: string[] };

export function checkProposal(p: MappingProposal): ProposalCheck {
  const reasons: string[] = [];
  if (!p.authorPersonId) reasons.push("autoria: pessoa natural obrigatória");
  if (!p.justification.trim()) reasons.push("justificativa obrigatória");
  if (!p.sourceLocator.trim()) reasons.push("fonte obrigatória");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.validFrom)) reasons.push("vigência inicial obrigatória (AAAA-MM-DD)");
  if (p.kind === "nao-estabelecida" && p.otherItemId) reasons.push("não estabelecida não aponta item");
  if (p.kind !== "nao-estabelecida" && !p.otherItemId) reasons.push("tipo exige item de destino");
  if (reasons.length) return { ok: false, reasons };
  return { ok: true, writer: p.kind === "nao-estabelecida" ? "record_curricular_reference_no_correspondence" : "record_curricular_reference_relation" };
}

/** Avaliação histórica lê o mapeamento conhecido na data da aplicação, nunca o atual. */
export function mappingForHistoricalAssessment(appliedOn: string, versions: readonly Mapping[]): Mapping | null {
  const eligible = versions.filter((m) => m.validFrom.slice(0, 10) <= appliedOn).sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  return eligible.at(-1) ?? null;
}
