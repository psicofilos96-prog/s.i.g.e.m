import { describe, expect, it } from "vitest";
import { executeBulk, paginate, previewBulk, bulkReport, idempotencyKeyOf, type BulkItem, type BulkOperation } from "./bulk-engine";
import { toCsv } from "@/features/reports/report-engine";

type P = { v: string };
const item = (k: string, scope: string | null = "esc-a", base: string | null = "b1", v = "ok"): BulkItem<P> => ({ key: k, scope, expectedBase: base, payload: { v } });

function op(over: Partial<BulkOperation<P>> = {}, store = new Map<string, string>(), calls: string[] = []): BulkOperation<P> {
  return { id: "teste", version: 1, label: "Teste", mode: "parcial", maxItems: 5000,
    validate: (i) => (i.payload.v === "bad" ? "Inválido." : null),
    currentBase: async (i) => store.get(i.key) ?? "b1",
    executeOne: async (i, k) => { if (i.payload.v === "boom") throw new Error("Writer recusou: capability"); calls.push(k); },
    ...over };
}
const done = () => new Set<string>();
const scopes = new Set<string | null>(["esc-a"]);

describe("operações em lote", () => {
  it("item de outra escola e sem escopo autorizado é recusado e nunca some", async () => {
    const items = [item("1"), item("2", "esc-b")];
    const pv = previewBulk(op(), items, scopes, "L");
    expect(pv.rows.map((r) => r.outcome)).toEqual(["pronto", "recusado"]);
    const r = await executeBulk(op(), items, pv, { confirmed: true, completed: done() });
    expect(r.rows).toHaveLength(2); expect(r.rows[1]!.outcome).toBe("recusado");
    expect(previewBulk(op(), items, null, "L").ready).toBe(0); // sem autoridade ⇒ falha fechada
  });
  it("exige confirmação e recusa prévia stale (seleção mudou)", async () => {
    const pv = previewBulk(op(), [item("1")], scopes, "L");
    await expect(executeBulk(op(), [item("1")], pv, { confirmed: false, completed: done() })).rejects.toThrow(/Confirme/);
    await expect(executeBulk(op(), [item("1"), item("2")], pv, { confirmed: true, completed: done() })).rejects.toThrow(/mudou/);
  });
  it("concorrência otimista: item alterado por outra pessoa é recusado, os demais seguem", async () => {
    const store = new Map([["2", "b2"]]); const o = op({}, store);
    const items = [item("1"), item("2")];
    const r = await executeBulk(o, items, previewBulk(o, items, scopes, "L"), { confirmed: true, completed: done() });
    expect(r.rows.map((x) => x.outcome)).toEqual(["executado", "recusado"]);
  });
  it("duplicidade na seleção não grava duas vezes", async () => {
    const calls: string[] = []; const o = op({}, new Map(), calls);
    const items = [item("1"), item("1")];
    const r = await executeBulk(o, items, previewBulk(o, items, scopes, "L"), { confirmed: true, completed: done() });
    expect(calls).toHaveLength(1); expect(r.rows[1]!.outcome).toBe("recusado");
  });
  it("lote parcial: falha do writer (sem permissão) é explícita e não desfaz os demais; retry não regrava", async () => {
    const calls: string[] = []; const o = op({}, new Map(), calls); const completed = done();
    const items = [item("1"), item("2", "esc-a", "b1", "boom"), item("3", "esc-a", "b1", "bad")];
    const pv = previewBulk(o, items, scopes, "L");
    const r1 = await executeBulk(o, items, pv, { confirmed: true, completed });
    expect(r1.rows.map((x) => x.outcome)).toEqual(["executado", "falhou", "recusado"]);
    expect(r1.rows[1]!.reason).toMatch(/capability/);
    const r2 = await executeBulk(o, items, pv, { confirmed: true, completed });
    expect(r2.rows[0]!.outcome).toBe("ja-executado"); expect(calls).toEqual([idempotencyKeyOf(o, "L", "1")]);
  });
  it("tudo-ou-nada: qualquer recusa impede a execução inteira", async () => {
    let called = 0; const o = op({ mode: "tudo-ou-nada", executeAll: async () => { called++; } });
    const items = [item("1"), item("2", "esc-a", "b1", "bad")];
    const r = await executeBulk(o, items, previewBulk(o, items, scopes, "L"), { confirmed: true, completed: done() });
    expect(called).toBe(0); expect(r.rows[0]!.outcome).toBe("nao-executado");
    const ok = [item("1"), item("3")];
    const r2 = await executeBulk(o, ok, previewBulk(o, ok, scopes, "L"), { confirmed: true, completed: done() });
    expect(called).toBe(1); expect(r2.counts.executado).toBe(2);
  });
  it("limite por lote e paginação estável", () => {
    expect(() => previewBulk(op({ maxItems: 2 }), [item("1"), item("2"), item("3")], scopes, "L")).toThrow(/limite/);
    const pages = paginate(Array.from({ length: 1001 }, (_, i) => ({ key: `k${i}` })), 200);
    expect(pages).toHaveLength(6); expect(new Set(pages.flat().map((x) => x.key)).size).toBe(1001);
  });
  it("1.200 itens sintéticos isolados: contagens exatas, sem perda", async () => {
    const calls: string[] = []; const o = op({}, new Map(), calls);
    const items = Array.from({ length: 1200 }, (_, i) => item(`s${i}`, i % 10 === 0 ? "esc-b" : "esc-a", "b1", i % 7 === 0 ? "boom" : "ok"));
    const r = await executeBulk(o, items, previewBulk(o, items, scopes, "L"), { confirmed: true, completed: done() });
    expect(r.rows).toHaveLength(1200);
    expect(r.counts.recusado + r.counts.executado + r.counts.falhou).toBe(1200);
    expect(r.counts.recusado).toBe(120); expect(new Set(calls).size).toBe(calls.length);
  });
  it("relatório do lote neutraliza fórmulas e mostra recusados", async () => {
    const items = [item("=HYPERLINK(1)"), item("x", "esc-b")];
    const r = await executeBulk(op(), items, previewBulk(op(), items, scopes, "L"), { confirmed: true, completed: done() });
    const csv = toCsv(bulkReport(r), { headerLines: [], title: "t" });
    expect(csv).toContain("'=HYPERLINK"); expect(csv).toContain("Recusado");
  });
});
