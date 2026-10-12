import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { allowedInboxActs, groupInbox, type InboxRow } from "./unit-inbox";

const sql = readFileSync(`drizzle/migrations/${readdirSync("drizzle/migrations").find((n) => n.includes("doc09_unit_inbox"))}`, "utf8");
const row = (o: Partial<InboxRow>): InboxRow => ({ dispatchId: "d", caseNumber: "PROC-1", subject: "s", fromUnitId: "A", toUnitId: "B", dueOn: null, settledAs: null, myCiencia: false, ...o });

describe("L09 caixa de entrada", () => {
  it("agrupa por situação e ordena por prazo declarado, sem prazo ao fim", () => {
    const g = groupInbox([row({ caseNumber: "P2" }), row({ caseNumber: "P1", dueOn: "2026-10-15" }), row({ settledAs: "recebido" })]);
    expect(g["a-receber"].map((r) => r.caseNumber)).toEqual(["P1", "P2"]);
    expect(g["em-andamento"]).toHaveLength(1);
  });
  it("providência/análise/tarefa só após recebimento; ciência uma vez por pessoa", () => {
    expect(allowedInboxActs(row({}))).toEqual(["ciencia"]);
    expect(allowedInboxActs(row({ settledAs: "recebido", myCiencia: true }))).toEqual(["providencia", "analise", "tarefa_vinculada"]);
    expect(sql).toMatch(/admin_case_inbox_one_ciencia_per_person/);
  });
  it("autor vem da sessão; caixa limitada à competência; append-only", () => {
    expect(sql).toMatch(/_person uuid := public.current_person_id\(\)/);
    expect(sql).toMatch(/WHERE public.case_can_act\(d.to_unit_id, 'instruir-processos'\)/);
    expect(sql).toMatch(/can_read_operational_task/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
