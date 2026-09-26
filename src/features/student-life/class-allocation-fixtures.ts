/**
 * Etapa 13C — Configuração DEMONSTRATIVA da Enturmação (rascunho).
 *
 * Nada aqui é norma homologada. Limites, efeitos, cardinalidades e semântica
 * temporal são DADO: podem ser integralmente substituídos sem alterar uma linha
 * do motor — e os testes anti-rigidez provam isso com configuração alternativa.
 */
import { DEMO_PARTICIPATION_NATURES } from "./student-life-fixtures";
import type {
  AllocationCardinalityPolicy,
  AllocationCompatibilityPolicy,
  AllocationRequirementPolicy,
  AllocationTimingPolicy,
  ClassAllocationGovernanceConfiguration,
} from "./class-allocation-types";

export const DEMO_CLASS_MACHINE = "turma";
export const DEMO_ALLOCATION_MACHINE = "alocacao-turma";

export const DEMO_ALLOCATION_STATES = {
  active: "alocacao-ativa",
  suspended: "alocacao-suspensa",
  terminated: "alocacao-encerrada",
  annulled: "alocacao-anulada",
} as const;

/** Processos originadores: nenhum deles sugere "ingresso". */
export const DEMO_ALLOCATION_PROCESS_KINDS = {
  initialPlacement: "alocacao-inicial",
  internalMovement: "movimentacao-interna",
  reorganization: "reorganizacao-de-turmas",
  return: "retorno-a-turma",
  administrativeDecision: "decisao-administrativa",
} as const;

export const DEMO_ALLOCATION_EVENT_TYPES = {
  created: "alocacao-turma-constituida",
  terminated: "alocacao-turma-encerrada",
  moved: "alocacao-turma-movimentada",
  rectified: "alocacao-turma-retificada",
} as const;

export const DEMO_ALLOCATION_EFFECTS = {
  prevents: "efeito-impede-alocacao",
  requiresAct: "efeito-exige-ato-autorizador",
  advisory: "efeito-advertencia",
  forwardsAuthorization: "efeito-encaminha-autorizacao",
} as const;

export const DEMO_CAPACITY_BASES = {
  room: "capacidade-por-sala",
  act: "capacidade-por-ato",
  policy: "capacidade-por-politica",
} as const;

export const DEMO_RESERVATION_NATURES = {
  technical: "reserva-tecnica",
  judicial: "reserva-judicial",
} as const;

export const DEMO_TIMING_BOUNDARIES = {
  /** Saída encerra no dia anterior à entrada; sem coexistência na data. */
  previousDayExclusive: "saida-dia-anterior",
  /** Saída e entrada na mesma data, com coexistência declarada admitida. */
  sameDateInclusive: "saida-mesma-data",
} as const;

export const demonstrationAllocationRequirementPolicy: AllocationRequirementPolicy = {
  policyId: "pol-requisitos-alocacao-demo",
  policyVersion: 1,
  effects: [
    {
      effectDefinitionId: DEMO_ALLOCATION_EFFECTS.prevents,
      labelSnapshot: "Impede a alocação",
      preventsTransition: true,
      severity: "blocker",
    },
    {
      effectDefinitionId: DEMO_ALLOCATION_EFFECTS.requiresAct,
      labelSnapshot: "Exige ato autorizador",
      preventsTransition: false,
      requiresInstitutionalAct: true,
      severity: "requirement",
    },
    {
      effectDefinitionId: DEMO_ALLOCATION_EFFECTS.advisory,
      labelSnapshot: "Registra advertência",
      preventsTransition: false,
      severity: "warning",
    },
    {
      effectDefinitionId: DEMO_ALLOCATION_EFFECTS.forwardsAuthorization,
      labelSnapshot: "Encaminha pedido de autorização",
      preventsTransition: false,
      severity: "info",
    },
  ],
  requirements: [
    {
      requirementDefinitionId: "req-capacidade-referencia-demo",
      labelSnapshot: "Ocupação pretendida dentro do limite de referência",
      evaluatorId: "comparacao-ocupacao-limite",
      effectByStatus: {
        "nao-satisfeito": DEMO_ALLOCATION_EFFECTS.requiresAct,
        inconclusivo: DEMO_ALLOCATION_EFFECTS.advisory,
      },
    },
  ],
};

export const demonstrationCardinalityPolicy: AllocationCardinalityPolicy = {
  policyId: "pol-cardinalidade-alocacao-demo",
  policyVersion: 1,
  rules: [
    {
      ruleId: "card-escolarizacao-principal-demo",
      natureDefinitionId: DEMO_PARTICIPATION_NATURES.principalSchooling,
      maxSimultaneousAllocations: 1,
      note: "Nesta demonstração a escolarização principal admite uma alocação simultânea.",
    },
    {
      ruleId: "card-atendimento-especializado-demo",
      natureDefinitionId: DEMO_PARTICIPATION_NATURES.specializedSupport,
      maxSimultaneousAllocations: 2,
      note: "Nesta demonstração o atendimento especializado admite duas alocações simultâneas.",
    },
  ],
  undeclaredNatureStateId: "inconclusive",
};

