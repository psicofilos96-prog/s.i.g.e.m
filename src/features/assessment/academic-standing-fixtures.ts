/**
 * Etapa 12I — fixtures DEMONSTRATIVAS de situação acadêmica.
 *
 * Nada aqui é norma da Rede Municipal: nenhum patamar de rendimento, percentual
 * de frequência, efeito de justificativa, competência de colegiado ou regra de
 * progressão está homologado. Os parâmetros ficam deliberadamente SEM VALOR,
 * de modo que os critérios permaneçam não avaliáveis até a rede cadastrar e
 * homologar sua regra.
 */
import type {
  AcademicStandingDefinition,
  AcademicStandingRuleSet,
  DeliberationBody,
  StandingRuleParameter,
  StandingRuleStep,
} from "./academic-standing-types";

export const STANDING_DEMONSTRATION_NOTE =
  "Conjunto demonstrativo: serve para exercitar o cadastro, a governança e a explicabilidade. Permanece em rascunho, com parâmetros sem valor, e não determina situação de nenhum aluno.";

/** Situações demonstrativas: identificadores estáveis, propriedades declaradas. */
export const demonstrationStandings: AcademicStandingDefinition[] = [
  {
    id: "sit-demo-a",
    code: "DEMO-A",
    label: "Situação demonstrativa A",
    description:
      "Situação genérica de demonstração. Rótulo, propriedades e efeitos são dados cadastrados, não conceitos do motor.",
    properties: { encerraCiclo: true, exemplo: "demonstração" },
    effects: [
      {
        id: "efd-a-1",
        label: "Efeito declarado A1",
        note: "Efeito de demonstração, sem consequência institucional real.",
      },
    ],
  },
  {
    id: "sit-demo-b",
    code: "DEMO-B",
    label: "Situação demonstrativa B",
    description: "Segunda situação genérica de demonstração, com propriedades diferentes.",
    properties: { encerraCiclo: false, exemplo: "demonstração" },
    effects: [{ id: "efd-b-1", label: "Efeito declarado B1" }],
  },
];

/** Parâmetros SEM valor: nenhum patamar foi confirmado pela rede. */
export const demonstrationStandingParameters: StandingRuleParameter[] = [
  {
    id: "par-demo-rendimento",
    label: "Referência de rendimento do ciclo",
    unit: "pontos",
    note: "Sem valor cadastrado: a rede ainda não confirmou nenhuma referência de rendimento.",
  },
  {
    id: "par-demo-frequencia",
    label: "Referência de presença do ciclo",
    unit: "proporção",
    note: "Sem valor cadastrado: a rede ainda não confirmou nenhuma referência de presença.",
  },
  {
    id: "par-demo-quantidade",
    label: "Quantidade de componentes tolerada",
    unit: "componentes",
    note: "Sem valor cadastrado: a rede ainda não confirmou nenhuma quantidade.",
  },
];

/**
 * Órgão deliberativo CONFIGURADO. A competência é dado: a etapa não presume o
 * que um colegiado pode ou não alterar.
 */
export const demonstrationDeliberationBodies: DeliberationBody[] = [
  {
    id: "org-demo-colegiado",
    label: "Colegiado deliberativo (demonstração)",
    description:
      "Órgão configurado para demonstrar o encaminhamento. As competências reais serão declaradas pela rede.",
    competences: [
      {
        id: "cmp-demo-apreciar",
        label: "Apreciar o percurso e registrar decisão (demonstração)",
        description:
          "Competência de demonstração. Nenhuma competência real foi confirmada nesta etapa.",
      },
    ],
  },
];

export const demonstrationStandingSteps: StandingRuleStep[] = [
  {
    id: "stp-demo-1",
    order: 1,
    label: "Presença do ciclo em relação à referência cadastrada",
    description:
      "Compara a proporção de presença do ciclo com o parâmetro cadastrado. Sem valor no parâmetro, o critério permanece não avaliável.",
    when: {
      id: "nod-demo-1",
      kind: "comparacao",
      label: "Proporção de presença do ciclo",
      fact: { factId: "proporcao-de-presenca-por-unidades", scope: { kind: "ciclo" } },
      operator: "maior-ou-igual",
      parameter: { kind: "parametro", parameterId: "par-demo-frequencia" },
    },
    consequence: { kind: "prosseguir", note: "Segue para o próximo critério cadastrado." },
    stopsOnMatch: false,
  },
  {
    id: "stp-demo-2",
    order: 2,
    label: "Quantidade de componentes abaixo da referência de rendimento",
    description:
      "Conta os componentes cujo resultado do ciclo fica abaixo do parâmetro cadastrado e compara com a quantidade tolerada.",
    when: {
      id: "nod-demo-2",
      kind: "comparacao",
      label: "Componentes abaixo da referência",
      fact: {
        factId: "resultado-pos-recuperacao-do-ciclo",
        scope: { kind: "componente-curricular" },
      },
      aggregation: {
        operator: "contagem",
        where: {
          id: "nod-demo-2-filtro",
          kind: "comparacao",
          fact: {
            factId: "resultado-pos-recuperacao-do-ciclo",
            scope: { kind: "componente-curricular" },
          },
          operator: "menor",
          parameter: { kind: "parametro", parameterId: "par-demo-rendimento" },
        },
      },
      operator: "menor-ou-igual",
      parameter: { kind: "parametro", parameterId: "par-demo-quantidade" },
    },
    consequence: { kind: "atribuir-situacao", standingId: "sit-demo-a" },
    stopsOnMatch: true,
  },
  {
    id: "stp-demo-3",
    order: 3,
    label: "Encaminhamento ao colegiado configurado",
    description:
      "Demonstra o encaminhamento a deliberação institucional quando os critérios anteriores não se satisfazem.",
    when: {
      id: "nod-demo-3",
      kind: "comparacao",
      label: "Consolidação do ciclo disponível",
      fact: { factId: "consolidacao-do-ciclo-completa", scope: { kind: "componente-curricular" } },
      aggregation: {
        operator: "contagem",
        where: {
          id: "nod-demo-3-filtro",
          kind: "comparacao",
          fact: {
            factId: "consolidacao-do-ciclo-completa",
            scope: { kind: "componente-curricular" },
          },
          operator: "verdadeiro",
          parameter: { kind: "sem-parametro" },
        },
      },
      operator: "maior",
      parameter: { kind: "literal", value: 0 },
    },
    consequence: {
      kind: "encaminhar-para-deliberacao",
      bodyId: "org-demo-colegiado",
      competenceId: "cmp-demo-apreciar",
      note: "Encaminhamento de demonstração.",
    },
    stopsOnMatch: true,
  },
];

