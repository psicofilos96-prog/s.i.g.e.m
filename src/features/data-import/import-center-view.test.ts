import { describe, expect, it } from "vitest";
import { adapterById } from "./adapters";
import { buildCenterPreview, centerExceptionsCsv, compensableRows, readCensusSource, censusRejectionsCsv } from "./import-center-view";
import { sha256Hex } from "./import-kernel";
import { sha256Hex as censusSha } from "@/features/census-cycle/census-cycle-source";

const censo = adapterById("censo-matriz-escolas")!;
const e = (inep: string, nome: string, linha: number) => ({ inep, nome, aba: "Urbanas", linha });
const file = (escolas: unknown[]) => JSON.stringify({ fonte: "t", escolas });
const SHA = "a".repeat(64);

describe("NIMPORT.3 — Central de Importações sobre o núcleo comum", () => {
  it("arquivo vazio é recusado explicitamente, nunca lote vazio", () => {
    const r = buildCenterPreview(censo, "   ", SHA, "v.json", []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("arquivo-vazio");
  });
  it("arquivo inválido é recusado como ilegível", () => {
    const r = buildCenterPreview(censo, "{não é json", SHA, "x.json", []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("arquivo-ilegivel");
  });
  it("arquivo repetido gera a mesma chave de idempotência do lote", () => {
    const t = file([e("33000001", "A", 1)]);
    const a = buildCenterPreview(censo, t, SHA, "a.json", []), b = buildCenterPreview(censo, t, SHA, "b.json", []);
    expect(a.ok && b.ok && a.preview.batchKey === b.preview.batchKey).toBe(true);
    if (a.ok) expect(a.preview.batchKey).toBe(`${censo.id}@${censo.version}:${SHA}:lote`);
  });
  it("conflito e duplicidade entram no relatório de exceções; válida não", () => {
    const existing = [{ identityKey: "inep:33000004", canonicalRef: "w", values: { nome: "Outro" } }];
    const r = buildCenterPreview(censo, file([e("33000001", "A", 1), e("33000001", "B", 2), e("33000004", "D", 3)]), SHA, "c.json", existing);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preview.exceptions.map((x) => x.outcome)).toHaveLength(2);
    const csv = centerExceptionsCsv(r.preview.rows);
    expect(csv.startsWith("\uFEFFLinha;Resultado;Motivos")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(3);
  });
  it("rollback: plano de compensação só com aplicadas não compensadas", () => {
    expect(compensableRows([
      { row_id: "r1", kind: "aplicada" }, { row_id: "r2", kind: "aplicada" }, { row_id: "r2", kind: "compensacao" },
      { row_id: "r3", kind: "falhou" }, { row_id: null, kind: "confirmacao" },
    ])).toEqual(["r1"]);
  });
  it("grande volume: 20.000 linhas classificadas e reportadas sem perda", () => {
    const rows = Array.from({ length: 20_000 }, (_, i) => e(String(33000000 + (i % 19_000)).padStart(8, "0"), `E${i}`, i + 1));
    const t0 = performance.now();
    const r = buildCenterPreview(censo, file(rows), SHA, "g.json", []);
    expect(performance.now() - t0).toBeLessThan(5000);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.preview.rows).toHaveLength(20_000); expect(r.preview.counts.total).toBe(20_000); expect(r.preview.exceptions.length).toBe(r.preview.counts.total - r.preview.counts.valida); }
  });
});

describe("NIMPORT.3 — Censo no mesmo contrato", () => {
  it("vazio, ilegível e não-lista são recusados", () => {
    expect(readCensusSource("").ok).toBe(false);
    expect(readCensusSource("{x").ok).toBe(false);
    expect(readCensusSource('{"a":1}').ok).toBe(false);
    expect(readCensusSource("[]").ok).toBe(false);
    expect(readCensusSource('[{"school_id":"s","measure":"m","value":1}]').ok).toBe(true);
  });
  it("impressão digital do Censo é a do núcleo", async () => {
    const t = '[{"a":1}]';
    expect(await censusSha(t)).toBe(await sha256Hex(new TextEncoder().encode(t)));
  });
  it("rejeições viram relatório de exceções CSV", () => {
    const csv = censusRejectionsCsv([{ row: 2, reason: "medida desconhecida; ver" }]);
    expect(csv).toContain('2;Rejeitada;"medida desconhecida; ver"');
  });
});
