import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { activeMembers, groupQueue, responsibilityHistory, workload, type QueueTicket } from "./support-queue";

const ev = (seq: number, kind: string, at: string, eng?: string) => ({ seq, kind, actorPerson: "coord", at, responsibleEngagement: eng }) as never;
const route = (seq: number, groupId: string, at: string) => ({ seq, groupId, personId: "coord", at, reason: "encaminhado por triagem" });
const ok = (alert: string) => ({ status: "ok", priority: "P1", response: { limitHours: 1, elapsedHours: 0, met: false, alert: "nenhum" }, resolution: { limitHours: 8, elapsedHours: 0, met: false, alert } }) as never;
const T: QueueTicket[] = [
  { id: "a", createdAt: "2026-10-01", events: [], routings: [route(1, "g1", "2026-10-01")], clock: ok("nenhum") },
  { id: "b", createdAt: "2026-10-05", events: [ev(1, "atribuicao", "2026-10-05", "e1")], routings: [route(1, "g1", "2026-10-05")], clock: ok("vencido") },
  { id: "c", createdAt: "2026-10-02", events: [], routings: [route(1, "g1", "2026-10-02"), route(2, "g2", "2026-10-03")], clock: ok("nenhum") },
  { id: "d", createdAt: "2026-10-02", events: [ev(1, "atribuicao", "2026-10-02", "x9")], routings: [route(1, "g1", "2026-10-02")], clock: { status: "sem-avaliacao" } },
];
const SQL = readFileSync("drizzle/migrations/0481_tech07_support_queue.sql", "utf8");

describe("Tecnologia L07 — fila e distribuição", () => {
  it("membros ativos = último evento incluir e atuação vigente", () => {
    expect(activeMembers([{ seq: 1, action: "incluir", engagementId: "e1" }, { seq: 2, action: "incluir", engagementId: "e2" }, { seq: 3, action: "retirar", engagementId: "e2" }, { seq: 4, action: "incluir", engagementId: "e3" }], new Set(["e1", "e2"]))).toEqual(["e1"]);
  });
  it("fila só do grupo vigente, vencidos primeiro, sem avaliação por último", () => {
    expect(groupQueue("g1", T).map((x) => x.id)).toEqual(["b", "a", "d"]);
    expect(groupQueue("g2", T).map((x) => x.id)).toEqual(["c"]);
  });
  it("carga por membro e responsável fora do grupo como divergência", () => {
    expect(workload("g1", T, ["e1", "e2"])).toEqual({ load: { e1: 1, e2: 0 }, unassigned: 1, responsibleOutsideGroup: ["d"] });
  });
  it("histórico junta encaminhamentos e atribuições", () => {
    expect(responsibilityHistory(T[2]!).map((h) => h.ref)).toEqual(["g1", "g2"]);
    expect(responsibilityHistory(T[1]!).map((h) => h.kind)).toEqual(["grupo", "responsavel"]);
  });
  it("banco: atuação vigente da escola, grupo da mesma escola, motivo, append-only", () => {
    expect(SQL).toMatch(/atuacao-nao-vigente/);
    expect(SQL).toMatch(/grupo-de-outra-escola/);
    expect(SQL).toMatch(/reason text NOT NULL/);
    expect((SQL.match(/doc_numbering_append_only/g) ?? []).length).toBe(3);
    expect(SQL).toMatch(/FROM PUBLIC, anon/);
  });
});
