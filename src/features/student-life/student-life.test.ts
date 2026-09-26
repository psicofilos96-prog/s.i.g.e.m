/**
 * Etapa 13A — Testes arquiteturais e anti-rigidez da Vida Escolar.
 *
 * Verificam invariantes de identidade, bitemporalidade, ledger, coexistência,
 * diagnósticos estruturados, extensibilidade por configuração e minimização.
 */
import { describe, expect, it } from "vitest";
import {
  ABSENCE_REASONS,
  DEMO_BOND_MACHINE,
  DEMO_EVENT_TYPES,
  DEMO_PARTICIPATION_NATURES,
  DEMO_PAYLOAD_SCHEMAS,
  DEMO_STUDENT_MACHINE,
  demonstrationStudentLifeConfiguration as baseConfig,
} from "./student-life-fixtures";
import {
  resolveReturnStrategy,
  validateBondValidity,
  validateEventPayload,
  validateParticipationCoexistence,
  validateTransition,
} from "./student-life-governance";
import {
  countSchoolRelationEpisodes,
  currentEventVersions,
  eventCorrectionChain,
  getFirstNetworkAdmissionDate,
  studentLedger,
} from "./student-life-ledger";
import {
  adaptDemonstrationStudentLife,
  adaptStudentReference,
} from "./student-life-adapters";
import { demonstrationStudents } from "@/features/students/students-data";
import { countDiagnosticsByCode } from "./student-life-diagnostics";
import {
  absentValue,
  presentValue,
  type ExternalIdentifierReference,
  type Person,
  type SchoolInstitutionalBond,
  type StudentLifeEvent,
  type StudentLifeGovernanceConfiguration,
  type StudentLifeProvenance,
} from "./student-life-types";

const provenance: StudentLifeProvenance = {
  originTypeId: "atendimento-demo",
  recordedAt: "2027-03-05T10:00:00.000Z",
};

function externalId(namespace: string, code: string): ExternalIdentifierReference {
  return {
    identifierId: `ext-${namespace}`,
    systemNamespace: namespace,
    externalCode: code,
    provenance,
  };
}

describe("13A — identidade canônica", () => {
  it("mesma pessoa não se desdobra em duas por possuir identificadores externos diferentes", () => {
    const person: Person = {
      personId: "pes-1",
      civilName: "Pessoa Fictícia Demonstrativa",
      birthDate: presentValue("2016-03-12"),
      civilAttributes: [],
      externalIdentifiers: [
        externalId("RECEITA_FEDERAL_CPF", "000.000.000-00"),
        externalId("INEP_EDUCACENSO", "123456789012"),
        externalId("SISTEMA_LEGADO", "LEG-77"),
      ],
      provenance,
    };

    const identities = new Set([person.personId]);
    expect(identities.size).toBe(1);
    expect(person.externalIdentifiers).toHaveLength(3);
    // Nenhum identificador externo é a identidade interna.
    for (const item of person.externalIdentifiers) {
      expect(item.externalCode).not.toBe(person.personId);
    }
  });

  it("aluno possui múltiplos identificadores externos sem alterar o ID técnico nem o exibível", () => {
    const { roles } = adaptDemonstrationStudentLife();
    const role = roles[0]!;
    const extended = {
      ...role,
      externalIdentifiers: [
        ...role.externalIdentifiers,
        externalId("INEP_EDUCACENSO", "987654321098"),
      ],
    };
    expect(extended.studentId).toBe(role.studentId);
    expect(extended.institutionalIdentifier.value).toBe(role.institutionalIdentifier.value);
    expect(extended.studentId).not.toBe(extended.institutionalIdentifier.value);
  });

  it("distingue dado desconhecido, não informado e não aplicável sem criar categoria cadastral", () => {
    const unknown = absentValue<string>(ABSENCE_REASONS.unknown);
    const notInformed = absentValue<string>(ABSENCE_REASONS.notInformed);
    const notApplicable = absentValue<string>(ABSENCE_REASONS.notApplicable);
    for (const value of [unknown, notInformed, notApplicable]) {
      expect(value.present).toBe(false);
    }
    expect(
      new Set([unknown, notInformed, notApplicable].map((v) => (v.present ? "" : v.absenceReasonId)))
        .size,
    ).toBe(3);
    // Ausência nunca vira valor.
    expect("value" in unknown).toBe(false);
  });
});

