/**
 * Etapa 13B — Configuração DEMONSTRATIVA da Inscrição Letiva (rascunho).
 *
 * Nada aqui é norma homologada. Todos os identificadores são DADO: estados,
 * ritos, requisitos, efeitos, prazos e escopos de comparação podem ser
 * integralmente substituídos sem alterar uma linha do motor — e o teste
 * anti-rigidez prova exatamente isso com uma configuração fictícia alternativa.
 */
import { DEMO_PARTICIPATION_NATURES } from "./student-life-fixtures";
import type {
  StudentLifeStateMachine,
} from "./student-life-types";
import type {
  CycleEnrollmentGovernanceConfiguration,
  EnrollmentRequirementPolicy,
} from "./cycle-enrollment-types";

export const DEMO_ENROLLMENT_MACHINE = "inscricao-ciclo";
export const DEMO_PARTICIPATION_MACHINE = "participacao-ciclo";
export const DEMO_REQUEST_MACHINE = "requerimento-matricula";

export const DEMO_ENROLLMENT_STATES = {
  constituted: "inscricao-constituida",
  inProgress: "inscricao-em-andamento",
  interrupted: "inscricao-interrompida",
  concluded: "inscricao-concluida",
  annulled: "inscricao-anulada",
} as const;

export const DEMO_REQUEST_STATES = {
  received: "requerimento-recebido",
  underReview: "requerimento-em-analise",
  granted: "requerimento-deferido",
  denied: "requerimento-indeferido",
  cancelled: "requerimento-cancelado",
} as const;

export const DEMO_ENROLLMENT_EVENT_TYPES = {
  constituted: "inscricao-ciclo-efetivada",
  stateChanged: "inscricao-ciclo-estado-alterado",
  corrected: "inscricao-ciclo-retificada",
  participationOpened: "participacao-ciclo-aberta",
  participationClosed: "participacao-ciclo-encerrada",
  requestRegistered: "solicitacao-matricula-registrada",
  requestResolved: "solicitacao-matricula-resolvida",
} as const;

export const DEMO_PROCESS_KINDS = {
  initialAdmission: "matricula-inicial",
  renewal: "rematricula-continuidade",
  reintegration: "reintegracao",
} as const;

export const DEMO_REQUIREMENT_EFFECTS = {
  preventsConstitution: "efeito-impede-constituicao",
  allowsWithDeadline: "efeito-permite-com-prazo",
  advisoryOnly: "efeito-advertencia",
  requiresAuthorization: "efeito-exige-autorizacao",
} as const;

export const DEMO_DEADLINE_ORIGIN_KINDS = {
  fromRule: "prazo-da-regra",
  computed: "prazo-calculado",
  grantedIndividually: "prazo-concedido",
  byAct: "prazo-por-ato",
} as const;

export const DEMO_COEXISTENCE_SCOPES = {
  sameSchool: "mesma-unidade",
  distinctSchools: "unidades-distintas",
} as const;

