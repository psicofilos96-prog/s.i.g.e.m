/**
 * Etapa 13D — Testes da Mobilidade e Transferência Institucional.
 *
 * Os cenários provam ARQUITETURA, nunca norma: nenhuma configuração aqui é regra
 * homologada da Rede. Os testes anti-rigidez substituem integralmente a
 * configuração — estágios, ritos, efeitos, executores e política de projeção de
 * situação — para demonstrar que o motor não conhece nenhum deles.
 */
import { describe, expect, it } from "vitest";
import { DEMO_PARTICIPATION_NATURES } from "./student-life-fixtures";
import type { InstitutionalActReference, StudentLifeProvenance } from "./student-life-types";
import type { AcademicCycleEnrollment, CycleParticipation } from "./cycle-enrollment-types";
import type { ClassAllocation } from "./class-allocation-types";
import {
  DEMO_ALLOCATION_PROCESS_KINDS,
  DEMO_ALLOCATION_STATES,
  DEMO_TIMING_BOUNDARIES,
  demonstrationTimingPolicy,
} from "./class-allocation-fixtures";
import {
  DEMO_MOBILITY_FACT_TYPES,
  DEMO_TRANSFER_ABSENCE_REASONS,
  DEMO_TRANSFER_CONTEXT_TYPES,
  DEMO_TRANSFER_DOCUMENT_STATUSES,
  DEMO_TRANSFER_DOCUMENT_TYPES,
  DEMO_TRANSFER_EFFECTS,
  DEMO_TRANSFER_PROCESS_KINDS,
  DEMO_TRANSFER_REASONS,
  DEMO_TRANSFER_SITUATIONS,
  DEMO_TRANSFER_STAGES,
  DEMO_TRANSFER_TRANSITIONS,
  DEMO_TRANSITION_INTERVAL_KINDS,
  demonstrationSituationProjectionPolicy,
  demonstrationTransferConfiguration,
} from "./transfer-fixtures";
import {
  createTransferEffectRegistry,
  registerTransferEffectExecutor,
  type TransferEffectExecutor,
} from "./transfer-effects";
import {
  planTransferTransition,
  rectifyProcessVersion,
  TRANSFER_FACT_KEYS,
  validateMobilityPole,
} from "./transfer-governance";
import {
  currentProcessVersion,
  currentStageOf,
  currentTransitions,
  isContextKnown,
  processVersionAsKnownAt,
  processVersionCount,
  stageAsKnownAt,
  stageOnDate,
  studentTransitionIntervalsOn,
  transitionIntervalCovers,
} from "./transfer-ledger";
import {
  studentMobilityAtomicFactRows,
  transferProcessFactRows,
  transferTransitionFactRows,
  transitionIntervalFactRows,
} from "./transfer-analytics";
import { projectStudentLifeSituations } from "./transfer-life-projection";
import { TRANSFER_DIAGNOSTIC_CODES as CODES } from "./transfer-diagnostics";
import {
  destinationPoleFromLegacyDraft,
  externalInstitutionContextReference,
  networkUnitContextReference,
  processKindFromLegacyKind,
} from "./transfer-adapters";
import type {
  InstitutionalTransferGovernanceConfiguration,
  InstitutionalTransferProcess,
  StudentLifeSituationProjectionPolicy,
  TransferDefinitionSnapshot,
  TransferProcessVersionRecord,
  TransferStageTransitionRecord,
} from "./transfer-types";

const provenance = (recordedAt: string): StudentLifeProvenance => ({
  originTypeId: "atendimento-presencial",
  recordedAt,
});

const ACT: InstitutionalActReference = {
  actId: "ato-1",
  actTypeId: "portaria",
  actDate: "2027-05-10",
};

const SNAPSHOT: TransferDefinitionSnapshot = {
  governanceConfiguration: { definitionId: "cfg-mobilidade-institucional-demo", definitionVersion: 1 },
  participationEffectPolicy: {
    definitionId: "pol-efeito-participacoes-transferencia-demo",
    definitionVersion: 1,
  },
  schoolBondEffectPolicy: {
    definitionId: "pol-efeito-vinculo-transferencia-demo",
    definitionVersion: 1,
  },
};

