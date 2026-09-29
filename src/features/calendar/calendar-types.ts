/**
 * Calendário Escolar da REDE — tipos (Etapa 12B.1, revisão de governança).
 *
 * Regra normativa: o calendário é definido exclusivamente pela Supervisão de
 * Ensino. Existe um calendário central por (ano letivo, modalidade). Escolas
 * apenas consultam — por isso nenhum tipo aqui possui `unitId`.
 *
 * Ano letivo (identidade/vigência) ≠ Calendário escolar (organização dos dias)
 * ≠ Período avaliativo (a avaliação referencia o período oficial por ID).
 */
import type { IsoDate } from "@/lib/academic-date";

export const DAY_TYPE_CODES = [
  "VAZIO",
  "FDS",
  "FERIADO",
  "FERIAS",
  "RECESSO",
  "FL",
  "INICIO",
  "RETORNO",
  "TERMINO",
  "CC",
  "CF",
  "CENSO",
  "MESTRE",
  "ENCONTRO",
  "PP",
  "PF",
] as const;
export type DayTypeCode = (typeof DAY_TYPE_CODES)[number];

/** Como o tipo entra no calendário — determina a precedência, não `if` por sigla. */
export type DayTypeKind =
  "automatico" | "evento" | "feriado-letivo" | "feriado" | "recesso" | "ferias";

export type DayTypeInfo = {
  code: DayTypeCode;
  label: string;
  mark: string;
  background: string;
  foreground: string;
  /** Atributo do tipo: conta como dia letivo. */
  countsAsSchoolDay: boolean;
  kind: DayTypeKind;
  legendOrder: number;
  showInLegend: boolean;
  /** Sigla usada na legenda quando difere da grade (ex.: Término "T"). */
  legendMark?: string;
  /** Sigla oficial apresentada dentro de retângulo (grade e legenda). */
  boxed?: boolean;
};

export type CalendarModality = "regular" | "eja" | "eja-fase-1";

/** Estados administrativos. "Demonstrativo" NÃO é estado de calendário. */
export type CalendarStatus = "rascunho" | "em-revisao" | "homologado" | "arquivado";

export type MovableHoliday = "carnaval" | "sexta-santa" | "corpus-christi";

export type CalendarRange = { id: string; type: DayTypeCode; start: IsoDate; end: IsoDate };

export type CalendarEventEntry = {
  id: string;
  type: DayTypeCode;
  date: IsoDate;
  name?: string;
  /** Aparece na lista FERIADOS do rodapé mesmo não sendo feriado. */
  showInHolidays?: boolean;
  /** Data exibida na lista (ex.: Dia do Mestre transferido). */
  displayDate?: IsoDate;
  movable?: MovableHoliday;
};

/**
 * Período letivo configurado pela Supervisão. Quantidade, nomes, datas e
 * agrupamento são dados do calendário — nunca regra por modalidade.
 * Dias letivos são sempre derivados do motor; nunca digitados.
 * A data do Conselho NÃO é campo do período: é o dia do tipo CC resolvido
 * dentro do intervalo (fonte única = eventos/ajustes do calendário).
 */
export type CalendarPeriod = {
  /** Identidade estável — a avaliação referencia este ID. */
  id: string;
  order: number;
  name: string;
  /** Agrupamento opcional (ex.: semestre da EJA 2027) — referência por ID. */
  groupId?: string | undefined;
  start: IsoDate;
  end: IsoDate;
  /**
   * Texto do Conselho de Classe no documento, configurado pela Supervisão.
   * Ausente = rótulo derivado do nome do período. A DATA nunca é digitada:
   * continua sendo o dia CC resolvido dentro do intervalo.
   */
  councilLabel?: string | undefined;
  /**
   * Texto do Conselho de Classe Final do período (dia CF ou "CF T").
   * Ausente = o período não publica Conselho Final no documento.
   */
  finalCouncilLabel?: string | undefined;
};

/** Agrupamento configurável de períodos (nenhum, semestral ou outro). */
export type CalendarPeriodGroup = {
  id: string;
  name: string;
  order: number;
  /** Rótulo da linha de total na grade documental (texto, nunca número). */
  totalLabel?: string;
};

/** Sobrescrita manual da Supervisão sobre um dia; vence toda a precedência. */
export type CalendarOverride = { date: IsoDate; type: DayTypeCode };

export type InheritedHoliday = {
  date: IsoDate;
  name: string;
  sphere: "nacional" | "estadual" | "municipal";
  type: "FERIADO" | "FL";
  movable?: MovableHoliday;
};