export const demonstrationStandingRuleSets: AcademicStandingRuleSet[] = [
  {
    id: "rgs-demo-001",
    version: 1,
    label: "Conjunto demonstrativo de situação acadêmica",
    description:
      "Existe para demonstrar cadastro, governança, explicabilidade e bloqueios. Não é norma da rede.",
    status: "rascunho",
    scope: { academicYearId: "2026" },
    standings: demonstrationStandings,
    parameters: demonstrationStandingParameters,
    bodies: demonstrationDeliberationBodies,
    steps: demonstrationStandingSteps,
    audit: {
      events: [
        {
          at: "2026-01-05T12:00:00.000Z",
          action: "criada",
          actor: {
            actorId: "perfil-normativo",
            actorName: "Perfil com capacidades normativas (demonstração)",
            profileLabel: "Capacidades normativas",
            at: "2026-01-05T12:00:00.000Z",
          },
          detail: "Conjunto demonstrativo criado para exercitar a infraestrutura da Etapa 12I.",
        },
      ],
      demonstrative: true,
    },
    note: STANDING_DEMONSTRATION_NOTE,
  },
];

// ------------------------------------------------------------------------
// Rascunho INSTITUCIONAL (não homologado): situações comprovadas pelo
// documento histórico da rede. Nenhum critério, parâmetro ou competência de
// colegiado é cadastrado. O documento demonstra Conselho de Classe e Conselho
// de Classe Final, mas isso NÃO atribui competência decisória.
// ------------------------------------------------------------------------

export const NETWORK_STANDING_DRAFT_NOTE =
  "Rascunho institucional não homologado. Situações comprovadas pelo documento histórico: Aprovado, Reprovado e Transferido. Nenhum critério ou competência de Conselho foi cadastrado; a existência de Conselho de Classe e Conselho de Classe Final no documento não confere competência decisória.";

const DOCUMENT_EVIDENCE = "Documento histórico da rede apresentado pela Supervisão (ata/ficha de resultados).";

export const networkDocumentedStandings: AcademicStandingDefinition[] = [
  {
    id: "sit-rede-aprovado",
    code: "APROVADO",
    label: "Aprovado",
    historicalLabel: "APROVADO",
    description:
      "Situação comprovada pelo documento. Critérios que a produzem ainda não foram confirmados pela rede.",
    origin: "determinacao-por-regra",
    documentaryEvidence: DOCUMENT_EVIDENCE,
    properties: {},
    effects: [],
  },
  {
    id: "sit-rede-reprovado",
    code: "REPROVADO",
    label: "Reprovado",
    historicalLabel: "REPROVADO",
    description:
      "Situação comprovada pelo documento. Critérios que a produzem ainda não foram confirmados pela rede.",
    origin: "determinacao-por-regra",
    documentaryEvidence: DOCUMENT_EVIDENCE,
    properties: {},
    effects: [],
  },
  {
    id: "sit-rede-transferido",
    code: "TRANSFERIDO",
    label: "Transferido",
    historicalLabel: "TRANSFERIDO",
    description:
      "Situação de vida escolar proveniente da movimentação/matrícula. Encerra o percurso na unidade/ciclo sem produzir aprovação ou reprovação; nunca é resultado do motor de promoção.",
    origin: "vida-escolar",
    documentaryEvidence: DOCUMENT_EVIDENCE,
    properties: { encerraPercursoNoEscopo: true, produzResultadoDePromocao: false },
    effects: [],
  },
];

export const networkStandingDraftRuleSets: AcademicStandingRuleSet[] = [
  {
    id: "rgs-rede-001",
    version: 1,
    label: "Situações acadêmicas documentadas da rede",
    description:
      "Rascunho institucional com as situações comprovadas pelo documento. Sem critérios, parâmetros ou órgão deliberativo.",
    status: "rascunho",
    scope: { academicYearId: "2026" },
    standings: networkDocumentedStandings,
    parameters: [],
    bodies: [],
    steps: [],
    audit: {
      events: [
        {
          at: "2026-09-25T21:33:00.000Z",
          action: "criada",
          actor: {
            actorId: "perfil-normativo",
            actorName: "Perfil com capacidades normativas (demonstração)",
            profileLabel: "Capacidades normativas",
            at: "2026-09-25T21:33:00.000Z",
          },
          detail:
            "Cadastradas APROVADO, REPROVADO e TRANSFERIDO a partir do documento histórico. Não homologado.",
        },
      ],
      demonstrative: false,
    },
    note: NETWORK_STANDING_DRAFT_NOTE,
  },
];
