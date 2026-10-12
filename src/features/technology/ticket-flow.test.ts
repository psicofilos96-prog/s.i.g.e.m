import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { reviewProblem, ticketHistory, ticketStage, type Review } from "./ticket-flow";

const ev = (seq: number, kind: string, at: string, actor = "tec") => ({ seq, kind, actorPerson: actor, at, responsibleEngagement: "eng" }) as never;
const rv = (seq: number, kind: Review["kind"], at: string, conclusionSeq: number | null = null, personId = "sol"): Review => ({ seq, kind, conclusionSeq, personId, at, note: "nota suficiente" });
const done = [ev(1, "atribuicao", "2026-10-02"), ev(2, "inicio", "2026-10-03"), ev(3, "conclusao", "2026-10-04")];
const SQL = readFileSync("drizzle/migrations/0479_tech05_ticket_flow.sql", "utf8");

describe("Tecnologia L05 — fluxo do chamado", () => {
  it("triagem → atribuição → atendimento → aguardando verificação", () => {
    expect(ticketStage([], [])).toBe("aguardando-triagem");
    expect(ticketStage([], [rv(1, "triagem", "2026-10-01")])).toBe("triado");
    expect(ticketStage(done.slice(0, 2), [])).toBe("em-atendimento");
    expect(ticketStage(done, [])).toBe("aguardando-verificacao");
  });
  it("verificação vale para a conclusão específica; recusa pede reabertura", () => {
    expect(ticketStage(done, [rv(1, "verificacao-aceita", "2026-10-05", 3)])).toBe("concluido-verificado");
    expect(ticketStage(done, [rv(1, "verificacao-recusada", "2026-10-05", 3)])).toBe("verificacao-recusada");
    const reopened = [...done, ev(4, "reabertura", "2026-10-06")];
    expect(ticketStage(reopened, [rv(1, "triagem", "2026-10-01"), rv(2, "verificacao-recusada", "2026-10-05", 3)])).toBe("atribuido");
  });
  it("verificador ≠ executor; triagem só antes do atendimento ou após reabertura", () => {
    expect(reviewProblem({ kind: "verificacao-aceita", events: done, actor: "tec" })).toBe("verificador-igual-executor");
    expect(reviewProblem({ kind: "verificacao-aceita", events: done.slice(0, 2), actor: "sol" })).toBe("nao-concluido");
    expect(reviewProblem({ kind: "triagem", events: done.slice(0, 1), actor: "tec" })).toBe("triagem-fora-de-hora");
    expect(reviewProblem({ kind: "triagem", events: [], actor: "tec" })).toBeNull();
  });
  it("histórico junta os dois ledgers em ordem sem perder nada", () => {
    const h = ticketHistory(done, [rv(1, "triagem", "2026-10-01")]);
    expect(h.map((x) => x.kind)).toEqual(["triagem", "atribuicao", "inicio", "conclusao"]);
  });
  it("banco: append-only, uma verificação por conclusão, verificador ≠ executor", () => {
    expect(SQL).toMatch(/verificador-igual-executor/);
    expect(SQL).toMatch(/tech_review_once_per_conclusion/);
    expect(SQL).toMatch(/doc_numbering_append_only/);
    expect(SQL).toMatch(/FROM PUBLIC, anon/);
  });
});
