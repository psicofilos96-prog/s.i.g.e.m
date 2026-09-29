/**
 * 14.1A — Contrato canônico de fatos do CIECE.
 *
 * `CanonicalFact` NÃO é contrato de indicadores: carrega um único fato
 * institucional atômico, lido da fonte oficial por um adaptador registrado.
 * Separa identidade, estado de disponibilidade e conteúdo factual; o conteúdo
 * não presume valor numérico. Tempo do fato (`occurredAt` / vigência) e versão
 * do registro são dimensões distintas.
 */

export type FactFamilyId =
  | "populacao-matricula-movimentacao"
  | "organizacao-escolar"
  | "vida-academica"
  | "profissionais-lotacao-atuacao"
  | "educacao-especial-aee"
  | "transporte"
  | "alimentacao"
  | "infraestrutura"
  | "governanca-mapa-estatistico"
  | "censo-educacenso"
  | "registro-institucional-de-visitas";

/** Ausência nunca é zero: estado explícito. */
export type FactAvailability = "disponivel" | "ausente" | "nao-aplicavel" | "indeterminado";

export type FactPayload =
  | { kind: "quantitativo"; measures: Readonly<Record<string, number | null>>; unit?: string }
  | { kind: "categorico"; categoryId: string | null; schemeId?: string }
  | { kind: "booleano"; value: boolean | null }
  | { kind: "temporal"; at: string | null }
  | { kind: "referencial"; references: readonly FactSourceReference[] }
  | { kind: "estruturado"; data: Readonly<Record<string, unknown>> };

export type FactPayloadKind = FactPayload["kind"];

/** Tempo do fato. Vigência só existe quando a fonte a declara; nunca inferida. */
export type FactTemporal = {
  occurredAt?: string;
  validFrom?: string;
  /** `null` = vigência aberta declarada pela fonte. */
  validTo?: string | null;
  periodId?: string;
  cycleId?: string;
  academicYearId?: string;
};

export type FactSourceReference = { kind: string; id: string; version?: number };

/** Leva de volta do fato ao registro oficial (auditoria inversa). */
export type FactProvenance = {
  domainId: string;
  sourceId: string;
  recordId: string;
  recordVersion: number | null;
  ruleOrPolicyId?: string;
  ruleOrPolicyVersion?: number;
  actRef?: string | null;
  sources?: readonly FactSourceReference[];
};

/** Identificadores externos: NUNCA chaves, nunca equivalentes entre si. */
export type FactExternalIds = {
  redeCode?: string;
  inepSchool?: string;
  inepStudent?: string;
  censoClassCode?: string;
};

export type CanonicalFact = {
  factTypeId: string;
  familyId: FactFamilyId;
  /** Referências internas do SIGEM que compõem a unidade atômica. */
  subject: Readonly<Record<string, string>>;
  /** Somente dimensões que a fonte declara; ausente = não presente. */
  dimensions: Readonly<Record<string, string | number | boolean>>;
  availability: FactAvailability;
  /** Obrigatoriamente ausente quando `availability !== "disponivel"`. */
  payload: FactPayload | null;
  temporal: FactTemporal;
  provenance: FactProvenance;
  externalIds?: FactExternalIds;
  schemaVersion: number;
};

export const CANONICAL_FACT_SCHEMA_VERSION = 1;
