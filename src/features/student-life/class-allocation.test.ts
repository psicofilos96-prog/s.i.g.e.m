/**
 * Etapa 13C — Testes da Enturmação, Alocação Temporal e Movimentações.
 *
 * Os cenários provam ARQUITETURA, não norma: nenhuma configuração aqui é regra
 * homologada da Rede. Os testes anti-rigidez trocam integralmente a configuração
 * para demonstrar que o motor não conhece limite, semântica temporal, natureza
 * de participação nem processo originador.
 */
import { describe, expect, it } from "vitest";
import { DEMO_PARTICIPATION_NATURES } from "./student-life-fixtures";
import type { StudentLifeProvenance } from "./student-life-types";
import type { AcademicCycleEnrollment, CycleParticipation } from "./cycle-enrollment-types";
import {
  DEMO_ALLOCATION_PROCESS_KINDS,
  DEMO_ALLOCATION_STATES,
  DEMO_CAPACITY_BASES,
  DEMO_RESERVATION_NATURES,
  DEMO_TIMING_BOUNDARIES,
  demonstrationAllocationConfiguration,
} from "./class-allocation-fixtures";
import {
  evaluateClassAllocation,
  planClassMovement,
  rectifyAllocation,
  validateAllocationCorrection,
  validateDenormalizedReferences,
} from "./class-allocation-governance";
import {
  allocationVersionChain,
  capacityRecordInForceOn,
  classCompositionAsKnownAt,
  classCompositionOn,
  factualOccupancyOn,
  supersedingAllocation,
} from "./class-allocation-ledger";
import {
  projectAllocationFacts,
  projectCapacityFacts,
  projectClassMovementFacts,
  projectClassOccupancy,
  projectReservationFacts,
} from "./class-allocation-analytics";
import { CLASS_ALLOCATION_DIAGNOSTIC_CODES as CODES } from "./class-allocation-diagnostics";
import type {
  AcademicClass,
  AllocationDefinitionSnapshot,
  CapacityQuotaReservation,
  ClassAllocation,
  ClassCapacityRecord,
  ClassGroupingDefinition,
} from "./class-allocation-types";
import {
  academicClassFromDemonstration,
  groupingsFromDemonstration,
} from "./class-allocation-adapters";
import { demonstrationClasses } from "@/features/classes/classes-data";

const provenance = (recordedAt: string): StudentLifeProvenance => ({
  originTypeId: "atendimento-presencial",
  recordedAt,
});

const SNAPSHOT: AllocationDefinitionSnapshot = {
  academicClass: { definitionId: "turma-501", definitionVersion: 1 },
  curriculumMatrices: [{ definitionId: "mc-1", definitionVersion: 2 }],
  cardinalityPolicy: { definitionId: "pol-cardinalidade-alocacao-demo", definitionVersion: 1 },
  compatibilityPolicy: { definitionId: "pol-compatibilidade-alocacao-demo", definitionVersion: 1 },
  timingPolicy: { definitionId: "pol-temporalidade-alocacao-demo", definitionVersion: 1 },
  requirementPolicy: { definitionId: "pol-requisitos-alocacao-demo", definitionVersion: 1 },
};

