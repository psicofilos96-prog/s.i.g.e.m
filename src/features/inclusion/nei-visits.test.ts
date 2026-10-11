import { describe, expect, it } from "vitest";
import { hasClinicalText, overdue, protocolProblem, visitProblem } from "./nei-visits";

describe("NEI.5 visitas e protocolos", () => {
  it("bloqueia CID e menções clínicas em protocolo", () => {
    expect(hasClinicalText("Encaminhamento CID F84")).toBe(true);
    expect(hasClinicalText("Conforme laudo")).toBe(true);
    expect(hasClinicalText("Reunião na sala de recursos")).toBe(false);
    expect(protocolProblem("Assunto ok", "Estudante F84.0 precisa", "aee", "u", "")).toMatch(/clínic/);
  });
  it("família exige estudante", () => {
    expect(protocolProblem("Convite reunião", "Convidamos para reunião.", "familia", "u", "")).toMatch(/estudante/);
  });
  it("visita realizada exige relatório e encerrada não muda", () => {
    expect(visitProblem("agendada", "realizada", "curto", "")).toMatch(/Relatório/);
    expect(visitProblem("realizada", "cancelada", "justificativa longa", "")).toMatch(/encerrada/);
  });
  it("sem prazo nunca é atraso", () => {
    expect(overdue(null, false, "2026-10-11")).toBe(false);
    expect(overdue("2026-10-01", false, "2026-10-11")).toBe(true);
    expect(overdue("2026-10-01", true, "2026-10-11")).toBe(false);
  });
});
