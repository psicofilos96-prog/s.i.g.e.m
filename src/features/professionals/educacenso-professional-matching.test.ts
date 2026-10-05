import { describe, expect, it } from "vitest";
import { aggregateReport, stageProfessionals, validCpf, type SourceProfessionalRow } from "./educacenso-professional-matching";

// CPFs sintéticos válidos gerados apenas para teste (não pertencem a pessoas reais conhecidas).
const A = "52998224725";
const B = "11144477735";
const fp = (s: string) => `fp${[...s].reverse().join("")}`;
const known = new Set(["33094756", "33100012"]);
const base = (p: Partial<SourceProfessionalRow>): SourceProfessionalRow => ({ locator: "s.xlsx!A!2", name: "Fulano Sintético", schoolInep: "33094756", ...p });

describe("matching de profissionais (sintético)", () => {
  it("valida CPF", () => {
    expect(validCpf(A)).toBe(true);
    expect(validCpf("11111111111")).toBe(false);
  });
  it("homônimos com CPFs distintos viram pessoas distintas; sem CPF não casa por nome", () => {
    const r = stageProfessionals({ fingerprint: fp, existing: [], knownIneps: known, rows: [
      base({ cpf: A, functionalRegistration: "1" }), base({ cpf: B, functionalRegistration: "2" }), base({ cpf: null }),
    ] });
    expect(r.persons).toHaveLength(2);
    expect(r.stats["homonimosDistinguidosPorCpf"]).toBe(2);
    expect(r.issues.map((i) => i.code)).toContain("cpf-ausente-sem-chave-segura");
  });
  it("mesma pessoa com 2 vínculos e lotação múltipla não colapsa", () => {
    const r = stageProfessionals({ fingerprint: fp, existing: [{ personId: "p1", cpfFingerprint: fp(A) }], knownIneps: known, rows: [
      base({ cpf: A, functionalRegistration: "10", role: "Professor" }),
      base({ cpf: A, functionalRegistration: "20", role: "Professor", schoolInep: "33100012" }),
      base({ cpf: A, functionalRegistration: "10", role: "Professor", schoolInep: "33100012", fn: "Coordenação" }),
    ] });
    const p = r.persons[0]!;
    expect(p.personId).toBe("p1");
    expect(p.links.map((l) => l.registration)).toEqual(["10", "20"]);
    expect(p.postings).toHaveLength(3);
  });
  it("matrícula ausente, vínculo encerrado, escola de outro escopo e pessoa não cadastrada são erros explícitos", () => {
    const r = stageProfessionals({ fingerprint: fp, existing: [], knownIneps: known, rows: [
      base({ cpf: A, validFrom: "2020-01-01", validUntil: "2025-12-31" }), base({ cpf: B, functionalRegistration: "3", schoolInep: "99999999" }),
    ] });
    const codes = r.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["matricula-ausente", "escola-inexistente", "pessoa-nao-cadastrada"]));
    expect(r.persons[0]!.links[0]!.validUntil).toBe("2025-12-31");
  });
  it("turma de atuação é só catalogada; regência nunca é inferida", () => {
    const r = stageProfessionals({ fingerprint: fp, existing: [], knownIneps: known, rows: [base({ cpf: A, functionalRegistration: "1", declaredClassCode: "T1" })] });
    expect(r.persons[0]!.declaredClassCodes).toEqual(["T1"]);
    expect(r.stats["regencias"]).toBe(0);
  });
  it("relatório agregado não contém CPF, nome nem fingerprint", () => {
    const r = stageProfessionals({ fingerprint: fp, existing: [], knownIneps: known, rows: [base({ cpf: A }), base({ cpf: "123" })] });
    const out = JSON.stringify(aggregateReport(r));
    expect(out).not.toContain(A);
    expect(out).not.toContain("Fulano");
    expect(out).not.toContain(fp(A));
  });
});
