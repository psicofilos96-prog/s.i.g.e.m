/**
 * 14.7 — Dimensões cadastrais resolvidas por OUTRO fato canônico (junção declarada).
 * O motor não conhece tabela: só o tipo de fato, a chave de junção e a semântica
 * temporal. Data de nascimento NÃO é dimensão (minimização): idade será derivada
 * em etapa própria, para data de referência declarada e regra homologada.
 */
export type DimensionLink = {
  factTypeId: string;
  joinKey: string;
  /** versao-vigente: atributo de identidade corrigível; vigencia-na-data: episódio com início/fim. */
  temporal: "versao-vigente" | "vigencia-na-data";
  sensitivity: "pessoal" | "institucional";
};

export const DIMENSION_LINKS: Readonly<Record<string, DimensionLink>> = {
  "student.administrativeSexId": { factTypeId: "identidade-cadastral-do-estudante", joinKey: "studentId", temporal: "versao-vigente", sensitivity: "pessoal" },
  "class.shiftId": { factTypeId: "turno-da-turma", joinKey: "classId", temporal: "vigencia-na-data", sensitivity: "institucional" },
};
