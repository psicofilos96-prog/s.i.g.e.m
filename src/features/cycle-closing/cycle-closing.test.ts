/**
 * Etapa 12K — conformidade do encerramento oficial do ciclo e da turma.
 *
 * Os cenários provam: os cinco estados do diagnóstico; o bloqueio explícito por
 * incompletude; a extensibilidade por avaliador registrado sem tocar no motor; o
 * encerramento legítimo de percurso SEM situação acadêmica terminal; o retrato
 * duplo (fatos materializados + referências com versão); a imutabilidade do
 * snapshot diante de retificação; a matriz governável de admissibilidade; e
 * fatos analíticos sem interpretação.
 */
import { describe, expect, it } from "vitest";
import type { FactProvenance } from "@/features/assessment/academic-standing-types";
import {
  createRequirementEvaluatorRegistry,
  type ClosingEvaluationContext,
  type RequirementEvaluator,
} from "./cycle-closing-evaluators";
import { operationAdmissibility } from "./cycle-closing-governance";
import { inspectCycleClosing } from "./cycle-closing-inspector";
import { closingAnalyticRows } from "./cycle-closing-analytics";
import { createCycleClosingStore } from "./cycle-closing-store";
import {
  closingDemonstrationActor,
  demonstrationActKinds,
  demonstrationAdmissibilityPolicy,
  demonstrationClosingPolicyQualitative,
  demonstrationInstitutionalStates,
} from "./cycle-closing-fixtures";
import type {
  ClosingObservation,
  CycleClosingPolicy,
  ClosingRequirement,
} from "./cycle-closing-types";

const now = "2027-12-18T12:00:00.000Z";

const provenance: FactProvenance = {
  sources: [{ kind: "fonte-demonstrativa", id: "fnt-1", version: 1 }],
  algorithm: "materializacao-demonstrativa",
  materializedAt: now,
};

const baseContext = (
  overrides: Partial<Parameters<typeof inspectCycleClosing>[0]["context"]> = {},
): Parameters<typeof inspectCycleClosing>[0]["context"] => ({
  classId: "tur-x",
  cycleId: "cic-x",
  academicYearId: "2027",
  students: [{ id: "alu-1", name: "Percurso 1" }],
  observations: [],
  expectations: [],
  now,
  ...overrides,
});

const requirement = (over: Partial<ClosingRequirement>): ClosingRequirement => ({
  id: "req-1",
  label: "Requisito demonstrativo",
  evaluatorId: "estado-de-fonte",
  mandatory: true,
  perStudent: false,
  ...over,
});

const policyOf = (requirements: readonly ClosingRequirement[]): CycleClosingPolicy => ({
  id: "pol-teste",
  version: 1,
  label: "Política de teste",
  status: "rascunho",
  scope: {},
  requirements,
  rectificationPolicy: {
    requiresJustification: true,
    requiredCapabilities: ["retificar-encerramento-turma"],
  },
  closingCapabilities: ["encerrar-ciclo-turma"],
  audit: { events: [], demonstrative: true },
});

const observation = (over: Partial<ClosingObservation>): ClosingObservation => ({
  sourceKind: "fonte-a",
  sourceId: "obs-1",
  dimensions: { classId: "tur-x", cycleId: "cic-x" },
  ...over,
});

