import { describe, expect, it } from "vitest";
import { canComplete, missingByStep, seatLabel, validCpf, wizardMessage } from "./enrollment-wizard-model";

const full = { aluno: { nome: "Ana" }, matricula: { ano: "a", data: "2027-02-01" }, turma: { id: "t" } };

describe("matrícula guiada", () => {
  it("aluno novo exige nome e CPF ou INEP", () => {
    expect(missingByStep({}, { existingStudentId: null, hasCpf: false, inep: null })[1]).toEqual(["Nome completo do aluno", "CPF ou código INEP do aluno"]);
    expect(missingByStep({ aluno: { nome: "Ana" } }, { existingStudentId: null, hasCpf: false, inep: "1" })[1]).toEqual([]);
  });
  it("aluno já cadastrado dispensa identificação", () => {
    expect(missingByStep({}, { existingStudentId: "est-1", hasCpf: false, inep: null })[1]).toEqual([]);
  });
  it("não conclui sem turma", () => {
    expect(canComplete({ ...full, turma: {} }, { existingStudentId: null, hasCpf: true, inep: null })).toBe(false);
    expect(canComplete(full, { existingStudentId: null, hasCpf: true, inep: null })).toBe(true);
  });
  it("CPF válido por dígito verificador", () => {
    expect(validCpf("529.982.247-25")).toBe(true);
    expect(validCpf("529.982.247-24")).toBe(false);
    expect(validCpf("111.111.111-11")).toBe(false);
  });
  it("capacidade ausente nunca vira zero", () => {
    expect(seatLabel({ id: "t", name: "A", shift: null, capacity: null, occupancy: 0 })).toBe("Capacidade não informada · 0 enturmado(s)");
    expect(seatLabel({ id: "t", name: "A", shift: null, capacity: 20, occupancy: 20 })).toBe("Lotada · 20/20");
    expect(seatLabel({ id: "t", name: "A", shift: null, capacity: 20, occupancy: 3 })).toBe("Há vaga · 3/20");
  });
  it("erro desconhecido diz que nada virou matrícula", () => {
    expect(wizardMessage(new Error("x"))).toContain("Nada foi gravado");
    expect(wizardMessage(new Error("P0001: secretariat:class-invalid"))).toBe("A turma não pertence a esta escola e ano.");
  });
});