const enrollment: AcademicCycleEnrollment = {
  cycleEnrollmentId: "insc-1",
  studentId: "alu-1",
  schoolBondId: "vin-1",
  schoolId: "esc-1",
  academicCycleId: "ciclo-a",
  educationalOfferId: "of-1",
  academicOrganizationId: "org-3-ano",
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

const participation: CycleParticipation = {
  participationId: "part-1",
  cycleEnrollmentId: "insc-1",
  natureDefinitionId: DEMO_PARTICIPATION_NATURES.principalSchooling,
  participationStateDefinitionId: "participacao-ativa",
  validity: { validFrom: "2027-02-01", validUntil: null },
  recordVersion: 1,
  sourceEventIds: [],
  provenance: provenance("2027-02-01T10:00:00.000Z"),
};

function makeClass(classId: string, overrides: Partial<AcademicClass> = {}): AcademicClass {
  return {
    classId,
    schoolId: "esc-1",
    academicCycleId: "ciclo-a",
    educationalOfferId: "of-1",
    academicOrganizationId: "org-3-ano",
    shiftDefinitionId: "turno-manha",
    journeyDefinitionId: "jornada-parcial",
    curriculumMatrixIds: ["mc-1"],
    classStateDefinitionId: "turma-em-atividade",
    validity: { validFrom: "2027-02-01", validUntil: null },
    recordVersion: 1,
    sourceEventIds: [],
    provenance: provenance("2027-01-20T10:00:00.000Z"),
    ...overrides,
  };
}

const denormalized = { cycleEnrollmentId: "insc-1", studentId: "alu-1", schoolId: "esc-1" };

function makeAllocation(
  allocationId: string,
  classId: string,
  validFrom: string,
  validUntil: string | null,
  overrides: Partial<ClassAllocation> = {},
): ClassAllocation {
  return {
    allocationId,
    participationId: "part-1",
    classId,
    denormalized,
    originatingProcessKindId: DEMO_ALLOCATION_PROCESS_KINDS.initialPlacement,
    allocationStateDefinitionId: DEMO_ALLOCATION_STATES.active,
    validity: { validFrom, validUntil },
    definitionSnapshot: SNAPSHOT,
    recordVersion: 1,
    supersedesAllocationId: null,
    sourceEventIds: [],
    provenance: provenance(`${validFrom}T12:00:00.000Z`),
    ...overrides,
  };
}

function capacityRecord(
  capacityRecordId: string,
  classId: string,
  referenceLimit: number,
  validFrom: string,
  validUntil: string | null,
): ClassCapacityRecord {
  return {
    capacityRecordId,
    classId,
    referenceLimit,
    basisDefinitionId: DEMO_CAPACITY_BASES.room,
    policy: { definitionId: "pol-capacidade-demo", definitionVersion: 1 },
    validity: { validFrom, validUntil },
    recordVersion: 1,
    supersedesCapacityRecordId: null,
    sourceEventIds: [],
    provenance: provenance(`${validFrom}T08:00:00.000Z`),
  };
}

const scope = { studentId: "alu-1", schoolId: "esc-1" };

function evaluate(input: Parameters<typeof evaluateClassAllocation>[0]) {
  return evaluateClassAllocation(input);
}

const baseInput = {
  configuration: demonstrationAllocationConfiguration,
  originatingProcessKindId: DEMO_ALLOCATION_PROCESS_KINDS.initialPlacement,
  scope,
  participation,
  enrollment,
  denormalized,
};

describe("13C — capacidade fora da identidade da turma", () => {
  it("responde qual era a capacidade oficial em cada data", () => {
    const records = [
      capacityRecord("cap-1", "turma-501", 25, "2027-02-01", "2027-04-30"),
      capacityRecord("cap-2", "turma-501", 28, "2027-05-01", null),
    ];
    expect(capacityRecordInForceOn(records, "turma-501", "2027-03-15")?.referenceLimit).toBe(25);
    expect(capacityRecordInForceOn(records, "turma-501", "2027-06-10")?.referenceLimit).toBe(28);
    // A turma canônica não possui campo de capacidade.
    expect("capacity" in makeClass("turma-501")).toBe(false);
  });
});

describe("13C — alocação inicial e composição histórica", () => {
  it("aloca a participação na turma e registra vigência própria", () => {
    const result = evaluate({
      ...baseInput,
      academicClass: makeClass("turma-501"),
      validity: { validFrom: "2027-02-03", validUntil: null },
      capacityRecords: [capacityRecord("cap-1", "turma-501", 25, "2027-02-01", null)],
    });
    expect(result.allowed).toBe(true);
    expect(result.initialAllocationStateDefinitionId).toBe(DEMO_ALLOCATION_STATES.active);
    expect(result.capacityFacts.referenceLimit).toBe(25);
  });

  it("reconstrói três composições diferentes em três datas diferentes", () => {
    const allocations = [
      makeAllocation("aloc-1", "turma-501", "2027-02-03", "2027-04-17"),
      makeAllocation("aloc-2", "turma-502", "2027-04-18", "2027-06-30"),
      makeAllocation("aloc-3", "turma-503", "2027-07-01", null),
    ];
    expect(classCompositionOn(allocations, "turma-501", "2027-03-10").map((i) => i.allocationId)).toEqual([
      "aloc-1",
    ]);
    expect(classCompositionOn(allocations, "turma-502", "2027-05-10").map((i) => i.allocationId)).toEqual([
      "aloc-2",
    ]);
    expect(classCompositionOn(allocations, "turma-503", "2027-08-10").map((i) => i.allocationId)).toEqual([
      "aloc-3",
    ]);
    // Nenhuma etapa anterior foi apagada.
    expect(allocations).toHaveLength(3);
  });
});

describe("13C — movimentação como operação atômica", () => {
  const origin = makeAllocation("aloc-1", "turma-501", "2027-02-03", null);

  const movementInput = {
    ...baseInput,
    originatingProcessKindId: DEMO_ALLOCATION_PROCESS_KINDS.internalMovement,
    origin,
    effectiveDate: "2027-04-18",
    academicClass: makeClass("turma-502"),
    existingAllocations: [origin],
    capacityRecords: [capacityRecord("cap-2", "turma-502", 25, "2027-02-01", null)],
    target: {
      allocationId: "aloc-2",
      definitionSnapshot: SNAPSHOT,
      provenance: provenance("2027-04-18T09:00:00.000Z"),
      sourceEventIds: ["ev-mov-1"],
    },
  };

  it("encerra a origem conforme a política temporal e constitui o destino", () => {
    const result = planClassMovement(movementInput);
    expect(result.allowed).toBe(true);
    // A política declarada encerra a origem ANTES da data de entrada.
    expect(result.plan?.terminatedOrigin.validity.validUntil).toBe("2027-04-17");
    expect(result.plan?.createdAllocation.validity.validFrom).toBe("2027-04-18");
    expect(result.plan?.createdAllocation.classId).toBe("turma-502");
    // O registro de origem original permanece intocado.
    expect(origin.validity.validUntil).toBeNull();
  });

  it("não aplica `-1 dia` nativo: outra semântica temporal produz outro fechamento", () => {
    const sameDate = {
      ...movementInput,
      configuration: {
        ...demonstrationAllocationConfiguration,
        timingPolicy: {
          ...demonstrationAllocationConfiguration.timingPolicy,
          activeBoundaryDefinitionId: DEMO_TIMING_BOUNDARIES.sameDateInclusive,
        },
        /**
         * Coexistência na data exige também cardinalidade que a admita: são
         * decisões institucionais distintas, declaradas em políticas distintas.
         */
        cardinalityPolicy: {
          ...demonstrationAllocationConfiguration.cardinalityPolicy,
          rules: [
            {
              ruleId: "card-coexistencia-na-data-ficticia",
              natureDefinitionId: DEMO_PARTICIPATION_NATURES.principalSchooling,
              maxSimultaneousAllocations: 2,
            },
          ],
        },
      },
    };
    const result = planClassMovement(sameDate);
    expect(result.allowed).toBe(true);
    expect(result.plan?.terminatedOrigin.validity.validUntil).toBe("2027-04-18");
  });

  it("coexistência na data não declarada pela política temporal aborta a movimentação", () => {
    const result = planClassMovement({
      ...movementInput,
      configuration: {
        ...demonstrationAllocationConfiguration,
        timingPolicy: {
          ...demonstrationAllocationConfiguration.timingPolicy,
          activeBoundaryDefinitionId: "fronteira-ficticia-inclusiva",
          boundaries: [
            {
              boundaryDefinitionId: "fronteira-ficticia-inclusiva",
              labelSnapshot: "Fechamento inclusivo sem coexistência declarada",
              originClosureOffsetDays: 0,
              originClosureInclusive: true,
              allowsSameDateCoexistence: false,
            },
          ],
        },
      },
    });
    expect(result.allowed).toBe(false);
    expect(result.plan).toBeNull();
  });



  it("sem política temporal declarada devolve inconclusivo e não movimenta", () => {
    const result = planClassMovement({
      ...movementInput,
      configuration: {
        ...demonstrationAllocationConfiguration,
        timingPolicy: {
          policyId: demonstrationAllocationConfiguration.timingPolicy.policyId,
          policyVersion: demonstrationAllocationConfiguration.timingPolicy.policyVersion,
          boundaries: demonstrationAllocationConfiguration.timingPolicy.boundaries,
        },

      },
    });
    expect(result.allowed).toBe(null);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.some((d) => d.code === CODES.timingPolicyUndeclared)).toBe(true);
  });

  it("falha no destino aborta a operação sem encerrar a origem", () => {
    const result = planClassMovement({
      ...movementInput,
      academicClass: makeClass("turma-999", { schoolId: "esc-2" }),
    });
    expect(result.allowed).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics.some((d) => d.code === CODES.dimensionDiverges)).toBe(true);
    expect(result.diagnostics.some((d) => d.code === CODES.movementAborted)).toBe(true);
    expect(origin.validity.validUntil).toBeNull();
  });
});

