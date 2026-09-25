/**
 * Auditoria do construtor de regras de situação acadêmica.
 *
 * Os cenários provam que a infraestrutura não foi arquitetada para as regras
 * hoje informadas: regras fictícias radicalmente diferentes são representadas,
 * diagnosticadas e simuladas SEM qualquer alteração do motor.
 */
import { describe, expect, it } from "vitest";
import {
  builderCapabilities,
  builderDiagnostics,
  describeRuleSet,
  diagnosticsBlockHomologation,
  mapNodeTree,
  newStep,
  reorderSteps,
  simulateStandingRuleSet,
} from "./standing-rule-builder";
import { networkStandingRuleDrafts } from "./academic-standing-network-rules";
import type {
  AcademicStandingRuleSet,
  CriterionNode,
  StandingRuleStep,
} from "./academic-standing-types";

const cycle = { id: "ciclo-teste", kindId: "qualquer", academicYearId: "2026" };

const ruleOf = (id: string) => networkStandingRuleDrafts.find((rule) => rule.id === id)!;

const base = (overrides: Partial<AcademicStandingRuleSet>): AcademicStandingRuleSet => ({
  id: "rgs-ficticia",
  version: 1,
  label: "Regra fictícia",
  status: "rascunho",
  scope: { academicYearId: "2099" },
  standings: [],
  parameters: [],
  bodies: [],
  steps: [],
  audit: { events: [], demonstrative: true },
  ...overrides,
});