const enrollment: AcademicCycleEnrollment = {
  cycleEnrollmentId: "insc-1",
  studentId: "alu-1",
  schoolBondId: "vin-1",
  schoolId: "esc-1",
  academicCycleId: "ciclo-a",
  educationalOfferId: "of-1",
  curriculumMatrixIds: ["mc-1"],
  admissionProcessKindId: "matricula-inicial",
  enrollmentStateDefinitionId: "inscricao-constituida",
  validity: { validFrom: "2027-02-01", validUntil: null },
  definitionSnapshot: {
    academicCycle: { definitionId: "ciclo-a" },
    educationalOffer: { definitionId: "of-1" },
    curriculumMatrices: [{ definitionId: "mc-1" }],
    governanceConfiguration: { definitionId: "cfg-inscricao-letiva-demo", definitionVersion: 1 },
  },
  recordVersion: 1,
  sourceEventIds: [],
  provenance: provenance("2027-02-01T10:00:00.000Z"),
};

function makeParticipation(
  participationId: string,
  natureDefinitionId: string,
): CycleParticipation {
  return {
    participationId,
    cycleEnrollmentId: "insc-1",
    natureDefinitionId,
    participationStateDefinitionId: "participacao-ativa",
    validity: { validFrom: "2027-02-01", validUntil: null },
    recordVersion: 1,
    sourceEventIds: [],
    provenance: provenance("2027-02-01T10:00:00.000Z"),
  };
}

const participation = makeParticipation("part-1", DEMO_PARTICIPATION_NATURES.principalSchooling);

const allocation: ClassAllocation = {
  allocationId: "aloc-1",
  participationId: "part-1",
  classId: "turma-501",
  denormalized: { cycleEnrollmentId: "insc-1", studentId: "alu-1", schoolId: "esc-1" },
  originatingProcessKindId: DEMO_ALLOCATION_PROCESS_KINDS.initialPlacement,
  allocationStateDefinitionId: DEMO_ALLOCATION_STATES.active,
  validity: { validFrom: "2027-02-01", validUntil: null },
  definitionSnapshot: {
    academicClass: { definitionId: "turma-501", definitionVersion: 1 },
    curriculumMatrices: [{ definitionId: "mc-1", definitionVersion: 1 }],
    cardinalityPolicy: { definitionId: "pol-cardinalidade-alocacao-demo", definitionVersion: 1 },
    compatibilityPolicy: { definitionId: "pol-compatibilidade-alocacao-demo", definitionVersion: 1 },
    timingPolicy: { definitionId: "pol-temporalidade-alocacao-demo", definitionVersion: 1 },
  },
  recordVersion: 1,
  sourceEventIds: [],
  provenance: provenance("2027-02-01T10:00:00.000Z"),
};

const process: InstitutionalTransferProcess = {
  transferProcessId: "mob-1",
  studentId: "alu-1",
  processKindDefinitionId: DEMO_TRANSFER_PROCESS_KINDS.networkExit,
  provenance: provenance("2027-05-10T09:00:00.000Z"),
};

function makeVersion(
  overrides: Partial<TransferProcessVersionRecord> = {},
): TransferProcessVersionRecord {
  return {
    transferProcessVersionId: "mob-1-v1",
    transferProcessId: "mob-1",
    precedingVersionId: null,
    studentId: "alu-1",
    processKindDefinitionId: DEMO_TRANSFER_PROCESS_KINDS.networkExit,
    originPole: {
      reference: networkUnitContextReference({
        schoolId: "esc-1",
        schoolBondId: "vin-1",
        cycleEnrollmentId: "insc-1",
      }),
    },
    destinationPole: {
      reference: externalInstitutionContextReference({
        institutionName: "Escola Estadual Central",
        federativeUnit: "SP",
      }),
    },
    timingBoundaryDefinitionId: DEMO_TIMING_BOUNDARIES.previousDayExclusive,
    definitionSnapshot: SNAPSHOT,
    provenance: provenance("2027-05-10T09:00:00.000Z"),
    ...overrides,
  };
}

function openTransition(
  overrides: Partial<TransferStageTransitionRecord> = {},
): TransferStageTransitionRecord {
  return {
    transitionId: "tr-1",
    transferProcessId: "mob-1",
    transitionDefinitionId: DEMO_TRANSFER_TRANSITIONS.open,
    sequenceNumber: 1,
    fromStageDefinitionId: null,
    toStageDefinitionId: DEMO_TRANSFER_STAGES.requested,
    reasonDefinitionId: DEMO_TRANSFER_REASONS.addressChange,
    effectiveDate: "2027-05-10",
    isCorrection: false,
    precedingTransitionId: null,
    provenance: provenance("2027-05-10T09:00:00.000Z"),
    ...overrides,
  };
}

