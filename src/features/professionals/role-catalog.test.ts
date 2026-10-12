import { describe, expect, it } from "vitest";
import { capabilitiesGrantedBy, catalogAt, checkDesignation, duplicateCodes, validateCatalogChain, type CatalogVersion } from "./role-catalog";

const c = (o: Partial<CatalogVersion>): CatalogVersion => ({
  id: "c1", logicalId: "PROF", kind: "cargo", version: 1, supersedesId: null, code: "PROF-EB", label: "Professor",
  legalBasis: "Lei municipal X", validFrom: "2020-01-01", validUntil: null, requirements: ["Licenciatura"],
  competencies: ["Ministrar aulas"], changeReason: null, authorUserId: "u1", technical: false, homologated: true,
  recordedAt: "2020-01-02", ...o,
});
const f = (o: Partial<CatalogVersion>) => c({ id: "f1", logicalId: "COORD", kind: "funcao", code: "COORD", label: "Coordenação", ...o });

describe("catálogo de cargos e funções", () => {
  it("cargo e função ficam separados por tipo", () => {
    const all = [c({}), f({})];
    expect(catalogAt(all, "cargo", "2026-01-01", "2026-12-31").entries.map((e) => e.code)).toEqual(["PROF-EB"]);
    expect(catalogAt(all, "funcao", "2026-01-01", "2026-12-31").entries.map((e) => e.code)).toEqual(["COORD"]);
  });
  it("não homologado, fora da vigência ou registrado depois de knownAt não aparece", () => {
    expect(catalogAt([c({ homologated: false })], "cargo", "2026-01-01", "2026-12-31").entries).toEqual([]);
    expect(catalogAt([c({ validUntil: "2025-12-31" })], "cargo", "2026-01-01", "2026-12-31").entries).toEqual([]);
    expect(catalogAt([c({})], "cargo", "2026-01-01", "2019-01-01").entries).toEqual([]);
  });
  it("nova versão exige motivo, mantém tipo/código e autor humano", () => {
    const p = validateCatalogChain([c({}), c({ id: "c2", version: 2, supersedesId: "c1", kind: "funcao", code: "X", technical: true })]);
    expect(p).toEqual(expect.arrayContaining(["missing-reason", "kind-changed", "code-changed", "technical-author"]));
  });
  it("homologado exige fundamento; cadeia inválida é ambígua", () => {
    expect(validateCatalogChain([c({ legalBasis: null })])).toContain("missing-legal-basis");
    expect(catalogAt([c({ id: "c3", version: 3, supersedesId: "zz" })], "cargo", "2026-01-01", "2026-12-31").ambiguous).toEqual(["PROF"]);
  });
  it("competência não pode ser capability", () => {
    expect(validateCatalogChain([c({ competencies: ["registrar-frequencia"] })], new Set(["registrar-frequencia"]))).toContain("capability-in-competencies");
  });
  it("código repetido entre entradas é conflito", () => {
    expect(duplicateCodes([c({}), c({ id: "x", logicalId: "OUTRO" })])).toEqual(["cargo:PROF-EB"]);
  });
});

describe("designação de função", () => {
  const d = { personId: "P1", functionLogicalId: "COORD", schoolId: "E1", validFrom: "2026-02-01", validUntil: "2026-12-31", actRef: "port-1", authorUserId: "u1", technical: false };
  it("válida só para função vigente, com autor humano", () => {
    expect(checkDesignation(d, [f({})], "2026-12-31")).toBeNull();
    expect(checkDesignation({ ...d, functionLogicalId: "PROF" }, [c({})], "2026-12-31")).toBe("nao-e-funcao");
    expect(checkDesignation(d, [f({ validUntil: "2026-06-30" })], "2026-12-31")).toBe("fora-da-vigencia");
    expect(checkDesignation({ ...d, technical: true }, [f({})], "2026-12-31")).toBe("executor-tecnico");
    expect(checkDesignation({ ...d, authorUserId: null }, [f({})], "2026-12-31")).toBe("sem-autor");
    expect(checkDesignation(d, [], "2026-12-31")).toBe("funcao-inexistente");
  });
  it("designação nunca concede permissão digital", () => {
    expect(capabilitiesGrantedBy(d)).toEqual([]);
  });
});