describe("12K — diagnóstico com cinco estados", () => {
  it("distingue satisfeito, não satisfeito, não aplicável, inconclusivo e erro de configuração", () => {
    const diagnosis = inspectCycleClosing({
      policy: policyOf([
        requirement({
          id: "req-ok",
          parameters: { sourceKind: "fonte-a", acceptedStates: ["lavrado"] },
        }),
        requirement({
          id: "req-nao",
          parameters: { sourceKind: "fonte-b", acceptedStates: ["lavrado"], minimumCount: 1 },
        }),
        requirement({
          id: "req-na",
          parameters: { sourceKind: "fonte-c", acceptedStates: ["lavrado"] },
        }),
        requirement({
          id: "req-incon",
          parameters: { sourceKind: "fonte-d", acceptedStates: ["lavrado"] },
        }),
        requirement({ id: "req-erro", parameters: { acceptedStates: ["lavrado"] } }),
      ]),
      context: baseContext({
        observations: [
          observation({ sourceKind: "fonte-a", state: "lavrado" }),
          observation({ sourceKind: "fonte-d", sourceId: "obs-d" }),
        ],
      }),
    });

    const status = (id: string) =>
      diagnosis.classRequirements.find((item) => item.requirementId === id)?.status;
    expect(status("req-ok")).toBe("satisfeito");
    expect(status("req-nao")).toBe("nao-satisfeito");
    expect(status("req-na")).toBe("nao-aplicavel");
    expect(status("req-incon")).toBe("inconclusivo");
    expect(status("req-erro")).toBe("erro-configuracao");
    expect(diagnosis.closable).toBe(false);
  });

  it("“100%” considera apenas requisitos obrigatórios e aplicáveis", () => {
    const diagnosis = inspectCycleClosing({
      policy: policyOf([
        requirement({
          id: "req-ok",
          parameters: { sourceKind: "fonte-a", acceptedStates: ["lavrado"] },
        }),
        requirement({
          id: "req-na",
          parameters: { sourceKind: "fonte-inexistente", acceptedStates: ["lavrado"] },
        }),
        requirement({
          id: "req-opcional",
          mandatory: false,
          parameters: { sourceKind: "fonte-b", acceptedStates: ["lavrado"], minimumCount: 1 },
        }),
      ]),
      context: baseContext({
        observations: [observation({ sourceKind: "fonte-a", state: "lavrado" })],
      }),
    });
    expect(diagnosis.applicableMandatory).toBe(1);
    expect(diagnosis.satisfiedMandatory).toBe(1);
    expect(diagnosis.closable).toBe(true);
  });

  it("dado ausente nunca é tratado como critério atendido", () => {
    const diagnosis = inspectCycleClosing({
      policy: policyOf([
        requirement({
          id: "req-fato",
          evaluatorId: "fato-disponivel",
          parameters: { factId: "fat-demo", sourceKind: "fonte-a" },
        }),
      ]),
      context: baseContext({
        observations: [
          observation({
            sourceKind: "fonte-a",
            state: "lavrado",
            facts: [
              {
                factId: "fat-demo",
                scopeKey: "ciclo:cic-x",
                label: "Fato demonstrativo",
                value: null,
                unavailableReason: "fonte sem fechamento oficial",
                provenance,
              },
            ],
          }),
        ],
      }),
    });
    expect(diagnosis.classRequirements[0]!.status).toBe("inconclusivo");
    expect(diagnosis.closable).toBe(false);
  });
});

describe("12K — extensibilidade sem alterar o motor", () => {
  it("nova exigência institucional é atendida por avaliador registrado", () => {
    const registry = createRequirementEvaluatorRegistry();
    const inventado: RequirementEvaluator = {
      id: "exigencia-institucional-futura",
      label: "Exigência fictícia registrada em teste",
      description: "Prova que o inspetor não conhece a lista de exigências.",
      evaluate: ({ context }: { context: ClosingEvaluationContext }) => ({
        status: context.studentIds.length ? "satisfeito" : "nao-satisfeito",
        reason: "Avaliador fictício registrado dinamicamente.",
      }),
    };
    registry.register(inventado);

    const diagnosis = inspectCycleClosing({
      policy: policyOf([
        requirement({ id: "req-futuro", evaluatorId: "exigencia-institucional-futura" }),
      ]),
      context: baseContext(),
      registry,
    });
    expect(diagnosis.classRequirements[0]!.status).toBe("satisfeito");
    expect(diagnosis.closable).toBe(true);
  });

  it("requisito sem avaliador registrado devolve erro de configuração, não sucesso", () => {
    const diagnosis = inspectCycleClosing({
      policy: policyOf([requirement({ id: "req-sem", evaluatorId: "avaliador-inexistente" })]),
      context: baseContext(),
    });
    expect(diagnosis.classRequirements[0]!.status).toBe("erro-configuracao");
    expect(diagnosis.closable).toBe(false);
  });
});