function reviewTransition(): TransferStageTransitionRecord {
  return {
    transitionId: "tr-2",
    transferProcessId: "mob-1",
    transitionDefinitionId: DEMO_TRANSFER_TRANSITIONS.review,
    sequenceNumber: 2,
    fromStageDefinitionId: DEMO_TRANSFER_STAGES.requested,
    toStageDefinitionId: DEMO_TRANSFER_STAGES.underReview,
    effectiveDate: "2027-05-11",
    isCorrection: false,
    precedingTransitionId: null,
    provenance: provenance("2027-05-11T09:00:00.000Z"),
  };
}

const registry = createTransferEffectRegistry();

function planDeparture(
  options: {
    participations?: readonly CycleParticipation[];
    bondEnrollments?: readonly AcademicCycleEnrollment[];
    originatingAct?: InstitutionalActReference;
    configuration?: InstitutionalTransferGovernanceConfiguration;
    version?: TransferProcessVersionRecord;
  } = {},
) {
  return planTransferTransition({
    configuration: options.configuration ?? demonstrationTransferConfiguration,
    process,
    version: options.version ?? makeVersion(),
    existingTransitions: [openTransition(), reviewTransition()],
    transitionDefinitionId: DEMO_TRANSFER_TRANSITIONS.recordDeparture,
    transitionId: "tr-3",
    effectiveDate: "2027-05-20",
    ...(options.originatingAct === undefined ? {} : { originatingAct: options.originatingAct }),
    impactedParticipations: options.participations ?? [participation],
    impactedAllocations: [allocation],
    impactedEnrollments: [enrollment],
    bondEnrollments: options.bondEnrollments ?? [enrollment],
    impactedBondIds: ["vin-1"],
    timingPolicy: demonstrationTimingPolicy,
    effectRegistry: registry,
    provenance: provenance("2027-05-20T09:00:00.000Z"),
  });
}

describe("13D — estágio vigente derivado do ledger", () => {
  it("deduz o estágio das transições, sem campo gravado", () => {
    const ledger = [openTransition(), reviewTransition()];
    expect(currentStageOf(ledger, "mob-1")).toBe(DEMO_TRANSFER_STAGES.underReview);
    expect(stageOnDate(ledger, "mob-1", "2027-05-10")).toBe(DEMO_TRANSFER_STAGES.requested);
    expect(stageAsKnownAt(ledger, "mob-1", "2027-05-10T12:00:00.000Z")).toBe(
      DEMO_TRANSFER_STAGES.requested,
    );
  });

  it("recusa transição incompatível com o estágio deduzido", () => {
    const plan = planTransferTransition({
      configuration: demonstrationTransferConfiguration,
      process,
      version: makeVersion(),
      existingTransitions: [openTransition(), reviewTransition()],
      transitionDefinitionId: DEMO_TRANSFER_TRANSITIONS.cancel,
      transitionId: "tr-x",
      effectiveDate: "2027-05-20",
      reasonDefinitionId: DEMO_TRANSFER_REASONS.withdrawal,
      effectRegistry: registry,
      provenance: provenance("2027-05-20T09:00:00.000Z"),
    });
    expect(plan.allowed).toBe(false);
    expect(plan.transition).toBeNull();
    expect(plan.diagnostics.some((item) => item.code === CODES.transitionStageMismatch)).toBe(true);
  });

  it("exige motivo quando a transição configurada o exigir", () => {
    const plan = planTransferTransition({
      configuration: demonstrationTransferConfiguration,
      process,
      version: makeVersion(),
      existingTransitions: [],
      transitionDefinitionId: DEMO_TRANSFER_TRANSITIONS.open,
      transitionId: "tr-1",
      effectiveDate: "2027-05-10",
      effectRegistry: registry,
      provenance: provenance("2027-05-10T09:00:00.000Z"),
    });
    expect(plan.allowed).toBe(false);
    expect(plan.diagnostics.some((item) => item.code === CODES.transitionReasonMissing)).toBe(true);
  });
});

