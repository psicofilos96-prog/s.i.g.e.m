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
    /**
     * PRIMEIRA REGRA REAL DA REDE em elaboração — Ensino Fundamental, Anos
     * Finais. Cadastrada EXCLUSIVAMENTE com os limites já confirmados pela
     * rede. Tudo o que ainda não foi decidido permanece AUSENTE (consolidação
     * anual, fórmula/elegibilidade das recuperações, mínimos por categoria,
     * restrição de tipos e momento do arredondamento). Nasce e permanece em
     * RASCUNHO INCOMPLETO: não vai a revisão nem é homologada.
     */
    {
      id: "rav-ef-anos-finais",
      name: "Ensino Fundamental — 6º ao 9º Ano — Regra Geral da Rede",
      version: 1,
      status: "rascunho",
      scope: {
        academicYearId: "ano-2027",
        calendarId: "cal-rede-2027-regular",
        stageIds: ["etp-demo-anos-finais"],
      },
      strategy: "quantitativa",
      scaleSemantics: "quantitativa",
      scales: [{ kind: "numerica", min: 0, max: 100, step: 1, normativeStatus: "configurado" }],
      allowsGrades: true,
      usesPedagogicalRecords: false,
      allowsPromotionDecision: false,
      categories: [
        {
          id: "cat-av1",
          label: "AV1",
          instrumentTypeIds: [],
          weight: 30,
          maxScore: 30,
          aggregation: { kind: "soma" },
        },
        {
          id: "cat-av2",
          label: "AV2",
          instrumentTypeIds: [],
          weight: 30,
          maxScore: 30,
          aggregation: { kind: "soma" },
        },
        {
          id: "cat-iv",
          label: "Instrumentos Variados",
          instrumentTypeIds: [],
          weight: 35,
          maxScore: 35,
          aggregation: { kind: "soma" },
        },
        {
          id: "cat-part",
          label: "Participação",
          instrumentTypeIds: [],
          weight: 5,
          maxScore: 5,
          aggregation: { kind: "soma" },
        },
      ],
      periodAggregation: { kind: "soma" },
      periodMaxScore: 100,
      // annualAggregation AUSENTE: consolidação anual pendente de definição.
      requiresAllPeriods: true,
      annualPeriodWeights: [],
      periodicRecovery: {
        id: "rec-per-ef-finais",
        enabled: true,
        scope: "periodo",
        // Atua apenas sobre AV1 + AV2; IV e Participação são preservadas.
        replacesCategoryIds: ["cat-av1", "cat-av2"],
        instrumentTypeIds: [],
        maxScore: 60,
        // Forma atualmente informada pela rede; permanece configurável.
        prevalence: "maior-resultado",
        // aggregation e eligibility AUSENTES: pendentes de definição.
        normativeStatus: "pendente",
      },
      rounding: {
        id: "arr-ef-finais",
        mode: "meio-acima",
        decimals: 0,
        // applyAt VAZIO: o momento institucional ainda não foi decidido.
        applyAt: [],
        normativeStatus: "pendente",
      },
      administrativeEntries: { accepted: false, acceptedOrigins: [], normativeStatus: "pendente" },
      parameters: [],
      audit: audit(
        "Rascunho aberto com os limites confirmados da rede; definições normativas pendentes registradas.",
      ),
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
