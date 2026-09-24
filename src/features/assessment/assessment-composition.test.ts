/**
 * Etapa 12E — testes do motor configurável de composição.
 * Nenhum teste pressupõe escala, peso, nota de corte ou quantidade de períodos:
 * tudo vem de modelos declarados no próprio teste.
 */
import { describe, expect, it } from "vitest";
import {
  acceptEntry,
  aggregate,
  compositionBlocks,
  composePeriod,
  consolidateAnnual,
  roundScore,
} from "./assessment-composition";
import type {
  CompositionEntryInput,
  CompositionModel,
  RoundingPolicy,
} from "./assessment-composition-types";
import { compositionModels } from "./assessment-composition-fixtures";
import { assessmentConfigurations } from "./assessment-fixtures";
import type { AssessmentConfiguration } from "./assessment-types";

const roundingAtClosing: RoundingPolicy = {
  id: "arr-teste",
  mode: "meio-acima",
  decimals: 0,
  applyAt: ["periodo", "anual"],
  normativeStatus: "homologado",
};

const homologatedConfiguration: AssessmentConfiguration = {
  id: "cfg-teste",
  label: "Configuração de teste homologada",
  academicYearId: "ano-teste",
  scope: {},
  strategy: "quantitativa",
  periodStructureId: "est-teste",
  scales: [{ kind: "numerica", min: 0, max: 100, step: 1, normativeStatus: "homologado" }],
  allowedInstrumentTypeIds: ["tp-a", "tp-b"],
  usesPedagogicalRecords: false,
  allowsGrades: true,
  allowsPromotionDecision: true,
  consolidationRules: [],
  pendingRuleIds: [],
  normativeStatus: "homologado",
  version: 3,
};

const model = (over: Partial<CompositionModel> = {}): CompositionModel => ({
  id: "mc-teste",
  label: "Modelo de teste",
  configurationId: homologatedConfiguration.id,
  configurationVersion: homologatedConfiguration.version,
  scaleSemantics: "quantitativa",
  categories: [
    {
      id: "cat-a",
      label: "Categoria A",
      instrumentTypeIds: ["tp-a"],
      weight: 3,
      minimumEntries: 2,
      aggregation: { kind: "media-simples" },
    },
    {
      id: "cat-b",
      label: "Categoria B",
      instrumentTypeIds: ["tp-b"],
      weight: 1,
      minimumEntries: 1,
      aggregation: { kind: "media-simples" },
    },
  ],
  periodAggregation: { kind: "media-ponderada" },
  annualAggregation: { kind: "media-simples" },
  requiresAllPeriods: true,
  rounding: roundingAtClosing,
  administrativeEntries: { accepted: false, acceptedOrigins: [], normativeStatus: "homologado" },
  normativeStatus: "homologado",
  version: 1,
  ...over,
});

const entry = (
  over: Partial<CompositionEntryInput> & { entryId: string },
): CompositionEntryInput => ({
  instrumentId: `ins-${over.entryId}`,
  instrumentTypeId: "tp-a",
  periodId: "p1",
  configurationId: homologatedConfiguration.id,
  configurationVersion: homologatedConfiguration.version,
  value: { kind: "numerica", value: 10 },
  status: "registrado",
  at: "2099-01-01T00:00:00.000Z",
  ...over,
});

const full = (periodId: string): CompositionEntryInput[] => [
  entry({ entryId: `${periodId}-1`, periodId, value: { kind: "numerica", value: 7 } }),
  entry({ entryId: `${periodId}-2`, periodId, value: { kind: "numerica", value: 8 } }),
  entry({
    entryId: `${periodId}-3`,
    periodId,
    instrumentTypeId: "tp-b",
    value: { kind: "numerica", value: 6 },
  }),
];

describe("arredondamento centralizado e momento de aplicação", () => {
  it("não arredonda em pontos que a configuração não declara", () => {
    const stage = roundScore(7.4567, roundingAtClosing, "categoria");
    expect(stage.rounded).toBe(false);
    expect(stage.value).toBe(7.4567);
  });

  it("arredonda apenas no ponto de fechamento declarado", () => {
    const stage = roundScore(7.5, roundingAtClosing, "periodo");
    expect(stage).toMatchObject({ rounded: true, raw: 7.5, value: 8 });
  });

  it("preserva a precisão interna das categorias e subtotais", () => {
    const outcome = composePeriod({
      model: model(),
      period: { id: "p1" },
      entries: full("p1"),
      official: true,
    });
    const categoryA = outcome.categories.find((c) => c.categoryId === "cat-a")!;
    expect(categoryA.stage).toMatchObject({ rounded: false, value: 7.5 });
    // (7,5×3 + 6×1) / 4 = 7,125 → arredondado só no fechamento do período.
    expect(outcome.stage).toMatchObject({ raw: 7.125, value: 7, rounded: true });
  });

  it("modo sem arredondamento nunca altera valores", () => {
    const policy: RoundingPolicy = {
      id: "arr-nenhum",
      mode: "sem-arredondamento",
      applyAt: ["periodo", "anual"],
      normativeStatus: "homologado",
    };
    expect(roundScore(7.125, policy, "anual")).toMatchObject({ value: 7.125, rounded: false });
  });

  it("suporta modos configuráveis distintos", () => {
    const base = { id: "a", applyAt: ["anual" as const], normativeStatus: "homologado" as const };
    expect(roundScore(2.5, { ...base, mode: "meio-par", decimals: 0 }, "anual").value).toBe(2);
    expect(roundScore(3.5, { ...base, mode: "meio-par", decimals: 0 }, "anual").value).toBe(4);
    expect(roundScore(7.89, { ...base, mode: "truncar", decimals: 1 }, "anual").value).toBe(7.8);
    expect(roundScore(7.3, { ...base, mode: "passo", step: 0.5 }, "anual").value).toBe(7.5);
  });
});