describe("13D — transição atômica de saída e efeitos configurados", () => {
  it("aplica os efeitos declarados e registra a transição no ledger", () => {
    const plan = planDeparture({ originatingAct: ACT });
    expect(plan.allowed).toBe(true);
    expect(plan.transition?.toStageDefinitionId).toBe(DEMO_TRANSFER_STAGES.departureRecorded);
    expect(plan.transition?.sequenceNumber).toBe(3);
    expect(plan.originClosureDate).toBe("2027-05-19");

    const allocationAction = plan.actions.find((item) => item.targetKindId === "class-allocation");
    expect(allocationAction?.parameters?.["validUntil"]).toBe("2027-05-19");

    const participationAction = plan.actions.find(
      (item) => item.targetKindId === "cycle-participation",
    );
    expect(participationAction?.actionKindDefinitionId).toBe(
      DEMO_TRANSFER_EFFECTS.closeParticipation,
    );

    const bondAction = plan.actions.find(
      (item) => item.targetKindId === "school-institutional-bond",
    );
    expect(bondAction?.actionKindDefinitionId).toBe(DEMO_TRANSFER_EFFECTS.closeBond);

    expect(plan.facts.numericFacts[TRANSFER_FACT_KEYS.remainingEnrollmentsInBond]).toBe(0);
  });

  it("não encerra nada quando o requisito configurado impede a transição", () => {
    const plan = planDeparture();
    expect(plan.allowed).toBe(false);
    expect(plan.transition).toBeNull();
    expect(plan.actions).toHaveLength(0);
  });

  it("fica inconclusiva quando a política não declara efeito para uma participação", () => {
    const complementary = makeParticipation("part-2", "nat-atendimento-complementar-demo");
    const plan = planDeparture({
      originatingAct: ACT,
      participations: [participation, complementary],
    });
    expect(plan.allowed).toBeNull();
    expect(plan.transition).toBeNull();
    expect(plan.actions).toHaveLength(0);
    expect(plan.diagnostics.some((item) => item.code === CODES.participationEffectUndeclared)).toBe(
      true,
    );
  });

  it("mantém o vínculo quando restam inscrições vigentes — por regra cadastrada", () => {
    const other: AcademicCycleEnrollment = {
      ...enrollment,
      cycleEnrollmentId: "insc-2",
      educationalOfferId: "of-2",
    };
    const plan = planDeparture({
      originatingAct: ACT,
      bondEnrollments: [enrollment, other],
    });
    expect(plan.allowed).toBe(true);
    expect(plan.facts.numericFacts[TRANSFER_FACT_KEYS.remainingEnrollmentsInBond]).toBe(1);
    const bondAction = plan.actions.find(
      (item) => item.targetKindId === "school-institutional-bond",
    );
    expect(bondAction?.actionKindDefinitionId).toBe(DEMO_TRANSFER_EFFECTS.keepBond);
  });

  it("não encerra vigência quando a política temporal não é resolvida", () => {
    const plan = planTransferTransition({
      configuration: demonstrationTransferConfiguration,
      process,
      version: makeVersion(),
      existingTransitions: [openTransition(), reviewTransition()],
      transitionDefinitionId: DEMO_TRANSFER_TRANSITIONS.recordDeparture,
      transitionId: "tr-3",
      effectiveDate: "2027-05-20",
      originatingAct: ACT,
      impactedParticipations: [participation],
      impactedAllocations: [allocation],
      impactedEnrollments: [enrollment],
      impactedBondIds: ["vin-1"],
      effectRegistry: registry,
      provenance: provenance("2027-05-20T09:00:00.000Z"),
    });
    expect(plan.originClosureDate).toBeNull();
    expect(plan.allowed).toBeNull();
    expect(plan.actions).toHaveLength(0);
    expect(plan.diagnostics.some((item) => item.code === CODES.timingBoundaryUndeclared)).toBe(true);
  });
});

