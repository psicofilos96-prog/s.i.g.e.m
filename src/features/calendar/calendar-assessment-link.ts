/**
 * Ano letivo → Calendário homologado → Períodos oficiais → Configuração avaliativa.
 *
 * A avaliação NÃO mantém datas próprias para períodos vindos do calendário:
 * guarda apenas `calendarPeriodId` e resolve as datas no calendário a cada
 * leitura. Assim calendário e avaliação nunca divergem.
 */
import type {
  AssessmentPeriod,
  AssessmentPeriodStructure,
  NormativeStatus,
} from "@/features/assessment/assessment-types";
import type { NetworkCalendar } from "./calendar-types";

const statusOf = (c: NetworkCalendar): NormativeStatus =>
  c.status === "homologado" || c.status === "arquivado" ? "homologado" : "pendente";

/** Referências por ID (o que a avaliação persiste). */
export type AssessmentPeriodRef = {
  id: string;
  calendarId: string;
  calendarPeriodId: string;
  sequence: number;
};

export function periodRefsFromCalendar(cal: NetworkCalendar): AssessmentPeriodRef[] {
  return [...cal.periods]
    .sort((a, b) => a.order - b.order)
    .map((p) => ({
      id: `pa-${p.id}`,
      calendarId: cal.id,
      calendarPeriodId: p.id,
      sequence: p.order,
    }));
}

/** Resolve uma referência no calendário vigente; null se o período deixou de existir. */
export function resolvePeriodRef(
  ref: AssessmentPeriodRef,
  cal: NetworkCalendar,
  structureId: string,
): AssessmentPeriod | null {
  if (cal.id !== ref.calendarId) return null;
  const p = cal.periods.find((x) => x.id === ref.calendarPeriodId);
  if (!p) return null;
  return {
    id: ref.id,
    structureId,
    academicYearId: cal.academicYearId,
    sequence: ref.sequence,
    label: p.name,
    start: p.start,
    end: p.end,
    calendarPeriodId: p.id,
  };
}

export function assessmentStructureFromCalendar(
  cal: NetworkCalendar,
  refs: AssessmentPeriodRef[] = periodRefsFromCalendar(cal),
): AssessmentPeriodStructure {
  const id = `est-${cal.id}`;
  return {
    id,
    academicYearId: cal.academicYearId,
    calendarId: cal.id,
    label: `Períodos oficiais — ${cal.title}`,
    normativeStatus: statusOf(cal),
    periods: refs
      .map((r) => resolvePeriodRef(r, cal, id))
      .filter((p): p is AssessmentPeriod => p !== null),
  };
}
