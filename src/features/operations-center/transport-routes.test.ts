import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { latestSafety, protectedRouteView, routeVersionOn, simulateRoute, type RouteVersion } from "./transport-routes";

const SQL = readFileSync("drizzle/migrations/0424_ops17_transport_routes.sql", "utf8");
const v = (n: number, from: string, approved: boolean): RouteVersion => ({ id: `v${n}`, version: n, shift: "manhã", capacity: 40, capacitySource: "CRLV", validFrom: from, validUntil: null, schools: ["e1"], itinerary: [], approved });

describe("Centro de Operações L17 — rotas e itinerários", () => {
  it("versão vigente só aprovada e temporal", () => {
    expect(routeVersionOn([v(1, "2026-02-01", true), v(2, "2026-08-01", false)], "2026-09-01")?.id).toBe("v1");
    expect(routeVersionOn([v(1, "2026-02-01", true)], "2026-01-01")).toBeNull();
  });
  it("simulação isolada aponta capacidade, ordem e pontos não avaliados", () => {
    const r = simulateRoute({ itinerary: [{ stopId: "a", time: "06:40" }, { stopId: "b", time: "06:30" }], capacity: 1, boardingsPerStop: { a: 1, b: 1 }, safety: { a: "seguro" } });
    expect(r.issues.map((i) => i.issue)).toEqual(["horario-fora-de-ordem", "ponto-nao-seguro", "capacidade-excedida"]);
    expect(r.writes).toEqual([]);
    expect(simulateRoute({ itinerary: [], capacity: null, boardingsPerStop: {}, safety: {} }).issues[0]!.issue).toBe("capacidade-desconhecida");
    expect(latestSafety([{ stopId: "a", result: "seguro", assessedOn: "2026-01-01" }, { stopId: "a", result: "inseguro", assessedOn: "2026-05-01" }], "a")).toBe("inseguro");
  });
  it("rotina individual protegida", () => {
    const view = protectedRouteView([{ stopId: "a", time: "06:40" }, { stopId: "b", time: "06:50" }], { a: 1, b: 5 }, 3);
    expect(view).toEqual([{ order: 1, time: "06:40", students: "suprimido" }, { order: 2, time: "06:50", students: 5 }]);
    expect(JSON.stringify(view)).not.toMatch(/stopId|student_id/);
    expect(protectedRouteView([{ stopId: "a", time: "06:40" }], { a: 9 }, null)[0]!.students).toBe("bloqueado");
  });
  it("banco: aprovação ≠ autor, pontos seguros, capacidade com fonte, sem estudante na rota", () => {
    for (const r of ["opsroute:self-approval", "opsroute:unsafe-stop", "opsroute:capacity-unknown", "opsroute:conflict", "opsroute:retroactive", "opsroute:time-order", "opsroute:invalid-stop", "opsstop:future-date"]) expect(SQL).toContain(r);
    expect(SQL).toContain("CHECK ((capacity IS NULL) = (capacity_source IS NULL))");
    expect(SQL).not.toMatch(/student_id/);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
