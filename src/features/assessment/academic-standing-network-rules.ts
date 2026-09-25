/**
 * Rascunhos INSTITUCIONAIS de situação acadêmica (não homologados).
 *
 * Existem apenas para demonstrar que a infraestrutura configurável representa
 * as definições hoje informadas pela rede. Nada aqui é norma vigente: os
 * patamares, limites e escopos são DADOS editáveis pela governança, e os
 * conjuntos permanecem em rascunho.
 *
 * O que está informado (e apenas isto):
 *   - Anos Iniciais: rendimento do ciclo ≥ 50; presença ≥ 75% apurada
 *     globalmente no ciclo;
 *   - Anos Finais: rendimento ≥ 50% do total possível do ciclo; presença mínima
 *     de 75% apurada por componente curricular; critérios cumulativos; existe
 *     progressão parcial/dependência com limite de até 2 componentes, que pode
 *     decorrer de insuficiência de rendimento, de presença ou de ambos.
 *
 * Princípio preservado: escopo não avaliável torna inconclusiva a avaliação que
 * dele depende. Ausência de dado NUNCA é tratada como critério atendido.
 *
 * O que NÃO está definido permanece explicitamente indefinido: o que ocorre
 * acima do limite de componentes, competência de colegiado, exceções,
 * recuperação e situações especiais. Nenhuma dessas lacunas é preenchida por
 * presunção — a regra apenas registra pendência.

 */
import type { AcademicStandingRuleSet, StandingRuleStep } from "./academic-standing-types";
import { networkDocumentedStandings } from "./academic-standing-fixtures";

export const NETWORK_RULE_DRAFT_NOTE =
  "Rascunho institucional não homologado. Os valores cadastrados (rendimento, presença e limite de componentes) são parâmetros editáveis pela governança, não constantes do sistema. Enquanto não houver homologação, nenhuma situação é determinada.";

const audit = (at: string, detail: string): AcademicStandingRuleSet["audit"] => ({
  events: [
    {
      at,
      action: "criada",
      actor: {
        actorId: "perfil-normativo",
        actorName: "Perfil com capacidades normativas (demonstração)",
        profileLabel: "Capacidades normativas",
        at,
      },
      detail,
    },
  ],
  demonstrative: false,
});

// --------------------------------------------------------- Anos Iniciais

const initialYearsSteps: StandingRuleStep[] = [
  {
    id: "stp-ai-aprovacao",
    order: 1,
    label: "Rendimento e presença do ciclo atingem os parâmetros cadastrados",
    description:
      "Critérios cumulativos: rendimento do ciclo e presença apurada globalmente no ciclo, ambos comparados a parâmetros editáveis.",
    when: {
      id: "nod-ai-cumulativo",
      kind: "composicao",
      label: "Rendimento e presença",
      logic: "e",
      children: [
        {
          id: "nod-ai-rendimento",
          kind: "comparacao",
          label: "Rendimento do ciclo",
          fact: { factId: "resultado-pos-recuperacao-do-ciclo", scope: { kind: "componente-curricular" } },
          aggregation: { operator: "minimo" },
          operator: "maior-ou-igual",
          parameter: { kind: "parametro", parameterId: "par-ai-rendimento" },
        },
        {
          id: "nod-ai-presenca",
          kind: "comparacao",
          label: "Presença global do ciclo",
          fact: { factId: "proporcao-de-presenca-por-unidades", scope: { kind: "ciclo" } },
          operator: "maior-ou-igual",
          parameter: { kind: "parametro", parameterId: "par-ai-presenca" },
        },
      ],
    },
    consequence: { kind: "atribuir-situacao", standingId: "sit-rede-aprovado" },
    stopsOnMatch: true,
  },
  {
    id: "stp-ai-reprovacao",
    order: 2,
    label: "Rendimento ou presença abaixo dos parâmetros cadastrados",
    description:
      "Caminho complementar ao anterior. A rede pode alterar, acrescentar exceções ou encaminhar a deliberação sem alteração do motor.",
    when: {
      id: "nod-ai-insuficiencia",
      kind: "composicao",
      label: "Rendimento ou presença insuficiente",
      logic: "ou",
      children: [
        {
          id: "nod-ai-rendimento-abaixo",
          kind: "comparacao",
          fact: { factId: "resultado-pos-recuperacao-do-ciclo", scope: { kind: "componente-curricular" } },
          aggregation: { operator: "minimo" },
          operator: "menor",
          parameter: { kind: "parametro", parameterId: "par-ai-rendimento" },
        },
        {
          id: "nod-ai-presenca-abaixo",
          kind: "comparacao",
          fact: { factId: "proporcao-de-presenca-por-unidades", scope: { kind: "ciclo" } },
          operator: "menor",
          parameter: { kind: "parametro", parameterId: "par-ai-presenca" },
        },
      ],
    },
    consequence: { kind: "atribuir-situacao", standingId: "sit-rede-reprovado" },
    stopsOnMatch: true,
  },
];

