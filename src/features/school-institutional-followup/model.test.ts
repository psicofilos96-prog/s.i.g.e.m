import { describe, expect, it } from "vitest";
import { currentSituation, currentUpdate, availableFollowupVisits, followupVisitByLogicalId, filterSchoolActions, filterNetworkRows, filterNetworkPending, validateFollowupActionDrafts, isEvolutionDraftDirty, isOverdue, networkIndicators, normalizeText, schoolIndicators, searchableNetwork, type FollowupAction, type FollowupUpdate } from "./model";

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
  it("recusa medida parcial em vez de descartar responsável ou prazo", () => {
    const day = "2026-11-04";
    expect(validateFollowupActionDrafts([{ description: "", responsible: "", due: "" }], day)).toBeNull();
    expect(validateFollowupActionDrafts([
      { description: "   ", responsible: "Direção", due: "" },
    ], day)).toContain("sem descrição");
    expect(validateFollowupActionDrafts([
      { description: "", responsible: " ", due: "2026-11-08" },
    ], day)).toContain("sem descrição");
    expect(validateFollowupActionDrafts([
      { description: "Criar cronograma", responsible: "Coordenação", due: "2026-11-01" },
    ], day)).toContain("não pode ser anterior");
    expect(validateFollowupActionDrafts([
      { description: "Criar cronograma", responsible: "Coordenação", due: "2026-11-04" },
      { description: "", responsible: "", due: "" },
    ], day)).toBeNull();
  });
  it("protege a evolução em preenchimento de trocas de medida", () => {
    const empty = {
      day: "2026-11-04", initialDay: "2026-11-04", situation: "prevista",
      linkedVisitId: "", done: "", notDone: "", results: "", referrals: "",
    };
    expect(isEvolutionDraftDirty(empty)).toBe(false);
    expect(isEvolutionDraftDirty({ ...empty, done: "  " })).toBe(false);
    expect(isEvolutionDraftDirty({ ...empty, done: "Mobiliário entregue" })).toBe(true);
    expect(isEvolutionDraftDirty({ ...empty, notDone: "Ainda pendente" })).toBe(true);
    expect(isEvolutionDraftDirty({ ...empty, referrals: "Nova avaliação" })).toBe(true);
    expect(isEvolutionDraftDirty({ ...empty, results: "Resultado observado" })).toBe(true);
    expect(isEvolutionDraftDirty({ ...empty, situation: "em andamento" })).toBe(true);
    expect(isEvolutionDraftDirty({ ...empty, linkedVisitId: "visit-return" })).toBe(true);
    expect(isEvolutionDraftDirty({ ...empty, day: "2026-11-03" })).toBe(true);
  });
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
      visits: [], visit_history: [], actions: [action, { ...action, id: "a2", due_on: null }],
      updates: [progress],
    }, "2026-11-03");
    expect(s).toEqual({ visits: 0, actions: 2, completed: 0, overdue: 1, noDueDate: 1, withoutUpdate: 1 });
  });
  it("filtra ações sem equiparar sem atualização a não realizada", () => {
    const a2 = { ...action, id: "a2", description: "Preparar formação", responsible_label: "Coordenação", due_on: null };
    const a3 = { ...action, id: "a3", description: "Revisar ventilação", due_on: "2026-11-15" };
    const items = [a3, a2, action];
    expect(filterSchoolActions(items, [progress], "sem atualização", "", "2026-11-04")
      .map((a) => a.id)).toEqual(["a3", "a2"]);
    expect(filterSchoolActions(items, [progress], "não realizada", "", "2026-11-04")).toEqual([]);
    expect(filterSchoolActions(items, [progress], "prazo vencido", "", "2026-11-04")
      .map((a) => a.id)).toEqual(["a1"]);
    expect(filterSchoolActions(items, [completed], "prazo vencido", "", "2026-11-04")).toEqual([]);
    expect(filterSchoolActions(items, [], "sem prazo", "", "2026-11-04").map((a) => a.id)).toEqual(["a2"]);
  });
  it("filtra por responsável, descrição ou prazo sem alterar a lista original", () => {
    const a2 = { ...action, id: "a2", description: "Revisar iluminação", responsible_label: "José", due_on: null };
    const source = [a2, action];
    expect(filterSchoolActions(source, [], "todas", "joSE", "2026-11-04").map((a) => a.id)).toEqual(["a2"]);
    expect(filterSchoolActions(source, [], "todas", "ACERVO", "2026-11-04").map((a) => a.id)).toEqual(["a1"]);
    expect(filterSchoolActions(source, [], "todas", "2026-10", "2026-11-04").map((a) => a.id)).toEqual(["a1"]);
    expect(source.map((a) => a.id)).toEqual(["a2", "a1"]);
  });
  it("filtra escolas por acompanhamento sem criar ranking ou perder as demais", () => {
    const rows = [
      { school_id: "a", school_name: "Escola José", inep: "33001000", visits: 0, actions: 1, completed: 0, overdue: 0, last_visit: null },
      { school_id: "b", school_name: "Escola Bela", inep: null, visits: 2, actions: 2, completed: 1, overdue: 1, last_visit: "2026-10-20" },
      { school_id: "c", school_name: "Escola Serra", inep: null, visits: 1, actions: 0, completed: 0, overdue: 0, last_visit: "2026-11-01" },
    ];
    expect(filterNetworkRows(rows, "", "sem visita").map((r) => r.school_id)).toEqual(["a"]);
    expect(filterNetworkRows(rows, "", "com prazo vencido").map((r) => r.school_id)).toEqual(["b"]);
    expect(filterNetworkRows(rows, "", "visitadas").map((r) => r.school_id)).toEqual(["b", "c"]);
    expect(filterNetworkRows(rows, "33001000", "todas").map((r) => r.school_id)).toEqual(["a"]);
    expect(rows).toHaveLength(3);
  });
  it("filtros de providências não confundem prazo vencido com ausência de atualização", () => {
    const items = [
      { action_id: "b", school_id: "b", school_name: "Escola Sul", inep: "33000001",
        description: "Organizar biblioteca", responsible_label: "Direção", due_on: null,
        situation: "sem atualização", last_update_on: null, created_at: "2026-11-01T12:00:00Z" },
      { action_id: "a", school_id: "a", school_name: "Escola Norte", inep: null,
        description: "Revisar telhado", responsible_label: null, due_on: "2026-11-02",
        situation: "em andamento", last_update_on: "2026-11-03", created_at: "2026-10-02T12:00:00Z" },
      { action_id: "c", school_id: "b", school_name: "Escola Sul", inep: "33000001",
        description: "Revisar salas", responsible_label: "Coordenação", due_on: "2026-11-15",
        situation: "não realizada", last_update_on: "2026-11-01", created_at: "2026-11-01T12:00:00Z" },
    ];
    const selected = (view: Parameters<typeof filterNetworkPending>[1], term = "") =>
      filterNetworkPending(items, view, term, "2026-11-04").map((a) => a.action_id);
    expect(selected("todas")).toEqual(["a", "c", "b"]);
    expect(selected("vencidas")).toEqual(["a"]);
    expect(selected("sem prazo")).toEqual(["b"]);
    expect(selected("sem atualização")).toEqual(["b"]);
    expect(selected("não realizada")).toEqual(["c"]);
    expect(selected("todas", "33000001")).toEqual(["c", "b"]);
    expect(items[0]?.action_id).toBe("b");
  });
  it("oferece apenas visitas vigentes, da mesma escola e anteriores à evolução", () => {
    const visit = (id: string, logical: string, school: string, day: string) => ({
      id, logical_id: logical, school_id: school, visit_date: day, version: 1,
      diagnosis: "Diagnóstico", strengths: "", weaknesses: "", summary: null,
      correction_reason: null, supersedes_id: null, created_at: "2026-11-04T12:00:00Z",
      author_name: "Equipe",
    });
    const origin = visit("v1", "origin", "s1", "2026-10-15");
    const returnVisit = visit("v2", "return", "s1", "2026-11-02");
    const other = visit("v3", "other", "s2", "2026-11-01");
    const future = visit("v4", "future", "s1", "2026-11-06");
    const snap = { visits: [future, other, origin, returnVisit], visit_history: [],
      actions: [], updates: [] };
    const measure = { ...action, visit_logical_id: "origin" };
    expect(availableFollowupVisits(snap, measure, "2026-11-03").map((v) => v.id))
      .toEqual(["v2", "v1"]);
    expect(availableFollowupVisits(snap, measure, "2026-10-20").map((v) => v.id))
      .toEqual(["v1"]);
    expect(availableFollowupVisits(snap, { ...measure, visit_logical_id: "unknown" }, "2026-11-03"))
      .toEqual([]);
    expect(followupVisitByLogicalId(snap.visits, "return")?.id).toBe("v2");
    expect(followupVisitByLogicalId(snap.visits, null)).toBeNull();
  });
  it("total de escolas acessíveis não é igual às visitadas", () => {
    const n = networkIndicators([
      { school_id: "s1", school_name: "Escola A", visits: 0, actions: 1, completed: 0, overdue: 0, last_visit: null },
      { school_id: "s2", school_name: "Escola B", visits: 2, actions: 3, completed: 2, overdue: 1, last_visit: "2026-10-20" },
    ]);
    expect(n).toEqual({ schools: 2, visitedSchools: 1, visits: 2, actions: 4, completed: 2, overdue: 1 });
  });
  it("encontra unidade pelo INEP canônico sem inferir código ausente", () => {
    const schools = [
      { school_id: "school-a", school_name: "Escola do Centro", inep: "33000001",
        visits: 1, actions: 1, completed: 0, overdue: 0, last_visit: "2026-11-03" },
      { school_id: "school-b", school_name: "Escola Rural", inep: null,
        visits: 0, actions: 0, completed: 0, overdue: 0, last_visit: null },
    ];
    expect(searchableNetwork(schools, "33000001").map((s) => s.school_id)).toEqual(["school-a"]);
    expect(searchableNetwork(schools, "33000002")).toEqual([]);
    expect(searchableNetwork(schools, "rural").map((s) => s.school_id)).toEqual(["school-b"]);
  });
  it("pesquisa por nome ignora acentos", () => {
    expect(normalizeText("São João")).toBe("sao joao");
    expect(searchableNetwork([
      { school_id: "1", school_name: "Escola São João", visits: 0, actions: 0, completed: 0, overdue: 0, last_visit: null },
    ], "sao joao")).toHaveLength(1);
  });
});
