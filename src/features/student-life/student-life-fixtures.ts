/**
 * Etapa 13A — Configuração DEMONSTRATIVA da Vida Escolar.
 *
 * Nada aqui é norma da rede: são definições de demonstração, em rascunho, para
 * exercitar o motor. Estados, motivos, transições, tipos de evento, naturezas de
 * participação e atributos cadastrais existem como DADO configurado.
 */
import type { StudentLifeGovernanceConfiguration } from "./student-life-types";

/** Motivos de ausência: desconhecido, não informado e não aplicável. */
export const ABSENCE_REASONS = {
  unknown: "dado-desconhecido",
  notInformed: "nao-informado",
  notApplicable: "nao-aplicavel",
} as const;

export const DEMO_STUDENT_MACHINE = "aluno-rede";
export const DEMO_BOND_MACHINE = "vinculo-unidade";

export const DEMO_EVENT_TYPES = {
  networkAdmission: "ingresso-na-rede",
  bondEstablished: "vinculo-unidade-estabelecido",
  bondEpisodeOpened: "vinculo-unidade-episodio-aberto",
  bondConcluded: "vinculo-unidade-encerrado",
  registryCorrection: "retificacao-cadastral",
} as const;

export const DEMO_PAYLOAD_SCHEMAS = {
  admission: "payload-ingresso-v1",
  bond: "payload-vinculo-v1",
  bondClosure: "payload-vinculo-encerramento-v1",
  correction: "payload-retificacao-v1",
} as const;

export const DEMO_PARTICIPATION_NATURES = {
  principalSchooling: "escolarizacao-principal",
  specializedSupport: "atendimento-especializado",
  complementary: "atividade-complementar",
} as const;

/**
 * Configuração demonstrativa em RASCUNHO. A estratégia de retorno à mesma
 * unidade permanece declarada apenas para demonstração; a rede decidirá a sua.
 */
