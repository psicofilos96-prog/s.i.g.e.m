import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { TEACHER_SECTIONS, CANONICAL_CHAIN, gaps } from "./teacher-architecture";

const dirs = ["supabase/migrations", "drizzle/migrations"].filter((d) => existsSync(d));
const migrations = dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`${d}/${f}`, "utf8"))).join("\n");

describe("Perfil Docente L01 — auditoria", () => {
  it("cobre as 34 seções em ordem", () => {
    expect(TEACHER_SECTIONS.map((s) => s.n)).toEqual(Array.from({ length: 34 }, (_, i) => i + 1));
  });
  it("toda rota e módulo citado existe", () => {
    const missing = TEACHER_SECTIONS.flatMap((s) => [...s.routes, ...s.modules]).filter((p) => !existsSync(p));
    expect(missing).toEqual([]);
  });
  it("toda tabela citada nasce numa migration (sem cadastro paralelo inventado)", () => {
    const tables = [...new Set(TEACHER_SECTIONS.flatMap((s) => s.tables))];
    expect(tables.filter((t) => !new RegExp(`create table (if not exists )?(public\\.)?${t}\\b`, "i").test(migrations))).toEqual([]);
  });
  it("status 'tela' exige rota; lacuna/parcial exige motivo", () => {
    for (const s of TEACHER_SECTIONS) {
      if (s.status === "tela") expect(s.routes.length + s.modules.length).toBeGreaterThan(0);
      if (s.status === "lacuna" || s.status === "bloqueado") expect(s.gap).toBeTruthy();
    }
  });
  it("cadeia canônica termina no registro autorizado pela atribuição; Central da Aula vem primeiro", () => {
    expect(CANONICAL_CHAIN.at(-2)?.step).toBe("atribuicao");
    expect(gaps()[0]?.n).toBe(8);
  });
});
