/**
 * Etapa 12E — Motor configurável de composição e consolidação avaliativa (tipos).
 *
 * Nenhuma quantidade de períodos, escala, peso, média, nota de corte,
 * arredondamento ou situação acadêmica é definida aqui. Tudo é CONFIGURAÇÃO:
 * o motor só executa o que o modelo homologado descrever.
 */
import type { EntryStatus, EntryValue, NormativeStatus } from "./assessment-types";

/** Semântica do valor. Não há conversão entre semânticas. */
export type ValueSemantics = "quantitativa" | "conceitual" | "descritiva";

/**
 * Origem do valor. "diario": lançado pelo professor no SIGEM.
 * "transferencia-externa": valor administrativo recebido de outra rede/escola —
 * participa da composição SOMENTE se a configuração aplicável o admitir, sem
 * conversão, equivalência ou fórmula especial. Metadados são preservados.
 */
export type EntryOrigin = "diario" | "transferencia-externa" | "regularizacao-administrativa";

/**
 * Pontos de FECHAMENTO onde o arredondamento pode ser aplicado. A configuração
 * decide quais. Fora deles, a precisão interna é preservada integralmente.
 */
export type RoundingPoint = "instrumento" | "categoria" | "periodo" | "componente" | "anual";

export type RoundingMode =
  | "sem-arredondamento"
  | "meio-acima"
  | "meio-par"
  | "truncar"
  | "passo";

export type RoundingPolicy = {
  id: string;
  mode: RoundingMode;
  /** Casas decimais (modos meio-acima, meio-par, truncar). */
  decimals?: number;
  /** Passo da escala (modo passo), ex.: 0,5. */
  step?: number;
  /** Momentos de aplicação. Vazio = nenhuma etapa arredonda. */
  applyAt: RoundingPoint[];
  normativeStatus: NormativeStatus;
};

/** Como reduzir um conjunto de valores. Sem padrão implícito. */
export type AggregationRule =
  | { kind: "media-simples" }
  | { kind: "media-ponderada" }
  | { kind: "soma" }
  | { kind: "maior-valor" }
  | { kind: "ultimo-valor" };

export type CompositionCategory = {
  id: string;
  label: string;
  /** Seleção por identidade do tipo de instrumento, nunca por rótulo. */
  instrumentTypeIds: string[];
  weight: number;
  /** Quantidade exigida pela configuração para considerar a categoria completa. */
  minimumEntries?: number;
  aggregation: AggregationRule;
};

/** Política de aceitação de valores administrativos. */
export type AdministrativeEntryPolicy = {
  accepted: boolean;
  /** Origens admitidas, por identidade. */
  acceptedOrigins: EntryOrigin[];
  normativeStatus: NormativeStatus;
};

/** Modelo de composição: a fórmula da rede, declarada como dado. */
export type CompositionModel = {
  id: string;
  label: string;
  configurationId: string;
  configurationVersion?: number;
  scaleSemantics: ValueSemantics;
  categories: CompositionCategory[];
  /** Como as categorias compõem o fechamento do período. */
  periodAggregation: AggregationRule;
  /** Como os períodos compõem o resultado anual original. */
  annualAggregation: AggregationRule;
  /** Resultado anual exige todos os períodos completos? */
  requiresAllPeriods: boolean;
  rounding: RoundingPolicy;
  administrativeEntries: AdministrativeEntryPolicy;
  normativeStatus: NormativeStatus;
  version: number;
};

/** Entrada do motor: referência a um lançamento, nunca uma cópia normativa. */
export type CompositionEntryInput = {
  entryId: string;
  instrumentId: string;
  instrumentTypeId: string;
  periodId: string;
  configurationId: string;
  configurationVersion?: number;
  value: EntryValue;
  status?: EntryStatus;
  origin?: EntryOrigin;
  /** Metadados da origem (preservados, nunca interpretados como fórmula). */
  metadata?: Readonly<Record<string, string>>;
  /** Peso individual, quando a agregação da categoria for ponderada. */
  weight?: number;
  /** Ordem cronológica para agregações dependentes de ordem. */
  at?: string;
};

export type MissingRequirement =
  | { kind: "quantidade-minima"; categoryId: string; required: number; present: number }
  | { kind: "categoria-sem-lancamento"; categoryId: string }
  | { kind: "lancamento-em-aberto"; instrumentId: string; entryId: string }
  | { kind: "nao-registrado-sem-regra"; entryId: string; reason: string }
  | { kind: "origem-nao-admitida"; entryId: string; origin: EntryOrigin }
  | { kind: "periodo-incompleto"; periodId: string };

/** Etapa numérica auditável: precisão interna e valor de fechamento. */
export type NumericStage = {
  point: RoundingPoint;
  /** Valor com precisão interna preservada. */
  raw: number;
  /** Valor após arredondamento, se a configuração arredonda neste ponto. */
  value: number;
  rounded: boolean;
};

export type CategoryComposition = {
  categoryId: string;
  label: string;
  weight: number;
  usedEntryIds: string[];
  origins: EntryOrigin[];
  stage: NumericStage | null;
  missing: MissingRequirement[];
};

export type PeriodComposition = {
  periodId: string;
  /** "acumulado-parcial" nunca tem semântica de resultado. */
  kind: "acumulado-parcial" | "fechamento-do-periodo";
  categories: CategoryComposition[];
  stage: NumericStage | null;
  complete: boolean;
  missing: MissingRequirement[];
  official: boolean;
};

export type AnnualComposition =
  | {
      kind: "bloqueado";
      reasons: string[];
      pendingRuleIds: string[];
      official: false;
      final: false;
    }
  | { kind: "nao-aplicavel"; reason: string; official: false; final: false }
  | {
      /** Acumulado durante o ano. NUNCA é resultado anual ou final. */
      kind: "acumulado-parcial";
      label: "Acumulado parcial — não é resultado anual";
      periods: PeriodComposition[];
      stage: NumericStage | null;
      missing: MissingRequirement[];
      official: false;
      final: false;
    }
  | {
      /** Só existe com os dados exigidos pela configuração completos. */
      kind: "resultado-anual-original";
      periods: PeriodComposition[];
      stage: NumericStage;
      modelId: string;
      official: boolean;
      final: true;
    };
