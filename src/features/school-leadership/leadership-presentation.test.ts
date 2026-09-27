/**
 * Rodada 6B.3.1 — Auditoria automática da camada de apresentação da Direção.
 *
 * Estes testes protegem as travas normativas da gramática "Decidir": nenhum
 * verbo decisório no componente, rito condicional, proteção contra inferência,
 * falha fechada e conformidade sem indicador estatístico.
 */
import { describe, expect, it } from "vitest";
import {
  assessDecisionProcess,
} from "@/features/institutional-decisions/decision-engine";
import {
  LEADERSHIP_CAPACITIES,
  LEADERSHIP_SENSITIVITY,
  demonstrationClosingImpediments,
  demonstrationCompetenceGrants,
  demonstrationDecisionProcessTypes,
  demonstrationDecisionProcesses,
  documentDependentDecisionType,
  exceptionalEnrollmentDecisionType,
} from "@/features/institutional-decisions/decision-fixtures";
import { FACT_AVAILABILITY } from "@/features/institutional-decisions/decision-types";
import {
  buildLeadershipDecisionView,
  factAbsenceLine,
  factValueLine,
  projectAuthorizedDecisionFacts,
  projectPendingProvisions,
  resolveDecisionRitual,
} from "./leadership-presentation";

const isoDate = "2027-05-10";

const documentProcess = demonstrationDecisionProcesses.find(
  (process) =>
    process.decisionProcessTypeDefinitionId ===
    documentDependentDecisionType.decisionProcessTypeDefinitionId,
)!;

const exceptionProcess = demonstrationDecisionProcesses.find(
  (process) =>
    process.decisionProcessTypeDefinitionId ===
    exceptionalEnrollmentDecisionType.decisionProcessTypeDefinitionId,
)!;

function viewFor(input: {
  process: typeof documentProcess;
  typeDefinition: (typeof demonstrationDecisionProcessTypes)[number];
  agentId: string;
  capacityDefinitionIds: readonly string[];
}) {
  const assessment = assessDecisionProcess({
    process: input.process,
    typeDefinition: input.typeDefinition,
    grants: demonstrationCompetenceGrants,
    agentId: input.agentId,
    isoDate,
  });
  return buildLeadershipDecisionView({
    process: input.process,
    typeDefinition: input.typeDefinition,
    assessment,
    capacityDefinitionIds: input.capacityDefinitionIds,
  });
}

describe("proteção contra inferência nos fatos da decisão", () => {
  it("não projeta fato de sensibilidade restrita sem a capacidade declarada", () => {
    const projected = projectAuthorizedDecisionFacts({
      facts: documentProcess.consideredFacts,
      capacityDefinitionIds: [LEADERSHIP_CAPACITIES.decideInstitutionalProcess],
    });
    const keys = projected.facts.map((fact) => fact.factKey);
    expect(keys).not.toContain("fato-registro-restrito-de-acompanhamento");
    expect(projected.suppressedCount).toBe(1);
    expect(projected.omissionNote).toBe(
      "Algumas informações não estão disponíveis neste contexto.",
    );
  });

  it("projeta o fato restrito quando a capacidade específica está concedida", () => {
    const projected = projectAuthorizedDecisionFacts({
      facts: documentProcess.consideredFacts,
      capacityDefinitionIds: [
        LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
        LEADERSHIP_CAPACITIES.readGuidanceRestrictedContent,
      ],
    });
    expect(projected.facts.map((fact) => fact.factKey)).toContain(
      "fato-registro-restrito-de-acompanhamento",
    );
    expect(projected.suppressedCount).toBe(0);
    expect(projected.omissionNote).toBeNull();
  });

  it("suprime integralmente o fato cuja própria ausência não é revelável", () => {
    const projected = projectAuthorizedDecisionFacts({
      facts: [
        {
          factKey: "fato-protegido",
          sourceTypeDefinitionId: "fonte-demo",
          entityId: "ent-demo",
          labelSnapshot: "Fato de existência protegida",
          availability: FACT_AVAILABILITY.unavailable,
          absenceRevealable: false,
        },
      ],
      capacityDefinitionIds: [LEADERSHIP_CAPACITIES.decideInstitutionalProcess],
    });
    expect(projected.facts).toHaveLength(0);
    expect(projected.suppressedCount).toBe(1);
  });

  it("não converte ausência em zero e apresenta o motivo declarado", () => {
    const absent = documentProcess.consideredFacts.find(
      (fact) => fact.factKey === "fato-documento-comprobatorio",
    )!;
    expect(factValueLine(absent)).toBeNull();
    expect(factAbsenceLine(absent)).toContain("ainda não foi apresentado");
  });

  it("não classifica a sensibilidade por conta própria quando ela não está mapeada", () => {
    const projected = projectAuthorizedDecisionFacts({
      facts: [
        {
          factKey: "fato-sensibilidade-desconhecida",
          sourceTypeDefinitionId: "fonte-demo",
          entityId: "ent-demo",
          labelSnapshot: "Fato com sensibilidade não mapeada",
          availability: FACT_AVAILABILITY.available,
          sensitivityLevelDefinitionId: "sensibilidade-inedita-nao-mapeada",
        },
      ],
      capacityDefinitionIds: [
        LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
        LEADERSHIP_SENSITIVITY.restricted,
      ],
    });
    expect(projected.facts).toHaveLength(0);
  });
});

