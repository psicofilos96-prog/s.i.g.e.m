/** Perfis demonstrativos das telas de regra avaliativa (sem autenticação real). */
export type RuleProfile = "supervisao" | "direcao" | "professor";

export const RULE_PROFILES: RuleProfile[] = ["supervisao", "direcao", "professor"];

export const RULE_PROFILE_LABEL: Record<RuleProfile, string> = {
  supervisao: "Supervisão",
  direcao: "Direção escolar",
  professor: "Professor",
};