describe("13C — simultaneidade: participações distintas x mesma participação", () => {
  it("A. participações DIFERENTES coexistem em turmas diferentes", () => {
    const supportParticipation: CycleParticipation = {
      ...participation,
      participationId: "part-2",
      natureDefinitionId: DEMO_PARTICIPATION_NATURES.specializedSupport,
    };
    const existing = [makeAllocation("aloc-1", "turma-501", "2027-02-03", null)];
    const result = evaluate({
      ...baseInput,
      participation: supportParticipation,
      academicClass: makeClass("sala-recursos-01"),
      validity: { validFrom: "2027-03-01", validUntil: null },
      existingAllocations: existing,
      capacityRecords: [capacityRecord("cap-3", "sala-recursos-01", 10, "2027-02-01", null)],
    });
    expect(result.allowed).toBe(true);
  });

  it("B. MESMA participação com duas alocações simultâneas depende da cardinalidade", () => {
    const existing = [makeAllocation("aloc-1", "turma-501", "2027-02-03", null)];
    const recusada = evaluate({
      ...baseInput,
      academicClass: makeClass("turma-502"),
      validity: { validFrom: "2027-03-01", validUntil: null },
      existingAllocations: existing,
      capacityRecords: [capacityRecord("cap-2", "turma-502", 25, "2027-02-01", null)],
    });
    expect(recusada.allowed).toBe(false);
    expect(recusada.diagnostics.some((d) => d.code === CODES.cardinalityExceeded)).toBe(true);

    const permitida = evaluate({
      ...baseInput,
      academicClass: makeClass("turma-502"),
      validity: { validFrom: "2027-03-01", validUntil: null },
      existingAllocations: existing,
      capacityRecords: [capacityRecord("cap-2", "turma-502", 25, "2027-02-01", null)],
      configuration: {
        ...demonstrationAllocationConfiguration,
        cardinalityPolicy: {
          ...demonstrationAllocationConfiguration.cardinalityPolicy,
          rules: [
            {
              ruleId: "card-multipla-ficticia",
              natureDefinitionId: DEMO_PARTICIPATION_NATURES.principalSchooling,
              maxSimultaneousAllocations: 2,
            },
          ],
        },
      },
    });
    expect(permitida.allowed).toBe(true);
  });

  it("natureza não declarada não autoriza por omissão", () => {
    const result = evaluate({
      ...baseInput,
      participation: { ...participation, natureDefinitionId: "natureza-nao-declarada" },
      academicClass: makeClass("turma-501"),
      validity: { validFrom: "2027-03-01", validUntil: null },
      capacityRecords: [capacityRecord("cap-1", "turma-501", 25, "2027-02-01", null)],
    });
    expect(result.allowed).toBe(null);
    expect(result.diagnostics.some((d) => d.code === CODES.cardinalityUndeclared)).toBe(true);
  });
});