describe("rascunhos institucionais informados", () => {
  it("representa Anos Iniciais com presença global e rendimento cumulativos", () => {
    const rule = ruleOf("rgs-rede-anos-iniciais");
    expect(rule.status).toBe("rascunho");
    const simulation = simulateStandingRuleSet({
      ruleSet: rule,
      cycle,
      scopes: [
        { scope: { kind: "ciclo" }, values: { "proporcao-de-presenca-por-unidades": 0.8 } },
        {
          scope: { kind: "componente-curricular", id: "comp-1" },
          values: { "resultado-pos-recuperacao-do-ciclo": 62 },
        },
      ],
    });
    expect(simulation.determination.standing?.code).toBe("APROVADO");

    const reproved = simulateStandingRuleSet({
      ruleSet: rule,
      cycle,
      scopes: [
        { scope: { kind: "ciclo" }, values: { "proporcao-de-presenca-por-unidades": 0.6 } },
        {
          scope: { kind: "componente-curricular", id: "comp-1" },
          values: { "resultado-pos-recuperacao-do-ciclo": 80 },
        },
      ],
    });
    expect(reproved.determination.standing?.code).toBe("REPROVADO");
  });

  it("apura Anos Finais por componente, com limite de componentes configurado", () => {
    const rule = ruleOf("rgs-rede-anos-finais");
    const scopes = (a: number, b: number, freqA: number, freqB: number) => [
      {
        scope: { kind: "componente-curricular", id: "comp-a" },
        values: {
          "resultado-pos-recuperacao-do-ciclo": a,
          "proporcao-de-presenca-por-unidades": freqA,
        },
      },
      {
        scope: { kind: "componente-curricular", id: "comp-b" },
        values: {
          "resultado-pos-recuperacao-do-ciclo": b,
          "proporcao-de-presenca-por-unidades": freqB,
        },
      },
    ];

    expect(
      simulateStandingRuleSet({ ruleSet: rule, cycle, scopes: scopes(70, 80, 0.9, 0.95) })
        .determination.standing?.code,
    ).toBe("APROVADO");

    // Insuficiência apenas de frequência em um componente: dentro do limite.
    const partial = simulateStandingRuleSet({
      ruleSet: rule,
      cycle,
      scopes: scopes(70, 80, 0.9, 0.5),
    });
    expect(partial.determination.standingId).toBeNull();
    expect(partial.determination.pendencies.map((p) => p.id)).toContain(
      "progressao-parcial-sem-situacao-definida",
    );
  });

  it("não presume resultado quando um fato do componente está indisponível", () => {
    const rule = ruleOf("rgs-rede-anos-finais");
    const simulation = simulateStandingRuleSet({
      ruleSet: rule,
      cycle,
      scopes: [
        {
          scope: { kind: "componente-curricular", id: "comp-a" },
          values: {
            "resultado-pos-recuperacao-do-ciclo": null,
            "proporcao-de-presenca-por-unidades": 0.9,
          },
        },
      ],
    });
    expect(simulation.determination.standingId).toBeNull();
    expect(simulation.determination.operationalState).not.toBe("situacao-determinada");
  });

  it("registra 75% por componente e limite de 2 componentes como parâmetros editáveis", () => {
    const rule = ruleOf("rgs-rede-anos-finais");
    const presenca = rule.parameters.find((p) => p.id === "par-af-presenca")!;
    const limite = rule.parameters.find((p) => p.id === "par-af-limite-componentes")!;
    expect(presenca.value).toBe(0.75);
    expect(limite.value).toBe(2);
    expect(rule.status).toBe("rascunho");
    // Três insuficiências: acima do limite cadastrado, sem situação presumida.
    const acima = simulateStandingRuleSet({
      ruleSet: rule,
      cycle,
      scopes: [0.5, 0.4, 0.3].map((freq, index) => ({
        scope: { kind: "componente-curricular", id: `comp-${index}` },
        values: {
          "resultado-pos-recuperacao-do-ciclo": 80,
          "proporcao-de-presenca-por-unidades": freq,
        },
      })),
    });
    expect(acima.determination.standingId).toBeNull();
    expect(acima.determination.pendencies.map((p) => p.id)).toContain(
      "acima-do-limite-sem-definicao",
    );
  });

  it("aponta média ponderada como capacidade ainda não suportada", () => {
    const rule = base({
      standings: [
        {
          id: "st-x",
          code: "X",
          label: "X",
          origin: "determinacao-por-regra",
          description: "Situação fictícia usada apenas neste cenário de auditoria.",
          properties: [],
          effects: [],
        },
      ],

      parameters: [{ id: "p-x", label: "Mínimo", value: 10 }],
      steps: [
        {
          id: "s-pond",
          order: 1,
          label: "Média ponderada dos componentes",
          when: {
            id: "n-pond",
            kind: "comparacao",
            fact: {
              factId: "resultado-pos-recuperacao-do-ciclo",
              scope: { kind: "componente-curricular" },
            },
            aggregation: { operator: "media-ponderada" as never },
            operator: "maior-ou-igual",
            parameter: { kind: "parametro", parameterId: "p-x" },
          },
          consequence: { kind: "atribuir-situacao", standingId: "st-x" },
          stopsOnMatch: true,
        },
      ],
    });
    const diagnostics = builderDiagnostics(rule);
    const issue = diagnostics.find((item) => item.severity === "capacidade-nao-suportada");
    expect(issue?.message).toContain("média ponderada");
    expect(issue?.message).toContain("ainda não suportada");
    expect(diagnosticsBlockHomologation(diagnostics).length).toBeGreaterThan(0);
  });

  it("deixa explícito o que a rede ainda não definiu", () => {
    const diagnostics = builderDiagnostics(ruleOf("rgs-rede-anos-finais"));
    expect(diagnostics.some((item) => item.id === "sem-consequencia-padrao")).toBe(true);
    expect(diagnosticsBlockHomologation(diagnostics).length).toBeGreaterThan(0);
  });


  it("descreve a regra em linguagem natural, sem jargão de programação", () => {
    const lines = describeRuleSet(ruleOf("rgs-rede-anos-iniciais")).join(" ");
    expect(lines).toContain("SE");
    expect(lines).toContain("ENTÃO");
    expect(lines).toContain("Presença mínima do ciclo");
    expect(lines).not.toMatch(/function|=>|\{\}/);
  });
});

