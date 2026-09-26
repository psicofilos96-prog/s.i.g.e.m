/**
 * Etapa 13B — Testes de invariantes e anti-rigidez da Inscrição Letiva.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  evaluateEnrollmentConstitution,
  evaluateEnrollmentCoexistence,
  requestStateAllowsEnrollmentCreation,
  validateEnrollmentCorrection,
  validateParticipationValidity,
} from "./cycle-enrollment-governance";
import { assessRequirements } from "./cycle-enrollment-requirements";
import {
  currentEnrollmentVersions,
  enrollmentBitemporalTrace,
  enrollmentVersionChain,
  participationsInForce,
  participationsOfEnrollment,
  studentEnrollmentTrajectory,
} from "./cycle-enrollment-ledger";
import {
  projectEnrollmentFacts,
  projectParticipationFacts,
  projectRequirementFacts,
} from "./cycle-enrollment-analytics";
import {
  DEMO_COEXISTENCE_SCOPES,
  DEMO_DEADLINE_ORIGIN_KINDS,
  DEMO_ENROLLMENT_STATES,
  DEMO_PROCESS_KINDS,
  DEMO_REQUEST_STATES,
  DEMO_REQUIREMENT_EFFECTS,
  demonstrationEnrollmentConfiguration,
  demonstrationRequirementPolicy,
} from "./cycle-enrollment-fixtures";
import { DEMO_PARTICIPATION_NATURES } from "./student-life-fixtures";
import { adaptDemonstrationCycleEnrollments } from "./cycle-enrollment-adapters";
import type {
  AcademicCycleEnrollment,
  CycleEnrollmentGovernanceConfiguration,
  CycleParticipation,
} from "./cycle-enrollment-types";
import type { StudentLifeEvent, StudentLifeProvenance } from "./student-life-types";

const provenance = (recordedAt: string): StudentLifeProvenance => ({
  originTypeId: "teste",
  recordedAt,
});

function enrollment(
  overrides: Partial<AcademicCycleEnrollment> & Pick<AcademicCycleEnrollment, "cycleEnrollmentId">,
): AcademicCycleEnrollment {
  return {
    studentId: "alu-1",
    schoolBondId: "vin-1",
    schoolId: "esc-a",
    academicCycleId: "ciclo-x",
    educationalOfferId: "oferta-x",
    curriculumMatrixIds: [],
    admissionProcessKindId: DEMO_PROCESS_KINDS.initialAdmission,
    enrollmentStateDefinitionId: DEMO_ENROLLMENT_STATES.constituted,
    validity: { validFrom: "2030-02-01", validUntil: null },
    definitionSnapshot: {
      academicCycle: { definitionId: "ciclo-x", definitionVersion: 1, labelSnapshot: "Ciclo X" },
      educationalOffer: { definitionId: "oferta-x", definitionVersion: 1 },
      curriculumMatrices: [],
      governanceConfiguration: { definitionId: "cfg", definitionVersion: 1 },
    },
    recordVersion: 1,
    supersedesEnrollmentId: null,
    supersededByEnrollmentId: null,
    sourceEventIds: [],
    provenance: provenance("2030-02-01T10:00:00Z"),
    ...overrides,
  };
}

function participation(
  overrides: Partial<CycleParticipation> & Pick<CycleParticipation, "participationId" | "cycleEnrollmentId">,
): CycleParticipation {
  return {
    natureDefinitionId: DEMO_PARTICIPATION_NATURES.principalSchooling,
    participationStateDefinitionId: DEMO_ENROLLMENT_STATES.inProgress,
    validity: { validFrom: "2030-02-01", validUntil: null },
    recordVersion: 1,
    supersedesParticipationId: null,
    supersededByParticipationId: null,
    sourceEventIds: [],
    provenance: provenance("2030-02-01T10:00:00Z"),
    ...overrides,
  };
}

const scope = { studentId: "alu-1", schoolId: "esc-a" };

describe("13B — rito único produzindo a mesma entidade", () => {
  it("matrícula inicial e rematrícula percorrem o mesmo caminho, diferindo apenas no rito", () => {
    const facts = {
      satisfiedRequirementDefinitionIds: ["req-documento-identificacao-demo"],
      attributes: { responsavelDeclarado: "Responsável declarado" },
    };

    const initial = evaluateEnrollmentConstitution({
      configuration: demonstrationEnrollmentConfiguration,
      admissionProcessKindId: DEMO_PROCESS_KINDS.initialAdmission,
      scope,
      hasExistingSchoolBond: false,
      requirementFacts: facts,
    });
    const renewal = evaluateEnrollmentConstitution({
      configuration: demonstrationEnrollmentConfiguration,
      admissionProcessKindId: DEMO_PROCESS_KINDS.renewal,
      scope,
      hasExistingSchoolBond: true,
      requirementFacts: facts,
    });

    expect(initial.allowed).toBe(true);
    expect(renewal.allowed).toBe(true);
    expect(initial.initialEnrollmentStateDefinitionId).toBe(
      renewal.initialEnrollmentStateDefinitionId,
    );
  });

  it("rito que exige vínculo preexistente recusa quando não há vínculo", () => {
    const result = evaluateEnrollmentConstitution({
      configuration: demonstrationEnrollmentConfiguration,
      admissionProcessKindId: DEMO_PROCESS_KINDS.renewal,
      scope,
      hasExistingSchoolBond: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain("SL-ENROLL-BOND-REQUIRED-MISSING");
  });

  it("rito não declarado devolve inconclusivo, nunca autorização por omissão", () => {
    const result = evaluateEnrollmentConstitution({
      configuration: demonstrationEnrollmentConfiguration,
      admissionProcessKindId: "rito-inexistente",
      scope,
      hasExistingSchoolBond: true,
    });
    expect(result.allowed).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("SL-ENROLL-PROCESS-UNDECLARED");
  });
});

describe("13B — capacidade configurável do requerimento", () => {
  it("a capacidade de constituir inscrição vem da configuração, não do nome do estado", () => {
    expect(
      requestStateAllowsEnrollmentCreation(
        demonstrationEnrollmentConfiguration,
        DEMO_REQUEST_STATES.granted,
      ),
    ).toBe(true);
    expect(
      requestStateAllowsEnrollmentCreation(
        demonstrationEnrollmentConfiguration,
        DEMO_REQUEST_STATES.underReview,
      ),
    ).toBe(false);
    expect(
      requestStateAllowsEnrollmentCreation(demonstrationEnrollmentConfiguration, "estado-ficticio"),
    ).toBeNull();
  });

  it("estado sem capacidade declarada impede a constituição da inscrição", () => {
    const result = evaluateEnrollmentConstitution({
      configuration: demonstrationEnrollmentConfiguration,
      admissionProcessKindId: DEMO_PROCESS_KINDS.reintegration,
      scope,
      hasExistingSchoolBond: true,
      originatingRequest: {
        requestId: "req-1",
        requestStateDefinitionId: DEMO_REQUEST_STATES.underReview,
      },
    });
    expect(result.allowed).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      "SL-ENROLL-REQUEST-STATE-NOT-CAPABLE",
    );
  });

  it("uma política alternativa pode declarar outro estado como capaz sem mudar código", () => {
    const alternative: CycleEnrollmentGovernanceConfiguration = {
      ...demonstrationEnrollmentConfiguration,
      requestStateCapabilities: [
        { requestStateDefinitionId: "estado-homologado-ficticio", allowsEnrollmentCreation: true },
      ],
    };
    const result = evaluateEnrollmentConstitution({
      configuration: alternative,
      admissionProcessKindId: DEMO_PROCESS_KINDS.reintegration,
      scope,
      hasExistingSchoolBond: true,
      originatingRequest: {
        requestId: "req-1",
        requestStateDefinitionId: "estado-homologado-ficticio",
      },
    });
    expect(result.allowed).toBe(true);
  });
});

describe("13B — requisitos com efeitos institucionais configuráveis", () => {
  it("efeito que impede a constituição bloqueia; efeito com prazo permite", () => {
    const blocked = assessRequirements(
      demonstrationRequirementPolicy,
      DEMO_PROCESS_KINDS.initialAdmission,
      { attributes: { responsavelDeclarado: null } },
      scope,
    );
    expect(blocked.allowed).toBe(false);

    const withDeadline = assessRequirements(
      demonstrationRequirementPolicy,
      DEMO_PROCESS_KINDS.initialAdmission,
      {
        unsatisfiedRequirementDefinitionIds: ["req-documento-identificacao-demo"],
        attributes: { responsavelDeclarado: "Responsável" },
        deadlines: {
          "req-documento-identificacao-demo": {
            date: "2030-03-31",
            originKindId: DEMO_DEADLINE_ORIGIN_KINDS.grantedIndividually,
            grantedByAgentId: "agente-1",
          },
        },
      },
      scope,
    );
    expect(withDeadline.allowed).toBe(true);
    const documento = withDeadline.evaluations.find(
      (item) => item.requirementDefinitionId === "req-documento-identificacao-demo",
    );
    expect(documento?.requirementEffectDefinitionId).toBe(
      DEMO_REQUIREMENT_EFFECTS.allowsWithDeadline,
    );
    expect(documento?.deadline?.originKindId).toBe(DEMO_DEADLINE_ORIGIN_KINDS.grantedIndividually);
  });

  it("efeito que exige prazo sem prazo declarado gera diagnóstico e não conclui", () => {
    const result = assessRequirements(
      demonstrationRequirementPolicy,
      DEMO_PROCESS_KINDS.initialAdmission,
      {
        unsatisfiedRequirementDefinitionIds: ["req-documento-identificacao-demo"],
        attributes: { responsavelDeclarado: "Responsável" },
      },
      scope,
    );
    expect(result.allowed).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      "SL-ENROLL-REQUIREMENT-DEADLINE-MISSING",
    );
  });

  it("dado ausente nunca satisfaz requisito: resultado é inconclusivo", () => {
    const result = assessRequirements(
      demonstrationRequirementPolicy,
      DEMO_PROCESS_KINDS.initialAdmission,
      {},
      scope,
    );
    const documento = result.evaluations.find(
      (item) => item.requirementDefinitionId === "req-documento-identificacao-demo",
    );
    expect(documento?.status).toBe("inconclusivo");
    expect(result.evaluations.every((item) => item.status !== "satisfeito")).toBe(true);
  });

  it("requisito com avaliador não registrado devolve erro de configuração", () => {
    const result = assessRequirements(
      {
        ...demonstrationRequirementPolicy,
        requirements: [
          {
            requirementDefinitionId: "req-ficticio",
            labelSnapshot: "Requisito fictício",
            evaluatorId: "avaliador-inexistente",
            effectByStatus: {},
          },
        ],
      },
      DEMO_PROCESS_KINDS.initialAdmission,
      {},
      scope,
    );
    expect(result.evaluations[0]?.status).toBe("erro-de-configuracao");
    expect(result.allowed).toBe(false);
  });

  it("novo efeito institucional entra por configuração, sem alterar o motor", () => {
    const result = assessRequirements(
      {
        policyId: "pol-ficticia",
        policyVersion: 1,
        effects: [
          {
            effectDefinitionId: "efeito-encaminhar-a-direcao-ficticio",
            labelSnapshot: "Encaminhar à direção",
            preventsTransition: false,
            requiresInstitutionalAct: true,
            severity: "requirement",
          },
        ],
        requirements: [
          {
            requirementDefinitionId: "req-ficticio",
            labelSnapshot: "Requisito fictício",
            evaluatorId: "declaracao-estruturada",
            effectByStatus: { "nao-satisfeito": "efeito-encaminhar-a-direcao-ficticio" },
          },
        ],
      },
      "rito-ficticio",
      {
        unsatisfiedRequirementDefinitionIds: ["req-ficticio"],
        acts: {
          "req-ficticio": {
            actId: "ato-1",
            actTypeId: "ato-ficticio",
            actIdentifier: "Ato 1",
            actDate: "2030-02-05",
          },
        },
      },
      scope,
    );
    expect(result.allowed).toBe(true);
    expect(result.evaluations[0]?.requirementEffectDefinitionId).toBe(
      "efeito-encaminhar-a-direcao-ficticio",
    );
  });
});

describe("13B — coexistência entre inscrições de unidades distintas", () => {
  const regular = enrollment({ cycleEnrollmentId: "insc-a", schoolId: "esc-a" });
  const regularParticipation = participation({
    participationId: "part-a",
    cycleEnrollmentId: "insc-a",
  });

  it("escolarização na Escola A coexiste com atendimento especializado na Escola B", () => {
    const result = evaluateEnrollmentCoexistence({
      policy: demonstrationEnrollmentConfiguration.coexistencePolicy,
      scope: { studentId: "alu-1", schoolId: "esc-b" },
      candidate: {
        schoolId: "esc-b",
        natureDefinitionIds: [DEMO_PARTICIPATION_NATURES.specializedSupport],
        validity: { validFrom: "2030-03-01", validUntil: null },
      },
      existingEnrollments: [regular],
      existingParticipations: [regularParticipation],
    });
    expect(result.allowed).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("duas escolarizações principais simultâneas são recusadas pela política", () => {
    const result = evaluateEnrollmentCoexistence({
      policy: demonstrationEnrollmentConfiguration.coexistencePolicy,
      scope: { studentId: "alu-1", schoolId: "esc-b" },
      candidate: {
        schoolId: "esc-b",
        natureDefinitionIds: [DEMO_PARTICIPATION_NATURES.principalSchooling],
        validity: { validFrom: "2030-03-01", validUntil: null },
      },
      existingEnrollments: [regular],
      existingParticipations: [regularParticipation],
    });
    expect(result.allowed).toBe(false);
    expect(result.diagnostics[0]?.parameters?.["comparisonScopeId"]).toBe(
      DEMO_COEXISTENCE_SCOPES.distinctSchools,
    );
  });

  it("combinação não declarada fica inconclusiva, jamais autorizada por omissão", () => {
    const result = evaluateEnrollmentCoexistence({
      policy: demonstrationEnrollmentConfiguration.coexistencePolicy,
      scope: { studentId: "alu-1", schoolId: "esc-b" },
      candidate: {
        schoolId: "esc-b",
        natureDefinitionIds: ["natureza-ficticia"],
        validity: { validFrom: "2030-03-01", validUntil: null },
      },
      existingEnrollments: [regular],
      existingParticipations: [regularParticipation],
    });
    expect(result.allowed).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("SL-ENROLL-PARTICIPATION-COMBINATION-UNDECLARED");
  });

  it("vigências que não se sobrepõem não disputam coexistência", () => {
    const result = evaluateEnrollmentCoexistence({
      policy: demonstrationEnrollmentConfiguration.coexistencePolicy,
      scope: { studentId: "alu-1", schoolId: "esc-b" },
      candidate: {
        schoolId: "esc-b",
        natureDefinitionIds: [DEMO_PARTICIPATION_NATURES.principalSchooling],
        validity: { validFrom: "2031-02-01", validUntil: null },
      },
      existingEnrollments: [
        enrollment({
          cycleEnrollmentId: "insc-encerrada",
          validity: { validFrom: "2030-02-01", validUntil: "2030-12-20" },
        }),
      ],
      existingParticipations: [
        participation({
          participationId: "part-encerrada",
          cycleEnrollmentId: "insc-encerrada",
          validity: { validFrom: "2030-02-01", validUntil: "2030-12-20" },
        }),
      ],
    });
    expect(result.allowed).toBe(true);
  });
});

describe("13B — participação como entidade temporal própria", () => {
  it("participações são consultadas por cycleEnrollmentId, não embutidas na inscrição", () => {
    const base = enrollment({ cycleEnrollmentId: "insc-a" });
    expect("participations" in base).toBe(false);

    const all = [
      participation({ participationId: "part-1", cycleEnrollmentId: "insc-a" }),
      participation({
        participationId: "part-2",
        cycleEnrollmentId: "insc-a",
        natureDefinitionId: DEMO_PARTICIPATION_NATURES.specializedSupport,
        validity: { validFrom: "2030-06-01", validUntil: null },
      }),
      participation({ participationId: "part-3", cycleEnrollmentId: "insc-b" }),
    ];
    expect(participationsOfEnrollment(all, "insc-a")).toHaveLength(2);
    expect(participationsInForce(all, "2030-03-01").map((item) => item.participationId)).toEqual([
      "part-1",
      "part-3",
    ]);
  });

  it("participação com vigência fora da inscrição é recusada", () => {
    const base = enrollment({
      cycleEnrollmentId: "insc-a",
      validity: { validFrom: "2030-02-01", validUntil: "2030-12-20" },
    });
    const result = validateParticipationValidity(
      base,
      { validFrom: "2030-02-01", validUntil: "2031-03-01" },
      scope,
    );
    expect(result.allowed).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("SL-ENROLL-PARTICIPATION-VALIDITY-OUTSIDE");
  });
});

describe("13B — ciclos sem premissa de anualidade", () => {
  it("duas inscrições sucessivas no mesmo ano civil coexistem sem conflito", () => {
    const first = enrollment({
      cycleEnrollmentId: "insc-fase-1",
      academicCycleId: "ciclo-semestral-1",
      validity: { validFrom: "2030-02-05", validUntil: "2030-07-10" },
    });
    const second = enrollment({
      cycleEnrollmentId: "insc-fase-2",
      academicCycleId: "ciclo-semestral-2",
      admissionProcessKindId: DEMO_PROCESS_KINDS.renewal,
      validity: { validFrom: "2030-08-01", validUntil: "2030-12-18" },
    });
    const trajectory = studentEnrollmentTrajectory([second, first], "alu-1");
    expect(trajectory.map((item) => item.cycleEnrollmentId)).toEqual([
      "insc-fase-1",
      "insc-fase-2",
    ]);
    expect(new Set(trajectory.map((item) => item.academicCycleId)).size).toBe(2);
  });

  it("ingresso posterior ao início do ciclo preserva a data real, sem fabricar histórico", () => {
    const late = enrollment({
      cycleEnrollmentId: "insc-tardia",
      validity: { validFrom: "2030-05-12", validUntil: null },
    });
    const [fact] = projectEnrollmentFacts([late], { "ciclo-x": "2030-02-01" });
    expect(fact?.studentValidFrom).toBe("2030-05-12");
    expect(fact?.cycleStartDate).toBe("2030-02-01");
    // A 13B NÃO publica "ingresso tardio": a interpretação é do consumidor.
    expect(Object.keys(fact ?? {})).not.toContain("isLateAdmission");
  });
});

describe("13B — retificação bitemporal sem reescrever o passado", () => {
  it("a versão vigente é derivada da cadeia e a original permanece íntegra", () => {
    const v1 = enrollment({
      cycleEnrollmentId: "insc-v1",
      academicOrganizationId: "organizacao-errada",
    });
    const v2 = enrollment({
      cycleEnrollmentId: "insc-v2",
      academicOrganizationId: "organizacao-correta",
      recordVersion: 2,
      supersedesEnrollmentId: "insc-v1",
      provenance: {
        originTypeId: "retificacao",
        recordedAt: "2030-04-02T09:00:00Z",
        correctionReasonDefinitionId: "motivo-erro-de-digitacao",
      },
    });

    const current = currentEnrollmentVersions([v1, v2]);
    expect(current.map((item) => item.cycleEnrollmentId)).toEqual(["insc-v2"]);
    expect(enrollmentVersionChain([v1, v2], "insc-v1").map((item) => item.recordVersion)).toEqual([
      1, 2,
    ]);
    expect(v1.academicOrganizationId).toBe("organizacao-errada");
  });

  it("retificação sem motivo declarado é recusada", () => {
    expect(validateEnrollmentCorrection({ supersedesEnrollmentId: "insc-v1" }, scope).allowed).toBe(
      false,
    );
    expect(
      validateEnrollmentCorrection(
        { correctionReasonDefinitionId: "motivo-erro-de-digitacao" },
        scope,
      ).allowed,
    ).toBe(true);
  });

  it("fato ocorreu em X, foi registrado em Y e retificado em Z", () => {
    const events: StudentLifeEvent[] = [
      {
        eventId: "ev-1",
        eventTypeDefinitionId: "inscricao-ciclo-efetivada",
        payloadSchemaDefinitionId: "schema-inscricao",
        scope: { studentId: "alu-1", enrollmentId: "insc-v1" },
        effectiveDate: "2030-02-01",
        attributes: {},
        isCorrection: false,
        precedingEventId: null,
        provenance: provenance("2030-02-05T08:00:00Z"),
      },
      {
        eventId: "ev-2",
        eventTypeDefinitionId: "inscricao-ciclo-retificada",
        payloadSchemaDefinitionId: "schema-inscricao",
        scope: { studentId: "alu-1", enrollmentId: "insc-v1" },
        effectiveDate: "2030-02-01",
        attributes: {},
        isCorrection: true,
        precedingEventId: "ev-1",
        provenance: provenance("2030-04-02T09:00:00Z"),
      },
    ];

    const trace = enrollmentBitemporalTrace(events, "insc-v1");
    expect(trace).toHaveLength(2);
    expect(trace[0]?.effectiveDate).toBe("2030-02-01");
    expect(trace[0]?.recordedAt).toBe("2030-02-05T08:00:00Z");
    expect(trace[1]?.isCorrection).toBe(true);
    expect(trace[1]?.recordedAt).toBe("2030-04-02T09:00:00Z");
  });
});

describe("13B — mudança de política não reescreve inscrições históricas", () => {
  it("a inscrição antiga continua explicável pelas versões que a originaram", () => {
    const historic = enrollment({
      cycleEnrollmentId: "insc-historica",
      definitionSnapshot: {
        academicCycle: { definitionId: "ciclo-x", definitionVersion: 1, labelSnapshot: "Fase IV" },
        educationalOffer: { definitionId: "oferta-x", definitionVersion: 1, labelSnapshot: "EJA" },
        curriculumMatrices: [{ definitionId: "matriz-x", definitionVersion: 1 }],
        governanceConfiguration: { definitionId: "cfg-inscricao-letiva-demo", definitionVersion: 1 },
        requirementPolicy: { definitionId: demonstrationRequirementPolicy.policyId, definitionVersion: 1 },
      },
    });

    const renamedConfiguration: CycleEnrollmentGovernanceConfiguration = {
      ...demonstrationEnrollmentConfiguration,
      configurationVersion: 2,
    };
    const newer = enrollment({
      cycleEnrollmentId: "insc-nova",
      definitionSnapshot: {
        ...historic.definitionSnapshot,
        academicCycle: { definitionId: "ciclo-x", definitionVersion: 2, labelSnapshot: "Etapa IV" },
        governanceConfiguration: {
          definitionId: renamedConfiguration.configurationId,
          definitionVersion: 2,
        },
      },
    });

    expect(historic.definitionSnapshot.academicCycle.labelSnapshot).toBe("Fase IV");
    expect(historic.definitionSnapshot.governanceConfiguration.definitionVersion).toBe(1);
    expect(newer.definitionSnapshot.academicCycle.labelSnapshot).toBe("Etapa IV");
    expect(newer.definitionSnapshot.governanceConfiguration.definitionVersion).toBe(2);
  });

  it("a inscrição admite zero, uma ou várias matrizes curriculares", () => {
    expect(enrollment({ cycleEnrollmentId: "a" }).curriculumMatrixIds).toEqual([]);
    expect(
      enrollment({ cycleEnrollmentId: "b", curriculumMatrixIds: ["m1", "m2"] }).curriculumMatrixIds,
    ).toHaveLength(2);
  });
});

describe("13B — fatos atômicos para o CIECE", () => {
  it("publica datas e estados, nunca interpretações nem flags derivadas", () => {
    const base = enrollment({ cycleEnrollmentId: "insc-a" });
    const [fact] = projectEnrollmentFacts([base]);
    expect(fact?.cycleStartDate).toBeNull();
    expect(Object.keys(fact ?? {})).not.toContain("hasPendingDocument");

    const evaluations = assessRequirements(
      demonstrationRequirementPolicy,
      DEMO_PROCESS_KINDS.initialAdmission,
      {},
      scope,
    ).evaluations;
    const requirementFacts = projectRequirementFacts("insc-a", evaluations);
    expect(requirementFacts.every((row) => typeof row.status === "string")).toBe(true);
    expect(Object.keys(requirementFacts[0] ?? {})).not.toContain("pendingCount");

    const participationFacts = projectParticipationFacts([
      participation({ participationId: "part-1", cycleEnrollmentId: "insc-a" }),
    ]);
    expect(participationFacts[0]?.natureDefinitionId).toBe(
      DEMO_PARTICIPATION_NATURES.principalSchooling,
    );
  });
});

describe("13B — adaptação dos protótipos legados", () => {
  it("vínculos letivos legados tornam-se inscrições com participações próprias", () => {
    const { enrollments, participations } = adaptDemonstrationCycleEnrollments();
    expect(enrollments.length).toBeGreaterThan(0);
    expect(participations.length).toBeGreaterThan(0);
    expect(enrollments.every((item) => item.cycleEnrollmentId !== item.schoolBondId)).toBe(true);
    expect(
      participations.every((item) =>
        enrollments.some((row) => row.cycleEnrollmentId === item.cycleEnrollmentId),
      ),
    ).toBe(true);
    // O rótulo legado é snapshot histórico; o identificador do ciclo é estável.
    expect(
      enrollments.every(
        (item) => item.definitionSnapshot.academicCycle.definitionId === item.academicCycleId,
      ),
    ).toBe(true);
  });
});

describe("13B — auditoria anti-rigidez", () => {
  const engineFiles = [
    "src/features/student-life/cycle-enrollment-governance.ts",
    "src/features/student-life/cycle-enrollment-requirements.ts",
    "src/features/student-life/cycle-enrollment-ledger.ts",
    "src/features/student-life/cycle-enrollment-analytics.ts",
  ];

  const engineCode = () =>
    engineFiles
      .map((file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""))
      .join("\n");

  it("o motor não referencia nenhum identificador de estado, rito ou efeito demonstrativo", () => {
    const code = engineCode();
    const forbidden = [
      ...Object.values(DEMO_ENROLLMENT_STATES),
      ...Object.values(DEMO_REQUEST_STATES),
      ...Object.values(DEMO_PROCESS_KINDS),
      ...Object.values(DEMO_REQUIREMENT_EFFECTS),
      ...Object.values(DEMO_COEXISTENCE_SCOPES),
      ...Object.values(DEMO_DEADLINE_ORIGIN_KINDS),
      ...Object.values(DEMO_PARTICIPATION_NATURES),
    ];
    for (const token of forbidden) {
      expect(code, `motor referencia identificador configurado: ${token}`).not.toContain(token);
    }
  });

  it("o motor não conhece ano civil, etapa, modalidade, turma nem documento", () => {
    const code = engineCode();
    for (const token of [
      "20260",
      "2027",
      "anoLetivo",
      "Fase ",
      "EJA",
      "Anos Finais",
      "classId",
      "documento",
      "certidao",
      "vacina",
    ]) {
      expect(code, `motor contém termo normativo: ${token}`).not.toContain(token);
    }
  });

  it("toda a máquina pode ser substituída por identificadores fictícios sem tocar no motor", () => {
    const fictional: CycleEnrollmentGovernanceConfiguration = {
      configurationId: "cfg-ficticia",
      configurationVersion: 7,
      enrollmentMachineId: "maquina-ficticia",
      participationMachineId: "maquina-participacao-ficticia",
      admissionProcesses: [
        {
          processKindId: "rito-zeta",
          labelSnapshot: "Rito Zeta",
          initialEnrollmentStateDefinitionId: "estado-omega",
        },
      ],
      requirementPolicies: [],
      requestStateCapabilities: [],
      coexistencePolicy: {
        policyId: "pol-ficticia",
        policyVersion: 1,
        comparisonScopeIds: ["escopo-alfa", "escopo-beta"],
        rules: [],
        undeclaredCombinationStateId: "compatible",
      },
    };

    const result = evaluateEnrollmentConstitution({
      configuration: fictional,
      admissionProcessKindId: "rito-zeta",
      scope,
      hasExistingSchoolBond: false,
    });
    expect(result.allowed).toBe(true);
    expect(result.initialEnrollmentStateDefinitionId).toBe("estado-omega");
  });

  it("nenhum tipo fecha enumeração de efeito institucional", () => {
    const types = readFileSync("src/features/student-life/cycle-enrollment-types.ts", "utf8");
    expect(types).toContain("requirementEffectDefinitionId");
    expect(types).not.toContain('"bloqueante"');
    expect(types).not.toContain('"regularizacao-posterior"');
  });
});