describe("13D — polos simétricos e ausência epistêmica", () => {
  const scope = { studentId: "alu-1" };

  it("aceita ausência de destino registrada com motivo estruturado", () => {
    const pole = {
      reference: null,
      absence: {
        absenceReasonDefinitionId: DEMO_TRANSFER_ABSENCE_REASONS.notInformedByDeclarant,
        declarant: { declarantRoleDefinitionId: "papel-declarante-responsavel-legal-demo" },
        provenance: provenance("2027-05-20T09:00:00.000Z"),
      },
    };
    const result = validateMobilityPole(
      pole,
      demonstrationTransferConfiguration,
      scope,
      "destino",
    );
    expect(result.allowed).toBe(true);
    expect(isContextKnown(pole)).toBe(false);
  });

  it("recusa polo sem referência e sem ausência registrada", () => {
    const result = validateMobilityPole(
      { reference: null },
      demonstrationTransferConfiguration,
      scope,
      "destino",
    );
    expect(result.allowed).toBe(false);
    expect(result.diagnostics.some((item) => item.code === CODES.poleUndetermined)).toBe(true);
  });

  it("recusa polo ambíguo com referência e ausência simultâneas", () => {
    const result = validateMobilityPole(
      {
        reference: networkUnitContextReference({ schoolId: "esc-2" }),
        absence: {
          absenceReasonDefinitionId: DEMO_TRANSFER_ABSENCE_REASONS.notInformedByDeclarant,
          provenance: provenance("2027-05-20T09:00:00.000Z"),
        },
      },
      demonstrationTransferConfiguration,
      scope,
      "destino",
    );
    expect(result.allowed).toBe(false);
    expect(result.diagnostics.some((item) => item.code === CODES.poleAmbiguous)).toBe(true);
  });

  it("valida os atributos do polo contra o schema declarado", () => {
    const result = validateMobilityPole(
      {
        reference: {
          contextReferenceTypeDefinitionId: DEMO_TRANSFER_CONTEXT_TYPES.externalInstitution,
          payloadSchemaDefinitionId: "schema-contexto-instituicao-externa-demo",
          attributes: { federativeUnit: "SP" },
        },
      },
      demonstrationTransferConfiguration,
      scope,
      "destino",
    );
    expect(result.allowed).toBe(false);
    expect(result.diagnostics.some((item) => item.code === CODES.contextFieldMissing)).toBe(true);
  });

  it("trata ingresso externo com a MESMA máquina, apenas invertendo os polos", () => {
    const entryProcess: InstitutionalTransferProcess = {
      transferProcessId: "mob-2",
      studentId: "alu-9",
      processKindDefinitionId: DEMO_TRANSFER_PROCESS_KINDS.networkEntry,
      provenance: provenance("2027-05-21T09:00:00.000Z"),
    };
    const plan = planTransferTransition({
      configuration: demonstrationTransferConfiguration,
      process: entryProcess,
      version: makeVersion({
        transferProcessVersionId: "mob-2-v1",
        transferProcessId: "mob-2",
        studentId: "alu-9",
        processKindDefinitionId: DEMO_TRANSFER_PROCESS_KINDS.networkEntry,
        originPole: {
          reference: externalInstitutionContextReference({ institutionName: "Colégio Externo" }),
        },
        destinationPole: { reference: networkUnitContextReference({ schoolId: "esc-1" }) },
      }),
      existingTransitions: [],
      transitionDefinitionId: DEMO_TRANSFER_TRANSITIONS.open,
      transitionId: "tr-e1",
      effectiveDate: "2027-05-21",
      reasonDefinitionId: DEMO_TRANSFER_REASONS.familyRequest,
      effectRegistry: registry,
      provenance: provenance("2027-05-21T09:00:00.000Z"),
    });
    expect(plan.allowed).toBe(true);
    expect(plan.transition?.toStageDefinitionId).toBe(DEMO_TRANSFER_STAGES.requested);
  });
});

describe("13D — intervalo institucional de transição", () => {
  const interval = {
    transitionIntervalId: "int-1",
    transferProcessId: "mob-1",
    transitionKindDefinitionId: DEMO_TRANSITION_INTERVAL_KINDS.regulatoryTransit,
    startDate: "2027-05-20",
    deadlineDate: "2027-06-05",
    concludedDate: null,
    provenance: provenance("2027-05-20T09:00:00.000Z"),
  };

  it("projeta cobertura do intervalo sem imputar falta ou abandono", () => {
    expect(transitionIntervalCovers(interval, "2027-05-25")).toBe(true);
    expect(transitionIntervalCovers(interval, "2027-06-10")).toBe(false);
    const versions = [makeVersion({ transitionInterval: interval })];
    expect(studentTransitionIntervalsOn(versions, "alu-1", "2027-05-25")).toHaveLength(1);
  });

  it("recusa natureza de intervalo não cadastrada", () => {
    const plan = planDeparture({
      originatingAct: ACT,
      version: makeVersion({
        transitionInterval: { ...interval, transitionKindDefinitionId: "intervalo-inventado" },
      }),
    });
    expect(plan.allowed).toBe(false);
    expect(
      plan.diagnostics.some((item) => item.code === CODES.transitionIntervalKindUndeclared),
    ).toBe(true);
  });
});