// ----------------------------------------------------------- Anos Finais

/** Componentes com insuficiência de rendimento OU de presença, contados. */
const finalYearsInsufficiencyCount = {
  operator: "contagem" as const,
  where: {
    id: "nod-af-insuficiencia",
    kind: "composicao" as const,
    label: "Insuficiência de rendimento ou de presença no componente",
    logic: "ou" as const,
    children: [
      {
        id: "nod-af-rendimento-componente",
        kind: "comparacao" as const,
        fact: {
          factId: "resultado-pos-recuperacao-do-ciclo",
          scope: { kind: "componente-curricular" },
        },
        operator: "menor" as const,
        parameter: { kind: "parametro" as const, parameterId: "par-af-rendimento" },
      },
      {
        id: "nod-af-presenca-componente",
        kind: "comparacao" as const,
        fact: {
          factId: "proporcao-de-presenca-por-unidades",
          scope: { kind: "componente-curricular" },
        },
        operator: "menor" as const,
        parameter: { kind: "parametro" as const, parameterId: "par-af-presenca" },
      },
    ],
  },
};

const finalYearsSteps: StandingRuleStep[] = [
  {
    id: "stp-af-aprovacao",
    order: 1,
    label: "Nenhum componente com insuficiência de rendimento ou de presença",
    description:
      "Rendimento e presença são cumulativos e apurados por componente curricular, conforme parâmetros editáveis.",
    when: {
      id: "nod-af-sem-insuficiencia",
      kind: "comparacao",
      label: "Componentes insuficientes",
      fact: { factId: "resultado-pos-recuperacao-do-ciclo", scope: { kind: "componente-curricular" } },
      aggregation: finalYearsInsufficiencyCount,
      operator: "igual",
      parameter: { kind: "literal", value: 0 },
    },
    consequence: { kind: "atribuir-situacao", standingId: "sit-rede-aprovado" },
    stopsOnMatch: true,
  },
  {
    id: "stp-af-progressao-parcial",
    order: 2,
    label: "Insuficiências dentro do limite de componentes cadastrado",
    description:
      "Progressão parcial/dependência: limite de até 2 componentes cadastrado como parâmetro editável, podendo decorrer de insuficiência de rendimento, de presença ou de ambos. A situação acadêmica correspondente ainda NÃO foi cadastrada pela rede: a regra registra pendência em vez de presumir resultado.",
    when: {
      id: "nod-af-dentro-do-limite",
      kind: "comparacao",
      label: "Componentes insuficientes dentro do limite",
      fact: { factId: "resultado-pos-recuperacao-do-ciclo", scope: { kind: "componente-curricular" } },
      aggregation: finalYearsInsufficiencyCount,
      operator: "menor-ou-igual",
      parameter: { kind: "parametro", parameterId: "par-af-limite-componentes" },
    },
    consequence: {
      kind: "registrar-pendencia",
      pendencyId: "progressao-parcial-sem-situacao-definida",
      message:
        "Percurso com insuficiências dentro do limite cadastrado de componentes: progressão parcial/dependência informada pela rede, mas a situação acadêmica correspondente ainda não foi definida nem cadastrada. Nenhum resultado é presumido.",
    },
    stopsOnMatch: true,
  },

  {
    id: "stp-af-acima-do-limite",
    order: 3,
    label: "Insuficiências acima do limite de componentes cadastrado",
    description:
      "O que ocorre acima do limite informado permanece indefinido pela rede. A regra registra pendência, sem atribuir situação.",
    when: {
      id: "nod-af-acima-do-limite",
      kind: "comparacao",
      label: "Componentes insuficientes acima do limite",
      fact: { factId: "resultado-pos-recuperacao-do-ciclo", scope: { kind: "componente-curricular" } },
      aggregation: finalYearsInsufficiencyCount,
      operator: "maior",
      parameter: { kind: "parametro", parameterId: "par-af-limite-componentes" },
    },
    consequence: {
      kind: "registrar-pendencia",
      pendencyId: "acima-do-limite-sem-definicao",
      message:
        "Insuficiências acima do limite cadastrado de componentes: a rede ainda não definiu o desfecho deste caminho. Nenhuma situação é atribuída.",
    },
    stopsOnMatch: true,
  },
];