export const demonstrationEnrollmentMachines: readonly StudentLifeStateMachine[] = [
  {
    machineId: DEMO_ENROLLMENT_MACHINE,
    states: [
      {
        stateDefinitionId: DEMO_ENROLLMENT_STATES.constituted,
        labelSnapshot: "Inscrição constituída",
        machineId: DEMO_ENROLLMENT_MACHINE,
      },
      {
        stateDefinitionId: DEMO_ENROLLMENT_STATES.inProgress,
        labelSnapshot: "Em andamento",
        machineId: DEMO_ENROLLMENT_MACHINE,
      },
      {
        stateDefinitionId: DEMO_ENROLLMENT_STATES.interrupted,
        labelSnapshot: "Interrompida",
        machineId: DEMO_ENROLLMENT_MACHINE,
      },
      {
        stateDefinitionId: DEMO_ENROLLMENT_STATES.concluded,
        labelSnapshot: "Concluída",
        machineId: DEMO_ENROLLMENT_MACHINE,
        terminal: true,
      },
      {
        stateDefinitionId: DEMO_ENROLLMENT_STATES.annulled,
        labelSnapshot: "Anulada",
        machineId: DEMO_ENROLLMENT_MACHINE,
        terminal: true,
      },
    ],
    transitions: [
      {
        transitionDefinitionId: "insc-constituida-para-andamento",
        machineId: DEMO_ENROLLMENT_MACHINE,
        fromStateDefinitionId: DEMO_ENROLLMENT_STATES.constituted,
        toStateDefinitionId: DEMO_ENROLLMENT_STATES.inProgress,
        eventTypeDefinitionId: DEMO_ENROLLMENT_EVENT_TYPES.stateChanged,
      },
      {
        transitionDefinitionId: "insc-andamento-para-interrompida",
        machineId: DEMO_ENROLLMENT_MACHINE,
        fromStateDefinitionId: DEMO_ENROLLMENT_STATES.inProgress,
        toStateDefinitionId: DEMO_ENROLLMENT_STATES.interrupted,
        eventTypeDefinitionId: DEMO_ENROLLMENT_EVENT_TYPES.stateChanged,
        reasonRequired: true,
      },
      {
        transitionDefinitionId: "insc-andamento-para-concluida",
        machineId: DEMO_ENROLLMENT_MACHINE,
        fromStateDefinitionId: DEMO_ENROLLMENT_STATES.inProgress,
        toStateDefinitionId: DEMO_ENROLLMENT_STATES.concluded,
        eventTypeDefinitionId: DEMO_ENROLLMENT_EVENT_TYPES.stateChanged,
      },
      {
        transitionDefinitionId: "insc-andamento-para-anulada",
        machineId: DEMO_ENROLLMENT_MACHINE,
        fromStateDefinitionId: DEMO_ENROLLMENT_STATES.inProgress,
        toStateDefinitionId: DEMO_ENROLLMENT_STATES.annulled,
        eventTypeDefinitionId: DEMO_ENROLLMENT_EVENT_TYPES.corrected,
        reasonRequired: true,
        requiresInstitutionalAct: true,
      },
    ],
  },
];

export const demonstrationRequirementPolicy: EnrollmentRequirementPolicy = {
  policyId: "pol-requisitos-inscricao-demo",
  policyVersion: 1,
  effects: [
    {
      effectDefinitionId: DEMO_REQUIREMENT_EFFECTS.preventsConstitution,
      labelSnapshot: "Impede a constituição da inscrição",
      preventsTransition: true,
      severity: "blocker",
    },
    {
      effectDefinitionId: DEMO_REQUIREMENT_EFFECTS.allowsWithDeadline,
      labelSnapshot: "Permite com prazo de regularização",
      preventsTransition: false,
      requiresRegularizationDeadline: true,
      severity: "requirement",
    },
    {
      effectDefinitionId: DEMO_REQUIREMENT_EFFECTS.advisoryOnly,
      labelSnapshot: "Registra advertência",
      preventsTransition: false,
      severity: "warning",
    },
    {
      effectDefinitionId: DEMO_REQUIREMENT_EFFECTS.requiresAuthorization,
      labelSnapshot: "Exige autorização por ato institucional",
      preventsTransition: false,
      requiresInstitutionalAct: true,
      severity: "requirement",
    },
  ],
  requirements: [
    {
      requirementDefinitionId: "req-documento-identificacao-demo",
      labelSnapshot: "Documento de identificação apresentado",
      evaluatorId: "declaracao-estruturada",
      effectByStatus: {
        "nao-satisfeito": DEMO_REQUIREMENT_EFFECTS.allowsWithDeadline,
        inconclusivo: DEMO_REQUIREMENT_EFFECTS.advisoryOnly,
      },
    },
    {
      requirementDefinitionId: "req-responsavel-declarado-demo",
      labelSnapshot: "Responsável legal declarado",
      evaluatorId: "presenca-de-atributo",
      parameters: { attributeKey: "responsavelDeclarado" },
      effectByStatus: {
        "nao-satisfeito": DEMO_REQUIREMENT_EFFECTS.preventsConstitution,
        inconclusivo: DEMO_REQUIREMENT_EFFECTS.preventsConstitution,
      },
    },
  ],
};

