/** 6D.5.1 — Matriz como fonte canônica da BNCC da Educação Infantil. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createCurriculumObjectiveRepository,
  curriculumObjectiveRepository as repo,
} from "./curriculum-objectives-repository";
import { FIVE_EXPERIENCE_FIELDS } from "./curriculum-data";
import { ageGroupsForClass, objectivesFor, objectiveById } from "@/features/diary/infant-experiences";

describe("BNCC Educação Infantil na Matriz", () => {
  it.each(["EI01", "EI02", "EI03"])("%s recupera somente objetivos do grupo", (g) => {
    const list = repo.query({ ageGroupIds: [g] });
    expect(list.length).toBeGreaterThan(20);
    expect(list.every((o) => o.code.startsWith(g) && o.ageGroupId === g)).toBe(true);
  });
  it("cobre os cinco Campos de Experiências", () => {
    const ids = new Set(repo.list().map((o) => o.fieldId));
    expect([...ids].sort()).toEqual(FIVE_EXPERIENCE_FIELDS.map((f) => f.id).sort());
    expect(repo.query({ fieldId: "corpo-gestos" }).every((o) => o.code.includes("CG"))).toBe(true);
  });
  it("busca por código e por texto (sem acento)", () => {
    expect(repo.query({ text: "EI02EO03" })[0]?.code).toBe("EI02EO03");
    expect(repo.query({ text: "emocoes" }).length).toBeGreaterThan(0);
  });
  it("preserva código e texto oficial com proveniência BNCC", () => {
    const o = repo.byId("bncc:EI01CG01")!;
    expect(o.officialText).toMatch(/^Movimentar as partes do corpo/);
    expect(o.source).toMatchObject({ sourceId: "bncc", version: "2018" });
    expect(o.nature).toBe("fonte-nacional");
  });
  it("complementação da rede não sobrescreve identidade BNCC", () => {
    const r = createCurriculumObjectiveRepository();
    const src = { sourceId: "rede", label: "Rede", authority: "SME", version: "1" };
    expect(r.addComplement({ id: "bncc:EI01CG01", code: "EI01CG01", officialText: "x", fieldId: "corpo-gestos", ageGroupId: "EI01", source: src }).ok).toBe(false);
    expect(r.addComplement({ id: "x", code: "Y", officialText: "x", fieldId: "corpo-gestos", ageGroupId: "EI01", source: { ...src, sourceId: "bncc" } }).ok).toBe(false);
    const ok = r.addComplement({ id: "rede:EI01CG01-A", code: "REDE-EI01CG01-A", officialText: "x", fieldId: "corpo-gestos", ageGroupId: "EI01", source: src, complementsObjectiveIds: ["bncc:EI01CG01"] });
    expect(ok.ok && ok.value.nature).toBe("complementacao-da-rede");
    expect(r.byId("bncc:EI01CG01")?.officialText).toMatch(/^Movimentar/);
  });
});

describe("Diário da Educação Infantil consome a Matriz", () => {
  it("lê o repositório, sem lista curricular própria nem objetivos fictícios", () => {
    const src = readFileSync("src/features/diary/infant-experiences.ts", "utf8");
    expect(src).toMatch(/curriculumObjectiveRepository/);
    expect(src).not.toMatch(/Exemplo fictício|obj-[a-z]{2}-0\d/);
    expect(objectiveById("bncc:EI03TS01")).toBe(repo.byId("bncc:EI03TS01"));
  });
  it("turma filtra pelo grupo etário declarado", () => {
    expect(ageGroupsForClass("tur-008")).toEqual(["EI03"]);
    expect(objectivesFor("", undefined, ageGroupsForClass("tur-008")).every((o) => o.ageGroupId === "EI03")).toBe(true);
  });
  it("nenhuma lógica quantitativa na Educação Infantil", () => {
    for (const f of ["src/features/diary/infant-experiences.ts", "src/features/curriculum/curriculum-objectives-repository.ts"]) {
      const s = readFileSync(f, "utf8");
      expect(s).not.toMatch(/\b(average|media|score|percent|ranking|aprovad|reprovad)\w*\s*[(=:]/i);
    }
  });
});