export const networkStandingRuleDrafts: AcademicStandingRuleSet[] = [
  {
    id: "rgs-rede-anos-iniciais",
    version: 1,
    label: "Anos Iniciais — situação acadêmica do ciclo (rascunho)",
    description:
      "Representa as definições hoje informadas para os Anos Iniciais: rendimento e presença cumulativos, presença apurada globalmente no ciclo. Valores são parâmetros editáveis.",
    status: "rascunho",
    scope: { academicYearId: "2026" },
    standings: networkDocumentedStandings,
    parameters: [
      {
        id: "par-ai-rendimento",
        label: "Rendimento mínimo do ciclo",
        unit: "pontos",
        value: 50,
        note: "Valor informado pela rede, editável pela governança. Não é constante do sistema.",
      },
      {
        id: "par-ai-presenca",
        label: "Presença mínima do ciclo",
        unit: "proporção",
        value: 0.75,
        note: "Equivale a 75% informado pela rede, apurado globalmente no ciclo. Editável.",
      },
    ],
    bodies: [],
    steps: initialYearsSteps,
    audit: audit(
      "2026-09-26T12:00:00.000Z",
      "Rascunho institucional dos Anos Iniciais criado a partir das definições informadas. Não homologado.",
    ),
    note: NETWORK_RULE_DRAFT_NOTE,
  },
  {
    id: "rgs-rede-anos-finais",
    version: 1,
    label: "Anos Finais — situação acadêmica do ciclo (rascunho)",
    description:
      "Representa as definições hoje informadas para os Anos Finais: rendimento e presença cumulativos apurados por componente curricular, com limite de componentes em progressão parcial/dependência. Valores são parâmetros editáveis.",
    status: "rascunho",
    scope: { academicYearId: "2026" },
    standings: networkDocumentedStandings,
    parameters: [
      {
        id: "par-af-rendimento",
        label: "Rendimento mínimo por componente no ciclo",
        unit: "pontos",
        value: 50,
        note: "Corresponde aos 50% do total possível do ciclo informado pela rede, com total possível de 100 pontos. Ambos editáveis.",
      },
      {
        id: "par-af-presenca",
        label: "Presença mínima por componente curricular",
        unit: "proporção",
        value: 0.75,
        note: "Presença mínima informada pela rede: 75% apurados por componente curricular. É valor desta versão da configuração, editável pela governança, nunca constante ou limite estrutural do sistema.",
      },
      {
        id: "par-af-limite-componentes",
        label: "Limite de componentes em progressão parcial/dependência",
        unit: "componentes",
        value: 2,
        note: "Limite informado pela rede: até 2 componentes, podendo a insuficiência decorrer de rendimento, de presença ou de ambos. Valor desta versão da configuração, editável; o desfecho acima do limite permanece indefinido.",
      },

    ],
    bodies: [],
    steps: finalYearsSteps,
    audit: audit(
      "2026-09-26T12:05:00.000Z",
      "Rascunho institucional dos Anos Finais criado a partir das definições informadas. Não homologado.",
    ),
    note: NETWORK_RULE_DRAFT_NOTE,
  },
];
