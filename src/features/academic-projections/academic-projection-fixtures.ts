/**
 * Etapa 12L — CADASTRO demonstrativo da projeção.
 *
 * As naturezas conhecidas de dimensão, os fatos de frequência e as naturezas de
 * fonte de deliberação vivem AQUI, como configuração, e nunca no contrato ou no
 * projetor. Uma rede que trabalhe com campo de experiência, oficina, itinerário
 * ou qualquer estrutura futura declara suas naturezas do mesmo modo.
 */
import { SOURCE_KIND } from "@/features/cycle-closing/cycle-closing-sources";
import type { ProjectionOptions } from "./academic-projection-service";

export const demonstrationDimensionKinds = {
  component: "componente",
  attendanceScope: "frequencia",
  qualitative: "campo-de-experiencia",
} as const;

export const demonstrationAttendanceFactIds = [
  "frequencia-global-percentual",
  "frequencia-global-aulas-previstas",
  "frequencia-global-aulas-ministradas",
  "frequencia-global-ausencias",
] as const;

/** Opções demonstrativas da projeção: apenas configuração, nunca norma. */
export const demonstrationProjectionOptions: ProjectionOptions = {
  attendanceDimensionKindIds: [demonstrationDimensionKinds.attendanceScope],
  attendanceFactIds: demonstrationAttendanceFactIds,
  deliberationSourceKinds: [SOURCE_KIND.deliberation],
};

export const PROJECTION_DEMONSTRATION_NOTE =
  "Consulta somente de leitura: a projeção publica exatamente o que o encerramento congelou, sem recalcular nem reinterpretar. Enquanto não houver encerramento lavrado, não há projeção a publicar.";