export const demonstrationCompatibilityPolicy: AllocationCompatibilityPolicy = {
  policyId: "pol-compatibilidade-alocacao-demo",
  policyVersion: 1,
  effects: [
    {
      effectDefinitionId: DEMO_ALLOCATION_EFFECTS.prevents,
      labelSnapshot: "Impede a alocação",
      preventsTransition: true,
      severity: "blocker",
    },
    {
      effectDefinitionId: DEMO_ALLOCATION_EFFECTS.advisory,
      labelSnapshot: "Registra advertência",
      preventsTransition: false,
      severity: "warning",
    },
  ],
  requirements: [
    {
      requirementDefinitionId: "compat-unidade-demo",
      labelSnapshot: "Unidade da turma coincide com a unidade da inscrição",
      dimensionId: "schoolId",
      effectByStatus: {
        "nao-satisfeito": DEMO_ALLOCATION_EFFECTS.prevents,
        inconclusivo: DEMO_ALLOCATION_EFFECTS.prevents,
      },
    },
    {
      requirementDefinitionId: "compat-ciclo-demo",
      labelSnapshot: "Ciclo da turma coincide com o ciclo da inscrição",
      dimensionId: "academicCycleId",
      effectByStatus: {
        "nao-satisfeito": DEMO_ALLOCATION_EFFECTS.prevents,
        inconclusivo: DEMO_ALLOCATION_EFFECTS.prevents,
      },
    },
    {
      requirementDefinitionId: "compat-oferta-demo",
      labelSnapshot: "Oferta da turma coincide com a oferta da inscrição",
      dimensionId: "educationalOfferId",
      effectByStatus: {
        "nao-satisfeito": DEMO_ALLOCATION_EFFECTS.prevents,
        inconclusivo: DEMO_ALLOCATION_EFFECTS.advisory,
      },
    },
    {
      requirementDefinitionId: "compat-organizacao-demo",
      labelSnapshot: "Posição curricular compatível com o agrupamento atendido",
      dimensionId: "academicOrganizationId",
      effectByStatus: {
        "nao-satisfeito": DEMO_ALLOCATION_EFFECTS.prevents,
        inconclusivo: DEMO_ALLOCATION_EFFECTS.advisory,
      },
    },
  ],
};

export const demonstrationTimingPolicy: AllocationTimingPolicy = {
  policyId: "pol-temporalidade-alocacao-demo",
  policyVersion: 1,
  activeBoundaryDefinitionId: DEMO_TIMING_BOUNDARIES.previousDayExclusive,
  boundaries: [
    {
      boundaryDefinitionId: DEMO_TIMING_BOUNDARIES.previousDayExclusive,
      labelSnapshot: "Saída encerra antes da data de entrada",
      originClosureOffsetDays: 0,
      originClosureInclusive: false,
      allowsSameDateCoexistence: false,
    },
    {
      boundaryDefinitionId: DEMO_TIMING_BOUNDARIES.sameDateInclusive,
      labelSnapshot: "Saída e entrada na mesma data",
      originClosureOffsetDays: 0,
      originClosureInclusive: true,
      allowsSameDateCoexistence: true,
    },
  ],
};

export const demonstrationAllocationConfiguration: ClassAllocationGovernanceConfiguration = {
  configurationId: "cfg-enturmacao-demo",
  configurationVersion: 1,
  classMachineId: DEMO_CLASS_MACHINE,
  allocationMachineId: DEMO_ALLOCATION_MACHINE,
  originatingProcesses: [
    {
      processKindId: DEMO_ALLOCATION_PROCESS_KINDS.initialPlacement,
      labelSnapshot: "Alocação inicial",
      requirementPolicyId: demonstrationAllocationRequirementPolicy.policyId,
      initialAllocationStateDefinitionId: DEMO_ALLOCATION_STATES.active,
    },
    {
      processKindId: DEMO_ALLOCATION_PROCESS_KINDS.internalMovement,
      labelSnapshot: "Movimentação interna entre turmas",
      requirementPolicyId: demonstrationAllocationRequirementPolicy.policyId,
      initialAllocationStateDefinitionId: DEMO_ALLOCATION_STATES.active,
    },
    {
      processKindId: DEMO_ALLOCATION_PROCESS_KINDS.reorganization,
      labelSnapshot: "Reorganização de turmas",
      requirementPolicyId: demonstrationAllocationRequirementPolicy.policyId,
      initialAllocationStateDefinitionId: DEMO_ALLOCATION_STATES.active,
    },
    {
      processKindId: DEMO_ALLOCATION_PROCESS_KINDS.return,
      labelSnapshot: "Retorno à turma",
      initialAllocationStateDefinitionId: DEMO_ALLOCATION_STATES.active,
    },
    {
      processKindId: DEMO_ALLOCATION_PROCESS_KINDS.administrativeDecision,
      labelSnapshot: "Decisão administrativa",
      requiresInstitutionalAct: true,
      initialAllocationStateDefinitionId: DEMO_ALLOCATION_STATES.active,
    },
  ],
  cardinalityPolicy: demonstrationCardinalityPolicy,
  compatibilityPolicy: demonstrationCompatibilityPolicy,
  timingPolicy: demonstrationTimingPolicy,
  requirementPolicies: [demonstrationAllocationRequirementPolicy],
};
