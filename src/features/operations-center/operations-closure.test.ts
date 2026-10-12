import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { OPS_CLOSURE_CRITERIA, OPS_CLOSURE_SECTIONS, OPS_LOTS, auditedOpsExport, opsClosureProblems, opsClosureSummary } from "./operations-closure";
import { OPS_EXPORT_CAP } from "./operations-reports";

describe("L24 fechamento do Centro de Operações", () => {
  it("60 seções, 20 critérios, 24 lotes com evidência em disco e cenários provados", () => {
    expect(opsClosureProblems(existsSync, (p) => readFileSync(p, "utf8"))).toEqual([]);
    expect(OPS_CLOSURE_SECTIONS).toHaveLength(60);
    expect(OPS_CLOSURE_CRITERIA).toHaveLength(20);
    expect(OPS_LOTS).toHaveLength(24);
  });
  it("nenhum status homologado e bloqueios externos permanecem", () => {
    const all = [...OPS_CLOSURE_SECTIONS, ...OPS_CLOSURE_CRITERIA];
    expect(all.some((r) => (r.status as string) === "homologado")).toBe(false);
    expect(OPS_CLOSURE_CRITERIA.find((r) => r.n === 10)!.status).toBe("bloqueado");
    expect(opsClosureSummary(all).bloqueado).toBeGreaterThan(0);
  });
});

describe("auditedOpsExport", () => {
  const base = { exportCap: OPS_EXPORT_CAP, reportId: "ops-t", version: 1, title: "T", format: "csv" as const, rows: 1, content: "a;b", key: "k1" };
  it("sem capacidade não registra nem libera", async () => {
    const record = vi.fn();
    await expect(auditedOpsExport({ ...base, caps: new Set(), record })).rejects.toThrow();
    expect(record).not.toHaveBeenCalled();
  });
  it("registra SHA-256 antes de liberar", async () => {
    const record = vi.fn(async () => ({ verification_code: "ABC" }));
    const r = await auditedOpsExport({ ...base, caps: new Set([OPS_EXPORT_CAP]), record });
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ sha256: r.sha256, key: "k1" }));
  });
  it("falha no registro bloqueia o arquivo", async () => {
    const record = vi.fn(async () => { throw new Error("rede"); });
    await expect(auditedOpsExport({ ...base, caps: new Set([OPS_EXPORT_CAP]), record })).rejects.toThrow();
  });
});