describe("13D — retificação sem reescrita do histórico", () => {
  it("cria nova versão encadeada preservando a identidade do processo", () => {
    const first = makeVersion();
    const result = rectifyProcessVersion({
      configuration: demonstrationTransferConfiguration,
      currentVersion: first,
      changes: {
        destinationPole: {
          reference: externalInstitutionContextReference({ institutionName: "Escola Correta" }),
        },
      },
      newVersionId: "mob-1-v2",
      provenance: {
        ...provenance("2027-06-01T09:00:00.000Z"),
        correctionReasonDefinitionId: "motivo-erro-de-digitacao",
      },
    });
    expect(result.allowed).toBe(true);
    const versions = [first, result.version!];
    expect(processVersionCount(versions, "mob-1")).toBe(2);
    expect(currentProcessVersion(versions, "mob-1")?.transferProcessVersionId).toBe("mob-1-v2");
    expect(currentProcessVersion(versions, "mob-1")?.transferProcessId).toBe("mob-1");
    expect(
      processVersionAsKnownAt(versions, "mob-1", "2027-05-15T00:00:00.000Z")
        ?.transferProcessVersionId,
    ).toBe("mob-1-v1");
  });

  it("recusa retificação sem motivo estruturado", () => {
    const result = rectifyProcessVersion({
      configuration: demonstrationTransferConfiguration,
      currentVersion: makeVersion(),
      changes: {},
      newVersionId: "mob-1-v2",
      provenance: provenance("2027-06-01T09:00:00.000Z"),
    });
    expect(result.allowed).toBe(false);
    expect(result.version).toBeNull();
    expect(result.diagnostics.some((item) => item.code === CODES.correctionReasonMissing)).toBe(
      true,
    );
  });

  it("mantém a transição anterior no ledger e a exclui da leitura vigente", () => {
    const corrected: TransferStageTransitionRecord = {
      ...openTransition(),
      transitionId: "tr-1-corrigida",
      effectiveDate: "2027-05-12",
      isCorrection: true,
      precedingTransitionId: "tr-1",
      provenance: provenance("2027-06-01T09:00:00.000Z"),
    };
    const ledger = [openTransition(), corrected];
    expect(ledger).toHaveLength(2);
    const current = currentTransitions(ledger, "mob-1");
    expect(current).toHaveLength(1);
    expect(current[0]?.effectiveDate).toBe("2027-05-12");
  });
});

describe("13D — fatos atômicos para o CIECE", () => {
  const versions = [
    makeVersion({
      transitionInterval: {
        transitionIntervalId: "int-1",
        transferProcessId: "mob-1",
        transitionKindDefinitionId: DEMO_TRANSITION_INTERVAL_KINDS.regulatoryTransit,
        startDate: "2027-05-20",
        deadlineDate: "2027-06-05",
        concludedDate: null,
        provenance: provenance("2027-05-20T09:00:00.000Z"),
      },
      documents: [
        {
          documentRecordId: "doc-1",
          transferProcessId: "mob-1",
          documentTypeDefinitionId: DEMO_TRANSFER_DOCUMENT_TYPES.transferGuide,
          documentStatusDefinitionId: DEMO_TRANSFER_DOCUMENT_STATUSES.issued,
          provenance: provenance("2027-05-20T09:00:00.000Z"),
        },
      ],
    }),
  ];
  function departureLedger(): TransferStageTransitionRecord[] {
    const plan = planDeparture({ originatingAct: ACT });
    expect(plan.transition).not.toBeNull();
    return [openTransition(), reviewTransition(), plan.transition!];
  }

  it("publica processo, transições e intervalo sem flags nem indicadores", () => {
    const ledger = departureLedger();
    const [row] = transferProcessFactRows([process], versions, ledger);
    expect(row?.currentStageDefinitionId).toBe(DEMO_TRANSFER_STAGES.departureRecorded);
    expect(row?.versionCount).toBe(1);
    expect(row?.destinationContextTypeDefinitionId).toBe(
      DEMO_TRANSFER_CONTEXT_TYPES.externalInstitution,
    );
    const serialized = JSON.stringify(row);
    expect(serialized).not.toMatch(/evas|irregular|excedid|desconhecid/i);

    const transitionRows = transferTransitionFactRows(ledger);
    expect(transitionRows).toHaveLength(3);
    expect(transitionRows[2]?.appliedEffectDefinitionIds).toContain(
      DEMO_TRANSFER_EFFECTS.publishMobility,
    );

    const intervalRows = transitionIntervalFactRows(versions);
    expect(intervalRows[0]?.transitionKindDefinitionId).toBe(
      DEMO_TRANSITION_INTERVAL_KINDS.regulatoryTransit,
    );
    expect(intervalRows[0]?.concludedDate).toBeNull();
  });

  it("extrai o fato de mobilidade publicado pelo efeito configurado", () => {
    const facts = studentMobilityAtomicFactRows([process], versions, departureLedger());
    expect(facts).toHaveLength(1);
    expect(facts[0]?.mobilityFactTypeId).toBe(DEMO_MOBILITY_FACT_TYPES.departureByTransfer);
    expect(facts[0]?.effectiveDate).toBe("2027-05-20");
    expect(facts[0]?.studentId).toBe("alu-1");
  });
});