describe("acumulado parcial x resultado anual original", () => {
  const periods = [{ id: "p1" }, { id: "p2" }];

  it("dados incompletos produzem acumulado parcial, nunca resultado anual", () => {
    const outcome = consolidateAnnual({
      configuration: homologatedConfiguration,
      model: model(),
      periods,
      entries: full("p1"),
      official: true,
    });
    expect(outcome.kind).toBe("acumulado-parcial");
    expect(outcome.final).toBe(false);
    expect(outcome.official).toBe(false);
    if (outcome.kind !== "acumulado-parcial") throw new Error("esperado parcial");
    expect(outcome.label).toBe("Acumulado parcial — não é resultado anual");
    expect(outcome.missing.some((m) => m.kind === "periodo-incompleto")).toBe(true);
    // O parcial nunca é fechado por arredondamento.
    expect(outcome.stage?.rounded).toBe(false);
  });

  it("período com quantidade mínima não atendida fica parcial", () => {
    const outcome = composePeriod({
      model: model(),
      period: { id: "p1" },
      entries: [full("p1")[0]!, full("p1")[2]!],
      official: true,
    });
    expect(outcome.kind).toBe("acumulado-parcial");
    expect(outcome.complete).toBe(false);
    expect(outcome.official).toBe(false);
    expect(outcome.missing).toContainEqual({
      kind: "quantidade-minima",
      categoryId: "cat-a",
      required: 2,
      present: 1,
    });
  });

  it("produz resultado anual original quando os dados exigidos estão completos", () => {
    const outcome = consolidateAnnual({
      configuration: homologatedConfiguration,
      model: model(),
      periods,
      entries: [...full("p1"), ...full("p2")],
      official: true,
    });
    expect(outcome.kind).toBe("resultado-anual-original");
    if (outcome.kind !== "resultado-anual-original") throw new Error("esperado resultado");
    expect(outcome.final).toBe(true);
    expect(outcome.official).toBe(true);
    expect(outcome.stage).toMatchObject({ point: "anual", value: 7, rounded: true });
    expect(outcome.periods.every((p) => p.kind === "fechamento-do-periodo")).toBe(true);
  });
});

describe("lançamentos administrativos de transferência", () => {
  const administrative = entry({
    entryId: "adm-1",
    origin: "transferencia-externa",
    metadata: { redeOrigem: "Rede fictícia de origem", documento: "Documento fictício" },
    value: { kind: "numerica", value: 9 },
  });

  it("não participam quando a configuração não os admite", () => {
    const result = acceptEntry(model(), administrative);
    expect(result.accepted).toBe(false);
    if (result.accepted) throw new Error("não deveria aceitar");
    expect(result.missing).toEqual({
      kind: "origem-nao-admitida",
      entryId: "adm-1",
      origin: "transferencia-externa",
    });
  });

  it("participam como qualquer valor válido quando admitidos, sem conversão", () => {
    const admitido = model({
      administrativeEntries: {
        accepted: true,
        acceptedOrigins: ["transferencia-externa"],
        normativeStatus: "homologado",
      },
    });
    const period = composePeriod({
      model: admitido,
      period: { id: "p1" },
      entries: [
        administrative,
        entry({ entryId: "e2", value: { kind: "numerica", value: 7 } }),
        full("p1")[2]!,
      ],
      official: true,
    });
    const categoryA = period.categories.find((c) => c.categoryId === "cat-a")!;
    expect(categoryA.usedEntryIds).toContain("adm-1");
    expect(categoryA.origins).toContain("transferencia-externa");
    // Média simples de 9 e 7 = 8: o valor entra como está, sem equivalência.
    expect(categoryA.stage?.value).toBe(8);
    expect(administrative.metadata).toEqual({
      redeOrigem: "Rede fictícia de origem",
      documento: "Documento fictício",
    });
  });
});

