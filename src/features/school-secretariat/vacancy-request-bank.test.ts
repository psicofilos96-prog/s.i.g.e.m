import { describe, expect, it } from "vitest";
import { ALLOWED, defaultDueOn, queuePositions, requestState, type VacancyRequestRow } from "./vacancy-request-bank";

const row = (id: string, at: string, stage: string, last: VacancyRequestRow["last_action"] = null): VacancyRequestRow => ({
  id, protocol_code: id, protocol_seq: 1, desired_stage: stage, desired_shift: null, student_name: "Aluno Teste", student_birth_date: "2020-01-01",
  guardian_name: "Responsável", guardian_phone: null, note: null, recorded_at: at, last_seq: 0, last_action: last, due_on: null, last_note: null, last_at: null,
});

describe("banco de solicitação de vagas", () => {
  it("fila segue a ordem de protocolo por etapa e ignora pedidos encerrados", () => {
    const p = queuePositions([row("b", "2026-10-02", "Creche"), row("a", "2026-10-01", "Creche"), row("c", "2026-10-03", "Creche", "matriculado"), row("d", "2026-10-04", "1º ano")]);
    expect(p.get("a")).toBe(1); expect(p.get("b")).toBe(2); expect(p.has("c")).toBe(false); expect(p.get("d")).toBe(1);
  });
  it("voltar à fila devolve o pedido a aguardando", () => expect(requestState("voltar-a-fila")).toBe("aguardando"));
  it("matrícula só depois de convocar", () => {
    expect(ALLOWED.aguardando).not.toContain("matriculado");
    expect(ALLOWED.convocada).toContain("matriculado");
  });
  it("prazo padrão de comparecimento é 5 dias", () => expect(defaultDueOn("2026-10-17")).toBe("2026-10-22"));
});
