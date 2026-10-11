import { describe, it, expect } from "vitest";
import { decide, validateGrant, catalogAudit, type ProfileGrant } from "./meals-competences";

const g = (p: Partial<ProfileGrant>): ProfileGrant => ({ profile: "nutricionista", principalId: "n", schoolId: null, from: "2026-01-01", to: null, professionalRegistry: "CRN 1234", isKitchenStaff: false, ...p });
const all = new Set(["manter-planejamento-nutricional", "registrar-execucao-alimentacao", "acompanhar-alimentacao-rede"]);

describe("competências da alimentação", () => {
  it("catálogo de perfis só usa capabilities existentes", () => {
    expect(catalogAudit().unknownInProfiles).toEqual([]);
    expect(catalogAudit().withoutProfile).toEqual([]);
  });
  it("ato de nutrição exige registro profissional; sem homologação nada passa", () => {
    expect(decide([g({})], "n", "manter-planejamento-nutricional", null, "2026-03-01", all)).toEqual({ allowed: true });
    expect(decide([g({ professionalRegistry: null })], "n", "manter-planejamento-nutricional", null, "2026-03-01", all).allowed).toBe(false);
    expect(decide([g({ profile: "coordenacao", principalId: "c" })], "c", "manter-planejamento-nutricional", null, "2026-03-01", all)).toEqual({ allowed: false, reason: "perfil não alcança este ato" });
    expect(decide([g({})], "n", "manter-planejamento-nutricional", null, "2026-03-01", new Set())).toEqual({ allowed: false, reason: "sem regra homologada na política" });
  });
  it("cozinha só na própria escola e na vigência; CAE nunca escreve", () => {
    const k = g({ profile: "cozinha", principalId: "k", schoolId: "E1", professionalRegistry: null, to: "2026-06-30" });
    expect(decide([k], "k", "registrar-execucao-alimentacao", "E1", "2026-03-01", all).allowed).toBe(true);
    expect(decide([k], "k", "registrar-execucao-alimentacao", "E2", "2026-03-01", all).allowed).toBe(false);
    expect(decide([k], "k", "registrar-execucao-alimentacao", "E1", "2026-07-01", all).allowed).toBe(false);
    expect(decide([g({ profile: "cae", principalId: "x" })], "x", "registrar-execucao-alimentacao", "E1", "2026-03-01", all).allowed).toBe(false);
  });
  it("vínculo: inspetor não é merendeiro, RT único, sem sobreposição", () => {
    expect(validateGrant([], g({ profile: "inspetor", schoolId: "E1", isKitchenStaff: true }))).toBe("inspetor-nao-pode-ser-merendeiro");
    expect(validateGrant([g({ profile: "rt-nutricionista", principalId: "a" })], g({ profile: "rt-nutricionista", principalId: "b" }))).toBe("rt-ja-designado-no-periodo");
    expect(validateGrant([g({})], g({ from: "2026-05-01" }))).toBe("vinculo-sobreposto");
    expect(validateGrant([], g({ profile: "cozinha", schoolId: null }))).toBe("perfil-escolar-exige-escola");
  });
});
