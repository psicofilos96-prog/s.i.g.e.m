import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { effectiveSessions, sessionProblem, sessionSummary, type Session } from "./service-sessions";

const s = (o: Partial<Session>): Session => ({ id: "s1", seq: 1, mode: "presencial", spaceId: null, startedAt: "2026-10-12T09:00:00Z", endedAt: "2026-10-12T10:00:00Z", result: "parcial", summary: "troca de cabo de rede", rectifies: null, reason: null, personId: "t", ...o });
const SQL = readFileSync("drizzle/migrations/0482_tech08_service_sessions.sql", "utf8");

describe("Tecnologia L08 — atendimentos", () => {
  it("período, modo e retificação validados", () => {
    const base = { mode: "remoto" as const, spaceId: null, startedAt: "2026-10-12T09:00:00Z", endedAt: "2026-10-12T09:30:00Z", summary: "acesso remoto ao servidor", rectifies: null, reason: null };
    expect(sessionProblem(base, "2026-10-12T08:00:00Z", "2026-10-12T12:00:00Z")).toBeNull();
    expect(sessionProblem({ ...base, endedAt: base.startedAt }, "2026-10-12T08:00:00Z", "2026-10-12T12:00:00Z")).toBe("periodo-invalido");
    expect(sessionProblem(base, "2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z")).toBe("periodo-futuro");
    expect(sessionProblem(base, "2026-10-12T10:00:00Z", "2026-10-12T12:00:00Z")).toBe("anterior-ao-chamado");
    expect(sessionProblem({ ...base, spaceId: "sala" }, "2026-10-12T08:00:00Z", "2026-10-12T12:00:00Z")).toBe("remoto-com-espaco");
    expect(sessionProblem({ ...base, rectifies: "s1" }, "2026-10-12T08:00:00Z", "2026-10-12T12:00:00Z")).toBe("retificacao-sem-motivo");
  });
  it("retificação substitui na leitura e preserva histórico", () => {
    const all = [s({}), s({ id: "s2", seq: 2, result: "resolvido", rectifies: "s1", reason: "resultado registrado errado" }),
      s({ id: "s3", seq: 3, mode: "remoto", startedAt: "2026-10-12T11:00:00Z", endedAt: "2026-10-12T11:30:00Z", result: "resolvido" })];
    expect(effectiveSessions(all).map((x) => x.id)).toEqual(["s2", "s3"]);
    expect(sessionSummary(all)).toMatchObject({ sessions: 2, presencial: 1, remoto: 1, minutesPresencial: 60, minutesRemoto: 30, lastResult: "resolvido", rectified: 1 });
  });
  it("banco: só o responsável vigente, evidência oculta, append-only, sem mexer no estado", () => {
    expect(SQL).toMatch(/nao-responsavel/);
    expect(SQL).toMatch(/REVOKE SELECT ON public\.tech_service_sessions FROM authenticated/);
    expect(SQL).not.toMatch(/GRANT SELECT \([^)]*evidence_ref/);
    expect(SQL).toMatch(/doc_numbering_append_only/);
    expect(SQL).not.toMatch(/INSERT INTO public\.ops_request_events/);
  });
});