describe("extensibilidade: regras radicalmente diferentes", () => {
  it("representa regra por área de conhecimento com limite de 5 e média ponderada por soma", () => {
    const steps: StandingRuleStep[] = [
      {
        id: "s1",
        order: 1,
        label: "Soma dos resultados das áreas alcança o total exigido",
        when: {
          id: "n1",
          kind: "comparacao",
          fact: { factId: "resultado-consolidado-do-ciclo", scope: { kind: "area-de-conhecimento" } },
          aggregation: { operator: "soma" },
          operator: "maior-ou-igual",
          parameter: { kind: "parametro", parameterId: "p-total" },
        },
        consequence: { kind: "atribuir-situacao", standingId: "st-progride" },
        stopsOnMatch: true,
      },
      {
        id: "s2",
        order: 2,
        label: "Áreas insuficientes dentro do limite de cinco",
        when: {
          id: "n2",
          kind: "comparacao",
          fact: { factId: "resultado-consolidado-do-ciclo", scope: { kind: "area-de-conhecimento" } },
          aggregation: {
            operator: "contagem",
            where: {
              id: "n2f",
              kind: "comparacao",
              fact: {
                factId: "resultado-consolidado-do-ciclo",
                scope: { kind: "area-de-conhecimento" },
              },
              operator: "menor",
              parameter: { kind: "literal", value: 30 },
            },
          },
          operator: "menor-ou-igual",
          parameter: { kind: "parametro", parameterId: "p-limite" },
        },
        consequence: { kind: "atribuir-situacao", standingId: "st-continuidade" },
        stopsOnMatch: true,
      },
    ];

    const rule = base({
      standings: [
        {
          id: "st-progride",
          code: "PROGRIDE",
          label: "Progride no percurso",
          description: "Situação fictícia.",
          properties: {},
          effects: [],
        },
        {
          id: "st-continuidade",
          code: "CONTINUIDADE",
          label: "Continuidade com apoio",
          description: "Situação fictícia.",
          properties: {},
          effects: [],
        },
      ],
      parameters: [
        { id: "p-total", label: "Total exigido na soma das áreas", value: 200 },
        { id: "p-limite", label: "Limite de áreas insuficientes", value: 5 },
      ],
      steps,
      defaultConsequence: { kind: "atribuir-situacao", standingId: "st-continuidade" },
    });

    expect(builderDiagnostics(rule).every((item) => item.severity === "completo")).toBe(true);

    const simulation = simulateStandingRuleSet({
      ruleSet: rule,
      cycle,
      scopes: [1, 2, 3].map((index) => ({
        scope: { kind: "area-de-conhecimento", id: `area-${index}` },
        values: { "resultado-consolidado-do-ciclo": 80 },
      })),
    });
    expect(simulation.determination.standing?.code).toBe("PROGRIDE");
  });

  it("representa regra qualitativa sem nota, baseada só em disponibilidade de fato", () => {
    const rule = base({
      id: "rgs-qualitativa",
      standings: [
        {
          id: "st-registrado",
          code: "REGISTRO-COMPLETO",
          label: "Percurso registrado integralmente",
          description: "Situação fictícia qualitativa.",
          properties: {},
          effects: [],
        },
      ],
      steps: [
        {
          id: "q1",
          order: 1,
          label: "Consolidação do ciclo disponível em todo o percurso",
          when: {
            id: "qn1",
            kind: "comparacao",
            fact: { factId: "consolidacao-do-ciclo-completa", scope: { kind: "componente-curricular" } },
            operator: "verdadeiro",
            parameter: { kind: "sem-parametro" },
          },
          consequence: { kind: "atribuir-situacao", standingId: "st-registrado" },
          stopsOnMatch: true,
        },
      ],
      defaultConsequence: { kind: "prosseguir" },
    });

    const simulation = simulateStandingRuleSet({
      ruleSet: rule,
      cycle,
      scopes: [
        {
          scope: { kind: "componente-curricular", id: "c1" },
          values: { "consolidacao-do-ciclo-completa": true },
        },
      ],
    });
    expect(simulation.determination.standing?.code).toBe("REGISTRO-COMPLETO");
  });

  it("encaminha a colegiado com competência declarada pela própria regra", () => {
    const rule = base({
      id: "rgs-colegiado",
      standings: [
        {
          id: "st-x",
          code: "X",
          label: "Situação X",
          description: "Fictícia.",
          properties: {},
          effects: [],
        },
      ],
      bodies: [
        {
          id: "org-x",
          label: "Colegiado fictício",
          competences: [{ id: "cmp-x", label: "Deliberar sobre o percurso" }],
        },
      ],
      parameters: [{ id: "p-x", label: "Referência fictícia", value: 10 }],
      steps: [
        {
          id: "c1",
          order: 1,
          label: "Resultado abaixo da referência encaminha ao colegiado",
          when: {
            id: "cn1",
            kind: "comparacao",
            fact: { factId: "resultado-consolidado-do-ciclo", scope: { kind: "componente-curricular" } },
            aggregation: { operator: "minimo" },
            operator: "menor",
            parameter: { kind: "parametro", parameterId: "p-x" },
          },
          consequence: {
            kind: "encaminhar-para-deliberacao",
            bodyId: "org-x",
            competenceId: "cmp-x",
          },
          stopsOnMatch: true,
        },
      ],
      defaultConsequence: { kind: "atribuir-situacao", standingId: "st-x" },
    });

    const simulation = simulateStandingRuleSet({
      ruleSet: rule,
      cycle,
      scopes: [
        {
          scope: { kind: "componente-curricular", id: "c1" },
          values: { "resultado-consolidado-do-ciclo": 4 },
        },
      ],
    });
    expect(simulation.determination.operationalState).toBe("aguardando-deliberacao");
    expect(simulation.determination.requiresDeliberation?.competenceId).toBe("cmp-x");
  });

  it("acrescenta dimensão de escopo inédita sem alterar o motor", () => {
    const rule = base({
      id: "rgs-turno",
      standings: [
        {
          id: "st-turno",
          code: "TURNO-OK",
          label: "Presença suficiente no turno",
          description: "Fictícia.",
          properties: {},
          effects: [],
        },
      ],
      parameters: [{ id: "p-turno", label: "Presença mínima do turno", value: 0.6 }],
      steps: [
        {
          id: "t1",
          order: 1,
          label: "Presença apurada por turno",
          when: {
            id: "tn1",
            kind: "comparacao",
            fact: { factId: "proporcao-de-presenca-por-unidades", scope: { kind: "turno-inedito" } },
            operator: "maior-ou-igual",
            parameter: { kind: "parametro", parameterId: "p-turno" },
          },
          consequence: { kind: "atribuir-situacao", standingId: "st-turno" },
          stopsOnMatch: true,
        },
      ],
      defaultConsequence: { kind: "prosseguir" },
    });

    const simulation = simulateStandingRuleSet({
      ruleSet: rule,
      cycle,
      scopes: [
        {
          scope: { kind: "turno-inedito", id: "vespertino" },
          values: { "proporcao-de-presenca-por-unidades": 0.7 },
        },
      ],
    });
    expect(simulation.determination.standing?.code).toBe("TURNO-OK");
  });
});

