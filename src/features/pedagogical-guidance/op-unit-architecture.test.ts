import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { OP_SECTIONS, opScope, type OpGrant } from "./op-unit-architecture";

const dirs = ["supabase/migrations", "drizzle/migrations"].filter((d) => existsSync(d));
const sql = dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`${d}/${f}`, "utf8"))).join("\n");
const routeExists = (r: string) => existsSync(`src/routes/${r.slice(1)}.tsx`);

describe("OP L01 — matriz das 34 seções", () => {
  it("34 seções em ordem", () => expect(OP_SECTIONS.map((s) => s.n)).toEqual(Array.from({ length: 34 }, (_, i) => i + 1)));
  it("toda tabela/função/capacidade citada existe nas migrations", () => {
    for (const s of OP_SECTIONS) for (const t of [...s.tables, ...s.functions]) expect(sql, `${s.n}:${t}`).toMatch(new RegExp(`\\b${t}\\b`));
    for (const s of OP_SECTIONS) for (const c of s.capabilities) expect(sql, `${s.n}:${c}`).toContain(`'${c}'`);
  });
  it("toda rota e teste citado existe", () => {
    for (const s of OP_SECTIONS) for (const r of s.routes) expect(routeExists(r), `${s.n}:${r}`).toBe(true);
    for (const s of OP_SECTIONS) for (const t of s.tests) expect(existsSync(t), `${s.n}:${t}`).toBe(true);
  });
  it("seção existente tem referência real; bloqueada/lacuna explica", () => {
    for (const s of OP_SECTIONS.filter((x) => x.status === "existente" && x.n !== 2))
      expect(s.tables.length + s.functions.length + s.routes.length + s.tests.length, `${s.n}`).toBeGreaterThan(0);
    for (const s of OP_SECTIONS.filter((x) => x.status !== "existente")) expect(s.note.length, `${s.n}`).toBeGreaterThan(10);
  });
});

const g = (capability: string, scope: "escola" | "rede", schoolId: string | null, to: string | null = null): OpGrant => ({ capability, scope, schoolId, from: "2026-01-01", to });
const ctx = (grants: OpGrant[], personNatural = true) => ({ personNatural, grants, date: "2026-05-10" });

describe("OP L01 — unidade × coordenação central", () => {
  it("orientador da unidade registra e consulta só a própria escola", () => {
    const c = ctx([g("registrar-acompanhamento-pedagogico", "escola", "sA"), g("consultar-acompanhamento-pedagogico", "escola", "sA")]);
    expect(opScope(c, "registrar", "sA")).toMatchObject({ ok: true, via: "unidade" });
    expect(opScope(c, "registrar", "sB").ok).toBe(false);
    expect(opScope(c, "consultar", "sB").ok).toBe(false);
  });
  it("coordenação central consulta a rede mas não registra pela unidade", () => {
    const c = ctx([g("consultar-acompanhamento-pedagogico", "rede", null), g("registrar-acompanhamento-pedagogico", "rede", null)]);
    expect(opScope(c, "consultar", "sB")).toMatchObject({ ok: true, via: "central" });
    expect(opScope(c, "registrar", "sB").ok).toBe(false);
  });
  it("vigência encerrada e executor técnico negam", () => {
    expect(opScope(ctx([g("registrar-acompanhamento-pedagogico", "escola", "sA", "2026-04-30")]), "registrar", "sA").ok).toBe(false);
    expect(opScope(ctx([g("registrar-acompanhamento-pedagogico", "escola", "sA")], false), "registrar", "sA").ok).toBe(false);
  });
});
