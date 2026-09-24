/**
 * Etapa 12F — regras avaliativas DEMONSTRATIVAS.
 *
 * Nenhuma regra real da rede é cadastrada nem homologada aqui. Estas fixtures
 * existem só para exercitar a infraestrutura de governança: todas nascem em
 * rascunho, com rótulos genéricos e sem afirmar sistemática de nenhum segmento.
 * As regras reais de cada segmento serão cadastradas e revisadas depois, pela
 * Supervisão, em etapa própria.
 */
import type { InstitutionalAssessmentRule } from "./assessment-rule-types";

const audit = (detail: string) => ({
  createdBy: "act-supervisao",
  createdByName: "Supervisão de Ensino (demonstração)",
  createdAt: "2026-01-15T12:00:00.000Z",
  events: [
    {
      at: "2026-01-15T12:00:00.000Z",
      actorId: "act-supervisao",
      actorName: "Supervisão de Ensino (demonstração)",
      action: "criada" as const,
      detail,
    },
  ],
  demonstrative: true as const,
});

export function createAssessmentRuleFixtures(): InstitutionalAssessmentRule[] {
  return [
    {
      id: "rav-demo-estrutural",
      name: "Cenário estrutural demonstrativo — composição por categorias",
      version: 1,
      status: "rascunho",
      scope: {
        academicYearId: "ano-2027",
        calendarId: "cal-rede-2027-regular",
        stageIds: ["etp-demo-anos-iniciais", "etp-demo-anos-finais"],
      },
      strategy: "quantitativa",
      scaleSemantics: "quantitativa",
      scales: [{ kind: "numerica", min: 0, max: 100, step: 1, normativeStatus: "demonstrativo" }],
      allowsGrades: true,
      usesPedagogicalRecords: false,
      allowsPromotionDecision: false,
      categories: [
        {
          id: "cat-demo-1",
          label: "Categoria demonstrativa 1",
          instrumentTypeIds: ["it-prova"],
          weight: 1,
          aggregation: { kind: "soma" },
        },
        {
          id: "cat-demo-2",
          label: "Categoria demonstrativa 2",
          instrumentTypeIds: ["it-atividade", "it-trabalho"],
          weight: 1,
          aggregation: { kind: "soma" },
        },
      ],
      periodAggregation: { kind: "soma" },
      annualAggregation: { kind: "soma" },
      requiresAllPeriods: true,
      annualPeriodWeights: [],
      rounding: {
        id: "arr-demo-estrutural",
        mode: "meio-acima",
        decimals: 0,
        applyAt: ["periodo", "anual"],
        normativeStatus: "configurado",
      },
      administrativeEntries: {
        accepted: false,
        acceptedOrigins: [],
        normativeStatus: "pendente",
      },
      parameters: [],
      audit: audit("Cenário estrutural criado para demonstrar a configuração da regra."),
    },
    {
      id: "rav-demo-acompanhamento",
      name: "Cenário estrutural demonstrativo — acompanhamento pedagógico",
      version: 1,
      status: "rascunho",
      scope: {
        academicYearId: "ano-2027",
        calendarId: "cal-rede-2027-regular",
        stageIds: ["etp-demo-ei"],
      },
      strategy: "acompanhamento",
      scaleSemantics: "descritiva",
      scales: [{ kind: "descritiva" }],
      allowsGrades: false,
      usesPedagogicalRecords: true,
      allowsPromotionDecision: false,
      categories: [],
      periodAggregation: { kind: "media-simples" },
      annualAggregation: { kind: "media-simples" },
      requiresAllPeriods: false,
      rounding: {
        id: "arr-demo-acompanhamento",
        mode: "sem-arredondamento",
        applyAt: [],
        normativeStatus: "pendente",
      },
      administrativeEntries: { accepted: false, acceptedOrigins: [], normativeStatus: "pendente" },
      parameters: [],
      audit: audit("Cenário estrutural de acompanhamento pedagógico, sem consolidação numérica."),
    },
  ];
}

export const assessmentRuleActors = {
  supervisao: {
    id: "act-supervisao",
    name: "Supervisão de Ensino (demonstração)",
    role: "supervisao" as const,
  },
  direcao: {
    id: "act-direcao",
    name: "Direção escolar (demonstração)",
    role: "direcao" as const,
  },
  professor: {
    id: "act-professor",
    name: "Professor(a) (demonstração)",
    role: "professor" as const,
  },
};
