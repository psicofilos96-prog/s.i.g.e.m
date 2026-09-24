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
      // Soma dos resultados dos períodos; o total possível deriva dos tetos
      // dos períodos do calendário (nenhum total fixado). O critério percentual
      // de aprovação pertence à regra de situação acadêmica, não a esta soma.
      annualAggregation: { kind: "soma" },
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
        // Direito: resultado total do componente no período inferior a 50.
        eligibility: { kind: "limite-de-pontuacao", threshold: 50, basis: "resultado-do-periodo" },
        // aggregation AUSENTE: consolidação entre múltiplos instrumentos pendente.
        normativeStatus: "pendente",
      },
      finalRecovery: {
        id: "rec-fin-ef-finais",
        enabled: true,
        scope: "anual",
        replacesCategoryIds: [],
        instrumentTypeIds: [],
        // Por componente, para quem termina abaixo do mínimo anual da regra de
        // situação vigente (ainda não cadastrada). Teto e prevalência pendentes.
        eligibility: { kind: "abaixo-do-minimo-anual" },
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
    /**
     * Etapa 12F.3 — Ensino Fundamental, ANOS INICIAIS (1º ao 5º ano).
     * Cadastrada EXCLUSIVAMENTE com o que a rede confirmou no levantamento:
     * estratégia quantitativa, escala 0–100, composição por categorias
     * (valores VARIÁVEIS, nunca fixos), SEM recuperação periódica,
     * consolidação anual por média dos períodos, recuperação final por
     * componente (direito abaixo de 50 no resultado anual; teto 100; a nota
     * da recuperação substitui a média quando maior), arredondamento
     * convencional no período e no anual, transferências externas aceitas na
     * composição, vigência a partir de 2027 no calendário Regular.
     * PENDENTES: consolidação entre múltiplos registros da recuperação
     * final, tipos de instrumento por categoria e quantidades mínimas.
     * Nasce e permanece em RASCUNHO: não vai a revisão nem é homologada.
     */
    {
      id: "rav-ef-anos-iniciais",
      name: "Ensino Fundamental — 1º ao 5º Ano — Regra Geral da Rede",
      version: 1,
      status: "rascunho",
      scope: {
        academicYearId: "ano-2027",
        calendarId: "cal-rede-2027-regular",
        stageIds: ["etp-demo-anos-iniciais"],
      },
      validFrom: "2027-01-01",
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
      // Resultado anual = média dos períodos (soma dividida pela quantidade
      // de períodos do calendário). A quantidade NUNCA é fixada aqui.
      annualAggregation: { kind: "media-simples" },
      requiresAllPeriods: true,
      annualPeriodWeights: [],
      // Recuperação periódica AUSENTE: a rede confirmou que os Anos Iniciais
      // só têm recuperação no final do ano. Nenhuma estrutura é presumida.
      finalRecovery: {
        id: "rec-fin-ef-iniciais",
        enabled: true,
        scope: "anual",
        replacesCategoryIds: [],
        instrumentTypeIds: [],
        maxScore: 100,
        // A nota da recuperação substitui a média anual quando for maior.
        prevalence: "maior-resultado",
        // Direito: resultado anual do componente inferior a 50.
        eligibility: { kind: "limite-de-pontuacao", threshold: 50, basis: "resultado-anual" },
        // aggregation AUSENTE: consolidação entre múltiplos registros pendente.
        normativeStatus: "pendente",
      },
      rounding: {
        id: "arr-ef-iniciais",
        mode: "meio-acima",
        decimals: 0,
        applyAt: ["periodo", "anual"],
        normativeStatus: "configurado",
      },
      administrativeEntries: {
        accepted: true,
        acceptedOrigins: ["transferencia-externa"],
        normativeStatus: "configurado",
      },
      parameters: [],
      audit: audit(
        "Rascunho aberto com as definições confirmadas no levantamento dos Anos Iniciais; pendências registradas.",
      ),
    },
    /**
     * Etapa 12F.3 — EJA, FASES 1–5. Cadastrada EXCLUSIVAMENTE com o que a rede
     * confirmou no levantamento: estratégia quantitativa por disciplina,
     * escala 0–100, composição por categorias (valores VARIÁVEIS, nunca
     * fixos), consolidação anual por média dos períodos, recuperação final
     * por componente (direito abaixo de 50 no resultado anual; teto 100; a
     * nota da recuperação substitui a média quando maior), arredondamento
     * convencional no período e no anual, transferências externas aceitas na
     * composição. PENDENTES: existência e sistemática da recuperação
     * periódica (nenhuma estrutura é presumida), ano letivo de início da
     * vigência, consolidação entre múltiplos registros da recuperação final,
     * tipos de instrumento por categoria e quantidades mínimas. Nasce e
     * permanece em RASCUNHO: não vai a revisão nem é homologada.
     */
    {
      id: "rav-eja-fases-1-5",
      name: "EJA — Fases 1 a 5 — Regra Geral da Rede",
      version: 1,
      status: "rascunho",
      scope: {
        academicYearId: "ano-2027",
        calendarId: "cal-rede-2027-eja",
        stageIds: ["etp-demo-eja-fases-1-5"],
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
      // Resultado anual = média dos períodos (soma dividida pela quantidade
      // de períodos do calendário). A quantidade NUNCA é fixada aqui.
      annualAggregation: { kind: "media-simples" },
      requiresAllPeriods: true,
      annualPeriodWeights: [],
      // Recuperação periódica AUSENTE: a rede ainda não definiu se existe nem
      // qual seria a sistemática. Nenhuma estrutura é presumida.
      finalRecovery: {
        id: "rec-fin-eja-fases-1-5",
        enabled: true,
        scope: "anual",
        replacesCategoryIds: [],
        instrumentTypeIds: [],
        maxScore: 100,
        // A nota da recuperação substitui a média anual quando for maior.
        prevalence: "maior-resultado",
        // Direito: resultado anual do componente inferior a 50.
        eligibility: { kind: "limite-de-pontuacao", threshold: 50, basis: "resultado-anual" },
        // aggregation AUSENTE: consolidação entre múltiplos registros pendente.
        normativeStatus: "pendente",
      },
      rounding: {
        id: "arr-eja-fases-1-5",
        mode: "meio-acima",
        decimals: 0,
        applyAt: ["periodo", "anual"],
        normativeStatus: "configurado",
      },
      administrativeEntries: {
        accepted: true,
        acceptedOrigins: ["transferencia-externa"],
        normativeStatus: "configurado",
      },
      parameters: [],
      audit: audit(
        "Rascunho aberto com as definições confirmadas no levantamento da EJA Fases 1–5; pendências registradas.",
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