describe("13C — capacidade declarativa: fato, requisito, avaliador, efeito", () => {
  const filled = Array.from({ length: 25 }, (_value, index) =>
    makeAllocation(`aloc-f-${index}`, "turma-501", "2027-02-03", null, {
      participationId: `part-f-${index}`,
    }),
  );

  it("ocupação no limite exige ato autorizador conforme o efeito configurado", () => {
    const result = evaluate({
      ...baseInput,
      academicClass: makeClass("turma-501"),
      validity: { validFrom: "2027-03-01", validUntil: null },
      existingAllocations: filled,
      capacityRecords: [capacityRecord("cap-1", "turma-501", 25, "2027-02-01", null)],
    });
    expect(result.capacityFacts.factualOccupancy).toBe(25);
    expect(result.allowed).toBe(false);
    expect(result.diagnostics.some((d) => d.code === CODES.actMissing)).toBe(true);
  });

  it("com ato institucional declarado o efeito configurado permite prosseguir", () => {
    const result = evaluate({
      ...baseInput,
      academicClass: makeClass("turma-501"),
      validity: { validFrom: "2027-03-01", validUntil: null },
      existingAllocations: filled,
      capacityRecords: [capacityRecord("cap-1", "turma-501", 25, "2027-02-01", null)],
      requirementFacts: {
        acts: {
          "req-capacidade-referencia-demo": {
            actId: "ato-1",
            actTypeId: "autorizacao-excepcional",
            actDate: "2027-02-28",
          },
        },
      },
    });
    expect(result.allowed).toBe(true);
  });

  it("efeito bloqueador substituído sem tocar o motor", () => {
    const result = evaluate({
      ...baseInput,
      academicClass: makeClass("turma-501"),
      validity: { validFrom: "2027-03-01", validUntil: null },
      existingAllocations: filled,
      capacityRecords: [capacityRecord("cap-1", "turma-501", 25, "2027-02-01", null)],
      configuration: {
        ...demonstrationAllocationConfiguration,
        requirementPolicies: [
          {
            policyId: "pol-requisitos-alocacao-demo",
            policyVersion: 2,
            effects: [
              {
                effectDefinitionId: "efeito-ficticio-bloqueia",
                labelSnapshot: "Efeito fictício que bloqueia",
                preventsTransition: true,
                severity: "blocker",
              },
            ],
            requirements: [
              {
                requirementDefinitionId: "req-ficticio",
                labelSnapshot: "Requisito fictício",
                evaluatorId: "comparacao-ocupacao-limite",
                effectByStatus: { "nao-satisfeito": "efeito-ficticio-bloqueia" },
              },
            ],
          },
        ],
      },
    });
    expect(result.allowed).toBe(false);
  });

  it("sem capacidade vigente o resultado é inconclusivo, nunca permitido por omissão", () => {
    const result = evaluate({
      ...baseInput,
      academicClass: makeClass("turma-501"),
      validity: { validFrom: "2027-03-01", validUntil: null },
      existingAllocations: filled,
      capacityRecords: [],
    });
    expect(result.capacityFacts.referenceLimit).toBeNull();
    expect(result.allowed).toBe(null);
    expect(result.diagnostics.some((d) => d.code === CODES.capacityRecordMissing)).toBe(true);
  });

  it("reserva estruturada reduz o limite comparado quando a política o declarar", () => {
    const reservations: CapacityQuotaReservation[] = [
      {
        reservationId: "res-1",
        classId: "turma-501",
        capacityRecordId: "cap-1",
        quantity: 5,
        reservationNatureDefinitionId: DEMO_RESERVATION_NATURES.judicial,
        institutingPolicy: { definitionId: "pol-reserva-demo", definitionVersion: 1 },
        audienceCriterionDefinitionId: "publico-demo",
        validity: { validFrom: "2027-02-01", validUntil: null },
        provenance: provenance("2027-02-01T08:00:00.000Z"),
      },
    ];
    const withReserve = evaluate({
      ...baseInput,
      academicClass: makeClass("turma-501"),
      validity: { validFrom: "2027-03-01", validUntil: null },
      existingAllocations: filled.slice(0, 20),
      capacityRecords: [capacityRecord("cap-1", "turma-501", 25, "2027-02-01", null)],
      reservations,
      configuration: {
        ...demonstrationAllocationConfiguration,
        requirementPolicies: [
          {
            ...demonstrationAllocationConfiguration.requirementPolicies[0]!,
            requirements: [
              {
                ...demonstrationAllocationConfiguration.requirementPolicies[0]!.requirements[0]!,
                parameters: { subtractReservedFromLimit: true },
              },
            ],
          },
        ],
      },
    });
    expect(withReserve.capacityFacts.reservedQuantity).toBe(5);
    expect(withReserve.allowed).toBe(false);
  });
});

