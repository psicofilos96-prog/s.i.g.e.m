/**
 * Etapa 12I — testes da infraestrutura de situação acadêmica.
 *
 * Os conjuntos normativos usados aqui são de TESTE: existem para exercitar as
 * primitivas do motor e não representam norma da Rede Municipal.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  determineAcademicStanding,
  evaluateNode,
  explainDetermination,
} from "./academic-standing-engine";
import {
  standingRuleIssues,
  standingDemonstrationActor,
  ruleSetDeterminesStanding,
} from "./academic-standing-governance";
import {
  createAcademicStandingStore,
  standingScopeKey,
} from "./academic-standing-store";
import { standingAnalyticRows } from "./academic-standing-analytics";
import { demonstrationStandingRuleSets } from "./academic-standing-fixtures";
import {
  scopeKeyOf,
  type AcademicStandingRuleSet,
  type CriterionNode,
  type FactProvenance,
  type InstitutionalDeliberationRecord,
  type ResolvedFact,
  type StandingValue,
} from "./academic-standing-types";

const provenance: FactProvenance = {
  sources: [{ kind: "teste", id: "fonte-de-teste", version: 1 }],
  algorithm: "fixture de teste",
  materializedAt: "2026-02-01T12:00:00.000Z",
};

const fact = (
  factId: string,
  scope: { kind: string; id?: string },
  value: StandingValue | readonly StandingValue[] | null,
): ResolvedFact => ({
  factId,
  scope,
  scopeKey: scopeKeyOf(scope),
  category: "consolidado",
  valueKind: typeof value === "boolean" ? "booleano" : "numero",
  value,
  provenance,
});

const cycle = { id: "cic-teste", kindId: "kind-teste", academicYearId: "2026" };

function ruleSet(
  overrides: Partial<AcademicStandingRuleSet> = {},
): AcademicStandingRuleSet {
  return {
    id: "rgs-teste",
    version: 1,
    label: "Conjunto de teste",
    status: "homologada",
    scope: { academicYearId: "2026" },
    standings: [
      {
        id: "sit-x",
        code: "X",
        label: "Situação X (teste)",
        description: "Situação de teste",
        properties: {},
        effects: [],
      },
      {
        id: "sit-y",
        code: "Y",
        label: "Situação Y (teste)",
        description: "Situação de teste",
        properties: {},
        effects: [],
      },
    ],
    parameters: [{ id: "par-corte", label: "Referência de teste", value: 10 }],
    bodies: [
      {
        id: "org-teste",
        label: "Órgão de teste",
        competences: [{ id: "cmp-teste", label: "Competência de teste" }],
      },
    ],
    steps: [
      {
        id: "stp-1",
        order: 1,
        label: "Resultado acima da referência cadastrada",
        when: {
          id: "nod-1",
          kind: "comparacao",
          fact: { factId: "resultado", scope: { kind: "componente-curricular", id: "c1" } },
          operator: "maior-ou-igual",
          parameter: { kind: "parametro", parameterId: "par-corte" },
        },
        consequence: { kind: "atribuir-situacao", standingId: "sit-x" },
        stopsOnMatch: true,
      },
      {
        id: "stp-2",
        order: 2,
        label: "Encaminhamento ao órgão configurado",
        when: {
          id: "nod-2",
          kind: "comparacao",
          fact: { factId: "resultado", scope: { kind: "componente-curricular", id: "c1" } },
          operator: "existe",
          parameter: { kind: "sem-parametro" },
        },
        consequence: {
          kind: "encaminhar-para-deliberacao",
          bodyId: "org-teste",
          competenceId: "cmp-teste",
        },
        stopsOnMatch: true,
      },
    ],
    audit: { events: [], demonstrative: true },
    ...overrides,
  };
}

const baseInput = (facts: ResolvedFact[], rule?: AcademicStandingRuleSet) => ({
  cycle,
  studentId: "alu-1",
  facts,
  cycleComplete: true,
  factsOfficial: true,
  ...(rule ? { ruleSet: rule } : {}),
});

describe("12I — camadas e bloqueios institucionais", () => {
  it("sem regra homologada não determina situação alguma", () => {
    const result = determineAcademicStanding(baseInput([fact("resultado", { kind: "componente-curricular", id: "c1" }, 30)]));
    expect(result.operationalState).toBe("aguardando-regra-homologada");
    expect(result.standingId).toBeNull();
    expect(result.official).toBe(false);
  });

  it("regra em rascunho não determina situação", () => {
    const result = determineAcademicStanding(
      baseInput([fact("resultado", { kind: "componente-curricular", id: "c1" }, 30)], ruleSet({ status: "rascunho" })),
    );
    expect(result.operationalState).toBe("aguardando-regra-homologada");
  });

  it("ciclo incompleto é estado operacional, nunca situação acadêmica", () => {
    const result = determineAcademicStanding({
      ...baseInput([fact("resultado", { kind: "componente-curricular", id: "c1" }, 30)], ruleSet()),
      cycleComplete: false,
    });
    expect(result.operationalState).toBe("ciclo-em-andamento");
    expect(result.standingId).toBeNull();
  });

  it("fato indisponível nunca vira zero: o critério fica não avaliável", () => {
    const result = determineAcademicStanding(
      baseInput([fact("resultado", { kind: "componente-curricular", id: "c1" }, null)], ruleSet()),
    );
    expect(result.operationalState).toBe("criterio-nao-avaliavel");
    expect(result.steps[0]?.result).toBeNull();
  });

  it("parâmetro sem valor cadastrado mantém o critério não avaliável", () => {
    const rule = ruleSet({ parameters: [{ id: "par-corte", label: "Referência de teste" }] });
    const result = determineAcademicStanding(
      baseInput([fact("resultado", { kind: "componente-curricular", id: "c1" }, 30)], rule),
    );
    expect(result.operationalState).toBe("criterio-nao-avaliavel");
  });

  it("pendência administrativa dos fatos bloqueia a determinação", () => {
    const result = determineAcademicStanding({
      ...baseInput([fact("resultado", { kind: "componente-curricular", id: "c1" }, 30)], ruleSet()),
      factPendencies: [
        { id: "ingresso-sem-historico", severity: "pendencia-administrativa", message: "Pendência de teste." },
      ],
    });
    expect(result.operationalState).toBe("pendencia-administrativa");
    expect(result.standingId).toBeNull();
  });

  it("determina a situação declarada quando o critério é satisfeito", () => {
    const result = determineAcademicStanding(
      baseInput([fact("resultado", { kind: "componente-curricular", id: "c1" }, 30)], ruleSet()),
    );
    expect(result.operationalState).toBe("situacao-determinada");
    expect(result.standingId).toBe("sit-x");
    expect(result.official).toBe(true);
  });
});

describe("12I — primitivas do motor", () => {
  it("agrega contagem com filtro escopo a escopo", () => {
    const facts = [
      fact("resultado", { kind: "componente-curricular", id: "c1" }, 4),
      fact("resultado", { kind: "componente-curricular", id: "c2" }, 30),
      fact("resultado", { kind: "componente-curricular", id: "c3" }, 2),
    ];
    const node: CriterionNode = {
      id: "nod-agg",
      kind: "comparacao",
      fact: { factId: "resultado", scope: { kind: "componente-curricular" } },
      aggregation: {
        operator: "contagem",
        where: {
          id: "nod-agg-filtro",
          kind: "comparacao",
          fact: { factId: "resultado", scope: { kind: "componente-curricular" } },
          operator: "menor",
          parameter: { kind: "literal", value: 10 },
        },
      },
      operator: "igual",
      parameter: { kind: "literal", value: 2 },
    };
    const evaluation = evaluateNode(node, { facts, ruleSet: ruleSet() });
    expect(evaluation.value).toBe(2);
    expect(evaluation.result).toBe(true);
  });

  it("composição lógica com fato indisponível resulta em não avaliável, não em falso", () => {
    const node: CriterionNode = {
      id: "nod-comp",
      kind: "composicao",
      logic: "e",
      children: [
        {
          id: "nod-a",
          kind: "comparacao",
          fact: { factId: "resultado", scope: { kind: "componente-curricular", id: "c1" } },
          operator: "maior",
          parameter: { kind: "literal", value: 1 },
        },
        {
          id: "nod-b",
          kind: "comparacao",
          fact: { factId: "presenca", scope: { kind: "ciclo" } },
          operator: "maior",
          parameter: { kind: "literal", value: 1 },
        },
      ],
    };
    const evaluation = evaluateNode(node, {
      facts: [fact("resultado", { kind: "componente-curricular", id: "c1" }, 30)],
      ruleSet: ruleSet(),
    });
    expect(evaluation.result).toBeNull();
  });

  it("referência ambígua não escolhe valor automaticamente", () => {
    const evaluation = evaluateNode(
      {
        id: "nod-amb",
        kind: "comparacao",
        fact: { factId: "resultado", scope: { kind: "componente-curricular" } },
        operator: "maior",
        parameter: { kind: "literal", value: 1 },
      },
      {
        facts: [
          fact("resultado", { kind: "componente-curricular", id: "c1" }, 30),
          fact("resultado", { kind: "componente-curricular", id: "c2" }, 40),
        ],
        ruleSet: ruleSet(),
      },
    );
    expect(evaluation.result).toBeNull();
    expect(evaluation.reason).toMatch(/declare o escopo/i);
  });
});

describe("12I — deliberação institucional", () => {
  const rule = ruleSet({
    steps: [
      {
        id: "stp-del",
        order: 1,
        label: "Encaminhamento ao órgão configurado",
        when: {
          id: "nod-del",
          kind: "comparacao",
          fact: { factId: "resultado", scope: { kind: "componente-curricular", id: "c1" } },
          operator: "existe",
          parameter: { kind: "sem-parametro" },
        },
        consequence: {
          kind: "encaminhar-para-deliberacao",
          bodyId: "org-teste",
          competenceId: "cmp-teste",
        },
        stopsOnMatch: true,
      },
    ],
  });
  const facts = [fact("resultado", { kind: "componente-curricular", id: "c1" }, 30)];

  it("sem deliberação registrada a situação fica aguardando", () => {
    const result = determineAcademicStanding(baseInput(facts, rule));
    expect(result.operationalState).toBe("aguardando-deliberacao");
    expect(result.requiresDeliberation?.competenceId).toBe("cmp-teste");
    expect(result.standingId).toBeNull();
  });

  it("deliberação registrada produz a situação declarada", () => {
    const deliberation: InstitutionalDeliberationRecord = {
      id: "dlb-1",
      scopeKey: standingScopeKey({ cycleId: cycle.id, studentId: "alu-1" }),
      cycleId: cycle.id,
      studentId: "alu-1",
      bodyId: "org-teste",
      bodyLabel: "Órgão de teste",
      competenceId: "cmp-teste",
      competenceLabel: "Competência de teste",
      actor: {
        actorId: "perfil-deliberativo",
        actorName: "Perfil deliberativo",
        profileLabel: "Capacidade deliberativa",
        at: "2026-02-02T12:00:00.000Z",
      },
      consideredFacts: [],
      decision: { standingId: "sit-y", note: "Decisão de teste." },
      rationale: "Fundamentação de teste.",
      at: "2026-02-02T12:00:00.000Z",
    };
    const result = determineAcademicStanding({ ...baseInput(facts, rule), deliberation });
    expect(result.operationalState).toBe("situacao-determinada");
    expect(result.standingId).toBe("sit-y");
  });

  it("competência restrita não produz situação fora do que a regra autoriza", () => {
    const restricted = ruleSet({
      ...rule,
      bodies: [
        {
          id: "org-teste",
          label: "Órgão de teste",
          competences: [
            { id: "cmp-teste", label: "Competência de teste", allowedStandingIds: ["sit-x"] },
          ],
        },
      ],
    });
    const deliberation: InstitutionalDeliberationRecord = {
      id: "dlb-2",
      scopeKey: standingScopeKey({ cycleId: cycle.id, studentId: "alu-1" }),
      cycleId: cycle.id,
      studentId: "alu-1",
      bodyId: "org-teste",
      bodyLabel: "Órgão de teste",
      competenceId: "cmp-teste",
      competenceLabel: "Competência de teste",
      actor: {
        actorId: "perfil-deliberativo",
        actorName: "Perfil deliberativo",
        profileLabel: "Capacidade deliberativa",
        at: "2026-02-02T12:00:00.000Z",
      },
      consideredFacts: [],
      decision: { standingId: "sit-y", note: "Decisão de teste." },
      rationale: "Fundamentação de teste.",
      at: "2026-02-02T12:00:00.000Z",
    };
    const result = determineAcademicStanding({
      ...baseInput(facts, restricted),
      deliberation,
    });
    expect(result.operationalState).toBe("pendencia-administrativa");
    expect(result.standingId).toBeNull();
  });
});

describe("12I — governança e versionamento", () => {
  it("as fixtures demonstrativas permanecem em rascunho e sem parâmetro cadastrado", () => {
    for (const demo of demonstrationStandingRuleSets) {
      expect(demo.status).toBe("rascunho");
      expect(ruleSetDeterminesStanding(demo)).toBe(false);
      expect(demo.parameters.every((parameter) => parameter.value === undefined)).toBe(true);
    }
  });

  it("regra sem valor de parâmetro não é homologável", () => {
    const store = createAcademicStandingStore();
    const actor = standingDemonstrationActor("perfil-normativo");
    const rule = ruleSet({ status: "em-revisao", parameters: [{ id: "par-corte", label: "Referência" }] });
    store.act({ action: "criar", actor, ruleSet: { ...rule, status: "rascunho" } });
    const homologated = store.act({ action: "homologar", actor, ruleSet: rule });
    expect(homologated.ok).toBe(false);
  });

  it("perfil sem capacidade não homologa", () => {
    const store = createAcademicStandingStore();
    const consulta = standingDemonstrationActor("perfil-consulta");
    const rule = ruleSet({ status: "em-revisao" });
    store.act({
      action: "criar",
      actor: standingDemonstrationActor("perfil-normativo"),
      ruleSet: { ...rule, status: "rascunho" },
    });
    const result = store.act({ action: "homologar", actor: consulta, ruleSet: rule });
    expect(result.ok).toBe(false);
  });

  it("determinação registrada é imutável e a alteração encadeia nova versão", () => {
    const store = createAcademicStandingStore();
    const actor = standingDemonstrationActor("perfil-normativo");
    const determination = determineAcademicStanding(
      baseInput([fact("resultado", { kind: "componente-curricular", id: "c1" }, 30)], ruleSet()),
    );
    const first = store.register({ actor, determination, now: "2026-03-01T12:00:00.000Z" });
    expect(first.ok).toBe(true);

    const again = store.register({ actor, determination, now: "2026-03-02T12:00:00.000Z" });
    expect(again.ok).toBe(false);

    const reprocessed = store.register({
      actor,
      determination,
      revision: { kind: "reprocessamento", justification: "Reprocessamento de teste." },
      now: "2026-03-03T12:00:00.000Z",
    });
    expect(reprocessed.ok).toBe(true);
    if (!reprocessed.ok || !first.ok) return;
    expect(reprocessed.value.version).toBe(2);
    expect(reprocessed.value.precedingRecordId).toBe(first.value.id);
    expect(store.chain(first.value.scopeKey)).toHaveLength(2);
    // A versão anterior permanece intacta.
    expect(store.chain(first.value.scopeKey)[0]?.id).toBe(first.value.id);
  });

  it("estado operacional não gera versão oficial", () => {
    const store = createAcademicStandingStore();
    const determination = determineAcademicStanding(
      baseInput([fact("resultado", { kind: "componente-curricular", id: "c1" }, 30)]),
    );
    const result = store.register({
      actor: standingDemonstrationActor("perfil-normativo"),
      determination,
    });
    expect(result.ok).toBe(false);
  });
});

describe("12I — explicabilidade e saída analítica", () => {
  it("a explicação preserva fato, valor, operador, parâmetro, regra e versão", () => {
    const determination = determineAcademicStanding(
      baseInput([fact("resultado", { kind: "componente-curricular", id: "c1" }, 30)], ruleSet()),
    );
    const explanation = explainDetermination(determination);
    expect(explanation.ruleSetId).toBe("rgs-teste");
    expect(explanation.ruleSetVersion).toBe(1);
    expect(explanation.appliedStepId).toBe("stp-1");
    expect(explanation.consultedFacts[0]).toMatchObject({
      factId: "resultado",
      value: 30,
      operator: "maior-ou-igual",
      result: true,
    });
  });

  it("a saída analítica é atômica, com proveniência por linha", () => {
    const determination = determineAcademicStanding(
      baseInput([fact("resultado", { kind: "componente-curricular", id: "c1" }, 30)], ruleSet()),
    );
    const rows = standingAnalyticRows({
      kind: "determinacao",
      determination,
      at: "2026-03-04T12:00:00.000Z",
    });
    expect(rows.some((row) => row.factKind === "fato-consultado")).toBe(true);
    expect(rows.some((row) => row.factKind === "criterio-avaliado")).toBe(true);
    expect(rows.some((row) => row.factKind === "situacao-academica-do-ciclo")).toBe(true);
    expect(rows.every((row) => row.provenance.sources.length > 0)).toBe(true);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });
});

describe("12I — extensibilidade sem alterar o motor", () => {
  it("nova situação e novo critério sobre um fato novo funcionam por cadastro", () => {
    const extended = ruleSet({
      standings: [
        ...ruleSet().standings,
        {
          id: "sit-nova",
          code: "NOVA",
          label: "Situação nova cadastrada em tempo de dado",
          description: "Cadastrada sem alterar o motor.",
          properties: { exemplo: "extensibilidade" },
          effects: [{ id: "efe-nova", label: "Efeito declarado novo" }],
        },
      ],
      steps: [
        {
          id: "stp-novo",
          order: 1,
          label: "Critério novo sobre um fato novo",
          when: {
            id: "nod-novo",
            kind: "comparacao",
            fact: { factId: "fato-inteiramente-novo", scope: { kind: "escopo-novo", id: "n1" } },
            operator: "pertence-ao-conjunto",
            parameter: { kind: "conjunto", values: ["valor-novo", "outro-valor"] },
          },
          consequence: { kind: "atribuir-situacao", standingId: "sit-nova" },
          stopsOnMatch: true,
        },
      ],
    });
    expect(standingRuleIssues(extended)).toEqual([]);
    const result = determineAcademicStanding(
      baseInput([fact("fato-inteiramente-novo", { kind: "escopo-novo", id: "n1" }, "valor-novo")], extended),
    );
    expect(result.operationalState).toBe("situacao-determinada");
    expect(result.standingId).toBe("sit-nova");
  });
});

describe("12I — auditoria anti-rigidez", () => {
  const sources = [
    "src/features/assessment/academic-standing-engine.ts",
    "src/features/assessment/academic-standing-types.ts",
  ].map((path) => ({ path, code: readFileSync(path, "utf8") }));

  const withoutComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("o motor não nomeia conceitos normativos da rede", () => {
    const forbidden = [
      /aprovad/i,
      /reprovad/i,
      /retid/i,
      /promo[çc]/i,
      /conselho/i,
      /abono/i,
      /supervis/i,
    ];
    for (const source of sources)
      for (const pattern of forbidden)
        expect(withoutComments(source.code)).not.toMatch(pattern);
  });

  it("o motor não carrega patamares numéricos nem percentuais", () => {
    for (const source of sources)
      expect(withoutComments(source.code)).not.toMatch(/\b(0\.[0-9]+|[1-9][0-9]+(\.[0-9]+)?)\b/);
  });

  it("o motor só conhece duas formas estruturais de critério", () => {
    const kinds = [
      ...new Set(
        [...sources[1]!.code.matchAll(/kind: "(comparacao|composicao)"/g)].map((m) => m[1]),
      ),
    ].sort();
    expect(kinds).toEqual(["comparacao", "composicao"]);
  });
});
