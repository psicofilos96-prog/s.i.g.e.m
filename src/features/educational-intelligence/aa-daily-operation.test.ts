import { describe, expect, it } from "vitest";
import { countOf, dailyTasks, draftIssues, parseDraft } from "./aa-daily-operation";
import type { InterventionView } from "./interventions";

const view = (o: Partial<InterventionView>) => ({ current: { logical_id: "p1", objective: "Fluência leitora" }, history: [], events: [], seq: 0, stage: "planejado", lastProgress: null, overdue: [], issues: [], ...o }) as unknown as InterventionView;

describe("operação cotidiana A&A", () => {
  it("leitura falha não vira zero", () => {
    expect(countOf({ ok: false, reason: "permissão" }, "x").value).toBeNull();
    expect(countOf({ ok: true, rows: [1, 2], truncated: false }, "x").value).toBe(2);
  });
  it("prazo vencido vem antes e plano encerrado some", () => {
    const t = dailyTasks([view({ stage: "aguardando-reavaliacao" }), view({ overdue: ["ação X"] }), view({ stage: "encerrado", overdue: ["y"] })], { ok: true, rows: [], truncated: false }, "2026-10-12");
    expect(t.map((x) => x.title)).toEqual(["Intervenção com prazo vencido", "Reavaliação pendente"]);
  });
  it("rascunho inválido é descartado e incompleto aponta pendências", () => {
    expect(parseDraft("{x")).toBeNull();
    expect(draftIssues({ objective: "", skills: "", strategies: "", responsibles: "", due: "" })).toHaveLength(5);
  });
});
