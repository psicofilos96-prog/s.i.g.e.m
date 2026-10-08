import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  compensationPlan, exceptionReport, exceptionReportCsv, idempotencyKey, keyCounts, readFileSafely, sha256Hex, stableHash,
} from "./import-kernel";
import { classifyRows, type ImportAdapter } from "./import-engine";
import { buildPreimportPlan } from "@/features/year-preparation/preimport-plan";
import { planFingerprint, professionalCandidates } from "@/features/year-preparation/correspondence-dryrun";

const adapter: ImportAdapter = {
  id: "teste", version: 1, label: "t", layoutStatus: "disponivel", layoutSource: null, accepts: ".csv", comparedFields: ["nome"],
  parse: (t) => t.trim().split("\n").slice(1).map((l, i) => { const [k, nome] = l.split(";"); return { lineRef: `L${i + 2}`, raw: { k, nome } }; }),
  normalize: (r) => ({ identityKey: (r.raw["k"] as string) || null, values: { nome: (r.raw["nome"] as string) ?? null }, problems: [] }),
};

describe("NIMPORT.2 — núcleo comum de importações", () => {
  it("hash estável preserva o valor histórico (FNV-1a)", () => {
    expect(stableHash("")).toBe("811c9dc5");
    expect(stableHash("a")).toBe("e40c292c");
  });

  it("sha256 do arquivo é o mesmo em reexecução", async () => {
    const b = new TextEncoder().encode("k;nome\n1;Ana");
    expect(await sha256Hex(b)).toBe(await sha256Hex(b));
    expect((await sha256Hex(new Uint8Array())).startsWith("e3b0c442")).toBe(true);
  });

  it("chave de idempotência tem formato canônico único", () => {
    expect(idempotencyKey("escolas", 2, "abc", "123")).toBe("escolas@2:abc:123");
    const plan = buildPreimportPlan({ adapter: "escolas", version: 2, sourceSha256: "abc", keys: ["123"], existing: new Map() });
    expect(plan[0]?.idempotencyKey).toBe("escolas@2:abc:123");
  });

  it("reexecução da pré-importação e do dry-run gera o mesmo resultado", () => {
    const input = { adapter: "x", version: 1, sourceSha256: "s", keys: ["b", "a", "a", null, "c"], existing: new Map([["c", "id-c"]]) };
    expect(buildPreimportPlan(input)).toEqual(buildPreimportPlan(input));
    const ctx = { version: 1, sourceSha256: "s", schools: new Map([["E1", "sch-1"]]), persons: new Map([["P1", "per-1"]]) };
    const rows = [{ person: "P1", school: "E1" }, { person: "P2", school: "E9" }] as never;
    expect(planFingerprint(professionalCandidates(ctx, rows))).toBe(planFingerprint(professionalCandidates(ctx, rows)));
  });

  it("arquivo vazio ou ilegível nunca vira lote vazio aceito", () => {
    expect(readFileSafely("   ", adapter.parse)).toMatchObject({ ok: false, code: "arquivo-vazio" });
    expect(readFileSafely("k;nome\n", adapter.parse)).toMatchObject({ ok: false, code: "arquivo-vazio" });
    expect(readFileSafely("x", () => { throw new Error("cabeçalho ausente"); })).toMatchObject({ ok: false, code: "arquivo-ilegivel" });
    expect(readFileSafely("k;nome\n1;Ana", adapter.parse)).toMatchObject({ ok: true });
  });

  it("relatório de exceções lista toda linha recusada, duplicada ou em conflito", () => {
    const rows = classifyRows(adapter, adapter.parse("k;nome\n1;Ana\n1;Ana\n;Sem\n2;Bia"), [{ identityKey: "2", canonicalRef: "c2", values: { nome: "Beatriz" } }]);
    const rep = exceptionReport(rows, (r) => ({ locator: r.line_ref, outcome: r.outcome, reasons: r.reasons }), ["valida", "ja-reconciliada"]);
    expect(rep.map((r) => [r.locator, r.outcome])).toEqual([["L3", "duplicada-na-fonte"], ["L4", "rejeitada"], ["L5", "conflito"]]);
    const csv = exceptionReportCsv(rep);
    expect(csv.startsWith("\uFEFFLinha;Resultado;Motivos")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(4);
  });

  it("duplicidade na fonte ignora chave vazia", () => {
    expect([...keyCounts([" a", "a", "", null, "b"])]).toEqual([["a", 2], ["b", 1]]);
  });

  it("rollback só compensa aplicadas ainda não compensadas; nada é apagado", () => {
    const ev = [
      { row_id: "r1", kind: "aplicada" }, { row_id: "r2", kind: "aplicada" }, { row_id: "r2", kind: "compensacao" },
      { row_id: "r3", kind: "falhou" }, { row_id: null, kind: "confirmacao" },
    ];
    expect(compensationPlan(ev)).toEqual(["r1"]);
  });

  it("nenhum módulo fora do núcleo reimplementa FNV-1a ou SHA-256 de importação", () => {
    const offenders: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f) && !f.includes(".test.")) {
      const s = readFileSync(p, "utf8");
      if (s.includes("0x811c9dc5") && !p.endsWith("import-kernel.ts")) offenders.push(p);
    } } };
    for (const d of ["src/features/data-import", "src/features/year-preparation", "src/features/census-reconciliation", "src/features/census-cycle"]) walk(d);
    expect(offenders).toEqual([]);
  });
});
