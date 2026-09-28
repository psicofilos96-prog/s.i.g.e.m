/** 6D.3.3.3b — testes cirúrgicos do contrato de explicabilidade. */
import { describe, expect, it } from "vitest";
import { composePeriod } from "./assessment-composition";
import type {
  CompositionEntryInput,
  CompositionModel,
} from "./assessment-composition-types";
import type { AssessmentEntryVersion } from "./assessment-entry-versions";
import type { AssessmentInstrument } from "./assessment-types";
import {
  projectCompositionExplanation,
  type CompositionExplanationInput,
} from "./composition-explanation-projection";

const model = (roundingApplyAt: ("periodo" | "categoria")[] = ["periodo"]): CompositionModel => ({
  id: "mc-exp",
  label: "Modelo",
  configurationId: "cfg-e",
  scaleSemantics: "quantitativa",
  categories: [
    { id: "cat-p", label: "Provas", instrumentTypeIds: ["tp-a"], weight: 1, aggregation: { kind: "media-ponderada" } },
    { id: "cat-t", label: "Trabalhos", instrumentTypeIds: ["tp-b"], weight: 1, maxScore: 50, aggregation: { kind: "soma" } },
  ],
  periodAggregation: { kind: "media-simples" },
  requiresAllPeriods: true,
  rounding: { id: "arr-e", mode: "meio-acima", decimals: 0, applyAt: roundingApplyAt, normativeStatus: "homologado" },
  administrativeEntries: { accepted: false, acceptedOrigins: [], normativeStatus: "pendente" },
  normativeStatus: "homologado",
  version: 4,
});

const instrument = (id: string, typeId: string, title: string) =>
  ({ id, instrumentTypeId: typeId, title, appliedOn: "2026-03-10", periodId: "p1" }) as AssessmentInstrument;

const version = (
  id: string,
  instrumentId: string,
  v: number,
  supersedes?: string,
): AssessmentEntryVersion =>
  ({
    id,
    logicalEntryId: `${instrumentId}:s1`,
    version: v,
    ...(supersedes ? { supersedesVersionId: supersedes } : {}),
    instrumentId,
    studentId: "s1",
    status: "registrado",
  }) as AssessmentEntryVersion;

const instruments = [
  instrument("i-a1", "tp-a", "Prova 1"),
  instrument("i-a2", "tp-a", "Prova 2"),
  instrument("i-a3", "tp-a", "Prova 3"),
  instrument("i-b1", "tp-b", "Trabalho 1"),
  instrument("i-b2", "tp-b", "Trabalho 2"),
  instrument("i-x", "tp-fora", "Atividade avulsa"),
  instrument("i-na", "tp-a", "Prova adaptada"),
];
const versions = [
  version("va1", "i-a1", 1),
  version("va2-v1", "i-a2", 1),
  version("va2-v2", "i-a2", 2, "va2-v1"),
  version("va3", "i-a3", 1),
  version("vb1", "i-b1", 1),
  version("vb2", "i-b2", 1),
  version("vx", "i-x", 1),
];

const entry = (id: string, typeId: string, value: number | null, weight?: number): CompositionEntryInput => ({
  entryId: id,
  instrumentId: "",
  instrumentTypeId: typeId,
  periodId: "p1",
  configurationId: "cfg-e",
  value: value === null ? { kind: "nao-registrado", reason: "Estudante ausente" } : { kind: "numerica", value },
  status: "registrado",
  ...(weight === undefined ? {} : { weight }),
});

const entries = [
  entry("va1", "tp-a", 80, 2),
  entry("va2-v2", "tp-a", 90),
  entry("va3", "tp-a", null),
  entry("vb1", "tp-b", 30),
  entry("vb2", "tp-b", 35),
  entry("vx", "tp-fora", 70),
];

const build = (overrides: Partial<CompositionExplanationInput> = {}, m = model(), es = entries) =>
  projectCompositionExplanation({
    source: { kind: "composed", composition: composePeriod({ model: m, period: { id: "p1" }, entries: es, official: false }) },
    model: m,
    configuration: { id: "cfg-e", version: 1 },
    instruments,
    versions,
    notApplicableInstrumentIds: ["i-na"],
    valuesDisclosed: true,
    ...overrides,
  });

const available = (p: ReturnType<typeof build>) => {
  if (p.state !== "available") throw new Error(`esperado available, veio ${p.state}`);
  return p;
};

