import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { currentUnit, dispatchSituation, explainDispatchError, type Dispatch } from "./case-dispatch";

const read = (k: string) => readFileSync(`drizzle/migrations/${readdirSync("drizzle/migrations").find((n) => n.includes(k))}`, "utf8");
const sql = read("doc08_case_dispatches") + read("doc08_safe_view_access");
const d: Dispatch = { id: "d1", dispatchSeq: 1, fromUnitId: "A", toUnitId: "B", responsibleEngagementId: null, dueOn: "2026-10-20", dueBasis: "decisão X" };

describe("L08 tramitação", () => {
  it("situação, responsável e prazo são projeções", () => {
    expect(dispatchSituation(d, [], "2026-10-21")).toEqual({ situation: "em-transito", responsible: null, overdue: true });
    const s = dispatchSituation(d, [{ dispatchId: "d1", eventType: "recebido", responsibleEngagementId: null },
      { dispatchId: "d1", eventType: "responsavel_assumiu", responsibleEngagementId: "eng-9" }], "2026-10-10");
    expect(s).toEqual({ situation: "recebido", responsible: "eng-9", overdue: false });
    expect(dispatchSituation({ ...d, dueOn: null }, [], "2030-01-01").overdue).toBeNull();
  });
  it("unidade atual só muda com recebimento", () => {
    expect(currentUnit("A", [d], [])).toBe("A");
    expect(currentUnit("A", [d], [{ dispatchId: "d1", eventType: "recebido", responsibleEngagementId: null }])).toBe("B");
  });
  it("banco: um recebimento, prazo com fundamento, anexo sensível com finalidade e trilha", () => {
    expect(sql).toMatch(/admin_case_dispatch_one_receipt/);
    expect(sql).toMatch(/due_on IS NULL OR coalesce\(btrim\(due_basis\),''\) <> ''/);
    expect(sql).toMatch(/ler-anexos-sensiveis/);
    expect(sql).toMatch(/admin_case_sensitive_access_log/);
    expect(sql).toMatch(/REVOKE SELECT ON public.admin_case_events FROM authenticated/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
  it("traduz recusa", () => { expect(explainDispatchError("dispatch:pending-receipt")).toMatch(/recebimento/); });
});