export const demonstrationStudentLifeConfiguration: StudentLifeGovernanceConfiguration = {
  configurationId: "cfg-vida-escolar-demo",
  configurationVersion: 1,
  machines: [
    {
      machineId: DEMO_STUDENT_MACHINE,
      states: [
        { stateDefinitionId: "cadastrado", labelSnapshot: "Cadastrado", machineId: DEMO_STUDENT_MACHINE },
        { stateDefinitionId: "na-rede", labelSnapshot: "Vinculado à Rede", machineId: DEMO_STUDENT_MACHINE },
        {
          stateDefinitionId: "sem-vinculo-atual",
          labelSnapshot: "Sem vínculo atual",
          machineId: DEMO_STUDENT_MACHINE,
        },
      ],
      transitions: [
        {
          transitionDefinitionId: "cadastrado->na-rede",
          machineId: DEMO_STUDENT_MACHINE,
          fromStateDefinitionId: "cadastrado",
          toStateDefinitionId: "na-rede",
          eventTypeDefinitionId: DEMO_EVENT_TYPES.networkAdmission,
        },
        {
          transitionDefinitionId: "na-rede->sem-vinculo-atual",
          machineId: DEMO_STUDENT_MACHINE,
          fromStateDefinitionId: "na-rede",
          toStateDefinitionId: "sem-vinculo-atual",
          eventTypeDefinitionId: DEMO_EVENT_TYPES.bondConcluded,
          reasonRequired: true,
          allowedReasonDefinitionIds: ["transferencia-externa-demo", "encerramento-demo"],
        },
        {
          transitionDefinitionId: "sem-vinculo-atual->na-rede",
          machineId: DEMO_STUDENT_MACHINE,
          fromStateDefinitionId: "sem-vinculo-atual",
          toStateDefinitionId: "na-rede",
          eventTypeDefinitionId: DEMO_EVENT_TYPES.bondEpisodeOpened,
        },
      ],
    },
    {
      machineId: DEMO_BOND_MACHINE,
      states: [
        { stateDefinitionId: "vigente", labelSnapshot: "Vigente", machineId: DEMO_BOND_MACHINE },
        {
          stateDefinitionId: "encerrado",
          labelSnapshot: "Encerrado",
          machineId: DEMO_BOND_MACHINE,
          terminal: true,
        },
      ],
      transitions: [
        {
          transitionDefinitionId: "vigente->encerrado",
          machineId: DEMO_BOND_MACHINE,
          fromStateDefinitionId: "vigente",
          toStateDefinitionId: "encerrado",
          eventTypeDefinitionId: DEMO_EVENT_TYPES.bondConcluded,
          reasonRequired: true,
          allowedReasonDefinitionIds: ["transferencia-demo", "encerramento-demo"],
          requirementTypeIds: ["requisito-documental-demo"],
          requiresInstitutionalAct: true,
        },
        {
          transitionDefinitionId: "encerrado->vigente",
          machineId: DEMO_BOND_MACHINE,
          fromStateDefinitionId: "encerrado",
          toStateDefinitionId: "vigente",
          eventTypeDefinitionId: DEMO_EVENT_TYPES.bondEpisodeOpened,
        },
      ],
    },
  ],
  eventTypes: [
    {
      eventTypeDefinitionId: DEMO_EVENT_TYPES.networkAdmission,
      labelSnapshot: "Ingresso na Rede",
      payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.admission,
      requiredScopeKeys: ["studentId"],
    },
    {
      eventTypeDefinitionId: DEMO_EVENT_TYPES.bondEstablished,
      labelSnapshot: "Vínculo com a unidade estabelecido",
      payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.bond,
      requiredScopeKeys: ["studentId", "bondId", "schoolId"],
    },
    {
      eventTypeDefinitionId: DEMO_EVENT_TYPES.bondEpisodeOpened,
      labelSnapshot: "Novo episódio de vigência do vínculo",
      payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.bond,
      requiredScopeKeys: ["studentId", "bondId", "schoolId"],
    },
    {
      eventTypeDefinitionId: DEMO_EVENT_TYPES.bondConcluded,
      labelSnapshot: "Vínculo com a unidade encerrado",
      payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.bondClosure,
      requiredScopeKeys: ["studentId", "bondId"],
    },
    {
      eventTypeDefinitionId: DEMO_EVENT_TYPES.registryCorrection,
      labelSnapshot: "Retificação cadastral",
      payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.correction,
      requiredScopeKeys: ["personId"],
    },
  ],
  payloadSchemas: [
    {
      payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.admission,
      fields: [{ key: "admissionDate", valueType: "isoDate", required: true }],
    },
    {
      payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.bond,
      fields: [
        { key: "validFrom", valueType: "isoDate", required: true },
        { key: "schoolNameAtEstablishment", valueType: "string", required: false },
      ],
    },
    {
      payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.bondClosure,
      fields: [
        { key: "validUntil", valueType: "isoDate", required: true },
        { key: "closureReasonDefinitionId", valueType: "string", required: true },
      ],
    },
    {
      payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.correction,
      fields: [{ key: "field", valueType: "string", required: true }],
    },
  ],
  coexistencePolicy: {
    policyId: "pol-coexistencia-demo",
    policyVersion: 1,
    natures: [
      {
        natureDefinitionId: DEMO_PARTICIPATION_NATURES.principalSchooling,
        labelSnapshot: "Escolarização principal",
        scopeId: "principal",
      },
      {
        natureDefinitionId: DEMO_PARTICIPATION_NATURES.specializedSupport,
        labelSnapshot: "Atendimento educacional especializado",
        scopeId: "complementar",
        requiresPrincipalParticipation: false,
      },
      {
        natureDefinitionId: DEMO_PARTICIPATION_NATURES.complementary,
        labelSnapshot: "Atividade complementar",
        scopeId: "complementar",
      },
    ],
    rules: [
      {
        ruleId: "regra-principal-aee-demo",
        natureDefinitionIds: [
          DEMO_PARTICIPATION_NATURES.principalSchooling,
          DEMO_PARTICIPATION_NATURES.specializedSupport,
        ],
        compatible: true,
      },
      {
        ruleId: "regra-duas-principais-demo",
        natureDefinitionIds: [
          DEMO_PARTICIPATION_NATURES.principalSchooling,
          DEMO_PARTICIPATION_NATURES.principalSchooling,
        ],
        compatible: false,
        note: "Duas escolarizações principais simultâneas foram declaradas incompatíveis nesta demonstração.",
      },
    ],
    undeclaredCombinationStateId: "inconclusive",
  },
  returnPolicy: {
    policyId: "pol-retorno-demo",
    policyVersion: 1,
    returnStrategyId: "reactivate-episode",
  },
  civilAttributeDefinitions: [
    {
      attributeDefinitionId: "sexo-administrativo",
      labelSnapshot: "Sexo administrativo",
      valueKind: "choice",
      optionDefinitionIds: ["opcao-a-demo", "opcao-b-demo"],
    },
  ],
  absenceReasonDefinitionIds: [
    ABSENCE_REASONS.unknown,
    ABSENCE_REASONS.notInformed,
    ABSENCE_REASONS.notApplicable,
  ],
};
