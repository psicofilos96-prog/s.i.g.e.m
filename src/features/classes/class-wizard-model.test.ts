import { describe, expect, it } from "vitest";
import { classCreateError, compositionKindOf, createArgs, emptyClassWizard, parseCapacity, stepProblems, yearAcceptsNewClass } from "./class-wizard-model";

const pos = (value: string, scheme = "cat") => ({ scheme, value, version: 1, label: value });
const ctx = { yearState: "operacional", existingNames: ["5º A"] };

describe("assistente Nova turma", () => {
  it("ano histórico ou não aberto não recebe turma nova", () => {
    expect(yearAcceptsNewClass("historico-importado")).toBe(false);
    expect(yearAcceptsNewClass("encerrado")).toBe(false);
    expect(yearAcceptsNewClass(null)).toBe(false);
    expect(yearAcceptsNewClass("em-preparacao")).toBe(true);
  });
  it("uma posição = simples; duas ou três = multisseriada", () => {
    expect(compositionKindOf([pos("1")])).toBe("simples");
    expect(compositionKindOf([pos("1"), pos("2")])).toBe("multisseriada");
    expect(compositionKindOf([pos("1"), pos("2"), pos("3")])).toBe("multisseriada");
  });
  it("multisseriada com um ano só e catálogos misturados são recusados", () => {
    const s = { ...emptyClassWizard(), compositionKind: "multisseriada" as const, positions: [pos("1")] };
    expect(stepProblems(1, s, ctx)).toContain("Turma multisseriada precisa de dois ou mais anos/etapas.");
    expect(stepProblems(1, { ...s, positions: [pos("1"), pos("x", "outro")] }, ctx)).toContain("Os anos/etapas precisam vir do mesmo catálogo.");
  });
  it("capacidade: vazio = não informada; zero nunca substitui desconhecido", () => {
    expect(parseCapacity("")).toEqual({ ok: true, value: null });
    expect(parseCapacity("0").ok).toBe(false);
    expect(parseCapacity("-3").ok).toBe(false);
    expect(parseCapacity("25")).toEqual({ ok: true, value: 25 });
  });
  it("nome duplicado na mesma escola e ano é apontado no passo 3", () => {
    expect(stepProblems(2, { ...emptyClassWizard(), name: "5º a" }, ctx)).toHaveLength(1);
  });
  it("recusa do banco aponta o passo a corrigir, sem texto técnico", () => {
    expect(classCreateError("composition:mixed-catalogs").step).toBe(1);
    expect(classCreateError("class:duplicate-name").step).toBe(2);
    expect(classCreateError("class:year-not-open").step).toBe(0);
    expect(classCreateError("algo inesperado").text).not.toMatch(/:/);
  });
  it("capacidade em branco vai como nula, nunca zero", () => {
    expect(createArgs("e", { ...emptyClassWizard(), name: "T", capacity: "" })._capacity).toBeNull();
  });
});
