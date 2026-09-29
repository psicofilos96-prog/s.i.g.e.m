/**
 * 14.1D — Dimensões institucionais AUSENTES. O CIECE não as resolve, não as
 * copia e não as infere: cada uma tem domínio legítimo de origem. Enquanto
 * ausente, o recorte correspondente é "não suportado", nunca preenchido.
 */
export type DimensionGap = { dimensionId: string; label: string; legitimateDomain: string; plannedStage?: string };

export const INSTITUTIONAL_DIMENSION_GAPS: readonly DimensionGap[] = [
  { dimensionId: "schoolInep", label: "Código INEP da escola", legitimateDomain: "Cadastro Institucional de Unidades Escolares", plannedStage: "14.1.1" },
  { dimensionId: "schoolRedeCode", label: "Código de rede da escola", legitimateDomain: "Cadastro Institucional de Unidades Escolares", plannedStage: "14.1.1" },
  { dimensionId: "schoolAddress", label: "Endereço da escola", legitimateDomain: "Cadastro Institucional de Unidades Escolares", plannedStage: "14.1.1" },
  { dimensionId: "schoolDistrict", label: "Distrito/bairro da escola", legitimateDomain: "Cadastro Institucional de Unidades Escolares", plannedStage: "14.1.1" },
  { dimensionId: "schoolLocation", label: "Localização/zona da escola", legitimateDomain: "Cadastro Institucional de Unidades Escolares", plannedStage: "14.1.1" },
  { dimensionId: "classShift", label: "Turno da turma", legitimateDomain: "Cadastro institucional da turma" },
  { dimensionId: "studentBirthDate", label: "Data de nascimento do estudante", legitimateDomain: "Identidade do estudante (13A)" },
  { dimensionId: "studentAdministrativeSex", label: "Sexo do estudante", legitimateDomain: "Identidade do estudante (13A)" },
];

export function isDimensionAvailable(dimensionId: string): boolean {
  return !INSTITUTIONAL_DIMENSION_GAPS.some((g) => g.dimensionId === dimensionId);
}
