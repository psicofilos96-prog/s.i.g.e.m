import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { currentPolicy, policyProblem, ticketClock, type SlaPolicy } from "./sla";

const P: SlaPolicy = { id: "p1", version: 1, impacts: ["alto", "baixo"], urgencies: ["alta", "baixa"],
  matrix: { "alto|alta": "P1", "alto|baixa": "P2", "baixo|alta": "P2", "baixo|baixa": "P3" },
  deadlines: { P1: { response_hours: 2, resolution_hours: 8 }, P2: { response_hours: 4, resolution_hours: 24 }, P3: { response_hours: 8, resolution_hours: 72 } },
  alertPercents: [50, 80], pauseOnWait: true, personId: "autor", approvedBy: "outro" };
const ev = (seq: number, kind: string, at: string) => ({ seq, kind, actorPerson: "t", at }) as never;
const A = [{ seq: 1, policyVersionId: "p1", impact: "alto", urgency: "alta", priority: "P1", at: "2026-10-12T08:00:00Z" }];
const SQL = readFileSync("drizzle/migrations/0480_tech06_sla_policy.sql", "utf8");

describe("Tecnologia L06 — prioridade, prazos e alertas", () => {
  it("política precisa ser completa e coerente", () => {
    expect(policyProblem(P)).toBeNull();
    expect(policyProblem({ ...P, matrix: { ...P.matrix, "baixo|baixa": "" } })).toBe("celula-sem-prioridade:baixo|baixa");
    expect(policyProblem({ ...P, deadlines: { ...P.deadlines, P1: { response_hours: 9, resolution_hours: 8 } } })).toBe("prazo-invalido:P1");
    expect(policyProblem({ ...P, alertPercents: [100] })).toBe("alerta-invalido");
  });
  it("só vale a última versão aprovada por outra pessoa", () => {
    expect(currentPolicy([P])?.id).toBe("p1");
    expect(currentPolicy([{ ...P, approvedBy: "autor" }])).toBeNull();
    expect(currentPolicy([P, { ...P, id: "p2", version: 2, approvedBy: null }])).toBeNull();
  });
  it("sem avaliação nada é concluído", () => {
    expect(ticketClock({ createdAt: "2026-10-12T08:00:00Z", events: [], assessments: [], policies: [P], now: "2026-10-12T20:00:00Z" }).status).toBe("sem-avaliacao");
  });
  it("alerta por limiar e vencimento; resposta cumprida no início", () => {
    const c = ticketClock({ createdAt: "2026-10-12T08:00:00Z", events: [ev(1, "atribuicao", "2026-10-12T08:30:00Z"), ev(2, "inicio", "2026-10-12T09:00:00Z")], assessments: A, policies: [P], now: "2026-10-12T15:00:00Z" });
    if (c.status !== "ok") throw new Error();
    expect(c.response).toMatchObject({ met: true, elapsedHours: 1, alert: "nenhum" });
    expect(c.resolution).toMatchObject({ met: false, elapsedHours: 7, alert: "limiar-80" });
    const late = ticketClock({ createdAt: "2026-10-12T08:00:00Z", events: [], assessments: A, policies: [P], now: "2026-10-12T17:00:00Z" });
    expect(late.status === "ok" && late.resolution.alert).toBe("vencido");
  });
  it("espera pausa o relógio quando a política declara", () => {
    const es = [ev(1, "atribuicao", "2026-10-12T08:00:00Z"), ev(2, "inicio", "2026-10-12T08:30:00Z"), ev(3, "espera", "2026-10-12T09:00:00Z"), ev(4, "inicio", "2026-10-12T13:00:00Z")];
    const c = ticketClock({ createdAt: "2026-10-12T08:00:00Z", events: es, assessments: A, policies: [P], now: "2026-10-12T14:00:00Z" });
    expect(c.status === "ok" && c.resolution.elapsedHours).toBe(2);
    const c2 = ticketClock({ createdAt: "2026-10-12T08:00:00Z", events: es, assessments: A, policies: [{ ...P, pauseOnWait: false }], now: "2026-10-12T14:00:00Z" });
    expect(c2.status === "ok" && c2.resolution.elapsedHours).toBe(6);
  });
  it("banco: fonte obrigatória, aprovador ≠ autor, prioridade calculada pela matriz, append-only, sem cron", () => {
    expect(SQL).toMatch(/source text NOT NULL/);
    expect(SQL).toMatch(/aprovador-igual-autor/);
    expect(SQL).toMatch(/_pol\.matrix->>\(_impact \|\| '\|' \|\| _urgency\)/);
    expect((SQL.match(/doc_numbering_append_only/g) ?? []).length).toBe(3);
    expect(SQL).not.toMatch(/cron\.schedule/);
  });
});
