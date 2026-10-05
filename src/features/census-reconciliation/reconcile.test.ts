import { describe, expect, it } from "vitest";
import { classify, fingerprint, reconcile, stageGroup, summarize, type ComparisonInput } from "./reconcile";

const src = (sha = "a", knownAt: string | null = "2026-07-31") => ({ file: "f.xlsx", sha256: sha, knownAt, locator: "escola:1" });
const c = (o: Partial<ComparisonInput>): ComparisonInput => ({
  dimension: "turmas", scope: "33000001", metric: "quantidade", source: src(), sourceValue: 10, canonicalValue: 10, canonicalLineage: "x", ...o,
});

describe("reconciliação censitária", () => {
  it("igualdade exata", () => expect(classify(c({})).result).toBe("EXACT"));
  it("ausência ≠ zero: fonte ausente, canônico zero", () => expect(classify(c({ sourceValue: null, canonicalValue: 0 })).result).toBe("SOURCE_MISSING"));
  it("ausência ≠ zero: canônico ausente, fonte zero", () => expect(classify(c({ sourceValue: 0, canonicalValue: null })).result).toBe("CANONICAL_MISSING"));
  it("zero real é comparado como valor", () => expect(classify(c({ sourceValue: 0, canonicalValue: 0 })).result).toBe("EXACT"));
  it("diferença legítima só é explicada com delta esperado exato", () => {
    expect(classify(c({ canonicalValue: 7, explanation: { expectedDelta: -3, reason: "dupla contagem" } })).result).toBe("EXPLAINED_DIFFERENCE");
    expect(classify(c({ canonicalValue: 6, explanation: { expectedDelta: -3, reason: "dupla contagem" } })).result).toBe("SOURCE_DIVERGENCE");
  });
  it("não comparável prevalece (ex.: fechamento censitário × status)", () =>
    expect(classify(c({ sourceValue: "Fechada", canonicalValue: "true", notComparable: "fechamento censitário não é status" })).result).toBe("NOT_COMPARABLE"));
  it("fontes duplicadas (mesmo hash) contam uma vez", () => expect(reconcile([c({}), c({})])).toHaveLength(1));
  it("snapshots distintos são comparações distintas, sem fusão", () => {
    const r = reconcile([c({ source: src("a", "2026-07-31") }), c({ source: { ...src("b", "2026-08-31"), locator: "escola:1" }, sourceValue: 12 })]);
    expect(r.map((x) => x.result)).toEqual(["EXACT", "SOURCE_DIVERGENCE"]);
  });
  it("idempotente e independente da ordem", () => {
    const xs = [c({ scope: "2" }), c({ scope: "1", canonicalValue: null })];
    expect(fingerprint(reconcile(xs))).toBe(fingerprint(reconcile([...xs].reverse())));
    expect(summarize(reconcile(xs))['turmas']).toMatchObject({ EXACT: 1, CANONICAL_MISSING: 1 });
  });
  it("etapa vem do literal declarado; nome de turma nunca é lido", () => {
    expect(stageGroup("Ensino fundamental de 9 anos - 6º Ano")).toBe("af");
    expect(stageGroup("Educação infantil - unificada (0 a 5 anos)")).toBe("ei_unificada");
    expect(stageGroup(null)).toBeNull();
  });
});
