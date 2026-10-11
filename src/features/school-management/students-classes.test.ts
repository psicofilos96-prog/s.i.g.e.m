import { describe, expect, it } from "vitest";
import { ageGradeDistortion, decideClassRequest, openClassRequest, panelBy, studentView, vacancy, type StudentFacts } from "./students-classes";

const s: StudentFacts = { studentId: "st1", name: "Sintético", birthDate: "2015-03-10",
  enrollment: { schoolId: "A", openedOn: null, endedOn: null }, allocation: { classId: "c1", from: "2026-02-01", to: null },
  position: { schemaKey: "ano", value: "5" }, guardians: [{ personId: "g1", sections: ["matricula"], validTo: null, revokedOn: null }, { personId: "g2", sections: [], validTo: null, revokedOn: "2026-05-01" }],
  transfers: [], standing: null };

describe("Direção — estudantes e turmas", () => {
  it("escola B não vê aluno da A; data ausente não é preenchida", () => {
    expect(studentView(s, "B", "2026-10-11")).toMatchObject({ ok: false });
    const v = studentView(s, "A", "2026-10-11");
    expect(v.ok && v.view).toMatchObject({ matricula: { inicio: "início não declarado" }, turma: "c1", responsaveis: ["g1"], situacao: "não registrado" });
  });
  it("distorção só com regra homologada e posição individual", () => {
    expect(ageGradeDistortion(s, null)).toMatchObject({ state: "indeterminado" });
    expect(ageGradeDistortion({ ...s, position: null }, { referenceDate: "2026-03-31", expectedAge: { "ano:5": 10 }, gapYears: 2 })).toMatchObject({ reason: /posição/ });
    expect(ageGradeDistortion(s, { referenceDate: "2026-03-31", expectedAge: { "ano:5": 10 }, gapYears: 2 })).toEqual({ state: "adequado", age: 11 });
  });
  it("painel mantém ausentes como 'não registrado'; saldo só com capacidade", () => {
    expect(panelBy([{ t: "manhã" }, { t: null }], (r) => r.t)).toEqual({ manhã: 1, "não registrado": 1 });
    expect(vacancy({ capacity: null, occupied: 20, queued: 3 })).toMatchObject({ saldo: null, demanda: 3 });
    expect(vacancy({ capacity: 25, occupied: 25, queued: null }).saldo).toBe(0);
  });
  it("Direção solicita; só o setor competente decide; execução exige ato do writer", () => {
    const o = openClassRequest({ id: "r1", kind: "mudar-turno", schoolId: "A", requestedBy: "dir", reason: "demanda" }, true);
    if (!o.ok) throw new Error();
    expect(decideClassRequest(o.request, { type: "deferido", by: "dir", capabilities: ["manter-turno-da-turma"] })).toMatchObject({ code: "direcao:autodecisao" });
    expect(decideClassRequest(o.request, { type: "deferido", by: "sec", capabilities: ["painel-direcao"] })).toMatchObject({ code: "direcao:setor-nao-competente" });
    expect(decideClassRequest(o.request, { type: "executado", by: "sec", capabilities: ["manter-turno-da-turma"], writerRef: "v1" })).toMatchObject({ code: "direcao:execucao-sem-ato" });
    const d = decideClassRequest(o.request, { type: "deferido", by: "sec", capabilities: ["manter-turno-da-turma"] });
    expect(d.ok).toBe(true);
  });
});
