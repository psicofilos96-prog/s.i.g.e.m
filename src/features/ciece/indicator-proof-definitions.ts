/**
 * 14.2H — Indicadores de PROVA do motor. Não são taxonomia do CIECE; entram como
 * dado (definição + avaliador registrado). Status "homologada" aqui vale só como
 * contrato de teste do motor; a homologação institucional é ato futuro.
 */
import { IndicatorRegistry, type IndicatorDefinition } from "./indicator-engine";

export const PROOF_DEFINITIONS: readonly IndicatorDefinition[] = [
  {
    id: "prova-estudantes-enturmados", version: 1, label: "Estudantes enturmados na data", status: "homologada",
    factTypeId: "episodio-de-enturmacao", subjectKey: "studentId", populationCriteria: {},
    temporal: { kind: "fotografia" }, operation: { evaluatorId: "contagem", params: {} }, coverage: "parcial", unit: "estudantes",
  },
  {
    id: "prova-estudantes-por-situacao", version: 1, label: "Estudantes por situação acadêmica oficial", status: "homologada",
    factTypeId: "situacao-academica-oficial", subjectKey: "studentId", populationCriteria: {},
    temporal: { kind: "ciclo" }, operation: { evaluatorId: "contagem", params: {} }, coverage: "parcial", unit: "estudantes",
  },
  {
    id: "prova-percentual-situacao", version: 1, label: "Percentual de estudantes numa situação declarada", status: "homologada",
    factTypeId: "situacao-academica-oficial", subjectKey: "studentId", populationCriteria: {},
    temporal: { kind: "ciclo" },
    operation: { evaluatorId: "percentual", params: { numerator: { kind: "categoria-em", categoryIds: ["aprovado"] }, denominator: "observados" } },
    coverage: "completa", unit: "%",
  },
  {
    id: "prova-taxa-presenca", version: 1, label: "Taxa de presença sobre aulas aplicáveis no período", status: "homologada",
    factTypeId: "frequencia-apurada-do-periodo", subjectKey: "studentId", populationCriteria: {},
    temporal: { kind: "periodo" },
    operation: { evaluatorId: "percentual", params: { numerator: { kind: "medida", measureId: "attendedUnits" }, denominator: { kind: "medida", measureId: "applicableUnits" } } },
    coverage: "parcial", unit: "%",
  },
  {
    id: "prova-turmas-encerradas", version: 1, label: "Turmas com encerramento oficial no ciclo", status: "homologada",
    factTypeId: "encerramento-da-turma-no-ciclo", subjectKey: "classId", populationCriteria: {},
    temporal: { kind: "ciclo" }, operation: { evaluatorId: "contagem", params: {} }, coverage: "parcial", unit: "turmas",
  },
];

export function proofRegistry(): IndicatorRegistry {
  const r = new IndicatorRegistry();
  PROOF_DEFINITIONS.forEach((d) => r.register(d));
  return r;
}