describe("projeção de explicabilidade da composição", () => {
  it("A: composição simples disponível com resultado do período e proveniência", () => {
    const p = available(build({}, model(), [entry("va1", "tp-a", 80), entry("vb1", "tp-b", 30)]));
    expect(p.period?.value).toBe(55);
    expect(p.categories[0]!.usedEntries[0]).toMatchObject({ resolved: true, instrumentTitle: "Prova 1", effectiveValue: 80 });
    expect(p.provenance).toEqual({ modelId: "mc-exp", modelVersion: 4, configurationId: "cfg-e", configurationVersion: 1 });
  });

  it("B/C: pesos diferentes e peso implícito 1 vêm do recibo", () => {
    const used = available(build()).categories[0]!.usedEntries;
    expect(used.map((u) => [u.effectiveValue, u.effectiveWeight])).toEqual([[80, 2], [90, 1]]);
  });

  it("D: resultado corrigido usa a versão consumida e indica correção", () => {
    const u = available(build()).categories[0]!.usedEntries[1]!;
    expect(u).toMatchObject({ resolved: true, corrected: true, provenance: { entryVersionId: "va2-v2", version: 2 } });
    expect(JSON.stringify(u)).not.toContain("va2-v1");
  });

  it("E/F/G: missing, unmatched e não se aplica permanecem naturezas distintas", () => {
    const p = available(build());
    const notUsed = p.categories[0]!.notUsed;
    expect(notUsed).toHaveLength(1);
    expect(notUsed[0]).toMatchObject({ nature: "selected-not-used", reasonKind: "nao-registrado-sem-regra", canonicalReason: "Estudante ausente", entry: { instrumentTitle: "Prova 3" } });
    expect(p.unmatched).toEqual([expect.objectContaining({ instrumentTitle: "Atividade avulsa" })]);
    expect(p.notApplicable).toEqual([{ instrumentTitle: "Prova adaptada", provenance: { instrumentId: "i-na" } }]);
    const titles = (xs: readonly { resolved?: boolean; instrumentTitle?: string }[]) => xs.map((x) => x.instrumentTitle);
    expect(titles(p.unmatched)).not.toContain("Prova 3");
    expect(titles(p.unmatched)).not.toContain("Prova adaptada");
  });

  it("H: teto configurado mas não aplicado é traduzido do recibo", () => {
    const p = available(build({}, model(), [entry("va1", "tp-a", 80), entry("vb1", "tp-b", 20)]));
    expect(p.categories[1]!.cap).toEqual({ maxScore: 50, applied: false, valueBeforeCap: 20, valueAfterCap: 20 });
    expect(p.categories[0]!.cap).toBeUndefined();
  });

  it("I: teto aplicado preserva antes, limite e depois", () => {
    expect(available(build()).categories[1]!.cap).toEqual({ maxScore: 50, applied: true, valueBeforeCap: 65, valueAfterCap: 50 });
  });

  it("J: política consultada sem alterar o valor", () => {
    const c = available(build()).categories[0]!.stage!;
    expect(c).toMatchObject({ roundingPolicyConsulted: true, roundingApplied: false, roundingPolicy: { known: true, mode: "meio-acima" } });
  });

  it("K: arredondamento que altera o valor", () => {
    // Sem a entrada rejeitada o período fecha e o motor arredonda nesse ponto.
    const s = available(build({}, model(), entries.filter((e) => e.entryId !== "va3"))).period!;
    expect(s).toMatchObject({ point: "periodo", valueBeforeRounding: 66.6666666667, value: 67, roundingApplied: true, roundingPolicy: { known: true, decimals: 0, provenance: { roundingPolicyId: "arr-e" } } });
  });

  it("L: composição bloqueada → unavailable com razões canônicas", () => {
    const p = projectCompositionExplanation({
      source: { kind: "blocked", reasons: ["Regra de consolidação não homologada pela rede."], pendingRuleIds: ["pn-consolidacao"] },
      model: model(),
      configuration: { id: "cfg-e", version: 1 },
      instruments,
      versions,
      notApplicableInstrumentIds: [],
      valuesDisclosed: true,
    });
    expect(p).toEqual({ state: "unavailable", reasons: ["Regra de consolidação não homologada pela rede."], pendingRuleIds: ["pn-consolidacao"] });
  });

  it("M: valuesDisclosed=false → protected sem nenhum valor, peso, estágio ou referência", () => {
    const p = build({ valuesDisclosed: false });
    expect(p).toEqual({ state: "protected", explanation: "values-not-disclosed" });
    const json = JSON.stringify(p);
    for (const token of ["80", "90", "30", "35", "70", "65", "50", "67", "66.6", "83.3", "weight", "Prova", "Trabalho", "va1", "arr-e", "cap", "stage"])
      expect(json).not.toContain(token);
  });

  it("M': negar uma única entrada (autorização futura) protege toda a explicação", () => {
    expect(build({ isEntryDisclosed: (id) => id !== "vb2" }).state).toBe("protected");
    expect(build({ isEntryDisclosed: (id) => id !== "vx" }).state).toBe("protected");
  });

  it("entrada sem versão conhecida fica como não sabida, sem reconstrução", () => {
    const p = available(build({ versions: [] }));
    expect(p.categories[0]!.usedEntries[0]).toEqual({ resolved: false, provenance: { entryVersionId: "va1" }, effectiveValue: 80, effectiveWeight: 2 });
  });
});
