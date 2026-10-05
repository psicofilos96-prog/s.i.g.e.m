/**
 * Frente I — escolha objetiva da escola piloto.
 * Readiness só por contagens agregadas canônicas; ausência (null) nunca vira zero
 * e desqualifica a dimensão. Desempate determinístico por INEP crescente.
 */
export interface SchoolReadiness {
  inep: string;
  infrastructureFacts: number | null;
  classes: number | null;
  schoolEnrollments: number | null;
  professionalExercises: number | null;
}

export interface PilotChoice {
  inep: string;
  score: number;
  covered: number;
}

const DIMENSIONS = ["infrastructureFacts", "classes", "schoolEnrollments", "professionalExercises"] as const;

export function rankPilotSchools(rows: readonly SchoolReadiness[]): PilotChoice[] {
  return rows
    .map((r) => {
      const present = DIMENSIONS.filter((d) => r[d] !== null && (r[d] as number) > 0);
      // Cobertura de dimensões primeiro; volume só como critério secundário.
      const score = present.reduce((acc, d) => acc + (r[d] as number), 0);
      return { inep: r.inep, covered: present.length, score };
    })
    .sort((a, b) => b.covered - a.covered || b.score - a.score || a.inep.localeCompare(b.inep));
}

export function choosePilotSchool(rows: readonly SchoolReadiness[]): PilotChoice | null {
  return rankPilotSchools(rows)[0] ?? null;
}