describe("13A — vínculo com a unidade e retorno", () => {
  it("retorno à mesma unidade preserva a relação histórica anterior", () => {
    const bond: SchoolInstitutionalBond = {
      bondId: "bond-1",
      studentId: "alu-1",
      schoolId: "esc-1",
      schoolNameAtEstablishment: "Escola Demonstrativa",
      institutionalIdentifier: { value: "REG-1" },
      bondStateDefinitionId: "encerrado",
      episodes: [
        {
          episodeId: "ep-1",
          validFrom: "2020-02-03",
          validUntil: "2021-12-20",
          openedByEventId: "evt-1",
          closedByEventId: "evt-2",
        },
      ],
      sourceEventIds: ["evt-1", "evt-2"],
      provenance,
    };

    const check = validateBondValidity(
      bond.episodes,
      { validFrom: "2027-02-01", validUntil: null },
      { studentId: bond.studentId, bondId: bond.bondId },
    );
    expect(check.allowed).toBe(true);

    const reactivated: SchoolInstitutionalBond = {
      ...bond,
      bondStateDefinitionId: "vigente",
      episodes: [
        ...bond.episodes,
        {
          episodeId: "ep-2",
          validFrom: "2027-02-01",
          validUntil: null,
          openedByEventId: "evt-3",
        },
      ],
    };
    // O episódio antigo continua íntegro.
    expect(reactivated.episodes[0]).toEqual(bond.episodes[0]);
    expect(countSchoolRelationEpisodes([reactivated], "alu-1", "esc-1")).toBe(2);
  });

  it("rejeita sobreposição de vigência, mas não unicidade eterna aluno+escola", () => {
    const episodes = [
      {
        episodeId: "ep-1",
        validFrom: "2027-02-01",
        validUntil: null,
        openedByEventId: "evt-1",
      },
    ];
    const conflict = validateBondValidity(
      episodes,
      { validFrom: "2027-06-01", validUntil: null },
      { studentId: "alu-1" },
    );
    expect(conflict.allowed).toBe(false);
    expect(conflict.diagnostics[0]!.code).toBe("SL-BOND-OVERLAPPING-VALIDITY");
  });

  it("suporta tanto reativação quanto novo vínculo encadeado, conforme política", () => {
    const reactivating = resolveReturnStrategy(baseConfig, { studentId: "alu-1" });
    expect(reactivating.strategyId).toBe("reactivate-episode");

    const chaining: StudentLifeGovernanceConfiguration = {
      ...baseConfig,
      returnPolicy: { ...baseConfig.returnPolicy, returnStrategyId: "chain-new-bond" },
    };
    expect(resolveReturnStrategy(chaining, {}).strategyId).toBe("chain-new-bond");

    const undeclared: StudentLifeGovernanceConfiguration = {
      ...baseConfig,
      returnPolicy: { policyId: "pol-x", policyVersion: 1 },
    };
    const result = resolveReturnStrategy(undeclared, {});
    expect(result.strategyId).toBeNull();
    expect(result.diagnostics[0]!.code).toBe("SL-BOND-RETURN-STRATEGY-UNDECLARED");
  });
});