export type ReviewSeverity = "erro" | "critico" | "atencao" | "info";

/**
 * Regras de validação configuradas NO calendário pela Supervisão. Não são
 * regras universais: regra ausente = sem validação (nunca um padrão implícito).
 * Uma regra nunca altera o valor calculado — apenas o compara.
 */
export type CalendarRuleKind =
  | "minimo-anual"
  | "minimo-agrupamento"
  | "minimo-periodo"
  | "minimo-ferias"
  | "conselho-por-periodo"
  | "conselho-dia-semana"
  | "feriado-local-esperado";

export type CalendarRule = {
  id: string;
  kind: CalendarRuleKind;
  enabled: boolean;
  severity: ReviewSeverity;
  /** Mínimo (dias) ou dia da semana (0–6), conforme o tipo. */
  value?: number;
  /** Agrupamento ou período alvo (por ID). */
  targetId?: string;
  basis?: string;
  monthDay?: string;
  name?: string;
  dayType?: DayTypeCode;
};

/** Conteúdo documental controlado; o layout A4 é do sistema. */
export type CalendarDocumentConfig = {
  headerLines: string[];
  showHolidays: boolean;
  showPeriods: boolean;
  showGroupSummaries: boolean;
  showCouncils: boolean;
  showAnnualTotal: boolean;
  /** Formatação por bloco de texto; ausente = formatação padrão do modelo. */
  typography?: Partial<Record<CalendarTextRole, CalendarTextStyle>> | undefined;
};

export type CalendarTextRole =
  | "cabecalho"
  | "titulo"
  | "gradeCabecalho"
  | "meses"
  | "dias"
  | "totais"
  | "legenda"
  | "feriados"
  | "periodos"
  | "conselhos"
  | "informacoes"
  | "assinaturas";

export type CalendarTextStyle = {
  family?: string | undefined;
  /** Tamanho em pontos (pt). */
  sizePt?: number | undefined;
  bold?: boolean | undefined;
};

/** Item de legenda adicionado pela Supervisão (além dos tipos de dia). */
export type CalendarCustomLegend = {
  id: string;
  mark: string;
  label: string;
  background: string;
  foreground: string;
};

export type CalendarActorRole = "supervisao" | "escola" | "professor" | "outro";
export type CalendarActor = { id: string; name: string; role: CalendarActorRole };

export type CalendarAuditEntry = {
  at: string;
  actorId: string;
  actorName: string;
  action:
    | "criado"
    | "duplicado"
    | "alterado"
    | "enviado-revisao"
    | "devolvido-rascunho"
    | "homologado"
    | "arquivado";
  detail: string;
};

export type ReviewItem = {
  severity: ReviewSeverity;
  code: string;
  message: string;
  date?: IsoDate;
};

export type NetworkCalendar = {
  id: string;
  academicYearId: string;
  modality: CalendarModality;
  year: number;
  title: string;
  status: CalendarStatus;
  observations?: string | undefined;
  ranges: CalendarRange[];
  events: CalendarEventEntry[];
  periods: CalendarPeriod[];
  /** Vazio = sem agrupamento. */
  periodGroups: CalendarPeriodGroup[];
  overrides: CalendarOverride[];
  inheritedHolidays: InheritedHoliday[];
  rules: CalendarRule[];
  document: CalendarDocumentConfig;
  /** Tipos omitidos da legenda impressa por decisão da Supervisão. */
  legendHidden: DayTypeCode[];
  /** Itens de legenda adicionais configurados pela Supervisão. */
  customLegend?: CalendarCustomLegend[] | undefined;
  signatures: string[];
  createdBy: string;
  createdAt: string;
  homologatedBy?: string | undefined;
  homologatedAt?: string | undefined;
  duplicatedFrom?: string;
  /** Pontos que a Supervisão precisa decidir após duplicação. */
  duplicationReview?: ReviewItem[];
  audit: CalendarAuditEntry[];
  /**
   * Revisão dos dados de Conselho de Classe da fixture de referência. Usada só
   * para migrar rascunhos salvos no navegador com datas anteriores.
   */
  councilRevision?: number | undefined;
  /** Marca apenas a origem da fixture; não é estado administrativo. */
  fixtureNote?: string | undefined;
};

/** Tipo resolvido de cada dia. */
export type ResolvedCalendar = {
  year: number;
  byDate: Map<IsoDate, DayTypeCode>;
  eventsByDate: Map<IsoDate, CalendarEventEntry>;
};