describe("13C — turma x agrupamento interno", () => {
  const multiClass = makeClass("turma-multi", { academicOrganizationId: undefined });
  const groupings: ClassGroupingDefinition[] = ["3-ano", "4-ano", "5-ano"].map((label) => ({
    groupingId: `gr-${label}`,
    classId: "turma-multi",
    labelSnapshot: label,
    academicOrganizationId: `org-${label}`,
    validity: { validFrom: "2027-02-01", validUntil: null },
    provenance: provenance("2027-01-20T10:00:00.000Z"),
  }));

  it("aluno é alocado na turma e contextualizado no agrupamento", () => {
    const result = evaluate({
      ...baseInput,
      academicClass: multiClass,
      groupingId: "gr-3-ano",
      groupings,
      validity: { validFrom: "2027-02-03", validUntil: null },
      capacityRecords: [capacityRecord("cap-m", "turma-multi", 20, "2027-02-01", null)],
    });
    expect(result.allowed).toBe(true);
  });

  it("agrupamento de outra turma é recusado", () => {
    const result = evaluate({
      ...baseInput,
      academicClass: multiClass,
      groupingId: "gr-externo",
      groupings: [{ ...groupings[0]!, groupingId: "gr-externo", classId: "turma-outra" }],
      validity: { validFrom: "2027-02-03", validUntil: null },
      capacityRecords: [capacityRecord("cap-m", "turma-multi", 20, "2027-02-01", null)],
    });
    expect(result.allowed).toBe(false);
    expect(result.diagnostics.some((d) => d.code === CODES.groupingOutsideClass)).toBe(true);
  });
});

