import { describe, expect, it } from "vitest";
import { FRONT_STATE_FIXTURE as FRONT_STATE, NETWORK_INDICATORS, present, resolveAvailability, validateCatalog } from "./network-indicator-catalog";

const byKey = (k: string) => NETWORK_INDICATORS.find((i) => i.key === k)!;

describe("catálogo AD", () => {
  it("catálogo publicado é válido", () => expect(validateCatalog(NETWORK_INDICATORS)).toEqual([]));
  it("recusa fórmula livre, avaliador fora da lista e duplicata", () => {
    const base = byKey("escolas-ativas");
    const issues = validateCatalog([base, base, { ...base, key: "x", formula: "SELECT 1" }, { ...base, key: "y", evaluator: "eval" as never }]);
    expect(issues.join("|")).toMatch(/duplicado/); expect(issues.join("|")).toMatch(/fórmula livre/); expect(issues.join("|")).toMatch(/avaliador/);
  });
  it("indicador sem frente pronta é unavailable com motivo", () => {
    const a = resolveAvailability(byKey("cobertura-docente"), FRONT_STATE);
    expect(a.status).toBe("unavailable"); expect(a.reasons.length).toBe(2);
    expect(resolveAvailability(byKey("matriculas-vigentes"), FRONT_STATE).status).toBe("available");
  });
  it("frente desconhecida falha fechada", () => {
    expect(resolveAvailability({ ...byKey("escolas-ativas"), dependsOn: ["inexistente"] }, FRONT_STATE).status).toBe("unavailable");
  });
  it("rascunho não é disponível", () => expect(resolveAvailability({ ...byKey("escolas-ativas"), status: "rascunho" }).status).toBe("unavailable"));
});

describe("apresentação", () => {
  it("zero ≠ desconhecido", () => {
    expect(present(byKey("matriculas-vigentes"), 0).kind).toBe("zero");
    expect(present(byKey("matriculas-vigentes"), null).kind).toBe("desconhecido");
  });
  it("dinâmico nunca é oficial", () => {
    const p = present(byKey("aulas-registradas"), 3); expect(p.kind === "valor" && p.label).toBe("Dinâmico (operacional)");
    const o = present(byKey("mapa-oficial"), 3); expect(o.kind === "valor" && o.label).toBe("Oficial");
  });
  it("grupo pequeno suprimido só com limiar declarado", () => {
    expect(present(byKey("matriculas-vigentes"), 2, { groupSize: 2, minGroup: 5 }).kind).toBe("suprimido");
    expect(present(byKey("matriculas-vigentes"), 2, { groupSize: 2 }).kind).toBe("valor");
  });
});

import { resolveDependencies } from "./network-indicator-runtime";
describe("AD.1 disponibilidade em runtime", () => {
  it("muda conforme a fonte: legível, vazia, negada", async () => {
    const st = await resolveDependencies(async (t) => t === "school_enrollments" ? { count: 0, error: null } : t === "statistical_map_versions" ? { count: 0, error: null } : { count: null, error: "denied" }, ["matricula", "mapa", "diario", "x"]);
    expect(st.matricula).toMatchObject({ ready: true, count: 0 });
    expect(st.mapa).toMatchObject({ ready: false, count: 0 });
    expect(st.diario).toMatchObject({ ready: false, count: null });
    expect(st.x?.ready).toBe(false);
    expect(resolveAvailability(byKey("matriculas-vigentes"), st).status).toBe("available");
    expect(resolveAvailability(byKey("mapa-oficial"), st).status).toBe("unavailable");
  });
});
