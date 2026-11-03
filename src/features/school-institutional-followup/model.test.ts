import { describe, expect, it } from "vitest";
import { currentSituation, currentUpdate, isOverdue, networkIndicators, normalizeText, schoolIndicators, searchableNetwork, type FollowupAction, type FollowupUpdate } from "./model";

const action: FollowupAction = {
  id: "a1", school_id: "s1", visit_logical_id: "v1", description: "Organizar o acervo",
  responsible_label: "Direção", due_on: "2026-10-15", created_at: "2026-09-30T12:00:00Z", author_name: "Equipe",
};
const progress: FollowupUpdate = {
  id: "u1", action_id: "a1", visit_logical_id: null, occurred_on: "2026-10-10",
  situation: "em andamento", done_text: "Iniciada", not_done_text: null, results: null,
  referrals: null, created_at: "2026-10-10T10:00:00Z", author_name: "Equipe",
};
const completed: FollowupUpdate = {
  ...progress, id: "u2", occurred_on: "2026-10-18", situation: "concluída",
  done_text: "Concluída", created_at: "2026-10-18T10:00:00Z",
};
describe("acompanhamento das unidades — projeções", () => {
  it("não converte ausência de atualização em não realizada", () => {
    expect(currentSituation(action, [])).toBe("sem atualização");
    expect(currentUpdate(action, [])).toBe(null);
  });
  it("conclusão mais recente supera o andamento, sem apagar o histórico", () => {
    const events = [completed, progress];
    expect(currentUpdate(action, events)?.id).toBe("u2");
    expect(currentSituation(action, events)).toBe("concluída");
    expect(events).toHaveLength(2);
  });
  it("prazo ausente nunca vence e prazo vencido exige data declarada", () => {
    expect(isOverdue({ ...action, due_on: null }, [], "2026-11-03")).toBe(false);
    expect(isOverdue(action, [], "2026-10-15")).toBe(false);
    expect(isOverdue(action, [progress], "2026-11-03")).toBe(true);
    expect(isOverdue(action, [completed], "2026-11-03")).toBe(false);
  });
  it("indicadores distinguem conclusão, vencimento e registro ausente", () => {
    const s = schoolIndicators({
      visits: [], actions: [action, { ...action, id: "a2", due_on: null }],
      updates: [progress],
    }, "2026-11-03");
    expect(s).toEqual({ visits: 0, actions: 2, completed: 0, overdue: 1, noDueDate: 1, withoutUpdate: 1 });
  });
  it("total de escolas acessíveis não é igual às visitadas", () => {
    const n = networkIndicators([
      { school_id: "s1", school_name: "Escola A", visits: 0, actions: 1, completed: 0, overdue: 0, last_visit: null },
      { school_id: "s2", school_name: "Escola B", visits: 2, actions: 3, completed: 2, overdue: 1, last_visit: "2026-10-20" },
    ]);
    expect(n).toEqual({ schools: 2, visitedSchools: 1, visits: 2, actions: 4, completed: 2, overdue: 1 });
  });
  it("pesquisa por nome ignora acentos", () => {
    expect(normalizeText("São João")).toBe("sao joao");
    expect(searchableNetwork([
      { school_id: "1", school_name: "Escola São João", visits: 0, actions: 0, completed: 0, overdue: 0, last_visit: null },
    ], "sao joao")).toHaveLength(1);
  });
});
