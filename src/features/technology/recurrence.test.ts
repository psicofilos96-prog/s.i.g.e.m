import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { currentRule, problemCandidates, recurrenceAnalysis, type IncidentFact, type RecurrenceRule } from "./recurrence";

const R: RecurrenceRule = { id: "r1", version: 1, windowDays: 30, minIncidents: 3, personId: "a", approvedBy: "b" };
const f = (id: string, createdAt: string, o: Partial<IncidentFact> = {}): IncidentFact => ({ id, schoolId: "s1", createdAt, nature: "incidente", categoryKey: "rede", objectRefs: ["bem:1"], ...o });
const F = [f("1", "2026-10-01"), f("2", "2026-10-05"), f("3", "2026-10-10"), f("4", "2026-08-01"), f("5", "2026-10-10", { nature: "requisicao" }), f("6", "2026-10-11", { categoryKey: null }), f("7", "2026-10-11", { objectRefs: ["bem:2"] })];
const SQL = readFileSync("drizzle/migrations/0483_tech09_recurrence_rule.sql", "utf8");

describe("Tecnologia L09 — recorrência", () => {
  it("sem regra aprovada por outra pessoa não há sinal", () => {
    expect(recurrenceAnalysis({ facts: F, rules: [], linkedTicketIds: new Set(), now: "2026-10-12" }).status).toBe("sem-regra");
    expect(currentRule([{ ...R, approvedBy: "a" }])).toBeNull();
  });
  it("só incidentes na janela, por escola+categoria+objeto, acima do mínimo", () => {
    const a = recurrenceAnalysis({ facts: F, rules: [R], linkedTicketIds: new Set(), now: "2026-10-12" });
    if (a.status !== "ok") throw new Error();
    expect(a.incidents).toBe(5);
    expect(a.uncategorized).toBe(1);
    expect(a.groups).toHaveLength(1);
    expect(a.groups[0]).toMatchObject({ objectRef: "bem:1", count: 3, ticketIds: ["1", "2", "3"], first: "2026-10-01", last: "2026-10-10" });
  });
  it("candidata a problema só enquanto houver incidente sem PRB", () => {
    const a1 = recurrenceAnalysis({ facts: F, rules: [R], linkedTicketIds: new Set(["1", "2"]), now: "2026-10-12" });
    expect(problemCandidates(a1)).toHaveLength(1);
    const a2 = recurrenceAnalysis({ facts: F, rules: [R], linkedTicketIds: new Set(["1", "2", "3"]), now: "2026-10-12" });
    expect(problemCandidates(a2)).toHaveLength(0);
  });
  it("banco: fonte, aprovador ≠ autor, append-only, nenhum problema aberto automaticamente", () => {
    expect(SQL).toMatch(/source text NOT NULL/);
    expect(SQL).toMatch(/aprovador-igual-autor/);
    expect(SQL).toMatch(/doc_numbering_append_only/);
    expect(SQL).not.toMatch(/tech_problems/);
  });
});