export const demonstrationEnrollmentConfiguration: CycleEnrollmentGovernanceConfiguration = {
  configurationId: "cfg-inscricao-letiva-demo",
  configurationVersion: 1,
  enrollmentMachineId: DEMO_ENROLLMENT_MACHINE,
  participationMachineId: DEMO_PARTICIPATION_MACHINE,
  requestMachineId: DEMO_REQUEST_MACHINE,
  admissionProcesses: [
    {
      processKindId: DEMO_PROCESS_KINDS.initialAdmission,
      labelSnapshot: "Matrícula inicial",
      requirementPolicyId: demonstrationRequirementPolicy.policyId,
      initialEnrollmentStateDefinitionId: DEMO_ENROLLMENT_STATES.constituted,
    },
    {
      processKindId: DEMO_PROCESS_KINDS.renewal,
      labelSnapshot: "Rematrícula por continuidade",
      requiresExistingSchoolBond: true,
      requirementPolicyId: demonstrationRequirementPolicy.policyId,
      initialEnrollmentStateDefinitionId: DEMO_ENROLLMENT_STATES.constituted,
    },
    {
      processKindId: DEMO_PROCESS_KINDS.reintegration,
      labelSnapshot: "Reintegração por requerimento",
      requiresOriginatingRequest: true,
      initialEnrollmentStateDefinitionId: DEMO_ENROLLMENT_STATES.constituted,
    },
  ],
  requirementPolicies: [demonstrationRequirementPolicy],
  requestStateCapabilities: [
    { requestStateDefinitionId: DEMO_REQUEST_STATES.received, allowsEnrollmentCreation: false },
    { requestStateDefinitionId: DEMO_REQUEST_STATES.underReview, allowsEnrollmentCreation: false },
    { requestStateDefinitionId: DEMO_REQUEST_STATES.granted, allowsEnrollmentCreation: true },
    { requestStateDefinitionId: DEMO_REQUEST_STATES.denied, allowsEnrollmentCreation: false },
    { requestStateDefinitionId: DEMO_REQUEST_STATES.cancelled, allowsEnrollmentCreation: false },
  ],
  coexistencePolicy: {
    policyId: "pol-coexistencia-inscricoes-demo",
    policyVersion: 1,
    comparisonScopeIds: [DEMO_COEXISTENCE_SCOPES.sameSchool, DEMO_COEXISTENCE_SCOPES.distinctSchools],
    rules: [
      {
        ruleId: "coex-principal-aee-unidades-distintas-demo",
        natureDefinitionIds: [
          DEMO_PARTICIPATION_NATURES.principalSchooling,
          DEMO_PARTICIPATION_NATURES.specializedSupport,
        ],
        comparisonScopeId: DEMO_COEXISTENCE_SCOPES.distinctSchools,
        compatible: true,
        note: "Escolarização em uma unidade e atendimento especializado em outra coexistem nesta demonstração.",
      },
      {
        ruleId: "coex-principal-aee-mesma-unidade-demo",
        natureDefinitionIds: [
          DEMO_PARTICIPATION_NATURES.principalSchooling,
          DEMO_PARTICIPATION_NATURES.specializedSupport,
        ],
        comparisonScopeId: DEMO_COEXISTENCE_SCOPES.sameSchool,
        compatible: true,
      },
      {
        ruleId: "coex-duas-principais-demo",
        natureDefinitionIds: [
          DEMO_PARTICIPATION_NATURES.principalSchooling,
          DEMO_PARTICIPATION_NATURES.principalSchooling,
        ],
        comparisonScopeId: DEMO_COEXISTENCE_SCOPES.distinctSchools,
        compatible: false,
        note: "Duas escolarizações principais simultâneas foram declaradas incompatíveis nesta demonstração.",
      },
    ],
    undeclaredCombinationStateId: "inconclusive",
  },
};
