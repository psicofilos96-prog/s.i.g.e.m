/**
 * Etapa 12H — Definição CONFIGURADA do ciclo avaliativo.
 *
 * O motor (cycle-consolidation.ts) recebe o ciclo já resolvido e não conhece
 * modalidade, etapa, fase, ano civil nem quantidade de períodos. Toda decisão
 * estrutural — quais períodos compõem um ciclo e como o ciclo é nomeado na tela
 * — é DADO aqui, alterável futuramente pela governança sem mudança de código.
 */
import { calendarRepository, type CalendarRepository } from "@/features/calendar/calendar-store";
import type { NetworkCalendar } from "@/features/calendar/calendar-types";
import type { AssessmentConfiguration, AssessmentPeriodStructure } from "./assessment-types";
import type { AssessmentCycle, CyclePeriodRef } from "./cycle-consolidation-types";

/** Como os períodos oficiais se organizam em ciclos. Dado, nunca heurística. */
export type CycleGrouping = "todos-os-periodos" | "por-agrupamento-do-calendario";

/**
 * Definição do ciclo de uma configuração avaliativa. Nenhum campo é derivado de
 * modalidade ou nome de etapa: a configuração declara `kindId` e `label`.
 */
export type CycleDefinition = {
  id: string;
  configurationId: string;
  kindId: string;
  label: string;
  grouping: CycleGrouping;
  /** Rótulo por agrupamento do calendário, quando a rede o declarar. */
  groupLabels?: Record<string, string>;
};

/**
 * Definições DEMONSTRATIVAS. Não são regra da rede: existem para exercitar a
 * consolidação enquanto a governança não cadastra as suas. O ciclo por
 * agrupamento não presume semestralidade — apenas segue o agrupamento declarado
 * no calendário homologado.
 */
export const DEFAULT_CYCLE_DEFINITIONS: CycleDefinition[] = [];

/** Fallback declarado: ciclo único com todos os períodos oficiais. */
export const FALLBACK_CYCLE_DEFINITION: Omit<CycleDefinition, "id" | "configurationId"> = {
  kindId: "ciclo-completo",
  label: "Consolidação Anual",
  grouping: "todos-os-periodos",
};

/** Rótulo do ciclo por agrupamento, quando a definição não declarar outro. */
export const GROUPED_CYCLE_LABEL = "Consolidação da Fase";

export function cycleDefinitionFor(
  configuration: AssessmentConfiguration,
  definitions: readonly CycleDefinition[] = DEFAULT_CYCLE_DEFINITIONS,
): CycleDefinition {
  return (
    definitions.find((d) => d.configurationId === configuration.id) ?? {
      id: `cic-def-${configuration.id}`,
      configurationId: configuration.id,
      ...FALLBACK_CYCLE_DEFINITION,
    }
  );
}

/**
 * B4.6.2b.1 — repositório nulo para caminhos institucionais: nunca consulta o calendário do laboratório.
 * Não declara calendário oficial; apenas impede que o default alcance o laboratório (A6 permanece aberto).
 */
export const NO_LAB_CALENDARS: Pick<CalendarRepository, "get"> = { get: () => undefined };

/**
 * Resolve os ciclos de uma estrutura de períodos. Quantidade de ciclos e de
 * períodos por ciclo é resultado do dado, nunca de número fixado no código.
 */
export function resolveCycles(args: {
  configuration: AssessmentConfiguration;
  structure: AssessmentPeriodStructure;
  definition?: CycleDefinition;
  calendar?: NetworkCalendar | undefined;
  /** Dependência explícita; com sessão o chamador passa `NO_LAB_CALENDARS` (B4.6.2b.1). */
  calendars?: Pick<CalendarRepository, "get">;
}): AssessmentCycle[] {
  const { configuration, structure } = args;
  const definition = args.definition ?? cycleDefinitionFor(configuration);
  const calendar =
    args.calendar ??
    (structure.calendarId
      ? (args.calendars ?? calendarRepository).get(structure.calendarId)
      : undefined);
  const homologated = calendar?.status === "homologado";

  const refs: CyclePeriodRef[] = structure.periods
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((period) => {
      const calendarPeriod = period.calendarPeriodId
        ? calendar?.periods.find((p) => p.id === period.calendarPeriodId)
        : undefined;
      return {
        periodId: period.id,
        ...(period.calendarPeriodId ? { calendarPeriodId: period.calendarPeriodId } : {}),
        sequence: period.sequence,
        label: calendarPeriod?.name ?? period.label,
        start: period.start,
        end: period.end,
        official: Boolean(homologated && calendarPeriod),
      };
    });

  const common = {
    academicYearId: structure.academicYearId,
    configurationId: configuration.id,
    ...(structure.calendarId ? { calendarId: structure.calendarId } : {}),
  };

  if (definition.grouping === "todos-os-periodos")
    return [
      {
        id: `cic-${definition.id}-${structure.id}`,
        kindId: definition.kindId,
        label: definition.label,
        ...common,
        periods: refs,
      },
    ];

  // Agrupamento declarado no calendário homologado (por ID, nunca por nome).
  const groupOf = (ref: CyclePeriodRef) =>
    ref.calendarPeriodId
      ? calendar?.periods.find((p) => p.id === ref.calendarPeriodId)?.groupId
      : undefined;
  const groupIds = [...new Set(refs.map(groupOf))];
  if (groupIds.length <= 1 && groupIds[0] === undefined)
    return [
      {
        id: `cic-${definition.id}-${structure.id}`,
        kindId: definition.kindId,
        label: definition.label,
        ...common,
        periods: refs,
      },
    ];

  return groupIds.map((groupId) => {
    const group = groupId ? calendar?.periodGroups.find((g) => g.id === groupId) : undefined;
    const label =
      (groupId ? definition.groupLabels?.[groupId] : undefined) ??
      (group ? `${GROUPED_CYCLE_LABEL} — ${group.name}` : definition.label);
    return {
      id: `cic-${definition.id}-${groupId ?? structure.id}`,
      kindId: definition.kindId,
      label,
      ...common,
      ...(groupId ? { periodGroupId: groupId } : {}),
      periods: refs.filter((ref) => groupOf(ref) === groupId),
    };
  });
}