describe("dados ausentes e semânticas não numéricas", () => {
  it('"não registrado" nunca se converte em zero', () => {
    const naoRegistrado = entry({
      entryId: "nr-1",
      value: { kind: "nao-registrado", reason: "Motivo fictício" },
    });
    const period = composePeriod({
      model: model(),
      period: { id: "p1" },
      entries: [
        naoRegistrado,
        entry({ entryId: "e1", value: { kind: "numerica", value: 8 } }),
        full("p1")[2]!,
      ],
      official: true,
    });
    const categoryA = period.categories.find((c) => c.categoryId === "cat-a")!;
    expect(categoryA.usedEntryIds).toEqual(["e1"]);
    expect(categoryA.stage?.value).toBe(8);
    expect(period.missing).toContainEqual({
      kind: "nao-registrado-sem-regra",
      entryId: "nr-1",
      reason: "Motivo fictício",
    });
  });

  it("lançamento em rascunho não compõe e é declarado ausente", () => {
    const rascunho = entry({ entryId: "rs-1", status: "rascunho" });
    const result = acceptEntry(model(), rascunho);
    expect(result.accepted).toBe(false);
    if (result.accepted) throw new Error("não deveria aceitar");
    expect(result.missing.kind).toBe("lancamento-em-aberto");
    expect(JSON.stringify(result.missing)).not.toMatch(/atras|prazo|vencid/i);
  });

  it("escala conceitual não é convertida em número", () => {
    const outcome = consolidateAnnual({
      configuration: homologatedConfiguration,
      model: model({ scaleSemantics: "conceitual" }),
      periods: [{ id: "p1" }],
      entries: [],
    });
    expect(outcome.kind).toBe("nao-aplicavel");
  });

  it("configuração de acompanhamento devolve inaplicabilidade", () => {
    const ei = assessmentConfigurations.find((c) => c.usesPedagogicalRecords)!;
    const outcome = consolidateAnnual({
      configuration: ei,
      model: model(),
      periods: [{ id: "p1" }],
      entries: [],
    });
    expect(outcome.kind).toBe("nao-aplicavel");
    expect(outcome.official).toBe(false);
  });
});

describe("bloqueios informativos", () => {
  it("modelo não homologado bloqueia qualquer cálculo", () => {
    const outcome = consolidateAnnual({
      configuration: homologatedConfiguration,
      model: model({ normativeStatus: "demonstrativo" }),
      periods: [{ id: "p1" }],
      entries: full("p1"),
    });
    expect(outcome.kind).toBe("bloqueado");
    if (outcome.kind !== "bloqueado") throw new Error("esperado bloqueio");
    expect(outcome.reasons.join(" ")).toMatch(/não homologada/i);
    expect(outcome.pendingRuleIds).toContain("pn-consolidacao");
  });

  it("ausência de modelo bloqueia", () => {
    const outcome = consolidateAnnual({
      configuration: homologatedConfiguration,
      model: undefined,
      periods: [{ id: "p1" }],
      entries: [],
    });
    expect(outcome.kind).toBe("bloqueado");
  });

  it("configurações conflitantes exigem definição administrativa", () => {
    const block = compositionBlocks({
      configuration: homologatedConfiguration,
      model: model(),
      entries: [
        entry({ entryId: "a" }),
        entry({ entryId: "b", configurationId: "cfg-outra", configurationVersion: 1 }),
      ],
    });
    expect(block?.reasons.join(" ")).toMatch(/definição administrativa\/pedagógica/i);
  });

  it("arredondamento não homologado bloqueia quando há ponto de aplicação", () => {
    const block = compositionBlocks({
      configuration: homologatedConfiguration,
      model: model({ rounding: { ...roundingAtClosing, normativeStatus: "pendente" } }),
      entries: [],
    });
    expect(block?.pendingRuleIds).toContain("pn-arredondamento");
  });

  it("fixtures demonstrativas nunca calculam", () => {
    const quantitativa = assessmentConfigurations.find(
      (c) => c.id === "cfg-2026-quantitativa-demo",
    )!;
    const outcome = consolidateAnnual({
      configuration: quantitativa,
      model: compositionModels.find((m) => m.configurationId === quantitativa.id),
      periods: [{ id: "pa-demo" }],
      entries: [],
    });
    expect(outcome.kind).toBe("bloqueado");
    expect(outcome.final).toBe(false);
  });
});

describe("agregações configuráveis", () => {
  const values = [
    { value: 4, weight: 1, at: "1" },
    { value: 8, weight: 3, at: "2" },
  ];
  it("aplica a regra declarada, sem padrão implícito", () => {
    expect(aggregate({ kind: "media-simples" }, values)).toBe(6);
    expect(aggregate({ kind: "media-ponderada" }, values)).toBe(7);
    expect(aggregate({ kind: "soma" }, values)).toBe(12);
    expect(aggregate({ kind: "maior-valor" }, values)).toBe(8);
    expect(aggregate({ kind: "ultimo-valor" }, values)).toBe(8);
    expect(aggregate({ kind: "media-simples" }, [])).toBeNull();
  });
});