describe("13D/13E — projeção configurável da situação de vida escolar", () => {
  const versions = [makeVersion()];
  function mobilityFacts() {
    const plan = planDeparture({ originatingAct: ACT });
    expect(plan.transition).not.toBeNull();
    function departureLedger(): TransferStageTransitionRecord[] {
    const plan = planDeparture({ originatingAct: ACT });
    expect(plan.transition).not.toBeNull();
    return [openTransition(), reviewTransition(), plan.transition!];
  }
    return studentMobilityAtomicFactRows([process], versions, ledger);
  }

  it("projeta a situação declarada pela política, com proveniência da regra", () => {
    const result = projectStudentLifeSituations(
      mobilityFacts(),
      demonstrationSituationProjectionPolicy,
      "2027-05-21T09:00:00.000Z",
    );
    expect(result.projections).toHaveLength(1);
    expect(result.projections[0]?.situationDefinitionId).toBe(
      DEMO_TRANSFER_SITUATIONS.transferred,
    );
    expect(result.projections[0]?.producedByPolicy.definitionVersion).toBe(1);
    expect(result.projections[0]?.producedByRuleId).toBe("regra-saida-por-transferencia-demo");
  });

  it("o MESMO fato histórico projeta outra situação quando a política muda", () => {
    const rewritten: StudentLifeSituationProjectionPolicy = {
      policyId: "pol-projecao-situacao-vida-escolar-demo",
      policyVersion: 2,
      rules: [
        {
          ruleId: "regra-reformulada",
          appliesToMobilityFactTypeId: DEMO_MOBILITY_FACT_TYPES.departureByTransfer,
          producesSituationDefinitionId: "sit-rede-mobilidade-registrada",
        },
      ],
    };
    const result = projectStudentLifeSituations(mobilityFacts(), rewritten, "2028-01-10T09:00:00.000Z");
    expect(result.projections[0]?.situationDefinitionId).toBe("sit-rede-mobilidade-registrada");
    expect(result.projections[0]?.producedByPolicy.definitionVersion).toBe(2);
  });

  it("não atribui situação por omissão quando nenhuma regra cobre o fato", () => {
    const result = projectStudentLifeSituations(
      mobilityFacts(),
      { policyId: "pol-vazia", policyVersion: 1, rules: [] },
      "2027-05-21T09:00:00.000Z",
    );
    expect(result.projections).toHaveLength(0);
    expect(result.diagnostics.some((item) => item.code === CODES.situationProjectionUndeclared)).toBe(
      true,
    );
  });
});