describe("alternativas projetadas da configuração", () => {
  it("apresenta exatamente as alternativas declaradas, sem verbos criados na tela", () => {
    const view = viewFor({
      process: exceptionProcess,
      typeDefinition: exceptionalEnrollmentDecisionType,
      agentId: "agente-direcao-a",
      capacityDefinitionIds: [LEADERSHIP_CAPACITIES.decideInstitutionalProcess],
    });
    expect(view.options.map((option) => option.id)).toEqual(
      exceptionalEnrollmentDecisionType.alternatives.map(
        (alternative) => alternative.alternativeDefinitionId,
      ),
    );
  });

  it("mantém falha fechada: sem competência, a alternativa não é executável e explica", () => {
    const view = viewFor({
      process: exceptionProcess,
      typeDefinition: exceptionalEnrollmentDecisionType,
      agentId: "agente-direcao-b",
      capacityDefinitionIds: [LEADERSHIP_CAPACITIES.consultInstitutionalState],
    });
    expect(view.options.every((option) => option.available === false)).toBe(true);
    for (const option of view.options) {
      expect(option.unavailableReason).toBeTruthy();
    }
    expect(view.blockedNote).toBeTruthy();
  });

  it("explica o fato exigido que ainda falta, em vez de esconder a alternativa", () => {
    const view = viewFor({
      process: documentProcess,
      typeDefinition: documentDependentDecisionType,
      agentId: "agente-direcao-a",
      capacityDefinitionIds: [LEADERSHIP_CAPACITIES.decideInstitutionalProcess],
    });
    expect(view.options).toHaveLength(1);
    expect(view.options[0]!.available).toBe(false);
    expect(view.options[0]!.unavailableReason).toContain("Documento comprobatório");
  });

  it("preserva o diagnóstico institucional e a proveniência para os níveis 2 e 3", () => {
    const view = viewFor({
      process: exceptionProcess,
      typeDefinition: exceptionalEnrollmentDecisionType,
      agentId: "agente-direcao-a",
      capacityDefinitionIds: [LEADERSHIP_CAPACITIES.decideInstitutionalProcess],
    });
    const terms = view.provenance.map((entry) => entry.term);
    expect(terms).toContain("Regra que exige a decisão");
    expect(terms).toContain("Processo (identificador)");
    expect(
      view.options[0]!.provenance.some((entry) => entry.term === "Capacidades exigidas"),
    ).toBe(true);
  });
});

describe("rito condicional", () => {
  it("não pede fundamentação quando a configuração não a exige", () => {
    const ritual = resolveDecisionRitual({
      typeDefinition: { ...exceptionalEnrollmentDecisionType, requiresJustification: false },
    });
    expect(ritual.justification).toBeNull();
  });

  it("não pede declaração de competência quando o rito não a declara", () => {
    const ritual = resolveDecisionRitual({
      typeDefinition: exceptionalEnrollmentDecisionType,
    });
    expect(ritual.competenceDeclaration).toBeNull();
  });

  it("não anuncia ato institucional quando a natureza do ato não tem rótulo declarado", () => {
    const ritual = resolveDecisionRitual({
      typeDefinition: exceptionalEnrollmentDecisionType,
    });
    expect(ritual.actNote).toBeNull();
  });

  it("exibe fundamentação, declaração e ato somente quando declarados", () => {
    const ritual = resolveDecisionRitual({
      typeDefinition: exceptionalEnrollmentDecisionType,
      actNatureLabel: "autorização excepcional demonstrativa",
      competenceDeclarationLabel: "Declaro que exerço esta competência.",
    });
    expect(ritual.justification).not.toBeNull();
    expect(ritual.competenceDeclaration?.label).toContain("Declaro");
    expect(ritual.actNote).toContain("autorização excepcional demonstrativa");
  });
});

describe("providências concretas das turmas (sem indicador estatístico)", () => {
  it("lista objetos concretos com a exigência e a competência declaradas", () => {
    const provisions = projectPendingProvisions({
      impediments: demonstrationClosingImpediments,
      unitIds: ["demo-001"],
    });
    expect(provisions.length).toBeGreaterThan(0);
    for (const provision of provisions) {
      expect(provision.classId).toBeTruthy();
      expect(provision.requirementLine.length).toBeGreaterThan(0);
      // Sem rótulo humano declarado, nada é afirmado no primeiro nível: o
      // identificador do executor permanece apenas na proveniência.
      expect(
        provision.provenance.some((entry) => entry.term === "Executor competente"),
      ).toBe(true);
    }
  });

  it("preserva o estado inconclusivo em vez de presumir conformidade", () => {
    const provisions = projectPendingProvisions({
      impediments: demonstrationClosingImpediments,
      unitIds: ["demo-001"],
    });
    expect(provisions.some((provision) => provision.inconclusive)).toBe(true);
  });

  it("usa o rótulo humano do executor quando a configuração o declara", () => {
    const provisions = projectPendingProvisions({
      impediments: demonstrationClosingImpediments,
      unitIds: ["demo-001"],
      executorLabels: { "executor-secretaria-escolar": "Secretaria da escola" },
    });
    expect(
      provisions.some((provision) => provision.responsibilityLine === "Depende de: Secretaria da escola"),
    ).toBe(true);
  });

  it("não afirma responsável quando só existe identificador técnico", () => {
    const provisions = projectPendingProvisions({
      impediments: demonstrationClosingImpediments,
      unitIds: ["demo-001"],
    });
    expect(provisions.some((provision) => provision.responsibilityLine === null)).toBe(true);
  });

  it("não projeta turmas de unidade fora do escopo consultado", () => {
    const provisions = projectPendingProvisions({
      impediments: demonstrationClosingImpediments,
      unitIds: [],
    });
    expect(provisions).toHaveLength(0);
  });
});