describe("13C — unidade da inscrição preservada (decisão da 13B)", () => {
  it("inscrição da escola A não é alocada em turma da escola B", () => {
    const result = evaluate({
      ...baseInput,
      academicClass: makeClass("turma-b", { schoolId: "esc-2" }),
      validity: { validFrom: "2027-02-03", validUntil: null },
      capacityRecords: [capacityRecord("cap-b", "turma-b", 25, "2027-02-01", null)],
    });
    expect(result.allowed).toBe(false);
    expect(result.diagnostics.some((d) => d.code === CODES.dimensionDiverges)).toBe(true);
  });
});

describe("13C — denormalizações controladas", () => {
  it("divergência entre referência materializada e cadeia canônica é erro de integridade", () => {
    const result = validateDenormalizedReferences(
      { cycleEnrollmentId: "insc-1", studentId: "alu-B", schoolId: "esc-1" },
      participation,
      enrollment,
      scope,
    );
    expect(result.allowed).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(CODES.denormalizationDiverges);
  });
});

describe("13C — retificação bitemporal", () => {
  it("retifica a data de movimentação sem apagar a versão anteriormente conhecida", () => {
    const original = makeAllocation("aloc-2", "turma-502", "2027-04-18", null, {
      provenance: provenance("2027-04-18T09:00:00.000Z"),
    });
    const others = Array.from({ length: 25 }, (_v, index) =>
      makeAllocation(`aloc-a-${index}`, "turma-501", "2027-02-03", "2027-04-17", {
        participationId: `part-a-${index}`,
        provenance: provenance("2027-02-03T09:00:00.000Z"),
      }),
    );
    const correction = validateAllocationCorrection(
      { correctionReasonDefinitionId: "motivo-data-incorreta", supersedesAllocationId: "aloc-2" },
      scope,
    );
    expect(correction.allowed).toBe(true);

    const rectified = rectifyAllocation(
      original,
      { validity: { validFrom: "2027-04-08", validUntil: null } },
      "aloc-2-v2",
      {
        ...provenance("2027-04-25T11:00:00.000Z"),
        correctionReasonDefinitionId: "motivo-data-incorreta",
        supersedesId: "aloc-2",
      },
    );
    const all = [...others, original, rectified];

    // Projeção histórica VIGENTE muda: em 10/04 o aluno já estava na 502.
    expect(
      classCompositionOn(all, "turma-502", "2027-04-10").map((i) => i.allocationId),
    ).toEqual(["aloc-2-v2"]);
    // A versão documental anterior continua explicando o que se conhecia antes.
    expect(
      classCompositionAsKnownAt(all, "turma-502", "2027-04-10", "2027-04-20T00:00:00.000Z"),
    ).toHaveLength(0);
    expect(supersedingAllocation(all, "aloc-2")?.allocationId).toBe("aloc-2-v2");
    expect(allocationVersionChain(all, "aloc-2").map((i) => i.allocationId)).toEqual([
      "aloc-2",
      "aloc-2-v2",
    ]);
    // Ocupação histórica da origem também é reproduzível em cada data.
    expect(factualOccupancyOn(all, "turma-501", "2027-04-10")).toBe(25);
  });

  it("retificação sem motivo configurado é recusada", () => {
    expect(validateAllocationCorrection({ supersedesAllocationId: "aloc-2" }, scope).allowed).toBe(
      false,
    );
  });
});

