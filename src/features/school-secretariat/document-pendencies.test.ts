import { describe, expect, it } from "vitest";
import { groupPendencies, isOverdue, openCount, pendencyMessage, type PendencyEvent } from "./document-pendencies";

const ev = (id: string, version: number, status: PendencyEvent["status"], due_on: string | null = null): PendencyEvent => ({
  pendency_id: id, version, enrollment_id: "m1", student_id: "s1", description: "Histórico escolar",
  status, due_on, note: null, recorded_at: `2026-10-0${version}T10:00:00Z`, is_current: false,
});

describe("pendências documentais", () => {
  it("vigente é a maior versão e o histórico é preservado", () => {
    const [p] = groupPendencies([ev("a", 2, "recebido"), ev("a", 1, "pendente")]);
    expect(p!.current.status).toBe("recebido");
    expect(p!.history.map((h) => h.version)).toEqual([1, 2]);
  });
  it("recebido e dispensado não contam como em aberto", () => {
    expect(openCount(groupPendencies([ev("a", 1, "pendente"), ev("b", 1, "recebido"), ev("c", 1, "dispensado"), ev("d", 1, "invalido")]))).toBe(2);
  });
  it("sem prazo declarado nunca é atraso", () => {
    const [p] = groupPendencies([ev("a", 1, "pendente", null)]);
    expect(isOverdue(p!, "2030-01-01")).toBe(false);
    const [q] = groupPendencies([ev("b", 1, "pendente", "2026-10-01")]);
    expect(isOverdue(q!, "2026-10-07")).toBe(true);
  });
  it("conflito de concorrência tem mensagem própria", () => {
    expect(pendencyMessage("pendency:head-changed")).toMatch(/Outra pessoa/);
  });
});
