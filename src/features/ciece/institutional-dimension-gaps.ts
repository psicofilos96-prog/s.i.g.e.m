/**
 * 14.1D — Dimensões institucionais AUSENTES. O CIECE não as resolve, não as
 * copia e não as infere: cada uma tem domínio legítimo de origem. Enquanto
 * ausente, o recorte correspondente é "não suportado", nunca preenchido.
 */
export type DimensionGap = { dimensionId: string; label: string; legitimateDomain: string; plannedStage?: string };

export const INSTITUTIONAL_DIMENSION_GAPS: readonly DimensionGap[] = [
  // 14.7: turno ("class.shiftId") e sexo administrativo ("student.administrativeSexId") têm fonte própria (dimension-links.ts).
  { dimensionId: "studentBirthDate", label: "Data de nascimento do estudante", legitimateDomain: "Identidade do estudante (14.7: fonte existe; não exposta — idade será derivada com regra homologada)" },
  { dimensionId: "studentDisabilityOrAee", label: "Deficiência / AEE", legitimateDomain: "Educação Especial (domínio próprio futuro, sensível)" },
  { dimensionId: "studentSchoolTransport", label: "Transporte escolar", legitimateDomain: "Transporte Escolar (domínio próprio futuro)" },
  { dimensionId: "studentSchoolMeals", label: "Alimentação escolar", legitimateDomain: "Alimentação Escolar (domínio próprio futuro)" },
  { dimensionId: "studentAddress", label: "Endereço / localidade do estudante", legitimateDomain: "Identidade do estudante (sem fonte; dado pessoal)" },
];

/** 14.1.1: dimensões escolares resolvidas pelo Cadastro Institucional (school-dimensions.ts). */
export function isDimensionAvailable(dimensionId: string): boolean {
  return !INSTITUTIONAL_DIMENSION_GAPS.some((g) => g.dimensionId === dimensionId);
}
