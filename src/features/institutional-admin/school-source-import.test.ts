import { describe, expect, it } from "vitest";
import { buildSchoolProposal, CENSO_2026_SOURCE, importSelectedSchools, normalizeName, type SchoolSource } from "./school-source-import";

describe("proposta de unidades do Censo 2026", () => {
  it("fonte real: 55 INEPs únicos, sem dados pessoais", () => {
    const rows = buildSchoolProposal(CENSO_2026_SOURCE, new Set());
    expect(rows).toHaveLength(55);
    expect(rows.every((r) => r.status === "novo")).toBe(true);
    const keys = new Set(CENSO_2026_SOURCE.escolas.flatMap((e) => Object.keys(e)));
    expect([...keys].sort()).toEqual(["aba", "dependenciaNaFonte", "inep", "linha", "municipio", "nome", "uf"]);
  });
  it("normaliza nome, deduplica INEP, rejeita inválido e marca cadastrado", () => {
    expect(normalizeName("CENTRO  EDUCACIONAL CEIFA ")).toBe("CENTRO EDUCACIONAL CEIFA");
    const src: SchoolSource = { ...CENSO_2026_SOURCE, escolas: [
      { inep: "33000001", nome: "A", municipio: "x", uf: "RJ", dependenciaNaFonte: "Municipal", aba: "Urbanas", linha: 1 },
      { inep: "33000001", nome: "A2", municipio: "x", uf: "RJ", dependenciaNaFonte: "Municipal", aba: "Rurais", linha: 2 },
      { inep: "123", nome: "B", municipio: "x", uf: "RJ", dependenciaNaFonte: "Municipal", aba: "Urbanas", linha: 3 },
      { inep: "33000002", nome: "C", municipio: "x", uf: "RJ", dependenciaNaFonte: "Privada", aba: "Conveniadas", linha: 4 },
    ] };
    const rows = buildSchoolProposal(src, new Set(["33000002"]));
    expect(rows.map((r) => r.status)).toEqual(["novo", "duplicado-na-fonte", "inep-invalido", "ja-cadastrado"]);
    expect(rows[3]!.proposedLocation).toBeNull();
  });
  it("exige só a vigência; referência documental é opcional", async () => {
    let calls = 0;
    await expect(importSelectedSchools([], { act: "x", validFrom: "", useSheetLocation: false }, async () => { calls++; return { data: null, error: null }; })).rejects.toThrow();
    expect(calls).toBe(0);
    const rows = buildSchoolProposal(CENSO_2026_SOURCE, new Set()).slice(0, 1);
    const args: Record<string, unknown>[] = [];
    const out = await importSelectedSchools(rows, { act: "  ", validFrom: "2027-01-01", useSheetLocation: false }, async (_f, a) => { args.push(a); return { data: "v", error: null }; });
    expect(out[0]!.ok).toBe(true);
    expect(String(args[0]!["_act_ref"])).toMatch(/^fonte .*sha256:/);
  });
  it("fluxo parcial: falha não interrompe; localização só por opção; ato carrega proveniência", async () => {
    const rows = buildSchoolProposal(CENSO_2026_SOURCE, new Set()).slice(0, 3);
    const args: Record<string, unknown>[] = [];
    const out = await importSelectedSchools(rows, { act: "Portaria 1/2027", validFrom: "2027-02-01", useSheetLocation: false }, async (_f, a) => {
      args.push(a); return args.length === 2 ? { data: null, error: { message: "capability: negada" } } : { data: "v", error: null };
    });
    expect(out.map((o) => o.ok)).toEqual([true, false, true]);
    expect(args.every((a) => a["_location_kind"] === null && a["_active"] === true && a["_valid_from"] === "2027-02-01")).toBe(true);
    expect(String(args[0]!["_act_ref"])).toContain(CENSO_2026_SOURCE.sha256);
    const withLoc: Record<string, unknown>[] = [];
    await importSelectedSchools(rows.slice(0, 1), { act: "x", validFrom: "2027-02-01", useSheetLocation: true }, async (_f, a) => { withLoc.push(a); return { data: "v", error: null }; });
    expect(withLoc[0]!["_location_kind"]).toBe("urbana");
  });
});
