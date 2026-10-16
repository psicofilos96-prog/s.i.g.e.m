import { describe, expect, it } from "vitest";
import { buildLiveDoc, peopleRows, staffCategory, type LiveMapData, type LiveStaff } from "./map-live";

const staff = (o: Partial<LiveStaff>): LiveStaff => ({ source: "quadro-2026", person_key: Math.random().toString(), full_name: "X", registration: null, cargo: null, funcao: null, grupo: null, situacao: "Em atividade", classes: null, observacao: null, ...o });
const base: LiveMapData = { schoolName: "E. M. Teste", inep: "99999901", year: 2027, month: 3, referenceDate: "2027-03-31", identification: {}, classes: [], previousTotal: null, movements: [], staff: [], visits: [], failed: [] };
const text = (d: ReturnType<typeof buildLiveDoc>, id: string) => JSON.stringify(d.sections.find((s) => s.id === id));
const o = { headerLines: [], signatures: [], generatedAt: "agora" };

describe("Mapa vivo", () => {
  it("aluno novo registrado em março aparece no mapa de março (IV-A)", () => {
    const d = buildLiveDoc({ ...base, movements: [{ grp: "A", student_name: "Ana Souza", census_id: "123", kind: "Novo", happened_on: "2027-03-10", class_label: null }] }, o);
    expect(text(d, "IV")).toContain("Ana Souza");
    expect(text(d, "IV")).toContain("10/03/2027");
  });
  it("cada pessoa aparece uma vez: professor com atuação não se repete pelo quadro", () => {
    const rows = peopleRows([staff({ source: "atuacao", full_name: "Maria Lima", classes: "101, 102" }), staff({ full_name: "MARIA LIMA", funcao: "Professor II" }), staff({ source: "atuacao", full_name: "Maria Lima", classes: "103" })]);
    expect(rows.filter((r) => r.cells.includes("Maria Lima") || r.cells.includes("MARIA LIMA"))).toHaveLength(1);
  });
  it("situação prevalece sobre função na categoria", () => {
    expect(staffCategory(staff({ funcao: "Professor II", situacao: "Licença médica" }))).toBe("G");
    expect(staffCategory(staff({ funcao: "Mediador Escolar" }))).toBe("E");
    expect(staffCategory(staff({ funcao: "Diretora Geral" }))).toBe("A");
    expect(staffCategory(staff({ funcao: "Servente" }))).toBe("F");
  });
  it("remanejado não entra em A–D e escola sem turma mostra —, não zero", () => {
    const d = buildLiveDoc({ ...base, movements: [{ grp: "R", student_name: "Rui", census_id: null, kind: "Remanejamento", happened_on: "2027-03-02", class_label: "101" }] }, o);
    expect(text(d, "IV")).not.toContain("Rui");
    expect(text(d, "II")).toContain("—");
  });
  it("matrícula por turno soma os alunos das turmas", () => {
    const d = buildLiveDoc({ ...base, classes: [{ class_id: "a", class_name: "101", stage_label: "1º ano", shift_label: "Manhã", students: 20 }, { class_id: "b", class_name: "201", stage_label: "2º ano", shift_label: "Tarde", students: 18 }] }, o);
    expect(text(d, "III")).toContain("38");
  });
});

import { movementRows as mr, lateNote } from "./map-live";
describe("congelamento do mapa", () => {
  it("matrícula de 29/05 registrada após congelar maio entra em junho com observação", () => {
    const rows = mr([{ grp: "A", student_name: "Ana", census_id: null, kind: "Novo", happened_on: "2027-05-29", class_label: "100", late: true }]);
    expect(rows[0].cells[5]).toBe("Ocorrida em 29/05/2027, registrada após o congelamento do mapa de 05/2027");
    expect(lateNote({ happened_on: "2027-05-29" })).toContain("05/2027");
  });
  it("movimentação normal não leva observação", () => {
    expect(mr([{ grp: "A", student_name: "Ana", census_id: null, kind: "Novo", happened_on: "2027-06-02", class_label: "100" }])[0].cells[5]).toBe("—");
  });
});
