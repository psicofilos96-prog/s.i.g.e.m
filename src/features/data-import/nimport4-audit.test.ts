// NIMPORT.4 — auditoria final transversal: nenhuma importação corrige dado canônico em silêncio.
import { describe, it, expect } from "vitest";
import { IMPORT_ADAPTERS } from "./adapters";
import { applyConfirmed, rowStates, type EventView, type Rpc, type StagedRow } from "./import-engine";
import { readFileSafely, idempotencyKey, compensationPlan, importTooLarge } from "./import-kernel";
import { buildPreimportPlan } from "@/features/year-preparation/preimport-plan";
import { buildSchoolProposal, importSelectedSchools, type SchoolStaging } from "@/features/institutional-admin/school-source-import";

const row = (id: string, outcome: StagedRow["outcome"]): StagedRow & { id: string } =>
  ({ id, lineRef: id, outcome, identityKey: id, values: {}, reasons: [], canonicalRef: null } as unknown as StagedRow & { id: string });

describe("NIMPORT.4", () => {
  it("adaptador com leiaute disponível tem writer; sem leiaute não presume colunas", () => {
    for (const a of IMPORT_ADAPTERS) {
      if (a.layoutStatus === "disponivel") expect(a.apply, a.id).toBeTypeOf("function");
      else expect(() => a.parse("a;b\n1;2")).toThrow();
    }
  });

  it("arquivo vazio ou ilegível é recusado, nunca vira lote vazio", () => {
    expect(readFileSafely("", () => []).ok).toBe(false);
    expect(readFileSafely("{{", () => { throw new Error("x"); }).ok).toBe(false);
    expect(importTooLarge({ size: 21 * 1024 * 1024 })).toBe(true);
  });

  it("conflito, rejeitada, duplicada e já reconciliada nunca chegam ao writer", async () => {
    const adapter = IMPORT_ADAPTERS.find((a) => a.apply)!;
    const rows = [row("c", "conflito"), row("r", "rejeitada"), row("d", "duplicada-na-fonte"), row("j", "ja-reconciliada")];
    const calls: string[] = [];
    const rpc: Rpc = async (fn) => { calls.push(fn); return { data: null, error: null }; };
    const ctx = { batchId: "b", sourceName: "s", sourceSha256: "h", sourceRef: null, fields: Object.fromEntries((adapter.confirmFields ?? []).map((f) => [f.key, "2027-01-01"])) };
    const r = await applyConfirmed(adapter, rows, [], ctx, rpc);
    expect(r.applied).toBe(0);
    expect(calls.every((f) => f === "record_import_event")).toBe(true);
  });

  it("reexecução após sucesso não grava de novo; compensada não é reaplicada", () => {
    const rows = [row("a", "valida"), row("b", "valida")];
    const ev: EventView[] = [
      { row_id: "a", kind: "aplicada", canonical_ref: "v1", detail: null, recorded_at: "" },
      { row_id: "b", kind: "aplicada", canonical_ref: "v2", detail: null, recorded_at: "" },
      { row_id: "b", kind: "compensacao", canonical_ref: null, detail: "x", recorded_at: "" },
    ] as EventView[];
    const s = rowStates(rows, ev);
    expect(s.get("a")).toBe("aplicada");
    expect(s.get("b")).toBe("compensada");
    expect(Array.isArray(compensationPlan(ev))).toBe(true);
  });

  it("idempotência e preparação 2027: mesma fonte ⇒ mesmas chaves; duplicada e sem chave recusadas", () => {
    const input = { adapter: "x", version: 1, sourceSha256: "h", keys: ["A", "B", "B", null], existing: new Map([["A", "id-a"]]) };
    const p1 = buildPreimportPlan(input), p2 = buildPreimportPlan(input);
    expect(p1).toEqual(p2);
    expect(p1.find((r) => r.key === "A")!.action).toBe("ligar");
    expect(p1.find((r) => r.key === "B")!.action).toBe("rejeitar-duplicado");
    expect(p1.some((r) => r.action === "rejeitar-sem-chave")).toBe(true);
    expect(idempotencyKey("x", 1, "h", "A")).toBe(idempotencyKey("x", 1, "h", "A"));
  });

  it("escolas: já cadastrada nunca é regravada pela fonte", async () => {
    const e = { inep: "33000001", official_name: "E", administrative_dependency: "municipal", private_school_category: null, partnership_public_authority: null, location_kind: "urbana", active: true, phone: null, institutional_email: null, source_sheet: null, source_line: 1 };
    const src = { escolas: [e, { ...e, inep: "33000002" }, { ...e, inep: "33000002" }, { ...e, inep: "12" }] } as unknown as SchoolStaging;
    const rows = buildSchoolProposal(src, new Set(["33000001"]));
    expect(rows.map((r) => r.status)).toEqual(["ja-cadastrado", "novo", "duplicado-na-fonte", "inep-invalido"]);
    const writes: unknown[] = [];
    const rpc = (async (_fn: string, a: Record<string, unknown>) => { writes.push(a); return { data: null, error: null }; }) as Parameters<typeof importSelectedSchools>[2];
    await importSelectedSchools(rows, { act: "decisão", validFrom: "2027-01-01" }, rpc, src);
    expect(writes.length).toBe(1);
  });
});
