import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createActionGuard } from "./idempotency";

describe("NIDEM.1 — ações repetíveis", () => {
  it("clique duplo: a segunda chamada reaproveita a primeira (uma só ida ao banco)", async () => {
    const g = createActionGuard(); let calls = 0;
    const fn = () => new Promise<string>((r) => { calls++; setTimeout(() => r("ok"), 5); });
    const [a, b] = await Promise.all([g.run("emitir:x", fn), g.run("emitir:x", fn)]);
    expect(calls).toBe(1); expect(a).toBe("ok"); expect(b).toBe("ok");
  });
  it("retry após falha de rede usa a MESMA chave", async () => {
    const g = createActionGuard(); const keys: string[] = [];
    await expect(g.run("i", async (k) => { keys.push(k); throw new Error("Failed to fetch"); })).rejects.toThrow();
    await g.run("i", async (k) => { keys.push(k); return 1; });
    expect(keys[0]).toBe(keys[1]);
  });
  it("depois de sucesso ou recusa definitiva, nova intenção recebe chave nova (nada fica silenciosamente repetível)", async () => {
    const g = createActionGuard(); const keys: string[] = [];
    await g.run("i", async (k) => { keys.push(k); return 1; });
    await expect(g.run("i", async (k) => { keys.push(k); throw new Error("document:not-eligible"); })).rejects.toThrow();
    await g.run("i", async (k) => { keys.push(k); return 1; });
    expect(new Set(keys).size).toBe(3);
  });
  it("emissão de documento passa pela função com chave idempotente; banco recusa chave reutilizada com pedido diferente", () => {
    expect(readFileSync("src/features/school-documents/document-source.ts", "utf8")).toMatch(/emit_school_document_v3/);
    const sql = readFileSync("drizzle/migrations/0241_nidem1_document_emission_idempotency.sql", "utf8");
    expect(sql).toMatch(/idempotency:key-reused/);
    expect(sql).toMatch(/requested_by <> auth\.uid\(\)/);
  });
});
