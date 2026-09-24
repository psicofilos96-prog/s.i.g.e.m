/**
 * Calendário Escolar — tipos (Etapa 12B.1).
 *
 * Ano letivo (identidade/vigência) ≠ Calendário escolar (organização dos dias)
 * ≠ Período avaliativo (intervalo da configuração de avaliação).
 *
 * O calendário NÃO define carga horária, frequência mínima, presença,
 * compensação, justificativa ou abono. Nenhuma categoria aqui é taxonomia
 * oficial da SME: todas são estruturais e dependem de homologação.
 */
import type { IsoDate } from "@/lib/academic-date";
import type { NormativeStatus } from "@/features/assessment/assessment-types";

/** Efeito estrutural de uma categoria sobre a condição de dia letivo. */
export type DayEffect =
  /** Torna o dia letivo. */
  | "letivo"
  /** Torna o dia não letivo. */
  | "nao-letivo"
  /** Apenas marca o dia (evento); não altera a condição letiva. */
  | "marcador";

/** Chave visual semântica — a apresentação decide cor e padrão. */
export type DayTone =
  | "letivo"
  | "sabado"
  | "feriado"
  | "recesso"
  | "planejamento"
  | "conselho"
  | "evento"
  | "suspensao"
  | "outro";

export type DayCategory = {
  id: string;
  label: string;
  /** Marca textual curta usada junto da cor (acessibilidade e impressão). */
  mark: string;
  description: string;
  effect: DayEffect;
  /** Maior precedência vence quando classificações se sobrepõem. */
  precedence: number;
  tone: DayTone;
  /** Suspensão de atividades — propriedade, não `if` por id. */
  suspendsActivities?: boolean;
  normativeStatus: NormativeStatus;
};

export type CalendarEvent = {
  id: string;
  calendarId: string;
  categoryId: string;
  title: string;
  start: IsoDate;
  end: IsoDate;
  /** Restringe o intervalo a dias da semana (0 = domingo). Configuração explícita, nunca presunção. */
  weekdays?: number[];
  /** Ajuste local feito na interface (estado temporário da aba). */
  local?: boolean;
};

export type DayStatus = "letivo" | "nao-letivo" | "sem-classificacao" | "fora-da-vigencia";

export type DayResolution = {
  date: IsoDate;
  weekday: number;
  inValidity: boolean;
  status: DayStatus;
  /** Categoria que determinou a condição do dia (maior precedência). */
  classification: DayCategory | null;
  classifyingEvent: CalendarEvent | null;
  /** Eventos marcadores (conselho, evento institucional…). */
  markers: Array<{ event: CalendarEvent; category: DayCategory }>;
  suspended: boolean;
};

export type CalendarIssue = {
  severity: "erro" | "observacao";
  code:
    | "id-duplicado"
    | "intervalo-invertido"
    | "fora-da-vigencia"
    | "categoria-invalida"
    | "calendario-incompativel"
    | "ano-incompativel"
    | "conflito"
    | "periodo-ano-incompativel"
    | "periodo-fora-da-vigencia"
    | "periodo-sobreposto"
    | "lacuna-com-dia-letivo";
  message: string;
  eventId?: string;
  periodId?: string;
};