describe("13C — saída no meio do ciclo e ingresso tardio", () => {
  it("vigências parciais são fatos, sem interpretação de tardio ou evasão", () => {
    const late = makeAllocation("aloc-tardia", "turma-501", "2027-05-10", null, {
      participationId: "part-tardia",
    });
    const early = makeAllocation("aloc-saida", "turma-501", "2027-02-03", "2027-03-31", {
      participationId: "part-saida",
    });
    const all = [late, early];
    expect(factualOccupancyOn(all, "turma-501", "2027-03-01")).toBe(1);
    expect(factualOccupancyOn(all, "turma-501", "2027-04-15")).toBe(0);
    expect(factualOccupancyOn(all, "turma-501", "2027-05-20")).toBe(1);
  });
});

describe("13C — fatos atômicos para o CIECE", () => {
  const allocations = [
    makeAllocation("aloc-1", "turma-501", "2027-02-03", "2027-04-17"),
    makeAllocation("aloc-2", "turma-502", "2027-04-18", null, {
      originatingProcessKindId: DEMO_ALLOCATION_PROCESS_KINDS.internalMovement,
      originatingAct: { actId: "ato-9", actTypeId: "portaria" },
    }),
  ];

  it("publica referência estruturada ao ato, nunca flag derivada", () => {
    const rows = projectAllocationFacts(allocations);
    expect(rows[0]?.institutionalActReference).toBeNull();
    expect(rows[1]?.institutionalActReference?.actId).toBe("ato-9");
    expect(Object.keys(rows[0] ?? {})).not.toContain("hasInstitutionalAct");
  });

  it("publica pares de movimentação sem classificar motivo", () => {
    const rows = projectClassMovementFacts(allocations);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fromClassId: "turma-501",
      toClassId: "turma-502",
      toValidFrom: "2027-04-18",
    });
  });

  it("ocupação é projeção reproduzível rotulada, sem excedente calculado", () => {
    const projection = projectClassOccupancy({
      allocations,
      capacityRecords: [capacityRecord("cap-1", "turma-501", 25, "2027-02-01", null)],
      classId: "turma-501",
      referenceDate: "2027-03-01",
    });
    expect(projection.projectionKind).toBe("projecao-reproduzivel");
    expect(projection.factualOccupancy).toBe(1);
    expect(projection.capacityPolicyVersion).toBe(1);
    expect(Object.keys(projection)).not.toContain("exceedingCount");
  });

  it("capacidade e reservas são publicadas com política, versão e vigência", () => {
    const capacityRows = projectCapacityFacts([
      capacityRecord("cap-1", "turma-501", 25, "2027-02-01", "2027-04-30"),
    ]);
    expect(capacityRows[0]).toMatchObject({ policyId: "pol-capacidade-demo", policyVersion: 1 });
    const reservationRows = projectReservationFacts([
      {
        reservationId: "res-1",
        classId: "turma-501",
        quantity: 3,
        reservationNatureDefinitionId: DEMO_RESERVATION_NATURES.technical,
        institutingPolicy: { definitionId: "pol-reserva-demo", definitionVersion: 2 },
        validity: { validFrom: "2027-02-01", validUntil: null },
        provenance: provenance("2027-02-01T08:00:00.000Z"),
      },
    ]);
    expect(reservationRows[0]).toMatchObject({
      reservationNatureDefinitionId: DEMO_RESERVATION_NATURES.technical,
      institutingPolicyVersion: 2,
    });
  });
});

