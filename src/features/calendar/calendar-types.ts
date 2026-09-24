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
export type DayTypeKind = "automatico" | "evento" | "feriado-letivo" | "feriado" | "recesso" | "ferias";

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
};

export type CalendarModality = "regular" | "eja";
export type CalendarLayout = "anual" | "semestral";

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

export type CalendarPeriod = {
  /** Identidade estável — a avaliação referencia este ID. */
  id: string;
  order: number;
  name: string;
  /** Agrupamento documental (ex.: semestre da EJA). */
  block?: string;
  start: IsoDate;
  end: IsoDate;
  councilDate?: IsoDate;
  councilLabel?: string;
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

/**
 * Validações configuradas NO calendário pela Supervisão. Não são regras
 * universais: valores de 2027 (CC na sexta, ≥100 por semestre…) valem para
 * o calendário que os declara e podem ser alterados no próximo ano.
 */
export type CalendarValidationPolicy = {
  minSchoolDays?: { value: number; basis: string };
  councilWeekday?: number;
  minDaysPerBlock?: number;
  januaryVacationDays?: number;
  expectedLocalHolidays?: Array<{ monthDay: string; name: string; type: DayTypeCode }>;
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
  severity: "erro" | "critico" | "atencao" | "info";
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
  layout: CalendarLayout;
  /** Corte semestral (EJA): último dia do 1º semestre. */
  semesterCut?: { month: number; day: number };
  status: CalendarStatus;
  observations?: string;
  ranges: CalendarRange[];
  events: CalendarEventEntry[];
  periods: CalendarPeriod[];
  overrides: CalendarOverride[];
  inheritedHolidays: InheritedHoliday[];
  policy: CalendarValidationPolicy;
  /** Tipos omitidos da legenda impressa por decisão da Supervisão. */
  legendHidden: DayTypeCode[];
  signatures: string[];
  createdBy: string;
  createdAt: string;
  homologatedBy?: string;
  homologatedAt?: string;
  duplicatedFrom?: string;
  /** Pontos que a Supervisão precisa decidir após duplicação. */
  duplicationReview?: ReviewItem[];
  audit: CalendarAuditEntry[];
  /** Marca apenas a origem da fixture; não é estado administrativo. */
  fixtureNote?: string;
};

/** Tipo resolvido de cada dia. */
export type ResolvedCalendar = {
  year: number;
  byDate: Map<IsoDate, DayTypeCode>;
  eventsByDate: Map<IsoDate, CalendarEventEntry>;
};
