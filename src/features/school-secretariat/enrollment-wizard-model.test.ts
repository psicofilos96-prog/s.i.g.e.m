import { describe, expect, it } from "vitest";
import { canComplete, missingByStep, seatLabel, validCpf, wizardMessage } from "./enrollment-wizard-model";

const full = { aluno: { nome: "Ana", nascimento: "2017-12-01" }, matricula: { ano: "a", data: "2027-02-01" }, turma: { id: "t" } };

describe("matrícula guiada", () => {
  it("nascimento ausente não permite presumir dispensa de CPF", () => {
    expect(missingByStep({}, { existingStudentId: null, hasCpf: false, inep: null })[1]).toEqual(["Nome completo do aluno", "Data de nascimento válida"]);
    expect(canComplete({ ...full, aluno: { nome: "Ana" } }, { existingStudentId: null, hasCpf: true, inep: null })).toBe(false);
  });
  it("cadastro existente também exige CPF na faixa definida", () => {
    expect(canComplete(full, { existingStudentId: "est-1", hasCpf: false, inep: "123456789012", birthDate: "2017-12-01" })).toBe(false);
  });
  it("30/11/2017 aceita certidão sem CPF", () => {
    expect(canComplete({ ...full, aluno: { nome: "Ana", nascimento: "2017-11-30" }, documentos: { certidao: "123456789" } }, { existingStudentId: null, hasCpf: false, inep: null })).toBe(true);
  });
  it("01/12/2017 exige CPF mesmo com certidão e INEP", () => {
    expect(canComplete({ ...full, documentos: { certidao: "123456789" } }, { existingStudentId: null, hasCpf: false, inep: "123456789012" })).toBe(false);
    expect(canComplete(full, { existingStudentId: null, hasCpf: true, inep: null })).toBe(true);
  });
  it("02/12/2017 exige CPF", () => {
    expect(canComplete({ ...full, aluno: { nome: "Ana", nascimento: "2017-12-02" }, documentos: { certidao: "123456789" } }, { existingStudentId: null, hasCpf: false, inep: null })).toBe(false);
  });
  it("anterior ao corte não aceita apenas INEP", () => {
    expect(canComplete({ ...full, aluno: { nome: "Ana", nascimento: "2017-11-30" } }, { existingStudentId: null, hasCpf: false, inep: "123456789012" })).toBe(false);
  });
  it("consome alteração da data configurada", () => {
    expect(canComplete({ ...full, documentos: { certidao: "123456789" } }, { existingStudentId: null, hasCpf: false, inep: null, cpfRequiredFrom: "2018-01-01" })).toBe(true);
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
