import { describe, expect, it } from "vitest";
import { childPortfolio, fieldCoverage, infantGuard, nextEntryVersion, validateEntry, type InfantEntry } from "./infant-portfolio";

const base: Omit<InfantEntry, "version"> = { entryId: "r1", childIds: ["c1", "c2"], classId: "ei1", date: "2026-03-10", kind: "brincadeira",
  fieldIds: ["EO"], objectiveIds: ["EI03EO01"], narrative: "Brincaram de roda e combinaram regras.", evidencePaths: ["prof/foto.jpg"],
  shareWithFamily: true, authorId: "prof", recordedAt: "x" };
const ctx = { myChildren: ["c1", "c2"], knownFields: ["EO", "CG"], knownObjectives: ["EI03EO01"], isInfantClass: true };

describe("Educação Infantil (Docente L12)", () => {
  it("registro descritivo válido passa", () => expect(validateEntry(base, ctx)).toEqual([]));
  it("recusa nota, aprovação, retenção e diagnóstico", () => {
    expect(infantGuard("Nota 8 na atividade").length).toBeGreaterThan(0);
    expect(infantGuard("Será retida no grupo").length).toBeGreaterThan(0);
    expect(infantGuard("Aprovada para o próximo ano").length).toBeGreaterThan(0);
    expect(infantGuard("ok", { value: 7 })).toHaveLength(1);
  });
  it("recusa turma não EI, criança alheia e campo desconhecido", () => {
    expect(validateEntry(base, { ...ctx, isInfantClass: false }).join()).toMatch(/não é de Educação Infantil/);
    expect(validateEntry({ ...base, childIds: ["c9"] }, ctx).join()).toMatch(/suas turmas/);
    expect(validateEntry({ ...base, fieldIds: ["XX"] }, ctx).join()).toMatch(/não reconhecido/);
  });
  it("versões preservam histórico e exigem motivo e autoria", () => {
    const v1 = nextEntryVersion([], base, 0);
    expect(() => nextEntryVersion([v1], { ...base, narrative: "x" }, 1)).toThrow(/motivo/);
    const v2 = nextEntryVersion([v1], { ...base, narrative: "Revisto", reason: "complemento" }, 1);
    expect(v2.supersedes).toBe("r1@1");
    expect(childPortfolio([v1, v2], "c1", "docente")).toEqual([v2]);
    expect(() => nextEntryVersion([v1], { ...base, authorId: "outro", reason: "r" }, 1)).toThrow(/Só quem/);
  });
  it("família só vê o compartilhado e sem outras crianças; cobertura sem escala", () => {
    const v1 = nextEntryVersion([], base, 0);
    const priv = nextEntryVersion([], { ...base, entryId: "r2", shareWithFamily: false }, 0);
    const fam = childPortfolio([v1, priv], "c1", "familia");
    expect(fam.map((e) => e.entryId)).toEqual(["r1"]);
    expect(fam[0]!.childIds).toEqual(["c1"]);
    expect(fieldCoverage([v1], ["EO", "CG"])).toEqual([{ fieldId: "EO", entries: 1 }, { fieldId: "CG", entries: 0 }]);
  });
});