describe("diagnóstico e edição estrutural", () => {
  it("identifica capacidade ainda não suportada em vez de aproximar", () => {
    const rule = base({
      steps: [
        {
          id: "x1",
          order: 1,
          label: "Critério com operador inexistente",
          when: {
            id: "xn1",
            kind: "comparacao",
            fact: { factId: "resultado-consolidado-do-ciclo", scope: { kind: "ciclo" } },
            operator: "regressao-linear" as never,
            parameter: { kind: "literal", value: 1 },
          },
          consequence: { kind: "prosseguir" },
          stopsOnMatch: false,
        },
      ],
    });
    const diagnostics = builderDiagnostics(rule);
    expect(diagnostics.some((item) => item.severity === "capacidade-nao-suportada")).toBe(true);
  });

  it("aponta fato que o sistema ainda não fornece", () => {
    const rule = base({
      steps: [
        {
          id: "y1",
          order: 1,
          label: "Critério com fato inexistente",
          when: {
            id: "yn1",
            kind: "comparacao",
            fact: { factId: "fato-que-nao-existe", scope: { kind: "ciclo" } },
            operator: "maior",
            parameter: { kind: "literal", value: 1 },
          },
          consequence: { kind: "prosseguir" },
          stopsOnMatch: false,
        },
      ],
    });
    expect(
      builderDiagnostics(rule).some((item) => item.id === "fato-indisponivel:fato-que-nao-existe"),
    ).toBe(true);
  });

  it("aponta ordem ambígua entre critérios", () => {
    const rule = base({ steps: [newStep(1), { ...newStep(1), id: "dup" }] });
    expect(builderDiagnostics(rule).some((item) => item.id === "ordem-duplicada:1")).toBe(true);
  });

  it("reordena critérios preservando sequência contígua", () => {
    const steps = [newStep(1), newStep(2), newStep(3)];
    const reordered = reorderSteps(steps, steps[2]!.id, -1);
    expect(reordered.map((step) => step.order)).toEqual([1, 2, 3]);
    expect(reordered.find((step) => step.id === steps[2]!.id)?.order).toBe(2);
  });

  it("edita e remove nós aninhados sem perder a estrutura", () => {
    const node: CriterionNode = {
      id: "g1",
      kind: "composicao",
      logic: "e",
      children: [
        {
          id: "a",
          kind: "comparacao",
          fact: { factId: "resultado-consolidado-do-ciclo" },
          operator: "maior",
          parameter: { kind: "literal", value: 1 },
        },
        {
          id: "b",
          kind: "comparacao",
          fact: { factId: "resultado-consolidado-do-ciclo" },
          operator: "menor",
          parameter: { kind: "literal", value: 9 },
        },
      ],
    };
    const removed = mapNodeTree(node, "a", () => null);
    expect(removed?.kind === "composicao" && removed.children.length).toBe(1);
  });

  it("só oferece as capacidades efetivamente suportadas pelo motor", () => {
    const capabilities = builderCapabilities();
    expect(capabilities.some((item) => item.kind === "comparacao")).toBe(true);
    expect(capabilities.some((item) => item.id === "regressao-linear")).toBe(false);
  });
});