describe("13D — auditoria anti-rigidez", () => {
  it("opera com configuração integralmente diferente e executor inédito", () => {
    const executed: string[] = [];
    const customExecutor: TransferEffectExecutor = (context, application) => {
      executed.push(application.effectDefinitionId);
      return {
        effectDefinitionId: application.effectDefinitionId,
        effectExecutorId: application.effectExecutorId,
        status: "aplicado",
        actions: [
          {
            actionKindDefinitionId: "acao-inedita",
            targetKindId: "alvo-inedito",
            targetId: context.process.transferProcessId,
          },
        ],
        diagnostics: [],
      };
    };
    const customRegistry = registerTransferEffectExecutor(
      createTransferEffectRegistry(),
      "exec-inedito",
      customExecutor,
    );

    const configuration: InstitutionalTransferGovernanceConfiguration = {
      ...demonstrationTransferConfiguration,
      configurationId: "cfg-alternativa",
      configurationVersion: 7,
      processKinds: [
        {
          processKindDefinitionId: "rito-alternativo",
          labelSnapshot: "Rito alternativo",
          initialStageDefinitionId: "fase-alfa",
        },
      ],
      stages: [
        { stageDefinitionId: "fase-alfa", labelSnapshot: "Alfa" },
        { stageDefinitionId: "fase-omega", labelSnapshot: "Ômega" },
      ],
      transitions: [
        {
          transitionDefinitionId: "transicao-alternativa",
          fromStageDefinitionId: null,
          toStageDefinitionId: "fase-omega",
          effects: [
            { effectDefinitionId: "efeito-inedito", effectExecutorId: "exec-inedito" },
          ],
        },
      ],
    };

    const plan = planTransferTransition({
      configuration,
      process: { ...process, processKindDefinitionId: "rito-alternativo" },
      version: makeVersion({ processKindDefinitionId: "rito-alternativo" }),
      existingTransitions: [],
      transitionDefinitionId: "transicao-alternativa",
      transitionId: "tr-alt",
      effectiveDate: "2027-07-01",
      effectRegistry: customRegistry,
      provenance: provenance("2027-07-01T09:00:00.000Z"),
    });

    expect(plan.allowed).toBe(true);
    expect(plan.transition?.toStageDefinitionId).toBe("fase-omega");
    expect(executed).toEqual(["efeito-inedito"]);
    expect(plan.actions[0]?.targetKindId).toBe("alvo-inedito");
  });

  it("acusa efeito configurado sem executor registrado", () => {
    const configuration: InstitutionalTransferGovernanceConfiguration = {
      ...demonstrationTransferConfiguration,
      transitions: [
        {
          transitionDefinitionId: "transicao-orfa",
          fromStageDefinitionId: null,
          toStageDefinitionId: DEMO_TRANSFER_STAGES.requested,
          effects: [{ effectDefinitionId: "efeito-x", effectExecutorId: "exec-inexistente" }],
        },
      ],
    };
    const plan = planTransferTransition({
      configuration,
      process,
      version: makeVersion(),
      existingTransitions: [],
      transitionDefinitionId: "transicao-orfa",
      transitionId: "tr-orfa",
      effectiveDate: "2027-07-01",
      effectRegistry: createTransferEffectRegistry(),
      provenance: provenance("2027-07-01T09:00:00.000Z"),
    });
    expect(plan.allowed).toBe(false);
    expect(plan.actions).toHaveLength(0);
    expect(plan.diagnostics.some((item) => item.code === CODES.effectExecutorMissing)).toBe(true);
  });
});

describe("13D — adaptadores do protótipo legado", () => {
  it("traduz o tipo textual para rito cadastrado", () => {
    expect(processKindFromLegacyKind("interna")).toBe(
      DEMO_TRANSFER_PROCESS_KINDS.betweenNetworkUnits,
    );
    expect(processKindFromLegacyKind("saida-externa")).toBe(
      DEMO_TRANSFER_PROCESS_KINDS.networkExit,
    );
    expect(processKindFromLegacyKind("entrada-externa")).toBe(
      DEMO_TRANSFER_PROCESS_KINDS.networkEntry,
    );
  });

  it("converte 'destino desconhecido' em ausência estruturada com declarante", () => {
    const pole = destinationPoleFromLegacyDraft(
      {
        kind: "saida-externa",
        destinationUnitId: "",
        externalDestinationKnown: false,
        externalInstitutionName: "",
        externalLocation: "",
      },
      provenance("2027-05-20T09:00:00.000Z"),
    );
    expect(pole.reference).toBeNull();
    expect(pole.absence?.absenceReasonDefinitionId).toBe(
      DEMO_TRANSFER_ABSENCE_REASONS.notInformedByDeclarant,
    );
    expect(pole.absence?.declarant?.declarantRoleDefinitionId).toBeTruthy();
    expect(
      validateMobilityPole(pole, demonstrationTransferConfiguration, { studentId: "alu-1" }, "destino")
        .allowed,
    ).toBe(true);
  });
});
