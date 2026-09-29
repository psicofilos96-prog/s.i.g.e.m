/**
 * 14.1D — Dimensões institucionais AUSENTES. O CIECE não as resolve, não as
 * copia e não as infere: cada uma tem domínio legítimo de origem. Enquanto
 * ausente, o recorte correspondente é "não suportado", nunca preenchido.
 */
export type DimensionGap = { dimensionId: string; label: string; legitimateDomain: string; plannedStage?: string };

export const INSTITUTIONAL_DIMENSION_GAPS: readonly DimensionGap[] = [
  { dimensionId: "classShift", label: "Turno da turma", legitimateDomain: "Cadastro institucional da turma" },
  { dimensionId: "studentBirthDate", label: "Data de nascimento do estudante", legitimateDomain: "Identidade do estudante (13A)" },
  { dimensionId: "studentAdministrativeSex", label: "Sexo do estudante", legitimateDomain: "Identidade do estudante (13A)" },
];

/** 14.1.1: dimensões escolares resolvidas pelo Cadastro Institucional (school-dimensions.ts). */
export function isDimensionAvailable(dimensionId: string): boolean {
  return !INSTITUTIONAL_DIMENSION_GAPS.some((g) => g.dimensionId === dimensionId);
}