describe("13A — participações simultâneas", () => {
  it("aceita duas participações simultâneas declaradas compatíveis", () => {
    const result = validateParticipationCoexistence(
      baseConfig.coexistencePolicy,
      [
        DEMO_PARTICIPATION_NATURES.principalSchooling,
        DEMO_PARTICIPATION_NATURES.specializedSupport,
      ],
      { studentId: "alu-1" },
    );
    expect(result.allowed).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("rejeita combinação declarada incompatível pela política, sem noção de horário", () => {
    const result = validateParticipationCoexistence(
      baseConfig.coexistencePolicy,
      [
        DEMO_PARTICIPATION_NATURES.principalSchooling,
        DEMO_PARTICIPATION_NATURES.principalSchooling,
      ],
      { studentId: "alu-1" },
    );
    expect(result.allowed).toBe(false);
    expect(result.diagnostics[0]!.code).toBe("SL-PART-COMBINATION-INCOMPATIBLE");
    expect(JSON.stringify(result)).not.toMatch(/horári|turno|schedule/i);
  });

  it("combinação não declarada fica inconclusiva, nunca autorizada por omissão", () => {
    const result = validateParticipationCoexistence(
      baseConfig.coexistencePolicy,
      [
        DEMO_PARTICIPATION_NATURES.specializedSupport,
        DEMO_PARTICIPATION_NATURES.complementary,
      ],
      { studentId: "alu-1" },
    );
    expect(result.allowed).toBeNull();
    expect(result.diagnostics[0]!.code).toBe("SL-PART-COMBINATION-UNDECLARED");
  });

  it("nova natureza de participação entra por configuração, sem alterar o motor", () => {
    const extended: StudentLifeGovernanceConfiguration = {
      ...baseConfig,
      coexistencePolicy: {
        ...baseConfig.coexistencePolicy,
        natures: [
          ...baseConfig.coexistencePolicy.natures,
          {
            natureDefinitionId: "itinerario-formativo-futuro",
            labelSnapshot: "Itinerário formativo futuro",
            scopeId: "complementar",
          },
        ],
        rules: [
          ...baseConfig.coexistencePolicy.rules,
          {
            ruleId: "regra-nova-demo",
            natureDefinitionIds: [
              DEMO_PARTICIPATION_NATURES.principalSchooling,
              "itinerario-formativo-futuro",
            ],
            compatible: true,
          },
        ],
      },
    };
    const result = validateParticipationCoexistence(
      extended.coexistencePolicy,
      [DEMO_PARTICIPATION_NATURES.principalSchooling, "itinerario-formativo-futuro"],
      {},
    );
    expect(result.allowed).toBe(true);
  });
});

describe("13A — ledger bitemporal e projeções", () => {
  it("evento ocorrido em data diferente da data de registro é legítimo", () => {
    const event: StudentLifeEvent = {
      eventId: "evt-t1",
      eventTypeDefinitionId: DEMO_EVENT_TYPES.bondConcluded,
      payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.bondClosure,
      scope: { studentId: "alu-1", bondId: "bond-1" },
      effectiveDate: "2027-03-03",
      attributes: { validUntil: "2027-03-03", closureReasonDefinitionId: "encerramento-demo" },
      isCorrection: false,
      provenance: { originTypeId: "secretaria-demo", recordedAt: "2027-03-05T14:00:00.000Z" },
    };
    expect(event.effectiveDate).toBe("2027-03-03");
    expect(event.provenance.recordedAt.slice(0, 10)).toBe("2027-03-05");
    expect(validateEventPayload(baseConfig, event).allowed).toBe(true);
  });

  it("retificação preserva o fato anterior e forma cadeia de versões", () => {
    const original: StudentLifeEvent = {
      eventId: "evt-orig",
      eventTypeDefinitionId: DEMO_EVENT_TYPES.networkAdmission,
      payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.admission,
      scope: { studentId: "alu-9", personId: "pes-9" },
      effectiveDate: "2025-02-10",
      attributes: { admissionDate: "2025-02-10" },
      isCorrection: false,
      provenance,
    };
    const correction: StudentLifeEvent = {
      ...original,
      eventId: "evt-retif",
      effectiveDate: "2025-02-03",
      attributes: { admissionDate: "2025-02-03" },
      isCorrection: true,
      precedingEventId: "evt-orig",
      provenance: {
        originTypeId: "retificacao-demo",
        recordedAt: "2027-04-01T09:00:00.000Z",
        supersedesId: "evt-orig",
        correctionReasonDefinitionId: "erro-de-digitacao-demo",
        act: { actId: "ato-1", actTypeId: "processo-administrativo-demo" },
      },
    };

    const ledger = [original, correction];
    expect(ledger).toHaveLength(2);
    const current = currentEventVersions(ledger);
    expect(current.map((e) => e.eventId)).toEqual(["evt-retif"]);
    expect(eventCorrectionChain(ledger, "evt-orig").map((e) => e.eventId)).toEqual([
      "evt-orig",
      "evt-retif",
    ]);
    expect(
      getFirstNetworkAdmissionDate(ledger, "alu-9", [DEMO_EVENT_TYPES.networkAdmission]),
    ).toBe("2025-02-03");
  });

  it("primeiro ingresso na Rede é projeção derivada; sem evento não há data presumida", () => {
    expect(getFirstNetworkAdmissionDate([], "alu-sem-historico", [DEMO_EVENT_TYPES.networkAdmission]))
      .toBeNull();
    const { events } = adaptDemonstrationStudentLife();
    const student = demonstrationStudents[0]!;
    const derived = getFirstNetworkAdmissionDate(events, student.id, [
      DEMO_EVENT_TYPES.networkAdmission,
    ]);
    expect(derived).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Nenhuma entidade guarda essa data como campo próprio.
    const { roles } = adaptDemonstrationStudentLife();
    expect(Object.keys(roles[0]!)).not.toContain("firstNetworkAdmissionDate");
  });

  it("ledger do aluno fica em ordem cronológica de eficácia", () => {
    const { events } = adaptDemonstrationStudentLife();
    const student = demonstrationStudents.find((item) => item.enrollments.length > 1);
    if (!student) return;
    const ledger = studentLedger(events, student.id);
    const dates = ledger.map((event) => event.effectiveDate);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe("13A — governança extensível e diagnósticos", () => {
  it("novo estado e nova transição entram por configuração, sem alterar o motor", () => {
    const extended: StudentLifeGovernanceConfiguration = {
      ...baseConfig,
      machines: baseConfig.machines.map((machine) =>
        machine.machineId === DEMO_BOND_MACHINE
          ? {
              ...machine,
              states: [
                ...machine.states,
                {
                  stateDefinitionId: "suspenso-futuro",
                  labelSnapshot: "Suspenso (novo)",
                  machineId: DEMO_BOND_MACHINE,
                },
              ],
              transitions: [
                ...machine.transitions,
                {
                  transitionDefinitionId: "vigente->suspenso-futuro",
                  machineId: DEMO_BOND_MACHINE,
                  fromStateDefinitionId: "vigente",
                  toStateDefinitionId: "suspenso-futuro",
                  eventTypeDefinitionId: DEMO_EVENT_TYPES.bondConcluded,
                },
              ],
            }
          : machine,
      ),
    };

    const before = validateTransition(baseConfig, {
      machineId: DEMO_BOND_MACHINE,
      fromStateDefinitionId: "vigente",
      toStateDefinitionId: "suspenso-futuro",
      scope: { bondId: "bond-1" },
    });
    expect(before.allowed).toBe(false);
    expect(before.diagnostics[0]!.code).toBe("SL-TRANS-UNDECLARED");

    const after = validateTransition(extended, {
      machineId: DEMO_BOND_MACHINE,
      fromStateDefinitionId: "vigente",
      toStateDefinitionId: "suspenso-futuro",
      scope: { bondId: "bond-1" },
    });
    expect(after.allowed).toBe(true);
  });

  it("máquinas de aluno e de vínculo são independentes", () => {
    const wrongMachine = validateTransition(baseConfig, {
      machineId: DEMO_STUDENT_MACHINE,
      fromStateDefinitionId: "vigente",
      toStateDefinitionId: "encerrado",
      scope: { studentId: "alu-1" },
    });
    expect(wrongMachine.allowed).toBe(false);
  });

  it("impedimentos, exigências e ato originador são diagnósticos estruturados", () => {
    const result = validateTransition(baseConfig, {
      machineId: DEMO_BOND_MACHINE,
      fromStateDefinitionId: "vigente",
      toStateDefinitionId: "encerrado",
      scope: { bondId: "bond-1", studentId: "alu-1" },
    });
    expect(result.allowed).toBe(false);
    const codes = result.diagnostics.map((item) => item.code);
    expect(codes).toContain("SL-TRANS-REASON-MISSING");
    expect(codes).toContain("SL-TRANS-REQUIREMENT-PENDING");
    expect(codes).toContain("SL-TRANS-ACT-MISSING");
    for (const item of result.diagnostics) {
      expect(typeof item.typeId).toBe("string");
      expect(item.scopeReference).toBeTruthy();
    }
    // Consulta agregada por código, sem processar texto.
    const totals = countDiagnosticsByCode(result.diagnostics);
    expect(totals["SL-TRANS-ACT-MISSING"]).toBe(1);

    const satisfied = validateTransition(baseConfig, {
      machineId: DEMO_BOND_MACHINE,
      fromStateDefinitionId: "vigente",
      toStateDefinitionId: "encerrado",
      reasonDefinitionId: "transferencia-demo",
      satisfiedRequirementTypeIds: ["requisito-documental-demo"],
      hasInstitutionalAct: true,
      scope: { bondId: "bond-1" },
    });
    expect(satisfied.allowed).toBe(true);
  });

  it("payload de evento é validado contra o schema declarado, não é JSON livre", () => {
    const invalid = validateEventPayload(baseConfig, {
      eventTypeDefinitionId: DEMO_EVENT_TYPES.bondConcluded,
      payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.bondClosure,
      attributes: { validUntil: "03/03/2027" },
      scope: { studentId: "alu-1", bondId: "bond-1" },
    });
    expect(invalid.allowed).toBe(false);
    const codes = invalid.diagnostics.map((item) => item.code);
    expect(codes).toContain("SL-EVENT-PAYLOAD-FIELD-TYPE");
    expect(codes).toContain("SL-EVENT-PAYLOAD-FIELD-MISSING");
  });

  it("escopo obrigatório ausente no evento é impedimento estruturado", () => {
    const result = validateEventPayload(baseConfig, {
      eventTypeDefinitionId: DEMO_EVENT_TYPES.bondEstablished,
      payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.bond,
      attributes: { validFrom: "2027-02-01" },
      scope: { studentId: "alu-1" },
    });
    expect(result.allowed).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain("SL-EVENT-SCOPE-MISSING");
  });
});

describe("13A — minimização de dados e adaptação dos protótipos", () => {
  it("referência do aluno não carrega dossiê, documentos nem dados sensíveis", () => {
    const reference = adaptStudentReference(demonstrationStudents[0]!);
    expect(Object.keys(reference).sort()).toEqual([
      "displayName",
      "institutionalIdentifierValue",
      "networkStateDefinitionId",
      "personId",
      "studentId",
    ]);
    const serialized = JSON.stringify(reference).toLowerCase();
    for (const forbidden of ["cpf", "endereco", "laudo", "saude", "filiacao", "contato"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("adaptadores produzem entidades canônicas com IDs distintos entre camadas", () => {
    const { persons, roles, bonds, events } = adaptDemonstrationStudentLife();
    expect(persons.length).toBeGreaterThan(0);
    expect(roles.length).toBe(persons.length);
    expect(events.length).toBeGreaterThan(0);

    for (const role of roles) {
      expect(role.studentId).not.toBe(role.personId);
      expect(role.studentId).not.toBe(role.institutionalIdentifier.value);
    }
    for (const bond of bonds) {
      expect(bond.bondId).not.toBe(bond.studentId);
      expect(bond.bondId).not.toBe(bond.institutionalIdentifier.value);
      expect(bond.episodes.length).toBeGreaterThan(0);
      expect(bond.sourceEventIds.length).toBeGreaterThan(0);
    }
  });

  it("datas adaptadas ficam em ISO interno; nenhuma data vira zero ou texto vazio", () => {
    const { persons, bonds } = adaptDemonstrationStudentLife();
    for (const bond of bonds) {
      for (const episode of bond.episodes) {
        expect(episode.validFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        if (episode.validUntil !== null) {
          expect(episode.validUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    }
    for (const person of persons) {
      if (person.birthDate.present) {
        expect(person.birthDate.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      } else {
        expect(baseConfig.absenceReasonDefinitionIds).toContain(person.birthDate.absenceReasonId);
      }
    }
  });
});