describe("12K — situação acadêmica terminal é exigência da política", () => {
  it("política que exige situação terminal bloqueia percurso sem situação", () => {
    const policy: CycleClosingPolicy = {
      ...policyOf([]),
      terminalStandingRequirement: { required: true },
    };
    const diagnosis = inspectCycleClosing({ policy, context: baseContext() });
    expect(diagnosis.students[0]!.status).toBe("inconclusivo");
    expect(diagnosis.closable).toBe(false);
  });

  it("percurso qualitativo encerra sem APROVADO, REPROVADO ou qualquer situação terminal", () => {
    const store = createCycleClosingStore();
    const actor = closingDemonstrationActor("perfil-encerramento-lavratura");
    const policy = demonstrationClosingPolicyQualitative;
    const context = baseContext({
      observations: [
        observation({
          sourceKind: "registro-de-percurso",
          sourceId: "per-1",
          state: "registrado",
          dimensions: { classId: "tur-x", cycleId: "cic-x", studentId: "alu-1" },
        }),
      ],
    });
    const diagnosis = inspectCycleClosing({ policy, context });
    expect(diagnosis.closable).toBe(true);

    const result = store.close({
      actor,
      policy,
      classId: "tur-x",
      cycleId: "cic-x",
      diagnosis,
      students: [
        {
          studentId: "alu-1",
          cycleId: "cic-x",
          resolutionSourceTypeId: "percurso-qualitativo-demonstrativo",
          completeness: "satisfeito",
          reason: "Requisitos configurados do percurso satisfeitos.",
          diagnoses: diagnosis.students[0]!.diagnoses,
          facts: [],
          sources: [{ kind: "registro-de-percurso", id: "per-1" }],
        },
      ],
      sources: [{ kind: "registro-de-percurso", id: "per-1" }],
      facts: [],
      institutionalState: demonstrationInstitutionalStates.closed,
      actKindId: demonstrationActKinds.closing.id,
      actKindLabel: demonstrationActKinds.closing.label,
      now,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.students[0]!.terminalStandingId).toBeUndefined();
    expect(result.value.institutionalState).toBe("encerrado");
  });
});

describe("12K — ato, snapshot e rito de alteração", () => {
  const policy = policyOf([
    requirement({ id: "req-ok", parameters: { sourceKind: "fonte-a", acceptedStates: ["lavrado"] } }),
  ]);
  const context = baseContext({
    observations: [observation({ sourceKind: "fonte-a", state: "lavrado", version: 3 })],
  });

  const lavrar = (store: ReturnType<typeof createCycleClosingStore>, profileId: string) => {
    const diagnosis = inspectCycleClosing({ policy, context });
    return store.close({
      actor: closingDemonstrationActor(profileId),
      policy,
      classId: "tur-x",
      cycleId: "cic-x",
      diagnosis,
      students: [
        {
          studentId: "alu-1",
          cycleId: "cic-x",
          completeness: "satisfeito",
          reason: "Percurso sem exigência individual.",
          diagnoses: [],
          facts: [
            {
              factId: "fat-demo",
              scopeKey: "ciclo:cic-x",
              label: "Fato materializado no encerramento",
              value: 42,
              provenance,
            },
          ],
          sources: [{ kind: "fonte-a", id: "obs-1", version: 3 }],
        },
      ],
      sources: [{ kind: "fonte-a", id: "obs-1", version: 3, materializedAt: now }],
      facts: [
        {
          factId: "fat-demo",
          scopeKey: "ciclo:cic-x",
          label: "Fato materializado no encerramento",
          value: 42,
          provenance,
        },
      ],
      institutionalState: demonstrationInstitutionalStates.closed,
      actKindId: demonstrationActKinds.closing.id,
      actKindLabel: demonstrationActKinds.closing.label,
      now,
    });
  };

  it("bloqueia a lavratura sem capacidade cadastrada", () => {
    const store = createCycleClosingStore();
    const result = lavrar(store, "perfil-encerramento-consulta");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.join(" ")).toContain("encerrar-ciclo-turma");
  });

  it("guarda fato materializado e referência da fonte com versão", () => {
    const store = createCycleClosingStore();
    const result = lavrar(store, "perfil-encerramento-lavratura");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.facts[0]!.value).toBe(42);
    expect(result.value.sources[0]!.version).toBe(3);
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it("segunda lavratura exige rito: retificação gera nova versão encadeada", () => {
    const store = createCycleClosingStore();
    expect(lavrar(store, "perfil-encerramento-lavratura").ok).toBe(true);
    const again = lavrar(store, "perfil-encerramento-lavratura");
    expect(again.ok).toBe(false);

    const semJustificativa = store.rectify({
      actor: closingDemonstrationActor("perfil-encerramento-retificacao"),
      policy,
      classId: "tur-x",
      cycleId: "cic-x",
      diagnosis: inspectCycleClosing({ policy, context }),
      students: [],
      sources: [],
      facts: [],
      institutionalState: demonstrationInstitutionalStates.closed,
      actKindId: demonstrationActKinds.rectification.id,
      actKindLabel: demonstrationActKinds.rectification.label,
      justification: "   ",
      now,
    });
    expect(semJustificativa.ok).toBe(false);

    const rectified = store.rectify({
      actor: closingDemonstrationActor("perfil-encerramento-retificacao"),
      policy,
      classId: "tur-x",
      cycleId: "cic-x",
      diagnosis: inspectCycleClosing({ policy, context }),
      students: [],
      sources: [],
      facts: [],
      institutionalState: demonstrationInstitutionalStates.closed,
      actKindId: demonstrationActKinds.rectification.id,
      actKindLabel: demonstrationActKinds.rectification.label,
      justification: "Correção formal demonstrativa, registrada e auditada.",
      now,
    });
    expect(rectified.ok).toBe(true);
    if (!rectified.ok) return;
    expect(rectified.value.version).toBe(2);
    expect(rectified.value.precedingClosingId).toBe(store.chain({ classId: "tur-x", cycleId: "cic-x" })[0]!.id);

    // A versão anterior permanece integralmente preservada.
    const first = store.chain({ classId: "tur-x", cycleId: "cic-x" })[0]!;
    expect(first.facts[0]!.value).toBe(42);
    expect(first.students).toHaveLength(1);
  });

  it("reabertura é rito auditado e altera o estado institucional declarado", () => {
    const store = createCycleClosingStore();
    expect(lavrar(store, "perfil-encerramento-lavratura").ok).toBe(true);
    const negada = store.reopen({
      actor: closingDemonstrationActor("perfil-encerramento-lavratura"),
      policy,
      classId: "tur-x",
      cycleId: "cic-x",
      justification: "Tentativa sem capacidade.",
      institutionalState: demonstrationInstitutionalStates.underRectification,
      actKindLabel: demonstrationActKinds.reopening.label,
      now,
    });
    expect(negada.ok).toBe(false);

    const reopened = store.reopen({
      actor: closingDemonstrationActor("perfil-encerramento-retificacao"),
      policy,
      classId: "tur-x",
      cycleId: "cic-x",
      justification: "Reabertura demonstrativa fundamentada.",
      institutionalState: demonstrationInstitutionalStates.underRectification,
      actKindLabel: demonstrationActKinds.reopening.label,
      now,
    });
    expect(reopened.ok).toBe(true);
    expect(
      store.institutionalState(
        { classId: "tur-x", cycleId: "cic-x" },
        demonstrationInstitutionalStates.open,
      ),
    ).toBe("em-retificacao");
  });
});

describe("12K — matriz governável de admissibilidade", () => {
  it("a mesma operação muda de admissibilidade conforme o estado, por cadastro", () => {
    const closed = operationAdmissibility({
      policy: demonstrationAdmissibilityPolicy,
      operationId: "registrar-lancamento-avaliativo",
      institutionalState: "encerrado",
    });
    const rectifying = operationAdmissibility({
      policy: demonstrationAdmissibilityPolicy,
      operationId: "registrar-lancamento-avaliativo",
      institutionalState: "em-retificacao",
    });
    const unknownOperation = operationAdmissibility({
      policy: demonstrationAdmissibilityPolicy,
      operationId: "operacao-de-modulo-futuro",
      institutionalState: "encerrado",
    });
    expect(closed.admissibility).toBe("vedada");
    expect(rectifying.admissibility).toBe("exige-rito");
    expect(unknownOperation.admissibility).toBe("permitida");
  });

  it("sem matriz declarada o encerramento não restringe operações por conta própria", () => {
    expect(
      operationAdmissibility({ operationId: "qualquer", institutionalState: "encerrado" })
        .admissibility,
    ).toBe("permitida");
  });
});

describe("12K — fatos analíticos para o CIECE", () => {
  it("preservam proveniência e não calculam taxa alguma", () => {
    const store = createCycleClosingStore();
    const policy = demonstrationClosingPolicyQualitative;
    const context = baseContext({
      observations: [
        observation({
          sourceKind: "registro-de-percurso",
          sourceId: "per-1",
          state: "registrado",
          dimensions: { classId: "tur-x", cycleId: "cic-x", studentId: "alu-1" },
        }),
      ],
    });
    const diagnosis = inspectCycleClosing({ policy, context });
    store.close({
      actor: closingDemonstrationActor("perfil-encerramento-lavratura"),
      policy,
      classId: "tur-x",
      cycleId: "cic-x",
      unitId: "uni-1",
      academicYearId: "2027",
      diagnosis,
      students: [
        {
          studentId: "alu-1",
          cycleId: "cic-x",
          resolutionSourceTypeId: "percurso-qualitativo-demonstrativo",
          completeness: "satisfeito",
          reason: "Requisitos satisfeitos.",
          diagnoses: diagnosis.students[0]!.diagnoses,
          facts: [],
          sources: [{ kind: "registro-de-percurso", id: "per-1", version: 1 }],
        },
      ],
      sources: [{ kind: "registro-de-percurso", id: "per-1", version: 1 }],
      facts: [],
      institutionalState: demonstrationInstitutionalStates.closed,
      actKindId: demonstrationActKinds.closing.id,
      actKindLabel: demonstrationActKinds.closing.label,
      now,
    });

    const rows = closingAnalyticRows(store.snapshots());
    expect(rows).toHaveLength(2);
    const student = rows.find((row) => row.category === "encerramento-percurso")!;
    expect(student.dimensions['resolutionSourceTypeId']).toBe(
      "percurso-qualitativo-demonstrativo",
    );
    expect(student.dimensions['terminalStandingId']).toBeNull();
    expect(student.provenance['policyVersion']).toBe(1);
    const keys = rows.flatMap((row) => Object.keys(row.dimensions));
    expect(keys.join(" ")).not.toMatch(/taxa|aprovacao|reprovacao|abandono|percentual/i);
  });
});
