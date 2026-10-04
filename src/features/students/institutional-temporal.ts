/**
 * B4.10.0d.1 — projeção TEMPORAL de um episódio institucional numa data de referência.
 *
 * Não é situação administrativa nem legal: diz apenas onde a data cai em relação ao intervalo
 * registrado. O fim é inclusivo (o episódio vale no próprio dia `ended_on`), como no restante do
 * Diário. Abertura ausente nunca vira vigência conhecida; fim futuro não é encerramento hoje.
 */
export type InstitutionalTemporalSituation = "Futura" | "Vigente" | "Encerrada" | "Abertura não registrada";

/** Situações do estudante quando a fonte é institucional (separadas das demonstrativas). */
export const INSTITUTIONAL_STUDENT_SITUATIONS = [
  "Alocação vigente na data",
  "Várias alocações vigentes na data",
  "Sem alocação vigente na data",
] as const;
export type InstitutionalStudentSituation = (typeof INSTITUTIONAL_STUDENT_SITUATIONS)[number];

export function temporalSituation(
  openedOn: string | null | undefined,
  endedOn: string | null | undefined,
  on: string,
): InstitutionalTemporalSituation {
  if (endedOn && endedOn < on) return "Encerrada"; // fim conhecido e já passado na data
  if (!openedOn) return "Abertura não registrada";
  if (openedOn > on) return "Futura";
  return "Vigente";
}
