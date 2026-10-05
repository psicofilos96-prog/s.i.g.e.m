import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applyConfirmed, classifyRows, countRows, rowStates, sha256Hex, type EventView, type Rpc } from "./import-engine";
import { adapterById } from "./adapters";

const censo = adapterById("censo-matriz-escolas")!;
const real = readFileSync("docs/data/escolas-itaperuna-censo2026.json", "utf8");
const file = (escolas: unknown[]) => JSON.stringify({ fonte: "t", escolas });
const e = (inep: string, nome: string, linha: number) => ({ inep, nome, aba: "Urbanas", linha });

describe("importação governada", () => {
  it("arquivo real do repositório passa sem rejeições e sem escrita", () => {
    const rows = classifyRows(censo, censo.parse(real), []);
    expect(rows.length).toBeGreaterThan(0);
    expect(countRows(rows).rejeitada).toBe(0);
  });
  it("mesmo arquivo ⇒ mesmo hash; arquivo diferente ⇒ hash diferente", async () => {
    const a = new TextEncoder().encode(real);
    expect(await sha256Hex(a)).toBe(await sha256Hex(a));
    expect(await sha256Hex(new TextEncoder().encode(real + " "))).not.toBe(await sha256Hex(a));
  });
  it("duplicidade, linha inválida e matching por identidade, nunca por nome", () => {
    const rows = classifyRows(censo, censo.parse(file([e("33000001", "A", 1), e("33000001", "B", 2), e("123", "C", 3), e("33000002", "A", 4)])), []);
    expect(rows.map((r) => r.outcome)).toEqual(["valida", "duplicada-na-fonte", "rejeitada", "valida"]);
    expect(rows[2]!.reasons.join()).toContain("8");
  });
  it("conflito de identidade não é resolvido; igual ⇒ já reconciliada", () => {
    const existing = [{ identityKey: "inep:33000001", canonicalRef: "escola x", values: { nome: "A" } },
      { identityKey: "inep:33000003", canonicalRef: "y", values: {} }, { identityKey: "inep:33000003", canonicalRef: "z", values: {} },
      { identityKey: "inep:33000004", canonicalRef: "w", values: { nome: "Outro" } }];
    const rows = classifyRows(censo, censo.parse(file([e("33000001", "A", 1), e("33000003", "B", 2), e("33000004", "D", 3)])), existing);
    expect(rows.map((r) => r.outcome)).toEqual(["ja-reconciliada", "conflito", "conflito"]);
  });
  it("leiaute ausente não presume colunas", () => {
    expect(() => adapterById("gpe")!.parse("a;b")).toThrow(/não presume|nenhuma coluna/);
    expect(adapterById("educacenso-matricula")!.apply).toBeUndefined();
  });

  const rowsWithId = () => classifyRows(censo, censo.parse(file([e("33000001", "A", 1), e("33000002", "B", 2), e("x", "C", 3)])), []).map((r, i) => ({ ...r, id: `r${i}` }));
  const ctx = { batchId: "b", sourceName: "t", sourceSha256: "0".repeat(64), sourceRef: null, fields: { validFrom: "2027-01-01" } };

  it("confirmação antes; falha parcial registrada; capability do cadastro recusa", async () => {
    const calls: [string, Record<string, unknown>][] = [];
    const rpc: Rpc = async (fn, args) => {
      calls.push([fn, args]);
      if (fn === "register_school_record_version" && args["_inep"] === "33000002") return { data: null, error: { message: "capability:manter-cadastro-escolar" } };
      return { data: fn === "register_school_record_version" ? "v1" : { id: "e" }, error: null };
    };
    const r = await applyConfirmed(censo, rowsWithId(), [], ctx, rpc);
    expect(r).toEqual({ applied: 1, failed: 1, skipped: 1 });
    expect(calls[0]![1]["_kind"]).toBe("confirmacao");
    expect(calls.filter(([f]) => f === "register_school_record_version")).toHaveLength(2);
    expect(calls.some(([, a]) => a["_kind"] === "falhou")).toBe(true);
  });
  it("reaplicar é idempotente: só retoma falhas", async () => {
    const rows = rowsWithId();
    const ev: EventView[] = [{ row_id: null, kind: "confirmacao", canonical_ref: null, detail: null, recorded_at: "" },
      { row_id: "r0", kind: "aplicada", canonical_ref: "v1", detail: null, recorded_at: "" },
      { row_id: "r1", kind: "falhou", canonical_ref: null, detail: "x", recorded_at: "" }];
    expect(rowStates(rows, ev).get("r0")).toBe("aplicada");
    const writes: unknown[] = [];
    const rpc: Rpc = async (fn, a) => { if (fn === "register_school_record_version") writes.push(a["_inep"]); return { data: "v2", error: null }; };
    expect(await applyConfirmed(censo, rows, ev, ctx, rpc)).toEqual({ applied: 1, failed: 0, skipped: 2 });
    expect(writes).toEqual(["33000002"]);
  });
  it("campo obrigatório da confirmação bloqueia antes de qualquer escrita", async () => {
    let n = 0; const rpc: Rpc = async () => { n++; return { data: null, error: null }; };
    await expect(applyConfirmed(censo, rowsWithId(), [], { ...ctx, fields: {} }, rpc)).rejects.toThrow(/field-required/);
    expect(n).toBe(0);
  });
});