describe("13C — anti-rigidez e compatibilidade", () => {
  it("processo originador novo entra por configuração, sem alterar o motor", () => {
    const result = evaluate({
      ...baseInput,
      originatingProcessKindId: "processo-ficticio-2099",
      academicClass: makeClass("turma-501"),
      validity: { validFrom: "2027-02-03", validUntil: null },
      configuration: {
        ...demonstrationAllocationConfiguration,
        originatingProcesses: [
          {
            processKindId: "processo-ficticio-2099",
            labelSnapshot: "Processo fictício",
            initialAllocationStateDefinitionId: "estado-ficticio",
          },
        ],
      },
    });
    expect(result.allowed).toBe(true);
    expect(result.initialAllocationStateDefinitionId).toBe("estado-ficticio");
  });

  it("processo não declarado devolve inconclusivo", () => {
    const result = evaluate({
      ...baseInput,
      originatingProcessKindId: "inexistente",
      academicClass: makeClass("turma-501"),
      validity: { validFrom: "2027-02-03", validUntil: null },
    });
    expect(result.allowed).toBe(null);
    expect(result.diagnostics[0]?.code).toBe(CODES.processUndeclared);
  });

  it("adaptador traduz a turma do protótipo preservando o classId e sem capacidade", () => {
    const demo = demonstrationClasses[0]!;
    const canonical = academicClassFromDemonstration(demo);
    expect(canonical.classId).toBe(demo.id);
    expect(canonical.schoolId).toBe(demo.unitId);
    expect(canonical.academicCycleId).toBe(demo.academicYearId);
    expect(canonical.shiftDefinitionId.startsWith("turno-")).toBe(true);
    expect(Object.keys(canonical)).not.toContain("capacity");
    expect(Object.keys(canonical)).not.toContain("demonstrativeHeadcount");
    const groupings = groupingsFromDemonstration(demo);
    expect(groupings.every((item) => item.classId === demo.id)).toBe(true);
  });
});
