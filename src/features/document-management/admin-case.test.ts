import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { allowedActions, caseProjection, explainCaseError, type CaseEvent } from "./admin-case";

const sql = readFileSync(`drizzle/migrations/${readdirSync("drizzle/migrations").find((n) => n.includes("doc07_administrative_cases"))}`, "utf8");
const ev = (seq: number, eventType: CaseEvent["eventType"], extra: Partial<CaseEvent> = {}): CaseEvent =>
  ({ seq, eventType, documentOrder: null, documentRef: null, toUnitId: null, authorPerson: "p", createdAt: "", ...extra });

describe("L07 processo administrativo", () => {
  it("autos ordenados e reabertura preservam histórico", () => {
    const p = caseProjection([
      ev(1, "autuado"), ev(3, "documento_juntado", { documentOrder: 2, documentRef: "b" }),
      ev(2, "documento_juntado", { documentOrder: 1, documentRef: "a" }),
      ev(4, "concluido"), ev(5, "reaberto"),
    ]);
    expect(p.autos.map((a) => a.documentRef)).toEqual(["a", "b"]);
    expect(p.status).toBe("aberto");
    expect(p.reopenings).toBe(1);
    expect(p.history).toHaveLength(5);
  });
  it("concluído só aceita reabertura", () => {
    expect(allowedActions("concluido")).toEqual(["reaberto"]);
    expect(sql).toMatch(/case:concluded/);
    expect(sql).toMatch(/reabrir-processos/);
  });
  it("banco garante numeração, ordem única de documentos e append-only", () => {
    expect(sql).toMatch(/UNIQUE \(year, seq\)/);
    expect(sql).toMatch(/admin_case_events_doc_order/);
    expect(sql).toMatch(/case:stale-base/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
  it("traduz recusa", () => { expect(explainCaseError("case:text-required")).toMatch(/texto/); });
});
