import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { CLOSURE_CRITERIA, CLOSURE_SECTIONS, INGRESS_TABLES, closureProblems } from "./ingress-closure";

const migs = readdirSync("drizzle/migrations").filter((f) => /^04(5[5-9]|6\d|7\d)_/.test(f));
const all = migs.map((f) => readFileSync(`drizzle/migrations/${f}`, "utf8")).join("\n");

describe("L24 fechamento do ingresso", () => {
  it("matriz 45 × 22 com evidência real em disco e lacunas descritas", () => {
    expect(closureProblems(existsSync)).toEqual([]);
  });
  it("nenhum item afirma homologação humana", () => {
    for (const r of [...CLOSURE_SECTIONS, ...CLOSURE_CRITERIA]) expect(r.status).not.toMatch(/homolog/i);
    expect(CLOSURE_CRITERIA.find((c) => c.n === 22)?.status).toBe("parcial");
  });
  it("toda tabela do ingresso nasce em migration com RLS, sem DML direta e append-only", () => {
    for (const t of INGRESS_TABLES) {
      expect(all).toMatch(new RegExp(`CREATE TABLE public\\.${t} \\(`));
      expect(all).toMatch(new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`));
    }
    expect(all).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO (anon|authenticated)/);
    expect(all).not.toMatch(/GRANT SELECT ON public\.enr_[a-z_, .]* TO anon/);
  });
  it("writers SECURITY DEFINER fixam search_path e nunca usam service_role/_actor", () => {
    const defs = all.split("CREATE OR REPLACE FUNCTION").slice(1).filter((f) => /SECURITY DEFINER/.test(f.slice(0, 600)));
    expect(defs.length).toBeGreaterThan(20);
    for (const d of defs) expect(d.slice(0, 600)).toMatch(/SET search_path (=|TO) ''/);
    expect(all).not.toMatch(/_actor uuid|auth\.role\(\) = 'service_role'/);
  });
  it("prova SQL de RLS existe e cobre anon e DML", () => {
    const t = readFileSync("supabase/tests/enr24_ingress_rls.sql", "utf8");
    expect(t).toMatch(/relrowsecurity/);
    expect(t).toMatch(/has_function_privilege\('anon'/);
  });
});
