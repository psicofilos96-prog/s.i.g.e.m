import { describe, expect, it } from "vitest";
import { runReport, toCsv } from "@/features/reports/report-engine";
import { reportById } from "@/features/reports/report-registry";
import { catalogEntry } from "@/features/reports/report-catalog";
import { TRANSPORTE_ROTAS, transportPicture, transportReportRows, type TransportFact } from "./transport-model";

const f = (o: Partial<TransportFact>): TransportFact => ({ id: o.logical_id!, school_id: "A", kind: "rota", logical_id: "x", version: 1, route_logical_id: null, stop_logical_id: null, student_id: null, label: null, valid_from: "2026-01-01", valid_until: null, revoked: false, recorded_at: "2026-01-01T00:00:00Z", ...o });
const rows = [
  f({ logical_id: "r1", label: "=HYPERLINK(1)" }), f({ logical_id: "r2", label: "Rota vazia" }),
  f({ logical_id: "p1", kind: "ponto", route_logical_id: "r1", label: "Praça" }),
  f({ logical_id: "v1", kind: "vinculo-estudante", stop_logical_id: "p1", student_id: "aluno-secreto" }),
  f({ logical_id: "rB", school_id: "B", label: "Rota da B" }),
];

describe("relatório de transporte", () => {
  const pic = transportPicture(rows, "A", "2026-03-01");
  it("conta vínculos, rota sem ponto sai ausente (não zero) e outra escola não entra", () => {
    const r = transportReportRows(pic);
    expect(r).toContainEqual({ route: "Rota vazia", stop: null, students: null });
    expect(r).toContainEqual({ route: "=HYPERLINK(1)", stop: "Praça", students: 1 });
    expect(r.some((x) => x["route"] === "Rota da B")).toBe(false);
  });
  it("CSV neutraliza fórmula e não expõe estudante", () => {
    const csv = toCsv(runReport(TRANSPORTE_ROTAS, { params: {} }, transportReportRows(pic)), { headerLines: ["A"], title: "t" });
    expect(csv).not.toContain("aluno-secreto");
    expect(csv).toMatch(/'=HYPERLINK/);
  });
  it("registrado no catálogo com tela dona", () => {
    const d = reportById("transporte-rotas-escola")!; expect(JSON.stringify(catalogEntry(d))).toContain("/transporte-escolar");
  });
});
