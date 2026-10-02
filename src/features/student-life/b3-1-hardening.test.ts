import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { academicYearsOn, activeClassesOn, b3Message, homologatedMovementTypes } from "./cycle-enrollment-source";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: async () => ({ data: [], error: null }), from: () => ({}) } }));

/**
 * Testes unitários da B3.1. As regras do banco são verificadas por execução real em
 * `supabase/tests/b3_1_cycle_enrollment_chain.sql` (transação descartada); aqui só o lado TS.
 */
function rpcClient(data: unknown, error: { message: string } | null = null) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    rpc: async (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return { data, error }; },
    from: () => { throw new Error("leitura direta proibida"); },
  };
}

describe("B3.1 — tipos de movimentação", () => {
  it("usa o reader canônico com data explícita e nunca lê a tabela", async () => {
    const c = rpcClient([{ id: "t", version: 2, label: "Tipo" }]);
    const r = await homologatedMovementTypes("2026-07-01", "2026-08-01T00:00:00Z", c as never);
    expect(c.calls).toEqual([{ fn: "movement_types_at", args: { _on: "2026-07-01", _known_at: "2026-08-01T00:00:00Z" } }]);
    expect(r).toEqual([{ valueId: "t", version: 2, label: "Tipo" }]);
    const src = readFileSync(join(process.cwd(), "src/features/student-life/cycle-enrollment-source.ts"), "utf8");
    expect(src).not.toMatch(/from\("movement_type_definitions"\)/);
  });
  it("catálogo vazio continua vazio", async () => {
    expect(await homologatedMovementTypes("2026-07-01", null, rpcClient([]) as never)).toEqual([]);
  });
});

describe("B3.1 — leituras de apoio por data", () => {
  const v = (version: number, valid_from: string, is_active: boolean, official_name = `v${version}`) =>
    ({ academic_year_id: "ano", official_name, version, valid_from, is_active });
  it("ano: maior versão com valid_from <= data; versão futura não vale", () => {
    expect(academicYearsOn([v(1, "2020-01-01", true), v(2, "2026-09-01", true)], "2026-03-01")).toEqual([{ id: "ano", name: "v1" }]);
    expect(academicYearsOn([v(1, "2020-01-01", true), v(2, "2026-09-01", true)], "2026-10-01")).toEqual([{ id: "ano", name: "v2" }]);
  });
  it("ano inativo na data não é oferecido; ausência é lista vazia", () => {
    expect(academicYearsOn([v(1, "2020-01-01", true), v(2, "2026-01-01", false)], "2026-03-01")).toEqual([]);
    expect(academicYearsOn([v(1, "2027-01-01", true)], "2026-03-01")).toEqual([]);
  });
  it("turma: rótulo e estado vêm de class_at na data", async () => {
    const calls: unknown[] = [];
    const c = {
      rpc: async (_f: string, a: Record<string, unknown>) => {
        calls.push(a);
        return { data: a["_class_id"] === "t1" ? [{ name: "Turma 1", administrative_status: "ativa" }] : [{ name: "X", administrative_status: "inativa" }], error: null };
      },
    };
    const r = await activeClassesOn([{ id: "t1", academic_year_id: "a" }, { id: "t2", academic_year_id: "a" }], "2026-03-01", c as never);
    expect(r).toEqual([{ id: "t1", academic_year_id: "a", name: "Turma 1" }]);
    expect(calls[0]).toEqual({ _class_id: "t1", _valid_on: "2026-03-01", _known_at: null });
  });
});

describe("B3.1 — mensagens dos novos códigos", () => {
  it("integridade pai→filho é explicada, sem cascata", () => {
    expect(b3Message(new Error("ending:child-participation-outside"))).toMatch(/participação/);
    expect(b3Message(new Error("participation:child-allocation-outside"))).toMatch(/alocação/);
    expect(b3Message(new Error("movement:type-not-current"))).toMatch(/vigente/);
  });
});

describe("B3.1 — teste SQL executável existe e não é busca de texto", () => {
  it("bloco transacional com fixtures e chamadas reais", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/tests/b3_1_cycle_enrollment_chain.sql"), "utf8");
    expect(sql).toMatch(/PERFORM public\.record_class_allocation\(/);
    expect(sql).toMatch(/RAISE EXCEPTION 'b31-tests-ok:%'/);
  });
});
