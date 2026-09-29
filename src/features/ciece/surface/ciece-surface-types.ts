/**
 * 14.4 — Contrato das superfícies do CIECE.
 *
 * A tela conhece apenas `AnalyticResponse` (14.3) e um catálogo descritivo
 * entregue pela própria fronteira. Não conhece fatos, motor nem política.
 */
import type { AnalyticResponse, DisclosedGroup } from "../analytic-boundary";

export type { AnalyticResponse, DisclosedGroup };

export type CieceTemporalKind = "fotografia" | "intervalo" | "periodo" | "ciclo";

/** Metadado de definição publicado pela fronteira (nunca recalculado na tela). */
export type CieceCatalogEntry = {
  definitionId: string;
  definitionVersion: number;
  label: string;
  unit: string;
  temporalKind: CieceTemporalKind;
  evaluatorId: string;
  coverageMode: "completa" | "parcial";
  populationCriteria: Readonly<Record<string, string | number | boolean>>;
};

/** Escopo consultável: somente turmas já cobertas pela atuação vigente. */
export type CieceScopeOption = { classId: string; label: string };

export type CieceCatalog = {
  entries: readonly CieceCatalogEntry[];
  scopes: readonly CieceScopeOption[];
  /** Dimensões que a fronteira declara disponíveis para decomposição. Vazio ⇒ nenhuma é oferecida. */
  decomposableDimensions: readonly string[];
  /** Rótulos humanos opcionais de grupos declarados pela fonte. */
  groupLabels?: Readonly<Record<string, string>>;
};

export type CieceReference = { at?: string; from?: string; to?: string; periodId?: string; cycleId?: string };

export type CieceQueryInput = {
  definitionId: string;
  definitionVersion?: number;
  reference: CieceReference;
  filters: { classId: string };
  groupBy?: string;
  wantProvenance?: boolean;
};

/** Fonte de respostas: institucional (servidor 14.3) ou laboratório demonstrativo. */
export type CieceSource = {
  kind: "institucional" | "laboratorio";
  query: (input: CieceQueryInput) => Promise<AnalyticResponse>;
};
