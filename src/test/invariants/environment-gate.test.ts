import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error módulo .mjs sem tipos
import * as gate from "../../../scripts/environment-gate.mjs";

const C = "crfqhyqkujhhlbiyhdbc";
const X = "vwhvqtdvzbnfffkgoaen";

describe("gate de ambiente canônico", () => {
  it("aceita o destino canônico em todas as formas", () => {
    for (const t of [C, `https://${C}.supabase.co`, `postgresql://postgres:pw@db.${C}.supabase.co:5432/postgres`, `postgresql://postgres.${C}:pw@aws-0-us-west-2.pooler.supabase.com:6543/postgres`]) {
      expect(gate.assertCanonicalTarget(t).ref).toBe(C);
    }
  });
  it("recusa destino divergente, inclusive o externo não canônico", () => {
    for (const t of [X, `https://${X}.supabase.co`, `postgresql://postgres.${X}:pw@aws-0-us-west-2.pooler.supabase.com:6543/postgres`]) {
      expect(() => gate.assertCanonicalTarget(t)).toThrow(/não canônico/);
    }
    expect(() => gate.assertCanonicalTarget("abcdefghijabcdefghij")).toThrow(/recusado/);
  });
  it("falha fechado sem ref resolvível (nome 'postgres' não prova destino) e com refs ambíguos", () => {
    expect(() => gate.assertCanonicalTarget("postgresql://postgres:pw@localhost:5432/postgres")).toThrow(/sem project ref/);
    expect(() => gate.assertCanonicalTarget(undefined)).toThrow(/sem project ref/);
    expect(() => gate.assertCanonicalTarget(`postgresql://postgres.${X}:pw@db.${C}.supabase.co/postgres`)).toThrow(/divergentes/);
  });
  it("mensagens nunca expõem senha", () => {
    try { gate.assertCanonicalTarget(`postgresql://postgres.${X}:SEGREDO@h.pooler.supabase.com/postgres`); } catch (e) { expect(String(e)).not.toContain("SEGREDO"); }
  });
  it("config versionada aponta para o canônico e nenhum arquivo versionado trata o externo como produção", () => {
    expect(gate.assertRepoConfig()).toBe(C);
    expect(readFileSync("drizzle.config.ts", "utf8")).not.toContain(X);
    expect(readFileSync("docs/ambiente-canonico-sigem.md", "utf8")).toMatch(new RegExp(`${X}[^\\n]*não canônico`, "i"));
  });
});
